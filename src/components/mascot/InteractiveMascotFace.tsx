import React, { useState, useEffect, useRef } from 'react';
import { MascotPersona } from './mascotPersonas';

interface InteractiveMascotFaceProps {
  persona?: MascotPersona;
  size?: number;
  interactive?: boolean;
  className?: string;
  isThinking?: boolean;
}

export const InteractiveMascotFace: React.FC<InteractiveMascotFaceProps> = ({
  persona,
  size = 80,
  interactive = true,
  className = '',
  isThinking = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pupilOffset, setPupilOffset] = useState<{ x: number; y: number }>({ x: -2.5, y: -3 });
  const [isBlinking, setIsBlinking] = useState(false);

  // 1. Interactive Eye Tracking ("ngó theo con trỏ chuột")
  useEffect(() => {
    if (!interactive) return;

    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const angle = Math.atan2(dy, dx);
        const distance = Math.hypot(dx, dy);

        // Maximum pupil displacement in SVG units (max 4.5 units)
        const maxOffset = 4.5;
        const clampedDist = Math.min(maxOffset, distance / 35);

        const x = Math.cos(angle) * clampedDist;
        const y = Math.sin(angle) * clampedDist;

        setPupilOffset({ x, y });
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [interactive]);

  // 2. Natural Auto Blinking (chớp mắt tự nhiên định kỳ)
  useEffect(() => {
    let blinkTimeout: number;
    let intervalId: number;

    const scheduleNextBlink = () => {
      const delay = Math.random() * 3000 + 3500; // 3.5s - 6.5s
      intervalId = window.setTimeout(() => {
        setIsBlinking(true);
        blinkTimeout = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 140);
      }, delay);
    };

    scheduleNextBlink();
    return () => {
      window.clearTimeout(intervalId);
      window.clearTimeout(blinkTimeout);
    };
  }, []);

  // Determine character style features based on persona
  const personaId = persona?.id || 'scholar_owl';
  const isOwl =
    personaId === 'scholar_owl' ||
    personaId === 'headmaster' ||
    personaId.includes('cu') ||
    personaId.includes('owl');

  const isCat = personaId.includes('cat') || personaId.includes('meo');
  const isBunny = personaId.includes('bunny') || personaId.includes('tho');
  const isWolf = personaId.includes('wolf') || personaId.includes('soi') || personaId === 'president';

  // Body primary color
  const bodyColor = isOwl
    ? '#00b074' // Iconic vibrant green as in user's image
    : isCat
    ? '#f97316'
    : isBunny
    ? '#ec4899'
    : isWolf
    ? '#3b82f6'
    : '#10b981';

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-md overflow-visible transition-transform"
      >
        <defs>
          <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* 1. EAR TUFTS / EARS */}
        {isOwl && (
          <g>
            {/* Left Owl Ear Tuft */}
            <polygon
              points="26,26 14,7 36,18"
              fill={bodyColor}
              stroke="#047857"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Right Owl Ear Tuft */}
            <polygon
              points="74,26 86,7 64,18"
              fill={bodyColor}
              stroke="#047857"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </g>
        )}

        {isCat && (
          <g>
            <polygon points="20,32 12,12 36,22" fill={bodyColor} stroke="#c2410c" strokeWidth="1.5" />
            <polygon points="22,30 16,16 34,23" fill="#fbcfe8" />
            <polygon points="80,32 88,12 64,22" fill={bodyColor} stroke="#c2410c" strokeWidth="1.5" />
            <polygon points="78,30 84,16 66,23" fill="#fbcfe8" />
          </g>
        )}

        {isBunny && (
          <g>
            <ellipse cx="32" cy="18" rx="8" ry="18" fill={bodyColor} />
            <ellipse cx="32" cy="18" rx="4.5" ry="13" fill="#fbcfe8" />
            <ellipse cx="68" cy="18" rx="8" ry="18" fill={bodyColor} />
            <ellipse cx="68" cy="18" rx="4.5" ry="13" fill="#fbcfe8" />
          </g>
        )}

        {isWolf && (
          <g>
            <polygon points="22,30 10,8 38,20" fill={bodyColor} stroke="#1d4ed8" strokeWidth="1.5" />
            <polygon points="78,30 90,8 62,20" fill={bodyColor} stroke="#1d4ed8" strokeWidth="1.5" />
          </g>
        )}

        {/* 2. MAIN ROUND HEAD / BODY */}
        <circle
          cx="50"
          cy="58"
          r="38"
          fill={bodyColor}
          stroke={isOwl ? '#059669' : '#ffffff'}
          strokeWidth="2"
        />

        {/* 3. INNER WHITE/MINT FACE CIRCLE */}
        <ellipse cx="50" cy="62" rx="31" ry="26" fill="#ffffff" />

        {/* 4. BLUSH CHEEKS (MÁ HỒNG DỄ THƯƠNG) */}
        <ellipse cx="23" cy="68" rx="5.5" ry="3.5" fill="#f472b6" opacity="0.65" />
        <ellipse cx="77" cy="68" rx="5.5" ry="3.5" fill="#f472b6" opacity="0.65" />

        {/* 5. BIG EYES WITH EYE TRACKING (MẮT TO TRÒN NGÓ THEO CHUỘT) */}
        {isBlinking ? (
          // Blinking state - cute closed arched eyes
          <g>
            <path
              d="M 26,62 Q 37,70 48,62"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d="M 52,62 Q 63,70 74,62"
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </g>
        ) : (
          <g>
            {/* LEFT EYE */}
            <ellipse
              cx="37"
              cy="60"
              rx="12"
              ry="13.5"
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth="1.8"
            />
            {/* Left Pupil (Tracks cursor) */}
            <g transform={`translate(${pupilOffset.x}, ${pupilOffset.y})`}>
              <circle cx="37" cy="60" r="7" fill="#0f172a" />
              {/* Primary sparkle glint (top left) */}
              <circle cx="34.8" cy="57.5" r="2.6" fill="#ffffff" />
              {/* Secondary micro sparkle glint (bottom right) */}
              <circle cx="39.2" cy="62.8" r="1.3" fill="#ffffff" />
            </g>

            {/* RIGHT EYE */}
            <ellipse
              cx="63"
              cy="60"
              rx="12"
              ry="13.5"
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth="1.8"
            />
            {/* Right Pupil (Tracks cursor) */}
            <g transform={`translate(${pupilOffset.x}, ${pupilOffset.y})`}>
              <circle cx="63" cy="60" r="7" fill="#0f172a" />
              {/* Primary sparkle glint (top left) */}
              <circle cx="60.8" cy="57.5" r="2.6" fill="#ffffff" />
              {/* Secondary micro sparkle glint (bottom right) */}
              <circle cx="65.2" cy="62.8" r="1.3" fill="#ffffff" />
            </g>
          </g>
        )}

        {/* 6. BEAK / NOSE */}
        {isOwl ? (
          // Cute golden owl beak
          <polygon points="50,65 45,74 55,74" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
        ) : (
          // Little cute nose
          <polygon points="50,68 47,64 53,64" fill="#f43f5e" />
        )}

        {/* 7. MORTARBOARD GRADUATION CAP (MŨ CỬ NHÂN - ONLY FOR SCHOLAR OWL / HEADMASTER) */}
        {(isOwl || personaId === 'scholar_owl') && (
          <g filter="url(#soft-shadow)">
            {/* Cap base ring */}
            <path d="M 33,28 Q 50,36 67,28 L 67,35 Q 50,43 33,35 Z" fill="#0f172a" />
            {/* Diamond graduation top */}
            <polygon
              points="50,13 86,25 50,37 14,25"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Center golden button */}
            <circle cx="50" cy="25" r="2.5" fill="#f59e0b" />
            {/* Golden tassel string hanging to the right */}
            <path
              d="M 50,25 Q 73,28 78,44"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* Tassel brush */}
            <polygon points="75,44 81,44 79,54 77,54" fill="#d97706" />
          </g>
        )}

        {/* Thinking / working indicator dots when AI is generating */}
        {isThinking && (
          <g transform="translate(68, 20)">
            <circle cx="0" cy="0" r="4" fill="#f59e0b" className="animate-ping" />
            <circle cx="0" cy="0" r="3" fill="#fbbf24" />
          </g>
        )}
      </svg>
    </div>
  );
};
