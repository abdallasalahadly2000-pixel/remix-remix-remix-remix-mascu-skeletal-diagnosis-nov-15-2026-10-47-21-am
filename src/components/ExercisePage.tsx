import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Globe,
  RotateCcw,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import {
  BoneSegment,
  DEFAULT_STATUS_COLORS,
  EXERCISE_PROTOCOLS,
  EmgEvaluationResult,
  FormQuality,
  StatusColorPalette,
  buildFallbackRecommendation,
  buildSimulatedEmgAttempt,
  evaluateEmgSession,
  resolveBoneColorHex,
} from '../domain/osteosense';
import {
  BONE_DENSITY_EXERCISE_MATRIX,
  SEVERITY_LEVEL_META,
  SeverityLevelId,
} from '../domain/boneExerciseMatrix';
import {
  deriveSeverityFromBone,
  getExerciseBiomechanics,
  getNasaBoneProfile,
} from '../domain/nasaBoneDatabase';
import { Locale, UI_COPY } from '../i18n/translations';
import { ExerciseSimulator3D } from './ExerciseSimulator3D';
import { SensorHardwareIcon } from './SensorHardwareIcon';

interface ExercisePageProps {
  bones: BoneSegment[];
  bone: BoneSegment;
  onSelectBone: (boneId: string) => void;
  statusColors?: StatusColorPalette;
  onEditInSkeleton?: () => void;
  locale?: Locale;
  onToggleLocale?: () => void;
}

const SEVERITY_IDS: SeverityLevelId[] = ['L1', 'L2', 'L3', 'L4'];

