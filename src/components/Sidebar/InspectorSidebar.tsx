import React, { useState } from "react";
import {
  BoardData,
  BoardSelectionTarget,
  BoardSide,
  ComponentItem,
  LayerImageItem,
  normalizeBoardData,
} from "../../types/project";
import {
  openImageFileDialog,
  createLayerImageItemFromFile,
  extractImagesFromDrop,
} from "../../utils/imageLoader";
import {
  Image as ImageIcon,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Trash2,
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  ArrowUp,
  ArrowDown,
  Ruler,
} from "lucide-react";

interface InspectorSidebarProps {
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  onSelectComponent: (id: string | undefined) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
  onSelectTarget?: (target: BoardSelectionTarget) => void;
  onStartCalibration?: () => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  boardData: rawBoardData,
  onChangeBoardData,
  onSelectComponent,
  onSelectPin,
  onSelectTarget,
  onStartCalibration,
}) => {
  const boardData = normalizeBoardData(rawBoardData);
  const [isDropzoneHovered, setIsDropzoneHovered] = useState(false);

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

  // Helper for background layer multi-image inspector
  const renderImageLayerInspector = (layerKey: "bgTop" | "bgBottom") => {
    const isTop = layerKey === "bgTop";
    const targetType = isTop ? "layer_bg_top" : "layer_bg_bottom";
    const bg = isTop ? boardData.bgTop : boardData.bgBottom;
    const title = isTop ? "Подложка: Top (Лицевая)" : "Подложка: Bottom (Обратная)";

    const updateBg = (updates: Partial<typeof bg>) => {
      onChangeBoardData({
        ...boardData,
        [layerKey]: { ...bg, ...updates },
      });
    };

    const images = bg.images || [];
    const targetImageId =
      selectedTarget?.type === targetType ? selectedTarget.imageId : undefined;
    const activeImageId = targetImageId || bg.activeImageId || images[0]?.id;
    const activeImage = images.find((img) => img.id === activeImageId) || images[0];

    const handleUpdateActiveImage = (updates: Partial<LayerImageItem>) => {
      if (!activeImage) return;
      const updatedImages = images.map((img) =>
        img.id === activeImage.id ? { ...img, ...updates } : img
      );
      updateBg({
        images: updatedImages,
        image: updatedImages[0]?.src,
      });
    };

    const handleSelectImage = (id: string) => {
      onChangeBoardData({
        ...boardData,
        [layerKey]: { ...bg, activeImageId: id },
        selectedTarget: { type: targetType, imageId: id },
      });
    };

    const handleDeleteImage = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const filtered = images.filter((img) => img.id !== id);
      const nextActiveId = filtered.length > 0 ? filtered[0].id : undefined;
      onChangeBoardData({
        ...boardData,
        [layerKey]: {
          ...bg,
          images: filtered,
          activeImageId: nextActiveId,
          image: filtered[0]?.src,
        },
        selectedTarget: nextActiveId
          ? { type: targetType, imageId: nextActiveId }
          : { type: targetType },
      });
    };

    const handleToggleImageVisibility = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = images.map((img) =>
        img.id === id ? { ...img, visible: !img.visible } : img
      );
      updateBg({ images: updated });
    };

    const handleToggleImageLock = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = images.map((img) =>
        img.id === id ? { ...img, locked: !img.locked } : img
      );
      updateBg({ images: updated });
    };

    const handleMoveOrder = (id: string, direction: "up" | "down", e: React.MouseEvent) => {
      e.stopPropagation();
      const idx = images.findIndex((img) => img.id === id);
      if (idx === -1) return;
      if (direction === "up" && idx === 0) return;
      if (direction === "down" && idx === images.length - 1) return;

      const newArr = [...images];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      const temp = newArr[idx];
      newArr[idx] = newArr[targetIdx];
      newArr[targetIdx] = temp;
      updateBg({ images: newArr });
    };

    const handleAddImages = async () => {
      const files = await openImageFileDialog();
      if (!files || files.length === 0) return;
      await processAndAddFiles(files);
    };

    const processAndAddFiles = async (files: File[]) => {
      const newItems: LayerImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const item = await createLayerImageItemFromFile(files[i], {
          isTop,
          order: images.length + i,
          index: i,
        });
        newItems.push(item);
      }
      if (newItems.length === 0) return;

      const combined = [...images, ...newItems];
      const newActiveId = newItems[newItems.length - 1].id;
      onChangeBoardData({
        ...boardData,
        [layerKey]: {
          ...bg,
          images: combined,
          activeImageId: newActiveId,
          image: combined[0]?.src,
          visible: true,
        },
        selectedTarget: { type: targetType, imageId: newActiveId },
      });
    };

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">{title}</span>
          <label className="cad-layer-vis-switch" title="Видимость слоя">
            <input
              type="checkbox"
              checked={bg.visible}
              onChange={(e) => updateBg({ visible: e.target.checked })}
            />
            {bg.visible ? <Eye size={14} className="eye-on" /> : <EyeOff size={14} className="eye-off" />}
          </label>
        </div>

        <div className="cad-inspector-body">
          {/* Group 1: Multi-Image Manager */}
          <div className="cad-prop-group">
            <div className="group-header flex-between">
              <span>Изображения на слое ({images.length})</span>
              {images.length > 0 && (
                <button
                  className="cad-btn-icon-label"
                  onClick={handleAddImages}
                  title="Загрузить дополнительное изображение (скан, макро, фрагмент)"
                >
                  <Plus size={13} />
                  <span>Добавить</span>
                </button>
              )}
            </div>

            {images.length === 0 ? (
              <div
                className={`cad-empty-dropzone ${isDropzoneHovered ? "drop-active" : ""}`}
                onClick={handleAddImages}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDropzoneHovered(true);
                }}
                onDragLeave={() => setIsDropzoneHovered(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDropzoneHovered(false);
                  const files = extractImagesFromDrop(e);
                  if (files.length > 0) {
                    await processAndAddFiles(files);
                  }
                }}
              >
                <ImageIcon size={28} className="dropzone-icon" />
                <p>На этом слое пока нет фото или сканов</p>
                <button
                  type="button"
                  className="cad-btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddImages();
                  }}
                >
                  <Plus size={13} />
                  <span>Загрузить изображения...</span>
                </button>
                <small>Поддерживается выбор файлов или перетаскивание (Drag & Drop)</small>
              </div>
            ) : (
              <div className="cad-image-card-list">
                {images.map((img, idx) => {
                  const isSelected = activeImage?.id === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`cad-image-card ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectImage(img.id)}
                    >
                      <div className="cad-card-thumb-wrap">
                        <img
                          src={img.src}
                          alt={img.name}
                          className="cad-card-thumb"
                          style={{
                            transform: img.mirrored ? "scaleX(-1)" : "none",
                            filter: `brightness(${img.brightness}%) contrast(${img.contrast}%) ${
                              img.invert ? "invert(1)" : ""
                            }`,
                            opacity: img.opacity,
                          }}
                        />
                        {img.locked && (
                          <div className="card-lock-badge" title="Заблокировано от сдвига">
                            <Lock size={10} />
                          </div>
                        )}
                      </div>

                      <div className="cad-card-info">
                        <input
                          type="text"
                          className="cad-card-name-input"
                          value={img.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const updated = images.map((item) =>
                              item.id === img.id ? { ...item, name: e.target.value } : item
                            );
                            updateBg({ images: updated });
                          }}
                        />
                        <div className="cad-card-meta">
                          <span>{Math.round(img.scale * 100)}%</span>
                          <span>•</span>
                          <span>{img.rotation.toFixed(1)}°</span>
                          {img.mirrored && (
                            <>
                              <span>•</span>
                              <span className="card-flip-tag">FLIP</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="cad-card-actions">
                        <button
                          className={`cad-card-btn ${img.visible ? "" : "inactive"}`}
                          onClick={(e) => handleToggleImageVisibility(img.id, e)}
                          title={img.visible ? "Скрыть изображение" : "Показать изображение"}
                        >
                          {img.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          className={`cad-card-btn ${img.locked ? "active-lock" : ""}`}
                          onClick={(e) => handleToggleImageLock(img.id, e)}
                          title={img.locked ? "Разблокировать" : "Заблокировать от перемещения"}
                        >
                          {img.locked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                        <button
                          className="cad-card-btn"
                          disabled={idx === 0}
                          onClick={(e) => handleMoveOrder(img.id, "up", e)}
                          title="Переместить слой выше"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          className="cad-card-btn"
                          disabled={idx === images.length - 1}
                          onClick={(e) => handleMoveOrder(img.id, "down", e)}
                          title="Переместить слой ниже"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          className="cad-card-btn danger"
                          onClick={(e) => handleDeleteImage(img.id, e)}
                          title="Удалить это изображение"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 2: Specialized Tools for Active Image */}
          {activeImage && (
            <>
              {/* Scale & 2-Point Calibration */}
              <div className="cad-prop-group">
                <div className="group-header flex-between">
                  <span>Масштаб и калибровка</span>
                  <span className="active-img-badge">{activeImage.name}</span>
                </div>

                {/* 2-Point Scale Calibration Tool */}
                <div className="cad-tool-callout">
                  <button
                    className="cad-btn-primary full-width"
                    onClick={() => {
                      if (onStartCalibration) {
                        onStartCalibration();
                      } else {
                        // Dispatch custom event for canvas calibration mode
                        window.dispatchEvent(
                          new CustomEvent("mycad-start-calibration", {
                            detail: { layerKey, imageId: activeImage.id },
                          })
                        );
                      }
                    }}
                    title="Кликните 2 точки на холсте (например, 2 вывода детали) и укажите точное расстояние в мм"
                  >
                    <Ruler size={15} />
                    <span>Калибровать по 2 точкам (мм)...</span>
                  </button>
                  <small className="callout-hint">
                    Автоматический расчет масштаба по известному расстоянию между контактами или линейке
                  </small>
                </div>

                <div className="cad-field-row">
                  <label>Множитель масштаба:</label>
                  <div className="cad-input-with-actions">
                    <input
                      type="number"
                      step="0.01"
                      min="0.05"
                      max="20"
                      className="cad-field-input"
                      value={activeImage.scale}
                      onChange={(e) =>
                        handleUpdateActiveImage({ scale: parseFloat(e.target.value) || 1 })
                      }
                    />
                    <button
                      className="cad-btn-flat btn-xs"
                      onClick={() => handleUpdateActiveImage({ scale: 1 })}
                      title="Сбросить масштаб на 100%"
                    >
                      1:1
                    </button>
                  </div>
                </div>
              </div>

              {/* Angle & Alignment Tools */}
              <div className="cad-prop-group">
                <div className="group-header">Выравнивание перекоса и поворот</div>

                {/* Fine Angle Adjuster Buttons */}
                <div className="cad-fine-angle-bar">
                  <span className="fine-label">Угол:</span>
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
                    <span>Повернуть 90°</span>
                  </button>
                  <button
                    className="cad-btn-flat btn-sm"
                    onClick={() => handleUpdateActiveImage({ rotation: 0 })}
                    title="Сбросить угол в 0°"
                  >
                    <span>Сброс угла (0°)</span>
                  </button>
                </div>

                {/* Mirroring / Flips */}
                <div className="cad-btn-grid-2" style={{ marginTop: "6px" }}>
                  <button
                    className={`cad-btn-flat btn-sm ${activeImage.mirrored ? "btn-active-toggle" : ""}`}
                    onClick={() =>
                      handleUpdateActiveImage({ mirrored: !activeImage.mirrored })
                    }
                    title="Отзеркалить по горизонтали (Flip X)"
                  >
                    <FlipHorizontal size={14} />
                    <span>Зеркало Flip X</span>
                  </button>
                  <button
                    className={`cad-btn-flat btn-sm ${activeImage.flipV ? "btn-active-toggle" : ""}`}
                    onClick={() =>
                      handleUpdateActiveImage({ flipV: !activeImage.flipV })
                    }
                    title="Отзеркалить по вертикали (Flip Y)"
                  >
                    <FlipVertical size={14} />
                    <span>Зеркало Flip Y</span>
                  </button>
                </div>
              </div>

              {/* Positioning & Lock */}
              <div className="cad-prop-group">
                <div className="group-header flex-between">
                  <span>Позиция и фиксация</span>
                  <button
                    className={`cad-lock-pill ${activeImage.locked ? "locked" : ""}`}
                    onClick={() => handleUpdateActiveImage({ locked: !activeImage.locked })}
                    title={activeImage.locked ? "Кликните, чтобы разблокировать" : "Кликните, чтобы заблокировать от сдвига"}
                  >
                    {activeImage.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    <span>{activeImage.locked ? "Зафиксировано" : "Не заблокировано"}</span>
                  </button>
                </div>

                <div className="cad-field-row-2">
                  <div>
                    <label>Позиция X (px):</label>
                    <input
                      type="number"
                      className="cad-field-input"
                      value={activeImage.x}
                      onChange={(e) =>
                        handleUpdateActiveImage({ x: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label>Позиция Y (px):</label>
                    <input
                      type="number"
                      className="cad-field-input"
                      value={activeImage.y}
                      onChange={(e) =>
                        handleUpdateActiveImage({ y: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Display Filters & Transparency */}
              <div className="cad-prop-group">
                <div className="group-header">Фильтры и видимость</div>

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

                <div className="cad-field-row checkbox-row">
                  <label className="cad-checkbox-label">
                    <input
                      type="checkbox"
                      checked={activeImage.invert}
                      onChange={(e) =>
                        handleUpdateActiveImage({ invert: e.target.checked })
                      }
                    />
                    <span>Инвертировать чертеж (Темный режим)</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    );
  };

  // 1. Layer: Background Top
  if (selectedTarget?.type === "layer_bg_top") {
    return renderImageLayerInspector("bgTop");
  }

  // 2. Layer: Background Bottom
  if (selectedTarget?.type === "layer_bg_bottom") {
    return renderImageLayerInspector("bgBottom");
  }

  // 3. Layer: Components Top
  if (selectedTarget?.type === "layer_comps_top") {
    const topComps = boardData.components.filter((c) => (c.layer || "top") === "top");

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">Компоненты: Top (Лицевая)</span>
        </div>

        <div className="cad-inspector-body">
          <div className="cad-prop-group">
            <div className="group-header">Управление видимостью</div>
            <div className="cad-field-row checkbox-row">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={boardData.showCompsTop}
                  onChange={(e) =>
                    onChangeBoardData({ ...boardData, showCompsTop: e.target.checked })
                  }
                />
                <span>Показывать компоненты Top на плате</span>
              </label>
            </div>
          </div>

          <div className="cad-prop-group">
            <div className="group-header">
              Список деталей ({topComps.length} шт)
            </div>
            <ul className="cad-layer-comp-list">
              {topComps.map((c) => (
                <li
                  key={c.id}
                  className="comp-row"
                  onClick={() => {
                    onSelectComponent(c.id);
                    onSelectTarget?.({ type: "component", id: c.id });
                  }}
                >
                  <span className="comp-ref">{c.refDes}</span>
                  <span className="comp-val">{c.value}</span>
                  <span className="comp-type">{c.type}</span>
                </li>
              ))}
              {topComps.length === 0 && (
                <li className="empty-hint">На лицевой стороне нет компонентов.</li>
              )}
            </ul>
          </div>
        </div>
      </aside>
    );
  }

  // 4. Layer: Components Bottom
  if (selectedTarget?.type === "layer_comps_bottom") {
    const bottomComps = boardData.components.filter((c) => c.layer === "bottom");

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">Компоненты: Bottom (Обратная)</span>
        </div>

        <div className="cad-inspector-body">
          <div className="cad-prop-group">
            <div className="group-header">Управление видимостью</div>
            <div className="cad-field-row checkbox-row">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={boardData.showCompsBottom}
                  onChange={(e) =>
                    onChangeBoardData({ ...boardData, showCompsBottom: e.target.checked })
                  }
                />
                <span>Показывать компоненты Bottom на плате</span>
              </label>
            </div>
          </div>

          <div className="cad-prop-group">
            <div className="group-header">
              Список деталей ({bottomComps.length} шт)
            </div>
            <ul className="cad-layer-comp-list">
              {bottomComps.map((c) => (
                <li
                  key={c.id}
                  className="comp-row"
                  onClick={() => {
                    onSelectComponent(c.id);
                    onSelectTarget?.({ type: "component", id: c.id });
                  }}
                >
                  <span className="comp-ref">{c.refDes}</span>
                  <span className="comp-val">{c.value}</span>
                  <span className="comp-type">{c.type}</span>
                </li>
              ))}
              {bottomComps.length === 0 && (
                <li className="empty-hint">На обратной стороне нет компонентов.</li>
              )}
            </ul>
          </div>
        </div>
      </aside>
    );
  }

  // 5. Selected Component Inspector
  if (selectedComp) {
    const compSide: BoardSide = selectedComp.layer || "top";

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">Компонент: {selectedComp.refDes}</span>
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

  // 6. Default Empty State
  return (
    <aside className="cad-inspector-panel">
      <div className="cad-inspector-header">
        <span className="cad-inspector-title">Свойства</span>
      </div>

      <div className="cad-inspector-empty">
        <div className="empty-icon-wrap">
          <Layers size={28} />
        </div>
        <p>Элемент не выбран</p>
        <small>
          Выберите слой в дереве слева (<strong>Подложка</strong>, <strong>Компоненты</strong>) или кликните по радиодетали на плате для просмотра и настройки параметров.
        </small>
      </div>
    </aside>
  );
};
