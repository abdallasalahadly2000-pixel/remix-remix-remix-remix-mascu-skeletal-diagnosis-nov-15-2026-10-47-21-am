export type ClinicalTier =
  | 'Optimal / Peak Bone Health'
  | 'Normal Bone Integrity'
  | 'Osteopenia / Early Deterioration'
  | 'Osteoporosis / High Fracture Risk';

export type MeasurementMode = 'dual' | 'full';

export interface QusClinicalInputs {
  mode: MeasurementMode;
  sos: number; // Calcaneal / corrected SOS (m/s)
  bua: number; // Broadband Ultrasound Attenuation (dB/MHz)
  unloadingMonths: number; // Microgravity / disuse duration t (months)

  // Optional Soft-Tissue Calibration (AIUM c_soft = 1540 m/s)
  useSoftTissueCorrection?: boolean;
  dTotalMm?: number; // transducer distance d_total (mm)
  dSoftMm?: number; // soft tissue thickness d_soft (mm)
  tTotalUs?: number; // total transit time t_total (µs)

  // Optional Multi-Site / NASA SCAN / IGEA / Omnisense Probe Inputs
  trabecularSos?: number; // Trabecular velocity (m/s), nominal ~1950 m/s
  radialSos?: number; // Distal radius axial velocity (m/s), nominal 4150 m/s
  bttUs?: number; // Bone Transmission Time (µs), nominal 1.65 µs
  fwaMv?: number; // Fast Wave Amplitude (mV)
  sdyMvUs2?: number; // Signal Dynamics SD_y (mV/µs^2)
  echoDelayUs?: number; // Periosteal-to-endosteal echo delay Δt_echo (µs), h_cort = 1.70 * Δt_echo

  // Optional direct overrides for verification / specialized hardware outputs
  overrideSi?: number | null;
  overrideQui?: number | null;
  overrideUbpi?: number | null;
  overrideRhoApp?: number | null;
  overrideElasticModulusGpa?: number | null;
  overrideBvTv?: number | null;
}

export interface FullQusAnalysis {
  mode: MeasurementMode;
  // Stage 0: Primary & Derived Plug-and-Play Clinical Outputs
  correctedSos: number;
  bua: number;
  si: number;
  tSi: number;
  qui: number;
  ebmd: number;
  tEbmd: number;
  ebmdProjected: number;
  unloadingMonths: number;
  tRadius: number | null;
  bvTv: number | null;
  bttUs: number | null;
  ubpi: number | null;
  hCortMm: number | null;
  rhoApp: number | null;
  elasticModulusGpa: number | null;

  // Stage 1: Normalized Z sub-scores (μ_young ± σ_young)
  subScores: {
    zBua: number;
    zSi: number;
    zQui: number;
    zEbmd: number;
    zEbmdProjected: number;
    zBvTv: number | null;
    zBtt: number | null;
    zUbpi: number | null;
    zRad: number | null;
    zHcort: number | null;
    zSos: number;
    zRho: number | null;
    zE: number | null;
  };

  // Stage 2: Modular Domain Scores & Composite Z_master
  domains: {
    dMass: number;
    dMicro: number | null;
    dCort: number | null;
    dMech: number;
    activeMask: [number, number, number, number];
  };
  zMaster: number;

  // Stage 3: Final Health & Deterioration Indicators
  bhi: number; // Unified Bone Health Index (0 - 100)
  bdsPercent: number; // Bone Deterioration & 10-Year Fragility Risk Score (0 - 100%)
  clinicalTier: ClinicalTier;
  prediction: 'Normal' | 'Osteopenia' | 'Osteoporosis';
  confidence: number;
  tScore: number;
  recommendedAction: string;
}

/**
 * Calibrated clinical ultrasound & microgravity bone-quality engine combining:
 * - NASA HRP / NSBRI SCAN trabecular & disuse equations
 * - FDA PMA databases (GE Lunar Achilles, Hologic Sahara, Sunlight Omnisense)
 * - IGEA DBM Sonic logistic microarchitecture index (UBPI & BTT)
 * - Two-phase acoustic elasticity & Moayyeri et al. QUS fragility risk calibration
 */
