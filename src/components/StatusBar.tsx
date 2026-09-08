import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Crosshair,
  Layers,
  FileText,
  Grid,
  ZoomIn,
  Maximize2,
  ChevronUp,
  Check,
} from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

export const StatusBar: React.FC = () => {
  const cursorMm = useUiStore((s) => s.cursorMm);
  const viewportZoom = useUiStore((s) => s.viewportZoom);
  const gridStepMm = useUiStore((s) => s.gridStepMm);
  const setGridStepMm = useUiStore((s) => s.setGridStepMm);
  const showGrid = useUiStore((s) => s.showGrid);
  const toggleGrid = useUiStore((s) => s.toggleGrid);
  const fitAllImages = useUiStore((s) => s.fitAllImages);
  const { manifest, activeFileType, board, schematic, isDirty } = useProjectStore();

  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const [customStep, setCustomStep] = useState(gridStepMm.toString());
  const gridMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isGridMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target as Node)) {
        setIsGridMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsGridMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGridMenuOpen]);

  const handleApplyCustomStep = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(customStep.replace(",", "."));
    if (!isNaN(val) && val > 0 && val <= 100) {
      setGridStepMm(val);
      setIsGridMenuOpen(false);
    }
  };

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
              Сканы: <strong style={{ color: "#60a5fa" }}>Top ({topCount})</strong>
              {" / "}
              <strong style={{ color: "#cbd5e1" }}>Bottom ({botCount})</strong>
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

        {/* Grid Capsule & Popover */}
        <div className="cad-grid-menu-anchor" ref={gridMenuRef}>
          <div
            className={`cad-status-pill cad-status-btn ${isGridMenuOpen ? "active" : ""}`}
            onClick={() => {
              setIsGridMenuOpen((prev) => !prev);
              setCustomStep(gridStepMm.toString());
            }}
            title="Настройка шага и параметров координатной сетки (клик для меню)"
          >
            <Grid size={12} color={showGrid ? "#60a5fa" : "#64748b"} />
            <span>
              Сетка:{" "}
              <strong style={{ color: showGrid ? "#60a5fa" : "#94a3b8" }}>
                {showGrid ? `${gridStepMm} мм` : "Выкл"}
              </strong>
            </span>
            <ChevronUp
              size={11}
              color="#94a3b8"
              style={{
                marginLeft: 1,
                transform: isGridMenuOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s ease",
              }}
            />
          </div>

          {/* Grid Settings Popover */}
          {isGridMenuOpen && (
            <div className="cad-grid-popover" onClick={(e) => e.stopPropagation()}>
              <div className="cad-grid-popover-header">
                <div className="cad-grid-popover-title">
                  <Grid size={13} color="#60a5fa" />
                  <span>Координатная сетка</span>
                </div>
                <button
                  type="button"
                  className={`cad-grid-toggle-btn ${showGrid ? "active" : ""}`}
                  onClick={() => toggleGrid()}
                  title="Переключить видимость сетки (G)"
                >
                  <span className="cad-grid-toggle-indicator" />
                  <span>{showGrid ? "Вкл" : "Выкл"}</span>
                  <span className="cad-grid-kbd-badge">G</span>
                </button>
              </div>

              {/* Metric Presets */}
              <div className="cad-grid-section">
                <div className="cad-grid-section-label">Метрический шаг (мм)</div>
                <div className="cad-grid-preset-grid">
                  {[0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0].map((val) => {
                    const isCurrent = Math.abs(gridStepMm - val) < 0.001;
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`cad-grid-chip ${isCurrent ? "active" : ""}`}
                        onClick={() => {
                          setGridStepMm(val);
                          setCustomStep(val.toString());
                        }}
                      >
                        {isCurrent && <Check size={10} className="cad-grid-chip-icon" />}
                        <span>{val} мм</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Imperial / DIP Presets */}
              <div className="cad-grid-section">
                <div className="cad-grid-section-label">Дюймовые / Шаг выводов (PCB)</div>
                <div className="cad-grid-preset-grid">
                  {[
                    { label: "0.635 мм (25 mil)", val: 0.635 },
                    { label: "1.27 мм (50 mil)", val: 1.27 },
                    { label: "2.54 мм (100 mil / DIP)", val: 2.54 },
                  ].map((item) => {
                    const isCurrent = Math.abs(gridStepMm - item.val) < 0.001;
                    return (
                      <button
                        key={item.val}
                        type="button"
                        className={`cad-grid-chip cad-grid-chip-wide ${isCurrent ? "active" : ""}`}
                        onClick={() => {
                          setGridStepMm(item.val);
                          setCustomStep(item.val.toString());
                        }}
                      >
                        {isCurrent && <Check size={10} className="cad-grid-chip-icon" />}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Value Form */}
              <form className="cad-grid-custom-form" onSubmit={handleApplyCustomStep}>
                <div className="cad-grid-section-label">Произвольный шаг</div>
                <div className="cad-grid-custom-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="cad-grid-custom-input"
                    value={customStep}
                    onChange={(e) => setCustomStep(e.target.value)}
                    placeholder="Например: 0.8"
                    autoFocus
                  />
                  <span className="cad-grid-unit-label">мм</span>
                  <button type="submit" className="cad-grid-apply-btn">
                    OK
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Zoom Capsule */}
        <div
          className="cad-status-pill cad-status-btn"
          onClick={() => fitAllImages()}
          title="Вписать все изображения (F / 0)"
        >
          <ZoomIn size={12} color="#94a3b8" />
          <span>Зум: <strong>{viewportZoom}%</strong></span>
          <Maximize2 size={11} color="#60a5fa" style={{ marginLeft: 3 }} />
        </div>
      </div>
    </footer>
  );
};
