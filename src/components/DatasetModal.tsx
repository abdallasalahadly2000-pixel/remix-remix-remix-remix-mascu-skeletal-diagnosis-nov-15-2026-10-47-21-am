import React, { useMemo, useState } from 'react';
import { X, Upload, Trash2, Database, CheckCircle2 } from 'lucide-react';
import {
  BONE_DEFINITIONS,
  BoneDatasetEntry,
  SAMPLE_DATASET,
  parseBoneDatasetInput,
} from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';

interface DatasetModalProps {
  currentDataset: BoneDatasetEntry[];
  onApplyDataset: (entries: BoneDatasetEntry[]) => void;
  onClose: () => void;
  locale: Locale;
}

export const DatasetModal: React.FC<DatasetModalProps> = ({
  currentDataset,
  onApplyDataset,
  onClose,
  locale,
}) => {
  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';

  const [rawText, setRawText] = useState<string>(() =>
    currentDataset.length > 0 ? JSON.stringify(currentDataset, null, 2) : '',
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const previewEntries = useMemo(() => {
    if (!rawText.trim()) return [];
    try {
      return parseBoneDatasetInput(rawText);
    } catch {
      return null;
    }
  }, [rawText]);

  const handleLoadSample = () => {
    setParseError(null);
    setRawText(JSON.stringify(SAMPLE_DATASET, null, 2));
  };

  const handleClear = () => {
    setParseError(null);
    setRawText('');
    onApplyDataset([]);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setParseError(null);
      setRawText(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (!rawText.trim()) {
      onApplyDataset([]);
      onClose();
      return;
    }
    try {
      const parsed = parseBoneDatasetInput(rawText);
      if (parsed.length === 0) {
        setParseError(
          isAr
            ? 'لم يتم العثور على صفوف صالحة. استخدم الصيغة JSON أو CSV: boneId,weaknessPercent'
            : 'No valid rows parsed. Use JSON array or CSV lines: boneId,weaknessPercent,sosMs,buaDbMhz',
        );
        return;
      }
      onApplyDataset(parsed);
      onClose();
    } catch {
      setParseError(
        isAr
          ? 'صيغة البيانات غير صالحة. تأكد من صحة JSON أو CSV.'
          : 'Invalid dataset syntax. Check JSON brackets or CSV columns.',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={copy.datasetModalTitle}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0a0f1c] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0d1424]">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="font-display text-sm font-bold text-white">{copy.datasetModalTitle}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{copy.datasetModalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.closeDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto thin-scroll">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>{copy.uploadFile}</span>
                <input type="file" accept=".json,.csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 transition-colors cursor-pointer"
              >
                {copy.loadSampleBtn}
              </button>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{copy.clearDatasetBtn}</span>
            </button>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070b14] p-2.5 text-[11px] text-slate-400 space-y-1">
            <div>
              <span className="font-semibold text-slate-300">
                {isAr ? 'معرفات العظام: ' : 'Valid boneId values: '}
              </span>
              <span className="font-mono-tech text-[10px] text-cyan-300/80">
                {BONE_DEFINITIONS.map((b) => b.id).join(', ')}
              </span>
            </div>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => {
              setParseError(null);
              setRawText(e.target.value);
            }}
            rows={9}
            spellCheck={false}
            placeholder={
              isAr
                ? 'الصق بيانات JSON أو CSV هنا، مثال:\nfemur-right,55,1468,44,0.71,-2.7,Critical femoral neck loss'
                : 'Paste JSON or CSV here, e.g.:\nfemur-right,55,1468,44,0.71,-2.7,Critical femoral neck loss\nlumbar-spine,28,1532,62,0.89,-1.6,Moderate L1-L5 trabecular loss'
            }
            className="w-full rounded-lg border border-slate-700 bg-[#060911] p-3 font-mono-tech text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />

          {parseError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              {parseError}
            </div>
          )}

          {!parseError && rawText.trim() && previewEntries && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-mono-tech">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? `تم التعرف على ${previewEntries.length} عظمة جاهزة للتطبيق`
                  : `Parsed ${previewEntries.length} bone entries ready to apply`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-800 bg-[#0d1424]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {copy.closeDrawer}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors cursor-pointer"
          >
            {copy.applyDataset}
          </button>
        </div>
      </div>
    </div>
  );
};
