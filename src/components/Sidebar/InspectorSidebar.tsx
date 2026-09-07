import React, { useState } from "react";
import {
  Image as ImageIcon,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Ruler,
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
      <aside className="cad-sidebar cad-sidebar-right" style={{ width: `${rightSidebarWidth}px` }}>
        <div className="cad-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ImageIcon size={14} color="#60a5fa" />
            <span style={{ fontWeight: 600 }}>Свойства изображения</span>
          </div>
        </div>
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--cad-text-dim)", fontSize: "12px", lineHeight: "1.6" }}>
          Выберите скан платы на холсте или в дереве проекта для настройки калибровки, угла и оптических фильтров
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

  // Replace file
  const handleReplaceFile = async () => {
    try {
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
        if (sel && typeof sel === "string") {
          const imported = await engineClient.importImage(sel, imgLayer.side);
          await handleUpdate({
            imageFile: imported.imageFile,
            cachedUrl: imported.cachedUrl,
            width: imported.width,
            height: imported.height,
          });
          notifySuccess("Файл изображения успешно заменен с сохранением калибровки");
        }
      } else {
        notifyWarning("Замена файла доступна в desktop-режиме приложения");
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
    notifySuccess("Трансформации и фильтры сброшены к значениям по умолчанию");
  };

  return (
    <aside className="cad-sidebar cad-sidebar-right" style={{ width: `${rightSidebarWidth}px` }}>
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
      <div className="cad-sidebar-header" style={{ justifyContent: "space-between", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
          <ImageIcon
            size={14}
            color={isTop ? "var(--cad-top-layer)" : "var(--cad-bot-layer)"}
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
            className={`cad-tree-icon-btn ${imgLayer.locked ? "active" : ""}`}
            onClick={() => handleUpdate({ locked: !imgLayer.locked })}
            title={imgLayer.locked ? "Разблокировать слой" : "Заблокировать от перемещения"}
          >
            {imgLayer.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} />}
          </button>
          <button
            className="cad-tree-icon-btn"
            onClick={() => handleUpdate({ visible: !imgLayer.visible })}
            title={imgLayer.visible ? "Скрыть слой" : "Показать слой"}
          >
            {imgLayer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            className="cad-tree-icon-btn"
            onClick={() => selectImage(null)}
            title="Снять выделение"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="cad-sidebar-content" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Side Switcher (Top ↔ Bottom) */}
        <div className="cad-prop-group" style={{ padding: "8px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--cad-text-muted)" }}>Сторона платы:</span>
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

        <div style={{ opacity: imgLayer.locked ? 0.5 : 1, pointerEvents: imgLayer.locked ? "none" : "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* 1. Geometry & Scale */}
          <div className="cad-prop-group">
            <div className="cad-prop-group-header">1. Геометрия и позиция</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-labeled-input">
                <label>Смещение X (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  className="cad-prop-input"
                  value={imgLayer.offsetX ?? 0}
                  onChange={(e) => handleUpdate({ offsetX: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="cad-labeled-input">
                <label>Смещение Y (мм)</label>
                <input
                  type="number"
                  step="0.5"
                  className="cad-prop-input"
                  value={imgLayer.offsetY ?? 0}
                  onChange={(e) => handleUpdate({ offsetY: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Width and Height with Aspect Lock */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-labeled-input" style={{ flex: 1 }}>
                <label>Ширина W (px)</label>
                <input
                  type="number"
                  className="cad-prop-input"
                  value={curW}
                  onChange={(e) => {
                    const newW = Math.max(10, parseInt(e.target.value, 10) || 10);
                    const newScale = newW / naturalW;
                    handleUpdate({ scale: Math.round(newScale * 1000) / 1000 });
                  }}
                />
              </div>

              <button
                type="button"
                className={`cad-aspect-btn ${imgLayer.lockAspectRatio !== false ? "active" : ""}`}
                onClick={() => handleUpdate({ lockAspectRatio: imgLayer.lockAspectRatio === false })}
                title={imgLayer.lockAspectRatio !== false ? "Пропорции зафиксированы" : "Пропорции свободны"}
              >
                {imgLayer.lockAspectRatio !== false ? <Link size={12} /> : <Unlink size={12} />}
              </button>

              <div className="cad-labeled-input" style={{ flex: 1 }}>
                <label>Высота H (px)</label>
                <input
                  type="number"
                  className="cad-prop-input"
                  value={curH}
                  onChange={(e) => {
                    const newH = Math.max(10, parseInt(e.target.value, 10) || 10);
                    const newScale = newH / naturalH;
                    handleUpdate({ scale: Math.round(newScale * 1000) / 1000 });
                  }}
                />
              </div>
            </div>

            {/* Scale Slider */}
            <div className="cad-prop-row" style={{ marginTop: "4px" }}>
              <span className="cad-prop-label">Масштаб ({Math.round(currentScale * 100)}%):</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, justifyContent: "flex-end" }}>
                <input
                  type="range"
                  min="0.05"
                  max="5.0"
                  step="0.01"
                  className="cad-prop-slider"
                  style={{ width: "90px" }}
                  value={currentScale}
                  onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) || 1.0 })}
                />
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "10px", padding: "2px 6px" }}
                  onClick={() => handleUpdate({ scale: 1.0 })}
                  title="Сбросить масштаб в 100% (1.0x)"
                >
                  1:1
                </button>
              </div>
            </div>
          </div>

          {/* 2. Orientation & Alignment (Micro-stepping) */}
          <div className="cad-prop-group">
            <div className="cad-prop-group-header">2. Поворот и юстировка</div>

            {/* Fine angle bar */}
            <div className="cad-fine-angle-bar">
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
            <div className="cad-btn-grid-2" style={{ marginTop: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px" }}
                onClick={() => handleUpdate({ rotation: ((imgLayer.rotation || 0) + 90) % 360 })}
                title="Повернуть на +90° по часовой стрелке"
              >
                <RotateCw size={12} style={{ marginRight: "4px" }} />
                <span>+90°</span>
              </button>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px" }}
                onClick={() => handleUpdate({ rotation: 0 })}
                title="Сбросить угол в 0°"
              >
                <RotateCcw size={12} style={{ marginRight: "4px" }} />
                <span>0° Сброс</span>
              </button>
            </div>

            {/* Mirror X / Y */}
            <div className="cad-btn-grid-2" style={{ marginTop: "6px" }}>
              <button
                type="button"
                className={`cad-btn cad-btn-secondary ${imgLayer.mirrored ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "5px" }}
                onClick={() => handleUpdate({ mirrored: !imgLayer.mirrored })}
                title="Отзеркалить по горизонтали (Flip X)"
              >
                <FlipHorizontal size={12} style={{ marginRight: "4px" }} />
                <span>Зеркало X</span>
              </button>
              <button
                type="button"
                className={`cad-btn cad-btn-secondary ${imgLayer.flipV ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "5px" }}
                onClick={() => handleUpdate({ flipV: !imgLayer.flipV })}
                title="Отзеркалить по вертикали (Flip Y)"
              >
                <FlipVertical size={12} style={{ marginRight: "4px" }} />
                <span>Зеркало Y</span>
              </button>
            </div>
          </div>

          {/* 3. Calibration & DPI */}
          <div className="cad-prop-group">
            <div className="cad-prop-group-header">3. Калибровка (CAD-масштаб)</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-labeled-input">
                <label>Плотность (DPI)</label>
                <input
                  type="number"
                  className="cad-prop-input"
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
              <div className="cad-labeled-input">
                <label>Плотность (px/мм)</label>
                <input
                  type="number"
                  step="0.01"
                  className="cad-prop-input"
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
              <span style={{ fontSize: "10.5px", color: "var(--cad-text-dim)" }}>Физический размер:</span>
              <span className="cad-badge-dim">{widthMm} × {heightMm} мм</span>
            </div>

            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{ width: "100%", fontSize: "11px", padding: "6px" }}
              onClick={() => setActiveTool("calibrate")}
              title="Кликните 2 точки известного расстояния на холсте"
            >
              <Ruler size={13} style={{ marginRight: "6px", color: "#38bdf8" }} />
              <span>Калибровать по 2 точкам</span>
            </button>
          </div>

          {/* 4. Display Filters & Blending */}
          <div className="cad-prop-group">
            <div className="cad-prop-group-header">4. Отображение и смешивание</div>

            {/* Blend Mode */}
            <div className="cad-prop-row">
              <span className="cad-prop-label">Режим смешивания:</span>
              <select
                className="cad-prop-select"
                value={imgLayer.blendMode || "normal"}
                onChange={(e) => handleUpdate({ blendMode: e.target.value })}
              >
                <option value="normal">Normal (Обычный)</option>
                <option value="multiply">Multiply (Умножение)</option>
                <option value="difference">Difference (Разница)</option>
                <option value="screen">Screen (Осветление)</option>
                <option value="overlay">Overlay (Перекрытие)</option>
                <option value="darken">Darken (Затемнение)</option>
                <option value="lighten">Lighten (Замена светлым)</option>
              </select>
            </div>

            {/* Opacity */}
            <div className="cad-prop-row">
              <span className="cad-prop-label">Прозрачность ({Math.round((imgLayer.opacity ?? 0.85) * 100)}%):</span>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                className="cad-prop-slider"
                value={imgLayer.opacity ?? 0.85}
                onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
              />
            </div>

            {/* Brightness */}
            <div className="cad-prop-row">
              <span className="cad-prop-label">Яркость ({Math.round(imgLayer.brightness ?? 100)}%):</span>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                className="cad-prop-slider"
                value={imgLayer.brightness ?? 100}
                onChange={(e) => handleUpdate({ brightness: parseFloat(e.target.value) })}
              />
            </div>

            {/* Contrast */}
            <div className="cad-prop-row">
              <span className="cad-prop-label">Контраст ({Math.round(imgLayer.contrast ?? 100)}%):</span>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                className="cad-prop-slider"
                value={imgLayer.contrast ?? 100}
                onChange={(e) => handleUpdate({ contrast: parseFloat(e.target.value) })}
              />
            </div>

            {/* Invert & Grayscale */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px" }}>
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(imgLayer.invert)}
                  onChange={(e) => handleUpdate({ invert: e.target.checked })}
                />
                <span>Инверсия</span>
              </label>
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(imgLayer.grayscale)}
                  onChange={(e) => handleUpdate({ grayscale: e.target.checked })}
                />
                <span>Оттенки серого</span>
              </label>
            </div>
          </div>

          {/* 5. Quick Actions */}
          <div className="cad-prop-group">
            <div className="cad-prop-group-header">5. Быстрые действия</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ width: "100%", fontSize: "11px", justifyContent: "center" }}
                onClick={handleReplaceFile}
                title="Заменить файл изображения с сохранением координат, масштаба и фильтров"
              >
                <Upload size={12} style={{ marginRight: "6px" }} />
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
                style={{ width: "100%", fontSize: "11px", justifyContent: "center", color: "#f87171" }}
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
