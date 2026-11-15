import React from 'react';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { RouteId, TreatmentFeedback } from '../types/app';

interface DoctorsReviewViewProps {
  feedbackList: TreatmentFeedback[];
  onNavigate: (route: RouteId) => void;
}

export const DoctorsReviewView: React.FC<DoctorsReviewViewProps> = ({
  feedbackList,
  onNavigate,
}) => {
  const approvedCount = feedbackList.filter((f) => f.decision === 'approved').length;
  const revisionCount = feedbackList.length - approvedCount;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 p-6 md:p-9">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Doctors Review</h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 font-mono-tech">
            <span>{feedbackList.length} Total</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">{approvedCount} Approved</span>
            <span aria-hidden="true">·</span>
            <span className="text-red-400">{revisionCount} Revision Requested</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('approval')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-[#070a12] hover:border-cyan-400/60 text-xs font-semibold text-slate-200 whitespace-nowrap cursor-pointer ui-transition"
        >
          <span>Doctor Approval</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {feedbackList.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm font-medium text-slate-300">No physician reviews recorded yet.</p>
          <p className="text-xs text-slate-500">
            Decisions logged in Doctor Approval appear here automatically.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {feedbackList.map((fb) => {
            const isApproved = fb.decision === 'approved';
            return (
              <div key={fb.id} className="py-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span
                      className={`text-sm font-semibold ${
                        isApproved ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isApproved ? 'Approved' : 'Not Approved'}
                    </span>
                    {(fb.treatmentId || fb.planCode) && (
                      <>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="font-mono-tech text-xs text-slate-400">
                          {fb.planCode || fb.treatmentId}
                        </span>
                      </>
                    )}
                    {fb.patientName && (
                      <>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="text-xs text-slate-300">{fb.patientName}</span>
                      </>
                    )}
                    {fb.doctorName && (
                      <>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span className="text-xs text-slate-400">Reviewed by {fb.doctorName}</span>
                      </>
                    )}
                  </div>

                  <span className="font-mono-tech text-[11px] text-slate-500">
                    {new Date(fb.createdAt).toLocaleString()}
                  </span>
                </div>

                {!isApproved && (
                  <div className="pl-6 space-y-1.5 text-xs leading-relaxed">
                    <p className="text-slate-200">
                      <span className="font-semibold text-red-300">Negative points: </span>
                      {fb.negativePoints || '—'}
                    </p>
                    <p className="text-slate-200">
                      <span className="font-semibold text-cyan-300">Improvements: </span>
                      {fb.improvements || '—'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
