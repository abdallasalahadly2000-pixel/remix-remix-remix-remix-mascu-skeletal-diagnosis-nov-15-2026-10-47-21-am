import React, { useState } from 'react';
import { ArrowRight, Check, Copy, Mail } from 'lucide-react';
import { RouteId } from '../types/app';

interface ContactViewProps {
  onNavigate: (route: RouteId) => void;
}

export const ContactView: React.FC<ContactViewProps> = ({ onNavigate }) => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText('quantum.contact.team@gmail.com').catch(() => {});
    }
    setCopiedEmail(true);
    window.setTimeout(() => {
      setCopiedEmail(false);
    }, 1800);
  };

  return (
    <div className="w-full md:max-w-[480px] lg:max-w-[520px] shrink-0 rounded-xl border border-slate-800 bg-[#0b101b]/92 p-6 md:p-8">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Contact Us</h1>
      <p className="text-sm text-slate-300 mt-2 leading-relaxed">
        Direct medical telemetry desk and mission engineering support for Mascu-Skeletal Diagnosis.
      </p>

      <div className="mt-6 pt-6 border-t border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Mail className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Support Desk Email</p>
              <a
                href="mailto:quantum.contact.team@gmail.com"
                className="font-mono-tech text-sm md:text-base font-medium text-white hover:text-cyan-300 break-all ui-transition"
              >
                quantum.contact.team@gmail.com
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyEmail}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-[#070a12] hover:border-cyan-400/60 text-slate-100 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ui-transition"
          >
            {copiedEmail ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('skeletons')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ui-transition"
          >
            <span>Open 3D Skeleton</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('orbit')}
            className="text-xs font-medium text-slate-400 hover:text-white cursor-pointer ui-transition"
          >
            Return to Orbit
          </button>
        </div>
      </div>
    </div>
  );
};
