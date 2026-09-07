import React from "react";
import {
  MousePointer,
  Move,
  Ruler,
  Compass,
  Layers,
  SplitSquareVertical,
  Search,
  Zap,
  Grid,
} from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { ToolMode } from "../../types/cad";

export const ToolBar: React.FC = () => {
  const { activeTool, setActiveTool, showGrid, toggleGrid, toggleLoupe, loupeActive } = useUiStore();

  const tools: { id: ToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: "select", label: "Выбор и инспекция", icon: <MousePointer size={16} />, shortcut: "V" },
    { id: "transform", label: "Трансформация скана", icon: <Move size={16} />, shortcut: "T" },
    { id: "calibrate", label: "Калибровка масштаба (мм)", icon: <Ruler size={16} />, shortcut: "C" },
    { id: "level", label: "Выравнивание горизонта", icon: <Compass size={16} />, shortcut: "L" },
    { id: "register", label: "Совмещение Top/Bottom", icon: <Layers size={16} />, shortcut: "R" },
    { id: "curtain", label: "Шторка просвета слоёв", icon: <SplitSquareVertical size={16} />, shortcut: "S" },
    { id: "measure", label: "Линейка измерений", icon: <Ruler size={16} />, shortcut: "M" },
    { id: "magnifier", label: "Экранная лупа", icon: <Search size={16} />, shortcut: "Z" },
    { id: "blink", label: "Стробоскоп слоёв", icon: <Zap size={16} />, shortcut: "B" },
  ];

  return (
    <div className="cad-floating-toolbar">
      {tools.map((t) => (
        <button
          key={t.id}
          className={`cad-tool-btn ${activeTool === t.id ? "active" : ""}`}
          onClick={() => {
            if (t.id === "magnifier") {
              toggleLoupe();
            }
            setActiveTool(t.id);
          }}
          title={`${t.label} (${t.shortcut})`}
        >
          {t.icon}
        </button>
      ))}

      <div className="cad-tool-sep" />

      <button
        className={`cad-tool-btn ${showGrid ? "active" : ""}`}
        onClick={toggleGrid}
        title="Координатная сетка платы (G)"
      >
        <Grid size={16} />
      </button>
    </div>
  );
};
