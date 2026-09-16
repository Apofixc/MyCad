// src/components/SvgRenderer/InteractiveFootprintCanvas.tsx
// Полнофункциональный интерактивный векторный CAD-холст для свободного черчения и редактирования посадочных мест

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  PackagePad,
  GraphicItem,
  PadShape,
  MountType,
  GraphicLayer,
  PackageVariant,
} from "../../types/componentLibrary";
import { getDShapePath, getCapsulePath } from "../../utils/footprintGenerator";
import { getArcPath, getGraphicPath, getFootprintBounds, getPadPath } from "../../utils/footprintGeometry";
import { findHoveredTrimSegment, TrimSegmentPreview, joinGraphics, explodeGraphicItem } from "../../utils/trimGeometry";

export type EditorTool =
  | "select"
  | "pad"
  | "line"
  | "arc"
  | "rect"
  | "circle"
  | "text"
  | "polygon"
  | "trim"
  | "measure"
  | "set_origin";

interface InteractiveFootprintCanvasProps {
  pads: PackagePad[];
  graphics: GraphicItem[];
  variant?: PackageVariant;
  gridStep: number; // в мм (напр. 0.1, 0.5, 1.27, 2.54)
  snapToGrid: boolean;
  activeTool: EditorTool;
  selectedPadNum: string | null;
  selectedPadNums?: string[];
  selectedGraphicId: string | null;
  newPadTemplate: {
    shape: PadShape;
    width: number;
    height: number;
    drillDiameter?: number;
    roundRadius?: number;
  };
  bodyWidth?: number;
  bodyHeight?: number;
  bodyShape?: string;
  dShapeCut?: string;
  courtyardWidth?: number;
  courtyardHeight?: number;
  activeLayer?: GraphicLayer;
  onPadsChange: (pads: PackagePad[]) => void;
  onGraphicsChange: (graphics: GraphicItem[]) => void;
  onSelectPad: (padNum: string | null) => void;
  onSelectPads?: (padNums: string[]) => void;
  onSelectGraphic: (id: string | null) => void;
  onShiftOrigin: (dx: number, dy: number) => void;
  onSetActiveTool?: (tool: EditorTool) => void;
  onRotatePadTemplate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDeleteSelected?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const InteractiveFootprintCanvas: React.FC<InteractiveFootprintCanvasProps> = ({
  pads,
  graphics,
  variant,
  gridStep,
  snapToGrid: enableSnap,
  activeTool,
  selectedPadNum,
  selectedPadNums,
  selectedGraphicId,
  newPadTemplate,
  bodyWidth,
  bodyHeight,
  bodyShape,
  dShapeCut,
  courtyardWidth,
  courtyardHeight,
  activeLayer = "top_silk",
  onPadsChange,
  onGraphicsChange,
  onSelectPad,
  onSelectPads,
  onSelectGraphic,
  onShiftOrigin,
  onSetActiveTool,
  onRotatePadTemplate,
  onUndo,
  onRedo,
  onDeleteSelected,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Камера: смещение центра (мм) и масштаб (пикселей на мм)
  const [viewOffset, setViewOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState<number>(30); // 30 px/mm по умолчанию

  // Статус курсора в мировых координатах (мм)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Состояние взаимодействия
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Перетаскивание площадки
  const [draggingPadNum, setDraggingPadNum] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Перетаскивание графического примитива
  const [draggingGraphicId, setDraggingGraphicId] = useState<string | null>(null);
  const [graphicDragOrigin, setGraphicDragOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Линия/измерение в процессе черчения
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [measureDist, setMeasureDist] = useState<{ dx: number; dy: number; dist: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [arcStart, setArcStart] = useState<{ x: number; y: number } | null>(null);
  const [arcDirectionInverted, setArcDirectionInverted] = useState<boolean>(false);
  const [trimPreview, setTrimPreview] = useState<TrimSegmentPreview | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      setViewport({ width: container.clientWidth, height: container.clientHeight });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDrawStart(null);
    setArcStart(null);
    setArcDirectionInverted(false);
    setTrimPreview(null);
    setPolygonPoints([]);
    setMeasureDist(null);
  }, [activeTool]);

  const finishPolygon = () => {
    if (polygonPoints.length < 3) return;
    const item: GraphicItem = {
      kind: "polygon", id: crypto.randomUUID(), points: polygonPoints,
      strokeWidth: 0.15, layer: activeLayer || "top_fab", filled: false,
    };
    onGraphicsChange([...graphics, item]);
    onSelectGraphic(item.id);
    onSelectPad(null);
    onSelectPads?.([]);
    setPolygonPoints([]);
    onSetActiveTool?.("select");
  };

  const fitGeometry = () => {
    const { minX, maxX, minY, maxY } = getFootprintBounds(pads, graphics);
    setViewOffset({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    setScale(Math.max(0.1, Math.min(200,
      (viewport.width - 80) / Math.max(1, maxX - minX),
      (viewport.height - 100) / Math.max(1, maxY - minY))));
  };

  // Слушатель горячих клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      ) {
        return;
      }

      // Пробел (Space): быстрый поворот на 90° выделенных площадок или шаблона при P
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        const targets = selectedPadNums && selectedPadNums.length > 0 ? selectedPadNums : selectedPadNum ? [selectedPadNum] : [];
        if (targets.length > 0) {
          onPadsChange(
            pads.map((p) => {
              if (targets.includes(p.padNum)) {
                const cur = p.rotation || 0;
                return { ...p, rotation: (cur + 90) % 360 };
              }
              return p;
            })
          );
        } else if (activeTool === "pad") {
          onRotatePadTemplate?.();
        } else if (activeTool === "arc") {
          setArcDirectionInverted((prev) => !prev);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (onDeleteSelected) {
          e.preventDefault();
          onDeleteSelected();
        } else if (selectedPadNums && selectedPadNums.length > 0) {
          e.preventDefault();
          onPadsChange(pads.filter((p) => !selectedPadNums.includes(p.padNum)));
          onSelectPads?.([]);
          onSelectPad(null);
        } else if (selectedPadNum) {
          e.preventDefault();
          onPadsChange(pads.filter((p) => p.padNum !== selectedPadNum));
          onSelectPad(null);
          onSelectPads?.([]);
        } else if (selectedGraphicId) {
          e.preventDefault();
          onGraphicsChange(graphics.filter((g) => g.id !== selectedGraphicId));
          onSelectGraphic(null);
        }
        return;
      }

      if (e.key === "Escape") {
        if (draggingPadNum || draggingGraphicId) onInteractionEnd?.();
        setDraggingPadNum(null);
        setDraggingGraphicId(null);
        setIsPanning(false);
        e.preventDefault();
        setDrawStart(null);
        setPolygonPoints([]);
        setArcStart(null);
        setArcDirectionInverted(false);
        setMeasureDist(null);
        onSelectPad(null);
        onSelectPads?.([]);
        onSelectGraphic(null);
        onSetActiveTool?.("select");
        return;
      }
      if (e.key === "Enter" && activeTool === "polygon") {
        e.preventDefault();
        finishPolygon();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я") {
          e.preventDefault();
          if (e.shiftKey) {
            onRedo?.();
          } else {
            onUndo?.();
          }
          return;
        }
        if (e.key === "y" || e.key === "Y" || e.key === "н" || e.key === "Н") {
          e.preventDefault();
          onRedo?.();
          return;
        }
      }

      const key = e.key.toLowerCase();

      // Explode: Shift+X / Shift+Ч — разбить фигуру на отдельные линии и дуги
      if (e.shiftKey && (key === "x" || key === "ч")) {
        e.preventDefault();
        if (selectedGraphicId) {
          const target = graphics.find((g) => g.id === selectedGraphicId);
          if (target) {
            const parts = explodeGraphicItem(target);
            if (parts.length > 1 || (parts.length === 1 && parts[0].id !== target.id)) {
              onInteractionStart?.();
              const newGraphics = [
                ...graphics.filter((g) => g.id !== selectedGraphicId),
                ...parts,
              ];
              onGraphicsChange(newGraphics);
              onSelectGraphic(parts[0].id);
              onInteractionEnd?.();
            }
          }
        }
        return;
      }

      // Join: J / О — объединить контуры (линии в замкнутый полигон, дуги с хордами)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (key === "j" || key === "о")) {
        e.preventDefault();
        const { newGraphics, createdPolygonId } = joinGraphics(graphics);
        if (newGraphics.length !== graphics.length) {
          onInteractionStart?.();
          onGraphicsChange(newGraphics);
          if (createdPolygonId) {
            onSelectGraphic(createdPolygonId);
          }
          onInteractionEnd?.();
        }
        return;
      }

      if (key === "v" || key === "м") onSetActiveTool?.("select");
      else if (key === "p" || key === "з") onSetActiveTool?.("pad");
      else if (key === "l" || key === "д") onSetActiveTool?.("line");
      else if (key === "r" || key === "к") onSetActiveTool?.("rect");
      else if (key === "c" || key === "с") onSetActiveTool?.("circle");
      else if (key === "x" || key === "ч") onSetActiveTool?.("trim");
      else if (key === "m" || key === "ь") onSetActiveTool?.("measure");
      else if (key === "f" || key === "а") fitGeometry();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedPadNum,
    selectedPadNums,
    selectedGraphicId,
    activeTool,
    pads,
    graphics,
    onDeleteSelected,
    onPadsChange,
    onGraphicsChange,
    onSelectPad,
    onSelectPads,
    onSelectGraphic,
    onSetActiveTool,
    onRotatePadTemplate,
    onUndo,
    onRedo,
    polygonPoints,
    viewport,
    draggingPadNum,
    draggingGraphicId,
    onInteractionEnd,
    activeLayer,
  ]);

