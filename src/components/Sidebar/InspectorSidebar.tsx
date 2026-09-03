import React from "react";
import { BoardData } from "../../types/project";

interface InspectorSidebarProps {
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  onSelectComponent: (id: string) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  boardData,
  onChangeBoardData,
  onSelectComponent,
  onSelectPin,
}) => {
  const selectedComp = boardData.components.find(
    (c) => c.id === boardData.selectedComponentId
  );
  const selectedPin = selectedComp?.pins.find(
    (p) => p.id === boardData.selectedPinId
  );

  const handleUpdateComponent = (updates: Partial<typeof selectedComp>) => {
    if (!selectedComp) return;
    const updatedComps = boardData.components.map((c) =>
      c.id === selectedComp.id ? { ...c, ...updates } : c
    );
    onChangeBoardData({ ...boardData, components: updatedComps as any });
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

  const handleDelete = () => {
    if (!selectedComp) return;
    const filtered = boardData.components.filter((c) => c.id !== selectedComp.id);
    onChangeBoardData({
      ...boardData,
      components: filtered,
      selectedComponentId: undefined,
      selectedPinId: undefined,
    });
  };

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

  return (
    <aside className="cad-inspector-panel">
      <div className="cad-inspector-header">
        <span className="cad-inspector-title">Свойства</span>
      </div>

      {!selectedComp ? (
        <div className="cad-inspector-empty">
          <p>Элемент не выбран.</p>
          <small>Кликните по компоненту или выводу на плате для настройки параметров и цепей.</small>
        </div>
      ) : (
        <div className="cad-inspector-body">
          {/* Component Properties */}
          <div className="cad-prop-group">
            <div className="group-header">Компонент: {selectedComp.refDes}</div>

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

            <div className="cad-field-row">
              <label>Ориентация:</label>
              <div className="row-flex">
                <span className="cad-tag">{selectedComp.rotation}°</span>
                <button className="cad-btn-xs" onClick={handleRotate} title="Повернуть на 90 градусов">
                  ↻ 90°
                </button>
              </div>
            </div>

            <div className="cad-prop-actions">
              <button className="cad-btn-danger-xs" onClick={handleDelete}>
                Удалить компонент
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
              <small>Выберите ножку компонента для назначения цепи.</small>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
