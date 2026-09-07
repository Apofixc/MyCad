import React, { useState } from "react";
import {
  Cpu,
  Zap,
  Plus,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid,
  Info,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";

export const SchematicCanvas: React.FC = () => {
  const { schematic, isDirty } = useProjectStore();
  const [zoom, setZoom] = useState(100);
  const [showGrid, setShowGrid] = useState(true);

  if (!schematic) return null;

  return (
    <div className="cad-viewport-container" style={{ position: "relative", width: "100%", height: "100%", background: "#0b0f19" }}>
      {/* Top Toolbar for Schematic */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "16px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(17, 24, 39, 0.85)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          padding: "6px 12px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Cpu size={16} color="#38bdf8" />
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#f1f5f9" }}>
            {schematic.name}
          </span>
        </div>
        <div style={{ width: "1px", height: "16px", background: "rgba(255, 255, 255, 0.15)", margin: "0 4px" }} />
        <button
          style={{
            background: "transparent",
            border: "none",
            color: showGrid ? "#38bdf8" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
          }}
          onClick={() => setShowGrid(!showGrid)}
          title="Сетка"
        >
          <Grid size={14} />
          Сетка
        </button>
        <div style={{ width: "1px", height: "16px", background: "rgba(255, 255, 255, 0.15)", margin: "0 4px" }} />
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "2px 4px",
          }}
          onClick={() => setZoom(Math.max(25, zoom - 10))}
          title="Уменьшить"
        >
          <ZoomOut size={14} />
        </button>
        <span style={{ fontSize: "11px", color: "#cbd5e1", minWidth: "40px", textAlign: "center" }}>
          {zoom}%
        </span>
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "2px 4px",
          }}
          onClick={() => setZoom(Math.min(400, zoom + 10))}
          title="Увеличить"
        >
          <ZoomIn size={14} />
        </button>
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "2px 4px",
          }}
          onClick={() => setZoom(100)}
          title="Сброс масштаба"
        >
          <Maximize size={14} />
        </button>
      </div>

      {/* Schematic workspace SVG / Canvas representation */}
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          backgroundImage: showGrid
            ? "radial-gradient(circle, rgba(255, 255, 255, 0.15) 1px, transparent 1px)"
            : "none",
          backgroundSize: `${20 * (zoom / 100)}px ${20 * (zoom / 100)}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "500px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px dashed rgba(56, 189, 248, 0.3)",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "12px",
              background: "rgba(56, 189, 248, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              border: "1px solid rgba(56, 189, 248, 0.2)",
            }}
          >
            <Cpu size={28} color="#38bdf8" />
          </div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#f8fafc" }}>
            {schematic.name}
          </h3>
          <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#94a3b8", lineHeight: "1.5" }}>
            Редактор принципиальной схемы. Поддерживает создание УГО компонентов, связывание цепей (nets) и синхронизацию со схемой платы (Forward/Backward Annotation).
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={() => alert("Добавление компонентов в схему будет доступно в библиотечном модуле")}
            >
              <Plus size={14} />
              Добавить компонент
            </button>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.06)",
                color: "#cbd5e1",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={() => alert("Создание электрической цепи")}
            >
              <Zap size={14} />
              Провести цепь (Net)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
