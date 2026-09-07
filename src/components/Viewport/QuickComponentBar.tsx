import React from "react";
import { Plus } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { ComponentItem } from "../../types/cad";

export const QuickComponentBar: React.FC = () => {
  const { addComponent, board } = useProjectStore();
  const { cursorMm } = useUiStore();

  const handleAddQuick = (type: "r0805" | "c0805" | "sot23" | "soic8" | "via") => {
    if (!board) return;

    const count = board.data.components.length + 1;
    let newComp: ComponentItem;

    switch (type) {
      case "r0805":
        newComp = {
          id: `comp_r_${Date.now()}`,
          refDes: `R${count}`,
          value: "10k",
          compType: "resistor",
          layer: "top",
          x: Math.round(cursorMm.x * 10) / 10 || 40,
          y: Math.round(cursorMm.y * 10) / 10 || 30,
          rotation: 0,
          bodyShape: "rect",
          bodyWidth: 2.0,
          bodyHeight: 1.25,
          pins: [
            { id: "p1", pinNumber: 1, name: "1", relX: -0.9, relY: 0, shape: "rect", width: 0.8, height: 1.0 },
            { id: "p2", pinNumber: 2, name: "2", relX: 0.9, relY: 0, shape: "rect", width: 0.8, height: 1.0 },
          ],
        };
        break;
      case "c0805":
        newComp = {
          id: `comp_c_${Date.now()}`,
          refDes: `C${count}`,
          value: "100nF",
          compType: "capacitor",
          layer: "top",
          x: Math.round(cursorMm.x * 10) / 10 || 40,
          y: Math.round(cursorMm.y * 10) / 10 || 30,
          rotation: 0,
          bodyShape: "rect",
          bodyWidth: 2.0,
          bodyHeight: 1.25,
          pins: [
            { id: "p1", pinNumber: 1, name: "1", relX: -0.9, relY: 0, shape: "rect", width: 0.8, height: 1.0 },
            { id: "p2", pinNumber: 2, name: "2", relX: 0.9, relY: 0, shape: "rect", width: 0.8, height: 1.0 },
          ],
        };
        break;
      case "sot23":
        newComp = {
          id: `comp_vt_${Date.now()}`,
          refDes: `VT${count}`,
          value: "2N7002",
          compType: "transistor",
          layer: "top",
          x: Math.round(cursorMm.x * 10) / 10 || 40,
          y: Math.round(cursorMm.y * 10) / 10 || 30,
          rotation: 0,
          bodyShape: "rect",
          bodyWidth: 2.9,
          bodyHeight: 1.3,
          pins: [
            { id: "p1", pinNumber: 1, name: "G", relX: -0.95, relY: 1.0, shape: "rect", width: 0.6, height: 0.8 },
            { id: "p2", pinNumber: 2, name: "S", relX: 0.95, relY: 1.0, shape: "rect", width: 0.6, height: 0.8 },
            { id: "p3", pinNumber: 3, name: "D", relX: 0.0, relY: -1.0, shape: "rect", width: 0.6, height: 0.8 },
          ],
        };
        break;
      case "soic8":
        newComp = {
          id: `comp_u_${Date.now()}`,
          refDes: `U${count}`,
          value: "SOIC-8",
          compType: "ic",
          layer: "top",
          x: Math.round(cursorMm.x * 10) / 10 || 40,
          y: Math.round(cursorMm.y * 10) / 10 || 30,
          rotation: 0,
          bodyShape: "rect",
          bodyWidth: 4.9,
          bodyHeight: 3.9,
          hasPolarityMark: true,
          pins: [
            { id: "p1", pinNumber: 1, name: "1", relX: -2.7, relY: -1.9, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p2", pinNumber: 2, name: "2", relX: -2.7, relY: -0.63, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p3", pinNumber: 3, name: "3", relX: -2.7, relY: 0.63, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p4", pinNumber: 4, name: "4", relX: -2.7, relY: 1.9, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p5", pinNumber: 5, name: "5", relX: 2.7, relY: 1.9, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p6", pinNumber: 6, name: "6", relX: 2.7, relY: 0.63, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p7", pinNumber: 7, name: "7", relX: 2.7, relY: -0.63, shape: "round_rect", width: 1.5, height: 0.6 },
            { id: "p8", pinNumber: 8, name: "8", relX: 2.7, relY: -1.9, shape: "round_rect", width: 1.5, height: 0.6 },
          ],
        };
        break;
      case "via":
        newComp = {
          id: `via_${Date.now()}`,
          refDes: `VIA${count}`,
          value: "0.6mm",
          compType: "via",
          layer: "top",
          x: Math.round(cursorMm.x * 10) / 10 || 40,
          y: Math.round(cursorMm.y * 10) / 10 || 30,
          rotation: 0,
          bodyShape: "circle",
          bodyWidth: 0.9,
          bodyHeight: 0.9,
          pins: [
            { id: "p1", pinNumber: 1, name: "VIA", relX: 0, relY: 0, shape: "circle", width: 0.9, height: 0.9, drillDiameter: 0.4 },
          ],
        };
        break;
    }

    addComponent(newComp);
  };

  return (
    <div className="cad-quick-bar">
      <span style={{ fontSize: "11px", color: "var(--cad-text-dim)", marginRight: "4px" }}>+ Быстро:</span>
      <button className="cad-quick-chip" onClick={() => handleAddQuick("r0805")}>
        R 0805
      </button>
      <button className="cad-quick-chip" onClick={() => handleAddQuick("c0805")}>
        C 0805
      </button>
      <button className="cad-quick-chip" onClick={() => handleAddQuick("sot23")}>
        SOT-23
      </button>
      <button className="cad-quick-chip" onClick={() => handleAddQuick("soic8")}>
        SOIC-8
      </button>
      <button className="cad-quick-chip" onClick={() => handleAddQuick("via")}>
        Via / TP
      </button>
    </div>
  );
};
