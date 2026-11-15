import React, { useEffect, useRef } from 'react';

interface SpaceBackdropProps {
  dimmed: boolean;
}

function drawSpaceHorizon(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 1. Deep orbital void base
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#04060b');
  bgGrad.addColorStop(0.55, '#070b14');
  bgGrad.addColorStop(1, '#09111f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Subtle diagonal Milky Way galactic dust band
  ctx.save();
  ctx.translate(w * 0.52, h * 0.34);
  ctx.rotate(-0.42);
  const milkyGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, Math.max(w, h) * 0.65);
  milkyGrad.addColorStop(0, 'rgba(125, 168, 224, 0.14)');
  milkyGrad.addColorStop(0.35, 'rgba(64, 110, 178, 0.08)');
  milkyGrad.addColorStop(0.7, 'rgba(15, 32, 68, 0.03)');
  milkyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.scale(1.6, 0.42);
  ctx.fillStyle = milkyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(w, h) * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Stationary deterministic starfield (pseudo-random seeded so Earth/stars never flicker)
  let seed = 42197;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const starCount = Math.min(340, Math.round((w * h) / 4800));
  for (let i = 0; i < starCount; i++) {
    const sx = rand() * w;
    const sy = rand() * h * 0.88;
    const radius = rand() < 0.84 ? 0.75 + rand() * 0.75 : 1.5 + rand() * 0.9;
    const alpha = 0.25 + rand() * 0.72;
    const tintRoll = rand();
    if (tintRoll > 0.85) {
      ctx.fillStyle = `rgba(186, 230, 253, ${alpha.toFixed(2)})`;
    } else if (tintRoll < 0.1) {
      ctx.fillStyle = `rgba(254, 215, 170, ${alpha.toFixed(2)})`;
    } else {
      ctx.fillStyle = `rgba(248, 250, 252, ${alpha.toFixed(2)})`;
    }
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Crisp curved Earth horizon limb in lower-right / bottom
  const earthRadius = Math.max(w, h) * 1.48;
  const earthCx = w * 0.62;
  const earthCy = h * 0.84 + earthRadius;

  // Outer atmospheric Rayleigh glow
  const atmoGrad = ctx.createRadialGradient(
    earthCx,
    earthCy,
    earthRadius - 32,
    earthCx,
    earthCy,
    earthRadius + 95,
  );
  atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
  atmoGrad.addColorStop(0.32, 'rgba(56, 189, 248, 0.28)');
  atmoGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.55)');
  atmoGrad.addColorStop(0.72, 'rgba(14, 116, 144, 0.18)');
  atmoGrad.addColorStop(1, 'rgba(7, 11, 20, 0)');

  ctx.fillStyle = atmoGrad;
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthRadius + 95, Math.PI * 1.15, Math.PI * 1.88);
  ctx.arc(earthCx, earthCy, Math.max(10, earthRadius - 32), Math.PI * 1.88, Math.PI * 1.15, true);
  ctx.closePath();
  ctx.fill();

  // Dark Earth globe body
  const globeGrad = ctx.createRadialGradient(
    earthCx - w * 0.1,
    earthCy - earthRadius * 0.94,
    earthRadius * 0.04,
    earthCx,
    earthCy,
    earthRadius,
  );
  globeGrad.addColorStop(0, '#0f294a');
  globeGrad.addColorStop(0.22, '#091930');
  globeGrad.addColorStop(0.65, '#050b16');
  globeGrad.addColorStop(1, '#020408');

  ctx.fillStyle = globeGrad;
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthRadius, 0, Math.PI * 2);
  ctx.fill();

  // Sharp illuminated horizon rim
  const rimGrad = ctx.createLinearGradient(0, h * 0.65, w, h * 0.92);
  rimGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
  rimGrad.addColorStop(0.45, 'rgba(125, 211, 252, 0.78)');
  rimGrad.addColorStop(0.85, 'rgba(224, 242, 254, 0.92)');
  rimGrad.addColorStop(1, 'rgba(56, 189, 248, 0.25)');

  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthRadius, Math.PI * 1.18, Math.PI * 1.86);
  ctx.stroke();

  // Subtle orbital cloud-shelf highlights near terminator
  ctx.save();
  ctx.beginPath();
  ctx.arc(earthCx, earthCy, earthRadius - 2, 0, Math.PI * 2);
  ctx.clip();

  const cloudGlow = ctx.createRadialGradient(
    w * 0.72,
    h * 0.86,
    20,
    w * 0.72,
    h * 0.86,
    w * 0.36,
  );
  cloudGlow.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
  cloudGlow.addColorStop(0.55, 'rgba(14, 165, 233, 0.06)');
  cloudGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = cloudGlow;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.restore();
}

export const SpaceBackdrop: React.FC<SpaceBackdropProps> = ({ dimmed }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSpaceHorizon(canvas);

    const handleResize = () => drawSpaceHorizon(canvas);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden bg-[#04060b] pointer-events-none select-none"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Left-edge readability gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5, 8, 15, 0.76) 0%, rgba(5, 8, 15, 0.34) 44%, rgba(5, 8, 15, 0.12) 100%)',
        }}
      />

      {/* Inner-module scrim (kept clear on Orbit landing and Contact Us) */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          dimmed ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'rgba(6, 9, 15, 0.72)',
          backdropFilter: dimmed ? 'blur(5px)' : 'none',
        }}
      />
    </div>
  );
};
