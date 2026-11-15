import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  Globe,
  ScanLine,
} from 'lucide-react';
import {
  BoneDatasetEntry,
  SAMPLE_DATASET,
  SUIT_SENSORS,
  SensorType,
  StatusColorPalette,
  SuitLayerMode,
  applyDatasetToBones,
  getSensorCountsByType,
  resolveBoneColorHex,
  upsertBoneDetailsEntry,
  upsertBoneWeaknessEntry,
} from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';
import { CAMERA_PRESETS, CameraPresetKey, HoverPayload, SuitHardwareScene } from '../three/SuitHardwareScene';
import { RouteId } from '../types/app';
import { BoneInspectorDrawer } from './BoneInspectorDrawer';
import { DatasetModal } from './DatasetModal';
import { SensorInventoryDrawer } from './SensorInventoryDrawer';

interface MySkeletonViewProps {
  datasetEntries: BoneDatasetEntry[];
  onChangeDatasetEntries: React.Dispatch<React.SetStateAction<BoneDatasetEntry[]>>;
  selectedBoneId?: string;
  onSelectBoneId?: (boneId: string) => void;
  statusColors: StatusColorPalette;
  onChangeStatusColor: (tier: keyof StatusColorPalette, hex: string) => void;
  onResetStatusColors: () => void;
  onOpenTreatmentForBone?: (boneId: string) => void;
  onNavigate: (route: RouteId) => void;
}

