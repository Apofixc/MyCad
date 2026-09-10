// src/components/Modals/PackageEditorModal.tsx
// Полнофункциональный векторный CAD-редактор посадочных мест (Footprint Editor)
// Свободное черчение, D-образные контуры, генераторы массивов, точный инспектор свойств и варианты исполнения

import React, { useState, useEffect } from "react";
import {
  PackageDefinition,
  PackagePad,
  GraphicItem,
  PadShape,
  MountType,
  PackageVariant,
  PackageKeyType,
} from "../../types/componentLibrary";
import {
  InteractiveFootprintCanvas,
  EditorTool,
} from "../SvgRenderer/InteractiveFootprintCanvas";
import { PadArrayModal } from "./PadArrayModal";
import {
  centerPads,
  generateAutoSilkscreen,
} from "../../utils/footprintGenerator";
import {
  X,
  Save,
  MousePointer,
  Plus,
  Trash2,
  Ruler,
  Layers,
  Circle,
  Square,
  Slash,
  Grid,
  RotateCcw,
  Undo2,
  Redo2,
  Crosshair,
  Wand2,
  Box,
  Settings,
  Sparkles,
  Palette,
  Magnet,
} from "lucide-react";

interface PackageEditorModalProps {
  isOpen: boolean;
  initialPackage?: PackageDefinition | null;
  onClose: () => void;
  onSave: (pkg: PackageDefinition) => void;
}

