export type SeverityLevelId = 'L1' | 'L2' | 'L3' | 'L4';
export type BoneExerciseCategory = 'axial_compound' | 'hip_stability' | 'foot_ankle' | 'lumbar_core';

export interface ResearchTrainingDose {
  intensity: string;
  rpe: string;
  setsReps: string;
  restSeconds: string;
  frequencyPerWeek: string;
  tempo: string;
  citation: string;
}

export interface ExerciseMatrixRow {
  id: string;
  region: string;
  category: BoneExerciseCategory;
  skeletonBoneIds: string[];
  L1: string; // L1 - Normal
  L2: string; // L2 - Mild
  L3: string; // L3 - Moderate
  L4: string; // L4 - Severe
}

export const SEVERITY_LEVEL_META: Record<
  SeverityLevelId,
  {
    id: SeverityLevelId;
    label: string;
    shortLabel: string;
    zRangeLabel: string;
    headerCls: string;
    badgeCls: string;
    overviewDose: ResearchTrainingDose;
  }
> = {
  L1: {
    id: 'L1',
    label: 'L1 – Normal',
    shortLabel: 'Normal',
    zRangeLabel: 'Z ≥ -1.0 (BHI ≥ 85.0)',
    headerCls: 'bg-emerald-700/80 text-white border-emerald-500/40',
    badgeCls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15',
    overviewDose: {
      intensity: '75–85% 1RM (High Osteogenic Strain)',
      rpe: 'RPE 7–8 / 10',
      setsReps: '3–5 sets × 5–8 reps',
      restSeconds: '120–150 s between sets',
      frequencyPerWeek: '2–3 non-consecutive days / week',
      tempo: '1–2 s concentric · 2 s controlled eccentric',
      citation: 'LIFTMOR Trial (Watson et al., JBMR 2018) & NASA HRP ARED Protocol',
    },
  },
  L2: {
    id: 'L2',
    label: 'L2 – Mild',
    shortLabel: 'Mild',
    zRangeLabel: '-1.75 < Z < -1.0',
    headerCls: 'bg-amber-600/80 text-white border-amber-400/40',
    badgeCls: 'text-amber-300 border-amber-400/40 bg-amber-500/15',
    overviewDose: {
      intensity: '60–75% 1RM (Moderate Progressive Load)',
      rpe: 'RPE 5–6 / 10',
      setsReps: '2–3 sets × 8–12 reps',
      restSeconds: '90–120 s between sets',
      frequencyPerWeek: '2–3 days / week (≥ 48 h recovery)',
      tempo: '2 s concentric · 2 s eccentric (supported balance)',
      citation: 'Too Fit To Fracture Consensus (Giangregorio et al., Osteoporos Int 2015)',
    },
  },
  L3: {
    id: 'L3',
    label: 'L3 – Moderate',
    shortLabel: 'Moderate',
    zRangeLabel: '-2.5 < Z ≤ -1.75',
    headerCls: 'bg-orange-600/80 text-white border-orange-400/40',
    badgeCls: 'text-orange-300 border-orange-400/40 bg-orange-500/15',
    overviewDose: {
      intensity: '45–60% 1RM (Low-Impact Supported Load)',
      rpe: 'RPE 4–5 / 10',
      setsReps: '2–3 sets × 10–12 reps',
      restSeconds: '90 s between sets',
      frequencyPerWeek: '2–3 supervised days / week',
      tempo: '2–1-2 s slow controlled pace (no ballistic impact)',
      citation: 'Osteoporosis Canada & ACSM Bone Health Guidelines (2022)',
    },
  },
  L4: {
    id: 'L4',
    label: 'L4 – Severe',
    shortLabel: 'Severe',
    zRangeLabel: 'Z ≤ -2.5 (BHI ≤ 62.5)',
    headerCls: 'bg-red-700/85 text-white border-red-500/40',
    badgeCls: 'text-red-300 border-red-500/40 bg-red-500/15',
    overviewDose: {
      intensity: '30–45% 1RM / Assisted Mobility Only',
      rpe: 'RPE 2–4 / 10 (Sub-pain threshold)',
      setsReps: '1–2 sets × 10–15 reps',
      restSeconds: '90–120 s recovery',
      frequencyPerWeek: '2 supervised clinical sessions / week',
      tempo: '3 s slow controlled ROM · neutral spine protected',
      citation: 'Royal Osteoporosis Society Strong, Steady & Straight Consensus (2022)',
    },
  },
};

