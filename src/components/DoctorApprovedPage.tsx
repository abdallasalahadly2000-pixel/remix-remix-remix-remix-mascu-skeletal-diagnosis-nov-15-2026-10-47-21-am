import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { RouteId } from '../types/app';

interface DoctorApprovedPageProps {
  onNavigate: (route: RouteId) => void;
}

export const DoctorApprovedPage: React.FC<DoctorApprovedPageProps> = ({ onNavigate }) => {
  return (
    <div className="w-full max-w-xl mx-auto rounded-xl border border-emerald-500/40 bg-[#0b101b]/95 p-8 md:p-10 text-center">
      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />

      <h1 className="font-display text-2xl md:text-3xl font-bold text-white mt-5">
        Treatment Plan Approved
      </h1>
      <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">
        Physician approval has been logged and synced to the Doctors Review record.
      </p>

      <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('doctors')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer ui-transition"
        >
          <span>View Doctors Review</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('approval')}
          className="px-4 py-2.5 rounded-lg border border-slate-700 bg-[#070a12] hover:border-slate-500 text-slate-200 text-xs font-semibold whitespace-nowrap cursor-pointer ui-transition"
        >
          Back to Doctor Approval
        </button>
      </div>
    </div>
  );
};