export const PackageEditorModal: React.FC<PackageEditorModalProps> = ({
  isOpen,
  initialPackage,
  onClose,
  onSave,
}) => {
  // Основные метаданные
  const [id, setId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [standard, setStandard] = useState<string>("");
  const [mountType, setMountType] = useState<MountType>("smd");
  const [bodyWidth, setBodyWidth] = useState<number>(6.0);
  const [bodyHeight, setBodyHeight] = useState<number>(4.0);
  const [bodyShape, setBodyShape] = useState<string>("rect");
  const [dShapeCut, setDShapeCut] = useState<string>("right");
  const [pitch, setPitch] = useState<number>(1.27);

  // Списки геометрии
  const [pads, setPads] = useState<PackagePad[]>([]);
  const [graphics, setGraphics] = useState<GraphicItem[]>([]);
  const [variants, setVariants] = useState<PackageVariant[]>([]);
  const [defaultVariantId, setDefaultVariantId] = useState<string>("standard");

  // Состояние редактора
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [gridStep, setGridStep] = useState<number>(1.27); // мм
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [selectedPadNum, setSelectedPadNum] = useState<string | null>(null);
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"props" | "pads" | "variants">("props");

  // Модальные окна-помощники
  const [isArrayModalOpen, setIsArrayModalOpen] = useState(false);

  // Стек истории для Undo/Redo
  const [history, setHistory] = useState<{ pads: PackagePad[]; graphics: GraphicItem[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Шаблон для новой контактной площадки
  const [padTemplate, setPadTemplate] = useState<{
    shape: PadShape;
    width: number;
    height: number;
    drillDiameter?: number;
    roundRadius?: number;
  }>({
    shape: "rounded_rect",
    width: 1.6,
    height: 0.6,
    drillDiameter: 0,
    roundRadius: 0.1,
  });

  // Инициализация при открытии
  useEffect(() => {
    if (!isOpen) return;

    if (initialPackage) {
      setId(initialPackage.id);
      setName(initialPackage.name);
      setStandard(initialPackage.standard || "");
      setMountType(initialPackage.mountType || "smd");
      setBodyWidth(initialPackage.bodyWidth || 6.0);
      setBodyHeight(initialPackage.bodyHeight || 4.0);
      setBodyShape(initialPackage.bodyShape || "rect");
      setDShapeCut(initialPackage.dShapeCut || "right");
      setPitch(initialPackage.pitch || 1.27);
      setPads(initialPackage.pads || []);
      setGraphics(initialPackage.graphics || []);
      setVariants(
        initialPackage.variants?.length > 0
          ? initialPackage.variants
          : [
              {
                id: "standard",
                name: "Стандартный",
                bodyColor: "#1e293b",
                bodyBorderColor: "#475569",
                keyType: "none",
                graphics: [],
              },
            ]
      );
      setDefaultVariantId(initialPackage.defaultVariantId || "standard");
    } else {
      const newId = `pkg_custom_${Date.now()}`;
      setId(newId);
      setName("Новое посадочное место");
      setStandard("");
      setMountType("smd");
      setBodyWidth(6.0);
      setBodyHeight(4.0);
      setBodyShape("rect");
      setDShapeCut("right");
      setPitch(1.27);
      setPads([]);
      setGraphics([]);
      setVariants([
        {
          id: "standard",
          name: "Стандартный",
          bodyColor: "#1e293b",
          bodyBorderColor: "#475569",
          keyType: "none",
          graphics: [],
        },
      ]);
      setDefaultVariantId("standard");
    }

    setHistory([]);
    setHistoryIndex(-1);
    setSelectedPadNum(null);
    setSelectedGraphicId(null);
  }, [isOpen, initialPackage]);

  // Запись в историю изменений
  const pushHistory = (newPads: PackagePad[], newGraphics: GraphicItem[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({ pads: newPads, graphics: newGraphics });
    if (nextHistory.length > 30) nextHistory.shift();
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handlePadsChange = (newPads: PackagePad[]) => {
    pushHistory(pads, graphics);
    setPads(newPads);
  };

  const handleGraphicsChange = (newGraphics: GraphicItem[]) => {
    pushHistory(pads, graphics);
    setGraphics(newGraphics);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setPads(prev.pads);
      setGraphics(prev.graphics);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setPads(next.pads);
      setGraphics(next.graphics);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Сдвиг начала координат
  const handleShiftOrigin = (dx: number, dy: number) => {
    pushHistory(pads, graphics);
    const shiftedPads = pads.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
    const shiftedGraphics = graphics.map((g) => {
      if (g.kind === "line") {
        return { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy };
      }
      if (g.kind === "d_shape" || g.kind === "circle" || g.kind === "arc" || g.kind === "capsule") {
        return { ...g, cx: g.cx + dx, cy: g.cy + dy };
      }
      if (g.kind === "rect" || g.kind === "text") {
        return { ...g, x: g.x + dx, y: g.y + dy };
      }
      if (g.kind === "polygon") {
        return { ...g, points: g.points.map(([px, py]) => [px + dx, py + dy] as [number, number]) };
      }
      return g;
    });
    setPads(shiftedPads);
    setGraphics(shiftedGraphics);
  };

  // Центрировать все выводы в (0,0)
  const handleCenterAll = () => {
    if (pads.length === 0) return;
    pushHistory(pads, graphics);
    setPads(centerPads(pads));
  };

  // Автоматический контур шелкографии
  const handleAutoSilk = () => {
    if (pads.length === 0) return;
    pushHistory(pads, graphics);
    const autoItems = generateAutoSilkscreen(pads, 0.6, 0.15);
    setGraphics([...graphics, ...autoItems]);
  };

  // Применение сгенерированного массива площадок
  const handleApplyArrayPads = (newPads: PackagePad[]) => {
    pushHistory(pads, graphics);
    setPads([...pads, ...newPads]);
  };

  // Быстрое применение пресетов площадок
  const applyPadPreset = (preset: "0603" | "0805" | "soic" | "qfp" | "tht") => {
    switch (preset) {
      case "0603":
        setPadTemplate({ shape: "rect", width: 1.0, height: 0.8, drillDiameter: 0 });
        break;
      case "0805":
        setPadTemplate({ shape: "rounded_rect", width: 1.3, height: 1.2, drillDiameter: 0, roundRadius: 0.1 });
        break;
      case "soic":
        setPadTemplate({ shape: "rounded_rect", width: 1.6, height: 0.6, drillDiameter: 0, roundRadius: 0.1 });
        break;
      case "qfp":
        setPadTemplate({ shape: "rounded_rect", width: 1.5, height: 0.35, drillDiameter: 0, roundRadius: 0.05 });
        break;
      case "tht":
        setPadTemplate({ shape: "circle", width: 1.6, height: 1.6, drillDiameter: 0.8 });
        break;
    }
  };

  // Сохранение корпуса
  const handleSave = () => {
    if (!name.trim()) {
      alert("Укажите название посадочного места");
      return;
    }

    const pkgDef: PackageDefinition = {
      id: id || `pkg_${Date.now()}`,
      name: name.trim(),
      standard: standard.trim() || undefined,
      mountType,
      bodyWidth,
      bodyHeight,
      bodyShape,
      dShapeCut: bodyShape === "d_shape" ? dShapeCut : undefined,
      pitch,
      pads,
      graphics,
      constraints: {
        courtyardWidth: bodyWidth + 1.2,
        courtyardHeight: bodyHeight + 1.2,
        maxHeight: 3.0,
      },
      defaultVariantId,
      variants,
    };

    onSave(pkgDef);
    onClose();
  };

  if (!isOpen) return null;

  const selectedPad = pads.find((p) => p.padNum === selectedPadNum);
  const selectedGraphic = graphics.find((g) => g.id === selectedGraphicId);

  // Вычисление габаритов охватывающей рамки (Bounding Box)
  let bboxW = bodyWidth;
  let bboxH = bodyHeight;
  if (pads.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pads.forEach((p) => {
      minX = Math.min(minX, p.x - p.width / 2);
      maxX = Math.max(maxX, p.x + p.width / 2);
      minY = Math.min(minY, p.y - p.height / 2);
      maxY = Math.max(maxY, p.y + p.height / 2);
    });
    bboxW = Math.max(bboxW, maxX - minX);
    bboxH = Math.max(bboxH, maxY - minY);
  }

  return (
    <div className="cad-modal-backdrop" style={{ zIndex: 1050 }} onClick={onClose}>
      <div
        className="cad-modal-box modal-fullscreen"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* ============================================================ */}
        {/* ШАПКА РЕДАКТОРА КОРПУСОВ: ЧИСТАЯ, СТРОГАЯ, ИНЖЕНЕРНАЯ       */}
        {/* ============================================================ */}
        <div className="cad-modal-header" style={{ padding: "10px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="cad-modal-icon-badge" style={{ width: 34, height: 34, borderRadius: 8 }}>
              <Box size={18} color="var(--cad-accent-hover)" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SOIC-8, DIP-8, 0805..."
                className="cad-input"
                style={{
                  width: 250,
                  fontWeight: 700,
                  fontSize: 13,
                  background: "var(--cad-bg-deep)",
                  padding: "5px 10px",
                }}
              />
              <select
                value={mountType}
                onChange={(e) => setMountType(e.target.value as MountType)}
                className="cad-input"
                style={{ fontSize: 11, padding: "5px 8px" }}
              >
                <option value="smd">SMD (Поверхностный)</option>
                <option value="tht">THT (Выводной)</option>
                <option value="mixed">Смешанный</option>
              </select>
            </div>
            <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginLeft: 6 }}>
              Площадок: <strong style={{ color: "var(--cad-accent-hover)" }}>{pads.length}</strong> • Графика: <strong style={{ color: "var(--cad-text-muted)" }}>{graphics.length}</strong>
            </div>
          </div>

          {/* Кнопки действий справа */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="cad-btn-secondary btn-sm"
              onClick={() => setIsArrayModalOpen(true)}
              title="Параметрический генератор массивов площадок (DIP, QFP, BGA)"
              style={{ gap: 5 }}
            >
              <Layers size={13} />
              <span>Массив площадок</span>
            </button>
            <button
              className="cad-btn-primary btn-sm"
              onClick={handleSave}
              style={{ gap: 5 }}
            >
              <Save size={13} />
              <span>Сохранить корпус</span>
            </button>
            <button className="cad-modal-close-btn" onClick={onClose} title="Закрыть (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ВТОРАЯ ПАНЕЛЬ: СЕТКА, ПРИВЯЗКА, UNDO/REDO, БЫСТРЫЕ ДЕЙСТВИЯ */}
        {/* ============================================================ */}
        <div className="pkg-editor-subbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Селектор шага сетки */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                background: "var(--cad-bg-card)",
                padding: "2px 4px",
                borderRadius: 6,
                border: "1px solid var(--cad-border)",
              }}
            >
              <Grid size={13} color="var(--cad-text-dim)" style={{ margin: "0 4px" }} />
              <span style={{ fontSize: 10, color: "var(--cad-text-dim)", marginRight: 4 }}>Сетка:</span>
              {[0.1, 0.5, 1.27, 2.54].map((step) => (
                <button
                  key={step}
                  onClick={() => setGridStep(step)}
                  style={{
                    padding: "2px 6px",
                    fontSize: 10,
                    borderRadius: 4,
                    background: gridStep === step ? "var(--cad-bg-panel)" : "transparent",
                    color: gridStep === step ? "var(--cad-accent-hover)" : "var(--cad-text-muted)",
                    border: gridStep === step ? "1px solid var(--cad-accent)" : "1px solid transparent",
                    cursor: "pointer",
                    fontWeight: gridStep === step ? 700 : 400,
                  }}
                >
                  {step} мм
                </button>
              ))}
            </div>

            {/* Привязка к сетке (Magnet Snap) */}
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className="cad-btn-secondary btn-sm"
              style={{
                fontSize: 11,
                padding: "3px 8px",
                gap: 5,
                color: snapToGrid ? "var(--cad-accent-hover)" : "var(--cad-text-dim)",
                borderColor: snapToGrid ? "var(--cad-accent)" : "var(--cad-border)",
              }}
              title="Включить/отключить магнитную привязку курсора к координатной сетке"
            >
              <Magnet size={12} />
              <span>Привязка: {snapToGrid ? "ВКЛ" : "ВЫКЛ"}</span>
            </button>

            {/* Отмена и повтор */}
            <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="cad-modal-close-btn"
                title="Отменить (Ctrl+Z)"
                style={{ width: 28, height: 28, opacity: historyIndex <= 0 ? 0.35 : 1 }}
              >
                <Undo2 size={13} />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="cad-modal-close-btn"
                title="Повторить (Ctrl+Y)"
                style={{ width: 28, height: 28, opacity: historyIndex >= history.length - 1 ? 0.35 : 1 }}
              >
                <Redo2 size={13} />
              </button>
            </div>
          </div>

          {/* Быстрые действия по чертежу */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={handleAutoSilk}
              className="cad-btn-secondary btn-sm"
              title="Сгенерировать контур шелкографии вокруг выводов"
              style={{ fontSize: 11, gap: 5 }}
            >
              <Wand2 size={12} color="#38bdf8" />
              <span>Авто-шелкография</span>
            </button>
            <button
              onClick={handleCenterAll}
              className="cad-btn-secondary btn-sm"
              title="Центрировать все площадки относительно начала координат (0,0)"
              style={{ fontSize: 11, gap: 5 }}
            >
              <RotateCcw size={12} />
              <span>Центрировать (0,0)</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ОСНОВНОЕ ПРОСТРАНСТВО: TOOL PALETTE | CANVAS | INSPECTOR     */}
        {/* ============================================================ */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* ЛЕВАЯ ВЕРТИКАЛЬНАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ */}
          <div className="pkg-tool-palette">
            {[
              {
                id: "select",
                icon: <MousePointer size={16} />,
                label: "Выделение (V)",
              },
              {
                id: "pad",
                icon: (
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <rect x="2.5" y="2.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="9" cy="9" r="2.2" fill="currentColor" />
                  </svg>
                ),
                label: "Контактная площадка (P)",
              },
              {
                id: "line",
                icon: <Slash size={16} />,
                label: "Линия шелкографии (L)",
              },
              {
                id: "rect",
                icon: <Square size={16} />,
                label: "Прямоугольник (R)",
              },
              {
                id: "circle",
                icon: <Circle size={16} />,
                label: "Окружность (C)",
              },
              {
                id: "d_shape",
                icon: (
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M4 3h5a6 6 0 0 1 6 6 6 6 0 0 1-6 6H4V3z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                label: "D-образный контур (TO-92)",
              },
              {
                id: "capsule",
                icon: (
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <rect x="2.5" y="5" width="13" height="8" rx="4" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                ),
                label: "Капсула (HC-49)",
              },
              {
                id: "measure",
                icon: <Ruler size={16} />,
                label: "Линейка / Измерение (M)",
              },
              {
                id: "set_origin",
                icon: <Crosshair size={16} />,
                label: "Установить начало координат (0,0)",
              },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as EditorTool)}
                className={`pkg-tool-btn ${activeTool === tool.id ? "active" : ""}`}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            <button
              onClick={handleCenterAll}
              className="pkg-tool-btn"
              title="Центрировать все площадки (0,0)"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* ЦЕНТРАЛЬНЫЙ ВЕКТОРНЫЙ ХОЛСТ */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", background: "#060911" }}>
            <InteractiveFootprintCanvas
              pads={pads}
              graphics={graphics}
              variant={variants.find((v) => v.id === defaultVariantId)}
              gridStep={gridStep}
              snapToGrid={snapToGrid}
              activeTool={activeTool}
              selectedPadNum={selectedPadNum}
              selectedGraphicId={selectedGraphicId}
              newPadTemplate={padTemplate}
              onPadsChange={handlePadsChange}
              onGraphicsChange={handleGraphicsChange}
              onSelectPad={setSelectedPadNum}
              onSelectGraphic={setSelectedGraphicId}
              onShiftOrigin={handleShiftOrigin}
            />
          </div>

          {/* ПРАВАЯ ПАНЕЛЬ: ИНСПЕКТОР СВОЙСТВ И ТАБЛИЦА ПЛОЩАДОК */}
          <div className="pkg-inspector">
            {/* Вкладки инспектора */}
            <div className="pkg-inspector-tabs">
              <button
                onClick={() => setInspectorTab("props")}
                className={`pkg-inspector-tab ${inspectorTab === "props" ? "active" : ""}`}
              >
                <Settings size={13} />
                <span>Свойства</span>
              </button>
              <button
                onClick={() => setInspectorTab("pads")}
                className={`pkg-inspector-tab ${inspectorTab === "pads" ? "active" : ""}`}
              >
                <Layers size={13} />
                <span>Площадки ({pads.length})</span>
              </button>
              <button
                onClick={() => setInspectorTab("variants")}
                className={`pkg-inspector-tab ${inspectorTab === "variants" ? "active" : ""}`}
              >
                <Palette size={13} />
                <span>Стили ({variants.length})</span>
              </button>
            </div>

            {/* Содержимое вкладок */}
            <div className="pkg-inspector-content">
              {/* ============================================================ */}
              {/* ВКЛАДКА 1: СВОЙСТВА ОБЪЕКТА ИЛИ ОБЩАЯ ГЕОМЕТРИЯ КОРПУСА      */}
              {/* ============================================================ */}
              {inspectorTab === "props" && (
                <>
                  {selectedPad ? (
                    /* ИНСПЕКТОР ВЫДЕЛЕННОЙ ПЛОЩАДКИ */
                    <div className="pkg-card">
                      <div className="pkg-card-header">
                        <div className="pkg-card-title">
                          <Box size={13} />
                          <span>Площадка #{selectedPad.padNum}</span>
                        </div>
                        <button
                          className="cad-icon-btn danger"
                          onClick={() => {
                            handlePadsChange(pads.filter((p) => p.padNum !== selectedPad.padNum));
                            setSelectedPadNum(null);
                          }}
                          title="Удалить площадку"
                          style={{ width: 22, height: 22 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label className="form-label">Номер вывода:</label>
                          <input
                            type="text"
                            value={selectedPad.padNum}
                            onChange={(e) => {
                              const newNum = e.target.value;
                              handlePadsChange(
                                pads.map((p) =>
                                  p.padNum === selectedPad.padNum
                                    ? { ...p, padNum: newNum, name: newNum }
                                    : p
                                )
                              );
                              setSelectedPadNum(newNum);
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11, fontWeight: "bold" }}
                          />
                        </div>
                        <div>
                          <label className="form-label">Форма:</label>
                          <select
                            value={selectedPad.shape}
                            onChange={(e) => {
                              const newShape = e.target.value as PadShape;
                              handlePadsChange(
                                pads.map((p) =>
                                  p.padNum === selectedPad.padNum ? { ...p, shape: newShape } : p
                                )
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                          >
                            <option value="rounded_rect">Скруглённый прямоуг.</option>
                            <option value="rect">Прямоугольник</option>
                            <option value="circle">Круг</option>
                            <option value="oval">Овал</option>
                            <option value="d_shape">D-образная</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label className="form-label">Координата X (мм):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedPad.x}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handlePadsChange(
                                pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, x: val } : p))
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                          />
                        </div>
                        <div>
                          <label className="form-label">Координата Y (мм):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedPad.y}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handlePadsChange(
                                pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, y: val } : p))
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label className="form-label">Ширина W (мм):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedPad.width}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0.1;
                              handlePadsChange(
                                pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, width: val } : p))
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                          />
                        </div>
                        <div>
                          <label className="form-label">Высота H (мм):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedPad.height}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0.1;
                              handlePadsChange(
                                pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, height: val } : p))
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label className="form-label">Сверление Drill ⌀ (THT):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedPad.drillDiameter || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handlePadsChange(
                                pads.map((p) =>
                                  p.padNum === selectedPad.padNum
                                    ? { ...p, drillDiameter: val > 0 ? val : undefined, plated: val > 0 ? true : undefined }
                                    : p
                                )
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            placeholder="0 — SMD"
                          />
                        </div>
                        <div>
                          <label className="form-label">Поворот (°):</label>
                          <select
                            value={selectedPad.rotation || 0}
                            onChange={(e) => {
                              const rot = parseInt(e.target.value) || 0;
                              handlePadsChange(
                                pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, rotation: rot } : p))
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                          >
                            <option value="0">0°</option>
                            <option value="90">90°</option>
                            <option value="180">180°</option>
                            <option value="270">270°</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : selectedGraphic ? (
                    /* ИНСПЕКТОР ВЫДЕЛЕННОГО ГРАФИЧЕСКОГО ЭЛЕМЕНТА */
                    <div className="pkg-card">
                      <div className="pkg-card-header">
                        <div className="pkg-card-title">
                          <Slash size={13} />
                          <span>Элемент ({selectedGraphic.kind})</span>
                        </div>
                        <button
                          className="cad-icon-btn danger"
                          onClick={() => {
                            handleGraphicsChange(graphics.filter((g) => g.id !== selectedGraphic.id));
                            setSelectedGraphicId(null);
                          }}
                          title="Удалить фигуру"
                          style={{ width: 22, height: 22 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div>
                        <label className="form-label">Толщина линии (мм):</label>
                        <input
                          type="number"
                          step="0.05"
                          value={selectedGraphic.strokeWidth}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.1;
                            handleGraphicsChange(
                              graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, strokeWidth: val } : g))
                            );
                          }}
                          className="cad-input"
                          style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* ОБЩИЕ ПАРАМЕТРЫ КОРПУСА */
                    <>
                      {/* Карточка 1: Геометрия тела корпуса */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Box size={13} />
                            <span>Геометрия тела корпуса</span>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Форма корпуса:</label>
                            <select
                              value={bodyShape}
                              onChange={(e) => setBodyShape(e.target.value)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                            >
                              <option value="rect">Прямоугольный</option>
                              <option value="circle">Круглый</option>
                              <option value="d_shape">D-образный (TO-92)</option>
                              <option value="capsule">Капсула (HC-49)</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Стандарт (Design):</label>
                            <input
                              type="text"
                              value={standard}
                              onChange={(e) => setStandard(e.target.value)}
                              placeholder="напр. JEDEC, IPC-7351"
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                        </div>

                        {bodyShape === "d_shape" && (
                          <div>
                            <label className="form-label">Сторона среза D-формы:</label>
                            <select
                              value={dShapeCut}
                              onChange={(e) => setDShapeCut(e.target.value)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                            >
                              <option value="right">Срез справа</option>
                              <option value="top">Срез сверху</option>
                              <option value="bottom">Срез снизу</option>
                              <option value="left">Срез слева</option>
                            </select>
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">
                              {bodyShape === "circle" || bodyShape === "d_shape" ? "Диаметр ⌀ (мм):" : "Ширина W (мм):"}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={bodyWidth}
                              onChange={(e) => setBodyWidth(parseFloat(e.target.value) || 1.0)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label className="form-label">
                              {bodyShape === "circle" || bodyShape === "d_shape" ? "Высота (мм):" : "Высота H (мм):"}
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={bodyHeight}
                              onChange={(e) => setBodyHeight(parseFloat(e.target.value) || 1.0)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="form-label">Шаг выводов (Pitch, мм):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={pitch}
                            onChange={(e) => setPitch(parseFloat(e.target.value) || 0)}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            placeholder="1.27, 2.54, 0.8..."
                          />
                        </div>
                      </div>

                      {/* Карточка 2: Шаблон новой площадки (инструмент P) */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Sparkles size={13} />
                            <span>Шаблон новой площадки (при P)</span>
                          </div>
                        </div>

                        {/* Пресеты типовых площадок */}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            onClick={() => applyPadPreset("0603")}
                          >
                            0603
                          </button>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            onClick={() => applyPadPreset("0805")}
                          >
                            0805
                          </button>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            onClick={() => applyPadPreset("soic")}
                          >
                            SOIC (1.6×0.6)
                          </button>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            onClick={() => applyPadPreset("qfp")}
                          >
                            QFP (1.5×0.35)
                          </button>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            onClick={() => applyPadPreset("tht")}
                          >
                            THT ⌀1.6
                          </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Ширина:</label>
                            <input
                              type="number"
                              step="0.05"
                              value={padTemplate.width}
                              onChange={(e) =>
                                setPadTemplate({ ...padTemplate, width: parseFloat(e.target.value) || 0.1 })
                              }
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label className="form-label">Высота:</label>
                            <input
                              type="number"
                              step="0.05"
                              value={padTemplate.height}
                              onChange={(e) =>
                                setPadTemplate({ ...padTemplate, height: parseFloat(e.target.value) || 0.1 })
                              }
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Форма:</label>
                            <select
                              value={padTemplate.shape}
                              onChange={(e) =>
                                setPadTemplate({ ...padTemplate, shape: e.target.value as PadShape })
                              }
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                            >
                              <option value="rounded_rect">Скруглённый прямоуг.</option>
                              <option value="rect">Прямоугольник</option>
                              <option value="circle">Круг</option>
                              <option value="oval">Овал</option>
                              <option value="d_shape">D-образный</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Сверление ⌀ (THT):</label>
                            <input
                              type="number"
                              step="0.05"
                              value={padTemplate.drillDiameter || 0}
                              onChange={(e) =>
                                setPadTemplate({
                                  ...padTemplate,
                                  drillDiameter: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="0 — SMD"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Карточка 3: Геометрическая сводка посадочного места */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Ruler size={13} />
                            <span>Геометрия и габариты</span>
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: "var(--cad-text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Габариты охвата (BBox):</span>
                            <strong style={{ color: "var(--cad-text-main)" }}>{bboxW.toFixed(2)} × {bboxH.toFixed(2)} мм</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Контактных площадок:</span>
                            <strong style={{ color: "var(--cad-accent-hover)" }}>{pads.length} шт.</strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Графических линий:</span>
                            <strong style={{ color: "var(--cad-text-main)" }}>{graphics.length} шт.</strong>
                          </div>
                        </div>
                      </div>

                      {/* Карточка 4: Технологические зазоры и ограничения */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Settings size={13} />
                            <span>Технологические зазоры (Masks & DRC)</span>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Маска (Solder Mask):</label>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={0.05}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="0.05 мм"
                            />
                          </div>
                          <div>
                            <label className="form-label">Паста (Paste Mask):</label>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={0.00}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="0.00 мм"
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Зазор дворика (Courtyard):</label>
                            <input
                              type="number"
                              step="0.05"
                              defaultValue={0.25}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="0.25 мм"
                            />
                          </div>
                          <div>
                            <label className="form-label">Высота макс. (Z, мм):</label>
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={3.0}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="3.0 мм"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Карточка 5: Быстрые инженерные действия */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Wand2 size={13} />
                            <span>Быстрые действия</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button
                            type="button"
                            className="cad-btn-secondary btn-sm"
                            onClick={handleAutoSilk}
                            style={{ width: "100%", justifyContent: "flex-start", gap: 8, fontSize: 11 }}
                          >
                            <Wand2 size={13} color="var(--cad-accent-hover)" />
                            <span>Сгенерировать контур шелкографии</span>
                          </button>
                          <button
                            type="button"
                            className="cad-btn-secondary btn-sm"
                            onClick={handleCenterAll}
                            style={{ width: "100%", justifyContent: "flex-start", gap: 8, fontSize: 11 }}
                          >
                            <RotateCcw size={13} />
                            <span>Центрировать все выводы в (0,0)</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ============================================================ */}
              {/* ВКЛАДКА 2: СПИСОК ВСЕХ КОНТАКТНЫХ ПЛОЩАДОК (PADS TABLE)     */}
              {/* ============================================================ */}
              {inspectorTab === "pads" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                      Список площадок ({pads.length})
                    </span>
                    <button
                      className="cad-btn-secondary btn-sm"
                      style={{ fontSize: 10, padding: "2px 7px", height: 24, gap: 4 }}
                      onClick={() => {
                        const nextNum = String(pads.length + 1);
                        handlePadsChange([
                          ...pads,
                          {
                            padNum: nextNum,
                            name: nextNum,
                            x: 0,
                            y: 0,
                            width: padTemplate.width,
                            height: padTemplate.height,
                            rotation: 0,
                            shape: padTemplate.shape,
                            drillDiameter: padTemplate.drillDiameter,
                          },
                        ]);
                        setSelectedPadNum(nextNum);
                      }}
                    >
                      <Plus size={11} /> Добавить
                    </button>
                  </div>

                  <div className="device-table-container" style={{ flex: 1 }}>
                    <table className="device-table">
                      <thead>
                        <tr>
                          <th style={{ width: 34, textAlign: "center" }}>#</th>
                          <th>Координаты</th>
                          <th>Размер</th>
                          <th style={{ width: 28 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pads.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: "center", padding: "20px 10px", color: "#64748b" }}>
                              Площадки не созданы. Нажмите «+ Добавить» или воспользуйтесь «Массивом площадок».
                            </td>
                          </tr>
                        ) : (
                          pads.map((p) => (
                            <tr
                              key={p.padNum}
                              onClick={() => setSelectedPadNum(p.padNum)}
                              style={{
                                cursor: "pointer",
                                background: selectedPadNum === p.padNum ? "rgba(59, 130, 246, 0.15)" : undefined,
                              }}
                            >
                              <td style={{ textAlign: "center", fontWeight: "bold", color: "var(--cad-top-layer, #f59e0b)", fontFamily: "var(--cad-font-mono)" }}>
                                #{p.padNum}
                              </td>
                              <td style={{ fontSize: 11, fontFamily: "var(--cad-font-mono)", color: "var(--cad-text-main)" }}>
                                ({p.x.toFixed(2)}, {p.y.toFixed(2)})
                              </td>
                              <td style={{ fontSize: 10, color: "var(--cad-text-muted)" }}>
                                {p.width}×{p.height} {p.drillDiameter ? `⌀${p.drillDiameter}` : ""}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  className="cad-icon-btn danger"
                                  style={{ width: 20, height: 20, padding: 0 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePadsChange(pads.filter((item) => item.padNum !== p.padNum));
                                    if (selectedPadNum === p.padNum) setSelectedPadNum(null);
                                  }}
                                  title="Удалить площадку"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* ВКЛАДКА 3: ВАРИАНТЫ ОФОРМЛЕНИЯ КОРПУСА                      */}
              {/* ============================================================ */}
              {inspectorTab === "variants" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cad-text-muted)", textTransform: "uppercase" }}>
                      Стили оформления
                    </span>
                    <button
                      className="cad-btn-secondary btn-sm"
                      style={{ fontSize: 10, padding: "2px 7px", height: 24, gap: 4 }}
                      onClick={() => {
                        const newV: PackageVariant = {
                          id: `var_${Date.now()}`,
                          name: `Вариант ${variants.length + 1}`,
                          bodyColor: "var(--cad-bg-panel, #181d26)",
                          bodyBorderColor: "var(--cad-border, #283344)",
                          keyType: "notch",
                          graphics: [],
                        };
                        setVariants([...variants, newV]);
                      }}
                    >
                      <Plus size={11} /> Добавить стиль
                    </button>
                  </div>

                  {variants.map((v) => (
                    <div
                      key={v.id}
                      className="pkg-card"
                      style={{
                        borderColor: defaultVariantId === v.id ? "var(--cad-accent)" : "var(--cad-border)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants(variants.map((item) => (item.id === v.id ? { ...item, name: val } : item)));
                          }}
                          className="cad-input"
                          style={{ fontWeight: "bold", fontSize: 11, padding: "3px 6px" }}
                        />
                        <button
                          onClick={() => setDefaultVariantId(v.id)}
                          style={{
                            fontSize: 10,
                            padding: "2px 7px",
                            borderRadius: 4,
                            border: "none",
                            background: defaultVariantId === v.id ? "var(--cad-accent)" : "var(--cad-bg-surface)",
                            color: defaultVariantId === v.id ? "#ffffff" : "var(--cad-text-muted)",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {defaultVariantId === v.id ? "По умолчанию" : "Сделать осн."}
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label className="form-label">Цвет тела:</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="color"
                              value={v.bodyColor}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariants(variants.map((item) => (item.id === v.id ? { ...item, bodyColor: val } : item)));
                              }}
                              style={{ width: 26, height: 24, border: "none", cursor: "pointer", background: "none" }}
                            />
                            <span style={{ fontSize: 10, fontFamily: "var(--cad-font-mono)", color: "var(--cad-text-muted)" }}>
                              {v.bodyColor}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="form-label">Тип ключа:</label>
                          <select
                            value={v.keyType}
                            onChange={(e) => {
                              const val = e.target.value as PackageKeyType;
                              setVariants(variants.map((item) => (item.id === v.id ? { ...item, keyType: val } : item)));
                            }}
                            className="cad-input"
                            style={{ width: "100%", fontSize: 11, padding: "3px 6px" }}
                          >
                            <option value="none">Без ключа</option>
                            <option value="notch">Вырез (Notch)</option>
                            <option value="dot">Точка (Dot)</option>
                            <option value="chamfer">Скос (Chamfer)</option>
                            <option value="stripe">Полоса полярности</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно мастера массивов площадок */}
      <PadArrayModal
        isOpen={isArrayModalOpen}
        onClose={() => setIsArrayModalOpen(false)}
        onApplyPads={handleApplyArrayPads}
      />
    </div>
  );
};
