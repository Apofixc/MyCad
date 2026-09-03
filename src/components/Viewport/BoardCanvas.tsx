import React, { useState, useRef, useEffect, useCallback } from "react";
import { BoardData, ComponentItem, ComponentType, Pin } from "../../types/project";
import { SvgComponent } from "../SvgRenderer/SvgComponents";

interface BoardCanvasProps {
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  activeNetId?: string;
  onSelectComponent: (id: string | undefined) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  boardData,
  onChangeBoardData,
  activeNetId,
  onSelectComponent,
  onSelectPin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onChangeBoardData({
        ...boardData,
        bgImage: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

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

    const newComp: ComponentItem = {
      id: `comp_${Date.now()}`,
      refDes,
      value,
      type,
      x: Math.round((-pan.x + 250) / zoom / 10) * 10,
      y: Math.round((-pan.y + 150) / zoom / 10) * 10,
      rotation: 0,
      pins,
    };

    onChangeBoardData({
      ...boardData,
      components: [...boardData.components, newComp],
      selectedComponentId: newComp.id,
    });
    onSelectComponent(newComp.id);
  };

  const renderActiveNetLines = () => {
    if (!activeNetId) return null;

    const points: { x: number; y: number }[] = [];
    boardData.components.forEach((comp) => {
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
        <div className="toolbar-section">
          <button
            className="cad-tool-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Загрузить монтажную схему или фото платы"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>Монтажная схема</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileUpload}
          />

          {boardData.bgImage && (
            <div className="toolbar-slider-group">
              <span className="slider-label">Фон:</span>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={boardData.bgOpacity}
                onChange={(e) =>
                  onChangeBoardData({
                    ...boardData,
                    bgOpacity: parseFloat(e.target.value),
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

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

          {/* Background Scheme / Board Photo */}
          {boardData.bgImage ? (
            <image
              href={boardData.bgImage}
              x={boardData.bgOffsetX}
              y={boardData.bgOffsetY}
              opacity={boardData.bgOpacity}
              style={{ pointerEvents: "none" }}
            />
          ) : (
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
                Монтажная схема не загружена
              </text>
              <text x="250" y="175" textAnchor="middle" fill="#475569" fontSize="11" fontFamily="sans-serif">
                Нажмите «Монтажная схема» на панели выше для выбора изображения
              </text>
            </g>
          )}

          {/* Active Net Connection Lines */}
          {renderActiveNetLines()}

          {/* SVG Footprints Layer */}
          {boardData.components.map((comp) => (
            <SvgComponent
              key={comp.id}
              component={comp}
              isSelected={boardData.selectedComponentId === comp.id}
              selectedPinId={boardData.selectedPinId}
              activeNetId={activeNetId}
              onSelectComponent={onSelectComponent}
              onSelectPin={onSelectPin}
              onStartDrag={handleStartCompDrag}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
