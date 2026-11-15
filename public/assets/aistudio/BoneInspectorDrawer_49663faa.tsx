import React from 'react';
import { X, Activity, Database, ArrowRight, Palette, RotateCcw, FileText, Dumbbell, Code2 } from 'lucide-react';
import {
  BoneDatasetEntry,
  BoneSegment,
  DEFAULT_STATUS_COLORS,
  EXERCISE_PROTOCOLS,
  SUIT_SENSORS,
  StatusColorPalette,
  resolveBoneColorHex,
} from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';

interface BoneInspectorDrawerProps {
  bones: BoneSegment[];
  selectedBone: BoneSegment | null;
  hasDataset: boolean;
  statusColors: StatusColorPalette;
  onChangeStatusColor: (tier: keyof StatusColorPalette, hex: string) => void;
  onResetStatusColors: () => void;
  onSelectBone: (boneId: string) => void;
  onUpdateBoneWeakness: (boneId: string, weaknessPercent: number | null) => void;
  onUpdateBoneDetails: (boneId: string, patch: Partial<Omit<BoneDatasetEntry, 'boneId'>>) => void;
  onOpenExercisePage: (boneId: string) => void;
  onOpenDatasetModal: () => void;
  onLoadSampleDataset: () => void;
  onClose: () => void;
  locale: Locale;
}

