import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Crosshair, Layers, Activity } from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";
import { useErrorStore } from "../stores/errorStore";

export const StatusBar: React.FC = () => {
  const { cursorMm, viewportZoom, gridStepMm } = useUiStore();
  const { manifest, activeFileType, board, schematic, isDirty } = useProjectStore();
  const { errors, openLogModal } = useErrorStore();

  const errorCount = errors.filter((e) => e.level === "error").length;
  const warningCount = errors.filter((e) => e.level === "warning").length;

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

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {errorCount > 0 ? (
          <button
            onClick={openLogModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "rgba(239, 68, 68, 0.18)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "4px",
              padding: "2px 8px",
              color: "#fca5a5",
              fontSize: "11px",
              cursor: "pointer",
              fontWeight: 500,
            }}
            title="Открыть журнал ошибок"
          >
            <AlertCircle size={12} color="#ef4444" />
            <span>{errorCount} {errorCount === 1 ? "ошибка" : errorCount < 5 ? "ошибки" : "ошибок"}</span>
          </button>
        ) : warningCount > 0 ? (
          <button
            onClick={openLogModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "rgba(245, 158, 11, 0.18)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: "4px",
              padding: "2px 8px",
              color: "#fde68a",
              fontSize: "11px",
              cursor: "pointer",
              fontWeight: 500,
            }}
            title="Открыть журнал событий"
          >
            <AlertTriangle size={12} color="#f59e0b" />
            <span>{warningCount} пред.</span>
          </button>
        ) : (
          <button
            onClick={openLogModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "transparent",
              border: "none",
              padding: "2px 5px",
              color: "var(--cad-text-dim)",
              fontSize: "11px",
              cursor: "pointer",
              borderRadius: "3px",
            }}
            title="Журнал событий и диагностики"
          >
            <Activity size={12} color="#64748b" />
          </button>
        )}

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
      </div>
    </footer>
  );
};
