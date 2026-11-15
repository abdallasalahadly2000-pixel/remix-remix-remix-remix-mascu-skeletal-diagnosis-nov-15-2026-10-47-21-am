import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Palette,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  BoneDatasetEntry,
  BoneSegment,
  DEFAULT_STATUS_COLORS,
  SUIT_SENSORS,
  StatusColorPalette,
  resolveBoneColorHex,
} from '../domain/osteosense';
import { deriveSeverityFromBone, getNasaBoneProfile } from '../domain/nasaBoneDatabase';
import { Locale, UI_COPY } from '../i18n/translations';
import { SensorHardwareIcon } from './SensorHardwareIcon';

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
  onOpenTreatmentForBone: (boneId: string) => void;
  onOpenDatasetModal: () => void;
  onLoadSampleDataset: () => void;
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
  onOpenTreatmentForBone,
  onOpenDatasetModal,
  onLoadSampleDataset,
  locale,
}) => {
  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';
  const [boneFilter, setBoneFilter] = useState('');
  const [showQuantitativeData, setShowQuantitativeData] = useState(false);
  const [showColorCalibration, setShowColorCalibration] = useState(false);

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
  const selectedSensors = selectedBone
    ? selectedBone.sensorIds
        .map((sid) => SUIT_SENSORS.find((s) => s.id === sid))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
    : [];
  const nasaProfile = selectedBone ? getNasaBoneProfile(selectedBone.id) : null;
  const boneSeverity = selectedBone ? deriveSeverityFromBone(selectedBone) : 'L1';

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

  const filteredBones = bones.filter((b) => {
    if (!boneFilter.trim()) return true;
    const q = boneFilter.trim().toLowerCase();
    return (
      b.nameEn.toLowerCase().includes(q) ||
      b.nameAr.includes(boneFilter.trim()) ||
      b.regionEn.toLowerCase().includes(q)
    );
  });

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex-1 overflow-y-auto thin-scroll divide-y divide-slate-800">
      {/* Selected Bone Friendly Overview */}
      {selectedBone && (
        <div data-testid="selected-bone-details-card" className="p-4 space-y-3.5 bg-[#0b1120]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-400">
                {isAr ? selectedBone.regionAr : selectedBone.regionEn} ·{' '}
                <span>{isAr ? selectedBone.boneCountLabelAr : selectedBone.boneCountLabelEn}</span>
              </div>
              <div className="text-base font-bold text-white mt-0.5">
                {isAr ? selectedBone.nameAr : selectedBone.nameEn}
              </div>
              <div className="text-xs font-medium mt-0.5" style={{ color: selectedColor }}>
                {selectedStatusLabel}
              </div>
            </div>

            <div
              data-testid="selected-bone-color-code"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border bg-[#070a12] font-mono-tech text-xs font-bold shrink-0"
              style={{ borderColor: `${selectedColor}75`, color: selectedColor }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: selectedColor }}
                aria-hidden="true"
              />
              <span dir="ltr">{selectedColor.toUpperCase()}</span>
            </div>
          </div>

          {/* Weakness % Input + Slider */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="selected-bone-weakness-input" className="text-xs font-medium text-slate-200">
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
                  className="w-16 px-2 py-1 rounded border border-slate-700 bg-[#070a12] font-mono-tech text-xs font-bold text-white text-center focus:outline-none focus:border-cyan-400"
                />
                <span className="font-mono-tech text-xs text-slate-400">%</span>
                <button
                  type="button"
                  onClick={() => onUpdateBoneWeakness(selectedBone.id, null)}
                  className="px-2 py-1 rounded text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 ui-transition cursor-pointer"
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

          {/* Anatomy & Microgravity Summary */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-slate-100">
              <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{copy.boneDetailsSection}</span>
            </div>
            <div className="space-y-1.5 text-slate-300 leading-relaxed">
              <p>
                <span className="font-semibold text-slate-200">{copy.anatomyProfileLabel}: </span>
                {isAr ? selectedBone.anatomyDetailsAr : selectedBone.anatomyDetailsEn}
              </p>
              <p>
                <span className="font-semibold text-amber-300">{copy.microgravityRiskLabel}: </span>
                {isAr ? selectedBone.microgravityRiskAr : selectedBone.microgravityRiskEn}
              </p>
            </div>

            {nasaProfile && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 font-mono-tech">
                <div>
                  <div className="text-[10px] text-slate-400">
                    {isAr ? 'فقدان الفضاء' : 'NASA Loss/Mo'}
                  </div>
                  <div dir="ltr" className="text-[11px] font-bold text-amber-300 text-start">
                    {nasaProfile.bmdLossPreAredPctPerMonth > 0 ? '+' : ''}
                    {nasaProfile.bmdLossPreAredPctPerMonth}%
                    <span className="text-[10px] font-normal text-slate-400"> → {nasaProfile.bmdLossWithAredPctPerMonth}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">
                    {isAr ? 'عظم إسفنجي' : 'Trabecular'}
                  </div>
                  <div dir="ltr" className="text-[11px] font-bold text-cyan-300 text-start">
                    {nasaProfile.trabecularPct}% / {nasaProfile.corticalPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">
                    {isAr ? 'التصنيف' : 'Severity Tier'}
                  </div>
                  <div dir="ltr" className="text-[11px] font-bold text-slate-100 text-start">
                    {boneSeverity}
                  </div>
                </div>
              </div>
            )}

          </div>

          <button
            type="button"
            onClick={() => onOpenTreatmentForBone(selectedBone.id)}
            data-testid="open-exercise-page-btn"
            className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 flex items-center justify-center gap-2 ui-transition cursor-pointer"
          >
            <span>{copy.goToExerciseBtn}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Sectioned Off Quantitative Scan Telemetry & Clinical Notes */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowQuantitativeData((v) => !v)}
              className="w-full flex items-center justify-between gap-2 py-1 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              <span>{isAr ? 'بيانات الفحص الكمية والحساسات' : 'Quantitative Scan Telemetry & Notes'}</span>
              {showQuantitativeData ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showQuantitativeData && (
              <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-3">
                <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 font-mono-tech">
                  <div>
                    <div className="text-[10px] text-slate-400">SOS (QUS)</div>
                    <div dir="ltr" className="text-xs font-bold text-cyan-300 mt-0.5 text-start">
                      {selectedBone.sosMs !== null ? `${selectedBone.sosMs} m/s` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">BUA</div>
                    <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                      {selectedBone.buaDbMhz !== null ? `${selectedBone.buaDbMhz} dB` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">BMD</div>
                    <div dir="ltr" className="text-xs font-bold text-slate-100 mt-0.5 text-start">
                      {selectedBone.bmdGcm2 !== null ? `${selectedBone.bmdGcm2} g/cm²` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">T-Score</div>
                    <div dir="ltr" className="text-xs font-bold text-amber-300 mt-0.5 text-start">
                      {selectedBone.tScore !== null ? selectedBone.tScore : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Z-Score</div>
                    <div dir="ltr" className="text-xs font-bold text-slate-200 mt-0.5 text-start">
                      {selectedBone.zScore !== null ? selectedBone.zScore : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">{isAr ? 'خطر الكسر' : 'Fracture Risk'}</div>
                    <div className="text-xs font-bold text-rose-300 mt-0.5 truncate">
                      {selectedBone.fractureRisk || '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono-tech text-slate-400">
                  <span>
                    {copy.normalQusRefLabel}: <span dir="ltr">{selectedBone.normalSosRange}</span>
                  </span>
                  {selectedBone.measurementDate && <span>{selectedBone.measurementDate}</span>}
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{copy.attachedSensorsLabel}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono-tech text-[10px] text-slate-300">
                    {selectedSensors.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1">
                        <span className={s.type === 'QUS' ? 'text-cyan-400' : 'text-purple-400'}>
                          <SensorHardwareIcon type={s.type} className="w-3 h-3" />
                        </span>
                        <span>{s.code}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="selected-bone-details-input" className="block text-[11px] font-medium text-slate-300">
                    {copy.clinicalNotesLabel}
                  </label>
                  <textarea
                    id="selected-bone-details-input"
                    rows={2}
                    value={selectedNotes}
                    placeholder={copy.clinicalNotesPlaceholder}
                    onChange={(e) =>
                      onUpdateBoneDetails(
                        selectedBone.id,
                        isAr ? { detailsAr: e.target.value } : { detailsEn: e.target.value },
                      )
                    }
                    className="w-full rounded-lg border border-slate-700 bg-[#070a12] px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Color Threshold Calibration */}
      <div className="p-3.5 bg-[#080c15]">
        <button
          type="button"
          onClick={() => setShowColorCalibration((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copy.colorCodeSlotTitle}</span>
          </span>
          {showColorCalibration ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {showColorCalibration && (
          <div className="mt-3 space-y-2.5">
            {(statusColors.healthy !== DEFAULT_STATUS_COLORS.healthy ||
              statusColors.moderate !== DEFAULT_STATUS_COLORS.moderate ||
              statusColors.critical !== DEFAULT_STATUS_COLORS.critical ||
              statusColors.unassessed !== DEFAULT_STATUS_COLORS.unassessed) && (
              <button
                type="button"
                onClick={onResetStatusColors}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{copy.resetColors}</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {colorTierRows.map((tier) => {
                const hex = statusColors[tier.key];
                return (
                  <div
                    key={tier.key}
                    className="flex items-center justify-between gap-1.5 rounded border border-slate-800 bg-[#0b101b] px-2 py-1.5"
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
                        aria-label={`${tier.label} color`}
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
                        aria-label={`${tier.label} hex`}
                        className="w-[54px] bg-transparent font-mono-tech text-[10px] font-semibold text-slate-200 focus:outline-none border-b border-slate-700 focus:border-cyan-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* All 18 Bones Clean List */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-100">{copy.manualWeaknessTitle}</h3>
            <p className="text-[11px] text-slate-400">{copy.manualWeaknessHint}</p>
          </div>
          {!hasDataset && (
            <button
              type="button"
              onClick={onLoadSampleDataset}
              className="px-2.5 py-1 rounded text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 shrink-0 ui-transition cursor-pointer"
            >
              {copy.loadSampleBtn}
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={boneFilter}
            onChange={(e) => setBoneFilter(e.target.value)}
            placeholder={isAr ? 'تصفية العظام (18)...' : 'Filter 18 anatomical bones...'}
            className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-800 bg-[#070a12] text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-lg bg-[#070a12]">
          {filteredBones.map((bone) => {
            const active = selectedBone?.id === bone.id;
            const color = resolveBoneColorHex(bone, statusColors);
            return (
              <div
                key={bone.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ui-transition ${
                  active ? 'bg-cyan-500/10 text-white' : 'text-slate-300 hover:bg-white/[0.02]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectBone(bone.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-start cursor-pointer"
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
                    value={bone.weaknessPercent ?? ''}
                    onChange={(e) => handleNumericInput(bone.id, e.target.value)}
                    className="w-12 px-1 py-0.5 rounded border border-slate-700 bg-[#0b101b] font-mono-tech text-[11px] font-semibold text-white text-center focus:outline-none focus:border-cyan-400"
                  />
                  <span className="font-mono-tech text-[10px] text-slate-400">%</span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenDatasetModal}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#0b101b] hover:border-cyan-400/50 text-slate-200 border border-slate-700 ui-transition cursor-pointer"
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>{copy.openDatasetBtn}</span>
        </button>

        <p className="text-[11px] text-slate-500 leading-relaxed">{copy.datasetUnchangedNote}</p>
      </div>
    </div>
  );
};
