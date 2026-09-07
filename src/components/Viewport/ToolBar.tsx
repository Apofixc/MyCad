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
  ImagePlus,
} from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { ToolMode } from "../../types/cad";
import { openImageFileDialog, readFileAsDataUrl } from "../../utils/imageLoader";

export const ToolBar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    showGrid,
    toggleGrid,
    toggleLoupe,
    showTopLayer,
    setPendingPreprocess,
    setPendingBatchImport,
  } = useUiStore();

  const handleAddImage = async () => {
    const files = await openImageFileDialog();
    if (!files || files.length === 0) return;
    const side = showTopLayer ? "top" : "bottom";

    if (files.length === 1) {
      const f = files[0];
      const filePath = (f as any).filePath as string | undefined;
      const dataUrl = filePath ? filePath : await readFileAsDataUrl(f);
      setPendingPreprocess({
        file: f,
        filePath,
        dataUrl,
        name: f.name,
        side,
      });
    } else {
      setPendingBatchImport({
        files,
        side,
      });
    }
  };

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
      <button
        className="cad-tool-btn"
        onClick={handleAddImage}
        title="Добавить фото или скан платы (PNG, JPG, WEBP, BMP, TIF)"
        style={{
          background: "rgba(14, 165, 233, 0.18)",
          borderColor: "rgba(56, 189, 248, 0.4)",
          color: "#38bdf8",
        }}
      >
        <ImagePlus size={16} />
      </button>

      <div className="cad-tool-sep" />
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
