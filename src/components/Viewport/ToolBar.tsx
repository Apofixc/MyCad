import React, { useEffect } from "react";
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
  Maximize2,
  Cpu,
} from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { ToolMode } from "../../types/cad";

export const ToolBar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    activeWorkLayer,
    showGrid,
    toggleGrid,
    toggleLoupe,
    openModal,
    setPendingPreprocess,
    setPendingBatchImport,
    fitAllImages,
  } = useUiStore();

  const isUnderlay = activeWorkLayer?.type === "underlay";
  const isComponents = activeWorkLayer?.type === "components";
  const underlaySide = isUnderlay ? (activeWorkLayer.side || "top") : null;

  // Fallback to "select" tool if current tool is an image-only tool and underlay is not active
  useEffect(() => {
    const imageTools: ToolMode[] = [
      "transform",
      "calibrate",
      "level",
      "register",
      "curtain",
      "blink",
    ];
    if (!isUnderlay && imageTools.includes(activeTool)) {
      setActiveTool("select");
    }
  }, [isUnderlay, activeTool, setActiveTool]);


  const handleAddImage = async (side: "top" | "bottom") => {
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
      input.accept = "image/*,.png,.jpg,.jpeg,.tif,.tiff,.webp,.bmp";
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

  const imageTools: { id: ToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: "transform", label: "Трансформация скана", icon: <Move size={16} />, shortcut: "T" },
    { id: "calibrate", label: "Калибровка масштаба (мм)", icon: <Ruler size={16} />, shortcut: "C" },
    { id: "level", label: "Выравнивание горизонта", icon: <Compass size={16} />, shortcut: "L" },
    { id: "register", label: "Совмещение Top/Bottom", icon: <Layers size={16} />, shortcut: "R" },
    { id: "curtain", label: "Шторка просвета слоёв", icon: <SplitSquareVertical size={16} />, shortcut: "S" },
    { id: "blink", label: "Стробоскоп слоёв", icon: <Zap size={16} />, shortcut: "B" },
  ];

  const inspectTools: { id: ToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: "measure", label: "Линейка измерений", icon: <Ruler size={16} />, shortcut: "M" },
    { id: "magnifier", label: "Экранная лупа", icon: <Search size={16} />, shortcut: "Z" },
  ];

  return (
    <div className="cad-floating-toolbar">
      {/* Кнопка добавления изображения — отображается ТОЛЬКО если активен слой подложки */}
      {isUnderlay && underlaySide && (
        <>
          <button
            className="cad-tool-btn"
            onClick={() => handleAddImage(underlaySide)}
            title={`Добавить скан в активный слой: ${underlaySide === "top" ? "Top (Лицевой)" : "Bottom (Оборотный)"}`}
            style={{ color: "#60a5fa" }}
          >
            <ImagePlus size={16} />
          </button>
          <div className="cad-tool-sep" />
        </>
      )}

      {/* Кнопка базы компонентов — отображается ТОЛЬКО если активен слой компонентов */}
      {isComponents && (
        <>
          <button
            className="cad-tool-btn"
            onClick={() => openModal("componentLibrary")}
            title="Библиотека компонентов: добавить деталь на плату (R, C, микросхемы)"
            style={{ color: "#c084fc" }}
          >
            <Cpu size={16} />
          </button>
          <div className="cad-tool-sep" />
        </>
      )}

      {/* Основной инструмент выбора */}
      <button
        className={`cad-tool-btn ${activeTool === "select" ? "active" : ""}`}
        onClick={() => setActiveTool("select")}
        title="Выбор и инспекция (V)"
      >
        <MousePointer size={16} />
      </button>

      {/* Инструменты работы с изображениями — ТОЛЬКО когда активен слой подложки */}
      {isUnderlay && (
        <>
          {imageTools.map((t) => (
            <button
              key={t.id}
              className={`cad-tool-btn ${activeTool === t.id ? "active" : ""}`}
              onClick={() => setActiveTool(t.id)}
              title={`${t.label} (${t.shortcut})`}
            >
              {t.icon}
            </button>
          ))}
        </>
      )}

      <div className="cad-tool-sep" />

      {/* Общие инструменты инспекции */}
      {inspectTools.map((t) => (
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

      {/* Сетка */}
      <button
        className={`cad-tool-btn ${showGrid ? "active" : ""}`}
        onClick={toggleGrid}
        title="Координатная сетка платы (G)"
      >
        <Grid size={16} />
      </button>

      {/* Вписать все изображения */}
      <button
        className="cad-tool-btn"
        onClick={() => fitAllImages()}
        title="Вписать всю плату / все сканы (0)"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
};
