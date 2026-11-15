import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileWarning } from 'lucide-react';
import { RouteId, TreatmentFeedback } from '../types/app';

interface WriteReviewPageProps {
  onSubmitReview: (negativePoints: string, improvements: string) => void;
  latestFeedback: TreatmentFeedback | null;
  onNavigate: (route: RouteId) => void;
}

export const WriteReviewPage: React.FC<WriteReviewPageProps> = ({
  onSubmitReview,
  latestFeedback,
  onNavigate,
}) => {
  const [negativePoints, setNegativePoints] = useState(latestFeedback?.negativePoints || '');
  const [improvements, setImprovements] = useState(latestFeedback?.improvements || '');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!negativePoints.trim() && !improvements.trim()) {
      setFormError('Enter clinical concerns or recommended improvements before submitting.');
      return;
    }
    setFormError(null);
    onSubmitReview(negativePoints.trim(), improvements.trim());
    setSubmitted(true);
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 p-6 md:p-9">
      <div className="flex items-start gap-3 pb-5 border-b border-slate-800">
        <FileWarning className="w-5 h-5 text-red-400 shrink-0 mt-1" />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Write Clinical Review</h1>
          <p className="text-sm text-slate-400 mt-1">
            Document contraindications, loading risks, and recommended adjustments for the physical treatment plan.
          </p>
        </div>
      </div>

      {submitted && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Your review has been recorded.</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('doctors')}
            className="font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer"
          >
            View in Doctors Review →
          </button>
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-500/40 bg-red-500/12 px-3.5 py-2.5 text-xs text-red-200"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-red-300">Negative Points &amp; Risks</span>
          <textarea
            rows={4}
            value={negativePoints}
            onChange={(e) => {
              setNegativePoints(e.target.value);
              setSubmitted(false);
            }}
            placeholder="List contraindications, fracture risks, or excessive loading intensities..."
            className="w-full rounded-lg border border-slate-700 bg-[#070a12] p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-400"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-cyan-300">Recommended Improvements</span>
          <textarea
            rows={4}
            value={improvements}
            onChange={(e) => {
              setImprovements(e.target.value);
              setSubmitted(false);
            }}
            placeholder="Specify exercise substitutions, load reductions, or supervision frequency changes..."
            className="w-full rounded-lg border border-slate-700 bg-[#070a12] p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </label>

        <button
          type="submit"
          className="w-full h-11 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer ui-transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Submit Review</span>
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('approval')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer ui-transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-red-400" />
          <span>Back to Doctor Approval</span>
        </button>
      </div>
    </div>
  );
};
