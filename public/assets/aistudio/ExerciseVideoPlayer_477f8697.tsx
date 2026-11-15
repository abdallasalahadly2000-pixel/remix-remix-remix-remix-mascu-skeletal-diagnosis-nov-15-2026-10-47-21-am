import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { ExerciseProtocol, FormQuality } from '../domain/osteosense';
import { Locale, UI_COPY } from '../i18n/translations';

interface ExerciseVideoPlayerProps {
  protocol: ExerciseProtocol;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  formQuality: FormQuality;
  locale: Locale;
  isEvaluating: boolean;
  evalProgress: number;
}

export const ExerciseVideoPlayer: React.FC<ExerciseVideoPlayerProps> = ({
  protocol,
  isPlaying,
  onTogglePlay,
  onRestart,
  formQuality,
  locale,
  isEvaluating,
  evalProgress,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const repRef = useRef(1);
  const copy = UI_COPY[locale];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const drawFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlaying || isEvaluating) {
        const speed = (Math.PI * 2) / protocol.cadenceSec;
        const prev = phaseRef.current;
        phaseRef.current += dt * speed;
        if (Math.floor(phaseRef.current / (Math.PI * 2)) > Math.floor(prev / (Math.PI * 2))) {
          repRef.current = (repRef.current % protocol.repsPerSet) + 1;
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background dark bay
      ctx.fillStyle = '#070c17';
      ctx.fillRect(0, 0, w, h);

      // Subtle lab grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 24) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 24) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Floor / ARED Footplate
      const floorY = h - 34;
      ctx.fillStyle = '#141e30';
      ctx.fillRect(28, floorY, w - 56, 8);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(28, floorY);
      ctx.lineTo(w - 28, floorY);
      ctx.stroke();

      // Kinematic cycle 0..1
      const cycle = (1 - Math.cos(phaseRef.current)) * 0.5;
      const depthScale = formQuality === 'optimal' ? 1.0 : 0.55;
      const eff = cycle * depthScale;

      const cx = w * 0.36;

      let ankle = { x: cx, y: floorY - 4 };
      let knee = { x: cx + 8, y: floorY - 56 };
      let hip = { x: cx - 10, y: floorY - 108 };
      let shoulder = { x: cx - 4, y: floorY - 166 };
      let head = { x: cx, y: floorY - 188 };
      let elbow = { x: cx + 10, y: floorY - 138 };
      let hand = { x: cx + 20, y: floorY - 118 };

      if (protocol.kinematicMode === 'squat') {
        const drop = eff * 44;
        knee = { x: cx + 26 * eff + 6, y: floorY - 54 + drop * 0.22 };
        hip = { x: cx - 24 * eff - 8, y: floorY - 108 + drop };
        const lean = formQuality === 'optimal' ? 8 * eff : 26 * eff;
        shoulder = { x: hip.x + lean + 4, y: hip.y - 54 };
        head = { x: shoulder.x + 4, y: shoulder.y - 20 };
        elbow = { x: shoulder.x - 10, y: shoulder.y + 14 };
        hand = { x: shoulder.x - 6, y: shoulder.y + 4 };
      } else if (protocol.kinematicMode === 'heel_raise') {
        const lift = eff * 22;
        ankle = { x: cx, y: floorY - 4 - lift };
        knee = { x: cx + 4, y: floorY - 56 - lift };
        hip = { x: cx - 2, y: floorY - 108 - lift };
        shoulder = { x: cx + (formQuality === 'poor' ? 12 * eff : 0), y: floorY - 166 - lift };
        head = { x: shoulder.x + 2, y: shoulder.y - 20 };
        elbow = { x: shoulder.x + 6, y: shoulder.y + 24 };
        hand = { x: shoulder.x + 10, y: shoulder.y + 44 };
      } else if (protocol.kinematicMode === 'deadlift') {
        const hinge = eff * 0.92;
        hip = { x: cx - 20 * eff - 4, y: floorY - 104 + 12 * eff };
        knee = { x: cx + 8 * eff + 4, y: floorY - 55 + 4 * eff };
        shoulder = {
          x: hip.x + Math.sin(hinge) * 56,
          y: hip.y - Math.cos(hinge) * 56 + (formQuality === 'poor' ? 8 * eff : 0),
        };
        head = { x: shoulder.x + 12 * eff, y: shoulder.y - 18 };
        elbow = { x: shoulder.x + 3, y: shoulder.y + 24 };
        hand = { x: shoulder.x + 5, y: shoulder.y + 48 };
      } else if (protocol.kinematicMode === 'hip_abduction') {
        const swing = eff * 36;
        knee = { x: cx + swing * 0.55, y: floorY - 56 + eff * 6 };
        ankle = { x: cx + swing, y: floorY - 6 - eff * 16 };
        shoulder = { x: cx - (formQuality === 'poor' ? 14 * eff : 2), y: floorY - 166 };
        head = { x: shoulder.x, y: shoulder.y - 20 };
        elbow = { x: shoulder.x + 6, y: shoulder.y + 26 };
        hand = { x: shoulder.x + 12, y: shoulder.y + 46 };
      } else if (protocol.kinematicMode === 'bicep_curl') {
        elbow = { x: shoulder.x + 4, y: shoulder.y + 28 };
        const curlAngle = eff * 2.1;
        hand = {
          x: elbow.x + Math.cos(Math.PI * 0.35 - curlAngle) * 26,
          y: elbow.y + Math.sin(Math.PI * 0.35 - curlAngle) * 26,
        };
      } else {
        // overhead_press
        const press = eff * 48;
        elbow = { x: shoulder.x + 6, y: shoulder.y + 12 - press * 0.6 };
        hand = { x: shoulder.x + 6, y: shoulder.y + 4 - press };
      }

      // Draw ARED resistive rig frame
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 56, floorY);
      ctx.lineTo(cx - 56, 22);
      ctx.lineTo(cx + 56, 22);
      ctx.lineTo(cx + 56, floorY);
      ctx.stroke();

      // Resistive tether line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - 28, floorY);
      ctx.lineTo(hand.x, hand.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const bodyColor = formQuality === 'optimal' ? '#38bdf8' : '#f59e0b';
      const drawSegment = (a: { x: number; y: number }, b: { x: number; y: number }, width: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      };

      // Astronaut Suit Limbs
      drawSegment(ankle, knee, 11, '#1e293b');
      drawSegment(knee, hip, 13, '#1e293b');
      drawSegment(hip, shoulder, 15, '#1e293b');
      drawSegment(shoulder, elbow, 9, '#334155');
      drawSegment(elbow, hand, 8, '#334155');

      // Internal Bone Alignment Core
      drawSegment(ankle, knee, 3.5, bodyColor);
      drawSegment(knee, hip, 3.5, formQuality === 'optimal' ? '#10b981' : '#ef4444');
      drawSegment(hip, shoulder, 3.5, bodyColor);
      drawSegment(shoulder, elbow, 2.5, bodyColor);
      drawSegment(elbow, hand, 2.5, bodyColor);

      // Head / Helmet silhouette
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Sensor Indicators (ONLY Ultrasound QUS cyan + Surface EMG violet)
      const drawSensorDot = (pt: { x: number; y: number }, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2);
        ctx.fill();
      };
      drawSensorDot(shoulder, '#a855f7'); // Deltoid EMG
      drawSensorDot(elbow, '#a855f7'); // Biceps/Triceps EMG
      drawSensorDot(hip, '#06b6d4'); // Femoral QUS
      drawSensorDot(knee, '#a855f7'); // Quad EMG
      drawSensorDot(ankle, '#06b6d4'); // Tibial/Calcaneal QUS

      // Right Side: Live Dual-Channel Surface EMG Waveform Overlay
      const waveX = w * 0.6;
      const waveW = w - waveX - 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(waveX, 16, waveW, h - 56);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(waveX, 16, waveW, h - 56);

      ctx.fillStyle = '#c084fc';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText('LIVE EMG (R / L CH)', waveX + 10, 34);

      // Right Channel EMG Burst Curve
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const val = (1 - Math.cos(phaseRef.current - (1 - t) * 3.5)) * 0.5 * depthScale;
        const burst = Math.sin(i * 4.7 + phaseRef.current * 6) * 8 * val;
        const px = waveX + 10 + t * (waveW - 20);
        const py = 74 + burst;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Left Channel EMG Burst Curve
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const symFactor = formQuality === 'optimal' ? 0.96 : 0.62;
        const val = (1 - Math.cos(phaseRef.current - (1 - t) * 3.5)) * 0.5 * depthScale * symFactor;
        const burst = Math.cos(i * 4.3 + phaseRef.current * 5.5) * 8 * val;
        const px = waveX + 10 + t * (waveW - 20);
        const py = 122 + burst;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Numeric EMG Readout inside feed
      const peakUv = Math.round((formQuality === 'optimal' ? 540 : 310) * (0.35 + eff * 0.65));
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(`EMG PEAK: ${peakUv} µV`, waveX + 10, h - 52);
      ctx.fillStyle = formQuality === 'optimal' ? '#10b981' : '#ef4444';
      ctx.fillText(`REP ${repRef.current}/${protocol.repsPerSet}`, waveX + 10, h - 68);

      // Video overlay header
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(
        isEvaluating ? `EMG SCAN ● ${Math.round(evalProgress)}%` : isPlaying ? 'EXERCISE VIDEO DEMO' : 'PAUSED',
        12,
        20,
      );

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, [protocol, isPlaying, formQuality, isEvaluating, evalProgress]);

  return (
    <div className="rounded-lg border border-slate-800 bg-[#070c17] overflow-hidden">
      <div className="relative">
        <canvas
          ref={canvasRef}
          dir="ltr"
          width={520}
          height={232}
          className="w-full h-[232px] block"
          data-testid="exercise-video-canvas"
        />
        {isEvaluating && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
            <div
              className="h-full bg-purple-400 transition-all duration-100"
              style={{ width: `${Math.min(100, evalProgress)}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800/80 bg-[#0b1120]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? copy.pauseVideo : copy.playVideo}</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart demonstration"
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="font-mono-tech text-[11px] text-slate-400">
          {protocol.sets}×{protocol.repsPerSet} · {protocol.cadenceSec}s/rep
        </span>
      </div>
    </div>
  );
};
