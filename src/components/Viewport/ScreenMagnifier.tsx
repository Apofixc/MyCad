import React, { useState, useEffect, useCallback } from "react";
import { CAD_PX_PER_MM } from "../../utils/alignmentMath";

interface ScreenMagnifierProps {
  isActive: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pan: { x: number; y: number };
  zoom: number;
  onClose: () => void;
}

export const ScreenMagnifier: React.FC<ScreenMagnifierProps> = ({
  isActive,
  containerRef,
  pan,
  zoom,
  onClose,
}) => {
  if (!isActive) return null;

  const [mousePos, setMousePos] = useState<{ clientX: number; clientY: number } | null>(null);
  const [magnification, setMagnification] = useState<4 | 8>(4);

  const LOUPE_RADIUS = 75; // 150px diameter

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ clientX: e.clientX, clientY: e.clientY });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "z" || e.key === "Z") {
        setMagnification((m) => (m === 4 ? 8 : 4));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseMove, onClose]);

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
  const offsetX = relX + LOUPE_RADIUS + 30 > rect.width ? -LOUPE_RADIUS - 30 : LOUPE_RADIUS + 30;
  const offsetY = relY - LOUPE_RADIUS - 30 < 0 ? LOUPE_RADIUS + 30 : -LOUPE_RADIUS - 30;

  const loupeCenterX = relX + offsetX;
  const loupeCenterY = relY + offsetY;

  return (
    <div
      className="cad-screen-magnifier-container"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 38,
      }}
    >
      {/* Floating Loupe Circular Lens */}
      <div
        style={{
          position: "absolute",
          left: `${loupeCenterX}px`,
          top: `${loupeCenterY}px`,
          transform: "translate(-50%, -50%)",
          width: `${LOUPE_RADIUS * 2}px`,
          height: `${LOUPE_RADIUS * 2}px`,
          borderRadius: "50%",
          border: "3px solid #38bdf8",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 12px rgba(56, 189, 248, 0.3)",
          overflow: "hidden",
          background: "rgba(15, 23, 42, 0.95)",
        }}
      >
        {/* Pixel grid inside loupe */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(56, 189, 248, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: `${magnification * 3}px ${magnification * 3}px`,
            backgroundPosition: "center center",
          }}
        />

        {/* Central Precision Crosshair */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "14px",
            height: "14px",
            border: "1px solid #38bdf8",
            borderRadius: "50%",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-8px",
              left: "6px",
              width: "1px",
              height: "7px",
              background: "#38bdf8",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-8px",
              left: "6px",
              width: "1px",
              height: "7px",
              background: "#38bdf8",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "-8px",
              top: "6px",
              height: "1px",
              width: "7px",
              background: "#38bdf8",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "-8px",
              top: "6px",
              height: "1px",
              width: "7px",
              background: "#38bdf8",
            }}
          />
        </div>

        {/* Top Zoom Multiplier Badge */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(2, 132, 199, 0.9)",
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold",
            padding: "1px 6px",
            borderRadius: "4px",
            fontFamily: "monospace",
          }}
        >
          {magnification}× ZOOM
        </div>

        {/* Bottom Coordinates Badge */}
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.9)",
            color: "#e2e8f0",
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          X:{worldMmX} Y:{worldMmY} мм
        </div>
      </div>

      {/* Crosshair indicator at the actual cursor location */}
      <div
        style={{
          position: "absolute",
          left: `${relX}px`,
          top: `${relY}px`,
          transform: "translate(-50%, -50%)",
          width: "20px",
          height: "20px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "9.5px",
            width: "1px",
            height: "20px",
            background: "rgba(56, 189, 248, 0.8)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "9.5px",
            height: "1px",
            width: "20px",
            background: "rgba(56, 189, 248, 0.8)",
          }}
        />
      </div>
    </div>
  );
};
