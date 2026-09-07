import React, { useState } from "react";
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

export const ToolBar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    showGrid,
    toggleGrid,
    toggleLoupe,
    setPendingPreprocess,
    setPendingBatchImport,
  } = useUiStore();

  const [showImageMenu, setShowImageMenu] = useState(false);

  const handleAddImage = async (side: "top" | "bottom" = "top") => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const sel = await open({
          multiple: true,
          filters: [
            {
              name: "Изображения плат",
              extensions: ["png", "jpg", "jpeg", "tif", "tiff", "webp", "bmp"],
            },
          ],
        });
        if (sel) {
          const paths: string[] = Array.isArray(sel) ? (sel as string[]) : [sel as any];
          if (paths.length === 1) {
            const path = paths[0];
            const name = path.split(/[\\/]/).pop() || "scan";
            setPendingPreprocess({ filePath: path, name, side });
          } else if (paths.length > 1) {
            setPendingBatchImport({ filePaths: paths, files: [], side });
          }
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files || []);
        if (files.length === 1) {
          setPendingPreprocess({ file: files[0], name: files[0].name, side });
        } else if (files.length > 1) {
          setPendingBatchImport({ files, side });
        }
      };
      input.click();
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

      {/* Add Image Dropdown */}
      <div style={{ position: "relative" }}>
        <button
          className="cad-tool-btn"
          onClick={() => setShowImageMenu((v) => !v)}
          title="Добавить фото платы (Top / Bottom)"
          style={{ color: "#38bdf8" }}
        >
          <ImagePlus size={16} />
        </button>

        {showImageMenu && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "6px",
              background: "var(--cad-bg-panel)",
              border: "1px solid var(--cad-border)",
              borderRadius: "6px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              padding: "4px",
              minWidth: "160px",
              zIndex: 100,
            }}
          >
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                fontSize: "12px",
                color: "var(--cad-text-main)",
                borderRadius: "4px",
                textAlign: "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cad-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => {
                setShowImageMenu(false);
                handleAddImage("top");
              }}
            >
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--cad-top-layer)" }} />
              <span>Слой Top (Лицевой)...</span>
            </button>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                fontSize: "12px",
                color: "var(--cad-text-main)",
                borderRadius: "4px",
                textAlign: "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cad-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => {
                setShowImageMenu(false);
                handleAddImage("bottom");
              }}
            >
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--cad-bottom-layer)" }} />
              <span>Слой Bottom (Оборот)...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
