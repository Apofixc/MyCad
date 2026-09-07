import React from "react";
import { CheckCircle2, AlertCircle, Crosshair, Layers } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

export const StatusBar: React.FC = () => {
  const { cursorMm, viewportZoom, gridStepMm } = useUiStore();
  const { manifest, activeFileType, board, schematic, isDirty } = useProjectStore();

  const topCount = board?.data.bgTop.images.length || 0;
  const botCount = board?.data.bgBottom.images.length || 0;

  const activeDocName =
    activeFileType === "board"
      ? board?.name
      : activeFileType === "schematic"
      ? schematic?.name
      : "Нет открытого документа";

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
        <span>Проект: <strong>{manifest?.name || "Без названия"}</strong></span>
        <span>•</span>
        <span>Документ: <strong>{activeDocName}</strong></span>
        {activeFileType === "board" && (
          <>
            <span>•</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Layers size={12} color="#60a5fa" />
              <span>
                Сканов: <strong style={{ color: "var(--cad-top-layer)" }}>Top ({topCount})</strong> / <strong style={{ color: "var(--cad-bot-layer)" }}>Bottom ({botCount})</strong>
              </span>
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
        <span>Зум: {viewportZoom}%</span>
      </div>
    </footer>
  );
};
