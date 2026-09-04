import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BoardData,
  BoardSelectionTarget,
  ComponentItem,
  ComponentType,
  LayerImageItem,
  Pin,
  normalizeBoardData,
} from "../../types/project";
import { SvgComponent } from "../SvgRenderer/SvgComponents";
import {
  Image as ImageIcon,
  Cpu,
  Plus,
  Ruler,
  RotateCw,
  FlipHorizontal,
  Lock,
  Unlock,
  Check,
  X,
} from "lucide-react";

interface BoardCanvasProps {
  boardData: BoardData;
  onChangeBoardData: (updated: BoardData) => void;
  activeNetId?: string;
  onSelectComponent: (id: string | undefined) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
  onSelectTarget?: (target: BoardSelectionTarget) => void;
}

interface CalibrationState {
  active: boolean;
  step: 1 | 2;
  pt1?: { x: number; y: number };
  pt2?: { x: number; y: number };
  cursorPos?: { x: number; y: number };
  measuredPx?: number;
  layerKey?: "bgTop" | "bgBottom";
  imageId?: string;
  realMm: string;
  showModal: boolean;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 250, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Component Dragging
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [compDragOffset, setCompDragOffset] = useState({ x: 0, y: 0 });

  // Image Dragging
  const [draggingImage, setDraggingImage] = useState<{
    layerKey: "bgTop" | "bgBottom";
    id: string;
    origX: number;
    origY: number;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);

  // 2-Point Calibration Tool State
  const [calibration, setCalibration] = useState<CalibrationState>({
    active: false,
    step: 1,
    realMm: "2.54",
    showModal: false,
  });

  // Current Mode: "images" | "components"
  const toolMode = boardData.activeToolMode || "images";

  const setToolMode = (mode: "images" | "components") => {
    onChangeBoardData({
      ...boardData,
      activeToolMode: mode,
    });
  };

  // Find active image if any
  const selectedTarget = boardData.selectedTarget;
  const isImageLayerSelected =
    selectedTarget?.type === "layer_bg_top" || selectedTarget?.type === "layer_bg_bottom";

  const activeLayerKey: "bgTop" | "bgBottom" =
    selectedTarget?.type === "layer_bg_bottom" ? "bgBottom" : "bgTop";
  const activeLayer = boardData[activeLayerKey];
  const activeImageId =
    (isImageLayerSelected ? selectedTarget?.imageId : undefined) ||
    activeLayer.activeImageId ||
    activeLayer.images[0]?.id;
  const activeImage = activeLayer.images.find((img) => img.id === activeImageId);

  // Helper to update active image
  const handleUpdateActiveImage = (updates: Partial<LayerImageItem>) => {
    if (!activeImage) return;
    const updatedImages = activeLayer.images.map((img) =>
      img.id === activeImage.id ? { ...img, ...updates } : img
    );
    onChangeBoardData({
      ...boardData,
      [activeLayerKey]: {
        ...activeLayer,
        images: updatedImages,
        image: updatedImages[0]?.src,
      },
    });
  };

  // Listen to custom calibration trigger from Inspector
  useEffect(() => {
    const handleCalibrationEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ layerKey: "bgTop" | "bgBottom"; imageId: string }>;
      setCalibration({
        active: true,
        step: 1,
        layerKey: customEvent.detail.layerKey,
        imageId: customEvent.detail.imageId,
        realMm: "2.54",
        showModal: false,
      });
      setToolMode("images");
    };

