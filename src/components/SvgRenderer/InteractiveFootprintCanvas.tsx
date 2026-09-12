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

export type EditorTool =
  | "select"
  | "pad"
  | "line"
  | "arc"
  | "d_shape"
  | "capsule"
  | "rect"
  | "circle"
  | "text"
  | "polygon"
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
  selectedGraphicId: string | null;
  newPadTemplate: {
    shape: PadShape;
    width: number;
    height: number;
    drillDiameter?: number;
    roundRadius?: number;
  };
  onPadsChange: (pads: PackagePad[]) => void;
  onGraphicsChange: (graphics: GraphicItem[]) => void;
  onSelectPad: (padNum: string | null) => void;
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
  selectedGraphicId,
  newPadTemplate,
  onPadsChange,
  onGraphicsChange,
  onSelectPad,
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
    setPolygonPoints([]);
    setMeasureDist(null);
  }, [activeTool]);

  const finishPolygon = () => {
    if (polygonPoints.length < 3) return;
    const item: GraphicItem = {
      kind: "polygon", id: crypto.randomUUID(), points: polygonPoints,
      strokeWidth: 0.15, layer: "top_fab", filled: false,
    };
    onGraphicsChange([...graphics, item]);
    onSelectGraphic(item.id);
    onSelectPad(null);
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
      if (!containerRef.current?.contains(document.activeElement)) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return;
      }

      // Пробел (Space): быстрый поворот на 90° выделенной площадки или шаблона при P
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (selectedPadNum) {
          onPadsChange(
            pads.map((p) => {
              if (p.padNum === selectedPadNum) {
                const cur = p.rotation || 0;
                return { ...p, rotation: (cur + 90) % 360 };
              }
              return p;
            })
          );
        } else if (activeTool === "pad") {
          onRotatePadTemplate?.();
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (onDeleteSelected) {
          e.preventDefault();
          onDeleteSelected();
        } else if (selectedPadNum) {
          e.preventDefault();
          onPadsChange(pads.filter((p) => p.padNum !== selectedPadNum));
          onSelectPad(null);
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
        setMeasureDist(null);
        onSelectPad(null);
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
      if (key === "v" || key === "м") onSetActiveTool?.("select");
      else if (key === "p" || key === "з") onSetActiveTool?.("pad");
      else if (key === "l" || key === "д") onSetActiveTool?.("line");
      else if (key === "r" || key === "к") onSetActiveTool?.("rect");
      else if (key === "c" || key === "с") onSetActiveTool?.("circle");
      else if (key === "m" || key === "ь") onSetActiveTool?.("measure");
      else if (key === "f") fitGeometry();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedPadNum,
    selectedGraphicId,
    activeTool,
    pads,
    graphics,
    onDeleteSelected,
    onPadsChange,
    onGraphicsChange,
    onSelectPad,
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
    // Панорамирование колесом мыши или с зажатым пробелом / Shift
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
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
      if (!drawStart) setDrawStart(snapped);
      else if (!arcStart) {
        if (Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y) > 0.001) setArcStart(snapped);
      } else {
        const item: GraphicItem = {
          kind: "arc", id: crypto.randomUUID(), cx: drawStart.x, cy: drawStart.y,
          radius: Math.hypot(arcStart.x - drawStart.x, arcStart.y - drawStart.y),
          startAngle: Math.atan2(arcStart.y - drawStart.y, arcStart.x - drawStart.x) * 180 / Math.PI,
          endAngle: Math.atan2(snapped.y - drawStart.y, snapped.x - drawStart.x) * 180 / Math.PI,
          strokeWidth: 0.15, layer: "top_silk",
        };
        onGraphicsChange([...graphics, item]);
        onSelectGraphic(item.id);
        onSelectPad(null);
        setDrawStart(null);
        setArcStart(null);
        onSetActiveTool?.("select");
      }
      return;
    }
    if (activeTool === "text") {
      const item: GraphicItem = {
        kind: "text", id: crypto.randomUUID(), x: snapped.x, y: snapped.y, text: "Текст",
        fontSize: 1, rotation: 0, align: "center", strokeWidth: 0.15, layer: "top_silk",
      };
      onGraphicsChange([...graphics, item]);
      onSelectGraphic(item.id);
      onSelectPad(null);
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
            id: `line_${Date.now()}`,
            x1: drawStart.x,
            y1: drawStart.y,
            x2: snapped.x,
            y2: snapped.y,
            strokeWidth: 0.15,
            layer: "top_silk",
          };
          onGraphicsChange([...graphics, newLine]);
          // Непрерывное рисование контура (полилиния): следующий отрезок начинается из конца текущего
          setDrawStart(snapped);
          return;
        } else if (activeTool === "rect") {
          const w = Math.abs(snapped.x - drawStart.x);
          const h = Math.abs(snapped.y - drawStart.y);
          if (w > 0.05 && h > 0.05) {
            const newRect: GraphicItem = {
              kind: "rect",
              id: `rect_${Date.now()}`,
              x: (drawStart.x + snapped.x) / 2,
              y: (drawStart.y + snapped.y) / 2,
              width: w,
              height: h,
              roundRadius: 0.2,
              rotation: 0,
              strokeWidth: 0.15,
              layer: "top_silk",
              filled: false,
            };
            onGraphicsChange([...graphics, newRect]);
          }
        } else if (activeTool === "circle") {
          const r = Math.hypot(snapped.x - drawStart.x, snapped.y - drawStart.y);
          if (r > 0.05) {
            const newCircle: GraphicItem = {
              kind: "circle",
              id: `circle_${Date.now()}`,
              cx: drawStart.x,
              cy: drawStart.y,
              radius: Math.round(r * 1000) / 1000,
              strokeWidth: 0.15,
              layer: "top_silk",
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

    if (activeTool === "d_shape") {
      const newD: GraphicItem = {
        kind: "d_shape",
        id: `dshape_${Date.now()}`,
        cx: snapped.x,
        cy: snapped.y,
        diameter: 5.0,
        cutDepth: 1.5,
        cutOrientation: "right",
        strokeWidth: 0.15,
        layer: "top_silk",
      };
      onGraphicsChange([...graphics, newD]);
      onSelectPad(null);
      onSelectGraphic(newD.id);
      onSetActiveTool?.("select");
      return;
    }

    if (activeTool === "capsule") {
      const newCap: GraphicItem = {
        kind: "capsule",
        id: `capsule_${Date.now()}`,
        cx: snapped.x,
        cy: snapped.y,
        width: 11.5,
        height: 4.8,
        rotation: 0,
        strokeWidth: 0.15,
        layer: "top_silk",
      };
      onGraphicsChange([...graphics, newCap]);
      onSelectPad(null);
      onSelectGraphic(newCap.id);
      onSetActiveTool?.("select");
      return;
    }

    if (activeTool === "select") {
      // Клик по пустому месту сбрасывает выделение
      onSelectPad(null);
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
              case "d_shape":
              case "capsule":
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
            : activeTool === "line" || activeTool === "rect" || activeTool === "measure"
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
            : activeTool === "arc" ? "Три клика: центр → начало дуги → конец по часовой стрелке."
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
          {/* Графические примитивы (линии, дуги, D-shape) */}
          {graphics.map((item) => {
            const isSelected = selectedGraphicId === item.id;
            const strokeColor = isSelected ? "#38bdf8" : "#f8fafc";
            const strokeWidth = item.strokeWidth || 0.15;
            const pointerStyle = {
              pointerEvents: "auto" as const,
              cursor: activeTool === "select" ? "move" : "pointer",
            };
            const handleGraphicMouseDown = (e: React.MouseEvent) => {
              if (activeTool === "select" && e.button === 0) {
                e.stopPropagation();
                onSelectGraphic(item.id);
                onSelectPad(null);
                setDraggingGraphicId(item.id);
                onInteractionStart?.();
                const world = screenToWorld(e.clientX, e.clientY);
                setGraphicDragOrigin({ x: snapCoord(world.x), y: snapCoord(world.y) });
              }
            };

            switch (item.kind) {
              case "line":
                return (
                  <line
                    key={item.id}
                    x1={item.x1}
                    y1={item.y1}
                    x2={item.x2}
                    y2={item.y2}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={pointerStyle}
                    onMouseDown={handleGraphicMouseDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectGraphic(item.id);
                      onSelectPad(null);
                    }}
                  />
                );
              case "d_shape":
                return (
                  <path
                    key={item.id}
                    d={getGraphicPath(item)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={pointerStyle}
                    onMouseDown={handleGraphicMouseDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectGraphic(item.id);
                      onSelectPad(null);
                    }}
                  />
                );
              case "capsule":
                return (
                  <path
                    key={item.id}
                    d={getCapsulePath(item.cx, item.cy, item.width, item.height)}
                    transform={`rotate(${item.rotation} ${item.cx} ${item.cy})`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={pointerStyle}
                    onMouseDown={handleGraphicMouseDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectGraphic(item.id);
                      onSelectPad(null);
                    }}
                  />
                );
              case "rect":
                return (
                  <rect
                    key={item.id}
                    x={item.x - item.width / 2}
                    y={item.y - item.height / 2}
                    width={item.width}
                    height={item.height}
                    rx={item.roundRadius}
                    transform={`rotate(${item.rotation} ${item.x} ${item.y})`}
                    fill={item.filled ? strokeColor : "none"}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={pointerStyle}
                    onMouseDown={handleGraphicMouseDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectGraphic(item.id);
                      onSelectPad(null);
                    }}
                  />
                );
              case "circle":
                return (
                  <circle
                    key={item.id}
                    cx={item.cx}
                    cy={item.cy}
                    r={item.radius}
                    fill={item.filled ? strokeColor : "none"}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    style={pointerStyle}
                    onMouseDown={handleGraphicMouseDown}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectGraphic(item.id);
                      onSelectPad(null);
                    }}
                  />
                );
              case "arc":
              case "polygon":
                return <path key={item.id} d={getGraphicPath(item)}
                  fill={item.kind === "polygon" && item.filled ? strokeColor : "none"}
                  stroke={strokeColor} strokeWidth={strokeWidth}
                  style={pointerStyle} onMouseDown={handleGraphicMouseDown} />;
              case "text":
                return <text key={item.id} x={item.x} y={item.y} fontSize={item.fontSize}
                  transform={`rotate(${item.rotation} ${item.x} ${item.y})`}
                  fill={strokeColor} textAnchor={item.align === "left" ? "start" : item.align === "right" ? "end" : "middle"}
                  dominantBaseline="central" style={pointerStyle} onMouseDown={handleGraphicMouseDown}>{item.text}</text>;
            }
          })}

          {/* Интерактивные контактные площадки (Pads) */}
          {pads.map((pad) => {
            const isSelected = selectedPadNum === pad.padNum;
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
                    onSelectPad(pad.padNum);
                    onSelectGraphic(null);
                    setDraggingPadNum(pad.padNum);
                    onInteractionStart?.();
                    const world = screenToWorld(e.clientX, e.clientY);
                    setDragOffset({ x: world.x - pad.x, y: world.y - pad.y });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPad(pad.padNum);
                  onSelectGraphic(null);
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

          {/* Резиновая нить / превью при черчении */}
          {polygonPoints.length > 0 && <polyline
            points={[...polygonPoints, [cursorPos.x, cursorPos.y]].map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none" stroke="#38bdf8" strokeWidth={0.15} strokeDasharray="0.3 0.2" pointerEvents="none" />}
          {drawStart && (
            <g pointerEvents="none">
              {activeTool === "arc" && (arcStart ? <path d={getArcPath({
                kind: "arc", id: "preview", layer: "top_silk", strokeWidth: 0.15,
                cx: drawStart.x, cy: drawStart.y,
                radius: Math.hypot(arcStart.x - drawStart.x, arcStart.y - drawStart.y),
                startAngle: Math.atan2(arcStart.y - drawStart.y, arcStart.x - drawStart.x) * 180 / Math.PI,
                endAngle: Math.atan2(cursorPos.y - drawStart.y, cursorPos.x - drawStart.x) * 180 / Math.PI,
              })} fill="none" stroke="#38bdf8" strokeWidth={0.15} />
                : <line x1={drawStart.x} y1={drawStart.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#38bdf8" strokeWidth={0.15} />)}
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
        {measureDist && (
          <span style={{ color: "#fbbf24", fontWeight: "bold" }}>
            L: {measureDist.dist.toFixed(3)} mm (dX: {measureDist.dx.toFixed(2)}, dY: {measureDist.dy.toFixed(2)})
          </span>
        )}
      </div>
    </div>
  );
};