export const MySkeletonView: React.FC<MySkeletonViewProps> = ({
  datasetEntries,
  onChangeDatasetEntries,
  selectedBoneId: controlledBoneId,
  onSelectBoneId,
  statusColors,
  onChangeStatusColor,
  onResetStatusColors,
  onOpenTreatmentForBone,
  onNavigate,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SuitHardwareScene | null>(null);

  const [locale, setLocale] = useState<Locale>('en');
  const [layerMode, setLayerMode] = useState<SuitLayerMode>('xray');
  const [camPreset, setCamPreset] = useState<CameraPresetKey>('full');
  const [sensorFilter, setSensorFilter] = useState<SensorType | 'ALL'>('ALL');
  const [inspectorTab, setInspectorTab] = useState<'bones' | 'sensors'>('bones');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);

  const [localBoneId, setLocalBoneId] = useState<string>('femur-right');
  const selectedBoneId = controlledBoneId ?? localBoneId;
  const setSelectedBoneId = useCallback(
    (boneId: string) => {
      setLocalBoneId(boneId);
      onSelectBoneId?.(boneId);
    },
    [onSelectBoneId],
  );

  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<HoverPayload | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';
  const bones = useMemo(() => applyDatasetToBones(datasetEntries), [datasetEntries]);
  const hasDataset = datasetEntries.length > 0;
  const sensorCounts = useMemo(() => getSensorCountsByType(SUIT_SENSORS), []);

  const bonesRef = useRef(bones);
  bonesRef.current = bones;

  const boneSummaryCounts = useMemo(() => {
    let healthy = 0;
    let moderate = 0;
    let critical = 0;
    let unassessed = 0;
    bones.forEach((b) => {
      if (b.status === 'healthy') healthy += 1;
      else if (b.status === 'moderate') moderate += 1;
      else if (b.status === 'critical') critical += 1;
      else unassessed += 1;
    });
    return { healthy, moderate, critical, unassessed };
  }, [bones]);

  const damagedCount = boneSummaryCounts.moderate + boneSummaryCounts.critical;

  const selectedBone = useMemo(
    () => bones.find((b) => b.id === selectedBoneId) || bones[0] || null,
    [bones, selectedBoneId],
  );

  const handleSelectBoneFromList = useCallback(
    (boneId: string) => {
      const bone = bonesRef.current.find((b) => b.id === boneId);
      if (!bone) return;
      setSelectedBoneId(boneId);
      setSelectedSensorId(null);
      setInspectorTab('bones');
      setLayerMode((prev) => (prev === 'full' ? 'xray' : prev));
      sceneRef.current?.setSelection(boneId, null);
      sceneRef.current?.focusOnPoint(bone.focusTarget);
    },
    [setSelectedBoneId],
  );

  const handleSelectSensor = useCallback((sensorId: string) => {
    const sensor = SUIT_SENSORS.find((s) => s.id === sensorId);
    if (!sensor) return;
    setSelectedSensorId(sensorId);
    setInspectorTab('sensors');
    sceneRef.current?.setSelection(null, sensorId);
    const offsetZ = sensor.normal[2] < -0.2 ? -1.15 : 1.15;
    const offsetX = sensor.normal[0] * 0.45 + 0.15;
    sceneRef.current?.focusOnPoint(sensor.position, [offsetX, 0.12, offsetZ]);
  }, []);

  const callbacksRef = useRef({
    onSelectBone: handleSelectBoneFromList,
    onSelectSensor: handleSelectSensor,
    onHoverItem: setHoveredItem,
  });
  callbacksRef.current = {
    onSelectBone: handleSelectBoneFromList,
    onSelectSensor: handleSelectSensor,
    onHoverItem: setHoveredItem,
  };

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const scene = new SuitHardwareScene(mountEl, bonesRef.current, {
      onSelectBone: (id) => callbacksRef.current.onSelectBone(id),
      onSelectSensor: (id) => callbacksRef.current.onSelectSensor(id),
      onHoverItem: (item) => callbacksRef.current.onHoverItem(item),
    });
    scene.setLayerMode(layerMode);
    scene.setSensorFilter(sensorFilter);
    scene.setSelection(selectedBoneId, selectedSensorId);
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setLayerMode(layerMode);
  }, [layerMode]);

  useEffect(() => {
    sceneRef.current?.updateBones(bones, statusColors);
  }, [bones, statusColors]);

  useEffect(() => {
    sceneRef.current?.setSensorFilter(sensorFilter);
  }, [sensorFilter]);

  useEffect(() => {
    sceneRef.current?.setSelection(selectedBoneId, selectedSensorId);
  }, [selectedBoneId, selectedSensorId]);

  const handleRunScan = () => {
    setIsScanning(true);
    sceneRef.current?.triggerQusScan();
    window.setTimeout(() => setIsScanning(false), 2200);
  };

  const handleApplyDataset = (entries: BoneDatasetEntry[]) => {
    onChangeDatasetEntries(entries);
    if (entries.length > 0) {
      setLayerMode('xray');
      setInspectorTab('bones');
    }
  };

  const handleUpdateWeakness = useCallback(
    (boneId: string, weaknessPercent: number | null) => {
      onChangeDatasetEntries((prev) => upsertBoneWeaknessEntry(prev, boneId, weaknessPercent));
      setSelectedBoneId(boneId);
    },
    [onChangeDatasetEntries, setSelectedBoneId],
  );

  const handleUpdateDetails = useCallback(
    (boneId: string, patch: Partial<Omit<BoneDatasetEntry, 'boneId'>>) => {
      onChangeDatasetEntries((prev) => upsertBoneDetailsEntry(prev, boneId, patch));
    },
    [onChangeDatasetEntries],
  );

  const handleOpenTreatmentForBone = useCallback(
    (boneId: string) => {
      if (onOpenTreatmentForBone) {
        onOpenTreatmentForBone(boneId);
      } else {
        onNavigate('coach');
      }
    },
    [onNavigate, onOpenTreatmentForBone],
  );

  const hoveredLabel = useMemo(() => {
    if (!hoveredItem) return null;
    if (hoveredItem.kind === 'sensor') {
      const s = SUIT_SENSORS.find((x) => x.id === hoveredItem.id);
      return s ? `${s.code} · ${isAr ? s.nameAr : s.nameEn}` : hoveredItem.id;
    }
    const b = bones.find((x) => x.id === hoveredItem.id);
    if (!b) return hoveredItem.id;
    const w = b.weaknessPercent !== null ? `${b.weaknessPercent}%` : copy.unassessed;
    return `${isAr ? b.nameAr : b.nameEn} · ${w}`;
  }, [hoveredItem, bones, isAr, copy.unassessed]);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1440px] mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 overflow-hidden"
    >
      {/* Workbench Header */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-white tracking-tight">
            {isAr ? 'الهيكل العظمي ثلاثي الأبعاد — تشخيص الأضرار' : 'My Skeleton — Damage & Telemetry'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'تمثيل الأضرار على الهيكل العظمي (18 منطقة · 30 حساساً) متزامن مباشرة مع العلاج الطبيعي'
              : 'Skeletal damage representation (18 bones · 30 sensors) synced live with Physical Treatment'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDatasetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-[#080c15] hover:border-slate-500 text-slate-200 text-xs font-medium whitespace-nowrap cursor-pointer ui-transition"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copy.navDataset}</span>
          </button>

          <button
            type="button"
            onClick={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-[#080c15] hover:border-slate-500 text-slate-200 text-xs font-medium whitespace-nowrap cursor-pointer ui-transition"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{locale === 'en' ? 'العربية' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={handleRunScan}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] disabled:opacity-65 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer ui-transition"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>{isScanning ? copy.scanning : copy.runScan}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTreatmentForBone(selectedBoneId)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/45 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold whitespace-nowrap cursor-pointer ui-transition"
          >
            <span>
              {isAr
                ? `العلاج الطبيعي${damagedCount > 0 ? ` (${damagedCount})` : ''}`
                : `Physical Treatment${damagedCount > 0 ? ` (${damagedCount} flagged)` : ''}`}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split: 3D Viewport + Tabbed Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_420px] items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* 3D WebGL Viewport (Strictly NO backdrop-blur over WebGL) */}
        <div className="relative min-h-[540px] h-[660px] bg-[#060911] overflow-hidden">
          <div ref={mountRef} className="absolute inset-0 w-full h-full" />

          {/* Compact Telemetry HUD */}
          <div className="absolute top-3.5 left-3.5 z-10 max-w-[300px] rounded-lg border border-slate-800 bg-[#080c15]/92 px-3.5 py-2.5">
            <p className="font-mono-tech text-[11px] font-semibold text-cyan-400">
              {sensorCounts.total} Sensors · {sensorCounts.QUS} QUS · {sensorCounts.EMG} EMG
            </p>
            {!hasDataset ? (
              <>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{copy.datasetEmptyNotice}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => onChangeDatasetEntries(SAMPLE_DATASET)}
                    className="px-2.5 py-1 rounded border border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-[11px] font-semibold cursor-pointer ui-transition"
                  >
                    {copy.loadSampleBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatasetModalOpen(true)}
                    className="px-2.5 py-1 rounded border border-slate-700 bg-[#0b101b] hover:border-slate-500 text-slate-200 text-[11px] font-medium cursor-pointer ui-transition"
                  >
                    {copy.openDatasetBtn}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-300 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-tech">
                <span style={{ color: resolveBoneColorHex({ status: 'healthy', colorHexOverride: null }, statusColors) }}>
                  ● Healthy ({boneSummaryCounts.healthy})
                </span>
                <span style={{ color: resolveBoneColorHex({ status: 'moderate', colorHexOverride: null }, statusColors) }}>
                  ▲ Moderate ({boneSummaryCounts.moderate})
                </span>
                <span style={{ color: resolveBoneColorHex({ status: 'critical', colorHexOverride: null }, statusColors) }}>
                  ✖ Critical ({boneSummaryCounts.critical})
                </span>
              </p>
            )}
          </div>

          {/* Hover Tooltip */}
          {hoveredItem && hoveredLabel && (
            <div
              className="absolute z-10 pointer-events-none px-2.5 py-1.5 rounded border border-cyan-500/45 bg-[#060911]/95 font-mono-tech text-[11px] text-white whitespace-nowrap"
              style={{ left: hoveredItem.x, top: hoveredItem.y }}
            >
              {hoveredLabel}
            </div>
          )}

          {/* Collapsible Bottom Control Dock */}
          <div className="absolute left-3 right-3 bottom-3 z-10 flex flex-col items-center pointer-events-none">
            <button
              type="button"
              onClick={() => setDockCollapsed((c) => !c)}
              className="pointer-events-auto inline-flex items-center gap-1 px-3 py-1 rounded-t-md border border-b-0 border-slate-800 bg-[#080c15]/95 text-[11px] text-slate-300 hover:text-white cursor-pointer"
            >
              {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{dockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
            </button>

            {!dockCollapsed && (
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#080c15]/95">
                {(['full', 'xray', 'exploded'] as SuitLayerMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLayerMode(mode)}
                    className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap cursor-pointer ui-transition ${
                      layerMode === mode
                        ? 'bg-cyan-500/18 text-cyan-300 border border-cyan-500/50'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {mode === 'full' ? 'Full Suit' : mode === 'xray' ? 'X-Ray Skeleton' : 'Exploded View'}
                  </button>
                ))}

                <span className="w-px h-4 bg-slate-800 mx-1" aria-hidden="true" />

                {(Object.keys(CAMERA_PRESETS) as CameraPresetKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCamPreset(key);
                      sceneRef.current?.setPreset(key);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap cursor-pointer ui-transition ${
                      camPreset === key
                        ? 'bg-cyan-500/18 text-cyan-300 border border-cyan-500/50'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {isAr ? CAMERA_PRESETS[key].labelAr : CAMERA_PRESETS[key].labelEn}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Integrated Tabbed Drawer */}
        <aside
          aria-label="Anatomical Skeleton and Sensor Inspector"
          className="bg-[#0b101b] flex flex-col h-[660px] overflow-hidden"
        >
          <div className="flex border-b border-slate-800 bg-[#080c15]">
            <button
              type="button"
              onClick={() => setInspectorTab('bones')}
              className={`flex-1 py-3 px-3 text-xs font-semibold border-b-2 ui-transition cursor-pointer whitespace-nowrap ${
                inspectorTab === 'bones'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/8'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAr ? 'أضرار العظام (18)' : 'Bone Damage (18)'}
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab('sensors')}
              className={`flex-1 py-3 px-3 text-xs font-semibold border-b-2 ui-transition cursor-pointer whitespace-nowrap ${
                inspectorTab === 'sensors'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/8'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAr ? 'الحساسات QUS + EMG (30)' : 'QUS + EMG Sensors (30)'}
            </button>
          </div>

          {inspectorTab === 'bones' ? (
            <BoneInspectorDrawer
              bones={bones}
              selectedBone={selectedBone}
              hasDataset={hasDataset}
              statusColors={statusColors}
              onChangeStatusColor={onChangeStatusColor}
              onResetStatusColors={onResetStatusColors}
              onSelectBone={handleSelectBoneFromList}
              onUpdateBoneWeakness={handleUpdateWeakness}
              onUpdateBoneDetails={handleUpdateDetails}
              onOpenTreatmentForBone={handleOpenTreatmentForBone}
              onOpenDatasetModal={() => setDatasetModalOpen(true)}
              onLoadSampleDataset={() => onChangeDatasetEntries(SAMPLE_DATASET)}
              locale={locale}
            />
          ) : (
            <SensorInventoryDrawer
              selectedSensorId={selectedSensorId}
              sensorFilter={sensorFilter}
              onFilterChange={setSensorFilter}
              onSelectSensor={handleSelectSensor}
              bones={bones}
              onSelectBone={handleSelectBoneFromList}
              locale={locale}
            />
          )}
        </aside>
      </div>

      {datasetModalOpen && (
        <DatasetModal
          currentDataset={datasetEntries}
          onApplyDataset={handleApplyDataset}
          onClose={() => setDatasetModalOpen(false)}
          locale={locale}
        />
      )}
    </div>
  );
};