export const BONE_DENSITY_EXERCISE_MATRIX: ExerciseMatrixRow[] = [
  {
    id: 'pelvis',
    region: 'Pelvis',
    category: 'axial_compound',
    skeletonBoneIds: ['pelvis'],
    L1: 'Bodyweight squats',
    L2: 'Supported squats',
    L3: 'Supported sit-to-stand',
    L4: 'Supervised seated movement',
  },
  {
    id: 'ilium',
    region: 'Ilium',
    category: 'axial_compound',
    skeletonBoneIds: ['pelvis'],
    L1: 'Walking + squats',
    L2: 'Supported step-ups',
    L3: 'Supported weight shifts',
    L4: 'Seated hip activation',
  },
  {
    id: 'ischium',
    region: 'Ischium',
    category: 'hip_stability',
    skeletonBoneIds: ['pelvis'],
    L1: 'Hip bridges',
    L2: 'Supported hip extension',
    L3: 'Gentle supported hip extension',
    L4: 'Supervised low-load activation',
  },
  {
    id: 'femur',
    region: 'Femur',
    category: 'axial_compound',
    skeletonBoneIds: ['femur-right', 'femur-left'],
    L1: 'Squats + lunges',
    L2: 'Controlled sit-to-stand',
    L3: 'Supported sit-to-stand',
    L4: 'Supervised seated leg movement',
  },
  {
    id: 'femoral-neck',
    region: 'Femoral neck',
    category: 'axial_compound',
    skeletonBoneIds: ['femur-right', 'femur-left'],
    L1: 'Squats + resistance training',
    L2: 'Supported squats',
    L3: 'Low-load supported hip exercises',
    L4: 'Clinician-selected protected movement',
  },
  {
    id: 'greater-trochanter',
    region: 'Greater trochanter',
    category: 'hip_stability',
    skeletonBoneIds: ['femur-right', 'femur-left'],
    L1: 'Hip abduction',
    L2: 'Standing band abduction',
    L3: 'Supported hip abduction',
    L4: 'Seated hip abduction',
  },
  {
    id: 'lesser-trochanter',
    region: 'Lesser trochanter',
    category: 'hip_stability',
    skeletonBoneIds: ['femur-right', 'femur-left'],
    L1: 'Hip flexion resistance',
    L2: 'Light seated hip flexion',
    L3: 'Gentle seated hip flexion',
    L4: 'Supervised hip activation',
  },
  {
    id: 'patella',
    region: 'Patella',
    category: 'axial_compound',
    skeletonBoneIds: ['patella-right', 'patella-left'],
    L1: 'Squats + step-ups',
    L2: 'Supported shallow squats',
    L3: 'Controlled seated knee extension',
    L4: 'Gentle supervised knee movement',
  },
  {
    id: 'tibia',
    region: 'Tibia',
    category: 'foot_ankle',
    skeletonBoneIds: ['tibia-right', 'tibia-left'],
    L1: 'Walking + resistance training',
    L2: 'Low-impact walking',
    L3: 'Supported weight-bearing if approved',
    L4: 'Clinician-selected protected movement',
  },
  {
    id: 'fibula',
    region: 'Fibula',
    category: 'foot_ankle',
    skeletonBoneIds: ['tibia-right', 'tibia-left'],
    L1: 'Walking + calf raises',
    L2: 'Supported calf raises',
    L3: 'Gentle ankle resistance',
    L4: 'Seated ankle mobility',
  },
  {
    id: 'calcaneus',
    region: 'Calcaneus',
    category: 'foot_ankle',
    skeletonBoneIds: ['calcaneus-right', 'calcaneus-left'],
    L1: 'Walking + heel raises',
    L2: 'Supported heel raises',
    L3: 'Gentle supported weight-bearing',
    L4: 'Supervised ankle mobility',
  },
  {
    id: 'talus',
    region: 'Talus',
    category: 'foot_ankle',
    skeletonBoneIds: ['calcaneus-right', 'calcaneus-left'],
    L1: 'Walking + balance training',
    L2: 'Supported balance',
    L3: 'Seated ankle mobility',
    L4: 'Supervised protected ankle movement',
  },
  {
    id: 'navicular',
    region: 'Navicular',
    category: 'foot_ankle',
    skeletonBoneIds: ['calcaneus-right', 'calcaneus-left'],
    L1: 'Walking + foot strengthening',
    L2: 'Gentle foot strengthening',
    L3: 'Seated foot exercises',
    L4: 'Supervised foot movement',
  },
  {
    id: 'metatarsals',
    region: 'Metatarsals',
    category: 'foot_ankle',
    skeletonBoneIds: ['calcaneus-right', 'calcaneus-left'],
    L1: 'Walking + toe raises',
    L2: 'Supported toe raises',
    L3: 'Gentle seated toe movement',
    L4: 'Clinician-selected protected movement',
  },
  {
    id: 'lumbar-spine',
    region: 'Lumbar spine',
    category: 'lumbar_core',
    skeletonBoneIds: ['lumbar-spine'],
    L1: 'Resistance training',
    L2: 'Controlled resistance',
    L3: 'Supervised spinal stabilization',
    L4: 'Specialist-directed stabilization',
  },
];

