import React, { useRef } from "react";
import {
  BoardData,
  BoardSelectionTarget,
  BoardSide,
  ComponentItem,
  normalizeBoardData,
} from "../../types/project";
import {
  Image as ImageIcon,
  FlipHorizontal,
  RotateCw,
  Trash2,
  Layers,
} from "lucide-react";

interface InspectorSidebarProps {
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  onSelectComponent: (id: string | undefined) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
  onSelectTarget?: (target: BoardSelectionTarget) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  boardData: rawBoardData,
  onChangeBoardData,
  onSelectComponent,
  onSelectPin,
  onSelectTarget,
}) => {
  const boardData = normalizeBoardData(rawBoardData);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);

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

  // Handlers for BG upload
  const handleUploadBgTop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChangeBoardData({
        ...boardData,
        bgTop: {
          ...boardData.bgTop,
          image: reader.result as string,
          visible: true,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadBgBottom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChangeBoardData({
        ...boardData,
        bgBottom: {
          ...boardData.bgBottom,
          image: reader.result as string,
          visible: true,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  // Connected nodes list for active net
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

  // Determine what panel to show:
  // 1. Layer: Background Top
  if (selectedTarget?.type === "layer_bg_top") {
    const bg = boardData.bgTop;
    const updateBgTop = (updates: Partial<typeof bg>) => {
      onChangeBoardData({
        ...boardData,
        bgTop: { ...bg, ...updates },
      });
    };

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">Слой: Фон Top (Лицевая)</span>
        </div>

        <div className="cad-inspector-body">
          <div className="cad-prop-group">
            <div className="group-header">Подложка лицевой стороны</div>

            <div className="cad-image-actions">
              <input
                ref={fileInputTopRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleUploadBgTop}
              />
              <button
                className="cad-btn-primary full-width"
                onClick={() => fileInputTopRef.current?.click()}
              >
                <ImageIcon size={14} />
                <span>{bg.image ? "Заменить изображение..." : "Загрузить скан/фото Top..."}</span>
              </button>
              {bg.image && (
                <button
                  className="cad-btn-flat btn-sm"
                  onClick={() => updateBgTop({ image: undefined })}
                >
                  Удалить подложку
                </button>
              )}
            </div>

            {bg.image && (
              <div className="cad-bg-preview-box">
                <img
                  src={bg.image}
                  alt="Top Preview"
                  style={{
                    filter: `brightness(${bg.brightness}%) contrast(${bg.contrast}%) ${
                      bg.invert ? "invert(1)" : ""
                    }`,
                    opacity: bg.opacity,
                  }}
                />
              </div>
            )}
          </div>

          <div className="cad-prop-group">
            <div className="group-header">Параметры отображения</div>

            <div className="cad-field-row checkbox-row">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={bg.visible}
                  onChange={(e) => updateBgTop({ visible: e.target.checked })}
                />
                <span>Видимость слоя (Вкл)</span>
              </label>
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Прозрачность:</span>
                <strong>{Math.round(bg.opacity * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={bg.opacity}
                onChange={(e) => updateBgTop({ opacity: parseFloat(e.target.value) })}
              />
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Яркость:</span>
                <strong>{bg.brightness}%</strong>
              </div>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                value={bg.brightness}
                onChange={(e) => updateBgTop({ brightness: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Контрастность:</span>
                <strong>{bg.contrast}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                value={bg.contrast}
                onChange={(e) => updateBgTop({ contrast: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="cad-field-row checkbox-row">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={bg.invert}
                  onChange={(e) => updateBgTop({ invert: e.target.checked })}
                />
                <span>Инвертировать чертеж (Темный режим)</span>
              </label>
            </div>
          </div>

          <div className="cad-prop-group">
            <div className="group-header">Калибровка смещения</div>
            <div className="cad-field-row-2">
              <div>
                <label>Смещение X:</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={bg.offsetX}
                  onChange={(e) => updateBgTop({ offsetX: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div>
                <label>Смещение Y:</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={bg.offsetY}
                  onChange={(e) => updateBgTop({ offsetY: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            </div>
            <div className="cad-field-row">
              <label>Масштаб:</label>
              <input
                type="number"
                step="0.05"
                className="cad-field-input"
                value={bg.scale}
                onChange={(e) => updateBgTop({ scale: parseFloat(e.target.value) || 1 })}
              />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 2. Layer: Background Bottom
  if (selectedTarget?.type === "layer_bg_bottom") {
    const bg = boardData.bgBottom;
    const updateBgBottom = (updates: Partial<typeof bg>) => {
      onChangeBoardData({
        ...boardData,
        bgBottom: { ...bg, ...updates },
      });
    };

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">Слой: Фон Bottom (Обратная)</span>
        </div>

        <div className="cad-inspector-body">
          <div className="cad-prop-group">
            <div className="group-header">Подложка обратной стороны</div>

            <div className="cad-image-actions">
              <input
                ref={fileInputBottomRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleUploadBgBottom}
              />
              <button
                className="cad-btn-primary full-width"
                onClick={() => fileInputBottomRef.current?.click()}
              >
                <ImageIcon size={14} />
                <span>{bg.image ? "Заменить фото Bottom..." : "Загрузить фото/скан Bottom..."}</span>
              </button>
              {bg.image && (
                <button
                  className="cad-btn-flat btn-sm"
                  onClick={() => updateBgBottom({ image: undefined })}
                >
                  Удалить подложку
                </button>
              )}
            </div>

            {bg.image && (
              <div className="cad-bg-preview-box">
                <img
                  src={bg.image}
                  alt="Bottom Preview"
                  style={{
                    transform: bg.mirrored ? "scaleX(-1)" : "none",
                    filter: `brightness(${bg.brightness}%) contrast(${bg.contrast}%) ${
                      bg.invert ? "invert(1)" : ""
                    }`,
                    opacity: bg.opacity,
                  }}
                />
              </div>
            )}
          </div>

          <div className="cad-prop-group">
            <div className="group-header">Отображение и Зеркалирование</div>

            <div className="cad-field-row checkbox-row">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={bg.visible}
                  onChange={(e) => updateBgBottom({ visible: e.target.checked })}
                />
                <span>Видимость слоя (Вкл)</span>
              </label>
            </div>

            <div className="cad-field-row checkbox-row flip-highlight">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!bg.mirrored}
                  onChange={(e) => updateBgBottom({ mirrored: e.target.checked })}
                />
                <FlipHorizontal size={15} />
                <strong>Отзеркалить по горизонтали (Flip X)</strong>
              </label>
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Прозрачность:</span>
                <strong>{Math.round(bg.opacity * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={bg.opacity}
                onChange={(e) => updateBgBottom({ opacity: parseFloat(e.target.value) })}
              />
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Яркость:</span>
                <strong>{bg.brightness}%</strong>
              </div>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                value={bg.brightness}
                onChange={(e) => updateBgBottom({ brightness: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="cad-slider-group">
              <div className="cad-slider-label">
                <span>Контрастность:</span>
                <strong>{bg.contrast}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                value={bg.contrast}
                onChange={(e) => updateBgBottom({ contrast: parseInt(e.target.value, 10) })}
              />
            </div>

            <div className="cad-field-row checkbox-row">
              <label className="cad-checkbox-label">
                <input
                  type="checkbox"
                  checked={bg.invert}
                  onChange={(e) => updateBgBottom({ invert: e.target.checked })}
                />
                <span>Инвертировать чертеж</span>
              </label>
            </div>
          </div>

          <div className="cad-prop-group">
            <div className="group-header">Подгонка совмещения со слоем Top</div>
            <div className="cad-field-row-2">
              <div>
                <label>Смещение X:</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={bg.offsetX}
                  onChange={(e) => updateBgBottom({ offsetX: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div>
                <label>Смещение Y:</label>
                <input
                  type="number"
                  className="cad-field-input"
                  value={bg.offsetY}
                  onChange={(e) => updateBgBottom({ offsetY: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            </div>
            <div className="cad-field-row">
              <label>Масштаб:</label>
              <input
                type="number"
                step="0.05"
                className="cad-field-input"
                value={bg.scale}
                onChange={(e) => updateBgBottom({ scale: parseFloat(e.target.value) || 1 })}
              />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 3. Layer: Components Top
  if (selectedTarget?.type === "layer_comps_top") {
    const topComps = boardData.components.filter((c) => (c.layer || "top") === "top");

    return (
      <aside className="cad-inspector-panel">
        <div className="cad-inspector-header">
          <span className="cad-inspector-title">Слой: Компоненты Top</span>
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
          <span className="cad-inspector-title">Слой: Компоненты Bottom</span>
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
          Выберите слой в дереве слева (<strong>Фон Top</strong>, <strong>Фон Bottom</strong>) или кликните по радиодетали на плате для просмотра и настройки параметров.
        </small>
      </div>
    </aside>
  );
};
