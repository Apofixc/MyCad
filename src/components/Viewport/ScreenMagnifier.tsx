import React, { useState, useEffect, useCallback } from "react";
import { CAD_PX_PER_MM } from "../../utils/alignmentMath";

export type MagnifierLevel = 2 | 4 | 8 | 16;

export interface ScreenMagnifierProps {
  isActive: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pan: { x: number; y: number };
  zoom: number;
  magnification?: MagnifierLevel;
  onChangeMagnification?: (mag: MagnifierLevel) => void;
  onClose: () => void;
}

export const ScreenMagnifier: React.FC<ScreenMagnifierProps> = ({
  isActive,
  containerRef,
  pan,
  zoom,
  magnification = 4,
  onChangeMagnification,
  onClose,
}) => {
  if (!isActive) return null;

  const [mousePos, setMousePos] = useState<{ clientX: number; clientY: number } | null>(null);

  const LOUPE_RADIUS = 90; // 180px diameter circular lens

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ clientX: e.clientX, clientY: e.clientY });
  }, []);

  const MAG_LEVELS: MagnifierLevel[] = [2, 4, 8, 16];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "z" || e.key === "Z") {
        const curIdx = MAG_LEVELS.indexOf(magnification);
        const next = MAG_LEVELS[(curIdx + 1) % MAG_LEVELS.length];
        onChangeMagnification?.(next);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseMove, onClose, magnification, onChangeMagnification]);

  if (!mousePos || !containerRef.current) return null;

  const rect = containerRef.current.getBoundingClientRect();
  const relX = mousePos.clientX - rect.left;
  const relY = mousePos.clientY - rect.top;

  // If outside canvas, hide loupe
  if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) {
    return null;
  }

  // World coordinates at cursor center
  const worldX = (relX - pan.x) / zoom;
  const worldY = (relY - pan.y) / zoom;

  const worldMmX = (worldX / CAD_PX_PER_MM).toFixed(2);
  const worldMmY = (worldY / CAD_PX_PER_MM).toFixed(2);

  // Position loupe offset from cursor so it doesn't block the cursor point
  const PADDING = 40;
  const offsetX = relX + LOUPE_RADIUS + PADDING > rect.width ? -LOUPE_RADIUS - PADDING : LOUPE_RADIUS + PADDING;
  const offsetY = relY - LOUPE_RADIUS - PADDING < 0 ? LOUPE_RADIUS + PADDING : -LOUPE_RADIUS - PADDING;

  const loupeCenterX = relX + offsetX;
  const loupeCenterY = relY + offsetY;

  // Dotted guide line connecting cursor to loupe rim
  const dist = Math.hypot(offsetX, offsetY);
  const edgeX = dist > 0 ? loupeCenterX - (offsetX / dist) * LOUPE_RADIUS : loupeCenterX;
  const edgeY = dist > 0 ? loupeCenterY - (offsetY / dist) * LOUPE_RADIUS : loupeCenterY;

  return (
    <g className="cad-screen-magnifier" pointerEvents="none">
      <defs>
        <clipPath id="cad-magnifier-lens-clip">
          <circle cx={0} cy={0} r={LOUPE_RADIUS} />
        </clipPath>
        <filter id="cad-magnifier-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.75" />
        </filter>
        <pattern id="cad-magnifier-grid" width={magnification * 3} height={magnification * 3} patternUnits="userSpaceOnUse">
          <path
            d={`M ${magnification * 3} 0 L 0 0 0 ${magnification * 3}`}
            fill="none"
            stroke="rgba(56, 189, 248, 0.12)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>

      {/* Guide line linking cursor point to loupe rim */}
      <line
        x1={relX}
        y1={relY}
        x2={edgeX}
        y2={edgeY}
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.65}
      />

      {/* Crosshair at cursor position */}
      <g transform={`translate(${relX}, ${relY})`}>
        <circle cx={0} cy={0} r={6} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
        <circle cx={0} cy={0} r={1.5} fill="#38bdf8" />
        <line x1={-14} y1={0} x2={-6} y2={0} stroke="#38bdf8" strokeWidth={1.2} />
        <line x1={6} y1={0} x2={14} y2={0} stroke="#38bdf8" strokeWidth={1.2} />
        <line x1={0} y1={-14} x2={0} y2={-6} stroke="#38bdf8" strokeWidth={1.2} />
        <line x1={0} y1={6} x2={0} y2={14} stroke="#38bdf8" strokeWidth={1.2} />
      </g>

      {/* Floating Loupe Lens */}
      <g transform={`translate(${loupeCenterX}, ${loupeCenterY})`}>
        {/* Dark drop shadow backing circle */}
        <circle
          cx={0}
          cy={0}
          r={LOUPE_RADIUS}
          fill="#090d16"
          filter="url(#cad-magnifier-glow)"
        />

        {/* Magnified scene clipped to the circular lens */}
        <g clipPath="url(#cad-magnifier-lens-clip)">
          {/* Solid background in case board is transparent */}
          <rect
            x={-LOUPE_RADIUS}
            y={-LOUPE_RADIUS}
            width={LOUPE_RADIUS * 2}
            height={LOUPE_RADIUS * 2}
            fill="#090d16"
          />

          {/* Real-time magnified view of the board viewport */}
          <g transform={`scale(${magnification}) translate(${-relX}, ${-relY})`}>
            <use href="#cad-screen-viewport" xlinkHref="#cad-screen-viewport" />
          </g>

          {/* Subtle precision pixel grid inside the lens */}
          <rect
            x={-LOUPE_RADIUS}
            y={-LOUPE_RADIUS}
            width={LOUPE_RADIUS * 2}
            height={LOUPE_RADIUS * 2}
            fill="url(#cad-magnifier-grid)"
            pointerEvents="none"
          />
        </g>

        {/* Outer Bezel Rings */}
        <circle
          cx={0}
          cy={0}
          r={LOUPE_RADIUS}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={3.5}
        />
        <circle
          cx={0}
          cy={0}
          r={LOUPE_RADIUS - 2}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={1}
        />
        <circle
          cx={0}
          cy={0}
          r={LOUPE_RADIUS - 5}
          fill="none"
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth={0.75}
        />

        {/* Central Precision Crosshairs inside the lens */}
        <line x1={-24} y1={0} x2={-7} y2={0} stroke="#38bdf8" strokeWidth={1.5} />
        <line x1={7} y1={0} x2={24} y2={0} stroke="#38bdf8" strokeWidth={1.5} />
        <line x1={0} y1={-24} x2={0} y2={-7} stroke="#38bdf8" strokeWidth={1.5} />
        <line x1={0} y1={7} x2={0} y2={24} stroke="#38bdf8" strokeWidth={1.5} />
        <circle cx={0} cy={0} r={7} fill="none" stroke="#38bdf8" strokeWidth={1.2} />
        <circle cx={0} cy={0} r={1.5} fill="#38bdf8" />

        {/* Top Magnification Badge */}
        <g transform={`translate(0, ${-LOUPE_RADIUS - 14})`}>
          <rect
            x={-44}
            y={-11}
            width={88}
            height={22}
            rx={11}
            fill="rgba(2, 132, 199, 0.95)"
            stroke="#38bdf8"
            strokeWidth={1}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={11}
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {magnification}× ZOOM
          </text>
        </g>

        {/* Bottom Coordinates Badge */}
        <g transform={`translate(0, ${LOUPE_RADIUS + 14})`}>
          <rect
            x={-72}
            y={-11}
            width={144}
            height={22}
            rx={11}
            fill="rgba(15, 23, 42, 0.95)"
            stroke="#38bdf8"
            strokeWidth={1}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize={10.5}
            fontWeight="bold"
            fontFamily="monospace"
          >
            X:{worldMmX} Y:{worldMmY} мм
          </text>
        </g>
      </g>
    </g>
  );
};
