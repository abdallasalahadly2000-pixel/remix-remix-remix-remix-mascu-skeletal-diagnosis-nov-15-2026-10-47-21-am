import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Globe, Database } from 'lucide-react';
import {
  BoneDatasetEntry,
  BoneSegment,
  DEFAULT_STATUS_COLORS,
  EmgEvaluationResult,
  ExerciseRecommendation,
  FormQuality,
  SAMPLE_DATASET,
  SUIT_SENSORS,
  SensorType,
  StatusColorPalette,
  SuitLayerMode,
  applyDatasetToBones,
  buildFallbackRecommendation,
  buildSimulatedEmgAttempt,
  evaluateEmgSession,
  getSensorCountsByType,
  resolveBoneColorHex,
  upsertBoneDetailsEntry,
  upsertBoneWeaknessEntry,
} from './domain/osteosense';
import { USER_BONE_DATA_SLOT, USER_STATUS_COLOR_CODE_SLOT } from './data/boneInputSlot';
import { Locale, UI_COPY } from './i18n/translations';
import { SuitHardwareScene } from './three/SuitHardwareScene';
import { BoneInspectorDrawer } from './components/BoneInspectorDrawer';
import { SensorInventoryDrawer } from './components/SensorInventoryDrawer';
import { DatasetModal } from './components/DatasetModal';
import { ExercisePage } from './components/ExercisePage';