export function computeFullQusAnalysis(inputs: QusClinicalInputs): FullQusAnalysis {
  const {
    mode,
    bua,
    unloadingMonths = 0,
    useSoftTissueCorrection = false,
    dTotalMm,
    dSoftMm,
    tTotalUs,
  } = inputs;

  // 1. Soft-tissue-corrected SOS (c_soft = 1,540 m/s) when transducer path metrics provided
  let sos = inputs.sos;
  if (
    useSoftTissueCorrection &&
    dTotalMm &&
    dSoftMm !== undefined &&
    tTotalUs &&
    dTotalMm > dSoftMm
  ) {
    const dTotalM = dTotalMm / 1000;
    const dSoftM = dSoftMm / 1000;
    const tTotalS = tTotalUs / 1e6;
    const tBoneS = tTotalS - dSoftM / 1540;
    if (tBoneS > 0) {
      sos = (dTotalM - dSoftM) / tBoneS;
    }
  }

  // 2. Derived Heel & Composite Indices
  const rawSi = 0.67 * bua + 0.28 * sos - 420;
  const si = inputs.overrideSi ?? rawSi;
  const tSi = (si - 100.0) / 16.0;

  const rawQui = 0.41 * (bua + sos) - 571;
  const qui = inputs.overrideQui ?? rawQui;

  const ebmd = Math.max(0.05, 0.002592 * (bua + sos) - 3.687);
  const tEbmd = (ebmd - 0.580) / 0.110;
  const ebmdProjected = ebmd * Math.exp(-0.018 * Math.max(0, unloadingMonths));

  // 3. Multi-site & Structural Indices (computed cleanly when full suite active, or mapped for structural estimates)
  let tRadius: number | null = null;
  let bvTv: number | null = null;
  let bttUs: number | null = null;
  let ubpi: number | null = null;
  let hCortMm: number | null = null;
  let rhoApp: number | null = null;
  let elasticModulusGpa: number | null = null;

  if (mode === 'full') {
    const radSos = inputs.radialSos ?? 4150;
    tRadius = (radSos - 4150) / 140;

    const trabSos = inputs.trabecularSos ?? 1996;
    bvTv = inputs.overrideBvTv ?? Math.max(0.02, Math.min(0.85, 0.000625 * trabSos - 0.8875));

    bttUs = inputs.bttUs ?? 1.65;

    if (inputs.overrideUbpi !== undefined && inputs.overrideUbpi !== null) {
      ubpi = inputs.overrideUbpi;
    } else {
      const fwa = inputs.fwaMv ?? 52;
      const sdy = inputs.sdyMvUs2 ?? 1000;
      const bttMs = bttUs / 1000;
      ubpi = 1 / (1 + Math.exp(-0.00186 * sdy - 0.0566 * fwa - 1.14676 * bttMs + 3.03));
    }

    const deltaEcho = inputs.echoDelayUs ?? 1.882;
    hCortMm = 1.70 * deltaEcho;

    const mechSos = inputs.trabecularSos ?? 1950;
    rhoApp = inputs.overrideRhoApp ?? 1000 + 0.46875 * (mechSos - 1480);
    elasticModulusGpa =
      inputs.overrideElasticModulusGpa ?? 7.429e-10 * rhoApp * mechSos * mechSos;
  } else {
    // Dual Calcaneal Mode: also estimate equivalent trabecular biomechanics mapped smoothly from calcaneal SOS
    // (kept separate from D_micro/D_cort weighting via δ₂=0, δ₃=0 so unmeasured probes never bias Z_master)
    const mappedTrabSos = 1950 + (sos - 1555) * (120 / 35);
    bvTv = Math.max(0.04, Math.min(0.65, 0.000625 * mappedTrabSos - 0.8875));
    rhoApp = 1000 + 0.46875 * (mappedTrabSos - 1480);
    elasticModulusGpa = 7.429e-10 * rhoApp * mappedTrabSos * mappedTrabSos;
  }

  // Stage 1: Individual Output Normalization (z_i)
  const zBua = (bua - 92.0) / 13.0;
  const zSi = (si - 100.0) / 16.0;
  const zQui = (qui - 100.0) / 16.0;
  const zEbmd = (ebmd - 0.580) / 0.110;
  const zEbmdProjected = (ebmdProjected - 0.580) / 0.110;

  const zSos = (sos - 1555.0) / 35.0;
  const zRho = rhoApp !== null ? (rhoApp - 1220.0) / 110.0 : null;
  const zE = elasticModulusGpa !== null ? (elasticModulusGpa - 3.45) / 0.85 : null;

  const zBvTv = bvTv !== null ? (bvTv - 0.360) / 0.100 : null;
  const zBtt = bttUs !== null ? (bttUs - 1.65) / 0.25 : null;
  const zUbpi = ubpi !== null ? (ubpi - 0.85) / 0.12 : null;
  const zRad = tRadius !== null ? tRadius : null;
  const zHcort = hCortMm !== null ? (hCortMm - 3.20) / 0.55 : null;

  // Stage 2: Modular Domain Aggregation
  const dMass = (zBua + zSi + zQui + zEbmd + zEbmdProjected) / 5;

  const dMicro =
    mode === 'full' && zBvTv !== null && zBtt !== null && zUbpi !== null
      ? (zBvTv + zBtt + zUbpi) / 3
      : null;

  const dCort =
    mode === 'full' && zRad !== null && zHcort !== null
      ? (zRad + zHcort) / 2
      : null;

  const dMech =
    mode === 'full' && zRho !== null && zE !== null
      ? (zSos + zRho + zE) / 3
      : zSos;

  const delta1 = 1;
  const delta2 = dMicro !== null ? 1 : 0;
  const delta3 = dCort !== null ? 1 : 0;
  const delta4 = 1;

  const weightSum = 0.35 * delta1 + 0.25 * delta2 + 0.20 * delta3 + 0.20 * delta4;
  const zMasterRaw =
    (0.35 * delta1 * dMass +
      0.25 * delta2 * (dMicro ?? 0) +
      0.20 * delta3 * (dCort ?? 0) +
      0.20 * delta4 * dMech) /
    weightSum;

  const zMaster = Number(zMasterRaw.toFixed(2));

  // Stage 3: Unified Bone Health Index (BHI) & Bone Deterioration Risk Score (BDS)
  const bhi = Number(Math.min(100, Math.max(0, 100 + 15 * zMaster)).toFixed(1));
  const bdsPercent = Number(
    (100 / (1 + Math.exp(3.055 + 0.7419 * zMaster))).toFixed(1),
  );

  // Diagnostic Cutoffs & Treatment Action
  let clinicalTier: ClinicalTier;
  let prediction: 'Normal' | 'Osteopenia' | 'Osteoporosis';
  let recommendedAction: string;
  let margin: number;

  if (zMaster >= 0.0) {
    clinicalTier = 'Optimal / Peak Bone Health';
    prediction = 'Normal';
    margin = Math.min(1, zMaster / 1.5);
    recommendedAction =
      'Routine maintenance: continue standard load-bearing exercise (45 min/day ARED resistive schedule), 1,200 mg/day calcium, and 800 IU Vitamin D3.';
  } else if (zMaster > -1.0) {
    clinicalTier = 'Normal Bone Integrity';
    prediction = 'Normal';
    margin = Math.min(1, Math.abs(zMaster - -1.0));
    recommendedAction =
      'Normal structural status: monitor QUS + REMS metrics periodically and sustain balanced lower-limb axial loading.';
  } else if (zMaster > -2.5) {
    clinicalTier = 'Osteopenia / Early Deterioration';
    prediction = 'Osteopenia';
    margin = Math.min(1, Math.min(Math.abs(zMaster - -1.0), Math.abs(zMaster - -2.5)) / 0.85);
    recommendedAction =
      'Targeted resistance loading: increase ARED squat & heel-raise resistance by +15%, verify bilateral EMG symmetry >= 85%, optimize Vitamin D/calcium, and schedule follow-up QUS in 14 days.';
  } else {
    clinicalTier = 'Osteoporosis / High Fracture Risk';
    prediction = 'Osteoporosis';
    margin = Math.min(1, Math.abs(zMaster - -2.5) / 1.1);
    recommendedAction =
      'High fracture fragility detected: schedule confirmatory central DXA/REMS and Flight Surgeon pharmacotherapy consult; suspend high-impact EVA load until Z_master improves above -2.5.';
  }

  const confidence = Number((0.88 + margin * 0.11).toFixed(4));

  return {
    mode,
    correctedSos: Number(sos.toFixed(1)),
    bua: Number(bua.toFixed(1)),
    si: Number(si.toFixed(2)),
    tSi: Number(tSi.toFixed(2)),
    qui: Number(qui.toFixed(2)),
    ebmd: Number(ebmd.toFixed(3)),
    tEbmd: Number(tEbmd.toFixed(2)),
    ebmdProjected: Number(ebmdProjected.toFixed(3)),
    unloadingMonths,
    tRadius: tRadius !== null ? Number(tRadius.toFixed(2)) : null,
    bvTv: bvTv !== null ? Number(bvTv.toFixed(3)) : null,
    bttUs: bttUs !== null ? Number(bttUs.toFixed(2)) : null,
    ubpi: ubpi !== null ? Number(ubpi.toFixed(2)) : null,
    hCortMm: hCortMm !== null ? Number(hCortMm.toFixed(2)) : null,
    rhoApp: rhoApp !== null ? Number(rhoApp.toFixed(1)) : null,
    elasticModulusGpa:
      elasticModulusGpa !== null ? Number(elasticModulusGpa.toFixed(2)) : null,
    subScores: {
      zBua: Number(zBua.toFixed(2)),
      zSi: Number(zSi.toFixed(2)),
      zQui: Number(zQui.toFixed(2)),
      zEbmd: Number(zEbmd.toFixed(2)),
      zEbmdProjected: Number(zEbmdProjected.toFixed(2)),
      zBvTv: zBvTv !== null ? Number(zBvTv.toFixed(2)) : null,
      zBtt: zBtt !== null ? Number(zBtt.toFixed(2)) : null,
      zUbpi: zUbpi !== null ? Number(zUbpi.toFixed(2)) : null,
      zRad: zRad !== null ? Number(zRad.toFixed(2)) : null,
      zHcort: zHcort !== null ? Number(zHcort.toFixed(2)) : null,
      zSos: Number(zSos.toFixed(2)),
      zRho: zRho !== null ? Number(zRho.toFixed(2)) : null,
      zE: zE !== null ? Number(zE.toFixed(2)) : null,
    },
    domains: {
      dMass: Number(dMass.toFixed(2)),
      dMicro: dMicro !== null ? Number(dMicro.toFixed(2)) : null,
      dCort: dCort !== null ? Number(dCort.toFixed(2)) : null,
      dMech: Number(dMech.toFixed(2)),
      activeMask: [delta1, delta2, delta3, delta4],
    },
    zMaster,
    bhi,
    bdsPercent,
    clinicalTier,
    prediction,
    confidence,
    tScore: zMaster,
    recommendedAction,
  };
}

