import React from "react";
import {
  BoardData,
  BoardSelectionTarget,
  BoardSide,
  ComponentItem,
  LayerImageItem,
  normalizeBoardData,
} from "../../types/project";

import {
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Link,
  Unlink,
  Upload,
  Download,
  Copy,
  Ruler,
  X,
} from "lucide-react";

interface InspectorSidebarProps {
  width?: number;
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  onSelectComponent: (id: string | undefined) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
  onSelectTarget?: (target: BoardSelectionTarget) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  width,
  boardData: rawBoardData,
  onChangeBoardData,
  onSelectComponent,
  onSelectPin,
  onSelectTarget,
}) => {
  const boardData = normalizeBoardData(rawBoardData);
  const selectedTarget = boardData.selectedTarget;

  // Selected component if any
  const selectedCompId =
    selectedTarget?.type === "component"
      ? selectedTarget.id
      : boardData.selectedComponentId;
  const selectedPinId =
    selectedTarget?.type === "component"
      ? selectedTarget.pinId
      : boardData.selectedPinId;

  const selectedComp = boardData.components.find((c) => c.id === selectedCompId);
  const selectedPin = selectedComp?.pins.find((p) => p.id === selectedPinId);

  // Active net and connected nodes for selected component pin
  const activeNet = selectedPin?.netId;
  const connectedNodes: { compRef: string; compId: string; pinNumber: number; pinId: string }[] = [];
  if (activeNet) {
    boardData.components.forEach((comp) => {
      comp.pins.forEach((pin) => {
        if (pin.netId === activeNet) {
          connectedNodes.push({
            compRef: comp.refDes,
            compId: comp.id,
            pinNumber: pin.number,
            pinId: pin.id,
          });
        }
      });
    });
  }

  const handleClose = () => {
    onSelectComponent(undefined);
    onSelectTarget?.(null);
  };

  // Handlers for component
  const handleUpdateComponent = (updates: Partial<ComponentItem>) => {
    if (!selectedComp) return;
    const updatedComps = boardData.components.map((c) =>
      c.id === selectedComp.id ? { ...c, ...updates } : c
    );
    onChangeBoardData({ ...boardData, components: updatedComps });
  };

  const handleToggleCompSide = () => {
    if (!selectedComp) return;
    const currentSide: BoardSide = selectedComp.layer || "top";
    const nextSide: BoardSide = currentSide === "top" ? "bottom" : "top";
    handleUpdateComponent({ layer: nextSide });
  };

  const handleSetPinNet = (netName: string) => {
    if (!selectedComp || !selectedPin) return;
    const trimmed = netName.trim();
    const updatedPins = selectedComp.pins.map((p) =>
      p.id === selectedPin.id ? { ...p, netId: trimmed || undefined } : p
    );
    handleUpdateComponent({ pins: updatedPins });
  };

  const handleRotate = () => {
    if (!selectedComp) return;
    const newRot = (selectedComp.rotation + 90) % 360;
    handleUpdateComponent({ rotation: newRot });
  };

  const handleDeleteComp = () => {
    if (!selectedComp) return;
    const filtered = boardData.components.filter((c) => c.id !== selectedComp.id);
    onChangeBoardData({
      ...boardData,
      components: filtered,
      selectedComponentId: undefined,
      selectedPinId: undefined,
      selectedTarget: null,
    });
  };

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Render properties for a specifically selected image
  const renderSelectedImageInspector = (layerKey: "bgTop" | "bgBottom", imageId: string) => {
    const isTop = layerKey === "bgTop";
    const bg = isTop ? boardData.bgTop : boardData.bgBottom;
    const images = bg.images || [];
    const activeImage = images.find((img) => img.id === imageId);

    if (!activeImage) return null;

    const updateBg = (updates: Partial<typeof bg>) => {
      onChangeBoardData({
        ...boardData,
        [layerKey]: { ...bg, ...updates },
      });
    };

    const handleUpdateActiveImage = (updates: Partial<LayerImageItem>) => {
      const updatedImages = images.map((img) =>
        img.id === activeImage.id ? { ...img, ...updates } : img
      );
      updateBg({
        images: updatedImages,
        image: updatedImages[0]?.src,
      });
    };

    // Quick Action 1: Replace file
    const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target?.result as string;
        if (!dataUrl) return;
        const tempImg = new window.Image();
        tempImg.onload = () => {
          handleUpdateActiveImage({
            src: dataUrl,
            name: file.name,
            width: tempImg.naturalWidth,
            height: tempImg.naturalHeight,
          });
        };
        tempImg.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    // Quick Action 2: Duplicate image
    const handleDuplicateImage = () => {
      const newId = `img_${layerKey}_${Date.now()}`;
      const clonedImage: LayerImageItem = {
        ...activeImage,
        id: newId,
        name: `${activeImage.name} (копия)`,
        x: activeImage.x + 25,
        y: activeImage.y + 25,
        order: images.length,
      };
      const updatedImages = [...images, clonedImage];
      onChangeBoardData({
        ...boardData,
        [layerKey]: {
          ...bg,
          images: updatedImages,
          activeImageId: newId,
        },
        selectedTarget: {
          type: layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom",
          imageId: newId,
        },
      });
    };

    // Quick Action 3: Export image
    const handleExportImage = () => {
      const tempImg = new window.Image();
      tempImg.crossOrigin = "anonymous";
      tempImg.onload = () => {
        const offCanvas = document.createElement("canvas");
        const naturalW = tempImg.naturalWidth || 800;
        const naturalH = tempImg.naturalHeight || 600;
        offCanvas.width = naturalW;
        offCanvas.height = naturalH;
        const ctx = offCanvas.getContext("2d");
        if (!ctx) return;

        const filterParts: string[] = [];
        if (activeImage.brightness !== 100) filterParts.push(`brightness(${activeImage.brightness}%)`);
        if (activeImage.contrast !== 100) filterParts.push(`contrast(${activeImage.contrast}%)`);
        if (activeImage.invert) filterParts.push("invert(1)");
        if (activeImage.grayscale) filterParts.push("grayscale(100%)");
        if (filterParts.length > 0) {
          ctx.filter = filterParts.join(" ");
        }
        ctx.drawImage(tempImg, 0, 0);

        const link = document.createElement("a");
        link.download = `${activeImage.name.replace(/\.[^/.]+$/, "")}_export.png`;
        link.href = offCanvas.toDataURL("image/png");
        link.click();
      };
      tempImg.src = activeImage.src;
    };

    // Quick Action 4: Reset all transforms
    const handleResetTransform = () => {
      handleUpdateActiveImage({
        scale: 1,
        rotation: 0,
        mirrored: isTop ? false : true,
        flipV: false,
        opacity: 0.85,
        brightness: 100,
        contrast: 100,
        invert: false,
        grayscale: false,
        blendMode: "normal",
        tintColor: "none",
      });
    };

    // Switch Side (Top / Bottom)
    const handleSwitchSide = (targetSide: "bgTop" | "bgBottom") => {
      if (targetSide === layerKey) return;
      const targetBg = targetSide === "bgTop" ? boardData.bgTop : boardData.bgBottom;
      const remainingImages = images.filter((img) => img.id !== activeImage.id);
      const movedImage: LayerImageItem = {
        ...activeImage,
        mirrored: targetSide === "bgBottom" ? true : false,
      };
      const newTargetImages = [...(targetBg.images || []), movedImage];
      onChangeBoardData({
        ...boardData,
        [layerKey]: { ...bg, images: remainingImages },
        [targetSide]: {
          ...targetBg,
          images: newTargetImages,
          activeImageId: activeImage.id,
        },
        selectedTarget: {
          type: targetSide === "bgTop" ? "layer_bg_top" : "layer_bg_bottom",
          imageId: activeImage.id,
        },
      });
    };

    // Physical scale and sizing computations
    const naturalW = activeImage.width || 800;
    const naturalH = activeImage.height || 600;
    const curW = Math.round(naturalW * activeImage.scale);
    const curH = Math.round(naturalH * activeImage.scale);
    const isAspectLocked = activeImage.lockAspectRatio !== false;
    const currentDpi = activeImage.dpi || 600;
    const currentPxPerMm = activeImage.pxPerMm || Math.round((currentDpi / 25.4) * 100) / 100;
    const widthMm = (curW / currentPxPerMm).toFixed(1);
    const heightMm = (curH / currentPxPerMm).toFixed(1);

    return (
      <aside className="cad-inspector-panel" style={width ? { width: `${width}px` } : undefined}>
        {/* Header & Status */}
        <div className="cad-inspector-header">
          <div className="cad-header-title-group" style={{ flex: 1, marginRight: "8px" }}>
            <span className="cad-inspector-title">Изображение</span>
            <input
              type="text"
              className="cad-editable-name-input"
              value={activeImage.name}
              onChange={(e) => handleUpdateActiveImage({ name: e.target.value })}
              title="Кликните для переименования изображения"
            />
          </div>
          <div className="cad-header-actions">
            <button
              className={`cad-card-btn ${activeImage.locked ? "active-lock" : ""}`}
              onClick={() => handleUpdateActiveImage({ locked: !activeImage.locked })}
              title={activeImage.locked ? "Разблокировать" : "Заблокировать от перемещения"}
            >
              {activeImage.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
            <button
              className="cad-card-btn"
              onClick={() => handleUpdateActiveImage({ visible: !activeImage.visible })}
              title={activeImage.visible ? "Скрыть изображение" : "Показать изображение"}
            >
              {activeImage.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              className="cad-inspector-close-btn"
              onClick={handleClose}
              title="Закрыть свойства"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="cad-inspector-body">
          {/* Side Switcher (Top / Bottom) */}
          <div className="cad-field-row side-control-row" style={{ marginTop: "2px", marginBottom: "4px" }}>
            <label>Сторона:</label>
            <div className="cad-side-toggle-group">
              <button
                type="button"
                className={`cad-side-btn ${isTop ? "active" : ""}`}
                onClick={() => handleSwitchSide("bgTop")}
              >
                Лицевая (Top)
              </button>
              <button
                type="button"
                className={`cad-side-btn ${!isTop ? "active" : ""}`}
                onClick={() => handleSwitchSide("bgBottom")}
              >
                Обратная (Bottom)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "10.5px", color: "var(--cad-text-muted)" }}>Оригинал:</span>
            <span className="cad-badge-dim">{naturalW} × {naturalH} px</span>
          </div>

          {/* 1. Position & Dimensions */}
          <div className="cad-prop-group">
            <div className="group-header">1. Геометрия и позиция</div>

            {/* Position X / Y */}
            <div className="cad-field-grid-2" style={{ marginBottom: "6px" }}>
              <div className="cad-labeled-input">
                <label>Позиция X (px)</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={Math.round(activeImage.x)}
                  onChange={(e) =>
                    handleUpdateActiveImage({ x: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div className="cad-labeled-input">
                <label>Позиция Y (px)</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={Math.round(activeImage.y)}
                  onChange={(e) =>
                    handleUpdateActiveImage({ y: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            </div>

            {/* Dimensions W / H with Aspect Lock */}
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
                <div className="cad-labeled-input" style={{ flex: 1 }}>
                  <label>Ширина W (px)</label>
                  <input
                    type="number"
                    className="cad-field-input"
                    value={curW}
                    onChange={(e) => {
                      const newW = Math.max(10, parseInt(e.target.value, 10) || 10);
                      const newScale = newW / naturalW;
                      handleUpdateActiveImage({ scale: Math.round(newScale * 1000) / 1000 });
                    }}
                  />
                </div>

                <button
                  type="button"
                  className={`cad-lock-aspect-btn ${isAspectLocked ? "locked" : ""}`}
                  onClick={() => handleUpdateActiveImage({ lockAspectRatio: !isAspectLocked })}
                  title={isAspectLocked ? "Пропорции зафиксированы" : "Пропорции свободны"}
                  style={{ marginBottom: "2px" }}
                >
                  {isAspectLocked ? <Link size={13} /> : <Unlink size={13} />}
                </button>

                <div className="cad-labeled-input" style={{ flex: 1 }}>
                  <label>Высота H (px)</label>
                  <input
                    type="number"
                    className="cad-field-input"
                    value={curH}
                    onChange={(e) => {
                      const newH = Math.max(10, parseInt(e.target.value, 10) || 10);
                      const newScale = newH / naturalH;
                      handleUpdateActiveImage({ scale: Math.round(newScale * 1000) / 1000 });
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Scale */}
            <div className="cad-field-row" style={{ marginTop: "4px" }}>
              <label>Множитель:</label>
              <div className="cad-input-with-actions">
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  max="50"
                  className="cad-field-input"
                  value={activeImage.scale}
                  onChange={(e) =>
                    handleUpdateActiveImage({ scale: parseFloat(e.target.value) || 1 })
                  }
                />
                <button
                  className="cad-btn-flat btn-xs"
                  onClick={() => handleUpdateActiveImage({ scale: 1 })}
                  title="Сбросить масштаб на 100% (1.0x)"
                >
                  1:1 (1.0×)
                </button>
              </div>
            </div>
          </div>

          {/* 2. Angle & Alignment Tools */}
          <div className="cad-prop-group">
            <div className="group-header">2. Поворот и юстировка</div>

            {/* Fine Angle Stepper */}
            <div className="cad-fine-angle-bar">
              <button
                className="cad-step-btn"
                onClick={() =>
                  handleUpdateActiveImage({
                    rotation: Math.round((activeImage.rotation - 1) * 10) / 10,
                  })
                }
                title="Повернуть на -1.0°"
              >
                -1°
              </button>
              <button
                className="cad-step-btn"
                onClick={() =>
                  handleUpdateActiveImage({
                    rotation: Math.round((activeImage.rotation - 0.1) * 10) / 10,
                  })
                }
                title="Точная подгонка на -0.1°"
              >
                -0.1°
              </button>
              <input
                type="number"
                step="0.1"
                className="cad-angle-input"
                value={activeImage.rotation}
                onChange={(e) =>
                  handleUpdateActiveImage({ rotation: parseFloat(e.target.value) || 0 })
                }
              />
              <button
                className="cad-step-btn"
                onClick={() =>
                  handleUpdateActiveImage({
                    rotation: Math.round((activeImage.rotation + 0.1) * 10) / 10,
                  })
                }
                title="Точная подгонка на +0.1°"
              >
                +0.1°
              </button>
              <button
                className="cad-step-btn"
                onClick={() =>
                  handleUpdateActiveImage({
                    rotation: Math.round((activeImage.rotation + 1) * 10) / 10,
                  })
                }
                title="Повернуть на +1.0°"
              >
                +1°
              </button>
            </div>

            <div className="cad-btn-grid-2">
              <button
                className="cad-btn-flat btn-sm"
                onClick={() =>
                  handleUpdateActiveImage({
                    rotation: (Math.round(activeImage.rotation) + 90) % 360,
                  })
                }
                title="Повернуть на 90° по часовой стрелке"
              >
                <RotateCw size={13} />
                <span>↷ +90°</span>
              </button>
              <button
                className="cad-btn-flat btn-sm"
                onClick={() => handleUpdateActiveImage({ rotation: 0 })}
                title="Сбросить угол в 0°"
              >
                <RotateCcw size={13} />
                <span>0° Сброс</span>
              </button>
            </div>

            <div className="cad-btn-grid-2" style={{ marginTop: "6px" }}>
              <button
                className={`cad-btn-flat btn-sm ${activeImage.mirrored ? "active" : ""}`}
                onClick={() =>
                  handleUpdateActiveImage({ mirrored: !activeImage.mirrored })
                }
                title="Отзеркалить по горизонтали (Flip X)"
              >
                <FlipHorizontal size={13} />
                <span>Зеркало X</span>
              </button>
              <button
                className={`cad-btn-flat btn-sm ${activeImage.flipV ? "active" : ""}`}
                onClick={() =>
                  handleUpdateActiveImage({ flipV: !activeImage.flipV })
                }
                title="Отзеркалить по вертикали (Flip Y)"
              >
                <FlipVertical size={13} />
                <span>Зеркало Y</span>
              </button>
            </div>
          </div>

          {/* 3. Physical Scale & Calibration */}
          <div className="cad-prop-group">
            <div className="group-header">3. Калибровка (CAD-масштаб)</div>

            <div className="cad-field-grid-2" style={{ marginBottom: "6px" }}>
              <div className="cad-labeled-input">
                <label>Плотность (DPI)</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={currentDpi}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 600;
                    handleUpdateActiveImage({
                      dpi: val,
                      pxPerMm: Math.round((val / 25.4) * 100) / 100,
                    });
                  }}
                />
              </div>
              <div className="cad-labeled-input">
                <label>Плотность (px/мм)</label>
                <input
                  type="number"
                  step="0.01"
                  className="cad-field-input"
                  value={currentPxPerMm}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 23.62;
                    handleUpdateActiveImage({
                      pxPerMm: val,
                      dpi: Math.round(val * 25.4),
                    });
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "10.5px", color: "var(--cad-text-muted)" }}>Габариты в мм:</span>
              <span className="cad-badge-dim">{widthMm} × {heightMm} мм</span>
            </div>

            <button
              type="button"
              className="cad-quick-action-btn"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("cad:set-image-tool", { detail: { tool: "calibrate" } })
                );
              }}
              title="Активировать интерактивную линейку калибровки на холсте"
            >
              <Ruler size={13} />
              <span>Калибровать по 2 точкам</span>
            </button>
          </div>

          {/* 4. Display Filters & Blending */}
          <div className="cad-prop-group">
            <div className="group-header">4. Отображение и смешивание</div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Прозрачность:</span>
                <strong>{Math.round(activeImage.opacity * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={activeImage.opacity}
                onChange={(e) =>
                  handleUpdateActiveImage({ opacity: parseFloat(e.target.value) })
                }
              />
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Яркость:</span>
                <strong>{activeImage.brightness}%</strong>
              </div>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                value={activeImage.brightness}
                onChange={(e) =>
                  handleUpdateActiveImage({ brightness: parseInt(e.target.value, 10) })
                }
              />
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Контрастность:</span>
                <strong>{activeImage.contrast}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                value={activeImage.contrast}
                onChange={(e) =>
                  handleUpdateActiveImage({ contrast: parseInt(e.target.value, 10) })
                }
              />
            </div>

            {/* Blend Mode */}
            <div className="cad-field-row" style={{ marginTop: "6px" }}>
              <label>Режим наложения:</label>
              <select
                className="cad-field-select"
                style={{ width: "135px" }}
                value={activeImage.blendMode || "normal"}
                onChange={(e) => handleUpdateActiveImage({ blendMode: e.target.value as any })}
              >
                <option value="normal">Normal (Обычный)</option>
                <option value="multiply">Multiply (Умножение)</option>
                <option value="difference">Difference (Разница)</option>
                <option value="screen">Screen (Осветление)</option>
                <option value="overlay">Overlay (Перекрытие)</option>
              </select>
            </div>

            {/* Tint Color */}
            <div className="cad-field-row" style={{ marginTop: "4px" }}>
              <label>Оттенок слоя:</label>
              <select
                className="cad-field-select"
                style={{ width: "135px" }}
                value={activeImage.tintColor || "none"}
                onChange={(e) => handleUpdateActiveImage({ tintColor: e.target.value })}
              >
                <option value="none">Без оттенка</option>
                <option value="red">🔴 Красный (Top)</option>
                <option value="blue">🔵 Синий (Bottom)</option>
                <option value="green">🟢 Зеленый</option>
                <option value="amber">🟠 Янтарный</option>
              </select>
            </div>

            {/* Invert & Grayscale Checkboxes */}
            <div className="cad-field-grid-2" style={{ marginTop: "8px" }}>
              <label className="cad-checkbox-label" style={{ fontSize: "11px" }}>
                <input
                  type="checkbox"
                  checked={activeImage.invert}
                  onChange={(e) =>
                    handleUpdateActiveImage({ invert: e.target.checked })
                  }
                />
                <span>Инверсия (Темный)</span>
              </label>
              <label className="cad-checkbox-label" style={{ fontSize: "11px" }}>
                <input
                  type="checkbox"
                  checked={Boolean(activeImage.grayscale)}
                  onChange={(e) =>
                    handleUpdateActiveImage({ grayscale: e.target.checked })
                  }
                />
                <span>Ч/Б режим</span>
              </label>
            </div>
          </div>

          {/* 5. Quick Actions (Exactly 4 actions) */}
          <div className="cad-prop-group">
            <div className="group-header">5. Быстрые действия</div>
            <div className="cad-quick-actions-list">
              {/* 1. Replace Image File */}
              <button
                type="button"
                className="cad-quick-action-btn btn-replace"
                onClick={() => fileInputRef.current?.click()}
                title="Заменить файл изображения с сохранением координат, угла, масштаба и фильтров"
              >
                <Upload size={13} />
                <span>Заменить файл...</span>
              </button>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleReplaceFileChange}
              />

              {/* 2 & 3 in 2-col grid: Duplicate & Export */}
              <div className="cad-field-grid-2">
                <button
                  type="button"
                  className="cad-quick-action-btn"
                  onClick={handleDuplicateImage}
                  title="Создать копию изображения на холсте"
                >
                  <Copy size={13} />
                  <span>Дублировать</span>
                </button>

                <button
                  type="button"
                  className="cad-quick-action-btn"
                  onClick={handleExportImage}
                  title="Экспортировать изображение с фильтрами в PNG"
                >
                  <Download size={13} />
                  <span>Экспорт...</span>
                </button>
              </div>

              {/* 4. Reset Transform */}
              <button
                type="button"
                className="cad-quick-action-btn btn-reset"
                onClick={handleResetTransform}
                title="Сбросить масштаб в 1.0x, угол в 0° и вернуть фильтры к значениям по умолчанию"
              >
                <RotateCcw size={13} />
                <span>Сбросить все трансформации</span>
              </button>
            </div>
          </div>

        </div>
      </aside>
    );
  };

  // 1. If an image is selected on either background layer
  if (
    (selectedTarget?.type === "layer_bg_top" || selectedTarget?.type === "layer_bg_bottom") &&
    selectedTarget.imageId
  ) {
    const layerKey = selectedTarget.type === "layer_bg_top" ? "bgTop" : "bgBottom";
    return renderSelectedImageInspector(layerKey, selectedTarget.imageId);
  }

  // 2. If a component is selected
  if (selectedComp) {
    const compSide: BoardSide = selectedComp.layer || "top";

    return (
      <aside className="cad-inspector-panel" style={width ? { width: `${width}px` } : undefined}>
        <div className="cad-inspector-header">
          <div className="cad-header-title-group">
            <span className="cad-inspector-title">Компонент</span>
            <span className="cad-inspector-subtitle">{selectedComp.refDes}</span>
          </div>
          <button
            className="cad-inspector-close-btn"
            onClick={handleClose}
            title="Закрыть свойства"
          >
            <X size={14} />
          </button>
        </div>

        <div className="cad-inspector-body">
          <div className="cad-prop-group">
            <div className="group-header">Параметры элемента</div>

            <div className="cad-field-row">
              <label>Обозначение:</label>
              <input
                type="text"
                className="cad-field-input"
                value={selectedComp.refDes}
                onChange={(e) => handleUpdateComponent({ refDes: e.target.value })}
              />
            </div>

            <div className="cad-field-row">
              <label>Номинал:</label>
              <input
                type="text"
                className="cad-field-input"
                value={selectedComp.value}
                onChange={(e) => handleUpdateComponent({ value: e.target.value })}
              />
            </div>

            <div className="cad-field-row">
              <label>Корпус:</label>
              <span className="cad-tag">{selectedComp.type}</span>
            </div>

            {/* Component Side (Top / Bottom) Switcher */}
            <div className="cad-field-row side-control-row">
              <label>Сторона монтажа:</label>
              <div className="cad-side-toggle-group">
                <button
                  type="button"
                  className={`cad-side-btn ${compSide === "top" ? "active" : ""}`}
                  onClick={() => handleUpdateComponent({ layer: "top" })}
                >
                  Лицевая (Top)
                </button>
                <button
                  type="button"
                  className={`cad-side-btn ${compSide === "bottom" ? "active" : ""}`}
                  onClick={() => handleUpdateComponent({ layer: "bottom" })}
                >
                  Обратная (Bottom)
                </button>
              </div>
            </div>

            {/* Position X / Y for component */}
            <div className="cad-field-grid-2" style={{ marginBottom: "6px" }}>
              <div className="cad-labeled-input">
                <label>Позиция X (px)</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={Math.round(selectedComp.x)}
                  onChange={(e) =>
                    handleUpdateComponent({ x: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div className="cad-labeled-input">
                <label>Позиция Y (px)</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={Math.round(selectedComp.y)}
                  onChange={(e) =>
                    handleUpdateComponent({ y: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            </div>

            <div className="cad-field-row">
              <label>Ориентация:</label>
              <div className="row-flex">
                <span className="cad-tag">{selectedComp.rotation}°</span>
                <button className="cad-btn-xs" onClick={handleRotate} title="Повернуть на 90 градусов">
                  <RotateCw size={13} />
                  <span>90°</span>
                </button>
              </div>
            </div>

            <div className="cad-prop-actions">
              <button className="cad-btn-flat btn-sm" onClick={handleToggleCompSide}>
                <FlipHorizontal size={13} />
                <span>Перенести на {compSide === "top" ? "Bottom" : "Top"}</span>
              </button>
              <button className="cad-btn-danger-xs" onClick={handleDeleteComp}>
                <Trash2 size={13} />
                <span>Удалить</span>
              </button>
            </div>
          </div>

          {/* Pin Properties */}
          {selectedPin ? (
            <div className="cad-prop-group net-group">
              <div className="group-header">
                Вывод <strong>№{selectedPin.number}</strong>
              </div>

              <div className="cad-field-row">
                <label>Имя цепи (Net):</label>
                <input
                  type="text"
                  className="cad-field-input net-input"
                  placeholder="GND, +12V, ..."
                  value={selectedPin.netId || ""}
                  onChange={(e) => handleSetPinNet(e.target.value)}
                />
              </div>

              {/* Quick Net Presets */}
              <div className="cad-quick-nets">
                {["GND", "+12V", "+5V", "+3.3V"].map((n) => (
                  <button
                    key={n}
                    className={`cad-net-pill ${selectedPin.netId === n ? "active" : ""}`}
                    onClick={() => handleSetPinNet(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Connected Net List */}
              {activeNet && (
                <div className="cad-connected-block">
                  <div className="connected-header">
                    Связи цепи <strong>[{activeNet}]</strong> ({connectedNodes.length}):
                  </div>
                  <ul className="connected-tree">
                    {connectedNodes.map((node, i) => {
                      const isCurrent =
                        node.compId === selectedComp.id && node.pinId === selectedPin.id;
                      return (
                        <li
                          key={i}
                          className={`connected-node ${isCurrent ? "is-current" : ""}`}
                          onClick={() => {
                            onSelectComponent(node.compId);
                            onSelectPin(node.compId, node.pinId);
                          }}
                        >
                          <span className="node-component">{node.compRef}</span>
                          <span className="node-pin-num">Pin {node.pinNumber}</span>
                          {isCurrent && <span className="current-marker">◀</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="cad-inspector-hint">
              <small>Кликните по ножке компонента для назначения цепи.</small>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // 3. If nothing is selected, Inspector is completely hidden!
  return null;
};