export const BoneInspectorDrawer: React.FC<BoneInspectorDrawerProps> = ({
  bones,
  selectedBone,
  hasDataset,
  statusColors,
  onChangeStatusColor,
  onResetStatusColors,
  onSelectBone,
  onUpdateBoneWeakness,
  onUpdateBoneDetails,
  onOpenExercisePage,
  onOpenDatasetModal,
  onLoadSampleDataset,
  onClose,
  locale,
}) => {
  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';

  const handleNumericInput = (boneId: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      onUpdateBoneWeakness(boneId, null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      onUpdateBoneWeakness(boneId, Math.max(0, Math.min(100, Math.round(parsed))));
    }
  };

  const colorTierRows: Array<{
    key: keyof StatusColorPalette;
    label: string;
    range: string;
  }> = [
    { key: 'healthy', label: copy.healthy, range: '0–17%' },
    { key: 'moderate', label: copy.moderate, range: '18–37%' },
    { key: 'critical', label: copy.critical, range: '38–100%' },
    { key: 'unassessed', label: copy.unassessed, range: '—' },
  ];

  const selectedColor = selectedBone ? resolveBoneColorHex(selectedBone, statusColors) : statusColors.unassessed;
  const selectedProtocol = selectedBone
    ? EXERCISE_PROTOCOLS[selectedBone.recommendedExerciseId] || EXERCISE_PROTOCOLS['ared-squat']
    : null;
  const selectedSensors = selectedBone
    ? selectedBone.sensorIds
        .map((sid) => SUIT_SENSORS.find((s) => s.id === sid))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
    : [];

  const selectedStatusLabel = selectedBone
    ? selectedBone.status === 'healthy'
      ? copy.healthy
      : selectedBone.status === 'moderate'
        ? copy.moderate
        : selectedBone.status === 'critical'
          ? copy.critical
          : copy.unassessed
    : copy.unassessed;

  const selectedNotes = selectedBone
    ? (isAr ? selectedBone.detailsAr : selectedBone.detailsEn) || ''
    : '';

  return (
    <aside
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed top-14 right-4 bottom-4 z-20 w-[440px] max-w-[calc(100vw-2rem)] flex flex-col rounded-xl border border-slate-800 bg-[#0a0f1c]/95 shadow-2xl overflow-hidden"
      aria-label={copy.boneHealthTitle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0d1424]">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-wide text-slate-100">
            {copy.boneHealthTitle}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {selectedBone ? (isAr ? selectedBone.nameAr : selectedBone.nameEn) : copy.clickBoneHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.closeDrawer}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-3.5">
        {/* Selected Bone Complete Details & Color Basis */}
        {selectedBone && (
          <div
            data-testid="selected-bone-details-card"
            className="rounded-lg border border-cyan-500/35 bg-[#0d172a] p-3.5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-400">
                  {isAr ? selectedBone.regionAr : selectedBone.regionEn} ·{' '}
                  <span className="font-mono-tech text-slate-300">
                    {isAr ? selectedBone.boneCountLabelAr : selectedBone.boneCountLabelEn}
                  </span>
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {isAr ? selectedBone.nameAr : selectedBone.nameEn}
                </div>
                <div className="text-[10px] font-mono-tech text-cyan-300/90 mt-0.5">
                  ID: {selectedBone.id} · {selectedStatusLabel}
                </div>
              </div>

              {/* Live Calculated Status Color Code Badge */}
              <div
                data-testid="selected-bone-color-code"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border bg-[#070b14] font-mono-tech text-xs font-bold shrink-0"
                style={{ borderColor: `${selectedColor}80`, color: selectedColor }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: selectedColor }}
                  aria-hidden="true"
                />
                <span dir="ltr">{selectedColor.toUpperCase()}</span>
              </div>
            </div>

            {/* Manual Weakness % Input + Slider */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="selected-bone-weakness-input"
                  className="text-xs font-medium text-slate-200"
                >
                  {copy.weaknessLabel} (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="selected-bone-weakness-input"
                    data-testid="selected-bone-weakness-input"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    placeholder="—"
                    value={selectedBone.weaknessPercent ?? ''}
                    onChange={(e) => handleNumericInput(selectedBone.id, e.target.value)}
                    className="w-20 px-2.5 py-1 rounded border border-slate-700 bg-[#060911] font-mono-tech text-xs font-bold text-white text-center focus:outline-none focus:border-cyan-400"
                  />
                  <span className="font-mono-tech text-xs text-slate-400">%</span>
                  <button
                    type="button"
                    onClick={() => onUpdateBoneWeakness(selectedBone.id, null)}
                    data-testid="clear-selected-weakness-btn"
                    className="px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                  >
                    {copy.clearBoneWeakness}
                  </button>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                value={selectedBone.weaknessPercent ?? 0}
                onChange={(e) => onUpdateBoneWeakness(selectedBone.id, Number(e.target.value))}
                aria-label={copy.weaknessLabel}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Color Basis & Quantitative Measurements Grid */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold text-cyan-300">{copy.colorBasisLabel}</div>
              <div className="grid grid-cols-3 gap-1.5 font-mono-tech">
                <div className="rounded border border-slate-800 bg-[#070b14] p-2">
                  <div className="text-[9px] text-slate-400">SOS (QUS)</div>
                  <div dir="ltr" className="text-xs font-bold text-cyan-300 mt-0.5 text-start">
                    {selectedBone.sosMs !== null ? `${selectedBone.sosMs} m/s` : '—'}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#070b14] p-2">
                  <div className="text-[9px] text-slate-400">BUA</div>
                  <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                    {selectedBone.buaDbMhz !== null ? `${selectedBone.buaDbMhz} dB` : '—'}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#070b14] p-2">
                  <div className="text-[9px] text-slate-400">BMD</div>
                  <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                    {selectedBone.bmdGcm2 !== null ? `${selectedBone.bmdGcm2} g/cm²` : '—'}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#070b14] p-2">
                  <div className="text-[9px] text-slate-400">T-Score</div>
                  <div dir="ltr" className="text-xs font-bold text-amber-300 mt-0.5 text-start">
                    {selectedBone.tScore !== null ? selectedBone.tScore : '—'}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#070b14] p-2">
                  <div className="text-[9px] text-slate-400">Z-Score</div>
                  <div dir="ltr" className="text-xs font-bold text-slate-200 mt-0.5 text-start">
                    {selectedBone.zScore !== null ? selectedBone.zScore : '—'}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-[#070b14] p-2">
                  <div className="text-[9px] text-slate-400">{isAr ? 'خطر الكسر' : 'Fracture Risk'}</div>
                  <div className="text-xs font-bold text-rose-300 mt-0.5 truncate">
                    {selectedBone.fractureRisk || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400 pt-0.5">
                <span>
                  {copy.normalQusRefLabel}: <span dir="ltr">{selectedBone.normalSosRange}</span>
                </span>
                {selectedBone.measurementDate && <span>{selectedBone.measurementDate}</span>}
              </div>
            </div>

            {/* Complete Bone Anatomical & Spaceflight Information */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{copy.boneDetailsSection}</span>
              </div>
              <div className="rounded border border-slate-800 bg-[#070b14] p-2.5 space-y-1.5">
                <div>
                  <span className="font-semibold text-slate-300">{copy.anatomyProfileLabel}: </span>
                  <span className="text-slate-300 leading-relaxed">
                    {isAr ? selectedBone.anatomyDetailsAr : selectedBone.anatomyDetailsEn}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-amber-300/90">{copy.microgravityRiskLabel}: </span>
                  <span className="text-slate-300 leading-relaxed">
                    {isAr ? selectedBone.microgravityRiskAr : selectedBone.microgravityRiskEn}
                  </span>
                </div>
              </div>

              {/* Custom Clinical Details / Notes (editable + populated from code slot/dataset) */}
              <div className="space-y-1">
                <label
                  htmlFor="selected-bone-details-input"
                  className="block text-[11px] font-medium text-slate-300"
                >
                  {copy.clinicalNotesLabel}
                </label>
                <textarea
                  id="selected-bone-details-input"
                  data-testid="selected-bone-details-input"
                  rows={2}
                  value={selectedNotes}
                  placeholder={copy.clinicalNotesPlaceholder}
                  onChange={(e) =>
                    onUpdateBoneDetails(
                      selectedBone.id,
                      isAr ? { detailsAr: e.target.value } : { detailsEn: e.target.value },
                    )
                  }
                  className="w-full rounded border border-slate-700 bg-[#060911] px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Attached Sensors & Prescribed Protocol Summary */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{copy.attachedSensorsLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedSensors.map((sensor) => (
                  <span
                    key={sensor.id}
                    title={isAr ? sensor.purposeAr : sensor.purposeEn}
                    className={`px-2 py-0.5 rounded font-mono-tech text-[10px] border ${
                      sensor.type === 'QUS'
                        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {sensor.code} · {isAr ? sensor.zoneAr : sensor.zoneEn}
                  </span>
                ))}
              </div>
              {selectedProtocol && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300 pt-1">
                  <Dumbbell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    <span className="font-semibold text-slate-200">{copy.prescribedProtocolLabel}: </span>
                    {isAr ? selectedProtocol.nameAr : selectedProtocol.nameEn} ({selectedProtocol.sets}×{selectedProtocol.repsPerSet})
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenExercisePage(selectedBone.id)}
              data-testid="open-exercise-page-btn"
              className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-2 transition-colors"
            >
              <span>{copy.goToExerciseBtn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dedicated Color Code Slot ("المكان الذي يوضع فيه كود الألوان") - Immediately Visible */}
        <div
          data-testid="color-code-slot-panel"
          className="rounded-lg border border-slate-700 bg-[#0d1424] p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              <span>{copy.colorCodeSlotTitle}</span>
            </div>
            {(statusColors.healthy !== DEFAULT_STATUS_COLORS.healthy ||
              statusColors.moderate !== DEFAULT_STATUS_COLORS.moderate ||
              statusColors.critical !== DEFAULT_STATUS_COLORS.critical ||
              statusColors.unassessed !== DEFAULT_STATUS_COLORS.unassessed) && (
              <button
                type="button"
                onClick={onResetStatusColors}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{copy.resetColors}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400">{copy.colorCodeSlotDesc}</p>

          <div className="grid grid-cols-2 gap-1.5">
            {colorTierRows.map((tier) => {
              const hex = statusColors[tier.key];
              return (
                <div
                  key={tier.key}
                  className="flex items-center justify-between gap-1.5 rounded border border-slate-800 bg-[#070b14] px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium text-slate-200 truncate">{tier.label}</div>
                    <div dir="ltr" className="font-mono-tech text-[9px] text-slate-400">
                      {tier.range}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="color"
                      value={hex}
                      onChange={(e) => onChangeStatusColor(tier.key, e.target.value)}
                      aria-label={`${tier.label} color code`}
                      data-testid={`color-picker-${tier.key}`}
                      className="w-4 h-4 rounded border border-slate-700 bg-transparent cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={hex.toUpperCase()}
                      maxLength={7}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                          onChangeStatusColor(tier.key, val.toUpperCase());
                        }
                      }}
                      aria-label={`${tier.label} hex code`}
                      className="w-[54px] bg-transparent font-mono-tech text-[10px] font-semibold text-slate-200 focus:outline-none border-b border-slate-700 focus:border-cyan-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-Bone Manual Data-Entry Interface (All 18 Segments) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-100">{copy.manualWeaknessTitle}</h3>
              <p className="text-[11px] text-slate-400">{copy.manualWeaknessHint}</p>
            </div>
            {!hasDataset && (
              <button
                type="button"
                onClick={onLoadSampleDataset}
                className="px-2 py-1 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 shrink-0 transition-colors"
              >
                {copy.loadSampleBtn}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {bones.map((bone) => {
              const active = selectedBone?.id === bone.id;
              const color = resolveBoneColorHex(bone, statusColors);
              return (
                <div
                  key={bone.id}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
                    active
                      ? 'bg-slate-800/90 border-cyan-500/70 text-white'
                      : 'bg-[#0e1526] border-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectBone(bone.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-start"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium truncate">
                      {isAr ? bone.nameAr : bone.nameEn}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="—"
                      aria-label={`${isAr ? bone.nameAr : bone.nameEn} weakness %`}
                      data-testid={`bone-weakness-input-${bone.id}`}
                      value={bone.weaknessPercent ?? ''}
                      onChange={(e) => handleNumericInput(bone.id, e.target.value)}
                      className="w-14 px-1.5 py-1 rounded border border-slate-700 bg-[#060911] font-mono-tech text-[11px] font-semibold text-white text-center focus:outline-none focus:border-cyan-400"
                    />
                    <span className="font-mono-tech text-[10px] text-slate-400">%</span>
                    <span
                      dir="ltr"
                      className="font-mono-tech text-[10px] w-14 text-end"
                      style={{ color }}
                      title={color.toUpperCase()}
                    >
                      {color.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bulk Dataset Import/Edit Shortcut */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenDatasetModal}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copy.openDatasetBtn}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 rounded border border-slate-800 bg-[#070b14] px-2.5 py-1.5 text-[10px] font-mono-tech text-cyan-300/90">
          <Code2 className="w-3.5 h-3.5 shrink-0" />
          <span dir="ltr">{copy.codeSlotBadge}</span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">{copy.datasetUnchangedNote}</p>
      </div>
    </aside>
  );
};