export interface BenchmarkPreset {
  id: string;
  label: string;
  subtitle: string;
  inputs: QusClinicalInputs;
}

export const QUS_BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'healthy-adult',
    label: 'Healthy Young Adult',
    subtitle: 'Peak Bone · BHI 100.0',
    inputs: {
      mode: 'full',
      sos: 1555,
      bua: 92,
      unloadingMonths: 0,
      trabecularSos: 1996,
      radialSos: 4150,
      bttUs: 1.65,
      echoDelayUs: 3.2 / 1.7,
      overrideSi: 100,
      overrideQui: 100,
      overrideUbpi: 0.85,
      overrideRhoApp: 1220,
      overrideElasticModulusGpa: 3.45,
      overrideBvTv: 0.36,
    },
  },
  {
    id: 'microgravity-osteopenia',
    label: '6-Mo Microgravity Loss',
    subtitle: 'Osteopenia · BHI 78.5',
    inputs: {
      mode: 'full',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      trabecularSos: 1772,
      radialSos: 3954,
      bttUs: 1.30,
      echoDelayUs: 2.55 / 1.7,
      overrideSi: 78,
      overrideQui: 76,
      overrideUbpi: 0.62,
      overrideRhoApp: 1090,
      overrideElasticModulusGpa: 2.30,
      overrideBvTv: 0.22,
    },
  },
  {
    id: 'severe-osteoporosis',
    label: 'Severe Osteoporosis',
    subtitle: 'High Risk · BHI 59.4',
    inputs: {
      mode: 'full',
      sos: 1465,
      bua: 56,
      unloadingMonths: 0,
      trabecularSos: 1644,
      radialSos: 3758,
      bttUs: 0.95,
      echoDelayUs: 1.90 / 1.7,
      overrideSi: 56,
      overrideQui: 54,
      overrideUbpi: 0.32,
      overrideRhoApp: 1010,
      overrideElasticModulusGpa: 1.55,
      overrideBvTv: 0.14,
    },
  },
];
