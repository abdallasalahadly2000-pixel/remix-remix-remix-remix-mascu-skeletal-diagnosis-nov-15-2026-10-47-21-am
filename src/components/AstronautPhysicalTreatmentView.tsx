import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Globe,
  RotateCcw,
  Send,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import {
  BONE_DENSITY_EXERCISE_MATRIX,
  getResearchDoseForBone,
  severityLevelFromZMaster,
} from '../domain/boneExerciseMatrix';
import {
  deriveSeverityFromBone,
  getExerciseBiomechanics,
} from '../domain/nasaBoneDatabase';
import {
  applyDatasetToBones,
  BoneDatasetEntry,
  buildFallbackRecommendation,
  buildSimulatedEmgAttempt,
  DEFAULT_STATUS_COLORS,
  EmgEvaluationResult,
  evaluateEmgSession,
  EXERCISE_PROTOCOLS,
  FormQuality,
  resolveBoneColorHex,
  StatusColorPalette,
} from '../domain/osteosense';
import { computeFullQusAnalysis } from '../domain/qusClinicalEngine';
import { Locale } from '../i18n/translations';
import { RouteId, TreatmentResult, UserProfile } from '../types/app';
import { ExerciseSimulator3D } from './ExerciseSimulator3D';

interface AstronautPhysicalTreatmentViewProps {
  sessionUser: UserProfile | null;
  datasetEntries?: BoneDatasetEntry[];
  statusColors?: StatusColorPalette;
  focusedBoneId?: string;
  onSelectFocusedBoneId?: (boneId: string) => void;
  treatmentResult: TreatmentResult | null;
  onRecordAssessment: (result: TreatmentResult) => void;
  onNavigate: (route: RouteId) => void;
}

type AstronautTab = 'workout' | 'schedule';

const DEFAULT_TARGET_BONES = ['femoral-neck', 'calcaneus', 'lumbar-spine'];