const CATEGORY_DOSING: Record<BoneExerciseCategory, Record<SeverityLevelId, ResearchTrainingDose>> = {
  axial_compound: {
    L1: {
      intensity: '80–85% 1RM',
      rpe: 'RPE 7–8',
      setsReps: '4–5 sets × 5–8 reps',
      restSeconds: '120–150 s rest',
      frequencyPerWeek: '2–3× / week',
      tempo: 'Dynamic concentric · 2 s eccentric',
      citation: 'LIFTMOR RCT (Watson et al., JBMR 2018)',
    },
    L2: {
      intensity: '65–75% 1RM',
      rpe: 'RPE 5–6',
      setsReps: '3 sets × 8–10 reps',
      restSeconds: '90–120 s rest',
      frequencyPerWeek: '2–3× / week',
      tempo: 'Controlled 2-1-2 s',
      citation: 'Too Fit To Fracture (Giangregorio et al., 2015)',
    },
    L3: {
      intensity: '50–60% 1RM',
      rpe: 'RPE 4–5',
      setsReps: '2–3 sets × 10–12 reps',
      restSeconds: '90 s rest',
      frequencyPerWeek: '2× / week (supervised)',
      tempo: 'Slow 2-1-2 s · rail support',
      citation: 'ACSM / Osteoporosis Canada Consensus (2022)',
    },
    L4: {
      intensity: '30–40% 1RM / Assisted',
      rpe: 'RPE 2–3',
      setsReps: '1–2 sets × 10–12 reps',
      restSeconds: '120 s rest',
      frequencyPerWeek: '2× / week (clinician-led)',
      tempo: 'Slow 3 s pain-free ROM',
      citation: 'ROS Strong, Steady & Straight Consensus (2022)',
    },
  },
  hip_stability: {
    L1: {
      intensity: '70–80% 1RM',
      rpe: 'RPE 7',
      setsReps: '3 sets × 8–10 reps / side',
      restSeconds: '90 s rest',
      frequencyPerWeek: '2–3× / week',
      tempo: '1 s drive · 2 s lower',
      citation: 'MEDEX-OP Trial (Kistler-Fischbacher et al., 2021)',
    },
    L2: {
      intensity: '60–70% 1RM / Heavy Band',
      rpe: 'RPE 5–6',
      setsReps: '3 sets × 10–12 reps',
      restSeconds: '60–90 s rest',
      frequencyPerWeek: '2–3× / week',
      tempo: '2 s pause at peak abduction',
      citation: 'Giangregorio et al., Osteoporos Int (2015)',
    },
    L3: {
      intensity: '45–55% 1RM / Light Band',
      rpe: 'RPE 4',
      setsReps: '2 sets × 10–12 reps',
      restSeconds: '60–90 s rest',
      frequencyPerWeek: '2–3× / week',
      tempo: '2-1-2 s controlled',
      citation: 'ACSM Femoral Neck Protection Guidelines',
    },
    L4: {
      intensity: '30% 1RM / Unloaded',
      rpe: 'RPE 2–3',
      setsReps: '2 sets × 8–10 reps',
      restSeconds: '90 s rest',
      frequencyPerWeek: '2× / week (seated)',
      tempo: 'Gentle 3 s seated arc',
      citation: 'ROS Clinical Fracture-Safe Mobility',
    },
  },
  foot_ankle: {
    L1: {
      intensity: '75–80% 1RM + Body Impact',
      rpe: 'RPE 7',
      setsReps: '3–4 sets × 10–15 reps',
      restSeconds: '60–90 s rest',
      frequencyPerWeek: '3–4× / week',
      tempo: 'Crisp heel raise · 2 s descent',
      citation: 'NASA Calcaneal Impact & BONE-D Trial (2019)',
    },
    L2: {
      intensity: '60–70% BW Supported',
      rpe: 'RPE 5–6',
      setsReps: '3 sets × 12–15 reps',
      restSeconds: '60 s rest',
      frequencyPerWeek: '3× / week',
      tempo: '2 s raise · 2 s lower',
      citation: 'Calcaneal QUS Remodeling Protocol (Sibonga et al.)',
    },
    L3: {
      intensity: '45–55% 1RM / Seated Band',
      rpe: 'RPE 4',
      setsReps: '2 sets × 12–15 reps',
      restSeconds: '60 s rest',
      frequencyPerWeek: '3× / week',
      tempo: 'Smooth controlled dorsiflexion/plantarflexion',
      citation: 'Too Fit To Fracture Balance & Foot Protocol',
    },
    L4: {
      intensity: '25–35% / Active ROM Only',
      rpe: 'RPE 2–3',
      setsReps: '1–2 sets × 10–12 reps',
      restSeconds: '60–90 s rest',
      frequencyPerWeek: '2–3× / week (seated)',
      tempo: 'Gentle 3 s ankle & toe circles',
      citation: 'ROS Low-Impact Mobility Safeguard (2022)',
    },
  },
  lumbar_core: {
    L1: {
      intensity: '75–85% 1RM (Neutral Spine)',
      rpe: 'RPE 7–8',
      setsReps: '4 sets × 5–8 reps',
      restSeconds: '120 s rest',
      frequencyPerWeek: '2× / week',
      tempo: 'Braced neutral spine · 2-1-2 s',
      citation: 'LIFTMOR Spinal Extension/Deadlift Study (2018)',
    },
    L2: {
      intensity: '60–70% 1RM (Isometric + Hinge)',
      rpe: 'RPE 5–6',
      setsReps: '2–3 sets × 8–10 reps (or 20 s holds)',
      restSeconds: '90 s rest',
      frequencyPerWeek: '2–3× / week',
      tempo: 'Neutral spine · avoid loaded flexion',
      citation: 'Sinaki Back Extensor Strengthening RCT (Mayo Clinic)',
    },
    L3: {
      intensity: '45–55% / Isometric Brace',
      rpe: 'RPE 4',
      setsReps: '2 sets × 8–10 reps (10 s holds)',
      restSeconds: '90 s rest',
      frequencyPerWeek: '2–3× / week (supervised)',
      tempo: 'Anti-flexion / anti-rotation only',
      citation: 'Osteoporosis Canada Spine-Sparing Protocol',
    },
    L4: {
      intensity: '25–35% / Isometric Breathwork',
      rpe: 'RPE 2–3',
      setsReps: '1–2 sets × 6–8 gentle holds (5–8 s)',
      restSeconds: '90 s rest',
      frequencyPerWeek: '2× / week (specialist)',
      tempo: 'Zero spinal flexion/twisting',
      citation: 'ROS Vertebral Fracture Precautions Consensus (2022)',
    },
  },
};

export function getResearchDoseForBone(
  category: BoneExerciseCategory,
  level: SeverityLevelId,
): ResearchTrainingDose {
  return CATEGORY_DOSING[category][level];
}

export function severityLevelFromZMaster(zMaster: number): SeverityLevelId {
  if (zMaster >= -1.0) return 'L1';
  if (zMaster > -1.75) return 'L2';
  if (zMaster > -2.5) return 'L3';
  return 'L4';
}
