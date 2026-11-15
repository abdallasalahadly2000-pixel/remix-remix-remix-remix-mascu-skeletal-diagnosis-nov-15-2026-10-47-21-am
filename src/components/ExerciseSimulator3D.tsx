import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Gauge,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { ExerciseProtocol, FormQuality } from '../domain/osteosense';
import type { SeverityLevelId } from '../domain/boneExerciseMatrix';
import { getExerciseBiomechanics } from '../domain/nasaBoneDatabase';
import { Locale, UI_COPY } from '../i18n/translations';
import {
  ExerciseSimulatorScene,
  SimCameraPreset,
  SimOverlayOptions,
  SimulatorTelemetryFrame,
} from '../three/ExerciseSimulatorScene';

interface ExerciseSimulator3DProps {
  protocol: ExerciseProtocol;
  severity: SeverityLevelId;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  formQuality: FormQuality;
  locale: Locale;
  isEvaluating: boolean;
  evalProgress: number;
}

export const ExerciseSimulator3D: React.FC<ExerciseSimulator3DProps> = ({
  protocol,
  severity,
  isPlaying,
  onTogglePlay,
  onRestart,
  formQuality,
  locale,
  isEvaluating,
  evalProgress,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ExerciseSimulatorScene | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraPreset, setCameraPreset] = useState<SimCameraPreset>('isometric');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [overlays, setOverlays] = useState<SimOverlayOptions>({
    showAngles: true,
    showMuscles: true,
    showForce: true,
  });

  const spec = getExerciseBiomechanics(protocol.id);
  const dosing = spec.severityDosing[severity];
  const isAr = locale === 'ar';
  const copy = UI_COPY[locale];

  const [telemetry, setTelemetry] = useState<SimulatorTelemetryFrame>({
    rep: 1,
    totalReps: dosing.reps,
    phaseIndex: 0,
    phaseLabelEn: spec.phasesEn[0],
    phaseLabelAr: spec.phasesAr[0],
    cycleProgress: 0,
    primaryAngleDeg: spec.standingAngleDeg,
    secondaryAngleDeg: spec.secondaryOptimalDeg,
    instantForceBw: 1.0,
    emgRightUv: 180,
    emgLeftUv: 185,
    symmetryPct: 96,
  });

  const telemetryHistoryRef = useRef<Array<{ r: number; l: number }>>([]);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const sim = new ExerciseSimulatorScene(
      mountEl,
      protocol,
      severity,
      formQuality,
      isPlaying,
      (frame) => {
        setTelemetry(frame);
        telemetryHistoryRef.current.push({ r: frame.emgRightUv, l: frame.emgLeftUv });
        if (telemetryHistoryRef.current.length > 96) {
          telemetryHistoryRef.current.shift();
        }
      },
    );
    sceneRef.current = sim;

    return () => {
      sim.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.updateConfig(
      protocol,
      severity,
      formQuality,
      isPlaying,
      isEvaluating,
      speedMultiplier,
      overlays,
    );
  }, [protocol, severity, formQuality, isPlaying, isEvaluating, speedMultiplier, overlays]);

  // Synchronized Dual-Channel EMG Oscilloscope Canvas
  useEffect(() => {
    const canvas = scopeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    const hist = telemetryHistoryRef.current;
    if (hist.length > 1) {
      const drawTrace = (key: 'r' | 'l', color: string, baselineY: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const px = (i / Math.max(1, hist.length - 1)) * (w - 16) + 8;
          const amp = (hist[i][key] / 600) * 24;
          const carrier = Math.sin(i * 1.45 + (key === 'r' ? 0 : 1.1)) * amp;
          const py = baselineY + carrier;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
      drawTrace('r', '#c084fc', h * 0.34);
      drawTrace('l', '#22d3ee', h * 0.72);
    }
  }, [telemetry]);

  const handleRestartClick = () => {
    telemetryHistoryRef.current = [];
    sceneRef.current?.restart();
    onRestart();
  };

  const handlePresetClick = (preset: SimCameraPreset) => {
    setCameraPreset(preset);
    sceneRef.current?.setCameraPreset(preset);
  };

  const cameraButtons: Array<{ key: SimCameraPreset; labelEn: string; labelAr: string }> = [
    { key: 'isometric', labelEn: '3/4 View', labelAr: 'منظور ثلاثي' },
    { key: 'sagittal', labelEn: 'Side Angles', labelAr: 'زاوية جانبية' },
    { key: 'anterior', labelEn: 'Front Symmetry', labelAr: 'تماثل أمامي' },
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-[#070b14] overflow-hidden">
      {/* 3D Interactive Stage (strictly no backdrop-blur over WebGL) */}
      <div className="relative h-[370px] w-full bg-[#060911] overflow-hidden">
        <div ref={mountRef} className="absolute inset-0 w-full h-full" />

        {/* Compact Top-Left Biomechanical HUD */}
        <div className="absolute top-3 left-3 z-10 rounded-lg border border-slate-800 bg-[#080c15]/92 px-3 py-2 space-y-1 pointer-events-none">
          <div className="flex items-center gap-2 font-mono-tech text-[11px]">
            <span className={formQuality === 'optimal' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isEvaluating
                ? `EMG SCAN ${Math.round(evalProgress)}%`
                : isAr
                  ? telemetry.phaseLabelAr
                  : telemetry.phaseLabelEn}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 tabular-nums">
              {isAr ? 'التكرار' : 'Rep'} {telemetry.rep}/{telemetry.totalReps}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono-tech text-[11px] text-slate-200 tabular-nums">
            <span>
              {isAr ? spec.primaryJointAr : spec.primaryJointEn}:{' '}
              <strong className={formQuality === 'optimal' ? 'text-emerald-300' : 'text-amber-300'}>
                {telemetry.primaryAngleDeg}°
              </strong>
            </span>
            <span>
              {isAr ? spec.secondaryJointAr : spec.secondaryJointEn}:{' '}
              <strong className="text-cyan-300">{telemetry.secondaryAngleDeg}°</strong>
            </span>
            <span>
              GRF: <strong className="text-cyan-300">{telemetry.instantForceBw.toFixed(2)} ×BW</strong>
            </span>
          </div>
        </div>

        {/* Collapsible Bottom Simulator Dock */}
        <div className="absolute left-3 right-3 bottom-2.5 z-10 flex flex-col items-center pointer-events-none">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-t border border-b-0 border-slate-800 bg-[#080c15]/95 text-[10px] text-slate-400 hover:text-white cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{dockCollapsed ? (isAr ? 'إظهار التحكم' : 'Controls') : (isAr ? 'إخفاء' : 'Hide')}</span>
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#080c15]/95">
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-cyan-500/18 text-cyan-300 border border-cyan-500/45 hover:bg-cyan-500/28 cursor-pointer whitespace-nowrap"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isPlaying ? copy.pauseVideo : copy.playVideo}</span>
              </button>

              <button
                type="button"
                onClick={handleRestartClick}
                aria-label="Restart exercise simulation"
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setSpeedMultiplier((s) => (s === 1 ? 0.5 : 1))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono-tech text-slate-200 border border-slate-700 hover:border-slate-500 cursor-pointer whitespace-nowrap"
              >
                <Gauge className="w-3 h-3 text-cyan-400" />
                <span>{speedMultiplier}×</span>
              </button>

              <span className="w-px h-4 bg-slate-800 mx-0.5" aria-hidden="true" />

              {cameraButtons.map((cam) => (
                <button
                  key={cam.key}
                  type="button"
                  onClick={() => handlePresetClick(cam.key)}
                  className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ui-transition ${
                    cameraPreset === cam.key
                      ? 'bg-cyan-500/18 text-cyan-300 border border-cyan-500/45'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {isAr ? cam.labelAr : cam.labelEn}
                </button>
              ))}

              <span className="w-px h-4 bg-slate-800 mx-0.5" aria-hidden="true" />

              <button
                type="button"
                onClick={() => setOverlays((o) => ({ ...o, showAngles: !o.showAngles }))}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                  overlays.showAngles
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-500 border border-transparent'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>{isAr ? 'الزوايا' : 'Angles'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOverlays((o) => ({ ...o, showMuscles: !o.showMuscles }))}
                className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                  overlays.showMuscles
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40'
                    : 'text-slate-500 border border-transparent'
                }`}
              >
                {isAr ? 'العضلات' : 'Muscles'}
              </button>

              <button
                type="button"
                onClick={() => setOverlays((o) => ({ ...o, showForce: !o.showForce }))}
                className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                  overlays.showForce
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-500 border border-transparent'
                }`}
              >
                {isAr ? 'القوة' : 'Force'}
              </button>
            </div>
          )}
        </div>

        {isEvaluating && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 z-20">
            <div
              className="h-full bg-purple-400 transition-all duration-100"
              style={{ width: `${Math.min(100, evalProgress)}%` }}
            />
          </div>
        )}
      </div>

      {/* Synchronized Live Dual-Channel EMG Oscilloscope */}
      <div className="border-t border-slate-800 bg-[#080c15] px-3.5 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tech tabular-nums">
          <div className="flex items-center gap-3">
            <span className="text-slate-300 font-semibold">
              {isAr ? 'إشارة EMG المباشرة (يمين / يسار)' : 'Live Bilateral EMG Scope'}
            </span>
            <span className="text-purple-300">R-Ch: {telemetry.emgRightUv} µV</span>
            <span className="text-cyan-300">L-Ch: {telemetry.emgLeftUv} µV</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={telemetry.symmetryPct >= 85 ? 'text-emerald-400' : 'text-amber-400'}>
              {isAr ? 'التماثل' : 'Symmetry'}: {telemetry.symmetryPct}%
            </span>
            <span className="text-slate-400">
              {dosing.sets}×{dosing.reps} · {dosing.tempo}
            </span>
          </div>
        </div>

        <canvas
          ref={scopeCanvasRef}
          dir="ltr"
          width={640}
          height={64}
          className="w-full h-[64px] rounded border border-slate-800/80 block"
        />
      </div>
    </div>
  );
};
