import React from "react";
import {
  Image as ImageIcon,
  Sliders,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Compass,
  Ruler,
  Layers,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const InspectorSidebar: React.FC = () => {
  const {
    board,
    selectedImageId,
    updateImageLayer,
  } = useProjectStore();

  const {
    rightSidebarWidth,
    setRightSidebarWidth,
    setActiveTool,
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

  const imgLayer =
    board?.data.bgTop.images.find((i) => i.id === selectedImageId) ||
    board?.data.bgBottom.images.find((i) => i.id === selectedImageId) ||
    board?.data.bgTop.images[0] ||
    board?.data.bgBottom.images[0];

  if (!imgLayer) {
    return (
      <aside className="cad-sidebar cad-sidebar-right" style={{ width: `${rightSidebarWidth}px` }}>
        <div className="cad-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Sliders size={14} color="#60a5fa" />
            <span>Инспектор слоев</span>
          </div>
        </div>
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--cad-text-dim)", fontSize: "12px" }}>
          Загрузите скан платы (Top или Bottom) для настройки калибровки и совмещения
        </div>
      </aside>
    );
  }

  const isTop = imgLayer.side === "top";

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

      <div className="cad-sidebar-header" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", flex: 1 }}>
          <ImageIcon size={14} color={isTop ? "var(--cad-top-layer)" : "var(--cad-bot-layer)"} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isTop ? "Top" : "Bottom"}: <strong>{imgLayer.name}</strong>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <button
            className="cad-tree-icon-btn"
            onClick={() => updateImageLayer({ ...imgLayer, visible: !imgLayer.visible })}
            title={imgLayer.visible ? "Скрыть слой" : "Показать слой"}
          >
            {imgLayer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            className="cad-tree-icon-btn"
            onClick={() => updateImageLayer({ ...imgLayer, locked: !imgLayer.locked })}
            title={imgLayer.locked ? "Разблокировать слой" : "Заблокировать слой"}
          >
            {imgLayer.locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
          </button>
        </div>
      </div>

      <div className="cad-sidebar-content">
        {imgLayer.locked && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "6px",
              padding: "7px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fbbf24",
              fontSize: "11px",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Lock size={13} color="#f59e0b" />
              <span>Слой заблокирован</span>
            </div>
            <button
              className="cad-btn cad-btn-secondary"
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                background: "rgba(245, 158, 11, 0.2)",
                borderColor: "rgba(245, 158, 11, 0.4)",
                color: "#fef3c7",
              }}
              onClick={() => updateImageLayer({ ...imgLayer, locked: false })}
              title="Разблокировать слой"
            >
              Разблокировать
            </button>
          </div>
        )}

        <div style={{ opacity: imgLayer.locked ? 0.5 : 1, pointerEvents: imgLayer.locked ? "none" : "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Alignment & Scale */}
        <div className="cad-prop-group">
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--cad-text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Ruler size={12} />
            <span>Геометрия и масштаб</span>
          </div>

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

          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <button
              className="cad-btn cad-btn-secondary"
              style={{ flex: 1, fontSize: "11px", padding: "5px" }}
              onClick={() => setActiveTool("calibrate")}
              title="Кликните 2 точки на известном расстоянии (например, 2.54 мм)"
            >
              📏 Масштаб (2 точки)
            </button>
            <button
              className="cad-btn cad-btn-secondary"
              style={{ flex: 1, fontSize: "11px", padding: "5px" }}
              onClick={() => setActiveTool("level")}
              title="Кликните 2 точки края платы для выравнивания горизонта"
            >
              🧭 Горизонт (2 точки)
            </button>
          </div>
        </div>

        {/* Orientation & Flips */}
        <div className="cad-prop-group">
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--cad-text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Compass size={12} />
            <span>Ориентация и совмещение</span>
          </div>

          <div className="cad-prop-row">
            <span className="cad-prop-label">Угол поворота: {Math.round(imgLayer.rotation)}°</span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                className="cad-btn cad-btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => updateImageLayer({ ...imgLayer, rotation: imgLayer.rotation - 90 })}
                title="Поворот -90°"
              >
                <RotateCcw size={12} />
              </button>
              <button
                className="cad-btn cad-btn-secondary"
                style={{ padding: "4px 8px" }}
                onClick={() => updateImageLayer({ ...imgLayer, rotation: imgLayer.rotation + 90 })}
                title="Поворот +90°"
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
                title="Отразить по горизонтали (Flip X)"
              >
                <FlipHorizontal size={12} />
              </button>
              <button
                className={`cad-btn cad-btn-secondary ${imgLayer.flipV ? "active" : ""}`}
                style={{ padding: "4px 8px" }}
                onClick={() => updateImageLayer({ ...imgLayer, flipV: !imgLayer.flipV })}
                title="Отразить по вертикали (Flip Y)"
              >
                <FlipVertical size={12} />
              </button>
            </div>
          </div>

          <button
            className="cad-btn cad-btn-secondary"
            style={{ width: "100%", fontSize: "11px", marginTop: "6px" }}
            onClick={() => setActiveTool("register")}
            title="Совместить Top и Bottom стороны по 2 переходным отверстиям или углам"
          >
            🎯 Аффинное совмещение слоев
          </button>
        </div>

        {/* Optical Filters */}
        <div className="cad-prop-group">
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--cad-text-muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Layers size={12} />
            <span>Оптические фильтры слоя</span>
          </div>

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
    </div>
    </aside>
  );
};