  // Привязка к сетке
  const snapCoord = useCallback(
    (val: number) => {
      if (!enableSnap || gridStep <= 0) return Math.round(val * 1000) / 1000;
      return Math.round(val / gridStep) * gridStep;
    },
    [enableSnap, gridStep]
  );

  // Преобразование координат экрана (px) в координаты CAD (мм)
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const pxX = clientX - rect.left;
      const pxY = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const worldX = (pxX - centerX) / scale + viewOffset.x;
      const worldY = (pxY - centerY) / scale + viewOffset.y;

      return {
        x: Math.round(worldX * 1000) / 1000,
        y: Math.round(worldY * 1000) / 1000,
      };
    },
    [scale, viewOffset]
  );

  // Зум колесиком к курсору
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.max(0.1, Math.min(400, scale * zoomFactor));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pxX = e.clientX - rect.left - rect.width / 2;
      const pxY = e.clientY - rect.top - rect.height / 2;

      // Сдвигаем центр так, чтобы точка под курсором осталась на месте
      const newOffsetX = viewOffset.x + pxX / scale - pxX / newScale;
      const newOffsetY = viewOffset.y + pxY / scale - pxY / newScale;

      setScale(newScale);
      setViewOffset({ x: newOffsetX, y: newOffsetY });
    }
  };

  // Обработка клика мыши
  const handleMouseDown = (e: React.MouseEvent) => {
    // Панорамирование колесом мыши или с зажатым пробелом / Alt
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 2) {
      // Правая кнопка мыши: завершить текущую цепочку линий/полигона или выйти в select
      e.preventDefault();
      if (activeTool === "polygon" && polygonPoints.length >= 3) {
        finishPolygon();
      } else {
        setDrawStart(null);
        setPolygonPoints([]);
        setArcStart(null);
        setMeasureDist(null);
        onSetActiveTool?.("select");
      }
      return;
    }

    if (e.button !== 0) return; // Только левая кнопка мыши

    const world = screenToWorld(e.clientX, e.clientY);
    const snapped = { x: snapCoord(world.x), y: snapCoord(world.y) };

    if (activeTool === "polygon") {
      const first = polygonPoints[0];
      if (first && polygonPoints.length >= 3 && Math.hypot(snapped.x - first[0], snapped.y - first[1]) * scale < 10) {
        finishPolygon();
      } else if (!polygonPoints.length || Math.hypot(
        snapped.x - polygonPoints[polygonPoints.length - 1][0],
        snapped.y - polygonPoints[polygonPoints.length - 1][1]) > 0.001) {
        setPolygonPoints([...polygonPoints, [snapped.x, snapped.y]]);
      }
      return;
    }
    if (activeTool === "arc") {
      if (!drawStart) {
        setDrawStart(snapped);
      } else if (!arcStart) {
        if (Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y) > 0.01) {
          setArcStart(snapped);
        }
      } else {
        const radius = Math.hypot(arcStart.x - drawStart.x, arcStart.y - drawStart.y);
        const startAngle =
          Math.round((Math.atan2(arcStart.y - drawStart.y, arcStart.x - drawStart.x) * 180 / Math.PI) * 100) / 100;
        const curAngle =
          Math.round((Math.atan2(snapped.y - drawStart.y, snapped.x - drawStart.x) * 180 / Math.PI) * 100) / 100;

        let diff = ((curAngle - startAngle) % 360 + 360) % 360;
        if (diff > 180) diff -= 360;
        const isClockwise = arcDirectionInverted ? diff < 0 : diff >= 0;

        if (radius > 0.01 && Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y) > 0.001) {
          const item: GraphicItem = {
            kind: "arc",
            id: `arc_${crypto.randomUUID()}`,
            cx: drawStart.x,
            cy: drawStart.y,
            radius: Math.round(radius * 1000) / 1000,
            startAngle,
            endAngle: curAngle,
            clockwise: isClockwise,
            strokeWidth: 0.15,
            layer: activeLayer || "top_silk",
          };
          const { newGraphics, createdPolygonId } = joinGraphics([...graphics, item]);
          onGraphicsChange(newGraphics);
          onSelectGraphic(createdPolygonId || item.id);
          onSelectPad(null);
          onSelectPads?.([]);
        }
        setDrawStart(null);
        setArcStart(null);
        setArcDirectionInverted(false);
        onSetActiveTool?.("select");
      }
      return;
    }
    if (activeTool === "trim") {
      if (trimPreview) {
        onGraphicsChange(trimPreview.newGraphics);
        const nextPreview = findHoveredTrimSegment(world, trimPreview.newGraphics, Math.max(0.5, 12 / scale));
        setTrimPreview(nextPreview);
      }
      return;
    }
    if (activeTool === "text") {
      const item: GraphicItem = {
        kind: "text", id: crypto.randomUUID(), x: snapped.x, y: snapped.y, text: "Текст",
        fontSize: 1, rotation: 0, align: "center", strokeWidth: 0.15, layer: activeLayer || "top_silk",
      };
      onGraphicsChange([...graphics, item]);
      onSelectGraphic(item.id);
      onSelectPad(null);
      onSelectPads?.([]);
      onSetActiveTool?.("select");
      return;
    }
    if (activeTool === "pad") {
      // Ставим новую площадку с автоматическим инкрементом
      const nextNum = getNextPadNumber(pads);
      const newPad: PackagePad = {
        padNum: nextNum,
        name: nextNum,
        x: snapped.x,
        y: snapped.y,
        width: newPadTemplate.width,
        height: newPadTemplate.height,
        rotation: 0,
        shape: newPadTemplate.shape,
        drillDiameter: newPadTemplate.drillDiameter,
        roundRadius: newPadTemplate.roundRadius,
        plated: newPadTemplate.drillDiameter ? true : undefined,
      };
      onPadsChange([...pads, newPad]);
      onSelectPad(nextNum);
      onSelectPads?.([nextNum]);
      return;
    }

    if (activeTool === "set_origin") {
      // Сдвигаем начало координат так, чтобы точка (snapped.x, snapped.y) стала новым (0,0)
      onShiftOrigin(-snapped.x, -snapped.y);
      return;
    }

    if (activeTool === "line" || activeTool === "measure" || activeTool === "rect" || activeTool === "circle") {
      if (!drawStart) {
        setDrawStart(snapped);
      } else {
        if (activeTool === "line") {
          // Если клик в ту же точку — завершаем цепочку линий
          if (Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y) < 0.02) {
            setDrawStart(null);
            return;
          }
          const newLine: GraphicItem = {
            kind: "line",
            id: `line_${crypto.randomUUID()}`,
            x1: drawStart.x,
            y1: drawStart.y,
            x2: snapped.x,
            y2: snapped.y,
            strokeWidth: 0.15,
            layer: activeLayer || "top_silk",
          };
          const { newGraphics, createdPolygonId } = joinGraphics([...graphics, newLine]);
          onGraphicsChange(newGraphics);
          if (createdPolygonId) {
            onSelectGraphic(createdPolygonId);
            setDrawStart(null);
            onSetActiveTool?.("select");
            return;
          }
          // Непрерывное рисование контура (полилиния): следующий отрезок начинается из конца текущего
          setDrawStart(snapped);
          return;
        } else if (activeTool === "rect") {
          const w = Math.abs(snapped.x - drawStart.x);
          const h = Math.abs(snapped.y - drawStart.y);
          if (w > 0.05 && h > 0.05) {
            const newRect: GraphicItem = {
              kind: "rect",
              id: `rect_${crypto.randomUUID()}`,
              x: (drawStart.x + snapped.x) / 2,
              y: (drawStart.y + snapped.y) / 2,
              width: w,
              height: h,
              roundRadius: 0,
              rotation: 0,
              strokeWidth: 0.15,
              layer: activeLayer || "top_silk",
              filled: false,
            };
            onGraphicsChange([...graphics, newRect]);
          }
        } else if (activeTool === "circle") {
          const r = Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y);
          if (r > 0.05) {
            const newCircle: GraphicItem = {
              kind: "circle",
              id: `circle_${crypto.randomUUID()}`,
              cx: drawStart.x,
              cy: drawStart.y,
              radius: Math.round(r * 1000) / 1000,
              strokeWidth: 0.15,
              layer: activeLayer || "top_silk",
              filled: false,
            };
            onGraphicsChange([...graphics, newCircle]);
          }
        }
        setDrawStart(null);
        setMeasureDist(null);
      }
      return;
    }




    if (activeTool === "select") {
      // Клик по пустому месту сбрасывает выделение
      onSelectPad(null);
      onSelectPads?.([]);
      onSelectGraphic(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY);
    const snapped = { x: snapCoord(world.x), y: snapCoord(world.y) };
    setCursorPos(snapped);

    if (isPanning) {
      const dx = (e.clientX - panStart.x) / scale;
      const dy = (e.clientY - panStart.y) / scale;
      setViewOffset((v) => ({ x: v.x - dx, y: v.y - dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (draggingPadNum) {
      const newX = snapCoord(world.x - dragOffset.x);
      const newY = snapCoord(world.y - dragOffset.y);
      onPadsChange(
        pads.map((p) => (p.padNum === draggingPadNum ? { ...p, x: newX, y: newY } : p))
      );
      return;
    }

    if (draggingGraphicId) {
      const curX = snapCoord(world.x);
      const curY = snapCoord(world.y);
      const dx = curX - graphicDragOrigin.x;
      const dy = curY - graphicDragOrigin.y;
      if (dx !== 0 || dy !== 0) {
        onGraphicsChange(
          graphics.map((g) => {
            if (g.id !== draggingGraphicId) return g;
            switch (g.kind) {
              case "line":
                return {
                  ...g,
                  x1: Math.round((g.x1 + dx) * 1000) / 1000,
                  y1: Math.round((g.y1 + dy) * 1000) / 1000,
                  x2: Math.round((g.x2 + dx) * 1000) / 1000,
                  y2: Math.round((g.y2 + dy) * 1000) / 1000,
                };
              case "rect":
              case "text":
                return {
                  ...g,
                  x: Math.round((g.x + dx) * 1000) / 1000,
                  y: Math.round((g.y + dy) * 1000) / 1000,
                };
              case "circle":
              case "arc":
                return {
                  ...g,
                  cx: Math.round((g.cx + dx) * 1000) / 1000,
                  cy: Math.round((g.cy + dy) * 1000) / 1000,
                };
              case "polygon":
                return {
                  ...g,
                  points: g.points.map(
                    ([px, py]) =>
                      [Math.round((px + dx) * 1000) / 1000, Math.round((py + dy) * 1000) / 1000] as [
                        number,
                        number
                      ]
                  ),
                };
              default:
                return g;
            }
          })
        );
        setGraphicDragOrigin({ x: curX, y: curY });
      }
      return;
    }

    if (activeTool === "trim") {
      const preview = findHoveredTrimSegment(world, graphics, Math.max(0.5, 12 / scale));
      setTrimPreview(preview);
    }

    if (drawStart) {
      const dx = snapped.x - drawStart.x;
      const dy = snapped.y - drawStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setMeasureDist({
        dx: Math.round(dx * 1000) / 1000,
        dy: Math.round(dy * 1000) / 1000,
        dist: Math.round(dist * 1000) / 1000,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingPadNum || draggingGraphicId) onInteractionEnd?.();
    setIsPanning(false);
    setDraggingPadNum(null);
    setDraggingGraphicId(null);
  };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [draggingPadNum, draggingGraphicId, onInteractionEnd]);

  // Хелпер вычисления следующего номера площадки
  function getNextPadNumber(existingPads: PackagePad[]): string {
    const numericNums = existingPads
      .map((p) => parseInt(p.padNum, 10))
      .filter((n) => !isNaN(n));
    if (numericNums.length === 0) return "1";
    return String(Math.max(...numericNums) + 1);
  }

  // Рендеринг сетки
  const renderGrid = () => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Шаг сетки в экранных пикселях
    const gridPx = gridStep * scale;
    if (gridPx < 6) return null; // Слишком мелкая сетка, скрываем для читаемости

    const offsetX = (-viewOffset.x * scale + w / 2) % gridPx;
    const offsetY = (-viewOffset.y * scale + h / 2) % gridPx;

    return (
      <svg
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <pattern
            id="interactiveCadGrid"
            width={gridPx}
            height={gridPx}
            patternUnits="userSpaceOnUse"
            x={offsetX}
            y={offsetY}
          >
            <circle cx={gridPx / 2} cy={gridPx / 2} r={gridPx > 20 ? 1 : 0.8} fill="#334155" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#interactiveCadGrid)" />

        {/* Главные оси X и Y */}
        <line
          x1={0}
          y1={-viewOffset.y * scale + h / 2}
          x2={w}
          y2={-viewOffset.y * scale + h / 2}
          stroke="#475569"
          strokeWidth={1.5}
        />
        <line
          x1={-viewOffset.x * scale + w / 2}
          y1={0}
          x2={-viewOffset.x * scale + w / 2}
          y2={h}
          stroke="#475569"
          strokeWidth={1.5}
        />

        {/* Начало координат (0,0) */}
        <g transform={`translate(${-viewOffset.x * scale + w / 2}, ${-viewOffset.y * scale + h / 2})`}>
          <circle cx={0} cy={0} r={6} fill="none" stroke="#ef4444" strokeWidth={2} />
          <line x1={-10} y1={0} x2={10} y2={0} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={0} y1={-10} x2={0} y2={10} stroke="#ef4444" strokeWidth={1.5} />
          <text x={8} y={-8} fill="#ef4444" fontSize={10} fontWeight="bold">
            (0,0)
          </text>
        </g>
      </svg>
    );
  };

  // Координаты экрана центра холста
  const containerW = viewport.width;
  const containerH = viewport.height;
  const originPxX = -viewOffset.x * scale + containerW / 2;
  const originPxY = -viewOffset.y * scale + containerH / 2;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="2D-редактор корпуса"
      onMouseDownCapture={() => containerRef.current?.focus({ preventScroll: true })}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={() => setDrawStart(null)}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#070b12",
        overflow: "hidden",
        cursor:
          isPanning
            ? "grabbing"
            : activeTool === "pad"
            ? "crosshair"
            : activeTool === "line" || activeTool === "rect" || activeTool === "measure" || activeTool === "trim"
            ? "crosshair"
            : activeTool === "set_origin"
            ? "move"
            : "default",
        userSelect: "none",
      }}
    >
      {/* Сетка и оси координат */}
      {renderGrid()}
      <div style={{ position: "absolute", top: 8, left: 12, right: 12, zIndex: 2, display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
        <button className="cad-btn-secondary" onClick={fitGeometry} onMouseDown={(e) => e.stopPropagation()}>Показать всё (F)</button>
        {activeTool === "polygon" && <button className="cad-btn-primary" disabled={polygonPoints.length < 3} onClick={finishPolygon} onMouseDown={(e) => e.stopPropagation()}>Замкнуть контур (Enter)</button>}
        <span style={{ color: "#94a3b8", pointerEvents: "none" }}>
          {activeTool === "polygon" ? "Кликните вершины. Enter — замкнуть, Esc — отменить."
            : activeTool === "arc" ? (
                !drawStart
                  ? "Шаг 1: кликните центр дуги."
                  : !arcStart
                  ? "Шаг 2: кликните начальную точку (радиус)."
                  : "Шаг 3: кликните конечную точку дуги · Пробел — инвертировать направление (CW/CCW)."
              )
            : activeTool === "trim" ? "Ножницы: наведите на лишний отрезок/сегмент между пересечениями и кликните, чтобы отсечь его."
            : activeTool === "text" ? "Кликните место надписи, затем измените текст в свойствах."
            : "Колесо — масштаб · Alt + перетаскивание — панорама · Esc — выбор"}
        </span>
      </div>

      {/* SVG холст для отрисовки геометрии корпуса */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <g transform={`translate(${originPxX}, ${originPxY}) scale(${scale})`}>
          {/* 1. Зона отчуждения (Courtyard) - только для SMD и при наличии элементов на холсте */}
          {courtyardWidth && courtyardHeight && courtyardWidth > 0 && courtyardHeight > 0 && (pads.length > 0 || graphics.length > 0) && (
            <rect
              x={-courtyardWidth / 2}
              y={-courtyardHeight / 2}
              width={courtyardWidth}
              height={courtyardHeight}
              fill="rgba(168, 85, 247, 0.04)"
              stroke="#a855f7"
              strokeWidth={0.08}
              strokeDasharray="0.4 0.3"
              pointerEvents="none"
            />
          )}

          {/* 2. Тело компонента (Body / Fabrication) */}
          {bodyShape && bodyShape !== "none" && bodyWidth && bodyHeight && bodyWidth > 0 && bodyHeight > 0 && (
            <g pointerEvents="none">
              {bodyShape === "circle" ? (
                <circle
                  cx={0}
                  cy={0}
                  r={bodyWidth / 2}
                  fill={variant?.bodyColor || "rgba(30, 41, 59, 0.5)"}
                  stroke={variant?.bodyBorderColor || "#475569"}
                  strokeWidth={0.12}
                />
              ) : bodyShape === "d_shape" ? (
                <path
                  d={getDShapePath(0, 0, bodyWidth / 2, (dShapeCut as any) || "right", 0.58)}
                  fill={variant?.bodyColor || "rgba(30, 41, 59, 0.5)"}
                  stroke={variant?.bodyBorderColor || "#475569"}
                  strokeWidth={0.12}
                />
              ) : bodyShape === "capsule" ? (
                <path
                  d={getCapsulePath(0, 0, bodyWidth, bodyHeight)}
                  fill={variant?.bodyColor || "rgba(30, 41, 59, 0.5)"}
                  stroke={variant?.bodyBorderColor || "#475569"}
                  strokeWidth={0.12}
                />
              ) : (
                <rect
                  x={-bodyWidth / 2}
                  y={-bodyHeight / 2}
                  width={bodyWidth}
                  height={bodyHeight}
                  rx={0.2}
                  fill={variant?.bodyColor || "rgba(30, 41, 59, 0.5)"}
                  stroke={variant?.bodyBorderColor || "#475569"}
                  strokeWidth={0.12}
                />
              )}

              {/* Ключ полярности (Key: Notch / Dot / Stripe) */}
              {variant?.keyType === "notch" && (
                <path
                  d={`M -0.4 ${-bodyHeight / 2} A 0.4 0.4 0 0 0 0.4 ${-bodyHeight / 2}`}
                  fill="none"
                  stroke={variant.bodyBorderColor || "#64748b"}
                  strokeWidth={0.12}
                />
              )}
              {variant?.keyType === "dot" && (
                <circle
                  cx={-bodyWidth / 2 + 0.6}
                  cy={-bodyHeight / 2 + 0.6}
                  r={0.25}
                  fill="#f8fafc"
                />
              )}
              {variant?.keyType === "stripe" && (
                <line
                  x1={-bodyWidth / 2 + 0.5}
                  y1={-bodyHeight / 2}
                  x2={-bodyWidth / 2 + 0.5}
                  y2={bodyHeight / 2}
                  stroke="#f8fafc"
                  strokeWidth={0.2}
                />
              )}
            </g>
          )}

          {/* Графические примитивы (линии, дуги, D-shape) */}
          {graphics.map((item) => {
            const isSelected = selectedGraphicId === item.id;
            const strokeColor = isSelected ? "#38bdf8" : "#f8fafc";
            const strokeWidth = item.strokeWidth || 0.15;
            const hitWidth = Math.max(strokeWidth, 8 / scale);
            const pointerStyle = {
              pointerEvents: "auto" as const,
              cursor: activeTool === "select" ? "move" : "pointer",
            };
            const handleGraphicMouseDown = (e: React.MouseEvent) => {
              if (activeTool === "select" && e.button === 0) {
                e.stopPropagation();
                onSelectGraphic(item.id);
                onSelectPad(null);
                onSelectPads?.([]);
                setDraggingGraphicId(item.id);
                onInteractionStart?.();
                const world = screenToWorld(e.clientX, e.clientY);
                setGraphicDragOrigin({ x: snapCoord(world.x), y: snapCoord(world.y) });
              }
            };
            const handleGraphicClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectGraphic(item.id);
              onSelectPad(null);
              onSelectPads?.([]);
            };

            switch (item.kind) {
              case "line":
                return (
                  <g key={item.id} style={pointerStyle} onMouseDown={handleGraphicMouseDown} onClick={handleGraphicClick}>
                    <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke="transparent" strokeWidth={hitWidth} strokeLinecap="round" />
                    <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" pointerEvents="none" />
                  </g>
                );

              case "rect":
                return (
                  <g key={item.id} transform={`rotate(${item.rotation} ${item.x} ${item.y})`} style={pointerStyle} onMouseDown={handleGraphicMouseDown} onClick={handleGraphicClick}>
                    <rect x={item.x - item.width / 2} y={item.y - item.height / 2} width={item.width} height={item.height} rx={item.roundRadius} fill={item.filled ? strokeColor : "transparent"} stroke="transparent" strokeWidth={hitWidth} />
                    <rect x={item.x - item.width / 2} y={item.y - item.height / 2} width={item.width} height={item.height} rx={item.roundRadius} fill={item.filled ? strokeColor : "none"} stroke={strokeColor} strokeWidth={strokeWidth} pointerEvents="none" />
                  </g>
                );
              case "circle":
                return (
                  <g key={item.id} style={pointerStyle} onMouseDown={handleGraphicMouseDown} onClick={handleGraphicClick}>
                    <circle cx={item.cx} cy={item.cy} r={item.radius} fill={item.filled ? strokeColor : "transparent"} stroke="transparent" strokeWidth={hitWidth} />
                    <circle cx={item.cx} cy={item.cy} r={item.radius} fill={item.filled ? strokeColor : "none"} stroke={strokeColor} strokeWidth={strokeWidth} pointerEvents="none" />
                  </g>
                );
              case "arc":
              case "polygon":
                return (
                  <g key={item.id} style={pointerStyle} onMouseDown={handleGraphicMouseDown} onClick={handleGraphicClick}>
                    <path d={getGraphicPath(item)} fill={item.kind === "polygon" && item.filled ? strokeColor : "transparent"} stroke="transparent" strokeWidth={hitWidth} />
                    <path d={getGraphicPath(item)} fill={item.kind === "polygon" && item.filled ? strokeColor : "none"} stroke={strokeColor} strokeWidth={strokeWidth} pointerEvents="none" />
                  </g>
                );
              case "text":
                return (
                  <text key={item.id} x={item.x} y={item.y} fontSize={item.fontSize}
                    transform={`rotate(${item.rotation} ${item.x} ${item.y})`}
                    fill={strokeColor} textAnchor={item.align === "left" ? "start" : item.align === "right" ? "end" : "middle"}
                    dominantBaseline="central" style={pointerStyle} onMouseDown={handleGraphicMouseDown} onClick={handleGraphicClick}>{item.text}</text>
                );
            }
          })}

          {/* Интерактивные контактные площадки (Pads) */}
          {pads.map((pad) => {
            const isSelected = selectedPadNums && selectedPadNums.length > 0
              ? selectedPadNums.includes(pad.padNum)
              : selectedPadNum === pad.padNum;
            const copper = pad.drillDiameter ? "#d97706" : "#f59e0b";
            const stroke = isSelected ? "#38bdf8" : "#b45309";
            const sw = isSelected ? 0.25 : 0.08;

            return (
              <g
                key={pad.padNum}
                transform={pad.rotation ? `rotate(${pad.rotation} ${pad.x} ${pad.y})` : undefined}
                style={{ pointerEvents: "auto", cursor: activeTool === "select" ? "move" : "pointer" }}
                onMouseDown={(e) => {
                  if (activeTool === "select" && e.button === 0) {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      const curList = selectedPadNums && selectedPadNums.length > 0 ? selectedPadNums : selectedPadNum ? [selectedPadNum] : [];
                      const nextList = curList.includes(pad.padNum)
                        ? curList.filter((n) => n !== pad.padNum)
                        : [...curList, pad.padNum];
                      onSelectPads?.(nextList);
                      onSelectPad(nextList.length === 1 ? nextList[0] : null);
                    } else {
                      onSelectPads?.([pad.padNum]);
                      onSelectPad(pad.padNum);
                      onSelectGraphic(null);
                      setDraggingPadNum(pad.padNum);
                      onInteractionStart?.();
                      const world = screenToWorld(e.clientX, e.clientY);
                      setDragOffset({ x: world.x - pad.x, y: world.y - pad.y });
                    }
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!e.shiftKey) {
                    onSelectPads?.([pad.padNum]);
                    onSelectPad(pad.padNum);
                    onSelectGraphic(null);
                  }
                }}
              >
                {/* Форма площадки */}
                <path d={getPadPath(pad)} fill={copper} stroke={stroke} strokeWidth={sw} />

                {/* Сверловка THT */}
                {pad.drillDiameter && pad.drillDiameter > 0 && (
                  <path d={getCapsulePath(pad.x, pad.y,
                    pad.drillShape === "slot" ? Math.max(pad.drillDiameter, pad.slotLength ?? 0) : pad.drillDiameter,
                    pad.drillDiameter)} fill="#090d16" stroke="#475569" strokeWidth={0.04} />
                )}

                {/* Номер вывода */}
                <text
                  x={pad.x}
                  y={pad.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize={Math.min(pad.width, pad.height) * 0.42}
                  fontWeight="bold"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {pad.name || pad.padNum}
                </text>
              </g>
            );
          })}

          {/* Полупрозрачный фантом площадки под курсором при активном инструменте Pad */}
          {activeTool === "pad" && (
            <g
              transform={`translate(${cursorPos.x}, ${cursorPos.y})`}
              pointerEvents="none"
            >
              <path
                d={getPadPath({
                  padNum: "?",
                  name: "?",
                  x: 0,
                  y: 0,
                  width: newPadTemplate.width,
                  height: newPadTemplate.height,
                  rotation: 0,
                  shape: newPadTemplate.shape,
                  drillDiameter: newPadTemplate.drillDiameter,
                  roundRadius: newPadTemplate.roundRadius,
                })}
                fill="rgba(245, 158, 11, 0.45)"
                stroke="#38bdf8"
                strokeWidth={0.15}
                strokeDasharray="0.3 0.2"
              />
              {newPadTemplate.drillDiameter && newPadTemplate.drillDiameter > 0 && (
                <circle cx={0} cy={0} r={newPadTemplate.drillDiameter / 2} fill="#000000" stroke="#94a3b8" strokeWidth={0.04} />
              )}
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={Math.min(newPadTemplate.width, newPadTemplate.height) * 0.4}
                fontWeight="bold"
              >
                +
              </text>
            </g>
          )}

          {/* Резиновая нить / превью при черчении */}
          {polygonPoints.length > 0 && <polyline
            points={[...polygonPoints, [cursorPos.x, cursorPos.y]].map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none" stroke="#38bdf8" strokeWidth={0.15} strokeDasharray="0.3 0.2" pointerEvents="none" />}
          {drawStart && (
            <g pointerEvents="none">
              {activeTool === "arc" && (() => {
                const cx = drawStart.x;
                const cy = drawStart.y;
                if (!arcStart) {
                  const currentR = Math.hypot(cursorPos.x - cx, cursorPos.y - cy);
                  return (
                    <g>
                      {/* Маркер центра дуги */}
                      <circle cx={cx} cy={cy} r={0.35} fill="none" stroke="#ef4444" strokeWidth={0.08} />
                      <line x1={cx - 0.7} y1={cy} x2={cx + 0.7} y2={cy} stroke="#ef4444" strokeWidth={0.08} />
                      <line x1={cx} y1={cy - 0.7} x2={cx} y2={cy + 0.7} stroke="#ef4444" strokeWidth={0.08} />
                      {/* Линия радиуса к курсору */}
                      <line x1={cx} y1={cy} x2={cursorPos.x} y2={cursorPos.y} stroke="#38bdf8" strokeWidth={0.12} strokeDasharray="0.3 0.2" />
                      {/* Пунктирная окружность текущего радиуса */}
                      {currentR > 0.05 && (
                        <circle cx={cx} cy={cy} r={currentR} fill="none" stroke="#38bdf8" strokeWidth={0.08} strokeDasharray="0.3 0.3" opacity={0.6} />
                      )}
                      <circle cx={cursorPos.x} cy={cursorPos.y} r={0.2} fill="#38bdf8" />
                    </g>
                  );
                }

                // Шаг 3: центр и начальная точка зафиксированы, выбираем конечную точку
                const r = Math.hypot(arcStart.x - cx, arcStart.y - cy);
                const startAngle = (Math.atan2(arcStart.y - cy, arcStart.x - cx) * 180) / Math.PI;
                const curDist = Math.hypot(cursorPos.x - cx, cursorPos.y - cy);
                const curAngle = (Math.atan2(cursorPos.y - cy, cursorPos.x - cx) * 180) / Math.PI;
                const curRad = (curAngle * Math.PI) / 180;
                const projX = cx + r * Math.cos(curRad);
                const projY = cy + r * Math.sin(curRad);

                let diff = ((curAngle - startAngle) % 360 + 360) % 360;
                if (diff > 180) diff -= 360;
                const isClockwise = arcDirectionInverted ? diff < 0 : diff >= 0;

                const arcPath = getArcPath({
                  kind: "arc",
                  id: "preview_arc",
                  layer: activeLayer || "top_silk",
                  cx,
                  cy,
                  radius: r,
                  startAngle,
                  endAngle: curAngle,
                  clockwise: isClockwise,
                  strokeWidth: 0.15,
                });

                return (
                  <g>
                    {/* Маркер центра дуги */}
                    <circle cx={cx} cy={cy} r={0.35} fill="none" stroke="#ef4444" strokeWidth={0.08} />
                    <line x1={cx - 0.7} y1={cy} x2={cx + 0.7} y2={cy} stroke="#ef4444" strokeWidth={0.08} />
                    <line x1={cx} y1={cy - 0.7} x2={cx} y2={cy + 0.7} stroke="#ef4444" strokeWidth={0.08} />

                    {/* Маркер начальной точки */}
                    <circle cx={arcStart.x} cy={arcStart.y} r={0.3} fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth={0.08} />
                    <circle cx={arcStart.x} cy={arcStart.y} r={0.1} fill="#38bdf8" />

                    {/* Базовая орбита-окружность */}
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#64748b" strokeWidth={0.08} strokeDasharray="0.4 0.3" opacity={0.5} />

                    {/* Направляющий луч от центра через позицию курсора */}
                    <line x1={cx} y1={cy} x2={curDist > r ? cursorPos.x : projX} y2={curDist > r ? cursorPos.y : projY} stroke="#38bdf8" strokeWidth={0.08} strokeDasharray="0.3 0.2" opacity={0.6} />

                    {/* Проекция конечной точки на окружность */}
                    <circle cx={projX} cy={projY} r={0.25} fill="#38bdf8" stroke="#ffffff" strokeWidth={0.08} />

                    {/* Сама дуга в реальном времени */}
                    {arcPath && <path d={arcPath} fill="none" stroke="#38bdf8" strokeWidth={0.22} />}
                  </g>
                );
              })()}
              {activeTool === "line" && (
                <line
                  x1={drawStart.x}
                  y1={drawStart.y}
                  x2={cursorPos.x}
                  y2={cursorPos.y}
                  stroke="#38bdf8"
                  strokeWidth={0.15}
                  strokeDasharray="0.3 0.2"
                />
              )}
              {activeTool === "rect" && (
                <rect
                  x={Math.min(drawStart.x, cursorPos.x)}
                  y={Math.min(drawStart.y, cursorPos.y)}
                  width={Math.abs(cursorPos.x - drawStart.x)}
                  height={Math.abs(cursorPos.y - drawStart.y)}
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="#38bdf8"
                  strokeWidth={0.15}
                  strokeDasharray="0.3 0.2"
                />
              )}
              {activeTool === "circle" && (
                <circle
                  cx={drawStart.x}
                  cy={drawStart.y}
                  r={Math.hypot(cursorPos.x - drawStart.x, cursorPos.y - drawStart.y)}
                  fill="rgba(56, 189, 248, 0.12)"
                  stroke="#38bdf8"
                  strokeWidth={0.15}
                  strokeDasharray="0.3 0.2"
                />
              )}
              {activeTool === "measure" && (
                <g>
                  <line
                    x1={drawStart.x}
                    y1={drawStart.y}
                    x2={cursorPos.x}
                    y2={cursorPos.y}
                    stroke="#fbbf24"
                    strokeWidth={0.15}
                    strokeDasharray="0.2 0.2"
                  />
                  <circle cx={drawStart.x} cy={drawStart.y} r={0.2} fill="#fbbf24" />
                  <circle cx={cursorPos.x} cy={cursorPos.y} r={0.2} fill="#fbbf24" />
                </g>
              )}
            </g>
          )}
          {/* Подсветка отсекаемого сегмента при инструменте Trim */}
          {activeTool === "trim" && trimPreview && (
            <g pointerEvents="none">
              <path
                d={trimPreview.highlightPath}
                fill="none"
                stroke="rgba(239, 68, 68, 0.4)"
                strokeWidth={Math.max(0.6, 8 / scale)}
                strokeLinecap="round"
              />
              <path
                d={trimPreview.highlightPath}
                fill="none"
                stroke="#ef4444"
                strokeWidth={Math.max(0.25, 3.5 / scale)}
                strokeDasharray="0.3 0.2"
                strokeLinecap="round"
              />
              {trimPreview.boundaryPoints.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r={Math.max(0.25, 4 / scale)} fill="#ef4444" stroke="#ffffff" strokeWidth={0.06} />
                  <line
                    x1={pt.x - Math.max(0.35, 5 / scale)}
                    y1={pt.y}
                    x2={pt.x + Math.max(0.35, 5 / scale)}
                    y2={pt.y}
                    stroke="#ffffff"
                    strokeWidth={0.06}
                  />
                  <line
                    x1={pt.x}
                    y1={pt.y - Math.max(0.35, 5 / scale)}
                    x2={pt.x}
                    y2={pt.y + Math.max(0.35, 5 / scale)}
                    stroke="#ffffff"
                    strokeWidth={0.06}
                  />
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* Плавающая панель информации курсора и измерений внизу */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(6px)",
          padding: "6px 14px",
          borderRadius: 8,
          border: "1px solid #1e293b",
          color: "#cbd5e1",
          fontSize: 12,
          fontFamily: "monospace",
          pointerEvents: "none",
        }}
      >
        <span>
          X: <strong>{cursorPos.x.toFixed(2)}</strong> mm
        </span>
        <span>
          Y: <strong>{cursorPos.y.toFixed(2)}</strong> mm
        </span>
        <span style={{ color: "#94a3b8" }}>
          Сетка: <strong>{gridStep}</strong> мм
        </span>
        <span style={{ color: "#94a3b8" }}>
          Зум: <strong>{Math.round(scale)}</strong> px/mm
        </span>
        {measureDist && activeTool !== "arc" && activeTool !== "trim" && (
          <span style={{ color: "#fbbf24", fontWeight: "bold" }}>
            L: {measureDist.dist.toFixed(3)} mm (dX: {measureDist.dx.toFixed(2)}, dY: {measureDist.dy.toFixed(2)})
          </span>
        )}
        {activeTool === "trim" && (
          <span style={{ color: trimPreview ? "#ef4444" : "#38bdf8", fontWeight: "bold" }}>
            {trimPreview ? "✂ Кликните, чтобы отсечь подсвеченный сегмент" : "✂ Наведите на пересекающийся контур"}
          </span>
        )}
        {activeTool === "arc" && drawStart && (() => {
          const cx = drawStart.x;
          const cy = drawStart.y;
          if (!arcStart) {
            const currentR = Math.hypot(cursorPos.x - cx, cursorPos.y - cy);
            return (
              <span style={{ color: "#38bdf8", fontWeight: "bold" }}>
                R: {currentR.toFixed(3)} мм (клик 2 — радиус/начало)
              </span>
            );
          }
          const r = Math.hypot(arcStart.x - cx, arcStart.y - cy);
          const startAngle = (Math.atan2(arcStart.y - cy, arcStart.x - cx) * 180) / Math.PI;
          const curAngle = (Math.atan2(cursorPos.y - cy, cursorPos.x - cx) * 180) / Math.PI;
          let diff = ((curAngle - startAngle) % 360 + 360) % 360;
          if (diff > 180) diff -= 360;
          const isClockwise = arcDirectionInverted ? diff < 0 : diff >= 0;
          const sweepDeg = isClockwise
            ? ((curAngle - startAngle) % 360 + 360) % 360
            : ((startAngle - curAngle) % 360 + 360) % 360;

          return (
            <span style={{ color: "#38bdf8", fontWeight: "bold" }}>
              R: {r.toFixed(3)} мм · Размах: {sweepDeg.toFixed(1)}° ({isClockwise ? "по часовой / CW" : "против часовой / CCW"}) [Space — инверт]
            </span>
          );
        })()}
      </div>
    </div>
  );
};