export const ExercisePage: React.FC<ExercisePageProps> = ({
  bones,
  bone,
  onSelectBone,
  statusColors = DEFAULT_STATUS_COLORS,
  onEditInSkeleton,
  locale: controlledLocale,
  onToggleLocale,
}) => {
  const [localLocale, setLocalLocale] = useState<Locale>('en');
  const locale = controlledLocale ?? localLocale;
  const handleToggleLocale = () => {
    if (onToggleLocale) onToggleLocale();
    else setLocalLocale((l) => (l === 'en' ? 'ar' : 'en'));
  };

  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';

  const recommendation = useMemo(() => buildFallbackRecommendation(bone, 74), [bone]);
  const protocol = EXERCISE_PROTOCOLS[recommendation.exerciseId] || EXERCISE_PROTOCOLS['ared-squat'];
  const boneColor = resolveBoneColorHex(bone, statusColors);

  const nasaProfile = useMemo(() => getNasaBoneProfile(bone.id), [bone.id]);
  const biomechSpec = useMemo(() => getExerciseBiomechanics(protocol.id), [protocol.id]);
  const autoSeverity = useMemo(() => deriveSeverityFromBone(bone), [bone]);

  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevelId>(autoSeverity);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [formQuality, setFormQuality] = useState<FormQuality>('optimal');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(0);
  const [evaluation, setEvaluation] = useState<EmgEvaluationResult | null>(null);
  const [showBoneTelemetry, setShowBoneTelemetry] = useState(false);
  const [showEmgChannels, setShowEmgChannels] = useState(false);
  const [restRemainingSec, setRestRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSeverity(autoSeverity);
    setRestRemainingSec(null);
    setEvaluation(null);
  }, [bone.id, autoSeverity, bone.weaknessPercent]);

  useEffect(() => {
    if (restRemainingSec === null || restRemainingSec <= 0) return;
    const id = window.setInterval(() => {
      setRestRemainingSec((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRemainingSec]);

  const handleRunEmgInspection = () => {
    setIsEvaluating(true);
    setEvalProgress(0);
    setEvaluation(null);

    const start = performance.now();
    const duration = 1350;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / duration) * 100);
      setEvalProgress(pct);
      if (pct < 100) {
        window.requestAnimationFrame(tick);
      } else {
        const readings = buildSimulatedEmgAttempt(bone, protocol.id, formQuality);
        const result = evaluateEmgSession(readings);
        setEvaluation(result);
        setIsEvaluating(false);
      }
    };
    window.requestAnimationFrame(tick);
  };

  const damagedBones = useMemo(
    () =>
      bones
        .filter((b) => b.status === 'critical' || b.status === 'moderate')
        .sort((a, b) => (b.weaknessPercent ?? 0) - (a.weaknessPercent ?? 0)),
    [bones],
  );

  const dosing = biomechSpec.severityDosing[selectedSeverity];
  const severityMeta = SEVERITY_LEVEL_META[selectedSeverity];
  const scaledLoadKg = Math.max(8, Math.round(protocol.defaultLoadKg * dosing.loadFactor));
  const scaledLoadLb = Math.round(scaledLoadKg * 2.20462);
  const peakForceBw = biomechSpec.peakForceBwByLevel[selectedSeverity];

  const matchingMatrixRows = useMemo(
    () => BONE_DENSITY_EXERCISE_MATRIX.filter((r) => nasaProfile.matrixRowIds.includes(r.id)),
    [nasaProfile.matrixRowIds],
  );

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-5 text-slate-100">
      {/* Synced Damaged Bone Switcher Bar */}
      <div className="rounded-lg border border-slate-800 bg-[#080c15] p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <span>
              {isAr
                ? 'العظام المتضررة المتزامنة من صفحة الهيكل العظمي'
                : 'Damaged & Target Bones Synced from My Skeleton'}
            </span>
            {damagedBones.length > 0 && (
              <span className="font-mono-tech text-[11px] text-cyan-300">
                ({damagedBones.length} {isAr ? 'متضررة' : 'flagged'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label={isAr ? 'اختر أي عظمة' : 'Select any bone'}
              value={bone.id}
              onChange={(e) => onSelectBone(e.target.value)}
              className="h-7 px-2 rounded border border-slate-700 bg-[#0b101b] text-[11px] text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {bones.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                  {b.weaknessPercent !== null ? ` (${b.weaknessPercent}%)` : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleToggleLocale}
              className="inline-flex items-center gap-1 h-7 px-2 rounded border border-slate-700 bg-[#0b101b] hover:border-slate-500 text-[11px] text-slate-300 cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>{locale === 'en' ? 'العربية' : 'EN'}</span>
            </button>

            {onEditInSkeleton && (
              <button
                type="button"
                onClick={onEditInSkeleton}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-[11px] font-medium text-cyan-200 cursor-pointer whitespace-nowrap"
              >
                <span>{copy.backToSkeleton}</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {damagedBones.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {damagedBones.map((db) => {
              const active = db.id === bone.id;
              const col = resolveBoneColorHex(db, statusColors);
              return (
                <button
                  key={db.id}
                  type="button"
                  onClick={() => onSelectBone(db.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium cursor-pointer ui-transition ${
                    active
                      ? 'border-cyan-400/75 bg-cyan-500/15 text-white'
                      : 'border-slate-800 bg-[#0b101b] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: col }} />
                  <span>{isAr ? db.nameAr : db.nameEn}</span>
                  <span className="font-mono-tech text-[10px]" style={{ color: col }}>
                    {db.weaknessPercent}%
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">
            {isAr
              ? 'لم يتم تحديد عظام متضررة في الهيكل العظمي بعد — يتم عرض البروتوكول الوقائي للعظمة المختارة.'
              : 'No damaged bones flagged in My Skeleton yet — showing maintenance protocol for the selected bone. Adjust weakness % in My Skeleton to auto-sync.'}
          </p>
        )}
      </div>

      {/* Main Split: Treatment Method, Timing & Amounts (Left) + 3D Graphical Simulator & EMG (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Treatment Method, Timing, Amount, & Safety Limits */}
        <section className="xl:col-span-5 rounded-lg border border-slate-800 bg-[#080c15] p-5 divide-y divide-slate-800 space-y-4">
          {/* Selected Bone & NASA Profile */}
          <div className="space-y-3 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-400">
                  {isAr ? bone.regionAr : bone.regionEn} ·{' '}
                  <span>{isAr ? bone.boneCountLabelAr : bone.boneCountLabelEn}</span>
                </div>
                <h2 className="font-display text-lg font-bold text-white mt-0.5">
                  {isAr ? bone.nameAr : bone.nameEn}
                </h2>
                <div className="text-[11px] text-cyan-300/90 mt-0.5">
                  {isAr ? nasaProfile.nasaSiteNameAr : nasaProfile.nasaSiteNameEn}
                </div>
              </div>
              <div
                className="px-2.5 py-1 rounded border font-mono-tech text-xs font-bold shrink-0 tabular-nums"
                style={{
                  borderColor: `${boneColor}66`,
                  backgroundColor: `${boneColor}18`,
                  color: boneColor,
                }}
              >
                {bone.weaknessPercent !== null ? `${bone.weaknessPercent}%` : copy.unassessed}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/70 font-mono-tech tabular-nums">
              <div>
                <div className="text-[10px] text-slate-400">
                  {isAr ? 'فقدان الفضاء/شهر' : 'Pre-ARED Loss'}
                </div>
                <div dir="ltr" className="text-xs font-bold text-rose-300 mt-0.5 text-start">
                  {nasaProfile.bmdLossPreAredPctPerMonth > 0 ? '+' : ''}
                  {nasaProfile.bmdLossPreAredPctPerMonth}% / mo
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">
                  {isAr ? 'مع جهاز ARED' : 'With ARED'}
                </div>
                <div dir="ltr" className="text-xs font-bold text-emerald-300 mt-0.5 text-start">
                  {nasaProfile.bmdLossWithAredPctPerMonth > 0 ? '+' : ''}
                  {nasaProfile.bmdLossWithAredPctPerMonth}% / mo
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">
                  {isAr ? 'إسفنجي / قشري' : 'Trab / Cort'}
                </div>
                <div dir="ltr" className="text-xs font-bold text-cyan-300 mt-0.5 text-start">
                  {nasaProfile.trabecularPct}% / {nasaProfile.corticalPct}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">
                  {isAr ? 'نصف عمر التعافي' : '50% Recovery'}
                </div>
                <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                  {nasaProfile.recoveryHalfLifeMonths !== null
                    ? `${nasaProfile.recoveryHalfLifeMonths} mo`
                    : 'Baseline'}
                </div>
              </div>
            </div>
          </div>

          {/* Treatment Method, Exact Amount & Exact Timing */}
          <div className="space-y-3.5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <Dumbbell className="w-4 h-4 shrink-0" />
                <span>{copy.prescribedExercise}</span>
              </div>
              <span className="font-mono-tech text-[11px] text-slate-400">
                {isAr ? `الشدة المقاسة: ${autoSeverity}` : `Synced Tier: ${autoSeverity}`}
              </span>
            </div>

            {/* L1 - L4 Severity Segmented Control */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#0b101b] border border-slate-800">
              {SEVERITY_IDS.map((lvl) => {
                const meta = SEVERITY_LEVEL_META[lvl];
                const active = selectedSeverity === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setSelectedSeverity(lvl);
                      setRestRemainingSec(null);
                    }}
                    className={`py-1.5 px-1 rounded text-[11px] font-semibold whitespace-nowrap ui-transition cursor-pointer ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {lvl} · {meta.shortLabel}
                  </button>
                );
              })}
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-white">
                  {isAr ? dosing.prescriptionTitleAr : dosing.prescriptionTitleEn}
                </h3>
                <span className="font-mono-tech text-[11px] text-slate-400">
                  {severityMeta.zRangeLabel}
                </span>
              </div>
              <p className="text-xs text-cyan-300/90 mt-0.5">
                {isAr ? recommendation.deviceAr : recommendation.deviceEn}
              </p>
            </div>

            {/* Exact Treatment Amounts & Timing Table */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-3 py-2.5 border-y border-slate-800/80 font-mono-tech tabular-nums">
              <div>
                <div className="text-[10px] text-slate-400">{copy.targetLoad}</div>
                <div dir="ltr" className="text-sm font-bold text-amber-300 text-start">
                  {scaledLoadKg} kg
                </div>
                <div dir="ltr" className="text-[10px] text-slate-400 text-start">
                  {scaledLoadLb} lb · {dosing.loadPct1Rm}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">{copy.volume}</div>
                <div dir="ltr" className="text-sm font-bold text-white text-start">
                  {dosing.sets} × {dosing.reps}
                </div>
                <div className="text-[10px] text-slate-400">{dosing.rpe}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{isAr ? 'التوقيت والتكرار' : 'Timing & Freq'}</span>
                </div>
                <div dir="ltr" className="text-sm font-bold text-cyan-300 text-start">
                  {dosing.tempo}
                </div>
                <div className="text-[10px] text-slate-400">{dosing.frequencyPerWeek}</div>
              </div>
            </div>

            {/* Interactive Rest Countdown Timer */}
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="text-xs text-slate-300 font-mono-tech tabular-nums">
                {isAr ? 'الراحة بين المجموعات:' : 'Inter-set rest:'}{' '}
                <strong className="text-white">
                  {restRemainingSec !== null ? `${restRemainingSec}s` : `${dosing.restSeconds}s`}
                </strong>
                <span className="text-slate-500"> · {dosing.cadenceSec.toFixed(1)}s/rep</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setRestRemainingSec((prev) =>
                    prev === null || prev === 0 ? dosing.restSeconds : null,
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-700 bg-[#0b101b] hover:border-cyan-400/50 text-cyan-300 cursor-pointer whitespace-nowrap"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>
                  {restRemainingSec !== null && restRemainingSec > 0
                    ? isAr
                      ? 'إعادة ضبط المؤقت'
                      : 'Reset Timer'
                    : isAr
                      ? 'بدء مؤقت الراحة'
                      : 'Start Rest Timer'}
                </span>
              </button>
            </div>

            {/* Site-Specific Matrix Rows */}
            {matchingMatrixRows.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-slate-300">
                  {isAr
                    ? `بروتوكول المصفوفة للمستوى ${selectedSeverity}`
                    : `Bone Matrix Site Method (${selectedSeverity})`}
                </div>
                <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-lg bg-[#0b101b]">
                  {matchingMatrixRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]"
                    >
                      <span className="font-medium text-slate-300">{row.region}</span>
                      <span className="font-mono-tech text-cyan-300 text-end">
                        {row[selectedSeverity]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Biomechanical Limits & Contraindications */}
          <div className="space-y-3 pb-4">
            <div className="text-xs font-semibold text-slate-200">
              {isAr ? 'الحدود الميكانيكية الحيوية وموانع الأمان' : 'Biomechanical Targets & Safety Limits'}
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono-tech tabular-nums text-[11px]">
              <div className="p-2 rounded border border-slate-800 bg-[#0b101b]">
                <div className="text-[10px] text-slate-400">
                  {isAr ? biomechSpec.primaryJointAr : biomechSpec.primaryJointEn}
                </div>
                <div dir="ltr" className="font-bold text-emerald-300 mt-0.5 text-start">
                  {biomechSpec.standingAngleDeg}° → {biomechSpec.optimalPeakAngleDeg}°
                </div>
              </div>
              <div className="p-2 rounded border border-slate-800 bg-[#0b101b]">
                <div className="text-[10px] text-slate-400">
                  {isAr ? 'ذروة القوة' : 'Peak Force'}
                </div>
                <div dir="ltr" className="font-bold text-cyan-300 mt-0.5 text-start">
                  {peakForceBw.toFixed(2)} ×BW
                </div>
              </div>
              <div className="p-2 rounded border border-slate-800 bg-[#0b101b]">
                <div className="text-[10px] text-slate-400">
                  {isAr ? 'حد العمود الفقري' : 'Spinal Limit'}
                </div>
                <div dir="ltr" className="font-bold text-amber-300 mt-0.5 text-start">
                  ≤ {biomechSpec.spinalLoadLimitN} N
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr ? dosing.safetyFocusAr : dosing.safetyFocusEn}
            </p>

            {dosing.contraindicationsEn.length > 0 && (
              <div className="rounded-lg border border-amber-500/35 bg-amber-950/15 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isAr
                      ? `تنبيهات السلامة وموانع الاستخدام (${selectedSeverity})`
                      : `Safety Guardrails & Contraindications (${selectedSeverity})`}
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-amber-100/90 list-disc list-inside">
                  {(isAr ? dosing.contraindicationsAr : dosing.contraindicationsEn).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
              {(isAr ? protocol.cuesAr : protocol.cuesEn).map((cue, idx) => (
                <li key={idx}>{cue}</li>
              ))}
            </ul>
          </div>

          {/* Sectioned Off Quantitative Bone & Sensor Telemetry */}
          <div className="pt-1 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowBoneTelemetry((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="text-purple-400">
                  <SensorHardwareIcon type="EMG" className="w-3.5 h-3.5" />
                </span>
                <span>
                  {isAr
                    ? 'بيانات القياس الكمي وحساسات EMG'
                    : `QUS Scan & EMG Sensor Telemetry (${recommendation.targetEmgSensors.length} Ch)`}
                </span>
              </span>
              {showBoneTelemetry ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showBoneTelemetry && (
              <div className="pt-3 border-t border-slate-800/70 space-y-3">
                <div className="grid grid-cols-3 gap-x-4 gap-y-2.5 font-mono-tech tabular-nums">
                  <div>
                    <div className="text-[10px] text-slate-400">SOS (QUS)</div>
                    <div dir="ltr" className="text-xs font-bold text-cyan-300 mt-0.5 text-start">
                      {bone.sosMs !== null ? `${bone.sosMs} m/s` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">BUA</div>
                    <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                      {bone.buaDbMhz !== null ? `${bone.buaDbMhz} dB` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">BMD</div>
                    <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                      {bone.bmdGcm2 !== null ? `${bone.bmdGcm2} g/cm²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">T-Score</div>
                    <div dir="ltr" className="text-xs font-bold text-amber-300 mt-0.5 text-start">
                      {bone.tScore !== null ? bone.tScore : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Z-Score</div>
                    <div dir="ltr" className="text-xs font-bold text-slate-200 mt-0.5 text-start">
                      {bone.zScore !== null ? bone.zScore : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">{isAr ? 'خطر الكسر' : 'Fracture Risk'}</div>
                    <div className="text-xs font-bold text-rose-300 mt-0.5 truncate">
                      {bone.fractureRisk || '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  {recommendation.targetEmgSensors.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 truncate py-1 border-b border-slate-800/70">
                      <span className="text-purple-400 shrink-0">
                        <SensorHardwareIcon type="EMG" className="w-3 h-3" />
                      </span>
                      <span className="font-mono-tech font-bold text-purple-300">{s.code}</span>
                      <span className="text-slate-300 truncate">{isAr ? s.nameAr : s.nameEn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right: 3D Graphical Exercise Diagram + EMG Verification */}
        <section className="xl:col-span-7 rounded-lg border border-slate-800 bg-[#080c15] p-5 space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-200">
                {isAr
                  ? 'الرسم التوضيحي ثلاثي الأبعاد للتمرين والزوايا الميكانيكية'
                  : '3D Graphical Exercise Diagram · Joint Angles & Live EMG'}
              </div>
              <div className="font-mono-tech text-[11px] text-slate-400">
                {(isAr ? biomechSpec.targetMuscleLabelsAr : biomechSpec.targetMuscleLabelsEn).join(' · ')}
              </div>
            </div>

            <ExerciseSimulator3D
              protocol={protocol}
              severity={selectedSeverity}
              isPlaying={isVideoPlaying}
              onTogglePlay={() => setIsVideoPlaying((p) => !p)}
              onRestart={() => setIsVideoPlaying(true)}
              formQuality={formQuality}
              locale={locale}
              isEvaluating={isEvaluating}
              evalProgress={evalProgress}
            />

            <div className="space-y-3 pt-1">
              <div className="text-xs font-medium text-slate-300">{copy.simulateForm}</div>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#0b101b] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormQuality('optimal')}
                  className={`px-3 py-2 rounded text-xs font-semibold ui-transition cursor-pointer ${
                    formQuality === 'optimal'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/45'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {copy.formOptimal}
                </button>
                <button
                  type="button"
                  onClick={() => setFormQuality('poor')}
                  className={`px-3 py-2 rounded text-xs font-semibold ui-transition cursor-pointer ${
                    formQuality === 'poor'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/45'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {copy.formPoor}
                </button>
              </div>

              <button
                type="button"
                onClick={handleRunEmgInspection}
                disabled={isEvaluating}
                className="w-full py-3 px-4 rounded-lg text-xs font-bold bg-[#0891b2] hover:bg-[#06b6d4] disabled:opacity-60 text-slate-950 flex items-center justify-center gap-2 ui-transition cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>{isEvaluating ? copy.scanningEmg : copy.startEmgCheck}</span>
              </button>
            </div>
          </div>

          {evaluation && (
            <div
              className={`rounded-lg border p-5 space-y-4 ${
                evaluation.isCorrect
                  ? 'border-emerald-500/45 bg-emerald-950/20'
                  : 'border-rose-500/45 bg-rose-950/20'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {evaluation.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-[11px] font-mono-tech text-slate-400">{copy.emgResultTitle}</div>
                    <h3
                      className={`text-sm font-bold ${
                        evaluation.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {evaluation.isCorrect ? copy.correctBadge : copy.incorrectBadge}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEvaluation(null)}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{copy.retestAnother}</span>
                </button>
              </div>

              <p className="text-xs font-medium text-slate-100 leading-relaxed">
                {isAr ? evaluation.verdictAr : evaluation.verdictEn}
              </p>

              <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                {(isAr ? evaluation.feedbackAr : evaluation.feedbackEn).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>

              <div className="pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowEmgChannels((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                >
                  <span>
                    {isAr
                      ? `تفاصيل القنوات العضلية (${evaluation.emgScore}/100)`
                      : `Channel-by-Channel EMG Telemetry (${evaluation.emgScore}/100)`}
                  </span>
                  {showEmgChannels ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {showEmgChannels && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-3">
                    <div className="grid grid-cols-3 gap-3 font-mono-tech tabular-nums">
                      <div>
                        <div className="text-[10px] text-slate-400">{copy.emgScoreLabel}</div>
                        <div className="text-sm font-bold text-white">{evaluation.emgScore}/100</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{copy.meanActivationLabel}</div>
                        <div className="text-sm font-bold text-purple-300">
                          {evaluation.meanActivationPercent}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{copy.symmetryLabel}</div>
                        <div className="text-sm font-bold text-cyan-300">
                          {evaluation.bilateralSymmetryPercent}%
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {evaluation.channelReadings.map((ch) => (
                        <div key={ch.sensorId} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono-tech tabular-nums">
                            <span className="inline-flex items-center gap-1.5 text-slate-300">
                              <span className="text-purple-400 shrink-0">
                                <SensorHardwareIcon type="EMG" className="w-3 h-3" />
                              </span>
                              <span className="text-purple-300 font-semibold">{ch.code}</span>
                              <span>{isAr ? ch.nameAr : ch.muscleGroup}</span>
                            </span>
                            <span className={ch.thresholdMet ? 'text-emerald-400' : 'text-rose-400'}>
                              {ch.activationPercent}% · {ch.peakMicroVolts} µV
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${ch.thresholdMet ? 'bg-emerald-400' : 'bg-rose-400'}`}
                              style={{ width: `${Math.min(100, ch.activationPercent)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
