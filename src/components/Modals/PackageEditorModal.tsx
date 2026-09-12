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
  RotateCw,
  Repeat,
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

  // Технологические ограничения и маски
  const [solderMaskMargin, setSolderMaskMargin] = useState<number>(0.05);
  const [pasteMaskMargin, setPasteMaskMargin] = useState<number>(0.0);
  const [courtyardMargin, setCourtyardMargin] = useState<number>(0.25);
  const [maxHeight, setMaxHeight] = useState<number>(3.0);
  const [hasThermalPad, setHasThermalPad] = useState<boolean>(false);
  const [thermalPadNum, setThermalPadNum] = useState<string>("EP");

  // 3D Модель
  const [model3dPath, setModel3dPath] = useState<string>("");
  const [model3dOffsetZ, setModel3dOffsetZ] = useState<number>(0);

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

      // Ограничения
      setSolderMaskMargin(initialPackage.constraints?.solderMaskMargin ?? 0.05);
      setPasteMaskMargin(initialPackage.constraints?.pasteMaskMargin ?? 0.0);
      setCourtyardMargin(
        initialPackage.constraints?.courtyardWidth && initialPackage.bodyWidth
          ? Math.max(0.1, Math.round(((initialPackage.constraints.courtyardWidth - initialPackage.bodyWidth) / 2) * 100) / 100)
          : 0.25
      );
      setMaxHeight(initialPackage.constraints?.maxHeight ?? 3.0);
      setHasThermalPad(initialPackage.constraints?.hasThermalPad ?? false);
      setThermalPadNum(initialPackage.constraints?.thermalPadNum ?? "EP");

      // 3D
      setModel3dPath(initialPackage.model3d?.filePath ?? "");
      setModel3dOffsetZ(initialPackage.model3d?.offset ? initialPackage.model3d.offset[2] : 0);
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

      setSolderMaskMargin(0.05);
      setPasteMaskMargin(0.0);
      setCourtyardMargin(0.25);
      setMaxHeight(3.0);
      setHasThermalPad(false);
      setThermalPadNum("EP");
      setModel3dPath("");
      setModel3dOffsetZ(0);
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
  const applyPadPreset = (preset: "0402" | "0603" | "0805" | "1206" | "soic" | "qfp" | "tht") => {
    switch (preset) {
      case "0402":
        setPadTemplate({ shape: "rect", width: 0.6, height: 0.5, drillDiameter: 0 });
        break;
      case "0603":
        setPadTemplate({ shape: "rect", width: 1.0, height: 0.8, drillDiameter: 0 });
        break;
      case "0805":
        setPadTemplate({ shape: "rounded_rect", width: 1.3, height: 1.2, drillDiameter: 0, roundRadius: 0.1 });
        break;
      case "1206":
        setPadTemplate({ shape: "rounded_rect", width: 1.6, height: 1.6, drillDiameter: 0, roundRadius: 0.15 });
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

  // Поворот шаблона площадки (меняет W и H местами)
  const handleRotatePadTemplate = () => {
    setPadTemplate((prev) => ({
      ...prev,
      width: prev.height,
      height: prev.width,
    }));
  };

  // Автоматический пересчет габаритов охватывающей рамки (Bounding Box)
  const handleRecalculateBBox = () => {
    if (pads.length === 0 && graphics.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    pads.forEach((p) => {
      const halfW = (p.width || 1) / 2;
      const halfH = (p.height || 1) / 2;
      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - halfH);
      maxY = Math.max(maxY, p.y + halfH);
    });

    graphics.forEach((g) => {
      if (g.kind === "line") {
        minX = Math.min(minX, g.x1, g.x2);
        maxX = Math.max(maxX, g.x1, g.x2);
        minY = Math.min(minY, g.y1, g.y2);
        maxY = Math.max(maxY, g.y1, g.y2);
      } else if (g.kind === "rect") {
        minX = Math.min(minX, g.x - g.width / 2);
        maxX = Math.max(maxX, g.x + g.width / 2);
        minY = Math.min(minY, g.y - g.height / 2);
        maxY = Math.max(maxY, g.y + g.height / 2);
      } else if (g.kind === "circle") {
        minX = Math.min(minX, g.cx - g.radius);
        maxX = Math.max(maxX, g.cx + g.radius);
        minY = Math.min(minY, g.cy - g.radius);
        maxY = Math.max(maxY, g.cy + g.radius);
      }
    });

    if (minX !== Infinity) {
      const w = Math.round((maxX - minX) * 100) / 100;
      const h = Math.round((maxY - minY) * 100) / 100;
      setBodyWidth(Math.max(0.5, w));
      setBodyHeight(Math.max(0.5, h));
    }

    // Автоматический расчет шага выводов (pitch) по соседним площадкам
    if (pads.length >= 2) {
      let minPitch = Infinity;
      for (let i = 0; i < pads.length; i++) {
        for (let j = i + 1; j < pads.length; j++) {
          const d = Math.hypot(pads[i].x - pads[j].x, pads[i].y - pads[j].y);
          if (d > 0.05 && d < minPitch) {
            minPitch = d;
          }
        }
      }
      if (minPitch !== Infinity && minPitch < 50) {
        setPitch(Math.round(minPitch * 100) / 100);
      }
    }
  };

  // Авто-генерация шелкографического контура вокруг площадок
  const handleGenerateOutline = () => {
    if (pads.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pads.forEach((p) => {
      const halfW = (p.width || 1) / 2;
      const halfH = (p.height || 1) / 2;
      minX = Math.min(minX, p.x - halfW);
      maxX = Math.max(maxX, p.x + halfW);
      minY = Math.min(minY, p.y - halfH);
      maxY = Math.max(maxY, p.y + halfH);
    });

    const margin = 0.5; // 0.5 мм отступ шелкографии
    const w = Math.round((maxX - minX + margin * 2) * 100) / 100;
    const h = Math.round((maxY - minY + margin * 2) * 100) / 100;
    const cx = Math.round(((minX + maxX) / 2) * 100) / 100;
    const cy = Math.round(((minY + maxY) / 2) * 100) / 100;

    const newOutline: GraphicItem = {
      kind: "rect",
      id: `silk_outline_${Date.now()}`,
      x: cx,
      y: cy,
      width: w,
      height: h,
      roundRadius: 0.2,
      rotation: 0,
      strokeWidth: 0.15,
      layer: "top_silk",
      filled: false,
    };

    const pin1 = pads.find((p) => String(p.padNum) === "1") || pads[0];
    const dotGraphic: GraphicItem = {
      kind: "circle",
      id: `silk_pin1_${Date.now()}`,
      cx: pin1 ? pin1.x : cx - w / 2 + 0.5,
      cy: pin1 ? pin1.y - (pin1.height / 2 + 0.5) : cy - h / 2 + 0.5,
      radius: 0.25,
      strokeWidth: 0.1,
      layer: "top_silk",
      filled: true,
    };

    handleGraphicsChange([...graphics, newOutline, dotGraphic]);
    setBodyWidth(w);
    setBodyHeight(h);

    // Автоматический расчет шага выводов
    if (pads.length >= 2) {
      let minPitch = Infinity;
      for (let i = 0; i < pads.length; i++) {
        for (let j = i + 1; j < pads.length; j++) {
          const d = Math.hypot(pads[i].x - pads[j].x, pads[i].y - pads[j].y);
          if (d > 0.05 && d < minPitch) {
            minPitch = d;
          }
        }
      }
      if (minPitch !== Infinity && minPitch < 50) {
        setPitch(Math.round(minPitch * 100) / 100);
      }
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
        courtyardWidth: Math.round((bodyWidth + courtyardMargin * 2) * 100) / 100,
        courtyardHeight: Math.round((bodyHeight + courtyardMargin * 2) * 100) / 100,
        maxHeight,
        solderMaskMargin,
        pasteMaskMargin,
        hasThermalPad: hasThermalPad || undefined,
        thermalPadNum: hasThermalPad ? thermalPadNum : undefined,
      },
      defaultVariantId,
      variants,
      model3d: model3dPath.trim()
        ? {
            filePath: model3dPath.trim(),
            offset: [0, 0, model3dOffsetZ],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          }
        : undefined,
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

          {/* ЦЕНТРАЛЬНЫЙ ВЕКТОРНЫЙ ХОЛСТ С КОНТЕКСТНОЙ ПАНЕЛЬЮ ИНСТРУМЕНТА */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative", background: "#060911" }}>
            {/* Контекстная панель инструмента Площадка (P) */}
            {activeTool === "pad" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 12px",
                  background: "#0c1322",
                  borderBottom: "1px solid #1e293b",
                  fontSize: 11,
                  flexWrap: "wrap",
                  zIndex: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#38bdf8", fontWeight: "bold" }}>
                  <Sparkles size={13} />
                  <span>Площадка (P):</span>
                </div>

                {/* Быстрые пресеты */}
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: "var(--cad-text-muted)", fontSize: 10 }}>Пресеты:</span>
                  {(["0402", "0603", "0805", "1206", "soic", "qfp", "tht"] as const).map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      className="pkg-preset-btn"
                      style={{ padding: "2px 6px", fontSize: 10 }}
                      onClick={() => applyPadPreset(pr)}
                    >
                      {pr.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div style={{ width: 1, height: 16, background: "#1e293b" }} />

                {/* Форма площадки */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--cad-text-muted)" }}>Форма:</span>
                  <select
                    value={padTemplate.shape}
                    onChange={(e) => setPadTemplate({ ...padTemplate, shape: e.target.value as PadShape })}
                    className="cad-input"
                    style={{ padding: "2px 6px", fontSize: 11 }}
                  >
                    <option value="rounded_rect">Скруглённый</option>
                    <option value="rect">Прямоугольник</option>
                    <option value="circle">Круг</option>
                    <option value="oval">Овал</option>
                    <option value="d_shape">D-образный</option>
                  </select>
                </div>

                {/* Размеры W x H */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--cad-text-muted)" }}>W:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={padTemplate.width}
                    onChange={(e) => setPadTemplate({ ...padTemplate, width: parseFloat(e.target.value) || 0.1 })}
                    className="cad-input"
                    style={{ width: 50, padding: "2px 4px", fontSize: 11 }}
                  />
                  <span style={{ color: "var(--cad-text-muted)" }}>× H:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={padTemplate.height}
                    onChange={(e) => setPadTemplate({ ...padTemplate, height: parseFloat(e.target.value) || 0.1 })}
                    className="cad-input"
                    style={{ width: 50, padding: "2px 4px", fontSize: 11 }}
                  />
                  <button
                    type="button"
                    className="pkg-preset-btn"
                    style={{ padding: "2px 6px", display: "flex", alignItems: "center", gap: 3 }}
                    onClick={handleRotatePadTemplate}
                    title="Поменять W ⇄ H местами (или нажмите Space)"
                  >
                    <Repeat size={11} />
                    <span>W ⇄ H (Space)</span>
                  </button>
                </div>

                {/* Сверление drill */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--cad-text-muted)" }}>Сверление ⌀:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={padTemplate.drillDiameter || 0}
                    onChange={(e) => setPadTemplate({ ...padTemplate, drillDiameter: parseFloat(e.target.value) || 0 })}
                    className="cad-input"
                    style={{ width: 48, padding: "2px 4px", fontSize: 11 }}
                    placeholder="0=SMD"
                  />
                </div>

                <div style={{ flex: 1 }} />
                <span style={{ color: "#64748b", fontSize: 10 }}>Пробел (Space) — поворот на 90°</span>
              </div>
            )}

            {/* Контекстная подсказка для линии (L) */}
            {activeTool === "line" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 12px",
                  background: "#0c1322",
                  borderBottom: "1px solid #1e293b",
                  fontSize: 11,
                  zIndex: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#38bdf8", fontWeight: "bold" }}>
                  <Slash size={13} />
                  <span>Линия / Полилиния (L):</span>
                </div>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>
                  Кликайте для создания цепочки отрезков контура. Повторный клик в ту же точку, <b>двойной клик</b> или <b>Esc</b> — завершить цепочку.
                </span>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
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
                onSetActiveTool={setActiveTool}
                onRotatePadTemplate={handleRotatePadTemplate}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onDeleteSelected={() => {
                  if (selectedPadNum) {
                    handlePadsChange(pads.filter((p) => p.padNum !== selectedPadNum));
                    setSelectedPadNum(null);
                  } else if (selectedGraphicId) {
                    handleGraphicsChange(graphics.filter((g) => g.id !== selectedGraphicId));
                    setSelectedGraphicId(null);
                  }
                }}
              />
            </div>
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

                      {/* Быстрая смена ориентации и поворот */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="pkg-preset-btn"
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "4px 8px" }}
                          onClick={() => {
                            handlePadsChange(
                              pads.map((p) =>
                                p.padNum === selectedPad.padNum
                                  ? { ...p, width: p.height, height: p.width }
                                  : p
                              )
                            );
                          }}
                          title="Поменять ширину и высоту местами"
                        >
                          <Repeat size={11} />
                          <span>W ⇄ H</span>
                        </button>
                        <button
                          type="button"
                          className="pkg-preset-btn"
                          style={{ flex: 1.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "4px 8px" }}
                          onClick={() => {
                            const cur = selectedPad.rotation || 0;
                            handlePadsChange(
                              pads.map((p) =>
                                p.padNum === selectedPad.padNum
                                  ? { ...p, rotation: (cur + 90) % 360 }
                                  : p
                              )
                            );
                          }}
                          title="Повернуть на +90° (клавиша Space на холсте)"
                        >
                          <RotateCw size={11} />
                          <span>+90° (Space)</span>
                        </button>
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
                                    ? { ...p, drillDiameter: val > 0 ? val : undefined, plated: val > 0 ? (p.plated ?? true) : undefined }
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
                          <div style={{ display: "flex", gap: 4 }}>
                            <input
                              type="number"
                              step="15"
                              value={selectedPad.rotation || 0}
                              onChange={(e) => {
                                const rot = parseFloat(e.target.value) || 0;
                                handlePadsChange(
                                  pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, rotation: rot } : p))
                                );
                              }}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                            />
                            <button
                              type="button"
                              className="pkg-preset-btn"
                              style={{ padding: "0 6px" }}
                              onClick={() => {
                                const rot = ((selectedPad.rotation || 0) + 90) % 360;
                                handlePadsChange(
                                  pads.map((p) => (p.padNum === selectedPad.padNum ? { ...p, rotation: rot } : p))
                                );
                              }}
                              title="+90°"
                            >
                              ⟳
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Опция неметаллизированного отверстия (NPTH) */}
                      {Boolean(selectedPad.drillDiameter && selectedPad.drillDiameter > 0) && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", color: "var(--cad-text-secondary)", marginTop: 2 }}>
                          <input
                            type="checkbox"
                            checked={selectedPad.plated === false}
                            onChange={(e) => {
                              const isNpth = e.target.checked;
                              handlePadsChange(
                                pads.map((p) =>
                                  p.padNum === selectedPad.padNum
                                    ? { ...p, plated: isNpth ? false : true }
                                    : p
                                )
                              );
                            }}
                          />
                          <span>Крепёжное отверстие (NPTH / без металлизации)</span>
                        </label>
                      )}
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
                          title="Удалить фигуру (Delete)"
                          style={{ width: 22, height: 22 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label className="form-label">Слой:</label>
                          <select
                            value={selectedGraphic.layer}
                            onChange={(e) => {
                              const lyr = e.target.value as any;
                              handleGraphicsChange(
                                graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, layer: lyr } : g))
                              );
                            }}
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                          >
                            <option value="top_silk">Шелкография (Silk)</option>
                            <option value="top_fab">Сборочный (Fab)</option>
                            <option value="top_courtyard">Дворик (Courtyard)</option>
                            <option value="bottom_silk">Шелкография низ</option>
                          </select>
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

                      {/* Специфические параметры для каждого типа графики */}
                      {selectedGraphic.kind === "line" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">X1 (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.x1}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, x1: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div>
                              <label className="form-label">Y1 (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.y1}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, y1: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">X2 (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.x2}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, x2: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div>
                              <label className="form-label">Y2 (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.y2}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, y2: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedGraphic.kind === "rect" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">Центр X (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.x}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, x: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div>
                              <label className="form-label">Центр Y (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.y}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, y: val } : g))
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
                                step="0.1"
                                value={selectedGraphic.width}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.1;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, width: val } : g))
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
                                step="0.1"
                                value={selectedGraphic.height}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.1;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, height: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={!!selectedGraphic.filled}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, filled: val } : g))
                                  );
                                }}
                              />
                              <span>Заливка фигуры</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {selectedGraphic.kind === "circle" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">Центр X (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.cx}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, cx: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div>
                              <label className="form-label">Центр Y (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.cy}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, cy: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">Радиус R (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.radius}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.1;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, radius: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", paddingTop: 16 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={!!selectedGraphic.filled}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    handleGraphicsChange(
                                      graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, filled: val } : g))
                                    );
                                  }}
                                />
                                <span>Заливка круга</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedGraphic.kind === "d_shape" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">Центр X (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.cx}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, cx: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div>
                              <label className="form-label">Центр Y (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.cy}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, cy: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label className="form-label">Диаметр ⌀ (мм):</label>
                              <input
                                type="number"
                                step="0.1"
                                value={selectedGraphic.diameter}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1.0;
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, diameter: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              />
                            </div>
                            <div>
                              <label className="form-label">Ориентация среза:</label>
                              <select
                                value={selectedGraphic.cutOrientation}
                                onChange={(e) => {
                                  const val = e.target.value as "top" | "bottom" | "left" | "right";
                                  handleGraphicsChange(
                                    graphics.map((g) => (g.id === selectedGraphic.id ? { ...g, cutOrientation: val } : g))
                                  );
                                }}
                                className="cad-input"
                                style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                              >
                                <option value="right">Справа</option>
                                <option value="top">Сверху</option>
                                <option value="bottom">Снизу</option>
                                <option value="left">Слева</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ОБЩИЕ ПАРАМЕТРЫ КОРПУСА */
                    <>
                      {/* Карточка 1: Габариты и свойства посадочного места */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Box size={13} />
                            <span>Габариты и свойства корпуса</span>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Стандарт (Design):</label>
                            <input
                              type="text"
                              value={standard}
                              onChange={(e) => setStandard(e.target.value)}
                              placeholder="напр. IPC-7351, Custom..."
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label className="form-label">Тип монтажа:</label>
                            <select
                              value={mountType}
                              onChange={(e) => setMountType(e.target.value as MountType)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                            >
                              <option value="smd">SMD (Поверхностный)</option>
                              <option value="tht">THT (Сквозной)</option>
                              <option value="mixed">Смешанный (Mixed)</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label className="form-label">Ширина W (BBox, мм):</label>
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
                            <label className="form-label">Высота H (BBox, мм):</label>
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

                        {/* Быстрые действия с габаритами */}
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px" }}
                            onClick={handleRecalculateBBox}
                            title="Рассчитать охватывающие габариты по площадкам и нарисованным линиям"
                          >
                            <RotateCw size={12} />
                            <span>Авто-габариты</span>
                          </button>
                          <button
                            type="button"
                            className="pkg-preset-btn"
                            style={{ flex: 1.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px" }}
                            onClick={handleGenerateOutline}
                            title="Сгенерировать шелкографию (контур + метка 1-го вывода) вокруг площадок с отступом 0.5 мм"
                          >
                            <Sparkles size={12} />
                            <span>⚡ Создать контур</span>
                          </button>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, padding: "5px 8px", background: "rgba(15, 23, 42, 0.4)", borderRadius: 4, border: "1px solid #1e293b" }}>
                          <span style={{ fontSize: 11, color: "var(--cad-text-muted)" }}>Шаг выводов (каталог):</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number"
                              step="0.05"
                              value={pitch || ""}
                              onChange={(e) => setPitch(parseFloat(e.target.value) || 0)}
                              className="cad-input"
                              style={{ width: 64, padding: "2px 6px", fontSize: 11, textAlign: "right" }}
                              placeholder="Авто"
                              title="Паспортный шаг выводов для каталога (рассчитывается автоматически по соседним выводам)"
                            />
                            <span style={{ fontSize: 11, color: "var(--cad-text-secondary)" }}>мм</span>
                          </div>
                        </div>
                      </div>

                      {/* Карточка 2: Геометрическая сводка посадочного места */}
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
                            <strong style={{ color: "var(--cad-accent-hover)" }}>
                              {pads.length} шт. ({pads.filter(p => !p.drillDiameter).length} SMD / {pads.filter(p => !!p.drillDiameter).length} THT)
                            </strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Графических линий:</span>
                            <strong style={{ color: "var(--cad-text-main)" }}>{graphics.length} шт.</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="pkg-preset-btn"
                          style={{ width: "100%", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "5px 8px" }}
                          onClick={handleCenterAll}
                          title="Выровнять все площадки и линии симметрично центру (0,0)"
                        >
                          <RotateCcw size={12} />
                          <span>Центрировать элементы по (0,0)</span>
                        </button>
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
                            <label className="form-label">Маска (Solder Mask, мм):</label>
                            <input
                              type="number"
                              step="0.01"
                              value={solderMaskMargin}
                              onChange={(e) => setSolderMaskMargin(parseFloat(e.target.value) || 0)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="0.05 мм"
                            />
                          </div>
                          <div>
                            <label className="form-label">Паста (Paste Mask, мм):</label>
                            <input
                              type="number"
                              step="0.01"
                              value={pasteMaskMargin}
                              onChange={(e) => setPasteMaskMargin(parseFloat(e.target.value) || 0)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="0.00 мм"
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                          <div>
                            <label className="form-label">Зазор дворика (Courtyard, мм):</label>
                            <input
                              type="number"
                              step="0.05"
                              value={courtyardMargin}
                              onChange={(e) => setCourtyardMargin(parseFloat(e.target.value) || 0)}
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
                              value={maxHeight}
                              onChange={(e) => setMaxHeight(parseFloat(e.target.value) || 0.1)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                              placeholder="3.0 мм"
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={hasThermalPad}
                              onChange={(e) => setHasThermalPad(e.target.checked)}
                            />
                            <span>Термоплощадка (EPAD)</span>
                          </label>
                          {hasThermalPad && (
                            <input
                              type="text"
                              value={thermalPadNum}
                              onChange={(e) => setThermalPadNum(e.target.value)}
                              placeholder="Номер (EP)"
                              className="cad-input"
                              style={{ width: 80, padding: "2px 6px", fontSize: 11 }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Карточка: Привязка 3D-модели корпуса */}
                      <div className="pkg-card">
                        <div className="pkg-card-header">
                          <div className="pkg-card-title">
                            <Box size={13} />
                            <span>3D-модель корпуса (MCAD)</span>
                          </div>
                        </div>

                        <div>
                          <label className="form-label">Файл 3D-модели (STEP / GLTF / OBJ):</label>
                          <input
                            type="text"
                            value={model3dPath}
                            onChange={(e) => setModel3dPath(e.target.value)}
                            placeholder="напр. packages/soic8.step"
                            className="cad-input"
                            style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                          <div>
                            <label className="form-label">Смещение Z (мм):</label>
                            <input
                              type="number"
                              step="0.1"
                              value={model3dOffsetZ}
                              onChange={(e) => setModel3dOffsetZ(parseFloat(e.target.value) || 0)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label className="form-label">Высота тела (мм):</label>
                            <input
                              type="number"
                              step="0.1"
                              value={maxHeight}
                              onChange={(e) => setMaxHeight(parseFloat(e.target.value) || 0.1)}
                              className="cad-input"
                              style={{ width: "100%", padding: "4px 8px", fontSize: 11 }}
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
