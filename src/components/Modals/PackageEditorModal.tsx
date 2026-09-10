// src/components/Modals/PackageEditorModal.tsx
// Полнофункциональный векторный CAD-редактор посадочных мест (Footprint Editor)
// Свободное векторное черчение, D-образные контуры, генераторы массивов, точный инспектор свойств и варианты исполнения

import React, { useState, useEffect, useRef } from "react";
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
  alignPads,
  generateAutoSilkscreen,
} from "../../utils/footprintGenerator";
import {
  X,
  Save,
  MousePointer,
  Plus,
  Minus,
  Trash2,
  Maximize2,
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
  const [bodyWidth, setBodyWidth] = useState<number>(5.0);
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
  const [gridStep, setGridStep] = useState<number>(0.5); // мм
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
      setBodyWidth(initialPackage.bodyWidth || 5.0);
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
      // Создание нового корпуса с чистого листа
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

    // Сброс истории
    setHistory([]);
    setHistoryIndex(-1);
    setSelectedPadNum(null);
    setSelectedGraphicId(null);
  }, [isOpen, initialPackage]);

  // Запись в историю
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

  // Центрировать в (0,0)
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

  return (
    <div className="cad-modal-overlay editor-overlay">
      <div
        className="cad-modal-container"
        style={{
          width: "98vw",
          height: "94vh",
          maxWidth: "1800px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ============================================================ */}
        {/* ВЕРХНЯЯ ПАНЕЛЬ CAD-РЕДАКТОРА (TOPBAR)                         */}
        {/* ============================================================ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 18px",
            background: "#0c1220",
            borderBottom: "1px solid #1e293b",
            gap: 12,
          }}
        >
          {/* Название и тип корпуса */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название корпуса (напр. SOIC-8, TO-92, D-SUB9)"
              className="cad-input"
              style={{ width: 280, fontWeight: "bold", fontSize: 13 }}
            />

            <select
              value={mountType}
              onChange={(e) => setMountType(e.target.value as MountType)}
              className="cad-input"
              style={{ width: 110, fontSize: 12 }}
            >
              <option value="smd">SMD (Поверхн.)</option>
              <option value="tht">THT (Выводной)</option>
              <option value="mixed">Смешанный</option>
            </select>
          </div>

          {/* Инструменты координатной сетки и CAD-привязок */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1e293b", padding: "2px 6px", borderRadius: 6 }}>
              <Grid size={14} color="#94a3b8" />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Сетка:</span>
              {[0.1, 0.5, 1.27, 2.54].map((step) => (
                <button
                  key={step}
                  onClick={() => setGridStep(step)}
                  className={`cad-btn-secondary ${gridStep === step ? "active-filter-tab" : ""}`}
                  style={{
                    padding: "3px 7px",
                    fontSize: 11,
                    background: gridStep === step ? "#2563eb" : "transparent",
                    color: gridStep === step ? "#ffffff" : "#94a3b8",
                    border: "none",
                  }}
                >
                  {step} мм
                </button>
              ))}
            </div>

            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`cad-btn-secondary ${snapToGrid ? "btn-active" : ""}`}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                color: snapToGrid ? "#38bdf8" : "#94a3b8",
                borderColor: snapToGrid ? "#0284c7" : "#334155",
              }}
            >
              Привязка: {snapToGrid ? "ВКЛ" : "ВЫКЛ"}
            </button>

            {/* Undo / Redo */}
            <div style={{ display: "flex", gap: 2, marginLeft: 6 }}>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="cad-icon-btn"
                title="Отменить (Ctrl+Z)"
                style={{ opacity: historyIndex <= 0 ? 0.4 : 1 }}
              >
                <Undo2 size={15} />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="cad-icon-btn"
                title="Повторить (Ctrl+Y)"
                style={{ opacity: historyIndex >= history.length - 1 ? 0.4 : 1 }}
              >
                <Redo2 size={15} />
              </button>
            </div>

            {/* Генератор массивов */}
            <button
              onClick={() => setIsArrayModalOpen(true)}
              className="cad-btn-secondary"
              style={{ fontSize: 12, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Layers size={14} />
              <span>Массив площадок</span>
            </button>

            {/* Авто-контур */}
            <button
              onClick={handleAutoSilk}
              className="cad-btn-secondary"
              title="Создать аккуратный контур шелкографии вокруг выводов"
              style={{ fontSize: 12, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Wand2 size={14} />
              <span>Авто-контур</span>
            </button>
          </div>

          {/* Кнопки сохранения и закрытия */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="cad-btn-secondary" onClick={onClose} style={{ fontSize: 12 }}>
              Отмена
            </button>
            <button
              className="cad-btn-primary"
              onClick={handleSave}
              style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Save size={14} />
              <span>Сохранить корпус</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ОСНОВНОЕ РАБОЧЕЕ ПРОСТРАНСТВО (TOOLS | CANVAS | INSPECTOR)   */}
        {/* ============================================================ */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* ЛЕВАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ ЧЕРЧЕНИЯ */}
          <div
            style={{
              width: 58,
              background: "#0c101d",
              borderRight: "1px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 0",
              gap: 6,
            }}
          >
            {[
              { id: "select", icon: <MousePointer size={18} />, label: "Выделение (V)" },
              { id: "pad", icon: <Plus size={18} />, label: "Контактная площадка (P)" },
              { id: "line", icon: <Slash size={18} />, label: "Линия шелкографии (L)" },
              { id: "rect", icon: <Square size={18} />, label: "Прямоугольник (R)" },
              { id: "circle", icon: <Circle size={18} />, label: "Окружность (C)" },
              { id: "d_shape", icon: <span style={{ fontWeight: "bold", fontSize: 14 }}>D</span>, label: "D-образный контур (TO-92)" },
              { id: "capsule", icon: <span style={{ fontWeight: "bold", fontSize: 11 }}>Caps</span>, label: "Капсула (HC-49)" },
              { id: "measure", icon: <Ruler size={18} />, label: "Линейка / Измерение (M)" },
              { id: "set_origin", icon: <Crosshair size={18} />, label: "Установить начало координат (0,0)" },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as EditorTool)}
                className={`cad-icon-btn ${activeTool === tool.id ? "active" : ""}`}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: activeTool === tool.id ? "#2563eb" : "transparent",
                  color: activeTool === tool.id ? "#ffffff" : "#94a3b8",
                  border: activeTool === tool.id ? "1px solid #60a5fa" : "1px solid transparent",
                }}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            {/* Быстрое центрирование в (0,0) */}
            <button
              onClick={handleCenterAll}
              className="cad-icon-btn"
              title="Центрировать все выводы в начало координат (0,0)"
              style={{ width: 42, height: 42 }}
            >
              <RotateCcw size={17} />
            </button>
          </div>

          {/* ЦЕНТРАЛЬНЫЙ ИНТЕРАКТИВНЫЙ ВЕКТОРНЫЙ ХОЛСТ */}
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
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

          {/* ПРАВАЯ ПАНЕЛЬ: ИНСПЕКТОР СВОЙСТВ И ТАБЛИЦА ВЫВОДОВ */}
          <div
            style={{
              width: 380,
              background: "#0d1322",
              borderLeft: "1px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* Переключатель вкладок инспектора */}
            <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
              {[
                { id: "props", label: "Свойства" },
                { id: "pads", label: `Площадки (${pads.length})` },
                { id: "variants", label: "Варианты" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id as any)}
                  style={{
                    flex: 1,
                    padding: "10px 4px",
                    fontSize: 12,
                    background: inspectorTab === tab.id ? "#1e293b" : "transparent",
                    color: inspectorTab === tab.id ? "#38bdf8" : "#94a3b8",
                    border: "none",
                    borderBottom: inspectorTab === tab.id ? "2px solid #38bdf8" : "none",
                    fontWeight: inspectorTab === tab.id ? "bold" : "normal",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* ВКЛАДКА 1: СВОЙСТВА ВЫБРАННОГО ОБЪЕКТА ИЛИ КОРПУСА */}
              {inspectorTab === "props" && (
                <>
                  {selectedPad ? (
                    /* Инспектор выделенной площадки */
                    <div className="form-section">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="section-title">Площадка #{selectedPad.padNum}</span>
                        <button
                          className="cad-icon-btn danger"
                          onClick={() => {
                            handlePadsChange(pads.filter((p) => p.padNum !== selectedPad.padNum));
                            setSelectedPadNum(null);
                          }}
                          title="Удалить площадку"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Номер вывода:</label>
                        <input
                          type="text"
                          value={selectedPad.padNum}
                          onChange={(e) => {
                            const newNum = e.target.value;
                            handlePadsChange(
                              pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, padNum: newNum, name: newNum } : p))
                            );
                            setSelectedPadNum(newNum);
                          }}
                          className="cad-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Форма площадки:</label>
                        <select
                          value={selectedPad.shape}
                          onChange={(e) => {
                            const newShape = e.target.value as PadShape;
                            handlePadsChange(
                              pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, shape: newShape } : p))
                            );
                          }}
                          className="cad-input"
                        >
                          <option value="rounded_rect">Скругленный прямоуг.</option>
                          <option value="rect">Прямоугольник</option>
                          <option value="circle">Круг</option>
                          <option value="oval">Овал</option>
                          <option value="d_shape">D-образная (срез справа)</option>
                        </select>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">Позиция X (мм):</label>
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
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Позиция Y (мм):</label>
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
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="form-group">
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
                          />
                        </div>
                        <div className="form-group">
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
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Диаметр сверления (THT, 0 = SMD):</label>
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
                        />
                      </div>
                    </div>
                  ) : selectedGraphic ? (
                    /* Инспектор векторного элемента */
                    <div className="form-section">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="section-title">Векторный элемент ({selectedGraphic.kind})</span>
                        <button
                          className="cad-icon-btn danger"
                          onClick={() => {
                            handleGraphicsChange(graphics.filter((g) => g.id !== selectedGraphic.id));
                            setSelectedGraphicId(null);
                          }}
                          title="Удалить фигуру"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="form-group">
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
                        />
                      </div>
                    </div>
                  ) : (
                    /* Общие свойства корпуса */
                    <div className="form-section">
                      <span className="section-title">Геометрия тела корпуса</span>
                      <div className="form-group">
                        <label className="form-label">Форма корпуса:</label>
                        <select
                          value={bodyShape}
                          onChange={(e) => setBodyShape(e.target.value)}
                          className="cad-input"
                        >
                          <option value="rect">Прямоугольный</option>
                          <option value="circle">Круглый</option>
                          <option value="d_shape">D-образный (TO-92, LED)</option>
                          <option value="capsule">Капсула (HC-49)</option>
                        </select>
                      </div>

                      {bodyShape === "d_shape" && (
                        <div className="form-group">
                          <label className="form-label">Сторона среза D-формы:</label>
                          <select
                            value={dShapeCut}
                            onChange={(e) => setDShapeCut(e.target.value)}
                            className="cad-input"
                          >
                            <option value="right">Срез справа</option>
                            <option value="top">Срез сверху</option>
                            <option value="bottom">Срез снизу</option>
                            <option value="left">Срез слева</option>
                          </select>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label">{bodyShape === "circle" || bodyShape === "d_shape" ? "Диаметр ⌀ (мм):" : "Ширина W (мм):"}</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bodyWidth}
                            onChange={(e) => setBodyWidth(parseFloat(e.target.value) || 1.0)}
                            className="cad-input"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{bodyShape === "circle" || bodyShape === "d_shape" ? "Высота (мм):" : "Высота H (мм):"}</label>
                          <input
                            type="number"
                            step="0.1"
                            value={bodyHeight}
                            onChange={(e) => setBodyHeight(parseFloat(e.target.value) || 1.0)}
                            className="cad-input"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Шаг выводов (Pitch, мм):</label>
                        <input
                          type="number"
                          step="0.05"
                          value={pitch}
                          onChange={(e) => setPitch(parseFloat(e.target.value) || 0)}
                          className="cad-input"
                        />
                      </div>
                    </div>
                  )}

                  {/* Шаблон для вставки новых площадок */}
                  <div className="form-section">
                    <span className="section-title">Шаблон новой площадки (при P)</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div className="form-group">
                        <label className="form-label">Ширина:</label>
                        <input
                          type="number"
                          step="0.05"
                          value={padTemplate.width}
                          onChange={(e) =>
                            setPadTemplate({ ...padTemplate, width: parseFloat(e.target.value) || 0.1 })
                          }
                          className="cad-input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Высота:</label>
                        <input
                          type="number"
                          step="0.05"
                          value={padTemplate.height}
                          onChange={(e) =>
                            setPadTemplate({ ...padTemplate, height: parseFloat(e.target.value) || 0.1 })
                          }
                          className="cad-input"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Форма:</label>
                      <select
                        value={padTemplate.shape}
                        onChange={(e) =>
                          setPadTemplate({ ...padTemplate, shape: e.target.value as PadShape })
                        }
                        className="cad-input"
                      >
                        <option value="rounded_rect">Скругленный прямоуг.</option>
                        <option value="rect">Прямоугольник</option>
                        <option value="circle">Круг</option>
                        <option value="oval">Овал</option>
                        <option value="d_shape">D-образный</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* ВКЛАДКА 2: СПИСОК ВСЕХ ПЛОЩАДОК */}
              {inspectorTab === "pads" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: "bold", color: "#cbd5e1" }}>
                      Всего площадок: {pads.length} шт.
                    </span>
                    <button
                      className="cad-btn-secondary"
                      style={{ fontSize: 11, padding: "3px 8px" }}
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
                      <Plus size={12} /> Добавить
                    </button>
                  </div>

                  <div style={{ maxHeight: "calc(94vh - 220px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {pads.map((p) => (
                      <div
                        key={p.padNum}
                        onClick={() => setSelectedPadNum(p.padNum)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: selectedPadNum === p.padNum ? "#1e293b" : "#0c101d",
                          border: selectedPadNum === p.padNum ? "1px solid #38bdf8" : "1px solid #1e293b",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: "bold", color: "#f59e0b", minWidth: 24 }}>
                            #{p.padNum}
                          </span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            ({p.x.toFixed(2)}, {p.y.toFixed(2)})
                          </span>
                          <span style={{ fontSize: 10, color: "#64748b" }}>
                            {p.width}×{p.height}
                          </span>
                        </div>
                        <button
                          className="cad-icon-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePadsChange(pads.filter((item) => item.padNum !== p.padNum));
                            if (selectedPadNum === p.padNum) setSelectedPadNum(null);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ВКЛАДКА 3: ВАРИАНТЫ ОФОРМЛЕНИЯ И КЛЮЧИ */}
              {inspectorTab === "variants" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="section-title">Стили оформления корпуса</span>
                    <button
                      className="cad-btn-secondary"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      onClick={() => {
                        const newV: PackageVariant = {
                          id: `var_${Date.now()}`,
                          name: `Вариант ${variants.length + 1}`,
                          bodyColor: "#1e293b",
                          bodyBorderColor: "#475569",
                          keyType: "notch",
                          graphics: [],
                        };
                        setVariants([...variants, newV]);
                      }}
                    >
                      <Plus size={12} /> Добавить стиль
                    </button>
                  </div>

                  {variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        padding: 10,
                        background: defaultVariantId === v.id ? "#0f172a" : "#0a0e18",
                        border: defaultVariantId === v.id ? "1px solid #38bdf8" : "1px solid #1e293b",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
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
                          style={{ fontWeight: "bold", fontSize: 12 }}
                        />
                        <button
                          onClick={() => setDefaultVariantId(v.id)}
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "none",
                            background: defaultVariantId === v.id ? "#2563eb" : "#1e293b",
                            color: "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          {defaultVariantId === v.id ? "Основной" : "Сделать осн."}
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <label style={{ fontSize: 11, color: "#94a3b8" }}>Цвет тела:</label>
                        <input
                          type="color"
                          value={v.bodyColor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants(variants.map((item) => (item.id === v.id ? { ...item, bodyColor: val } : item)));
                          }}
                          style={{ width: 28, height: 24, border: "none", cursor: "pointer", background: "none" }}
                        />

                        <label style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Ключ:</label>
                        <select
                          value={v.keyType}
                          onChange={(e) => {
                            const val = e.target.value as PackageKeyType;
                            setVariants(variants.map((item) => (item.id === v.id ? { ...item, keyType: val } : item)));
                          }}
                          className="cad-input"
                          style={{ fontSize: 11, padding: "2px 6px" }}
                        >
                          <option value="none">Без ключа</option>
                          <option value="notch">Вырез (Notch)</option>
                          <option value="dot">Точка (Dot)</option>
                          <option value="chamfer">Скос (Chamfer)</option>
                          <option value="stripe">Полоса полярности</option>
                        </select>
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
