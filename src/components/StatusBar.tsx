import React from "react";
import { CheckCircle2, AlertCircle, Crosshair, Layers, FileText, Grid, ZoomIn } from "lucide-react";
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
      <div className="cad-status-left">
        {/* Save state pill */}
        <div className={`cad-status-pill ${isDirty ? "cad-status-dirty" : "cad-status-clean"}`}>
          {isDirty ? (
            <>
              <AlertCircle size={13} color="#f59e0b" />
              <span>Не сохранено</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={13} color="#10b981" />
              <span>Сохранено</span>
            </>
          )}
        </div>

        {/* Project & Doc capsule */}
        <div className="cad-status-pill cad-status-info">
          <span>{manifest?.name || "Без названия"}</span>
          <span className="cad-status-dot">•</span>
          <span style={{ color: "#fff" }}>{activeDocName}</span>
        </div>

        {activeFileType === "board" && (
          <div className="cad-status-pill cad-status-layers">
            <Layers size={12} color="#60a5fa" />
            <span>
              Сканы: <strong style={{ color: "var(--cad-top-layer)" }}>Top ({topCount})</strong>
              {" / "}
              <strong style={{ color: "var(--cad-bottom-layer)" }}>Bottom ({botCount})</strong>
            </span>
          </div>
        )}
      </div>

      <div className="cad-status-right">
        {/* Coordinates Capsule */}
        <div className="cad-status-pill cad-status-coords">
          <Crosshair size={12} color="#60a5fa" />
          <span>
            X: <strong className="cad-hud-coord">{cursorMm.x.toFixed(2)}</strong> мм
          </span>
          <span className="cad-status-dot">•</span>
          <span>
            Y: <strong className="cad-hud-coord">{cursorMm.y.toFixed(2)}</strong> мм
          </span>
        </div>

        {/* Grid Capsule */}
        <div className="cad-status-pill">
          <Grid size={12} color="#94a3b8" />
          <span>Сетка: <strong>{gridStepMm.toFixed(1)}</strong> мм</span>
        </div>

        {/* Zoom Capsule */}
        <div className="cad-status-pill">
          <ZoomIn size={12} color="#94a3b8" />
          <span>Зум: <strong>{viewportZoom}%</strong></span>
        </div>
      </div>
    </footer>
  );
};
