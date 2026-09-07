import React, { useRef, useEffect } from "react";
import { Repeat } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";

export const CurtainSlider: React.FC = () => {
  const {
    activeTool,
    curtainPosition,
    setCurtainPosition,
    curtainVertical,
    toggleCurtainOrientation,
    setShowTopLayer,
    setShowBottomLayer,
  } = useUiStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // When curtain tool is active, ensure both Top and Bottom scans are visible for comparison
  useEffect(() => {
    if (activeTool === "curtain") {
      const { showTopLayer, showBottomLayer } = useUiStore.getState();
      if (!showTopLayer) setShowTopLayer(true);
      if (!showBottomLayer) setShowBottomLayer(true);
    }
  }, [activeTool, setShowTopLayer, setShowBottomLayer]);

  if (activeTool !== "curtain") return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (curtainVertical) {
        const ratio = (moveEvent.clientX - rect.left) / rect.width;
        setCurtainPosition(ratio);
      } else {
        const ratio = (moveEvent.clientY - rect.top) / rect.height;
        setCurtainPosition(ratio);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const posPct = `${(curtainPosition * 100).toFixed(1)}%`;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 14,
      }}
    >
      {/* Curtain Line */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setCurtainPosition(0.5)}
        style={{
          position: "absolute",
          ...(curtainVertical
            ? {
                left: posPct,
                top: 0,
                bottom: 0,
                width: "6px",
                transform: "translateX(-50%)",
                cursor: "ew-resize",
                borderLeft: "2px dashed #06b6d4",
                boxShadow: "0 0 10px rgba(6, 182, 212, 0.6)",
              }
            : {
                top: posPct,
                left: 0,
                right: 0,
                height: "6px",
                transform: "translateY(-50%)",
                cursor: "ns-resize",
                borderTop: "2px dashed #06b6d4",
                boxShadow: "0 0 10px rgba(6, 182, 212, 0.6)",
              }),
          pointerEvents: "auto",
        }}
      >
        {/* Floating Handle */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 10px",
            background: "rgba(12, 14, 18, 0.9)",
            border: "1px solid #06b6d4",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.6)",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            cursor: "grab",
          }}
        >
          <span style={{ color: "var(--cad-top-layer)" }}>TOP</span>
          <span>↔</span>
          <span style={{ color: "var(--cad-bottom-layer)" }}>BOTTOM</span>
          <button
            style={{
              background: "transparent",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "2px",
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleCurtainOrientation();
            }}
            title="Переключить ориентацию шторки (вертикальная/горизонтальная)"
          >
            <Repeat size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
