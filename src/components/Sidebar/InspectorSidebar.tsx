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
  Trash2,
  Lock,
  Unlock,
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


    return (
      <aside className="cad-inspector-panel" style={width ? { width: `${width}px` } : undefined}>
        <div className="cad-inspector-header">
          <div className="cad-header-title-group">
            <span className="cad-inspector-title">Изображение</span>
            <span className="cad-inspector-subtitle" title={activeImage.name}>
              {activeImage.name}
            </span>
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
              className="cad-inspector-close-btn"
              onClick={handleClose}
              title="Закрыть свойства"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="cad-inspector-body">
          {/* Scale */}
          <div className="cad-prop-group">
            <div className="group-header">Масштаб</div>

            <div className="cad-field-row">
              <label>Множитель:</label>
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
                  title="Сбросить масштаб на 100% (1.0x)"
                >
                  1.0×
                </button>
              </div>
            </div>
          </div>

          {/* Angle & Alignment Tools */}
          <div className="cad-prop-group">
            <div className="group-header">Поворот и выравнивание</div>

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
                <span>Повернуть 90°</span>
              </button>
              <button
                className="cad-btn-flat btn-sm"
                onClick={() => handleUpdateActiveImage({ rotation: 0 })}
                title="Сбросить угол в 0°"
              >
                <span>Сброс (0°)</span>
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

          {/* Positioning */}
          <div className="cad-prop-group">
            <div className="group-header">Позиция</div>

            <div className="cad-field-grid-2">
              <div className="cad-labeled-input">
                <label>Позиция X (px)</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={activeImage.x}
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
