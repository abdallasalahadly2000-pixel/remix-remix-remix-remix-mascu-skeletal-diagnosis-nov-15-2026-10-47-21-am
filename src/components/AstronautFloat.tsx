import React from 'react';

interface AstronautFloatProps {
  variant: 'orbit' | 'contact';
}

export const AstronautFloat: React.FC<AstronautFloatProps> = ({ variant }) => {
  const isContact = variant === 'contact';
  const imgSrc = isContact
    ? '/assets/aistudio/media_1794583900877_330c322b_fe06e8d6.png'
    : '/assets/aistudio/media_1794578367780_dfa79396_1da64c6d.png';

  const altText = isContact
    ? 'Astronaut floating above Earth giving a thumbs-up sign'
    : 'Astronaut floating above Earth holding his leg with highlighted osteoporotic bone loss';

  const containerClass = isContact
    ? 'pointer-events-none select-none relative z-[2] shrink-0 w-[min(78vw,340px)] md:w-[min(39vw,440px)] lg:w-[min(40vw,560px)] xl:w-[min(40vw,610px)] md:mr-[1vw] lg:mr-[2vw]'
    : 'pointer-events-none select-none fixed z-[2] right-[2vw] md:right-[3vw] lg:right-[4vw] top-[10vh] md:top-[6vh] w-[min(64vw,430px)] md:w-[min(45vw,560px)] lg:w-[min(42vw,640px)] opacity-90 md:opacity-100';

  return (
    <div aria-hidden="true" className={containerClass}>
      <div className="astronaut-float relative w-full aspect-[896/1200]">
        <img
          src={imgSrc}
          alt={altText}
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fallbackTried) {
              el.dataset.fallbackTried = '1';
              el.src = `./${imgSrc.replace(/^\//, 'public/')}`;
            }
          }}
          className="block w-full h-full object-contain drop-shadow-[0_28px_60px_rgba(0,0,0,0.88)]"
          style={{
            filter: isContact
              ? 'drop-shadow(0 0 38px rgba(34, 211, 238, 0.16))'
              : 'drop-shadow(0 0 40px rgba(220, 38, 38, 0.16))',
          }}
        />

        {/* Reflective dark obsidian visor dome to conceal face cleanly on both astronauts */}
        <svg
          viewBox="0 0 896 1200"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`visorShade-${variant}`} cx="38%" cy="35%" r="68%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.96" />
              <stop offset="45%" stopColor="#090d16" stopOpacity="0.99" />
              <stop offset="85%" stopColor="#03050a" stopOpacity="1" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id={`visorGlint-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.72" />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
            </linearGradient>
          </defs>

          {isContact ? (
            <g transform="translate(442 240) rotate(-6)">
              <ellipse
                cx="0"
                cy="0"
                rx="60"
                ry="70"
                fill={`url(#visorShade-${variant})`}
                stroke="rgba(148,163,184,0.35)"
                strokeWidth="2"
              />
              {/* Curved helmet glass reflection */}
              <path
                d="M 14 -52 C 36 -38, 44 -10, 38 22 C 31 6, 22 -24, 2 -40 Z"
                fill={`url(#visorGlint-${variant})`}
              />
              <ellipse
                cx="-16"
                cy="-24"
                rx="18"
                ry="8"
                transform="rotate(-24 -16 -24)"
                fill="rgba(226, 232, 240, 0.16)"
              />
            </g>
          ) : (
            <g transform="translate(445 256) rotate(-5)">
              <ellipse
                cx="0"
                cy="0"
                rx="60"
                ry="70"
                fill={`url(#visorShade-${variant})`}
                stroke="rgba(148,163,184,0.28)"
                strokeWidth="2"
              />
              <path
                d="M 16 -52 C 38 -36, 44 -8, 36 24 C 30 6, 22 -24, 4 -42 Z"
                fill={`url(#visorGlint-${variant})`}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
