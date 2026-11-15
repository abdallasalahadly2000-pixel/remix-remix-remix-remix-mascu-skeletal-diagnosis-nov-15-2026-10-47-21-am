import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Lock,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import {
  BONE_DENSITY_EXERCISE_MATRIX,
  getResearchDoseForBone,
  SEVERITY_LEVEL_META,
} from '../domain/boneExerciseMatrix';
import { RouteId, TreatmentResult, UserProfile, formatUserTitle } from '../types/app';

interface DoctorApprovalViewProps {
  sessionUser: UserProfile | null;
  treatmentReport: TreatmentResult | null;
  treatmentPlans?: TreatmentResult[];
  onSelectPlan?: (planId: string) => void;
  submitting?: boolean;
  onApprove: () => void;
  onNotApprove: () => void;
  onOpenDoctorSignIn: () => void;
  onNavigate: (route: RouteId) => void;
}

export const DoctorApprovalView: React.FC<DoctorApprovalViewProps> = ({
  sessionUser,
  treatmentReport,
  treatmentPlans = [],
  onSelectPlan,
  submitting = false,
  onApprove,
  onNotApprove,
  onOpenDoctorSignIn,
  onNavigate,
}) => {
  const [showTelemetry, setShowTelemetry] = useState(false);

  const isDoctor = sessionUser?.role === 'doctor';

  // Gate behind Doctor account sign-in
  if (!isDoctor) {
    return (
      <div className="w-full max-w-xl mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 p-7 md:p-10 text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl border border-slate-700 bg-[#070a12] flex items-center justify-center">
          <Lock className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-white">Doctor Sign-In Required</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {sessionUser
              ? `You are currently signed in as ${formatUserTitle(sessionUser)} (License ${sessionUser.badgeId}). Physician clearance and treatment approval are restricted to signed-in Doctor accounts.`
              : 'Doctor Approval is restricted to Flight Surgeons and Orthopedic Specialists. Sign in with a Doctor account to review and approve physical treatment plans.'}
          </p>
        </div>

        {treatmentReport && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/8 px-4 py-3 text-xs text-cyan-200">
            A treatment plan (<span className="font-mono-tech font-semibold">{treatmentReport.planCode || treatmentReport.id}</span>) is queued and awaiting Doctor review.
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenDoctorSignIn}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer ui-transition"
          >
            <Stethoscope className="w-4 h-4" />
            <span>{sessionUser?.canSwitchToDoctor ? 'Switch to Doctor View' : sessionUser ? 'Switch to Doctor Account' : 'Sign In as Doctor'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('coach')}
            className="px-4 py-2.5 rounded-lg border border-slate-700 bg-[#070a12] hover:border-slate-500 text-slate-200 text-xs font-medium whitespace-nowrap cursor-pointer ui-transition"
          >
            Back to Physical Treatment
          </button>
        </div>
      </div>
    );
  }

  const isAlreadyReviewed =
    treatmentReport?.approvalStatus === 'approved' ||
    treatmentReport?.approvalStatus === 'not_approved';
  const canSubmitDecision = Boolean(
    treatmentReport && !submitting && (!isAlreadyReviewed || sessionUser?.isAdmin),
  );

  return (
    <div className="w-full max-w-4xl mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 p-6 md:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Doctor Approval</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review the auto-submitted treatment plan and record your physician clearance decision.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {treatmentPlans.length > 1 && onSelectPlan && (
            <select
              aria-label="Select Treatment Plan"
              value={String(treatmentReport?.id || '')}
              onChange={(e) => onSelectPlan(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] font-mono-tech text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              {treatmentPlans.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {p.planCode || p.id} · {p.astronautName} ({p.approvalStatus || 'pending'})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => onNavigate('doctors')}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-[#070a12] hover:border-slate-500 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer ui-transition"
          >
            View Doctors Review
          </button>
        </div>
      </div>

      {/* Physical Treatment Report Slot */}
      <div aria-label="Physical Treatment Report" className="py-6 border-b border-slate-800">
        {treatmentReport ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-white">
                  {treatmentReport.astronautName || 'Crew Assessment'}
                </p>
                <p className="font-mono-tech text-xs text-slate-400 mt-0.5">
                  {treatmentReport.astronautBadge || 'CREW'} · {treatmentReport.planCode || treatmentReport.id}
                  {treatmentReport.sentToDoctorAt && (
                    <> · Queued {new Date(treatmentReport.sentToDoctorAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                  {treatmentReport.approvalStatus && treatmentReport.approvalStatus !== 'pending' && (
                    <> · Status: {treatmentReport.approvalStatus === 'approved' ? 'Approved' : 'Revision Requested'}</>
                  )}
                </p>
              </div>
              <span className="font-mono-tech text-sm font-semibold text-cyan-300">
                {treatmentReport.prediction === 'Normal' && '● '}
                {treatmentReport.prediction === 'Osteopenia' && '▲ '}
                {treatmentReport.prediction === 'Osteoporosis' && '✖ '}
                {treatmentReport.prediction}
              </span>
            </div>

            {/* Plain Clinical Summary First */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">Clinical Protocol Summary</p>
              <p className="text-sm text-slate-100 leading-relaxed">
                {treatmentReport.recommendation}
              </p>
            </div>

            {/* Target Bone Prescriptions */}
            {treatmentReport.selectedBoneIds &&
              treatmentReport.selectedBoneIds.length > 0 &&
              treatmentReport.severityLevel && (
                <div className="pt-5 border-t border-slate-800/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="font-semibold text-slate-200">
                      Prescribed Exercises · {SEVERITY_LEVEL_META[treatmentReport.severityLevel].label}
                    </p>
                    <span className="font-mono-tech text-xs text-emerald-300">
                      {SEVERITY_LEVEL_META[treatmentReport.severityLevel].overviewDose.setsReps}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-lg bg-[#070a12]">
                    {BONE_DENSITY_EXERCISE_MATRIX.filter((r) =>
                      treatmentReport.selectedBoneIds?.includes(r.id),
                    ).map((row) => {
                      const dose = getResearchDoseForBone(row.category, treatmentReport.severityLevel!);
                      return (
                        <div
                          key={row.id}
                          className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">{row.region}</span>
                            <span className="text-slate-500 mx-2">·</span>
                            <span className="text-cyan-300">{row[treatmentReport.severityLevel!]}</span>
                          </div>
                          <div className="font-mono-tech text-[11px] text-emerald-300">
                            {dose.setsReps}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Sectioned Off Numerical Diagnostic Telemetry */}
            <div className="pt-5 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowTelemetry((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                <span>Diagnostic Telemetry &amp; Raw Acoustic Data</span>
                {showTelemetry ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showTelemetry && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 font-mono-tech pt-4 border-t border-slate-800/60">
                  <div>
                    <p className="text-[11px] text-slate-400">Calcaneal SOS</p>
                    <p className="text-base font-bold text-cyan-300 mt-0.5">
                      {treatmentReport.sos.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">m/s</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">BUA</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      {treatmentReport.bua.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-slate-400">dB/MHz</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">
                      {treatmentReport.analysis ? 'Composite Z_master' : 'T-Score'}
                    </p>
                    <p className="text-base font-bold text-amber-300 mt-0.5">
                      {treatmentReport.tScore.toFixed(2)}
                    </p>
                  </div>
                  {treatmentReport.analysis && (
                    <>
                      <div>
                        <p className="text-[11px] text-slate-400">Bone Health Index</p>
                        <p className="text-base font-bold text-emerald-300 mt-0.5">
                          {treatmentReport.analysis.bhi.toFixed(1)}{' '}
                          <span className="text-xs font-normal text-slate-400">/ 100</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">10-Yr Fragility Risk</p>
                        <p className="text-base font-bold text-red-300 mt-0.5">
                          {treatmentReport.analysis.bdsPercent.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Estimated BMD</p>
                        <p className="text-base font-bold text-white mt-0.5">
                          {treatmentReport.analysis.ebmd.toFixed(3)}{' '}
                          <span className="text-xs font-normal text-slate-400">g/cm²</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-4">
            <ClipboardList className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="max-w-md mx-auto">
              <p className="text-sm font-semibold text-white">No Pending Treatment Plans</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Any treatment plan generated in Physical Treatment is automatically queued here for your review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('coach')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold cursor-pointer ui-transition"
            >
              <span>Go to Physical Treatment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Decision Actions */}
      <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          type="button"
          disabled={!canSubmitDecision}
          onClick={onApprove}
          className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-display text-sm font-bold inline-flex items-center justify-center gap-2 ui-transition cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{submitting ? 'Saving Decision...' : 'Approve Treatment Plan'}</span>
        </button>

        <button
          type="button"
          disabled={!canSubmitDecision}
          onClick={onNotApprove}
          className="h-11 px-5 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-45 disabled:cursor-not-allowed text-white font-display text-sm font-bold inline-flex items-center justify-center gap-2 ui-transition cursor-pointer"
        >
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Request Revision (Not Approved)</span>
        </button>
      </div>
    </div>
  );
};
