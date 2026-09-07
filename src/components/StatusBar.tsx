import React from "react";
import { CheckCircle2, AlertCircle, Zap, Crosshair } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

export const StatusBar: React.FC = () => {
  const { cursorMm, viewportZoom, gridStepMm } = useUiStore();
  const { board, isDirty, activeNetId, crossProbingPins, selectNet } = useProjectStore();

  const totalComps = board?.data.components.length || 0;

  return (
    <footer className="cad-status-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {isDirty ? (
            <>
              <AlertCircle size={13} color="#f59e0b" />
              <span style={{ color: "#f59e0b" }}>Не сохранено</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={13} color="#10b981" />
              <span>Сохранено</span>
            </>
          )}
        </div>

        <span>•</span>
        <span>Документ: <strong>{board?.name || "board"}</strong></span>
        <span>•</span>
        <span>Компонентов: <strong>{totalComps}</strong></span>

        {activeNetId && (
          <>
            <span>•</span>
            <div
              className="cad-status-net-badge"
              style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}
              onClick={() => selectNet(null)}
              title="Нажмите, чтобы сбросить выделение цепи"
            >
              <Zap size={11} color="#34d399" />
              <span>Цепь: {activeNetId} ({crossProbingPins.length} точек)</span>
              <span style={{ fontSize: "9px", opacity: 0.7 }}>✕</span>
            </div>
          </>
        )}
      </div>

      <div className="cad-status-badge">
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Crosshair size={12} color="#60a5fa" />
          <span>X: <span className="cad-hud-coord">{cursorMm.x.toFixed(2)} мм</span></span>
          <span style={{ marginLeft: "6px" }}>Y: <span className="cad-hud-coord">{cursorMm.y.toFixed(2)} мм</span></span>
        </div>
        <span>•</span>
        <span>Сетка: {gridStepMm.toFixed(1)} мм</span>
        <span>•</span>
        <span>Масштаб: {viewportZoom}%</span>
      </div>
    </footer>
  );
};
