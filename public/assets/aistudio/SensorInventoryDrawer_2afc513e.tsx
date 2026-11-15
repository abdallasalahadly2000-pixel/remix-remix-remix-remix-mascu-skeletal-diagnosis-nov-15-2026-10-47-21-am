import React from 'react';
import { X, Cpu, Radio } from 'lucide-react';
import {
  BoneSegment,
  EMG_MUSCLE_GROUPS,
  SENSOR_TYPE_META,
  SUIT_SENSORS,
  SensorType,
  getSensorCountsByType,
} from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';

interface SensorInventoryDrawerProps {
  selectedSensorId: string | null;
  sensorFilter: SensorType | 'ALL';
  onFilterChange: (filter: SensorType | 'ALL') => void;
  onSelectSensor: (sensorId: string) => void;
  bones: BoneSegment[];
  onSelectBone: (boneId: string) => void;
  onClose: () => void;
  locale: Locale;
}

export const SensorInventoryDrawer: React.FC<SensorInventoryDrawerProps> = ({
  selectedSensorId,
  sensorFilter,
  onFilterChange,
  onSelectSensor,
  bones,
  onSelectBone,
  onClose,
  locale,
}) => {
  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';
  const counts = getSensorCountsByType(SUIT_SENSORS);

  const qusSensors = SUIT_SENSORS.filter((s) => s.type === 'QUS');
  const selectedSensor = SUIT_SENSORS.find((s) => s.id === selectedSensorId) || null;
  const targetBones = selectedSensor
    ? bones.filter((b) => selectedSensor.targetBoneIds.includes(b.id))
    : [];

  const filterOptions: Array<{ key: SensorType | 'ALL'; label: string; count: number }> = [
    { key: 'ALL', label: isAr ? 'الكل' : 'All', count: counts.total },
    { key: 'QUS', label: isAr ? 'Ultrasound (QUS)' : 'Ultrasound (QUS)', count: counts.QUS },
    { key: 'EMG', label: isAr ? 'قنوات EMG' : 'EMG Channels', count: counts.EMG },
  ];

  return (
    <aside
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed top-14 right-4 bottom-24 z-20 w-[410px] max-w-[calc(100vw-2rem)] flex flex-col rounded-xl border border-slate-800 bg-[#0a0f1c]/95 shadow-2xl overflow-hidden"
      aria-label={copy.sensorsTitle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0d1424]">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-wide text-slate-100">
            {copy.sensorsTitle}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{copy.sensorsSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.closeDrawer}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modality Breakdown (Strictly Ultrasound QUS & EMG only) */}
      <div className="px-4 py-3 border-b border-slate-800 space-y-2.5 bg-[#0b1120]">
        <div className="grid grid-cols-3 gap-2 font-mono-tech text-center">
          <div className="rounded border border-slate-800 bg-[#0f172a] py-1.5 px-1">
            <div className="text-sm font-bold text-cyan-400">{counts.QUS}</div>
            <div className="text-[10px] text-slate-400">Ultrasound QUS</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0f172a] py-1.5 px-1">
            <div className="text-sm font-bold text-purple-400">{counts.EMG}</div>
            <div className="text-[10px] text-slate-400">EMG Channels</div>
          </div>
          <div className="rounded border border-slate-800 bg-[#0f172a] py-1.5 px-1">
            <div className="text-sm font-bold text-slate-100">{counts.EMG_GROUPS} × 2</div>
            <div className="text-[10px] text-slate-400">{isAr ? 'مجموعات عضلية' : 'Muscle Groups'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070b14] border border-slate-800">
          {filterOptions.map((opt) => {
            const active = sensorFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onFilterChange(opt.key)}
                className={`flex-1 py-1.5 px-2 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label} ({opt.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Sensor Detail Card */}
      {selectedSensor && (
        <div className="px-4 py-3 border-b border-slate-800 bg-[#0d172a] space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 shrink-0" style={{ color: SENSOR_TYPE_META[selectedSensor.type].colorHex }} />
            <span className="font-mono-tech text-xs font-bold text-white">{selectedSensor.code}</span>
            <span className="text-xs font-medium text-slate-200 truncate">
              {isAr ? selectedSensor.nameAr : selectedSensor.nameEn}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {isAr ? selectedSensor.purposeAr : selectedSensor.purposeEn}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono-tech">
            <span>
              {copy.zoneLabel}: {isAr ? selectedSensor.zoneAr : selectedSensor.zoneEn}
            </span>
            <span>
              {copy.samplingRate}: {selectedSensor.samplingRateHz} Hz
            </span>
          </div>
          {targetBones.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {targetBones.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => onSelectBone(tb.id)}
                  className="py-1 px-2.5 rounded text-[11px] font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors"
                >
                  {isAr ? tb.nameAr : tb.nameEn} →
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrollable Sensor Inventory */}
      <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-4">
        {/* 11 Muscle Groups x 2 EMG Channels Section */}
        {sensorFilter !== 'QUS' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                {isAr
                  ? 'توزيع حساسات EMG (11 مجموعة عضلية × 2 قناة = 22)'
                  : 'Surface EMG Distribution (11 Muscle Groups × 2 Ch = 22)'}
              </span>
            </div>

            <div className="space-y-1.5">
              {EMG_MUSCLE_GROUPS.map((mg) => {
                const rId = `emg-${mg.key}-r`;
                const lId = `emg-${mg.key}-l`;
                const rActive = selectedSensorId === rId;
                const lActive = selectedSensorId === lId;
                return (
                  <div
                    key={mg.key}
                    className={`rounded-lg border px-2.5 py-2 transition-colors ${
                      rActive || lActive
                        ? 'bg-slate-800/80 border-purple-500/60'
                        : 'bg-[#0d1424] border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          <span className="font-mono-tech text-purple-400 mr-1.5">
                            #{String(mg.index).padStart(2, '0')}
                          </span>
                          {mg.muscleGroup}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                          <span dir="rtl">{mg.nameAr}</span>
                          <span>·</span>
                          <span className="font-mono-tech">{mg.channels} Ch</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-mono-tech">
                        <button
                          type="button"
                          onClick={() => onSelectSensor(rId)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                            rActive
                              ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                              : 'bg-[#080d18] text-slate-300 border-slate-700 hover:border-purple-500/50'
                          }`}
                        >
                          R-Ch
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectSensor(lId)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                            lActive
                              ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                              : 'bg-[#080d18] text-slate-300 border-slate-700 hover:border-purple-500/50'
                          }`}
                        >
                          L-Ch
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 8 Quantitative Ultrasound (QUS) Probes Section */}
        {sensorFilter !== 'EMG' && (
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold text-cyan-300">
              {isAr
                ? 'حساسات الموجات فوق الصوتية (8 Ultrasound QUS Probes)'
                : 'Ultrasound Transducer Probes (8 QUS Sensors)'}
            </div>
            {qusSensors.map((sensor) => {
              const active = selectedSensorId === sensor.id;
              return (
                <button
                  key={sensor.id}
                  type="button"
                  onClick={() => onSelectSensor(sensor.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-start transition-colors ${
                    active
                      ? 'bg-slate-800/90 border-cyan-500/60 text-white'
                      : 'bg-[#0d1424] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        <span className="font-mono-tech text-slate-400 mr-1.5">{sensor.code}</span>
                        {isAr ? sensor.nameAr : sensor.nameEn}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {isAr ? sensor.zoneAr : sensor.zoneEn}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-tech text-[10px] text-slate-400 shrink-0 ml-2">
                    {sensor.samplingRateHz}Hz
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
