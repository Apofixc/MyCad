import React, { useEffect, useRef } from "react";
import { useUiStore } from "../../stores/uiStore";

interface MagnifierLoupeProps {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const MagnifierLoupe: React.FC<MagnifierLoupeProps> = ({ sourceCanvasRef }) => {
  const { loupeActive, activeTool, loupeMagnification, setLoupeMagnification } = useUiStore();
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = loupeActive || activeTool === "magnifier";

  useEffect(() => {
    if (!isActive) return;

    const onMouseMove = (e: MouseEvent) => {
      const sourceCanvas = sourceCanvasRef.current;
      const loupeCanvas = loupeCanvasRef.current;
      const container = containerRef.current;
      if (!sourceCanvas || !loupeCanvas || !container) return;

      const rect = sourceCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
        container.style.display = "none";
        return;
      }

      container.style.display = "block";
      container.style.left = `${e.clientX + 20}px`;
      container.style.top = `${e.clientY + 20}px`;

      const dpr = window.devicePixelRatio || 1;
      const size = 180;
      const mag = loupeMagnification;
      const sampleSize = size / mag;

      // Ensure crisp high-DPI rendering on loupe canvas
      if (loupeCanvas.width !== size * dpr || loupeCanvas.height !== size * dpr) {
        loupeCanvas.width = size * dpr;
        loupeCanvas.height = size * dpr;
      }

      const ctx = loupeCanvas.getContext("2d");
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false; // Sharp pixelated zoom for inspecting micro-traces

      // Draw magnified region from main canvas buffer with exact DPR scaling
      const sourceX = (mouseX - sampleSize / 2) * dpr;
      const sourceY = (mouseY - sampleSize / 2) * dpr;
      const sourceW = sampleSize * dpr;
      const sourceH = sampleSize * dpr;

      ctx.drawImage(
        sourceCanvas,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        0,
        0,
        size,
        size
      );

      // Draw crosshair reticle
      ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
      ctx.lineWidth = 1;

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(size / 2 - 14, size / 2);
      ctx.lineTo(size / 2 + 14, size / 2);
      ctx.moveTo(size / 2, size / 2 - 14);
      ctx.lineTo(size / 2, size / 2 + 14);
      ctx.stroke();

      // Inner reticle circle
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [isActive, loupeMagnification, sourceCanvasRef]);

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        pointerEvents: "none",
        zIndex: 50,
        display: "none",
      }}
    >
      <div
        style={{
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #3b82f6",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(59,130,246,0.5)",
          background: "#0c0e12",
          position: "relative",
        }}
      >
        <canvas ref={loupeCanvasRef} width={180} height={180} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(15,23,42,0.9)",
          border: "1px solid #3b82f6",
          borderRadius: "10px",
          padding: "1px 8px",
          fontSize: "10px",
          fontFamily: "var(--cad-font-mono)",
          color: "#93c5fd",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {loupeMagnification}x ZOOM
      </div>
    </div>
  );
};