    window.addEventListener("mycad-start-calibration", handleCalibrationEvent);
    return () => window.removeEventListener("mycad-start-calibration", handleCalibrationEvent);
  }, [boardData]);

  // Zoom with Wheel
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

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      if (calibration.active) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;

        if (calibration.step === 1) {
          setCalibration((prev) => ({
            ...prev,
            step: 2,
            pt1: { x: svgX, y: svgY },
          }));
        } else if (calibration.step === 2 && calibration.pt1) {
          const pt2 = { x: svgX, y: svgY };
          const distPx = Math.hypot(pt2.x - calibration.pt1.x, pt2.y - calibration.pt1.y);
          setCalibration((prev) => ({
            ...prev,
            pt2,
            measuredPx: distPx,
            showModal: true,
          }));
        }
        return;
      }

      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });

      if (
        e.target === e.currentTarget ||
        (e.target as HTMLElement).tagName === "svg" ||
        (e.target as HTMLElement).id === "cad-bg-plane"
      ) {
        onSelectComponent(undefined);
        if (toolMode === "components") {
          onSelectTarget?.(null);
        }
      }
    }
  };

  // Component Drag Start
  const handleStartCompDrag = (e: React.MouseEvent, compId: string) => {
    e.stopPropagation();
    if (toolMode !== "components") return;

    const comp = boardData.components.find((c) => c.id === compId);
    if (!comp || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseSvgX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseSvgY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingCompId(compId);
    setCompDragOffset({
      x: mouseSvgX - comp.x,
      y: mouseSvgY - comp.y,
    });
  };

  // Image Drag Start
  const handleStartImageDrag = (
    e: React.MouseEvent,
    layerKey: "bgTop" | "bgBottom",
    image: LayerImageItem
  ) => {
    e.stopPropagation();
    if (toolMode !== "images" || calibration.active) return;

    // Select the image and target layer
    const targetType = layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom";
    onSelectTarget?.({ type: targetType, imageId: image.id });
    onChangeBoardData({
      ...boardData,
      [layerKey]: {
        ...boardData[layerKey],
        activeImageId: image.id,
      },
      selectedTarget: { type: targetType, imageId: image.id },
      selectedComponentId: undefined,
    });

    if (image.locked) return; // Do not drag locked image

    setDraggingImage({
      layerKey,
      id: image.id,
      origX: image.x,
      origY: image.y,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    });
  };

  // Global Mouse Move & Dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (calibration.active && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const svgX = (e.clientX - rect.left - pan.x) / zoom;
        const svgY = (e.clientY - rect.top - pan.y) / zoom;
        setCalibration((prev) => ({ ...prev, cursorPos: { x: svgX, y: svgY } }));
      }

      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (draggingCompId && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseSvgX = (e.clientX - rect.left - pan.x) / zoom;
        const mouseSvgY = (e.clientY - rect.top - pan.y) / zoom;

        const rawX = mouseSvgX - compDragOffset.x;
        const rawY = mouseSvgY - compDragOffset.y;
        const snappedX = Math.round(rawX / 5) * 5;
        const snappedY = Math.round(rawY / 5) * 5;

        const updatedComps = boardData.components.map((c) =>
          c.id === draggingCompId ? { ...c, x: snappedX, y: snappedY } : c
        );
        onChangeBoardData({ ...boardData, components: updatedComps });
      } else if (draggingImage) {
        const deltaX = (e.clientX - draggingImage.startMouseX) / zoom;
        const deltaY = (e.clientY - draggingImage.startMouseY) / zoom;

        const rawX = draggingImage.origX + deltaX;
        const rawY = draggingImage.origY + deltaY;
        const snappedX = Math.round(rawX);
        const snappedY = Math.round(rawY);

        const targetLayer = boardData[draggingImage.layerKey];
        const updatedImages = targetLayer.images.map((img) =>
          img.id === draggingImage.id ? { ...img, x: snappedX, y: snappedY } : img
        );

        onChangeBoardData({
          ...boardData,
          [draggingImage.layerKey]: {
            ...targetLayer,
            images: updatedImages,
          },
        });
      }
    },
    [
      isPanning,
      panStart,
      draggingCompId,
      compDragOffset,
      draggingImage,
      pan,
      zoom,
      boardData,
      onChangeBoardData,
      calibration.active,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingCompId(null);
    setDraggingImage(null);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Keyboard Nudge for Active Image & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "Escape") {
        if (calibration.active) {
          setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false });
        }
        return;
      }

      // Keyboard arrow keys for nudge active image
      if (toolMode === "images" && activeImage && !activeImage.locked) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleUpdateActiveImage({ x: activeImage.x - step });
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleUpdateActiveImage({ x: activeImage.x + step });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          handleUpdateActiveImage({ y: activeImage.y - step });
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          handleUpdateActiveImage({ y: activeImage.y + step });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toolMode, activeImage, calibration.active]);

  // Add Component Tool
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

  // Upload Images from Canvas Toolbar
  const handleCanvasAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let loadedCount = 0;
    const newItems: LayerImageItem[] = [];
    const isTop = activeLayerKey === "bgTop";

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        newItems.push({
          id: `img_${activeLayerKey}_${Date.now()}_${index}`,
          name: file.name.replace(/\.[^/.]+$/, "") || `Фото ${activeLayer.images.length + index + 1}`,
          src: reader.result as string,
          x: Math.round((-pan.x + 200) / zoom),
          y: Math.round((-pan.y + 150) / zoom),
          scale: 1,
          rotation: 0,
          opacity: 0.85,
          brightness: 100,
          contrast: 100,
          invert: false,
          mirrored: !isTop,
          flipV: false,
          locked: false,
          visible: true,
          order: activeLayer.images.length + index,
        });
        loadedCount++;
        if (loadedCount === files.length) {
          const combined = [...activeLayer.images, ...newItems];
          const newActiveId = newItems[newItems.length - 1].id;
          const targetType = activeLayerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom";
          onChangeBoardData({
            ...boardData,
            [activeLayerKey]: {
              ...activeLayer,
              images: combined,
              activeImageId: newActiveId,
              image: combined[0]?.src,
              visible: true,
            },
            selectedTarget: { type: targetType, imageId: newActiveId },
          });
          onSelectTarget?.({ type: targetType, imageId: newActiveId });
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Apply 2-Point Calibration
  const handleApplyCalibration = () => {
    const mm = parseFloat(calibration.realMm);
    if (isNaN(mm) || mm <= 0 || !calibration.measuredPx || !activeImage) {
      setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false });
      return;
    }

    // In our metric grid: 1 mm = 10 px
    const targetPx = mm * 10;
    const ratio = targetPx / calibration.measuredPx;
    const newScale = Math.round(activeImage.scale * ratio * 1000) / 1000;

    handleUpdateActiveImage({ scale: newScale });
    setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false });
  };

  const renderActiveNetLines = () => {
    if (!activeNetId) return null;

    const points: { x: number; y: number }[] = [];
    boardData.components.forEach((comp) => {
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

  const hasAnyImages =
    boardData.bgTop.images.length > 0 || boardData.bgBottom.images.length > 0;

  const visibleComponents = boardData.components.filter((c) => {
    const side = c.layer || "top";
    if (side === "top" && !boardData.showCompsTop) return false;
    if (side === "bottom" && !boardData.showCompsBottom) return false;
    return true;
  });

  return (
    <div
      ref={containerRef}
      className={`cad-canvas-container ${calibration.active ? "cursor-calibrating" : ""}`}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Hidden File Input for Canvas Toolbar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleCanvasAddImages}
      />

      {/* Floating Mode-Based CAD Canvas Toolbar */}
      <div className="cad-canvas-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        {/* Workspace Mode Switcher Tabs */}
        <div className="cad-toolbar-mode-tabs">
          <button
            className={`cad-mode-tab ${toolMode === "images" ? "active" : ""}`}
            onClick={() => {
              setToolMode("images");
              if (!isImageLayerSelected) {
                onSelectTarget?.({ type: "layer_bg_top", imageId: boardData.bgTop.images[0]?.id });
              }
            }}
            title="Слой: Подложка (сканы, фото, калибровка, совмещение)"
          >
            <ImageIcon size={13} />
            <span>Подложка</span>
          </button>
          <button
            className={`cad-mode-tab ${toolMode === "components" ? "active" : ""}`}
            onClick={() => {
              setToolMode("components");
              if (selectedTarget?.type !== "layer_comps_top" && selectedTarget?.type !== "layer_comps_bottom" && selectedTarget?.type !== "component") {
                onSelectTarget?.({ type: "layer_comps_top" });
              }
            }}
            title="Слой: Компоненты (монтаж деталей, расстановка, трассировка)"
          >
            <Cpu size={13} />
            <span>Компоненты</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* CONTEXTUAL TOOLBAR 1: Images & Reverse Engineering Mode */}
        {toolMode === "images" && (
          <div className="toolbar-section image-tools">
            <button
              className="cad-tool-btn primary"
              onClick={() => fileInputRef.current?.click()}
              title="Загрузить одно или несколько изображений на слой"
            >
              <Plus size={13} />
              <span>Добавить фото</span>
            </button>

            {/* Active Layer Indicator & Switch */}
            <div className="cad-layer-switch-pill">
              <button
                className={`pill-btn ${activeLayerKey === "bgTop" ? "active" : ""}`}
                onClick={() =>
                  onSelectTarget?.({
                    type: "layer_bg_top",
                    imageId: boardData.bgTop.activeImageId || boardData.bgTop.images[0]?.id,
                  })
                }
              >
                Top
              </button>
              <button
                className={`pill-btn ${activeLayerKey === "bgBottom" ? "active" : ""}`}
                onClick={() =>
                  onSelectTarget?.({
                    type: "layer_bg_bottom",
                    imageId: boardData.bgBottom.activeImageId || boardData.bgBottom.images[0]?.id,
                  })
                }
              >
                Bottom
              </button>
            </div>

            {/* Specialized Image Tools for Active Image */}
            {activeImage && (
              <>
                <div className="toolbar-divider" />

                {/* 2-Point Scale Calibration Button */}
                <button
                  className={`cad-tool-btn ${calibration.active ? "btn-active-highlight" : ""}`}
                  onClick={() =>
                    setCalibration({
                      active: !calibration.active,
                      step: 1,
                      realMm: "2.54",
                      showModal: false,
                    })
                  }
                  title="Калибровать масштаб: кликните 2 точки на холсте и укажите расстояние в мм"
                >
                  <Ruler size={13} />
                  <span>Калибровка 2 точки</span>
                </button>

                {/* Fine Angle Adjustments */}
                <div className="cad-tool-btn-group">
                  <button
                    className="cad-tool-btn"
                    onClick={() =>
                      handleUpdateActiveImage({
                        rotation: Math.round((activeImage.rotation - 0.1) * 10) / 10,
                      })
                    }
                    title="Повернуть на -0.1°"
                  >
                    -0.1°
                  </button>
                  <span className="angle-readout">{activeImage.rotation.toFixed(1)}°</span>
                  <button
                    className="cad-tool-btn"
                    onClick={() =>
                      handleUpdateActiveImage({
                        rotation: Math.round((activeImage.rotation + 0.1) * 10) / 10,
                      })
                    }
                    title="Повернуть на +0.1°"
                  >
                    +0.1°
                  </button>
                  <button
                    className="cad-tool-btn icon-only"
                    onClick={() =>
                      handleUpdateActiveImage({
                        rotation: (Math.round(activeImage.rotation) + 90) % 360,
                      })
                    }
                    title="Повернуть на 90°"
                  >
                    <RotateCw size={12} />
                  </button>
                </div>

                {/* Flip */}
                <button
                  className={`cad-tool-btn icon-only ${activeImage.mirrored ? "btn-active-highlight" : ""}`}
                  onClick={() =>
                    handleUpdateActiveImage({ mirrored: !activeImage.mirrored })
                  }
                  title="Отзеркалить по горизонтали (Flip X)"
                >
                  <FlipHorizontal size={13} />
                </button>

                {/* Lock Toggle */}
                <button
                  className={`cad-tool-btn icon-only ${activeImage.locked ? "btn-active-highlight" : ""}`}
                  onClick={() =>
                    handleUpdateActiveImage({ locked: !activeImage.locked })
                  }
                  title={activeImage.locked ? "Разблокировать" : "Заблокировать от сдвига"}
                >
                  {activeImage.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>

                {/* Opacity Slider */}
                <div className="toolbar-slider-group" title="Прозрачность активного фото">
                  <span>{Math.round(activeImage.opacity * 100)}%</span>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={activeImage.opacity}
                    onChange={(e) =>
                      handleUpdateActiveImage({ opacity: parseFloat(e.target.value) })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* CONTEXTUAL TOOLBAR 2: Mounting & Components Mode */}
        {toolMode === "components" && (
          <div className="toolbar-section comp-tools">
            {/* Active Component Side Indicator & Switch */}
            <div className="cad-layer-switch-pill" title="Сторона монтажа: Лицевая (Top) / Обратная (Bottom)">
              <button
                className={`pill-btn ${boardData.activeSideView !== "bottom" ? "active" : ""}`}
                onClick={() => {
                  onChangeBoardData({ ...boardData, activeSideView: "top" });
                  onSelectTarget?.({ type: "layer_comps_top" });
                }}
              >
                Top
              </button>
              <button
                className={`pill-btn ${boardData.activeSideView === "bottom" ? "active" : ""}`}
                onClick={() => {
                  onChangeBoardData({ ...boardData, activeSideView: "bottom" });
                  onSelectTarget?.({ type: "layer_comps_bottom" });
                }}
              >
                Bottom
              </button>
            </div>

            <div className="toolbar-divider" />

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
        )}

        <div className="toolbar-divider" />

        {/* Zoom & View Controls */}
        <div className="toolbar-section zoom-tools">
          <button
            className="cad-tool-btn icon-only"
            onClick={() => setZoom((z) => Math.min(z * 1.25, 10))}
            title="Приблизить"
          >
            +
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          <button
            className="cad-tool-btn icon-only"
            onClick={() => setZoom((z) => Math.max(z / 1.25, 0.15))}
            title="Отдалить"
          >
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

      {/* Floating Interactive Calibration Banner */}
      {calibration.active && (
        <div className="cad-calibration-banner" onMouseDown={(e) => e.stopPropagation()}>
          <div className="banner-content">
            <Ruler size={16} className="banner-icon" />
            <div className="banner-text">
              <strong>Калибровка масштаба по 2 точкам</strong>
              <span>
                {calibration.step === 1
                  ? "Кликните Точку 1 на изображении (первый вывод микросхемы или отметку)"
                  : "Кликните Точку 2 (соседний вывод или известное расстояние)"}
              </span>
            </div>
          </div>
          <button
            className="cad-btn-flat btn-xs"
            onClick={() => setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false })}
          >
            Отмена (Esc)
          </button>
        </div>
      )}

      {/* Calibration Input Modal */}
      {calibration.showModal && calibration.measuredPx && (
        <div className="cad-modal-backdrop" onClick={() => setCalibration((prev) => ({ ...prev, showModal: false }))}>
          <div className="cad-dialog cad-calib-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cad-dialog-header">
              <div className="dialog-title-wrap">
                <Ruler size={18} />
                <h3>Калибровка масштаба изображения</h3>
              </div>
              <button
                className="cad-dialog-close"
                onClick={() => setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false })}
              >
                <X size={15} />
              </button>
            </div>

            <div className="cad-dialog-body">
              <div className="calib-stats">
                <span>Измеренное расстояние на холсте:</span>
                <strong>{calibration.measuredPx.toFixed(1)} px</strong>
              </div>

              <div className="cad-field-group">
                <label>Реальное физическое расстояние (мм):</label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  className="cad-field-input"
                  value={calibration.realMm}
                  onChange={(e) => setCalibration((prev) => ({ ...prev, realMm: e.target.value }))}
                />
              </div>

              <div className="calib-presets">
                <span className="preset-label">Быстрый выбор:</span>
                <div className="preset-chips">
                  <button onClick={() => setCalibration((p) => ({ ...p, realMm: "2.54" }))}>
                    2.54 мм (DIP/SOIC)
                  </button>
                  <button onClick={() => setCalibration((p) => ({ ...p, realMm: "1.27" }))}>
                    1.27 мм (SOIC pin)
                  </button>
                  <button onClick={() => setCalibration((p) => ({ ...p, realMm: "10.0" }))}>
                    10.0 мм (линейка)
                  </button>
                  <button onClick={() => setCalibration((p) => ({ ...p, realMm: "50.0" }))}>
                    50.0 мм
                  </button>
                </div>
              </div>
            </div>

            <div className="cad-dialog-footer">
              <button
                className="cad-btn-flat"
                onClick={() => setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false })}
              >
                Отмена
              </button>
              <button className="cad-btn-primary" onClick={handleApplyCalibration}>
                <Check size={14} />
                <span>Применить масштаб</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

          {/* Layer 1: Bottom Images (solder side) */}
          {boardData.bgBottom.visible &&
            boardData.bgBottom.images.map((img) => {
              if (!img.visible) return null;
              const isSelected =
                toolMode === "images" &&
                activeLayerKey === "bgBottom" &&
                activeImage?.id === img.id;

              return (
                <g
                  key={img.id}
                  id={`cad-img-${img.id}`}
                  transform={`translate(${img.x}, ${img.y}) rotate(${img.rotation}) scale(${
                    img.mirrored ? -img.scale : img.scale
                  }, ${img.flipV ? -img.scale : img.scale})`}
                  style={{
                    filter: `brightness(${img.brightness}%) contrast(${img.contrast}%) ${
                      img.invert ? "invert(1)" : ""
                    }`,
                    opacity: img.opacity,
                    cursor: toolMode === "images" ? (img.locked ? "not-allowed" : "move") : "default",
                  }}
                  onMouseDown={(e) => handleStartImageDrag(e, "bgBottom", img)}
                >
                  <image href={img.src} x={0} y={0} />
                  {isSelected && (
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4 4"
                    />
                  )}
                </g>
              );
            })}

          {/* Layer 2: Top Images (component side) */}
          {boardData.bgTop.visible &&
            boardData.bgTop.images.map((img) => {
              if (!img.visible) return null;
              const isSelected =
                toolMode === "images" &&
                activeLayerKey === "bgTop" &&
                activeImage?.id === img.id;

              return (
                <g
                  key={img.id}
                  id={`cad-img-${img.id}`}
                  transform={`translate(${img.x}, ${img.y}) rotate(${img.rotation}) scale(${
                    img.mirrored ? -img.scale : img.scale
                  }, ${img.flipV ? -img.scale : img.scale})`}
                  style={{
                    filter: `brightness(${img.brightness}%) contrast(${img.contrast}%) ${
                      img.invert ? "invert(1)" : ""
                    }`,
                    opacity: img.opacity,
                    cursor: toolMode === "images" ? (img.locked ? "not-allowed" : "move") : "default",
                  }}
                  onMouseDown={(e) => handleStartImageDrag(e, "bgTop", img)}
                >
                  <image href={img.src} x={0} y={0} />
                  {isSelected && (
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4 4"
                    />
                  )}
                </g>
              );
            })}

          {/* If no images loaded at all */}
          {!hasAnyImages && (
            <g transform="translate(0, 0)">
              <rect
                x="0"
                y="0"
                width="520"
                height="320"
                fill="rgba(15, 23, 42, 0.45)"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
                rx="6"
              />
              <text x="260" y="145" textAnchor="middle" fill="#94a3b8" fontSize="14" fontFamily="sans-serif">
                Подложки платы не загружены
              </text>
              <text x="260" y="172" textAnchor="middle" fill="#64748b" fontSize="12" fontFamily="sans-serif">
                Нажмите «+ Добавить фото» на панели сверху или выберите слой в дереве
              </text>
            </g>
          )}

          {/* Interactive Calibration Guide Lines & Points */}
          {calibration.active && (
            <g className="cad-calibration-overlay">
              {calibration.pt1 && (
                <g transform={`translate(${calibration.pt1.x}, ${calibration.pt1.y})`}>
                  <circle r={6 / zoom} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5 / zoom} />
                  <line x1={-12 / zoom} y1="0" x2={12 / zoom} y2="0" stroke="#ef4444" strokeWidth={1 / zoom} />
                  <line x1="0" y1={-12 / zoom} x2="0" y2={12 / zoom} stroke="#ef4444" strokeWidth={1 / zoom} />
                  <text y={-10 / zoom} textAnchor="middle" fill="#ef4444" fontSize={11 / zoom} fontWeight="bold">
                    Точка 1
                  </text>
                </g>
              )}

              {calibration.step === 2 && calibration.pt1 && calibration.cursorPos && (
                <line
                  x1={calibration.pt1.x}
                  y1={calibration.pt1.y}
                  x2={calibration.cursorPos.x}
                  y2={calibration.cursorPos.y}
                  stroke="#ef4444"
                  strokeWidth={1.5 / zoom}
                  strokeDasharray="4 4"
                />
              )}

              {calibration.pt2 && calibration.pt1 && (
                <>
                  <line
                    x1={calibration.pt1.x}
                    y1={calibration.pt1.y}
                    x2={calibration.pt2.x}
                    y2={calibration.pt2.y}
                    stroke="#ef4444"
                    strokeWidth={2 / zoom}
                  />
                  <g transform={`translate(${calibration.pt2.x}, ${calibration.pt2.y})`}>
                    <circle r={6 / zoom} fill="#22c55e" stroke="#ffffff" strokeWidth={1.5 / zoom} />
                    <line x1={-12 / zoom} y1="0" x2={12 / zoom} y2="0" stroke="#22c55e" strokeWidth={1 / zoom} />
                    <line x1="0" y1={-12 / zoom} x2="0" y2={12 / zoom} stroke="#22c55e" strokeWidth={1 / zoom} />
                    <text y={-10 / zoom} textAnchor="middle" fill="#22c55e" fontSize={11 / zoom} fontWeight="bold">
                      Точка 2
                    </text>
                  </g>
                </>
              )}
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
