import React, { useState, useEffect, useCallback } from "react";
import { Columns2, X, RotateCcw } from "lucide-react";

interface InteractiveCurtainProps {
  isActive: boolean;
  splitPercent: number; // 0..100
  onChangeSplitPercent: (percent: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  leftLabel?: string;
  rightLabel?: string;
}

export const InteractiveCurtain: React.FC<InteractiveCurtainProps> = ({
  isActive,
  splitPercent,
  onChangeSplitPercent,
  containerRef,
  onClose,
  leftLabel = "Top (Лицевая сторона)",
  rightLabel = "Bottom (Обратная сторона)",
}) => {
  if (!isActive) return null;

  const [isDragging, setIsDragging] = useState(false);

  const handleStartDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(5, Math.min(95, Math.round(rawPct * 10) / 10));
      onChangeSplitPercent(clamped);
    },
    [containerRef, isDragging, onChangeSplitPercent]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard shortcut Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="cad-interactive-curtain-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 35,
      }}
    >
      {/* 1. Top HUD comparison bar */}
      <div
        className="cad-curtain-hud-bar"
        style={{
          position: "absolute",
          top: "14px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "6px 14px",
          background: "rgba(15, 23, 42, 0.92)",
          border: "1px solid #38bdf8",
          borderRadius: "8px",
          color: "#f8fafc",
          fontSize: "12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          pointerEvents: "auto",
        }}
      >
        <Columns2 size={15} color="#38bdf8" />
        <span style={{ color: "#38bdf8", fontWeight: 600 }}>{leftLabel}</span>
        <span style={{ opacity: 0.6, fontSize: "11px" }}>⯬ {splitPercent.toFixed(0)}% ⯮</span>
        <span style={{ color: "#60a5fa", fontWeight: 600 }}>{rightLabel}</span>

        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

        <button
          className="cad-btn-flat btn-xs"
          onClick={() => onChangeSplitPercent(50)}
          title="Сбросить на 50/50"
          style={{ padding: "3px 6px", fontSize: "11px" }}
        >
          <RotateCcw size={12} />
          <span>50%</span>
        </button>

        <button
          className="cad-btn-flat btn-xs"
          onClick={onClose}
          title="Закрыть шторку (Esc)"
          style={{ padding: "3px 6px", fontSize: "11px", color: "#ef4444" }}
        >
          <X size={12} />
          <span>Закрыть</span>
        </button>
      </div>

      {/* 2. Vertical Divider Line with handle */}
      <div
        className="cad-curtain-divider-line"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${splitPercent}%`,
          width: "2px",
          backgroundColor: "#38bdf8",
          boxShadow: "0 0 10px rgba(56, 189, 248, 0.6)",
          pointerEvents: "auto",
          cursor: "ew-resize",
          transform: "translateX(-50%)",
        }}
        onMouseDown={handleStartDrag}
      >
        {/* Central Handle Button */}
        <div
          className="cad-curtain-handle-pill"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "28px",
            height: "44px",
            background: "#0284c7",
            border: "2px solid #ffffff",
            borderRadius: "14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            cursor: "ew-resize",
          }}
        >
          <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#fff", margin: "1.5px 0" }} />
          <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#fff", margin: "1.5px 0" }} />
          <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#fff", margin: "1.5px 0" }} />
        </div>
      </div>
    </div>
  );
};
