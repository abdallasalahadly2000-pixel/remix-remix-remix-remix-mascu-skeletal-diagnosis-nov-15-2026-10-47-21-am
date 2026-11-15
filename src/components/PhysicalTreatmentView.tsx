import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Dumbbell,
  Layers,
  Lock,
  RefreshCw,
  Sliders,
  Table2,
} from 'lucide-react';
import {
  BONE_DENSITY_EXERCISE_MATRIX,
  getResearchDoseForBone,
  SEVERITY_LEVEL_META,
  severityLevelFromZMaster,
} from '../domain/boneExerciseMatrix';
import {
  applyDatasetToBones,
  BoneDatasetEntry,
  DEFAULT_STATUS_COLORS,
  resolveBoneColorHex,
  StatusColorPalette,
} from '../domain/osteosense';
import {
  computeFullQusAnalysis,
  MeasurementMode,
  QUS_BENCHMARK_PRESETS,
  QusClinicalInputs,
} from '../domain/qusClinicalEngine';
import { RouteId, TreatmentResult, UserProfile, formatUserTitle } from '../types/app';
import { AstronautPhysicalTreatmentView } from './AstronautPhysicalTreatmentView';
import { ExercisePage } from './ExercisePage';

interface PhysicalTreatmentViewProps {
  sessionUser: UserProfile | null;
  datasetEntries?: BoneDatasetEntry[];
  statusColors?: StatusColorPalette;
  focusedBoneId?: string;
  onSelectFocusedBoneId?: (boneId: string) => void;
  treatmentResult: TreatmentResult | null;
  treatmentHistory: TreatmentResult[];
  onRecordAssessment: (result: TreatmentResult) => void;
  onNavigate: (route: RouteId) => void;
}

type ResultsTab = 'exercises' | 'plan' | 'telemetry' | 'matrix';

const DEFAULT_TARGET_BONES = ['femoral-neck', 'calcaneus', 'lumbar-spine'];

export const PhysicalTreatmentView: React.FC<PhysicalTreatmentViewProps> = (props) => {
  if (props.sessionUser?.role !== 'doctor') {
    return (
      <AstronautPhysicalTreatmentView
        sessionUser={props.sessionUser}
        datasetEntries={props.datasetEntries}
        statusColors={props.statusColors}
        focusedBoneId={props.focusedBoneId}
        onSelectFocusedBoneId={props.onSelectFocusedBoneId}
        treatmentResult={props.treatmentResult}
        onRecordAssessment={props.onRecordAssessment}
        onNavigate={props.onNavigate}
      />
    );
  }
  return <DoctorPhysicalTreatmentView {...props} />;
};

