import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Dumbbell,
  Radio,
  Activity,
  RotateCcw,
} from 'lucide-react';
import {
  BoneSegment,
  DEFAULT_STATUS_COLORS,
  EXERCISE_PROTOCOLS,
  EmgEvaluationResult,
  ExerciseRecommendation,
  FormQuality,
  StatusColorPalette,
  resolveBoneColorHex,
} from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';
import { ExerciseVideoPlayer } from './ExerciseVideoPlayer';

interface ExercisePageProps {
  bone: BoneSegment;
  statusColors?: StatusColorPalette;
  recommendation: ExerciseRecommendation;
  isVideoPlaying: boolean;
  onToggleVideo: () => void;
  onRestartVideo: () => void;
  formQuality: FormQuality;
  onChangeFormQuality: (q: FormQuality) => void;
  isEvaluating: boolean;
  evalProgress: number;
  onRunEmgInspection: () => void;
  evaluation: EmgEvaluationResult | null;
  onResetEvaluation: () => void;
  onBackToSkeleton: () => void;
  locale: Locale;
  onToggleLocale: () => void;
}

export const ExercisePage: React.FC<ExercisePageProps> = ({
  bone,
  statusColors = DEFAULT_STATUS_COLORS,
  recommendation,
  isVideoPlaying,
  onToggleVideo,
  onRestartVideo,
  formQuality,
  onChangeFormQuality,
  isEvaluating,
  evalProgress,
  onRunEmgInspection,
  evaluation,
  onResetEvaluation,
  onBackToSkeleton,
  locale,
  onToggleLocale,
}) => {
  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';
  const protocol = EXERCISE_PROTOCOLS[recommendation.exerciseId] || EXERCISE_PROTOCOLS['ared-squat'];
  const boneColor = resolveBoneColorHex(bone, statusColors);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      data-testid="exercise-verification-page"
      className="min-h-screen w-screen bg-[#060911] text-slate-100 flex flex-col"
    >
      {/* Top Page Bar */}
      <header className="sticky top-0 z-30 h-14 px-6 flex items-center justify-between border-b border-slate-800 bg-[#080d18]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToSkeleton}
            data-testid="back-to-skeleton-btn"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{copy.backToSkeleton}</span>
          </button>
          <span className="hidden sm:inline font-display text-sm font-bold text-white tracking-wide">
            {copy.exercisePageTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleLocale}
          data-testid="exercise-toggle-locale-btn"
          className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white border border-slate-700 bg-[#0d1424]"
        >
          {locale === 'en' ? 'العربية' : 'EN'}
        </button>
      </header>

      {/* Main Two-Column Exercise & EMG Re-Inspection Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bone Status (Anchored strictly to Dataset) + Exercise Prescription + Target EMG Channels */}
        <section className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono-tech text-slate-400">
                  {isAr ? bone.regionAr : bone.regionEn}
                </div>
                <h1 className="font-display text-xl font-bold text-white mt-0.5">
                  {isAr ? bone.nameAr : bone.nameEn}
                </h1>
              </div>
              <div
                className="px-3 py-1.5 rounded-lg border font-mono-tech text-sm font-bold"
                style={{
                  borderColor: `${boneColor}66`,
                  backgroundColor: `${boneColor}18`,
                  color: boneColor,
                }}
              >
                {bone.weaknessPercent !== null ? `${bone.weaknessPercent}%` : copy.unassessed}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono-tech">
              <div className="rounded-lg border border-slate-800 bg-[#080d18] p-2.5">
                <div className="text-[10px] text-slate-400">{copy.weaknessLabel}</div>
                <div dir="ltr" className="text-sm font-bold mt-0.5 text-start" style={{ color: boneColor }}>
                  {bone.weaknessPercent !== null ? `${bone.weaknessPercent}%` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#080d18] p-2.5">
                <div className="text-[10px] text-slate-400">SOS (QUS)</div>
                <div dir="ltr" className="text-sm font-bold text-cyan-300 mt-0.5 text-start">
                  {bone.sosMs !== null ? `${bone.sosMs} m/s` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#080d18] p-2.5">
                <div className="text-[10px] text-slate-400">BUA</div>
                <div dir="ltr" className="text-sm font-bold text-slate-100 mt-0.5 text-start">
                  {bone.buaDbMhz !== null ? `${bone.buaDbMhz} dB` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#080d18] p-2.5">
                <div className="text-[10px] text-slate-400">BMD</div>
                <div dir="ltr" className="text-sm font-bold text-slate-100 mt-0.5 text-start">
                  {bone.bmdGcm2 !== null ? `${bone.bmdGcm2} g/cm²` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#080d18] p-2.5">
                <div className="text-[10px] text-slate-400">T-Score</div>
                <div dir="ltr" className="text-sm font-bold text-amber-300 mt-0.5 text-start">
                  {bone.tScore !== null ? bone.tScore : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#080d18] p-2.5">
                <div className="text-[10px] text-slate-400">{isAr ? 'خطر الكسر' : 'Fracture Risk'}</div>
                <div className="text-sm font-bold text-rose-300 mt-0.5 truncate">
                  {bone.fractureRisk || '—'}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#080d18] p-3 space-y-1.5 text-[11px]">
              <div>
                <span className="font-semibold text-slate-200">{copy.anatomyProfileLabel}: </span>
                <span className="text-slate-300">{isAr ? bone.anatomyDetailsAr : bone.anatomyDetailsEn}</span>
              </div>
              <div>
                <span className="font-semibold text-amber-300">{copy.microgravityRiskLabel}: </span>
                <span className="text-slate-300">{isAr ? bone.microgravityRiskAr : bone.microgravityRiskEn}</span>
              </div>
              {(isAr ? bone.detailsAr : bone.detailsEn) && (
                <div>
                  <span className="font-semibold text-cyan-300">{copy.clinicalNotesLabel}: </span>
                  <span className="text-slate-200">{isAr ? bone.detailsAr : bone.detailsEn}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-2.5">
              {copy.datasetUnchangedNote}
            </p>
          </div>

          {/* Prescribed Strengthening Exercise */}
          <div className="rounded-xl border border-cyan-500/35 bg-[#0c1629] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <Dumbbell className="w-4 h-4" />
                <span>{copy.aiCountermeasure}</span>
              </div>
              <span className="font-mono-tech text-[10px] text-slate-400">
                {recommendation.source === 'gemini' ? 'Gemini AI' : 'Protocol'}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">
                {isAr ? recommendation.exerciseNameAr : recommendation.exerciseNameEn}
              </h2>
              <p className="text-xs text-cyan-300/90 mt-0.5">
                {isAr ? recommendation.deviceAr : recommendation.deviceEn}
              </p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr ? recommendation.rationaleAr : recommendation.rationaleEn}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 font-mono-tech">
              <div>
                <div className="text-[10px] text-slate-400">{copy.targetLoad}</div>
                <div className="text-sm font-bold text-amber-300">{recommendation.targetLoadKg} kg</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">{copy.volume}</div>
                <div className="text-sm font-bold text-white">
                  {recommendation.sets} × {recommendation.reps}
                </div>
              </div>
            </div>

            <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside pt-2 border-t border-slate-800/80">
              {(isAr ? protocol.cuesAr : protocol.cuesEn).map((cue, idx) => (
                <li key={idx}>{cue}</li>
              ))}
            </ul>
          </div>

          {/* Monitored EMG Muscle Channels */}
          <div className="rounded-xl border border-purple-500/30 bg-[#0b1120] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Radio className="w-4 h-4" />
              <span>
                {isAr
                  ? `قنوات EMG المراقبة للتمرين (${recommendation.targetEmgSensors.length} قناة)`
                  : `Active EMG Channels Monitoring Exercise (${recommendation.targetEmgSensors.length} Ch)`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {recommendation.targetEmgSensors.map((s) => (
                <div
                  key={s.id}
                  className="rounded border border-slate-800 bg-[#070b14] px-2.5 py-1.5 text-[11px]"
                >
                  <span className="font-mono-tech font-bold text-purple-300 mr-1.5">{s.code}</span>
                  <span className="text-slate-300">{isAr ? s.nameAr : s.nameEn}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Exercise Video + EMG Sensor Re-Inspection + Verdict */}
        <section className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-5 space-y-4">
            <div className="text-xs font-semibold text-slate-200">{copy.exerciseVideo}</div>

            <ExerciseVideoPlayer
              protocol={protocol}
              isPlaying={isVideoPlaying}
              onTogglePlay={onToggleVideo}
              onRestart={onRestartVideo}
              formQuality={formQuality}
              locale={locale}
              isEvaluating={isEvaluating}
              evalProgress={evalProgress}
            />

            {/* Astronaut Execution Mode + EMG Re-Inspection Action */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-medium text-slate-300">{copy.simulateForm}</div>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#070b14] border border-slate-800">
                <button
                  type="button"
                  onClick={() => onChangeFormQuality('optimal')}
                  className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                    formQuality === 'optimal'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/45'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {copy.formOptimal}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFormQuality('poor')}
                  className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
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
                onClick={onRunEmgInspection}
                disabled={isEvaluating}
                data-testid="run-emg-inspection-btn"
                className="w-full py-3 px-4 rounded-lg text-xs font-bold bg-purple-500 hover:bg-purple-400 disabled:opacity-60 text-white flex items-center justify-center gap-2 transition-colors"
              >
                <Activity className="w-4 h-4" />
                <span>{isEvaluating ? copy.scanningEmg : copy.startEmgCheck}</span>
              </button>
            </div>
          </div>

          {/* Post-Exercise EMG Re-Inspection Verdict */}
          {evaluation && (
            <div
              data-testid="emg-evaluation-result"
              className={`rounded-xl border p-5 space-y-4 ${
                evaluation.isCorrect
                  ? 'border-emerald-500/50 bg-emerald-950/25'
                  : 'border-rose-500/50 bg-rose-950/25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
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
                  onClick={onResetEvaluation}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{copy.retestAnother}</span>
                </button>
              </div>

              <p className="text-xs font-medium text-slate-100 leading-relaxed">
                {isAr ? evaluation.verdictAr : evaluation.verdictEn}
              </p>

              <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800/80 font-mono-tech">
                <div>
                  <div className="text-[10px] text-slate-400">{copy.emgScoreLabel}</div>
                  <div className="text-base font-bold text-white">{evaluation.emgScore}/100</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">{copy.meanActivationLabel}</div>
                  <div className="text-base font-bold text-purple-300">
                    {evaluation.meanActivationPercent}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">{copy.symmetryLabel}</div>
                  <div className="text-base font-bold text-cyan-300">
                    {evaluation.bilateralSymmetryPercent}%
                  </div>
                </div>
              </div>

              {/* Per-Channel EMG Activation Bars */}
              <div className="space-y-2">
                {evaluation.channelReadings.map((ch) => (
                  <div key={ch.sensorId} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono-tech">
                      <span className="text-slate-300">
                        <span className="text-purple-300 font-semibold mr-1.5">{ch.code}</span>
                        {isAr ? ch.nameAr : ch.muscleGroup}
                      </span>
                      <span className={ch.thresholdMet ? 'text-emerald-400' : 'text-rose-400'}>
                        {ch.activationPercent}% · {ch.peakMicroVolts} µV
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ch.thresholdMet ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.min(100, ch.activationPercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside pt-2 border-t border-slate-800/80">
                {(isAr ? evaluation.feedbackAr : evaluation.feedbackEn).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
