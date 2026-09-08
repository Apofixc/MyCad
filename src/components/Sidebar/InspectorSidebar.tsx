import React from "react";
import {
  Image as ImageIcon,
  Move,
  Compass,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Ruler,
  Layers,
  Zap,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  X,
  Upload,
  Copy,
  Download,
  Link,
  Unlink,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { BoardImageLayer } from "../../types/cad";
import { engineClient, resolveImageUrl } from "../../api/engineClient";
import { notifySuccess, notifyWarning, reportError } from "../../utils/errorHandler";

export const InspectorSidebar: React.FC = () => {
  const {
    board,
    selectedImageId,
    selectImage,
    updateImageLayer,
  } = useProjectStore();

  const {
    rightSidebarWidth,
    setRightSidebarWidth,
    setActiveTool,
  } = useUiStore();

  // Resize handler for right sidebar
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(260, Math.min(600, startWidth - (moveEvent.clientX - startX)));
      setRightSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Strictly single image selection
  const imgLayer =
    board?.data?.bgTop?.images?.find((i) => i.id === selectedImageId) ||
    board?.data?.bgBottom?.images?.find((i) => i.id === selectedImageId);

  if (!imgLayer) {
    return (
      <aside className="cad-inspector-panel" style={{ width: `${rightSidebarWidth}px` }}>
        <div className="cad-sidebar-header" style={{ padding: "12px 14px", borderBottom: "1px solid var(--cad-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ImageIcon size={16} color="#60a5fa" />
            <span style={{ fontWeight: 600, fontSize: "12px", color: "#f8fafc" }}>Свойства изображения</span>
          </div>
        </div>
        <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b", fontSize: "12px", lineHeight: "1.6" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <ImageIcon size={20} color="#60a5fa" />
          </div>
          Выберите скан платы на холсте для настройки калибровки, юстировки угла и оптических фильтров
        </div>
      </aside>
    );
  }

  const isTop = (imgLayer.side || "top").toLowerCase() === "top";
  const naturalW = imgLayer.width || 2000;
  const naturalH = imgLayer.height || 1500;
  const currentScale = imgLayer.scale || 1.0;
  const curW = Math.round(naturalW * currentScale);
  const curH = Math.round(naturalH * currentScale);

  const currentPxPerMm = imgLayer.pxPerMm || 23.62;
  const currentDpi = imgLayer.dpi || Math.round(currentPxPerMm * 25.4);
  const widthMm = (curW / currentPxPerMm).toFixed(1);
  const heightMm = (curH / currentPxPerMm).toFixed(1);

  // Handlers
  const handleUpdate = (updates: Partial<BoardImageLayer>) => {
    updateImageLayer({ ...imgLayer, ...updates });
  };

  // Switch Side (Top ↔ Bottom)
  const handleSwitchSide = async (targetSide: "top" | "bottom") => {
    if (targetSide === imgLayer.side) return;
    const shouldMirror = targetSide === "bottom";
    await handleUpdate({
      side: targetSide,
      mirrored: shouldMirror,
    });
    notifySuccess(`Скан перемещен на сторону ${targetSide === "top" ? "Top (Лицевая)" : "Bottom (Обратная)"}`);
  };

  // Replace file directly (fast swap keeping coordinates, scale, and filters)
  const handleReplaceFile = async () => {
    try {
      let selectedPath: string | null = null;
      let selectedFile: File | null = null;

      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const sel = await open({
          multiple: false,
          filters: [
            {
              name: "Изображения",
              extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"],
            },
          ],
        });
        if (!sel) return;
        selectedPath = Array.isArray(sel) ? sel[0] : typeof sel === "string" ? sel : null;
      } else {
        // Browser file picker fallback
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*,.png,.jpg,.jpeg,.tif,.tiff,.webp,.bmp";
          input.onchange = () => resolve(input.files?.[0] || null);
          input.click();
        });
        if (!file) return;
        selectedFile = file;
      }

      if (selectedPath) {
        const imported = await engineClient.importImage(selectedPath, imgLayer.side);
        await handleUpdate({
          name: imported.name || imgLayer.name,
          imageFile: imported.imageFile,
          cachedUrl: imported.cachedUrl,
          width: imported.width,
          height: imported.height,
        });
        notifySuccess("Файл изображения успешно заменен с сохранением калибровки");
      } else if (selectedFile) {
        const url = URL.createObjectURL(selectedFile);
        const img = new Image();
        img.onload = async () => {
          await handleUpdate({
            name: selectedFile!.name,
            cachedUrl: url,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          notifySuccess("Файл изображения успешно заменен");
        };
        img.src = url;
      }
    } catch (err: any) {
      reportError(err, "Ошибка замены файла изображения");
    }
  };


  // Duplicate image
  const handleDuplicate = async () => {
    try {
      const cloned: BoardImageLayer = {
        ...imgLayer,
        id: `img_${imgLayer.side}_${Date.now()}`,
        name: `${imgLayer.name} (копия)`,
        offsetX: (imgLayer.offsetX || 0) + 15,
        offsetY: (imgLayer.offsetY || 0) + 15,
      };
      await updateImageLayer(cloned);
      selectImage(cloned.id);
      notifySuccess(`Создана копия слоя: "${cloned.name}"`);
    } catch (err: any) {
      reportError(err, "Ошибка дублирования слоя");
    }
  };

  // Export image
  const handleExportImage = () => {
    if (!imgLayer.cachedUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Apply current filters
      let filterStr = "";
      if (imgLayer.brightness !== undefined && imgLayer.brightness !== 100) filterStr += `brightness(${imgLayer.brightness}%) `;
      if (imgLayer.contrast !== undefined && imgLayer.contrast !== 100) filterStr += `contrast(${imgLayer.contrast}%) `;
      if (imgLayer.invert) filterStr += "invert(100%) ";
      if (imgLayer.grayscale) filterStr += "grayscale(100%) ";

      if (imgLayer.tintColor === "green") filterStr += "sepia(100%) hue-rotate(85deg) saturate(220%) ";
      else if (imgLayer.tintColor === "blue") filterStr += "sepia(100%) hue-rotate(180deg) saturate(220%) ";
      else if (imgLayer.tintColor === "red") filterStr += "sepia(100%) hue-rotate(320deg) saturate(250%) ";
      else if (imgLayer.tintColor === "amber") filterStr += "sepia(100%) hue-rotate(30deg) saturate(300%) ";

      if (filterStr) ctx.filter = filterStr.trim();

      ctx.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.download = `${imgLayer.name || "scan"}_export.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      notifySuccess("Изображение экспортировано в PNG");
    };
    resolveImageUrl(imgLayer.cachedUrl).then((url) => {
      img.src = url;
    });
  };

  // Reset all transforms
  const handleResetTransforms = () => {
    handleUpdate({
      scale: 1.0,
      rotation: 0,
      mirrored: !isTop,
      flipV: false,
      opacity: 0.85,
      brightness: 100,
      contrast: 100,
      invert: false,
      grayscale: false,
      blendMode: "normal",
      tintColor: "none",
    });
    notifySuccess("Трансформации и фильтры сброшены");
  };

  return (
    <aside className="cad-inspector-panel" style={{ width: `${rightSidebarWidth}px` }}>
      {/* Resizer bar */}
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

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--cad-border)",
          gap: "8px",
          background: "var(--cad-bg-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
          <ImageIcon
            size={15}
            color={isTop ? "#60a5fa" : "#94a3b8"}
            style={{ flexShrink: 0 }}
          />
          <input
            type="text"
            className="cad-editable-name-input"
            value={imgLayer.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            title="Кликните для переименования изображения"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
          <button
            className={`cad-tool-btn ${imgLayer.locked ? "active" : ""}`}
            style={{ width: "26px", height: "26px" }}
            onClick={() => handleUpdate({ locked: !imgLayer.locked })}
            title={imgLayer.locked ? "Разблокировать слой" : "Заблокировать от перемещения"}
          >
            {imgLayer.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} />}
          </button>
          <button
            className="cad-tool-btn"
            style={{ width: "26px", height: "26px" }}
            onClick={() => handleUpdate({ visible: !imgLayer.visible })}
            title={imgLayer.visible ? "Скрыть слой" : "Показать слой"}
          >
            {imgLayer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            className="cad-tool-btn"
            style={{ width: "26px", height: "26px" }}
            onClick={() => selectImage(null)}
            title="Снять выделение"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div
        className="cad-sidebar-content"
        style={{
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "9px",
          overflowY: "auto",
        }}
      >
        {/* Side Switcher (Top ↔ Bottom) */}
        <div className="cad-card-group" style={{ padding: "8px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#94a3b8" }}>Сторона платы:</span>
            <span className="cad-badge-dim">{naturalW} × {naturalH} px</span>
          </div>

          <div className="cad-side-toggle-group">
            <button
              type="button"
              className={`cad-side-btn ${isTop ? "active" : ""}`}
              onClick={() => handleSwitchSide("top")}
            >
              Лицевая (Top)
            </button>
            <button
              type="button"
              className={`cad-side-btn ${!isTop ? "active" : ""}`}
              onClick={() => handleSwitchSide("bottom")}
            >
              Обратная (Bottom)
            </button>
          </div>
        </div>

        {/* Lock warning */}
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
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Lock size={13} color="#f59e0b" />
              <span>Слой заблокирован</span>
            </div>
            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                background: "rgba(245, 158, 11, 0.2)",
                borderColor: "rgba(245, 158, 11, 0.4)",
                color: "#fef3c7",
              }}
              onClick={() => handleUpdate({ locked: false })}
            >
              Разблокировать
            </button>
          </div>
        )}

        <div style={{ opacity: imgLayer.locked ? 0.5 : 1, pointerEvents: imgLayer.locked ? "none" : "auto", display: "flex", flexDirection: "column", gap: "9px" }}>
          {/* Card: Геометрия и позиция */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Move size={13} />
              <span>Геометрия и позиция</span>
            </div>

            {/* Position X / Y */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">X</span>
                <input
                  type="number"
                  step="0.5"
                  className="cad-modern-input"
                  value={imgLayer.offsetX ?? 0}
                  onChange={(e) => handleUpdate({ offsetX: parseFloat(e.target.value) || 0 })}
                />
                <span className="cad-field-suffix">мм</span>
              </div>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">Y</span>
                <input
                  type="number"
                  step="0.5"
                  className="cad-modern-input"
                  value={imgLayer.offsetY ?? 0}
                  onChange={(e) => handleUpdate({ offsetY: parseFloat(e.target.value) || 0 })}
                />
                <span className="cad-field-suffix">мм</span>
              </div>
            </div>

            {/* Dimensions W and H with Aspect Lock */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <div className="cad-field-wrap" style={{ flex: 1 }}>
                <span className="cad-field-prefix">W</span>
                <input
                  type="number"
                  className="cad-modern-input"
                  value={curW}
                  onChange={(e) => {
                    const newW = Math.max(10, parseInt(e.target.value, 10) || 10);
                    const newScale = newW / naturalW;
                    handleUpdate({ scale: Math.round(newScale * 1000) / 1000 });
                  }}
                />
                <span className="cad-field-suffix">px</span>
              </div>

              <button
                type="button"
                className={`cad-aspect-btn ${imgLayer.lockAspectRatio !== false ? "active" : ""}`}
                onClick={() => handleUpdate({ lockAspectRatio: imgLayer.lockAspectRatio === false })}
                title={imgLayer.lockAspectRatio !== false ? "Пропорции зафиксированы" : "Пропорции свободны"}
              >
                {imgLayer.lockAspectRatio !== false ? <Link size={12} /> : <Unlink size={12} />}
              </button>

              <div className="cad-field-wrap" style={{ flex: 1 }}>
                <span className="cad-field-prefix">H</span>
                <input
                  type="number"
                  className="cad-modern-input"
                  value={curH}
                  onChange={(e) => {
                    const newH = Math.max(10, parseInt(e.target.value, 10) || 10);
                    const newScale = newH / naturalH;
                    handleUpdate({ scale: Math.round(newScale * 1000) / 1000 });
                  }}
                />
                <span className="cad-field-suffix">px</span>
              </div>
            </div>

            {/* Scale Slider */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Масштаб:</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#60a5fa", fontFamily: "JetBrains Mono" }}>
                {Math.round(currentScale * 100)}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="range"
                min="0.05"
                max="5.0"
                step="0.01"
                className="cad-modern-slider"
                value={currentScale}
                onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) || 1.0 })}
              />
              <button
                type="button"
                className="cad-badge-dim"
                style={{ cursor: "pointer", padding: "3px 8px" }}
                onClick={() => handleUpdate({ scale: 1.0 })}
                title="Сбросить масштаб в 100% (1.0x)"
              >
                1:1
              </button>
            </div>
          </div>

          {/* Card: Поворот и юстировка */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Compass size={13} />
              <span>Поворот и юстировка</span>
            </div>

            {/* Fine angle bar */}
            <div className="cad-fine-angle-bar" style={{ marginBottom: "6px" }}>
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) - 1) * 10) / 10 })}
                title="Повернуть на -1.0°"
              >
                -1°
              </button>
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) - 0.1) * 10) / 10 })}
                title="Точная подгонка на -0.1°"
              >
                -0.1°
              </button>
              <input
                type="number"
                step="0.1"
                className="cad-angle-input"
                value={Math.round((imgLayer.rotation || 0) * 10) / 10}
                onChange={(e) => handleUpdate({ rotation: parseFloat(e.target.value) || 0 })}
              />
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) + 0.1) * 10) / 10 })}
                title="Точная подгонка на +0.1°"
              >
                +0.1°
              </button>
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) + 1) * 10) / 10 })}
                title="Повернуть на +1.0°"
              >
                +1°
              </button>
            </div>

            {/* Quick 90 deg and 0 deg buttons */}
            <div className="cad-btn-grid-2" style={{ marginBottom: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ rotation: ((imgLayer.rotation || 0) + 90) % 360 })}
                title="Повернуть на +90° по часовой стрелке"
              >
                <RotateCw size={12} style={{ marginRight: "4px" }} />
                <span>+90°</span>
              </button>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ rotation: 0 })}
                title="Сбросить угол в 0°"
              >
                <RotateCcw size={12} style={{ marginRight: "4px" }} />
                <span>0° Сброс</span>
              </button>
            </div>

            {/* Mirror X / Y */}
            <div className="cad-btn-grid-2">
              <button
                type="button"
                className={`cad-btn cad-btn-secondary ${imgLayer.mirrored ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ mirrored: !imgLayer.mirrored })}
                title="Отзеркалить по горизонтали (Flip X)"
              >
                <FlipHorizontal size={12} style={{ marginRight: "4px" }} />
                <span>Зеркало X</span>
              </button>
              <button
                type="button"
                className={`cad-btn cad-btn-secondary ${imgLayer.flipV ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ flipV: !imgLayer.flipV })}
                title="Отзеркалить по вертикали (Flip Y)"
              >
                <FlipVertical size={12} style={{ marginRight: "4px" }} />
                <span>Зеркало Y</span>
              </button>
            </div>
          </div>

          {/* Card: Калибровка масштаба */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Ruler size={13} />
              <span>Калибровка (CAD-масштаб)</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">DPI</span>
                <input
                  type="number"
                  className="cad-modern-input"
                  value={currentDpi}
                  onChange={(e) => {
                    const dpiVal = parseInt(e.target.value, 10) || 600;
                    handleUpdate({
                      dpi: dpiVal,
                      pxPerMm: Math.round((dpiVal / 25.4) * 100) / 100,
                    });
                  }}
                />
              </div>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">PX/ММ</span>
                <input
                  type="number"
                  step="0.01"
                  className="cad-modern-input"
                  value={currentPxPerMm}
                  onChange={(e) => {
                    const pxVal = parseFloat(e.target.value) || 23.62;
                    handleUpdate({
                      pxPerMm: pxVal,
                      dpi: Math.round(pxVal * 25.4),
                    });
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Физический размер:</span>
              <span className="cad-badge-dim" style={{ color: "#60a5fa" }}>{widthMm} × {heightMm} мм</span>
            </div>

            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{ width: "100%", fontSize: "11px", padding: "6px", justifyContent: "center" }}
              onClick={() => setActiveTool("calibrate")}
              title="Кликните 2 точки известного расстояния на холсте"
            >
              <Ruler size={13} style={{ marginRight: "6px", color: "#60a5fa" }} />
              <span>Калибровать по 2 точкам</span>
            </button>
          </div>

          {/* Card: Отображение и смешивание */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Layers size={13} />
              <span>Отображение и смешивание</span>
            </div>

            {/* Blend Mode */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}>Режим смешивания:</div>
              <select
                className="cad-prop-select"
                value={imgLayer.blendMode || "normal"}
                onChange={(e) => handleUpdate({ blendMode: e.target.value })}
              >
                <option value="normal">Normal (Обычный)</option>
                <option value="multiply">Multiply (Умножение — просвет белого фона)</option>
                <option value="difference">Difference (Разница — подсветка несовпадений)</option>
                <option value="screen">Screen (Осветление)</option>
                <option value="overlay">Overlay (Перекрытие)</option>
                <option value="darken">Darken (Затемнение)</option>
                <option value="lighten">Lighten (Замена светлым)</option>
              </select>
            </div>

            {/* PCB Mask Tint */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}>Тонировка маски (PCB Tint):</div>
              <div className="cad-tint-chips">
                {[
                  { id: "none", label: "Оригинал" },
                  { id: "green", label: "Зеленая" },
                  { id: "blue", label: "Синяя" },
                  { id: "red", label: "Красная" },
                  { id: "amber", label: "Медь" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`cad-tint-pill ${(imgLayer.tintColor || "none") === t.id ? "active" : ""}`}
                    onClick={() => handleUpdate({ tintColor: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
                <span>Прозрачность:</span>
                <strong style={{ color: "#f8fafc", fontFamily: "JetBrains Mono" }}>{Math.round((imgLayer.opacity ?? 0.85) * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                className="cad-modern-slider"
                value={imgLayer.opacity ?? 0.85}
                onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
              />
            </div>

            {/* Brightness */}
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
                <span>Яркость:</span>
                <strong style={{ color: "#f8fafc", fontFamily: "JetBrains Mono" }}>{Math.round(imgLayer.brightness ?? 100)}%</strong>
              </div>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                className="cad-modern-slider"
                value={imgLayer.brightness ?? 100}
                onChange={(e) => handleUpdate({ brightness: parseFloat(e.target.value) })}
              />
            </div>

            {/* Contrast */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
                <span>Контраст:</span>
                <strong style={{ color: "#f8fafc", fontFamily: "JetBrains Mono" }}>{Math.round(imgLayer.contrast ?? 100)}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                className="cad-modern-slider"
                value={imgLayer.contrast ?? 100}
                onChange={(e) => handleUpdate({ contrast: parseFloat(e.target.value) })}
              />
            </div>

            {/* Modern Toggle Switches for Invert & Grayscale */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
              <label className="cad-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(imgLayer.invert)}
                  onChange={(e) => handleUpdate({ invert: e.target.checked })}
                />
                <span className="cad-switch-track" />
                <span>Инверсия</span>
              </label>

              <label className="cad-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(imgLayer.grayscale)}
                  onChange={(e) => handleUpdate({ grayscale: e.target.checked })}
                />
                <span className="cad-switch-track" />
                <span>Ч/Б режим</span>
              </label>
            </div>
          </div>

          {/* Card: Быстрые действия */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Zap size={13} />
              <span>Быстрые действия</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ width: "100%", fontSize: "11px", justifyContent: "center" }}
                onClick={handleReplaceFile}
                title="Заменить файл изображения с сохранением координат, масштаба и фильтров"
              >
                <Upload size={12} style={{ marginRight: "6px", color: "#60a5fa" }} />
                <span>Заменить файл...</span>
              </button>

              <div className="cad-btn-grid-2">
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", justifyContent: "center" }}
                  onClick={handleDuplicate}
                  title="Создать копию изображения на холсте"
                >
                  <Copy size={12} style={{ marginRight: "4px" }} />
                  <span>Дублировать</span>
                </button>

                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", justifyContent: "center" }}
                  onClick={handleExportImage}
                  title="Экспортировать скан с фильтрами в PNG"
                >
                  <Download size={12} style={{ marginRight: "4px" }} />
                  <span>Экспорт...</span>
                </button>
              </div>

              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ width: "100%", fontSize: "11px", justifyContent: "center", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.25)" }}
                onClick={handleResetTransforms}
                title="Сбросить масштаб в 1.0x, угол в 0° и вернуть фильтры к значениям по умолчанию"
              >
                <RotateCcw size={12} style={{ marginRight: "6px" }} />
                <span>Сбросить все трансформации</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
