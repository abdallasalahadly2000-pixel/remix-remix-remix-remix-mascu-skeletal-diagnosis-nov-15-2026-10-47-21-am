import React from 'react';
import {
  BoneSegment,
  EMG_MUSCLE_GROUPS,
  SENSOR_TYPE_META,
  SUIT_SENSORS,
  SensorType,
  getSensorCountsByType,
} from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';
import { SensorHardwareIcon } from './SensorHardwareIcon';

interface SensorInventoryDrawerProps {
  selectedSensorId: string | null;
  sensorFilter: SensorType | 'ALL';
  onFilterChange: (filter: SensorType | 'ALL') => void;
  onSelectSensor: (sensorId: string) => void;
  bones: BoneSegment[];
  onSelectBone: (boneId: string) => void;
  locale: Locale;
}

export const SensorInventoryDrawer: React.FC<SensorInventoryDrawerProps> = ({
  selectedSensorId,
  sensorFilter,
  onFilterChange,
  onSelectSensor,
  bones,
  onSelectBone,
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
    { key: 'QUS', label: 'Ultrasound QUS', count: counts.QUS },
    { key: 'EMG', label: isAr ? 'قنوات EMG' : 'EMG Ch', count: counts.EMG },
  ];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex-1 flex flex-col min-h-0">
      {/* Modality Breakdown */}
      <div className="px-4 py-3 border-b border-slate-800 space-y-3 bg-[#080c15]">
        <div className="grid grid-cols-3 divide-x divide-slate-800 font-mono-tech text-center">
          <div className="px-1">
            <div className="text-sm font-bold text-cyan-400">{counts.QUS}</div>
            <div className="text-[10px] text-slate-400">Ultrasound QUS</div>
          </div>
          <div className="px-1">
            <div className="text-sm font-bold text-purple-400">{counts.EMG}</div>
            <div className="text-[10px] text-slate-400">EMG Channels</div>
          </div>
          <div className="px-1">
            <div className="text-sm font-bold text-slate-100">{counts.EMG_GROUPS} × 2</div>
            <div className="text-[10px] text-slate-400">{isAr ? 'مجموعات عضلية' : 'Muscle Groups'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0b101b] border border-slate-800">
          {filterOptions.map((opt) => {
            const active = sensorFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onFilterChange(opt.key)}
                className={`flex-1 py-1.5 px-2 rounded text-[11px] font-medium whitespace-nowrap ui-transition cursor-pointer ${
                  active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label} ({opt.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Sensor Detail */}
      {selectedSensor && (
        <div className="px-4 py-3 border-b border-slate-800 bg-[#0d172a] space-y-2">
          <div className="flex items-center gap-2">
            <span style={{ color: SENSOR_TYPE_META[selectedSensor.type].colorHex }} className="shrink-0">
              <SensorHardwareIcon type={selectedSensor.type} className="w-4 h-4" />
            </span>
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
                  className="py-1 px-2.5 rounded text-[11px] font-medium bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 ui-transition cursor-pointer"
                >
                  {isAr ? tb.nameAr : tb.nameEn} →
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scrollable Sensor Inventory */}
      <div className="flex-1 overflow-y-auto thin-scroll p-3.5 space-y-4">
        {sensorFilter !== 'QUS' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                <SensorHardwareIcon type="EMG" className="w-3.5 h-3.5 shrink-0" />
                {isAr
                  ? 'توزيع حساسات EMG (11 مجموعة عضلية × 2 قناة = 22)'
                  : 'Surface EMG Distribution (11 Muscle Groups × 2 Ch = 22)'}
              </span>
            </div>

            <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-lg bg-[#070a12]">
              {EMG_MUSCLE_GROUPS.map((mg) => {
                const rId = `emg-${mg.key}-r`;
                const lId = `emg-${mg.key}-l`;
                const rActive = selectedSensorId === rId;
                const lActive = selectedSensorId === lId;
                return (
                  <div
                    key={mg.key}
                    className={`px-3 py-2 ui-transition ${
                      rActive || lActive ? 'bg-purple-500/10' : ''
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
                          className={`px-2 py-1 rounded text-[10px] font-semibold border ui-transition cursor-pointer ${
                            rActive
                              ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                              : 'bg-[#0b101b] text-slate-300 border-slate-700 hover:border-purple-500/50'
                          }`}
                        >
                          R-Ch
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectSensor(lId)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold border ui-transition cursor-pointer ${
                            lActive
                              ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                              : 'bg-[#0b101b] text-slate-300 border-slate-700 hover:border-purple-500/50'
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

        {sensorFilter !== 'EMG' && (
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
              <SensorHardwareIcon type="QUS" className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isAr
                  ? 'حساسات الموجات فوق الصوتية (8 Ultrasound QUS Probes)'
                  : 'Ultrasound Transducer Probes (8 QUS Sensors)'}
              </span>
            </div>
            <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-lg bg-[#070a12]">
              {qusSensors.map((sensor) => {
                const active = selectedSensorId === sensor.id;
                return (
                  <button
                    key={sensor.id}
                    type="button"
                    onClick={() => onSelectSensor(sensor.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-start ui-transition cursor-pointer ${
                      active ? 'bg-cyan-500/12 text-white' : 'text-slate-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        <span className="font-mono-tech text-cyan-400 mr-1.5">{sensor.code}</span>
                        {isAr ? sensor.nameAr : sensor.nameEn}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {isAr ? sensor.zoneAr : sensor.zoneEn}
                      </div>
                    </div>
                    <span className="font-mono-tech text-[10px] text-slate-400 shrink-0 ml-2">
                      {sensor.samplingRateHz} Hz
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
