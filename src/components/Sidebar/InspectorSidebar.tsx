import React from "react";
import {
  Cpu,
  Image,
  Repeat,
  Zap,
  Trash2,
  Maximize2,
  Sliders,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const InspectorSidebar: React.FC = () => {
  const {
    board,
    selectedComponentId,
    selectedImageId,
    activeNetId,
    crossProbingPins,
    updateComponent,
    deleteComponent,
    updateImageLayer,
    selectNet,
  } = useProjectStore();

  const {
    rightSidebarWidth,
    setRightSidebarWidth,
    setActiveTool,
    setViewportPan,
  } = useUiStore();

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setRightSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Find selected component or image
  const comp = board?.data.components.find((c) => c.id === selectedComponentId);
  const imgLayer =
    board?.data.bgTop.images.find((i) => i.id === selectedImageId) ||
    board?.data.bgBottom.images.find((i) => i.id === selectedImageId);

  if (!comp && !imgLayer) {
    return (
      <aside className="cad-sidebar cad-sidebar-right" style={{ width: `${rightSidebarWidth}px` }}>
        <div className="cad-sidebar-header">
          <span>Инспектор свойств</span>
        </div>
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--cad-text-dim)", fontSize: "12px" }}>
          Выберите деталь или скан на плате для инспекции
        </div>
      </aside>
    );
  }

  // Component Inspector
  if (comp) {
    const handleFlipLayer = () => {
      const nextLayer = comp.layer === "top" ? "bottom" : "top";
      // Mirror relX for pins when flipping layer
      const nextPins = comp.pins.map((p) => ({ ...p, relX: -p.relX }));
      updateComponent({ ...comp, layer: nextLayer, pins: nextPins });
    };

    const handleRotate = () => {
      const nextRot = (comp.rotation + 90) % 360;
      updateComponent({ ...comp, rotation: nextRot });
    };

    return (
      <aside className="cad-sidebar cad-sidebar-right" style={{ width: `${rightSidebarWidth}px` }}>
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            zIndex: 10,
          }}
        />

        <div className="cad-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Cpu size={14} color={comp.layer === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)"} />
            <span>Деталь: <strong>{comp.refDes}</strong></span>
          </div>
          <button
            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
            onClick={() => deleteComponent(comp.id)}
            title="Удалить деталь"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="cad-sidebar-content">
          {/* Main Info */}
          <div className="cad-prop-group">
            <div className="cad-prop-row">
              <span className="cad-prop-label">Обозначение</span>
              <input
                className="cad-prop-input"
                value={comp.refDes}
                onChange={(e) => updateComponent({ ...comp, refDes: e.target.value })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Номинал</span>
              <input
                className="cad-prop-input"
                value={comp.value || ""}
                placeholder="10k, 100nF..."
                onChange={(e) => updateComponent({ ...comp, value: e.target.value })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Слой</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: comp.layer === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)" }}>
                  {comp.layer.toUpperCase()}
                </span>
                <button
                  className="cad-btn cad-btn-secondary"
                  style={{ padding: "2px 8px", fontSize: "10px" }}
                  onClick={handleFlipLayer}
                  title="Перенести на противоположный слой платы"
                >
                  <Repeat size={11} /> Flip
                </button>
              </div>
            </div>
          </div>

          {/* Coordinates & Geometry */}
          <div className="cad-prop-group">
            <div className="cad-prop-row">
              <span className="cad-prop-label">Позиция X (мм)</span>
              <input
                type="number"
                step="0.1"
                className="cad-prop-input"
                value={comp.x}
                onChange={(e) => updateComponent({ ...comp, x: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Позиция Y (мм)</span>
              <input
                type="number"
                step="0.1"
                className="cad-prop-input"
                value={comp.y}
                onChange={(e) => updateComponent({ ...comp, y: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Угол поворота</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontFamily: "var(--cad-font-mono)", fontSize: "11px" }}>{comp.rotation}°</span>
                <button
                  className="cad-btn cad-btn-secondary"
                  style={{ padding: "2px 6px" }}
                  onClick={handleRotate}
                >
                  <RotateCw size={11} /> +90°
                </button>
              </div>
            </div>
          </div>

          {/* Pinout Table */}
          <div className="cad-prop-group">
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--cad-text-main)", marginBottom: "4px" }}>
              Таблица выводов (Пины)
            </div>
            <table className="cad-pin-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Сигнал</th>
                  <th>Цепь (Net ID)</th>
                </tr>
              </thead>
              <tbody>
                {comp.pins.map((pin) => (
                  <tr
                    key={pin.id}
                    className={activeNetId && pin.netId === activeNetId ? "active" : ""}
                    onClick={() => selectNet(pin.netId || null)}
                  >
                    <td style={{ fontWeight: 600 }}>{pin.pinNumber}</td>
                    <td style={{ color: "var(--cad-text-dim)" }}>{pin.name || "-"}</td>
                    <td>
                      <input
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: pin.netId ? "#4ade80" : "var(--cad-text-muted)",
                          fontSize: "11px",
                          fontFamily: "var(--cad-font-mono)",
                        }}
                        value={pin.netId || ""}
                        placeholder="нет цепи"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const nextPins = comp.pins.map((p) =>
                            p.id === pin.id ? { ...p, netId: val || undefined } : p
                          );
                          updateComponent({ ...comp, pins: nextPins });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cross-Probing block */}
          {activeNetId && (
            <div className="cad-prop-group" style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34d399", fontWeight: 600, fontSize: "12px" }}>
                <Zap size={13} />
                <span>Cross-Probing: {activeNetId}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-dim)" }}>
                Соединено выводов: {crossProbingPins.length}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "150px", overflowY: "auto" }}>
                {crossProbingPins.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      background: "var(--cad-bg-deep)",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                  >
                    <span>
                      <strong>{p.refDes}</strong> (пин {p.pinNumber}) [{p.layer}]
                    </span>
                    <button
                      style={{ background: "transparent", border: "none", color: "#38bdf8", cursor: "pointer", padding: "2px" }}
                      onClick={() => setViewportPan({ x: -p.absX * 10, y: -p.absY * 10 })}
                      title="Центрировать холст на этом пине"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Image Layer Inspector
  if (imgLayer) {
    return (
      <aside className="cad-sidebar cad-sidebar-right" style={{ width: `${rightSidebarWidth}px` }}>
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            zIndex: 10,
          }}
        />

        <div className="cad-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Image size={14} color={imgLayer.side === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)"} />
            <span>Скан: <strong>{imgLayer.name}</strong></span>
          </div>
        </div>

        <div className="cad-sidebar-content">
          {/* Alignment & Scale */}
          <div className="cad-prop-group">
            <div className="cad-prop-row">
              <span className="cad-prop-label">Смещение X (мм)</span>
              <input
                type="number"
                step="0.5"
                className="cad-prop-input"
                value={imgLayer.offsetX}
                onChange={(e) => updateImageLayer({ ...imgLayer, offsetX: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Смещение Y (мм)</span>
              <input
                type="number"
                step="0.5"
                className="cad-prop-input"
                value={imgLayer.offsetY}
                onChange={(e) => updateImageLayer({ ...imgLayer, offsetY: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Калибровка (px/мм)</span>
              <input
                type="number"
                step="0.1"
                className="cad-prop-input"
                value={imgLayer.pxPerMm}
                onChange={(e) => updateImageLayer({ ...imgLayer, pxPerMm: parseFloat(e.target.value) || 23.62 })}
              />
            </div>
            <button
              className="cad-btn cad-btn-secondary"
              style={{ fontSize: "11px", marginTop: "4px" }}
              onClick={() => setActiveTool("calibrate")}
            >
              📏 Откалибровать по 2 точкам
            </button>
          </div>

          {/* Orientation & Flips */}
          <div className="cad-prop-group">
            <div className="cad-prop-row">
              <span className="cad-prop-label">Поворот</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  className="cad-btn cad-btn-secondary"
                  style={{ padding: "4px 8px" }}
                  onClick={() => updateImageLayer({ ...imgLayer, rotation: imgLayer.rotation - 90 })}
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  className="cad-btn cad-btn-secondary"
                  style={{ padding: "4px 8px" }}
                  onClick={() => updateImageLayer({ ...imgLayer, rotation: imgLayer.rotation + 90 })}
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Отражение</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  className={`cad-btn cad-btn-secondary ${imgLayer.mirrored ? "active" : ""}`}
                  style={{ padding: "4px 8px" }}
                  onClick={() => updateImageLayer({ ...imgLayer, mirrored: !imgLayer.mirrored })}
                  title="Flip X"
                >
                  <FlipHorizontal size={12} />
                </button>
                <button
                  className={`cad-btn cad-btn-secondary ${imgLayer.flipV ? "active" : ""}`}
                  style={{ padding: "4px 8px" }}
                  onClick={() => updateImageLayer({ ...imgLayer, flipV: !imgLayer.flipV })}
                  title="Flip Y"
                >
                  <FlipVertical size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Color adjustments */}
          <div className="cad-prop-group">
            <div className="cad-prop-row">
              <span className="cad-prop-label">Прозрачность ({Math.round(imgLayer.opacity * 100)}%)</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                className="cad-prop-slider"
                value={imgLayer.opacity}
                onChange={(e) => updateImageLayer({ ...imgLayer, opacity: parseFloat(e.target.value) })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Яркость ({Math.round(imgLayer.brightness)}%)</span>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                className="cad-prop-slider"
                value={imgLayer.brightness}
                onChange={(e) => updateImageLayer({ ...imgLayer, brightness: parseFloat(e.target.value) })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Контраст ({Math.round(imgLayer.contrast)}%)</span>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                className="cad-prop-slider"
                value={imgLayer.contrast}
                onChange={(e) => updateImageLayer({ ...imgLayer, contrast: parseFloat(e.target.value) })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Инверсия (Dark Scan)</span>
              <input
                type="checkbox"
                checked={imgLayer.invert}
                onChange={(e) => updateImageLayer({ ...imgLayer, invert: e.target.checked })}
              />
            </div>
            <div className="cad-prop-row">
              <span className="cad-prop-label">Оттенки серого</span>
              <input
                type="checkbox"
                checked={imgLayer.grayscale}
                onChange={(e) => updateImageLayer({ ...imgLayer, grayscale: e.target.checked })}
              />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return null;
};