type DrawerTab = 'none' | 'sensors' | 'bones';
type AppPage = 'skeleton' | 'exercise';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SuitHardwareScene | null>(null);

  const [locale, setLocale] = useState<Locale>('en');
  const [activePage, setActivePage] = useState<AppPage>('skeleton');

  // Empty code slot (src/data/boneInputSlot.ts) by default so user can insert data in code or UI
  const [datasetEntries, setDatasetEntries] = useState<BoneDatasetEntry[]>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sample') === '1') {
      return SAMPLE_DATASET;
    }
    return USER_BONE_DATA_SLOT;
  });
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);
  const [statusColors, setStatusColors] = useState<StatusColorPalette>(() => ({
    ...DEFAULT_STATUS_COLORS,
    ...USER_STATUS_COLOR_CODE_SLOT,
  }));

  const bones = useMemo(() => applyDatasetToBones(datasetEntries), [datasetEntries]);
  const hasDataset = datasetEntries.length > 0;

  const [layerMode, setLayerMode] = useState<SuitLayerMode>('xray');
  const [sensorFilter, setSensorFilter] = useState<SensorType | 'ALL'>('ALL');

  const [drawerTab, setDrawerTab] = useState<DrawerTab>('none');
  const [selectedBoneId, setSelectedBoneId] = useState<string | null>(null);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{
    kind: 'bone' | 'sensor';
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);

  // Separate Exercise & EMG Re-Inspection Page State
  const [recommendation, setRecommendation] = useState<ExerciseRecommendation | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [formQuality, setFormQuality] = useState<FormQuality>('optimal');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(0);
  const [evaluation, setEvaluation] = useState<EmgEvaluationResult | null>(null);

  const copy = UI_COPY[locale];
  const isAr = locale === 'ar';
  const sensorCounts = useMemo(() => getSensorCountsByType(SUIT_SENSORS), []);

  const selectedBone = useMemo(
    () => bones.find((b) => b.id === selectedBoneId) || null,
    [bones, selectedBoneId],
  );

  const bonesRef = useRef(bones);
  bonesRef.current = bones;

  const fetchRecommendation = useCallback(async (bone: BoneSegment) => {
    setRecommendation(buildFallbackRecommendation(bone, 74));
    setEvaluation(null);
    setIsVideoPlaying(true);
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4500);
      const res = await fetch('/api/recommend-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bone, astronautWeightKg: 74 }),
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (!res.ok) return;
      const data = (await res.json()) as ExerciseRecommendation;
      setRecommendation(data);
    } catch {
      // Optimistic protocol recommendation already active
    }
  }, []);

  const openExercisePageForBone = useCallback(
    (boneId: string) => {
      const bone = bonesRef.current.find((b) => b.id === boneId);
      if (!bone) return;
      setSelectedBoneId(boneId);
      setSelectedSensorId(null);
      setActivePage('exercise');
      void fetchRecommendation(bone);
    },
    [fetchRecommendation],
  );

  const handleSelectBoneFromList = useCallback((boneId: string) => {
    const bone = bonesRef.current.find((b) => b.id === boneId);
    if (!bone) return;
    setSelectedBoneId(boneId);
    setSelectedSensorId(null);
    setDrawerTab('bones');
    setLayerMode((prev) => (prev === 'full' ? 'xray' : prev));
    sceneRef.current?.setSelection(boneId, null);
    sceneRef.current?.setDrawerOpen(true);
    sceneRef.current?.focusOnPoint(bone.focusTarget);
  }, []);

  const handleClickBoneIn3D = useCallback(
    (boneId: string) => {
      const bone = bonesRef.current.find((b) => b.id === boneId);
      if (!bone) return;
      // Clicking a damaged (moderate/critical) bone navigates straight to its Exercise & EMG page
      if (bone.status === 'moderate' || bone.status === 'critical') {
        openExercisePageForBone(boneId);
      } else {
        handleSelectBoneFromList(boneId);
      }
    },
    [openExercisePageForBone, handleSelectBoneFromList],
  );

  const handleSelectSensor = useCallback((sensorId: string) => {
    const sensor = SUIT_SENSORS.find((s) => s.id === sensorId);
    if (!sensor) return;
    setSelectedSensorId(sensorId);
    setSelectedBoneId(null);
    setDrawerTab('sensors');
    sceneRef.current?.setSelection(null, sensorId);
    sceneRef.current?.setDrawerOpen(true);
    const offsetZ = sensor.normal[2] < -0.2 ? -1.15 : 1.15;
    const offsetX = sensor.normal[0] * 0.45 + 0.15;
    sceneRef.current?.focusOnPoint(sensor.position, [offsetX, 0.12, offsetZ]);
  }, []);

  const callbacksRef = useRef({
    onSelectBone: handleClickBoneIn3D,
    onSelectSensor: handleSelectSensor,
    onHoverItem: setHoveredItem,
  });
  callbacksRef.current = {
    onSelectBone: handleClickBoneIn3D,
    onSelectSensor: handleSelectSensor,
    onHoverItem: setHoveredItem,
  };

  // Mount Three.js Hardware Scene Once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new SuitHardwareScene(mount, bonesRef.current, {
      onSelectBone: (id) => callbacksRef.current.onSelectBone(id),
      onSelectSensor: (id) => callbacksRef.current.onSelectSensor(id),
      onHoverItem: (item) => callbacksRef.current.onHoverItem(item),
    });
    scene.setLayerMode('xray');
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
    sceneRef.current?.setDrawerOpen(drawerTab !== 'none');
  }, [drawerTab]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (datasetModalOpen || activePage === 'exercise') return;
      if (e.key === 'Escape') {
        setDrawerTab('none');
        setSelectedBoneId(null);
        setSelectedSensorId(null);
        sceneRef.current?.setSelection(null, null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [datasetModalOpen, activePage]);

  const handleRunScan = () => {
    setIsScanning(true);
    sceneRef.current?.triggerQusScan();
    window.setTimeout(() => {
      setIsScanning(false);
    }, 2200);
  };

  const handleCloseDrawer = () => {
    setDrawerTab('none');
    setSelectedBoneId(null);
    setSelectedSensorId(null);
    sceneRef.current?.setSelection(null, null);
  };

  const handleApplyDataset = (entries: BoneDatasetEntry[]) => {
    setDatasetEntries(entries);
    setEvaluation(null);
    if (entries.length > 0) {
      setLayerMode('xray');
      setDrawerTab('bones');
    }
  };

  const handleUpdateBoneWeakness = useCallback((boneId: string, weaknessPercent: number | null) => {
    setDatasetEntries((prev) => upsertBoneWeaknessEntry(prev, boneId, weaknessPercent));
    setEvaluation(null);
  }, []);

  const handleUpdateBoneDetails = useCallback(
    (boneId: string, patch: Partial<Omit<BoneDatasetEntry, 'boneId'>>) => {
      setDatasetEntries((prev) => upsertBoneDetailsEntry(prev, boneId, patch));
    },
    [],
  );

  const handleChangeStatusColor = useCallback((tier: keyof StatusColorPalette, hex: string) => {
    setStatusColors((prev) => ({ ...prev, [tier]: hex }));
  }, []);

  const handleResetStatusColors = useCallback(() => {
    setStatusColors(DEFAULT_STATUS_COLORS);
  }, []);

  const handleRunEmgInspection = () => {
    if (!selectedBone) return;
    const exId = recommendation?.exerciseId || selectedBone.recommendedExerciseId;
    setIsEvaluating(true);
    setEvalProgress(0);
    setEvaluation(null);

    const start = performance.now();
    const durationMs = 1300;

    const tickProgress = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setEvalProgress(pct);
      if (pct < 100) {
        requestAnimationFrame(tickProgress);
      } else {
        const metrics = buildSimulatedEmgAttempt(selectedBone, exId, formQuality);
        void (async () => {
          let evalResult: EmgEvaluationResult;
          try {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 4500);
            const res = await fetch('/api/evaluate-exercise', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bone: selectedBone, metrics }),
              signal: controller.signal,
            });
            window.clearTimeout(timer);
            if (!res.ok) throw new Error('Eval failed');
            evalResult = (await res.json()) as EmgEvaluationResult;
          } catch {
            evalResult = evaluateEmgSession(metrics);
          }
          // Strictly do NOT mutate bone color or dataset weakness % after exercise!
          setEvaluation(evalResult);
          setIsEvaluating(false);
        })();
      }
    };

    requestAnimationFrame(tickProgress);
  };

  const hoverContent = useMemo(() => {
    if (!hoveredItem) return null;
    if (hoveredItem.kind === 'sensor') {
      const s = SUIT_SENSORS.find((x) => x.id === hoveredItem.id);
      if (!s) return null;
      return {
        title: `${s.code} · ${isAr ? s.nameAr : s.nameEn}`,
        sub: `${s.type} · ${isAr ? s.zoneAr : s.zoneEn}`,
      };
    }
    const b = bones.find((x) => x.id === hoveredItem.id);
    if (!b) return null;
    const statusLabel =
      b.status === 'healthy'
        ? copy.healthy
        : b.status === 'moderate'
          ? copy.moderate
          : b.status === 'critical'
            ? copy.critical
            : copy.unassessed;
    const pctText = b.weaknessPercent !== null ? `${b.weaknessPercent}% weakness` : copy.unassessed;
    return {
      title: isAr ? b.nameAr : b.nameEn,
      sub: `${statusLabel} · ${pctText}`,
      color: resolveBoneColorHex(b, statusColors),
    };
  }, [hoveredItem, bones, isAr, copy, statusColors]);

  const damagedBoneCount = useMemo(
    () => bones.filter((b) => b.status === 'moderate' || b.status === 'critical').length,
    [bones],
  );

  return (
    <>
      {/* Dedicated Separate Strengthening Exercise & EMG Verification Page */}
      {activePage === 'exercise' && selectedBone && recommendation && (
        <ExercisePage
          bone={selectedBone}
          statusColors={statusColors}
          recommendation={recommendation}
          isVideoPlaying={isVideoPlaying}
          onToggleVideo={() => setIsVideoPlaying((p) => !p)}
          onRestartVideo={() => setIsVideoPlaying(true)}
          formQuality={formQuality}
          onChangeFormQuality={setFormQuality}
          isEvaluating={isEvaluating}
          evalProgress={evalProgress}
          onRunEmgInspection={handleRunEmgInspection}
          evaluation={evaluation}
          onResetEvaluation={() => setEvaluation(null)}
          onBackToSkeleton={() => {
            setActivePage('skeleton');
            setDrawerTab('bones');
            sceneRef.current?.requestRender();
          }}
          locale={locale}
          onToggleLocale={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
        />
      )}

      {/* Main 3D Suit & Anatomical Skeleton Viewport */}
      <div
        className={
          activePage === 'exercise'
            ? 'hidden'
            : 'relative w-screen h-screen overflow-hidden bg-[#060911] text-slate-100'
        }
      >
        <div
          ref={canvasMountRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          data-testid="suit-3d-canvas"
        />

        {/* Top Navigation Bar (Strict 3-Zone Contract) */}
        <header className="fixed top-0 left-0 right-0 z-30 h-12 px-5 flex items-center justify-between gap-8 border-b border-slate-800/90 bg-[#080d18]/95">
          <span className="font-display text-base font-bold tracking-wider text-white whitespace-nowrap shrink-0">
            {copy.brand}
          </span>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('none');
                setLayerMode('full');
                sceneRef.current?.setCameraPreset('full');
              }}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                drawerTab === 'none' && layerMode === 'full'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {copy.navSuit}
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab(drawerTab === 'sensors' ? 'none' : 'sensors')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                drawerTab === 'sensors'
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {copy.navSensors}
            </button>
            <button
              type="button"
              onClick={() => setDatasetModalOpen(true)}
              data-testid="nav-dataset-btn"
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                datasetModalOpen
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent hover:text-white'
              }`}
            >
              {copy.navDataset}
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
              aria-label="Toggle language"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white border border-slate-700 bg-[#0d1424] whitespace-nowrap shrink-0 transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{locale === 'en' ? 'العربية' : 'EN'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunScan}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-70 text-slate-950 whitespace-nowrap shrink-0 transition-colors"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>{isScanning ? copy.scanning : copy.runScan}</span>
            </button>
          </div>
        </header>

        {/* Quiet Top-Left Sensor & Dataset Status Card */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="fixed top-16 left-5 z-10 px-3.5 py-2.5 rounded-lg border border-slate-800/90 bg-[#0a0f1c]/90 space-y-1.5 max-w-xs"
        >
          <div className="font-mono-tech text-xs text-slate-300">
            <span className="text-cyan-400 font-semibold">{sensorCounts.total} Sensors</span>
            <span className="mx-1.5 text-slate-600">/</span>
            <span className="text-cyan-300">{sensorCounts.QUS} QUS</span>
            <span className="mx-1 text-slate-600">·</span>
            <span className="text-purple-300">{sensorCounts.EMG} EMG (11×2 Ch)</span>
          </div>

          {hasDataset ? (
            <div className="space-y-2">
              <div className="font-mono-tech text-[11px] text-slate-400">
                <span className="text-emerald-400">{copy.healthy}</span>
                <span className="mx-1.5 text-slate-600">·</span>
                <span className="text-amber-400">{copy.moderate}</span>
                <span className="mx-1.5 text-slate-600">·</span>
                <span className="text-rose-400">
                  {copy.critical} ({damagedBoneCount})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLayerMode('xray');
                  setDrawerTab((t) => (t === 'bones' ? 'none' : 'bones'));
                  if (!selectedBoneId) {
                    const target =
                      bones.find((b) => b.status === 'critical') ||
                      bones.find((b) => b.status === 'moderate') ||
                      bones.find((b) => b.id === 'femur-right') ||
                      bones[0];
                    if (target) setSelectedBoneId(target.id);
                  }
                }}
                data-testid="toggle-bone-drawer-btn"
                className="w-full px-2.5 py-1.5 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
              >
                {copy.inspectAllBonesBtn}
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 pt-0.5">
              <div className="text-[11px] text-slate-300 leading-snug">{copy.datasetEmptyNotice}</div>
              <div className="text-[10px] font-mono-tech text-cyan-300/85" dir="ltr">
                {copy.codeSlotBadge}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDatasetModalOpen(true)}
                  data-testid="empty-slot-insert-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
                >
                  <Database className="w-3 h-3" />
                  <span>{copy.openDatasetBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDataset(SAMPLE_DATASET)}
                  data-testid="empty-slot-sample-btn"
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  {copy.loadSampleBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayerMode('xray');
                    setDrawerTab((t) => (t === 'bones' ? 'none' : 'bones'));
                    if (!selectedBoneId) {
                      const target = bones.find((b) => b.id === 'femur-right') || bones[0];
                      if (target) setSelectedBoneId(target.id);
                    }
                  }}
                  data-testid="toggle-bone-drawer-btn"
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-[#0d1424] hover:bg-slate-800 text-cyan-300 border border-slate-700 transition-colors"
                >
                  {copy.inspectAllBonesBtn}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hover Tooltip over 3D Bone or Sensor */}
        {hoverContent && hoveredItem && (
          <div
            className="fixed z-40 pointer-events-none px-3 py-2 rounded-lg border border-slate-700 bg-[#0a0f1c]/95 shadow-xl"
            style={{
              left: Math.min(window.innerWidth - 260, hoveredItem.x + 14),
              top: Math.max(56, hoveredItem.y - 44),
            }}
          >
            <div className="text-xs font-semibold text-white">{hoverContent.title}</div>
            <div
              className="text-[11px] font-mono-tech mt-0.5"
              style={{ color: hoverContent.color || '#38bdf8' }}
            >
              {hoverContent.sub}
            </div>
          </div>
        )}

        {/* Right Inspection Drawers */}
        {drawerTab === 'sensors' && (
          <SensorInventoryDrawer
            selectedSensorId={selectedSensorId}
            sensorFilter={sensorFilter}
            onFilterChange={setSensorFilter}
            onSelectSensor={handleSelectSensor}
            bones={bones}
            onSelectBone={handleSelectBoneFromList}
            onClose={handleCloseDrawer}
            locale={locale}
          />
        )}

        {drawerTab === 'bones' && (
          <BoneInspectorDrawer
            bones={bones}
            selectedBone={selectedBone}
            hasDataset={hasDataset}
            statusColors={statusColors}
            onChangeStatusColor={handleChangeStatusColor}
            onResetStatusColors={handleResetStatusColors}
            onSelectBone={handleSelectBoneFromList}
            onUpdateBoneWeakness={handleUpdateBoneWeakness}
            onUpdateBoneDetails={handleUpdateBoneDetails}
            onOpenExercisePage={openExercisePageForBone}
            onOpenDatasetModal={() => setDatasetModalOpen(true)}
            onLoadSampleDataset={() => handleApplyDataset(SAMPLE_DATASET)}
            onClose={handleCloseDrawer}
            locale={locale}
          />
        )}

        {/* Dataset Modal */}
        {datasetModalOpen && (
          <DatasetModal
            currentDataset={datasetEntries}
            onApplyDataset={handleApplyDataset}
            onClose={() => setDatasetModalOpen(false)}
            locale={locale}
          />
        )}
      </div>
    </>
  );
}
