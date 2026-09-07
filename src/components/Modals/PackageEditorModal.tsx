import React, { useState } from "react";
import { X, Layers, Plus } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { ComponentItem, PinItem } from "../../types/cad";

export const PackageEditorModal: React.FC = () => {
  const { modals, closeModal, cursorMm } = useUiStore();
  const { addComponent, board } = useProjectStore();

  const [family, setFamily] = useState<"SOIC" | "QFP" | "DIP" | "CHIP">("SOIC");
  const [pinCount, setPinCount] = useState<number>(8);
  const [pitch, setPitch] = useState<number>(1.27);
  const [span, setSpan] = useState<number>(5.4);
  const [padW, setPadW] = useState<number>(1.5);
  const [padH, setPadH] = useState<number>(0.6);
  const [refDes, setRefDes] = useState<string>("U_NEW");

  if (!modals.packageEditor) return null;

  const handleCreate = () => {
    let generatedPins: PinItem[] = [];

    if (family === "SOIC" || family === "DIP") {
      const pinsPerSide = Math.floor(pinCount / 2);
      const yStart = -((pinsPerSide - 1) * pitch) / 2;

      for (let i = 0; i < pinsPerSide; i++) {
        const pNum = i + 1;
        generatedPins.push({
          id: `pin_${pNum}`,
          pinNumber: pNum,
          name: `${pNum}`,
          relX: -span / 2,
          relY: yStart + i * pitch,
          shape: "round_rect",
          width: padW,
          height: padH,
        });
      }

      for (let i = 0; i < pinsPerSide; i++) {
        const pNum = pinCount - i;
        generatedPins.push({
          id: `pin_${pNum}`,
          pinNumber: pNum,
          name: `${pNum}`,
          relX: span / 2,
          relY: yStart + i * pitch,
          shape: "round_rect",
          width: padW,
          height: padH,
        });
      }
    } else {
      // 2-pin chip
      generatedPins = [
        { id: "p1", pinNumber: 1, name: "1", relX: -pitch / 2, relY: 0, shape: "rect", width: padW, height: padH },
        { id: "p2", pinNumber: 2, name: "2", relX: pitch / 2, relY: 0, shape: "rect", width: padW, height: padH },
      ];
    }

    const newComp: ComponentItem = {
      id: `comp_${Date.now()}`,
      refDes: refDes || "U1",
      compType: family.toLowerCase(),
      layer: "top",
      x: cursorMm.x || 40,
      y: cursorMm.y || 30,
      rotation: 0,
      bodyShape: "rect",
      bodyWidth: span - padW,
      bodyHeight: Math.max(2, (pinCount / 2) * pitch),
      pins: generatedPins,
    };

    addComponent(newComp);
    closeModal("packageEditor");
  };

  return (
    <div className="cad-modal-backdrop" onClick={() => closeModal("packageEditor")}>
      <div className="cad-modal-box" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} color="#a855f7" />
            <span>Мастер посадочных мест (Package Wizard)</span>
          </div>
          <button
            style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
            onClick={() => closeModal("packageEditor")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="cad-modal-body">
          <div className="cad-input-field">
            <label>Тип / Семейство корпуса</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["SOIC", "DIP", "CHIP"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`cad-btn ${family === f ? "cad-btn-primary" : "cad-btn-secondary"}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setFamily(f);
                    if (f === "SOIC") {
                      setPitch(1.27);
                      setSpan(5.4);
                      setPinCount(8);
                    } else if (f === "DIP") {
                      setPitch(2.54);
                      setSpan(7.62);
                      setPinCount(8);
                    } else {
                      setPitch(1.8);
                      setSpan(2.0);
                      setPinCount(2);
                    }
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="cad-input-field">
              <label>Обозначение (RefDes)</label>
              <input type="text" value={refDes} onChange={(e) => setRefDes(e.target.value)} />
            </div>
            <div className="cad-input-field">
              <label>Число пинов</label>
              <input
                type="number"
                value={pinCount}
                onChange={(e) => setPinCount(parseInt(e.target.value) || 2)}
              />
            </div>
            <div className="cad-input-field">
              <label>Шаг пинов Pitch (мм)</label>
              <input
                type="number"
                step="0.01"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value) || 1.27)}
              />
            </div>
            <div className="cad-input-field">
              <label>Размах рядов Span (мм)</label>
              <input
                type="number"
                step="0.01"
                value={span}
                onChange={(e) => setSpan(parseFloat(e.target.value) || 5.4)}
              />
            </div>
            <div className="cad-input-field">
              <label>Ширина площадки (мм)</label>
              <input
                type="number"
                step="0.05"
                value={padW}
                onChange={(e) => setPadW(parseFloat(e.target.value) || 1.5)}
              />
            </div>
            <div className="cad-input-field">
              <label>Высота площадки (мм)</label>
              <input
                type="number"
                step="0.05"
                value={padH}
                onChange={(e) => setPadH(parseFloat(e.target.value) || 0.6)}
              />
            </div>
          </div>
        </div>

        <div className="cad-modal-footer">
          <button type="button" className="cad-btn cad-btn-secondary" onClick={() => closeModal("packageEditor")}>
            Отмена
          </button>
          <button type="button" className="cad-btn cad-btn-primary" onClick={handleCreate}>
            Сгенерировать и разместить
          </button>
        </div>
      </div>
    </div>
  );
};