const DoctorPhysicalTreatmentView: React.FC<PhysicalTreatmentViewProps> = ({
  sessionUser,
  datasetEntries = [],
  statusColors = DEFAULT_STATUS_COLORS,
  focusedBoneId: controlledFocusedBoneId,
  onSelectFocusedBoneId,
  treatmentResult,
  treatmentHistory,
  onRecordAssessment,
  onNavigate,
}) => {
  const bones = useMemo(() => applyDatasetToBones(datasetEntries), [datasetEntries]);

  const damagedBones = useMemo(
    () =>
      bones
        .filter((b) => b.status === 'critical' || b.status === 'moderate')
        .sort((a, b) => (b.weaknessPercent ?? 0) - (a.weaknessPercent ?? 0)),
    [bones],
  );

  const assessedBones = useMemo(
    () => bones.filter((b) => b.weaknessPercent !== null),
    [bones],
  );

  const flaggedFromSkeleton = useMemo(() => {
    const weakIds = new Set(damagedBones.map((b) => b.id));
    return BONE_DENSITY_EXERCISE_MATRIX.filter((row) =>
      row.skeletonBoneIds.some((bid) => weakIds.has(bid)),
    ).map((r) => r.id);
  }, [damagedBones]);

  const [localFocusedBoneId, setLocalFocusedBoneId] = useState<string>('femur-right');
  const activeFocusedBoneId = controlledFocusedBoneId ?? localFocusedBoneId;
  const handleSelectBone = useCallback(
    (boneId: string) => {
      setLocalFocusedBoneId(boneId);
      onSelectFocusedBoneId?.(boneId);
    },
    [onSelectFocusedBoneId],
  );

  const selectedBone = useMemo(
    () => bones.find((b) => b.id === activeFocusedBoneId) || damagedBones[0] || bones[0],
    [bones, activeFocusedBoneId, damagedBones],
  );

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [selectedBoneIds, setSelectedBoneIds] = useState<string[]>(() =>
    flaggedFromSkeleton.length > 0 ? flaggedFromSkeleton : DEFAULT_TARGET_BONES,
  );

  const [mode, setMode] = useState<MeasurementMode>('dual');
  const [sosInput, setSosInput] = useState('1505.0');
  const [buaInput, setBuaInput] = useState('74.0');
  const [unloadingMonthsInput, setUnloadingMonthsInput] = useState('6');
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);

  const [useSoftTissue, setUseSoftTissue] = useState(false);
  const [dTotalInput, setDTotalInput] = useState('42.0');
  const [dSoftInput, setDSoftInput] = useState('8.0');
  const [tTotalInput, setTTotalInput] = useState('27.78');

  const [trabSosInput, setTrabSosInput] = useState('1772.0');
  const [radialSosInput, setRadialSosInput] = useState('3954.0');
  const [bttInput, setBttInput] = useState('1.30');
  const [fwaInput, setFwaInput] = useState('42.0');
  const [sdyInput, setSdyInput] = useState('720.0');
  const [echoDelayInput, setEchoDelayInput] = useState('1.50');

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [resultsTab, setResultsTab] = useState<ResultsTab>('exercises');
  const [formError, setFormError] = useState<string | null>(null);
  const [dispatchedSignature, setDispatchedSignature] = useState<string | null>(null);

  const datasetSignature = useMemo(() => JSON.stringify(datasetEntries), [datasetEntries]);

  const applySkeletonSync = useCallback(
    (forceFocusDamaged = false) => {
      if (flaggedFromSkeleton.length > 0) {
        setSelectedBoneIds(flaggedFromSkeleton);
      } else {
        setSelectedBoneIds(DEFAULT_TARGET_BONES);
      }

      const sourceBones = damagedBones.length > 0 ? damagedBones : assessedBones;
      if (sourceBones.length > 0) {
        const sosVals = sourceBones
          .map((b) => b.sosMs)
          .filter((v): v is number => v !== null && !Number.isNaN(v));
        const buaVals = sourceBones
          .map((b) => b.buaDbMhz)
          .filter((v): v is number => v !== null && !Number.isNaN(v));
        const maxWeakness = Math.max(...sourceBones.map((b) => b.weaknessPercent ?? 0));

        if (sosVals.length > 0) {
          const avgSos = sosVals.reduce((acc, v) => acc + v, 0) / sosVals.length;
          setSosInput(avgSos.toFixed(1));
        }
        if (buaVals.length > 0) {
          const avgBua = buaVals.reduce((acc, v) => acc + v, 0) / buaVals.length;
          setBuaInput(avgBua.toFixed(1));
        }
        setUnloadingMonthsInput(String(Math.max(1, Math.min(24, Math.round(maxWeakness / 6)))));
        setActivePresetId(null);
      }

      if (damagedBones.length > 0) {
        const currentIsDamaged = damagedBones.some((b) => b.id === activeFocusedBoneId);
        if (forceFocusDamaged || !currentIsDamaged) {
          handleSelectBone(damagedBones[0].id);
        }
      }
    },
    [
      activeFocusedBoneId,
      assessedBones,
      damagedBones,
      flaggedFromSkeleton,
      handleSelectBone,
    ],
  );

  const isInitialMountRef = useRef(true);
  const lastSyncedSigRef = useRef<string | null>(null);
  useEffect(() => {
    const isInitial = isInitialMountRef.current;
    isInitialMountRef.current = false;
    if (!autoSyncEnabled) return;
    if (lastSyncedSigRef.current === datasetSignature) return;
    lastSyncedSigRef.current = datasetSignature;
    if (datasetEntries.length > 0 || flaggedFromSkeleton.length > 0) {
      if (isInitial && controlledFocusedBoneId) {
        if (flaggedFromSkeleton.length > 0) setSelectedBoneIds(flaggedFromSkeleton);
        const sourceBones = damagedBones.length > 0 ? damagedBones : assessedBones;
        if (sourceBones.length > 0) {
          const sosVals = sourceBones
            .map((b) => b.sosMs)
            .filter((v): v is number => v !== null && !Number.isNaN(v));
          const buaVals = sourceBones
            .map((b) => b.buaDbMhz)
            .filter((v): v is number => v !== null && !Number.isNaN(v));
          const maxWeakness = Math.max(...sourceBones.map((b) => b.weaknessPercent ?? 0));
          if (sosVals.length > 0) {
            setSosInput((sosVals.reduce((a, v) => a + v, 0) / sosVals.length).toFixed(1));
          }
          if (buaVals.length > 0) {
            setBuaInput((buaVals.reduce((a, v) => a + v, 0) / buaVals.length).toFixed(1));
          }
          setUnloadingMonthsInput(String(Math.max(1, Math.min(24, Math.round(maxWeakness / 6)))));
          setActivePresetId(null);
        }
      } else {
        applySkeletonSync(false);
      }
    } else {
      setSelectedBoneIds(DEFAULT_TARGET_BONES);
    }
  }, [
    applySkeletonSync,
    assessedBones,
    autoSyncEnabled,
    controlledFocusedBoneId,
    damagedBones,
    datasetEntries.length,
    datasetSignature,
    flaggedFromSkeleton,
  ]);

  const toggleBoneSelection = (boneId: string) => {
    setSelectedBoneIds((prev) =>
      prev.includes(boneId) ? prev.filter((id) => id !== boneId) : [...prev, boneId],
    );
  };

  const handleSelectBenchmarkPreset = (presetId: string) => {
    const preset = QUS_BENCHMARK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const p = preset.inputs;
    setMode('full');
    setActivePresetId(preset.id);
    setSosInput(String(p.sos));
    setBuaInput(String(p.bua));
    setUnloadingMonthsInput(String(p.unloadingMonths));
    if (p.trabecularSos !== undefined) setTrabSosInput(String(p.trabecularSos));
    if (p.radialSos !== undefined) setRadialSosInput(String(p.radialSos));
    if (p.bttUs !== undefined) setBttInput(String(p.bttUs));
    if (p.echoDelayUs !== undefined) setEchoDelayInput(p.echoDelayUs.toFixed(2));
    setUseSoftTissue(false);
    setFormError(null);
  };

  const buildCurrentInputs = useCallback((): QusClinicalInputs | null => {
    const sos = Number(sosInput);
    const bua = Number(buaInput);
    const unloadingMonths = Math.max(0, Number(unloadingMonthsInput) || 0);

    if (
      !Number.isFinite(sos) ||
      !Number.isFinite(bua) ||
      sos < 1200 ||
      sos > 2600 ||
      bua < 10 ||
      bua > 140
    ) {
      return null;
    }

    const matchedPreset = activePresetId
      ? QUS_BENCHMARK_PRESETS.find((p) => p.id === activePresetId)
      : undefined;

    if (
      matchedPreset &&
      mode === 'full' &&
      Number(sos) === matchedPreset.inputs.sos &&
      Number(bua) === matchedPreset.inputs.bua &&
      unloadingMonths === matchedPreset.inputs.unloadingMonths
    ) {
      return { ...matchedPreset.inputs, mode };
    }

    return {
      mode,
      sos,
      bua,
      unloadingMonths,
      useSoftTissueCorrection: useSoftTissue,
      dTotalMm: Number(dTotalInput) || undefined,
      dSoftMm: Number(dSoftInput) || undefined,
      tTotalUs: Number(tTotalInput) || undefined,
      trabecularSos: Number(trabSosInput) || 1950,
      radialSos: Number(radialSosInput) || 4150,
      bttUs: Number(bttInput) || 1.65,
      fwaMv: Number(fwaInput) || 52,
      sdyMvUs2: Number(sdyInput) || 1000,
      echoDelayUs: Number(echoDelayInput) || 1.882,
    };
  }, [
    activePresetId,
    bttInput,
    buaInput,
    dSoftInput,
    dTotalInput,
    echoDelayInput,
    fwaInput,
    mode,
    radialSosInput,
    sdyInput,
    sosInput,
    tTotalInput,
    trabSosInput,
    unloadingMonthsInput,
    useSoftTissue,
  ]);

  const liveAnalysis = useMemo(() => {
    const payload = buildCurrentInputs();
    if (!payload) return null;
    return computeFullQusAnalysis(payload);
  }, [buildCurrentInputs]);

  const executeAssessment = (payload: QusClinicalInputs) => {
    const analysis = computeFullQusAnalysis(payload);
    const severityLevel = severityLevelFromZMaster(analysis.zMaster);
    const effectiveBones =
      selectedBoneIds.length > 0 ? selectedBoneIds : DEFAULT_TARGET_BONES;

    const entry: TreatmentResult = {
      id: `QUS-${Math.floor(1000 + Math.random() * 8999)}`,
      sos: analysis.correctedSos,
      bua: analysis.bua,
      prediction: analysis.prediction,
      confidence: analysis.confidence,
      tScore: analysis.zMaster,
      recommendation: analysis.recommendedAction,
      createdAt: new Date().toISOString(),
      astronautName: sessionUser?.fullName || 'Elena Vance',
      astronautBadge: sessionUser?.badgeId || 'VANCE-01',
      analysis,
      selectedBoneIds: effectiveBones,
      severityLevel,
    };
    setDispatchedSignature(datasetSignature);
    onRecordAssessment(entry);
  };

  const handleRunAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildCurrentInputs();
    if (!payload) {
      setFormError('Enter realistic acoustic metrics (SOS: 1200–2600 m/s, BUA: 10–140 dB/MHz).');
      return;
    }
    setFormError(null);
    executeAssessment(payload);
  };

  const handleQuickSample = () => {
    const firstPreset = QUS_BENCHMARK_PRESETS[1] || QUS_BENCHMARK_PRESETS[0];
    if (!firstPreset) return;
    handleSelectBenchmarkPreset(firstPreset.id);
    executeAssessment({ ...firstPreset.inputs, mode: 'full' });
  };

  const getStatusPresentation = (prediction: TreatmentResult['prediction']) => {
    if (prediction === 'Normal')
      return { cls: 'text-emerald-400', glyph: '●', friendlyLabel: 'Healthy Bone Density' };
    if (prediction === 'Osteopenia')
      return { cls: 'text-amber-400', glyph: '▲', friendlyLabel: 'Moderate Bone Loss' };
    return { cls: 'text-red-400', glyph: '✖', friendlyLabel: 'High Fracture Risk' };
  };

  const skeletonChangedSinceDispatch = useMemo(() => {
    if (!treatmentResult) return false;
    if (dispatchedSignature !== null && dispatchedSignature !== datasetSignature) return true;
    if (flaggedFromSkeleton.length === 0) return false;
    const planBones = treatmentResult.selectedBoneIds || [];
    const bonesDiffer =
      flaggedFromSkeleton.some((id) => !planBones.includes(id)) ||
      planBones.some((id) => !flaggedFromSkeleton.includes(id));
    const sosNum = Number(sosInput);
    const sosDiffers = Number.isFinite(sosNum) && Math.abs(treatmentResult.sos - sosNum) > 12;
    return bonesDiffer || sosDiffers;
  }, [datasetSignature, dispatchedSignature, flaggedFromSkeleton, sosInput, treatmentResult]);

  // Prefer live synced analysis when skeleton inputs changed or no dispatched plan exists yet
  const activeAnalysis = skeletonChangedSinceDispatch
    ? liveAnalysis || treatmentResult?.analysis
    : treatmentResult?.analysis || liveAnalysis;

  const activeSeverityId = activeAnalysis
    ? !skeletonChangedSinceDispatch && treatmentResult?.severityLevel
      ? treatmentResult.severityLevel
      : severityLevelFromZMaster(activeAnalysis.zMaster)
    : 'L1';
  const activeSeverityMeta = SEVERITY_LEVEL_META[activeSeverityId];

  const activePrediction: TreatmentResult['prediction'] = activeAnalysis
    ? activeAnalysis.bhi >= 85
      ? 'Normal'
      : activeAnalysis.bhi > 62.5
        ? 'Osteopenia'
        : 'Osteoporosis'
    : 'Normal';

  const resultBoneIds =
    !skeletonChangedSinceDispatch && treatmentResult?.selectedBoneIds?.length
      ? treatmentResult.selectedBoneIds
      : selectedBoneIds;

  const prescribedBoneRows = BONE_DENSITY_EXERCISE_MATRIX.filter((r) =>
    resultBoneIds.includes(r.id),
  );
  const isDoctor = sessionUser?.role === 'doctor';

  return (
    <div className="w-full max-w-[1440px] mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 overflow-hidden">
      {/* Top Workbench Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">
            Physical Treatment
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            Exercises, treatment methods, timing, load amounts, and 3D simulator — synced live with My Skeleton damage inputs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigate('skeletons')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#080c15] hover:border-cyan-400/50 text-slate-200 font-medium cursor-pointer ui-transition whitespace-nowrap"
          >
            <span>My Skeleton ({damagedBones.length} damaged)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          {sessionUser && (
            <div className="font-mono-tech text-slate-400">
              <span className="text-slate-200 font-semibold">{formatUserTitle(sessionUser)}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>License {sessionUser.badgeId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Asymmetric Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* Left Control Column: Live Skeleton Sync + Scan Inputs + Dispatch */}
        <form onSubmit={handleRunAssessment} className="lg:col-span-4 p-5 md:p-6 space-y-5 bg-[#080c15]">
          {/* Synced Damaged Bones Status Card */}
          <section className="rounded-lg border border-cyan-500/30 bg-[#0b101b] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Synced from My Skeleton</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoSyncEnabled((v) => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-semibold border cursor-pointer ${
                    autoSyncEnabled
                      ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                >
                  {autoSyncEnabled ? 'Auto-Sync ON' : 'Auto-Sync OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => applySkeletonSync(true)}
                  className="text-[11px] font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                >
                  Re-Sync
                </button>
              </div>
            </div>

            {damagedBones.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-400">
                  {damagedBones.length} damaged bone{damagedBones.length > 1 ? 's' : ''} mapped to{' '}
                  {flaggedFromSkeleton.length} treatment region{flaggedFromSkeleton.length !== 1 ? 's' : ''}. Click a bone to load its 3D exercise:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {damagedBones.map((b) => {
                    const col = resolveBoneColorHex(b, statusColors);
                    const isFocused = selectedBone?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          handleSelectBone(b.id);
                          setResultsTab('exercises');
                        }}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer ui-transition ${
                          isFocused
                            ? 'border-cyan-400 bg-cyan-500/15 text-white font-semibold'
                            : 'border-slate-800 bg-[#080c15] text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: col }} />
                        <span>{b.nameEn}</span>
                        <span className="font-mono-tech text-[10px]" style={{ color: col }}>
                          {b.weaknessPercent}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>No bone weakness ≥ 18% entered yet in My Skeleton.</span>
                <button
                  type="button"
                  onClick={() => onNavigate('skeletons')}
                  className="text-cyan-300 hover:text-cyan-200 font-medium shrink-0 cursor-pointer"
                >
                  Set in My Skeleton →
                </button>
              </div>
            )}
          </section>

          {/* Step 1: Condition Presets */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-200">1. Quick Profile</h2>
              <span className="text-[11px] text-slate-500">Optional</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {QUS_BENCHMARK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectBenchmarkPreset(p.id)}
                  className={`px-3 py-2 rounded-lg border text-left cursor-pointer ui-transition flex items-center justify-between gap-2 ${
                    activePresetId === p.id
                      ? 'border-cyan-400/70 bg-cyan-500/12 text-white'
                      : 'border-slate-800 bg-[#0b101b] hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <span className="text-xs font-semibold truncate">{p.label}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{p.subtitle}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Core Inputs + Collapsible Advanced Lab Inputs */}
          <section className="pt-5 border-t border-slate-800 space-y-3.5">
            <h2 className="text-xs font-semibold text-slate-200">2. Scan Measurements (Synced)</h2>

            <div className="grid grid-cols-3 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">SOS (m/s)</span>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={sosInput}
                  onChange={(e) => {
                    setSosInput(e.target.value);
                    setActivePresetId(null);
                  }}
                  className="h-9 px-2.5 rounded-lg border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">BUA (dB/MHz)</span>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={buaInput}
                  onChange={(e) => {
                    setBuaInput(e.target.value);
                    setActivePresetId(null);
                  }}
                  className="h-9 px-2.5 rounded-lg border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">Orbit Months</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="36"
                  value={unloadingMonthsInput}
                  onChange={(e) => {
                    setUnloadingMonthsInput(e.target.value);
                    setActivePresetId(null);
                  }}
                  className="h-9 px-2.5 rounded-lg border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
            </div>

            {/* Sectioned Off Advanced Acoustic & Lab Parameters */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedInputs((v) => !v)}
                className="w-full flex items-center justify-between gap-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Advanced Lab &amp; Multi-Site Parameters</span>
                </span>
                {showAdvancedInputs ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showAdvancedInputs && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                  <div className="inline-flex w-full rounded-lg border border-slate-800 bg-[#0b101b] p-0.5 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('dual');
                        setActivePresetId(null);
                      }}
                      className={`flex-1 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer ui-transition ${
                        mode === 'dual' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dual QUS
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('full')}
                      className={`flex-1 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer ui-transition ${
                        mode === 'full' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Full 13-Metric Suite
                    </button>
                  </div>

                  {mode === 'full' && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400">Trabecular SOS</span>
                          <input
                            type="number"
                            step="1"
                            value={trabSosInput}
                            onChange={(e) => {
                              setTrabSosInput(e.target.value);
                              setActivePresetId(null);
                            }}
                            className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400">Radial SOS</span>
                          <input
                            type="number"
                            step="1"
                            value={radialSosInput}
                            onChange={(e) => {
                              setRadialSosInput(e.target.value);
                              setActivePresetId(null);
                            }}
                            className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400">BTT (µs)</span>
                          <input
                            type="number"
                            step="0.01"
                            value={bttInput}
                            onChange={(e) => {
                              setBttInput(e.target.value);
                              setActivePresetId(null);
                            }}
                            className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400">FWA (mV)</span>
                          <input
                            type="number"
                            step="0.5"
                            value={fwaInput}
                            onChange={(e) => {
                              setFwaInput(e.target.value);
                              setActivePresetId(null);
                            }}
                            className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400">SD_y (mV/µs²)</span>
                          <input
                            type="number"
                            step="10"
                            value={sdyInput}
                            onChange={(e) => {
                              setSdyInput(e.target.value);
                              setActivePresetId(null);
                            }}
                            className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400">Echo Δt (µs)</span>
                          <input
                            type="number"
                            step="0.01"
                            value={echoDelayInput}
                            onChange={(e) => {
                              setEchoDelayInput(e.target.value);
                              setActivePresetId(null);
                            }}
                            className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                          />
                        </label>
                      </div>

                      <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSoftTissue}
                          onChange={(e) => {
                            setUseSoftTissue(e.target.checked);
                            setActivePresetId(null);
                          }}
                          className="accent-cyan-400"
                        />
                        <span>AIUM Soft-Tissue Calibration (1,540 m/s)</span>
                      </label>

                      {useSoftTissue && (
                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400">d_total (mm)</span>
                            <input
                              type="number"
                              step="0.1"
                              value={dTotalInput}
                              onChange={(e) => setDTotalInput(e.target.value)}
                              className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400">d_soft (mm)</span>
                            <input
                              type="number"
                              step="0.1"
                              value={dSoftInput}
                              onChange={(e) => setDSoftInput(e.target.value)}
                              className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400">t_total (µs)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={tTotalInput}
                              onChange={(e) => setTTotalInput(e.target.value)}
                              className="h-8 px-2 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-xs text-white"
                            />
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Step 3: Target Bone Regions */}
          <section className="pt-5 border-t border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-200">
                3. Target Regions ({selectedBoneIds.length}/15)
              </h2>
              <div className="flex items-center gap-2.5 text-[11px]">
                {flaggedFromSkeleton.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBoneIds(flaggedFromSkeleton)}
                    className="text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer"
                  >
                    Sync Flagged ({flaggedFromSkeleton.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedBoneIds(
                      selectedBoneIds.length === BONE_DENSITY_EXERCISE_MATRIX.length
                        ? []
                        : BONE_DENSITY_EXERCISE_MATRIX.map((r) => r.id),
                    )
                  }
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  {selectedBoneIds.length === BONE_DENSITY_EXERCISE_MATRIX.length
                    ? 'Clear'
                    : 'Select All'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BONE_DENSITY_EXERCISE_MATRIX.map((bone) => {
                const isSelected = selectedBoneIds.includes(bone.id);
                return (
                  <button
                    key={bone.id}
                    type="button"
                    onClick={() => toggleBoneSelection(bone.id)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-medium whitespace-nowrap cursor-pointer ui-transition ${
                      isSelected
                        ? 'border-cyan-400/70 bg-cyan-500/18 text-cyan-100'
                        : 'border-slate-800 bg-[#0b101b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {bone.region}
                  </button>
                );
              })}
            </div>
          </section>

          {formError && (
            <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/12 px-3 py-2 text-xs text-red-200">
              {formError}
            </div>
          )}

          <button
            type="submit"
            className="w-full h-11 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer ui-transition"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>
              {skeletonChangedSinceDispatch
                ? 'Sync & Dispatch Updated Treatment Plan'
                : 'Generate & Dispatch Treatment Plan'}
            </span>
          </button>
        </form>

        {/* Right Clinical & Exercise Stage */}
        <div className="lg:col-span-8 flex flex-col min-w-0">
          {/* Overview Banner (Always live from synced inputs or latest Firestore plan) */}
          {activeAnalysis && (
            <div className="p-6 border-b border-slate-800 space-y-4">
              {skeletonChangedSinceDispatch && (
                <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs text-cyan-200 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    My Skeleton damage inputs changed — exercises, timing, loads, and preview updated live. Click Dispatch to update Doctor Approval.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    {treatmentResult && !skeletonChangedSinceDispatch
                      ? 'Dispatched Treatment Plan Summary'
                      : 'Live Synced Treatment Summary'}
                  </p>
                  {(() => {
                    const st = getStatusPresentation(
                      !skeletonChangedSinceDispatch && treatmentResult
                        ? treatmentResult.prediction
                        : activePrediction,
                    );
                    return (
                      <p className={`font-display text-2xl font-bold mt-1 ${st.cls}`}>
                        <span aria-hidden="true">{st.glyph}</span> {st.friendlyLabel}
                      </p>
                    );
                  })()}
                  <p className="text-xs text-slate-400 mt-1">
                    {activeSeverityMeta.label} · {activeAnalysis.clinicalTier}
                  </p>
                </div>

                {/* Auto-Sent Status Confirmation */}
                <div className="flex flex-col items-end gap-1.5 text-right">
                  {treatmentResult && !skeletonChangedSinceDispatch ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {treatmentResult.approvalStatus === 'approved'
                          ? 'Approved by Doctor'
                          : treatmentResult.approvalStatus === 'not_approved'
                            ? 'Revision Requested by Doctor'
                            : 'Automatically Sent to Doctor Approval'}
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleQuickSample}
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                    >
                      Run Sample NASA Dispatch →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('approval')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    {!isDoctor && <Lock className="w-3 h-3" />}
                    <span>
                      {isDoctor ? 'Open in Doctor Approval →' : 'Doctor Approval (Doctor Sign-In Required)'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Overall Bone Health Score</span>
                    <span className="font-mono-tech font-bold text-cyan-300">
                      {activeAnalysis.bhi.toFixed(0)} / 100
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ui-transition ${
                        activeAnalysis.bhi >= 85
                          ? 'bg-emerald-400'
                          : activeAnalysis.bhi > 62.5
                            ? 'bg-amber-400'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, activeAnalysis.bhi))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Treatment Schedule &amp; Timing</span>
                    <span className="font-mono-tech font-semibold text-white">
                      {activeSeverityMeta.overviewDose.setsReps}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {activeSeverityMeta.overviewDose.frequencyPerWeek} · {activeSeverityMeta.overviewDose.restSeconds} · {activeSeverityMeta.overviewDose.rpe}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Separated Tabs: Exercises & 3D Diagram + Treatment Plan + Telemetry + Matrix */}
          <div className="px-6 border-b border-slate-800 bg-[#080c15] flex items-center gap-6 overflow-x-auto">
            <button
              type="button"
              onClick={() => setResultsTab('exercises')}
              className={`py-3 text-xs font-semibold border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ui-transition ${
                resultsTab === 'exercises'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Exercises, Timing &amp; 3D Diagram</span>
            </button>

            <button
              type="button"
              onClick={() => setResultsTab('plan')}
              className={`py-3 text-xs font-semibold border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ui-transition ${
                resultsTab === 'plan'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>Treatment Schedule ({prescribedBoneRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setResultsTab('telemetry')}
              className={`py-3 text-xs font-semibold border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ui-transition ${
                resultsTab === 'telemetry'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Clinical Telemetry &amp; Raw Data</span>
            </button>

            <button
              type="button"
              onClick={() => setResultsTab('matrix')}
              className={`py-3 text-xs font-semibold border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ui-transition ${
                resultsTab === 'matrix'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Full 15-Bone Matrix</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 md:p-6 flex-1 space-y-6">
            {resultsTab === 'exercises' && selectedBone && (
              <ExercisePage
                bones={bones}
                bone={selectedBone}
                onSelectBone={handleSelectBone}
                statusColors={statusColors}
                onEditInSkeleton={() => onNavigate('skeletons')}
              />
            )}

            {resultsTab === 'plan' && activeAnalysis && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">
                      Treatment Methods, Timing &amp; Amounts by Region
                    </h2>
                    <span className="text-xs text-slate-400">
                      {prescribedBoneRows.length} target regions ({activeSeverityId})
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-[#080c15]">
                    {prescribedBoneRows.map((row) => {
                      const dose = getResearchDoseForBone(row.category, activeSeverityId);
                      const matchedSkeletonBone = bones.find((b) =>
                        row.skeletonBoneIds.includes(b.id),
                      );
                      return (
                        <div
                          key={row.id}
                          className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{row.region}</span>
                              <span className="text-slate-600" aria-hidden="true">·</span>
                              <span className="text-cyan-300 font-medium">{row[activeSeverityId]}</span>
                              {matchedSkeletonBone && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectBone(matchedSkeletonBone.id);
                                    setResultsTab('exercises');
                                  }}
                                  className="text-[10px] font-mono-tech text-cyan-400 hover:underline cursor-pointer"
                                >
                                  Open 3D Simulator →
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {dose.frequencyPerWeek} · {dose.restSeconds} · Tempo: {dose.tempo}
                            </p>
                          </div>
                          <div className="font-mono-tech text-right shrink-0">
                            <div className="text-emerald-300 font-semibold">{dose.setsReps}</div>
                            <div className="text-[11px] text-slate-400">
                              {dose.intensity} · {dose.rpe}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <h3 className="text-xs font-medium text-slate-400">Clinical Guidance Summary</h3>
                  <p className="text-sm text-slate-100 leading-relaxed">
                    {(!skeletonChangedSinceDispatch && treatmentResult?.recommendation) ||
                      activeAnalysis.recommendedAction}
                  </p>
                  <p className="text-xs text-slate-400 pt-1">
                    Tempo: {activeSeverityMeta.overviewDose.tempo} · Source: {activeSeverityMeta.overviewDose.citation}
                  </p>
                </div>
              </>
            )}

            {resultsTab === 'telemetry' && activeAnalysis && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-800 font-mono-tech text-xs">
                  <div>
                    <p className="text-[11px] text-slate-400">Calcaneal SOS</p>
                    <p className="text-base font-bold text-cyan-300 mt-0.5">
                      {activeAnalysis.correctedSos.toFixed(1)} m/s
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">BUA</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      {activeAnalysis.bua.toFixed(1)} dB/MHz
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">10-Yr Fragility Risk</p>
                    <p className="text-base font-bold text-amber-300 mt-0.5">
                      {activeAnalysis.bdsPercent.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Composite Z_master</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      {activeAnalysis.zMaster > 0
                        ? `+${activeAnalysis.zMaster.toFixed(2)}`
                        : activeAnalysis.zMaster.toFixed(2)} SD
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Modular Domain Sub-Scores (Z-Scale)</span>
                    <span className="font-mono-tech text-slate-400">
                      Active δ = [{activeAnalysis.domains.activeMask.join(', ')}]
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-800 font-mono-tech text-xs">
                    <div>
                      <p className="text-[11px] text-slate-400">D_mass (35%)</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {activeAnalysis.domains.dMass.toFixed(2)} SD
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">D_micro (25%)</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {activeAnalysis.domains.dMicro !== null
                          ? `${activeAnalysis.domains.dMicro.toFixed(2)} SD`
                          : 'N/A (δ₂=0)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">D_cort (20%)</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {activeAnalysis.domains.dCort !== null
                          ? `${activeAnalysis.domains.dCort.toFixed(2)} SD`
                          : 'N/A (δ₃=0)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">D_mech (20%)</p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {activeAnalysis.domains.dMech.toFixed(2)} SD
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#080c15]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/70">
                        <th className="py-2.5 px-4 font-medium">Clinical / Structural Parameter</th>
                        <th className="py-2.5 px-4 font-medium">Computed Value</th>
                        <th className="py-2.5 px-4 font-medium">Normalized z_i</th>
                        <th className="py-2.5 px-4 font-medium">Normative Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-white">Calcaneal Speed of Sound (SOS)</td>
                        <td className="py-2.5 px-4 font-mono-tech text-cyan-300">{activeAnalysis.correctedSos.toFixed(1)} m/s</td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zSos.toFixed(2)} SD</td>
                        <td className="py-2.5 px-4 text-slate-400">AIUM / QUS Standard (1555 ± 35 m/s)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-white">Broadband Ultrasound Attenuation (BUA)</td>
                        <td className="py-2.5 px-4 font-mono-tech text-cyan-300">{activeAnalysis.bua.toFixed(1)} dB/MHz</td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zBua.toFixed(2)} SD</td>
                        <td className="py-2.5 px-4 text-slate-400">Langton QUS 0.2–0.6 MHz (92 ± 13)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-white">Stiffness Index (SI) &amp; T_SI</td>
                        <td className="py-2.5 px-4 font-mono-tech">
                          {activeAnalysis.si.toFixed(1)} <span className="text-slate-400">(T: {activeAnalysis.tSi.toFixed(2)})</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zSi.toFixed(2)} SD</td>
                        <td className="py-2.5 px-4 text-slate-400">GE Lunar Achilles PMA (100 ± 16)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-white">Quantitative Ultrasound Index (QUI)</td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.qui.toFixed(1)}</td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zQui.toFixed(2)} SD</td>
                        <td className="py-2.5 px-4 text-slate-400">Hologic Sahara FDA PMA (100 ± 16)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-white">Estimated Heel BMD (eBMD)</td>
                        <td className="py-2.5 px-4 font-mono-tech">
                          {activeAnalysis.ebmd.toFixed(3)} g/cm² <span className="text-slate-400">(T: {activeAnalysis.tEbmd.toFixed(2)})</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zEbmd.toFixed(2)} SD</td>
                        <td className="py-2.5 px-4 text-slate-400">Hologic Sahara PMA (0.580 ± 0.110)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-white">
                          Projected eBMD ({activeAnalysis.unloadingMonths} mo)
                        </td>
                        <td className="py-2.5 px-4 font-mono-tech text-amber-300">
                          {activeAnalysis.ebmdProjected.toFixed(3)} g/cm²
                        </td>
                        <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zEbmdProjected.toFixed(2)} SD</td>
                        <td className="py-2.5 px-4 text-slate-400">NASA HRP Disuse Model (1.8%/mo)</td>
                      </tr>
                      {activeAnalysis.bvTv !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Trabecular BV/TV</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.bvTv.toFixed(3)}</td>
                          <td className="py-2.5 px-4 font-mono-tech">
                            {activeAnalysis.subScores.zBvTv !== null ? `${activeAnalysis.subScores.zBvTv.toFixed(2)} SD` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">NASA / NSBRI SCAN Study (0.36 ± 0.10)</td>
                        </tr>
                      )}
                      {activeAnalysis.rhoApp !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Apparent Density (ρ_app)</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.rhoApp.toFixed(1)} kg/m³</td>
                          <td className="py-2.5 px-4 font-mono-tech">
                            {activeAnalysis.subScores.zRho !== null ? `${activeAnalysis.subScores.zRho.toFixed(2)} SD` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">Two-Phase Acoustic Mixture</td>
                        </tr>
                      )}
                      {activeAnalysis.elasticModulusGpa !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Bulk Elastic Modulus (E)</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.elasticModulusGpa.toFixed(2)} GPa</td>
                          <td className="py-2.5 px-4 font-mono-tech">
                            {activeAnalysis.subScores.zE !== null ? `${activeAnalysis.subScores.zE.toFixed(2)} SD` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">Isotropic Acoustic Elasticity</td>
                        </tr>
                      )}
                      {activeAnalysis.bttUs !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Bone Transmission Time (BTT)</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.bttUs.toFixed(2)} µs</td>
                          <td className="py-2.5 px-4 font-mono-tech">
                            {activeAnalysis.subScores.zBtt !== null ? `${activeAnalysis.subScores.zBtt.toFixed(2)} SD` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">IGEA DBM Sonic (1.65 ± 0.25 µs)</td>
                        </tr>
                      )}
                      {activeAnalysis.ubpi !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Ultrasound Bone Profile Index (UBPI)</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.ubpi.toFixed(2)}</td>
                          <td className="py-2.5 px-4 font-mono-tech">
                            {activeAnalysis.subScores.zUbpi !== null ? `${activeAnalysis.subScores.zUbpi.toFixed(2)} SD` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">IGEA Logistic Model</td>
                        </tr>
                      )}
                      {activeAnalysis.tRadius !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Distal Radius T_radius</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.tRadius.toFixed(2)} SD</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zRad?.toFixed(2)} SD</td>
                          <td className="py-2.5 px-4 text-slate-400">Sunlight Omnisense PMA</td>
                        </tr>
                      )}
                      {activeAnalysis.hCortMm !== null && (
                        <tr>
                          <td className="py-2.5 px-4 font-medium text-white">Cortical Thickness (h_cort)</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.hCortMm.toFixed(2)} mm</td>
                          <td className="py-2.5 px-4 font-mono-tech">{activeAnalysis.subScores.zHcort?.toFixed(2)} SD</td>
                          <td className="py-2.5 px-4 text-slate-400">Pulse-Echo Time-of-Flight</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {treatmentHistory.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-slate-300">Assessment History Log</h3>
                    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#080c15]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2 px-3.5 font-medium">Scan ID</th>
                            <th className="py-2 px-3.5 font-medium">SOS</th>
                            <th className="py-2 px-3.5 font-medium">BUA</th>
                            <th className="py-2 px-3.5 font-medium">Tier</th>
                            <th className="py-2 px-3.5 font-medium">BHI</th>
                            <th className="py-2 px-3.5 font-medium">BDS Risk</th>
                            <th className="py-2 px-3.5 font-medium">Z_master</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {treatmentHistory.map((item, idx) => {
                            const rowSt = getStatusPresentation(item.prediction);
                            return (
                              <tr key={`${item.id}-${idx}`} className="text-slate-200">
                                <td className="py-2 px-3.5 font-mono-tech">{item.planCode || item.id}</td>
                                <td className="py-2 px-3.5 font-mono-tech">{item.sos.toFixed(1)} m/s</td>
                                <td className="py-2 px-3.5 font-mono-tech">{item.bua.toFixed(1)} dB/MHz</td>
                                <td className={`py-2 px-3.5 font-semibold ${rowSt.cls}`}>
                                  {item.severityLevel ? SEVERITY_LEVEL_META[item.severityLevel].label : item.prediction}
                                </td>
                                <td className="py-2 px-3.5 font-mono-tech text-cyan-300">
                                  {item.analysis ? `${item.analysis.bhi.toFixed(1)}/100` : '—'}
                                </td>
                                <td className="py-2 px-3.5 font-mono-tech">
                                  {item.analysis ? `${item.analysis.bdsPercent.toFixed(1)}%` : '—'}
                                </td>
                                <td className="py-2 px-3.5 font-mono-tech">{item.tScore.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {resultsTab === 'matrix' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    Complete 15-Region Bone Exercise Matrix
                  </h2>
                  <span className="text-xs text-slate-400">
                    Active Tier: <strong className="text-white">{activeSeverityMeta.label}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#080c15]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="py-2.5 px-3.5 font-semibold text-white bg-slate-900">
                          Bone Region
                        </th>
                        {(['L1', 'L2', 'L3', 'L4'] as const).map((lvl) => {
                          const meta = SEVERITY_LEVEL_META[lvl];
                          const isActive = activeSeverityId === lvl;
                          return (
                            <th
                              key={lvl}
                              className={`py-2.5 px-3.5 font-semibold border-l border-slate-800 ${meta.headerCls} ${
                                isActive ? 'ring-2 ring-inset ring-white/80' : 'opacity-75'
                              }`}
                            >
                              <div>{meta.label}</div>
                              <div className="font-mono-tech text-[10px] font-normal opacity-90 mt-0.5">
                                {meta.overviewDose.intensity.split(' ')[0]} · {meta.overviewDose.setsReps}
                              </div>
                            </th>
                          );
                        })}
                        <th className="py-2.5 px-3.5 font-semibold text-cyan-200 bg-slate-900 border-l border-slate-800">
                          Active Dose ({activeSeverityId})
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {BONE_DENSITY_EXERCISE_MATRIX.map((row) => {
                        const isTarget = resultBoneIds.includes(row.id);
                        const rowDose = getResearchDoseForBone(row.category, activeSeverityId);
                        return (
                          <tr
                            key={row.id}
                            className={isTarget ? 'bg-cyan-500/8' : 'hover:bg-white/[0.02]'}
                          >
                            <td className="py-2.5 px-3.5 font-semibold text-white whitespace-nowrap">
                              {isTarget ? `● ${row.region}` : row.region}
                            </td>
                            {(['L1', 'L2', 'L3', 'L4'] as const).map((lvl) => {
                              const isActiveCell = activeSeverityId === lvl;
                              return (
                                <td
                                  key={lvl}
                                  className={`py-2.5 px-3.5 border-l border-slate-800/70 ${
                                    isActiveCell && isTarget
                                      ? 'text-white font-semibold bg-cyan-500/12'
                                      : isActiveCell
                                        ? 'text-slate-100 font-medium bg-white/[0.03]'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  {row[lvl]}
                                </td>
                              );
                            })}
                            <td className="py-2.5 px-3.5 border-l border-slate-800/70 font-mono-tech text-[11px] text-emerald-300 whitespace-nowrap">
                              {rowDose.intensity} · {rowDose.setsReps}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
