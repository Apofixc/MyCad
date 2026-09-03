import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BoardData,
  BoardSelectionTarget,
  ComponentItem,
  ComponentType,
  Pin,
  normalizeBoardData,
} from "../../types/project";
import { SvgComponent } from "../SvgRenderer/SvgComponents";

interface BoardCanvasProps {
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  activeNetId?: string;
  onSelectComponent: (id: string | undefined) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
  onSelectTarget?: (target: BoardSelectionTarget) => void;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  boardData: rawBoardData,
  onChangeBoardData,
  activeNetId,
  onSelectComponent,
  onSelectPin,
  onSelectTarget,
}) => {
  const boardData = normalizeBoardData(rawBoardData);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 250, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.15), 10);

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (
        e.target === e.currentTarget ||
        (e.target as HTMLElement).tagName === "svg" ||
        (e.target as HTMLElement).id === "cad-bg-plane"
      ) {
        onSelectComponent(undefined);
        onSelectTarget?.(null);
      }
    }
  };

  const handleStartCompDrag = (e: React.MouseEvent, compId: string) => {
    e.stopPropagation();
    const comp = boardData.components.find((c) => c.id === compId);
    if (!comp || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseSvgX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseSvgY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingCompId(compId);
    setDragOffset({
      x: mouseSvgX - comp.x,
      y: mouseSvgY - comp.y,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (draggingCompId && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseSvgX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseSvgY = (e.clientY - rect.top - pan.y) / zoom;

        const rawX = mouseSvgX - dragOffset.x;
        const rawY = mouseSvgY - dragOffset.y;
        const snappedX = Math.round(rawX / 5) * 5;
        const snappedY = Math.round(rawY / 5) * 5;

        const updatedComps = boardData.components.map((c) =>
          c.id === draggingCompId ? { ...c, x: snappedX, y: snappedY } : c
        );
        onChangeBoardData({ ...boardData, components: updatedComps });
      }
    },
    [isPanning, panStart, draggingCompId, dragOffset, pan, zoom, boardData, onChangeBoardData]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingCompId(null);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);


  const handleAddComponent = (type: ComponentType) => {
    const count = boardData.components.filter((c) => c.type === type).length + 1;
    let refDes = "";
    let value = "";
    let pins: Pin[] = [];

    if (type === "resistor") {
      refDes = `R${count}`;
      value = "10k";
      pins = [
        { id: "p1", number: 1, x: -16, y: 0 },
        { id: "p2", number: 2, x: 16, y: 0 },
      ];
    } else if (type === "capacitor") {
      refDes = `C${count}`;
      value = "100nF";
      pins = [
        { id: "p1", number: 1, x: -16, y: 0 },
        { id: "p2", number: 2, x: 16, y: 0 },
      ];
    } else if (type === "diode") {
      refDes = `VD${count}`;
      value = "1N4148";
      pins = [
        { id: "p1", number: 1, x: -18, y: 0 },
        { id: "p2", number: 2, x: 18, y: 0 },
      ];
    } else if (type === "ic_soic8") {
      refDes = `U${count}`;
      value = "SOIC-8";
      pins = [
        { id: "p1", number: 1, x: -24, y: -18 },
        { id: "p2", number: 2, x: -24, y: -6 },
        { id: "p3", number: 3, x: -24, y: 6 },
        { id: "p4", number: 4, x: -24, y: 18 },
        { id: "p5", number: 5, x: 24, y: 18 },
        { id: "p6", number: 6, x: 24, y: 6 },
        { id: "p7", number: 7, x: 24, y: -6 },
        { id: "p8", number: 8, x: 24, y: -18 },
      ];
    } else if (type === "testpoint") {
      refDes = `TP${count}`;
      value = "GND";
      pins = [{ id: "p1", number: 1, x: 0, y: 0, netId: "GND" }];
    }

    const currentSide = boardData.activeSideView === "bottom" ? "bottom" : "top";

    const newComp: ComponentItem = {
      id: `comp_${Date.now()}`,
      refDes,
      value,
      type,
      x: Math.round((-pan.x + 250) / zoom / 10) * 10,
      y: Math.round((-pan.y + 150) / zoom / 10) * 10,
      rotation: 0,
      layer: currentSide,
      pins,
    };

    onChangeBoardData({
      ...boardData,
      components: [...boardData.components, newComp],
      selectedComponentId: newComp.id,
      selectedTarget: { type: "component", id: newComp.id },
    });
    onSelectComponent(newComp.id);
    onSelectTarget?.({ type: "component", id: newComp.id });
  };

  const renderActiveNetLines = () => {
    if (!activeNetId) return null;

    const points: { x: number; y: number }[] = [];
    boardData.components.forEach((comp) => {
      // Only draw lines if component is currently visible
      const side = comp.layer || "top";
      if (side === "top" && !boardData.showCompsTop) return;
      if (side === "bottom" && !boardData.showCompsBottom) return;

      comp.pins.forEach((pin) => {
        if (pin.netId === activeNetId) {
          const rad = (comp.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const absX = comp.x + pin.x * cos - pin.y * sin;
          const absY = comp.y + pin.x * sin + pin.y * cos;
          points.push({ x: absX, y: absY });
        }
      });
    });

    if (points.length < 2) return null;

    return (
      <g className="cad-net-lines">
        {points.slice(1).map((pt, idx) => (
          <line
            key={`net_${idx}`}
            x1={points[0].x}
            y1={points[0].y}
            x2={pt.x}
            y2={pt.y}
            stroke="#00f0ff"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.8"
          />
        ))}
      </g>
    );
  };

  const hasAnyBackground = boardData.bgTop.image || boardData.bgBottom.image;

  // Filter visible components
  const visibleComponents = boardData.components.filter((c) => {
    const side = c.layer || "top";
    if (side === "top" && !boardData.showCompsTop) return false;
    if (side === "bottom" && !boardData.showCompsBottom) return false;
    return true;
  });

  return (
    <div
      ref={containerRef}
      className="cad-canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sleek Integrated Toolbar */}
      <div className="cad-canvas-toolbar" onMouseDown={(e) => e.stopPropagation()}>

        {/* Add Component Tools */}
        <div className="toolbar-section comp-tools">
          <span className="section-label">Добавить:</span>
          <button className="cad-tool-btn" onClick={() => handleAddComponent("resistor")} title="Резистор">
            R
          </button>
          <button className="cad-tool-btn" onClick={() => handleAddComponent("capacitor")} title="Конденсатор">
            C
          </button>
          <button className="cad-tool-btn" onClick={() => handleAddComponent("diode")} title="Диод">
            D
          </button>
          <button className="cad-tool-btn" onClick={() => handleAddComponent("ic_soic8")} title="Микросхема SOIC-8">
            SOIC-8
          </button>
          <button className="cad-tool-btn" onClick={() => handleAddComponent("testpoint")} title="Тестпоинт">
            TP
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Zoom & View Controls */}
        <div className="toolbar-section zoom-tools">
          <button className="cad-tool-btn icon-only" onClick={() => setZoom((z) => Math.min(z * 1.25, 10))} title="Приблизить">
            +
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          <button className="cad-tool-btn icon-only" onClick={() => setZoom((z) => Math.max(z / 1.25, 0.15))} title="Отдалить">
            −
          </button>
          <button
            className="cad-tool-btn"
            onClick={() => {
              setZoom(1);
              setPan({ x: 250, y: 200 });
            }}
            title="Сбросить масштаб"
          >
            1:1
          </button>
        </div>
      </div>

      {/* SVG Viewport */}
      <svg className="cad-svg-canvas" width="100%" height="100%">
        <defs>
          <pattern id="cad-grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.75" fill="rgba(148, 163, 184, 0.15)" />
          </pattern>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background Grid */}
          <rect
            id="cad-bg-plane"
            x="-10000"
            y="-10000"
            width="20000"
            height="20000"
            fill="url(#cad-grid-pattern)"
          />

          {/* Layer 1: Background Bottom (solder side) */}
          {boardData.bgBottom.visible && boardData.bgBottom.image && (
            <g
              id="cad-bg-bottom-group"
              transform={`translate(${boardData.bgBottom.offsetX}, ${boardData.bgBottom.offsetY}) scale(${
                boardData.bgBottom.mirrored ? -boardData.bgBottom.scale : boardData.bgBottom.scale
              }, ${boardData.bgBottom.scale})`}
              style={{
                filter: `brightness(${boardData.bgBottom.brightness}%) contrast(${boardData.bgBottom.contrast}%) ${
                  boardData.bgBottom.invert ? "invert(1)" : ""
                }`,
                opacity: boardData.bgBottom.opacity,
                pointerEvents: "none",
              }}
            >
              <image href={boardData.bgBottom.image} x={0} y={0} />
            </g>
          )}

          {/* Layer 2: Background Top (component side) */}
          {boardData.bgTop.visible && boardData.bgTop.image && (
            <g
              id="cad-bg-top-group"
              transform={`translate(${boardData.bgTop.offsetX}, ${boardData.bgTop.offsetY}) scale(${boardData.bgTop.scale})`}
              style={{
                filter: `brightness(${boardData.bgTop.brightness}%) contrast(${boardData.bgTop.contrast}%) ${
                  boardData.bgTop.invert ? "invert(1)" : ""
                }`,
                opacity: boardData.bgTop.opacity,
                pointerEvents: "none",
              }}
            >
              <image href={boardData.bgTop.image} x={0} y={0} />
            </g>
          )}

          {/* If no background is loaded at all */}
          {!hasAnyBackground && (
            <g transform="translate(0, 0)">
              <rect
                x="0"
                y="0"
                width="500"
                height="320"
                fill="rgba(15, 23, 42, 0.4)"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
                rx="4"
              />
              <text x="250" y="150" textAnchor="middle" fill="#64748b" fontSize="13" fontFamily="sans-serif">
                Подложки платы не загружены
              </text>
              <text x="250" y="175" textAnchor="middle" fill="#475569" fontSize="11" fontFamily="sans-serif">
                Кликните «Фон Top» или «Фон Bottom» в дереве слоев слева для загрузки изображения
              </text>
            </g>
          )}

          {/* Active Net Connection Lines */}
          {renderActiveNetLines()}

          {/* SVG Components Layer */}
          {visibleComponents.map((comp) => (
            <SvgComponent
              key={comp.id}
              component={comp}
              isSelected={boardData.selectedComponentId === comp.id}
              selectedPinId={boardData.selectedPinId}
              activeNetId={activeNetId}
              onSelectComponent={(id) => {
                onSelectComponent(id);
                if (id) {
                  onSelectTarget?.({ type: "component", id });
                } else {
                  onSelectTarget?.(null);
                }
              }}
              onSelectPin={onSelectPin}
              onStartDrag={handleStartCompDrag}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