export const AstronautPhysicalTreatmentView: React.FC<AstronautPhysicalTreatmentViewProps> = ({
  sessionUser,
  datasetEntries = [],
  statusColors = DEFAULT_STATUS_COLORS,
  focusedBoneId: controlledFocusedBoneId,
  onSelectFocusedBoneId,
  treatmentResult,
  onRecordAssessment,
  onNavigate,
}) => {
  const [locale, setLocale] = useState<Locale>('en');
  const isAr = locale === 'ar';

  const [tab, setTab] = useState<AstronautTab>('workout');
  const [localFocusedBoneId, setLocalFocusedBoneId] = useState<string>('femur-right');
  const activeFocusedBoneId = controlledFocusedBoneId ?? localFocusedBoneId;

  const handleSelectBone = useCallback(
    (boneId: string) => {
      setLocalFocusedBoneId(boneId);
      onSelectFocusedBoneId?.(boneId);
    },
    [onSelectFocusedBoneId],
  );

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

  const selectedBone = useMemo(
    () => bones.find((b) => b.id === activeFocusedBoneId) || damagedBones[0] || bones[0],
    [bones, activeFocusedBoneId, damagedBones],
  );

  // Compute live synced clinical snapshot silently behind the scenes for Doctor dispatch
  const syncedSummary = useMemo(() => {
    const sourceBones = damagedBones.length > 0 ? damagedBones : assessedBones;
    const sosVals = sourceBones
      .map((b) => b.sosMs)
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    const buaVals = sourceBones
      .map((b) => b.buaDbMhz)
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    const maxWeakness = sourceBones.length
      ? Math.max(...sourceBones.map((b) => b.weaknessPercent ?? 0))
      : 12;

    const sos = sosVals.length ? sosVals.reduce((a, b) => a + b, 0) / sosVals.length : 1535;
    const bua = buaVals.length ? buaVals.reduce((a, b) => a + b, 0) / buaVals.length : 72;
    const unloadingMonths = Math.max(1, Math.min(24, Math.round(maxWeakness / 6)));

    const analysis = computeFullQusAnalysis({
      mode: 'dual',
      sos,
      bua,
      unloadingMonths,
    });

    const severityLevel = severityLevelFromZMaster(analysis.zMaster);
    const targetRegionIds =
      flaggedFromSkeleton.length > 0 ? flaggedFromSkeleton : DEFAULT_TARGET_BONES;

    return {
      sos,
      bua,
      analysis,
      severityLevel,
      targetRegionIds,
    };
  }, [assessedBones, damagedBones, flaggedFromSkeleton]);

  const [dispatchedSig, setDispatchedSig] = useState<string | null>(null);
  const datasetSig = useMemo(() => JSON.stringify(datasetEntries), [datasetEntries]);

  const needsDoctorSync = useMemo(() => {
    if (!treatmentResult) return true;
    if (dispatchedSig !== null && dispatchedSig !== datasetSig) return true;
    const planBones = treatmentResult.selectedBoneIds || [];
    if (flaggedFromSkeleton.length === 0) return false;
    const differs =
      flaggedFromSkeleton.some((id) => !planBones.includes(id)) ||
      planBones.some((id) => !flaggedFromSkeleton.includes(id));
    return differs || Math.abs(treatmentResult.sos - syncedSummary.sos) > 12;
  }, [datasetSig, dispatchedSig, flaggedFromSkeleton, syncedSummary.sos, treatmentResult]);

  const handleSendPlanToDoctor = () => {
    const { analysis, severityLevel, targetRegionIds } = syncedSummary;
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
      selectedBoneIds: targetRegionIds,
      severityLevel,
    };
    setDispatchedSig(datasetSig);
    onRecordAssessment(entry);
  };

  // Exercise / Timing / Simulator state for selected bone
  const recommendation = useMemo(
    () => buildFallbackRecommendation(selectedBone, 74),
    [selectedBone],
  );
  const protocol = EXERCISE_PROTOCOLS[recommendation.exerciseId] || EXERCISE_PROTOCOLS['ared-squat'];
  const biomechSpec = useMemo(() => getExerciseBiomechanics(protocol.id), [protocol.id]);
  const boneSeverity = useMemo(() => deriveSeverityFromBone(selectedBone), [selectedBone]);
  const dosing = biomechSpec.severityDosing[boneSeverity];
  const scaledLoadKg = Math.max(8, Math.round(protocol.defaultLoadKg * dosing.loadFactor));
  const scaledLoadLb = Math.round(scaledLoadKg * 2.20462);
  const selectedBoneColor = resolveBoneColorHex(selectedBone, statusColors);

  const [isPlaying, setIsPlaying] = useState(true);
  const [formQuality, setFormQuality] = useState<FormQuality>('optimal');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(0);
  const [evaluation, setEvaluation] = useState<EmgEvaluationResult | null>(null);
  const [restRemainingSec, setRestRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    setRestRemainingSec(null);
    setEvaluation(null);
  }, [selectedBone.id, boneSeverity, selectedBone.weaknessPercent]);

  useEffect(() => {
    if (restRemainingSec === null || restRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setRestRemainingSec((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restRemainingSec]);

  const handleRunFormCheck = () => {
    setIsEvaluating(true);
    setEvalProgress(0);
    setEvaluation(null);

    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / duration) * 100);
      setEvalProgress(pct);
      if (pct < 100) {
        window.requestAnimationFrame(tick);
      } else {
        const readings = buildSimulatedEmgAttempt(selectedBone, protocol.id, formQuality);
        setEvaluation(evaluateEmgSession(readings));
        setIsEvaluating(false);
      }
    };
    window.requestAnimationFrame(tick);
  };

  const friendlyOverallStatus = useMemo(() => {
    const bhi = syncedSummary.analysis.bhi;
    if (bhi >= 85) {
      return {
        cls: 'text-emerald-400',
        glyph: '●',
        titleEn: 'Bones Looking Strong',
        titleAr: 'صحة العظام قوية وجيدة',
        hintEn: 'Keep up your regular ARED workout schedule to maintain bone strength.',
        hintAr: 'حافظ على جدول التمارين المنتظم للحفاظ على قوة عظامك.',
      };
    }
    if (bhi > 62.5) {
      return {
        cls: 'text-amber-400',
        glyph: '▲',
        titleEn: 'Needs Moderate Strengthening',
        titleAr: 'تحتاج إلى تقوية متوسطة',
        hintEn: 'Follow the guided exercises and rest timers below to rebuild density.',
        hintAr: 'اتبع التمارين الموجهة ومؤقتات الراحة أدناه لتعزيز كثافة العظام.',
      };
    }
    return {
      cls: 'text-rose-400',
      glyph: '✖',
      titleEn: 'Priority Gentle Care',
      titleAr: 'أولوية قصوى — تمارين لطيفة ومحمية',
      hintEn: 'Use controlled lighter loads and follow the safety reminders closely.',
      hintAr: 'استخدم أوزاناً أخف بحركة بطيئة والتزم بإرشادات السلامة.',
    };
  }, [syncedSummary.analysis.bhi]);

  const friendlyBoneLevelLabel = (status: string) => {
    if (status === 'critical') return isAr ? 'عناية أولوية' : 'Priority Care';
    if (status === 'moderate') return isAr ? 'يحتاج تقوية' : 'Needs Strengthening';
    if (status === 'healthy') return isAr ? 'جيد' : 'Healthy';
    return isAr ? 'وقائي' : 'Maintenance';
  };

  const scheduleRows = useMemo(
    () =>
      BONE_DENSITY_EXERCISE_MATRIX.filter((r) =>
        syncedSummary.targetRegionIds.includes(r.id),
      ),
    [syncedSummary.targetRegionIds],
  );

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1440px] mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 overflow-hidden"
    >
      {/* Friendly Astronaut Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">
            {isAr ? 'خطتي للعلاج الطبيعي' : 'My Physical Treatment'}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            {isAr
              ? 'تمارينك اليومية، الأوزان والأوقات المناسبة، والدليل ثلاثي الأبعاد — متزامنة مباشرة مع الهيكل العظمي.'
              : 'Your guided exercises, exact timings, safe weights, and 3D workout demo — automatically synced with My Skeleton.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => onNavigate('skeletons')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#080c15] hover:border-cyan-400/50 text-slate-200 font-medium cursor-pointer ui-transition whitespace-nowrap"
          >
            <span>
              {isAr
                ? `الهيكل العظمي (${damagedBones.length} متأثرة)`
                : `My Skeleton (${damagedBones.length} flagged)`}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-[#080c15] hover:border-slate-500 text-slate-200 font-medium cursor-pointer ui-transition whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{locale === 'en' ? 'العربية' : 'EN'}</span>
          </button>
        </div>
      </div>

      {/* Main Guided Split: Focus Areas + Doctor Sync (Left) & 3D Workout Coach (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* Left Friendly Column */}
        <aside className="lg:col-span-4 p-5 md:p-6 space-y-6 bg-[#080c15]">
          {/* Overall Status Card */}
          <section className="space-y-3">
            <div className="text-xs font-medium text-slate-400">
              {isAr ? 'حالة العظام الحالية' : 'Current Bone Wellness'}
            </div>
            <p className={`font-display text-xl font-bold ${friendlyOverallStatus.cls}`}>
              <span aria-hidden="true">{friendlyOverallStatus.glyph}</span>{' '}
              {isAr ? friendlyOverallStatus.titleAr : friendlyOverallStatus.titleEn}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr ? friendlyOverallStatus.hintAr : friendlyOverallStatus.hintEn}
            </p>

            {/* Simple Wellness Progress Bar */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">
                  {isAr ? 'مؤشر القوة العام' : 'Overall Strength'}
                </span>
                <span className="font-mono-tech font-bold text-cyan-300 tabular-nums">
                  {Math.round(syncedSummary.analysis.bhi)} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ui-transition ${
                    syncedSummary.analysis.bhi >= 85
                      ? 'bg-emerald-400'
                      : syncedSummary.analysis.bhi > 62.5
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, syncedSummary.analysis.bhi))}%` }}
                />
              </div>
            </div>
          </section>

          {/* Focus Bones Synced from My Skeleton */}
          <section className="pt-5 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-white">
                {isAr ? 'المناطق التي تحتاج تركيزاً' : 'Your Focus Areas'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('skeletons')}
                className="text-[11px] font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                {isAr ? 'تعديل في الهيكل →' : 'Edit in My Skeleton →'}
              </button>
            </div>

            {damagedBones.length > 0 ? (
              <div className="space-y-1.5">
                {damagedBones.map((b) => {
                  const active = b.id === selectedBone.id;
                  const col = resolveBoneColorHex(b, statusColors);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        handleSelectBone(b.id);
                        setTab('workout');
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-start flex items-center justify-between gap-2 cursor-pointer ui-transition ${
                        active
                          ? 'border-cyan-400/75 bg-cyan-500/12 text-white'
                          : 'border-slate-800 bg-[#0b101b] hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {isAr ? b.nameAr : b.nameEn}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: col }}>
                          {friendlyBoneLevelLabel(b.status)} · {b.weaknessPercent}%
                        </div>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: col }}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-[#0b101b] p-3.5 space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isAr
                    ? 'لم يتم تسجيل أي ضعف في صفحة الهيكل العظمي. يمكنك اختيار أي منطقة أدناه للتمرين الوقائي.'
                    : 'No weak areas flagged in My Skeleton yet. Pick any area below for a preventive strength workout.'}
                </p>
              </div>
            )}

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">
                {isAr ? 'أو اختر أي عظمة أخرى:' : 'Or pick any bone to practice:'}
              </span>
              <select
                value={selectedBone.id}
                onChange={(e) => {
                  handleSelectBone(e.target.value);
                  setTab('workout');
                }}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-700 bg-[#0b101b] text-xs text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {bones.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn}
                    {b.weaknessPercent !== null ? ` (${b.weaknessPercent}%)` : ''}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* Simple Doctor Approval Dispatch */}
          <section className="pt-5 border-t border-slate-800 space-y-3">
            <h2 className="text-xs font-semibold text-white">
              {isAr ? 'مراجعة الطبيب' : 'Flight Doctor Review'}
            </h2>

            {treatmentResult && !needsDoctorSync ? (
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/15 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {treatmentResult.approvalStatus === 'approved'
                      ? isAr
                        ? 'معتمد من الطبيب'
                        : 'Approved by Your Doctor'
                      : treatmentResult.approvalStatus === 'not_approved'
                        ? isAr
                          ? 'الطبيب طلب تعديلات'
                          : 'Doctor Suggested Updates'
                        : isAr
                          ? 'تم إرسال الخطة للطبيب'
                          : 'Sent to Doctor for Review'}
                  </span>
                </div>
                {treatmentResult.approvalStatus === 'not_approved' && (
                  <button
                    type="button"
                    onClick={() => onNavigate('doctors')}
                    className="text-xs font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    {isAr ? 'اقرأ ملاحظات الطبيب ←' : 'Read Doctor Notes →'}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendPlanToDoctor}
                className="w-full h-10 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer ui-transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isAr ? 'إرسال خطتي للطبيب للموافقة' : 'Send My Plan to Doctor'}
                </span>
              </button>
            )}
          </section>
        </aside>

        {/* Right Guided Workout & 3D Simulator Stage */}
        <div className="lg:col-span-8 flex flex-col min-w-0">
          {/* Clean 2-Tab Bar */}
          <div className="px-6 border-b border-slate-800 bg-[#080c15] flex items-center gap-6">
            <button
              type="button"
              onClick={() => setTab('workout')}
              className={`py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ui-transition ${
                tab === 'workout'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>{isAr ? 'التمرين والمحاكي ثلاثي الأبعاد' : "Today's Exercise & 3D Guide"}</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('schedule')}
              className={`py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ui-transition ${
                tab === 'schedule'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? `الجدول الأسبوعي (${scheduleRows.length})`
                  : `Weekly Schedule (${scheduleRows.length})`}
              </span>
            </button>
          </div>

          <div className="p-5 md:p-6 space-y-6 flex-1">
            {tab === 'workout' ? (
              <>
                {/* Friendly Exercise Title & Target Bone */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>{isAr ? selectedBone.nameAr : selectedBone.nameEn}</span>
                      <span aria-hidden="true">·</span>
                      <span style={{ color: selectedBoneColor }}>
                        {friendlyBoneLevelLabel(selectedBone.status)}
                      </span>
                    </div>
                    <h2 className="font-display text-xl md:text-2xl font-bold text-white mt-0.5">
                      {isAr ? dosing.prescriptionTitleAr : dosing.prescriptionTitleEn}
                    </h2>
                    <p className="text-xs text-cyan-300 mt-0.5">
                      {isAr ? recommendation.deviceAr : recommendation.deviceEn}
                    </p>
                  </div>

                  {/* Oversized Friendly Rest Timer Control */}
                  <button
                    type="button"
                    onClick={() =>
                      setRestRemainingSec((prev) =>
                        prev === null || prev === 0 ? dosing.restSeconds : null,
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/45 bg-cyan-500/12 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold cursor-pointer ui-transition whitespace-nowrap font-mono-tech tabular-nums"
                  >
                    <Timer className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      {restRemainingSec !== null && restRemainingSec > 0
                        ? isAr
                          ? `الراحة المتبقية: ${restRemainingSec} ث`
                          : `Rest: ${restRemainingSec}s (Reset)`
                        : isAr
                          ? `ابدأ مؤقت الراحة (${dosing.restSeconds} ث)`
                          : `Start Rest Timer (${dosing.restSeconds}s)`}
                    </span>
                  </button>
                </div>

                {/* 4 Clear, Everyday Workout Numbers (Amount & Timing) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-tech tabular-nums">
                  <div className="rounded-lg border border-slate-800 bg-[#080c15] p-3.5">
                    <div className="text-[11px] font-sans text-slate-400">
                      {isAr ? 'الوزن المناسب' : 'Safe Weight'}
                    </div>
                    <div dir="ltr" className="text-lg font-bold text-amber-300 mt-1 text-start">
                      {scaledLoadKg} kg
                    </div>
                    <div dir="ltr" className="text-[11px] text-slate-400 text-start">
                      {scaledLoadLb} lb
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#080c15] p-3.5">
                    <div className="text-[11px] font-sans text-slate-400">
                      {isAr ? 'المجموعات والتكرارات' : 'Sets & Reps'}
                    </div>
                    <div dir="ltr" className="text-lg font-bold text-white mt-1 text-start">
                      {dosing.sets} × {dosing.reps}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isAr ? 'مجموعات × عدات' : 'Sets × Repetitions'}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#080c15] p-3.5">
                    <div className="text-[11px] font-sans text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>{isAr ? 'سرعة الحركة' : 'Movement Pace'}</span>
                    </div>
                    <div dir="ltr" className="text-lg font-bold text-cyan-300 mt-1 text-start">
                      {dosing.tempo}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {dosing.frequencyPerWeek}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-[#080c15] p-3.5">
                    <div className="text-[11px] font-sans text-slate-400">
                      {isAr ? 'الراحة بين المجموعات' : 'Rest Between Sets'}
                    </div>
                    <div dir="ltr" className="text-lg font-bold text-emerald-300 mt-1 text-start">
                      {restRemainingSec !== null ? `${restRemainingSec}s` : `${dosing.restSeconds}s`}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isAr ? 'بين كل مجموعة' : 'Recovery pause'}
                    </div>
                  </div>
                </div>

                {/* 3D Interactive Exercise Guide */}
                <div className="space-y-3">
                  <ExerciseSimulator3D
                    protocol={protocol}
                    severity={boneSeverity}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying((p) => !p)}
                    onRestart={() => setIsPlaying(true)}
                    formQuality={formQuality}
                    locale={locale}
                    isEvaluating={isEvaluating}
                    evalProgress={evalProgress}
                  />

                  {/* Friendly Form Simulation & Sensor Check */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center pt-1">
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#080c15] border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setFormQuality('optimal')}
                        className={`px-3 py-2 rounded text-xs font-semibold ui-transition cursor-pointer ${
                          formQuality === 'optimal'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/45'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {isAr ? 'أداء صحيح ومستقيم' : 'Good Balanced Form'}
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
                        {isAr ? 'أداء مائل / غير مكتمل' : 'Shallow / Uneven Form'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunFormCheck}
                      disabled={isEvaluating}
                      className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#0891b2] hover:bg-[#06b6d4] disabled:opacity-60 text-slate-950 inline-flex items-center justify-center gap-2 ui-transition cursor-pointer whitespace-nowrap"
                    >
                      <Activity className="w-4 h-4" />
                      <span>
                        {isEvaluating
                          ? isAr
                            ? 'جاري فحص أدائك...'
                            : 'Checking Your Form...'
                          : isAr
                            ? 'تحقق من صحة التمرين بالحساسات'
                            : 'Check My Form with Sensors'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Friendly Pass / Fix Feedback */}
                {evaluation && (
                  <div
                    className={`rounded-lg border p-4 space-y-2.5 ${
                      evaluation.isCorrect
                        ? 'border-emerald-500/45 bg-emerald-950/20'
                        : 'border-amber-500/45 bg-amber-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {evaluation.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                        )}
                        <h3
                          className={`text-sm font-bold ${
                            evaluation.isCorrect ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {evaluation.isCorrect
                            ? isAr
                              ? `ممتاز! تم تنفيذ التمرين بشكل صحيح (${evaluation.emgScore}%)`
                              : `Great Job — Correct Form Verified (${evaluation.emgScore}%)`
                            : isAr
                              ? `يرجى تعديل التوازن والمدى الحركي (${evaluation.emgScore}%)`
                              : `Form Needs Adjustment (${evaluation.emgScore}%)`}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEvaluation(null)}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إعادة' : 'Reset'}</span>
                      </button>
                    </div>

                    <ul className="space-y-1 text-xs text-slate-200 list-disc list-inside">
                      {(isAr ? evaluation.feedbackAr : evaluation.feedbackEn).slice(0, 2).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Friendly Step-by-Step Tips & Safety Reminders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-white">
                      {isAr ? 'خطوات الأداء الصحيحة' : 'How to Perform Safely'}
                    </h3>
                    <p className="text-xs text-cyan-200/90 leading-relaxed">
                      {isAr ? dosing.safetyFocusAr : dosing.safetyFocusEn}
                    </p>
                    <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                      {(isAr ? protocol.cuesAr : protocol.cuesEn).map((cue, idx) => (
                        <li key={idx}>{cue}</li>
                      ))}
                    </ul>
                  </div>

                  {dosing.contraindicationsEn.length > 0 && (
                    <div className="rounded-lg border border-amber-500/35 bg-amber-950/15 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>{isAr ? 'تجنب أثناء التمرين' : 'Safety Reminders'}</span>
                      </div>
                      <ul className="space-y-1 text-xs text-amber-100/90 list-disc list-inside">
                        {(isAr ? dosing.contraindicationsAr : dosing.contraindicationsEn).map(
                          (item, idx) => (
                            <li key={idx}>{item}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Simplified Weekly Workout Schedule Tab */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {isAr ? 'برنامجك الأسبوعي المخصص' : 'Your Weekly Workout Schedule'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAr
                        ? 'مبني تلقائياً على المناطق المحددة في صفحة الهيكل العظمي.'
                        : 'Automatically built from your focus areas in My Skeleton.'}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-[#080c15]">
                  {scheduleRows.map((row) => {
                    const dose = getResearchDoseForBone(
                      row.category,
                      syncedSummary.severityLevel,
                    );
                    const matchedBone = bones.find((b) =>
                      row.skeletonBoneIds.includes(b.id),
                    );
                    return (
                      <div
                        key={row.id}
                        className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{row.region}</span>
                            <span className="text-slate-600" aria-hidden="true">·</span>
                            <span className="text-cyan-300 font-medium">
                              {row[syncedSummary.severityLevel]}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {dose.frequencyPerWeek} · {dose.restSeconds}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="font-mono-tech text-end">
                            <div className="text-emerald-300 font-semibold">{dose.setsReps}</div>
                            <div className="text-[11px] text-slate-400">{dose.tempo}</div>
                          </div>

                          {matchedBone && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectBone(matchedBone.id);
                                setTab('workout');
                              }}
                              className="px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/12 hover:bg-cyan-500/20 text-cyan-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                            >
                              {isAr ? 'فتح 3D' : 'Open 3D'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
