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
  openImageFileDialog,
  createLayerImageItemFromFile,
  extractImagesFromDrop,
  extractImageFromClipboard,
} from "../../utils/imageLoader";
import {
  Plus,
  Ruler,
  Check,
  X,
  Image as ImageIcon,
  Maximize2,
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
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 250, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [cursorCadPos, setCursorCadPos] = useState({ x: 0, y: 0 });

  // Component Dragging
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [compDragOffset, setCompDragOffset] = useState({ x: 0, y: 0 });

  // Image Dragging (High performance rAF-based local drag)
  const [draggingImage, setDraggingImage] = useState<{
    layerKey: "bgTop" | "bgBottom";
    id: string;
    origX: number;
    origY: number;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);
  const [imageDragDelta, setImageDragDelta] = useState<{ dx: number; dy: number } | null>(null);
  const dragDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const draggingImageRef = useRef<{
    layerKey: "bgTop" | "bgBottom";
    id: string;
    origX: number;
    origY: number;
    startMouseX: number;
    startMouseY: number;
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // 2-Point Calibration Tool State
  const [calibration, setCalibration] = useState<CalibrationState>({
    active: false,
    step: 1,
    realMm: "2.54",
    showModal: false,
  });

  // Find active image if any
  const selectedTarget = boardData.selectedTarget;
  const isImageLayerSelected =
    selectedTarget?.type === "layer_bg_top" || selectedTarget?.type === "layer_bg_bottom";
  const isCompLayerSelected =
    selectedTarget?.type === "layer_comps_top" ||
    selectedTarget?.type === "layer_comps_bottom" ||
    selectedTarget?.type === "component";

  // Current Mode: strictly derived from target and activeToolMode
  const toolMode: "images" | "components" = isCompLayerSelected
    ? "components"
    : isImageLayerSelected
    ? "images"
    : boardData.activeToolMode || "images";

  const setToolMode = (mode: "images" | "components") => {
    onChangeBoardData({
      ...boardData,
      activeToolMode: mode,
    });
  };

  const activeLayerKey: "bgTop" | "bgBottom" =
    selectedTarget?.type === "layer_bg_bottom" ? "bgBottom" : "bgTop";
  const activeLayer = boardData[activeLayerKey];
  const activeImageId =
    (isImageLayerSelected ? selectedTarget?.imageId : undefined) ||
    activeLayer.activeImageId ||
    activeLayer.images[0]?.id;
  const activeImage = activeLayer.images.find((img) => img.id === activeImageId);

  const selectedCompId = selectedTarget?.type === "component" ? selectedTarget.id : undefined;
  const selectedComp = boardData.components.find((c) => c.id === selectedCompId);

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

  // Listen to custom calibration trigger from Inspector and image focus trigger from tree
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

    const handleFocusImageEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ layerKey?: "bgTop" | "bgBottom"; imageId: string }>;
      const imageId = customEvent.detail?.imageId;
      if (!imageId || !containerRef.current) return;

      const allImages = [...boardData.bgTop.images, ...boardData.bgBottom.images];
      const img = allImages.find((i) => i.id === imageId);
      if (!img) return;

      const rect = containerRef.current.getBoundingClientRect();
      const viewportW = rect.width || 800;
      const viewportH = rect.height || 600;

      const w = (img.width || 800) * (img.scale || 1);
      const h = (img.height || 600) * (img.scale || 1);
      const minX = img.x;
      const minY = img.y;
      const maxX = img.x + w;
      const maxY = img.y + h;

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const padding = 60;

      const scaleX = (viewportW - padding * 2) / Math.max(contentW, 100);
      const scaleY = (viewportH - padding * 2) / Math.max(contentH, 100);
      const newZ = Math.min(Math.max(Math.min(scaleX, scaleY), 0.04), 4);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const newPanX = Math.round(viewportW / 2 - centerX * newZ);
      const newPanY = Math.round(viewportH / 2 - centerY * newZ);

      setZoom(newZ);
      setPan({ x: newPanX, y: newPanY });
      setToolMode("images");
    };

    window.addEventListener("mycad-start-calibration", handleCalibrationEvent);
    window.addEventListener("mycad-focus-image", handleFocusImageEvent);
    return () => {
      window.removeEventListener("mycad-start-calibration", handleCalibrationEvent);
      window.removeEventListener("mycad-focus-image", handleFocusImageEvent);
    };
  }, [boardData]);

  // Fit all items (images + components) nicely inside viewport
  const handleFitAll = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportW = rect.width || 800;
    const viewportH = rect.height || 600;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Scan all images in active layers
    const allImages = [...boardData.bgTop.images, ...boardData.bgBottom.images];
    allImages.forEach((img) => {
      if (!img.visible) return;
      const w = (img.width || 800) * (img.scale || 1);
      const h = (img.height || 600) * (img.scale || 1);
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + w);
      maxY = Math.max(maxY, img.y + h);
    });

    // Scan all components
    boardData.components.forEach((comp) => {
      minX = Math.min(minX, comp.x - 30);
      minY = Math.min(minY, comp.y - 30);
      maxX = Math.max(maxX, comp.x + 30);
      maxY = Math.max(maxY, comp.y + 30);
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      setZoom(1);
      setPan({ x: Math.round(viewportW / 2 - 200), y: Math.round(viewportH / 2 - 150) });
      return;
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 60; // px margin

    const scaleX = (viewportW - padding * 2) / Math.max(contentW, 100);
    const scaleY = (viewportH - padding * 2) / Math.max(contentH, 100);
    const newZ = Math.min(Math.max(Math.min(scaleX, scaleY), 0.02), 5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newPanX = Math.round(viewportW / 2 - centerX * newZ);
    const newPanY = Math.round(viewportH / 2 - centerY * newZ);

    setZoom(newZ);
    setPan({ x: newPanX, y: newPanY });
  }, [boardData]);

  // Zoom with Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Shift + Wheel = Horizontal pan
    if (e.shiftKey) {
      setPan((p) => ({ ...p, x: p.x - e.deltaY }));
      return;
    }

    // Alt + Wheel = Vertical pan
    if (e.altKey) {
      setPan((p) => ({ ...p, y: p.y - e.deltaY }));
      return;
    }

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    // Allow zooming out down to 0.02 (2%) and in up to 30.0 (3000%)
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.02), 30);

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Canvas Mouse Down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
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

    // Middle click (wheel) or Right click or Space+click -> Always pan canvas
    if (e.button === 1 || e.button === 2 || isSpacePressed) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Left click on background
    if (e.button === 0) {
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

  // Component Drag Start
  const handleStartCompDrag = (e: React.MouseEvent, compId: string) => {
    if (e.button !== 0 || isSpacePressed) return;
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
    if (e.button !== 0 || isSpacePressed) return;
    e.stopPropagation();
    e.preventDefault();
    if (toolMode !== "images" || calibration.active) return;

    // Select the image and target layer
    const targetType = layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom";
    const isTargetSame =
      boardData[layerKey].activeImageId === image.id &&
      boardData.selectedTarget?.type === targetType &&
      (boardData.selectedTarget as any).imageId === image.id;

    if (!isTargetSame) {
      onChangeBoardData({
        ...boardData,
        [layerKey]: {
          ...boardData[layerKey],
          activeImageId: image.id,
        },
        selectedTarget: { type: targetType, imageId: image.id },
        selectedComponentId: undefined,
      });
    }

    if (image.locked) return; // Do not drag locked image

    const dragInfo = {
      layerKey,
      id: image.id,
      origX: image.x,
      origY: image.y,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };
    draggingImageRef.current = dragInfo;
    dragDeltaRef.current = { dx: 0, dy: 0 };
    setDraggingImage(dragInfo);
    setImageDragDelta({ dx: 0, dy: 0 });
  };

  // Global Mouse Move & Dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const svgX = Math.round((e.clientX - rect.left - pan.x) / zoom);
        const svgY = Math.round((e.clientY - rect.top - pan.y) / zoom);
        setCursorCadPos({ x: svgX, y: svgY });
        if (calibration.active) {
          setCalibration((prev) => ({ ...prev, cursorPos: { x: svgX, y: svgY } }));
        }
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
      } else if (draggingImageRef.current) {
        const dImg = draggingImageRef.current;
        const deltaX = (e.clientX - dImg.startMouseX) / zoom;
        const deltaY = (e.clientY - dImg.startMouseY) / zoom;
        const dx = Math.round(deltaX);
        const dy = Math.round(deltaY);

        dragDeltaRef.current = { dx, dy };

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            setImageDragDelta(dragDeltaRef.current);
            rafIdRef.current = null;
          });
        }
      }
    },
    [
      isPanning,
      panStart,
      draggingCompId,
      compDragOffset,
      pan,
      zoom,
      boardData,
      onChangeBoardData,
      calibration.active,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    setIsPanning(false);
    setDraggingCompId(null);

    const dImg = draggingImageRef.current;
    if (dImg) {
      const { dx, dy } = dragDeltaRef.current;
      if (dx !== 0 || dy !== 0) {
        const targetLayer = boardData[dImg.layerKey];
        const snappedX = Math.round(dImg.origX + dx);
        const snappedY = Math.round(dImg.origY + dy);
        const updatedImages = targetLayer.images.map((img) =>
          img.id === dImg.id ? { ...img, x: snappedX, y: snappedY } : img
        );

        onChangeBoardData({
          ...boardData,
          [dImg.layerKey]: {
            ...targetLayer,
            images: updatedImages,
          },
        });
      }
      draggingImageRef.current = null;
      setDraggingImage(null);
      setImageDragDelta(null);
      dragDeltaRef.current = { dx: 0, dy: 0 };
    }
  }, [boardData, onChangeBoardData]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Keyboard Shortcuts & Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      }

      if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А" || e.key === "Home") {
        e.preventDefault();
        handleFitAll();
        return;
      }

      if (e.key === "1" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setZoom(1);
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(z * 1.25, 30));
        return;
      }

      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(z / 1.25, 0.02));
        return;
      }

      if (e.key === "Escape") {
        if (calibration.active) {
          setCalibration({ active: false, step: 1, realMm: "2.54", showModal: false });
        } else {
          onSelectComponent(undefined);
          onSelectTarget?.(null);
        }
        return;
      }

      // Delete key for selected component or active image
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;

        if (selectedComp) {
          e.preventDefault();
          const filtered = boardData.components.filter((c) => c.id !== selectedComp.id);
          onChangeBoardData({
            ...boardData,
            components: filtered,
            selectedComponentId: undefined,
            selectedPinId: undefined,
            selectedTarget: null,
          });
          return;
        }

        if (activeImage && !activeImage.locked && isImageLayerSelected && selectedTarget?.imageId) {
          e.preventDefault();
          const images = activeLayer.images || [];
          const filtered = images.filter((img) => img.id !== activeImage.id);
          onChangeBoardData({
            ...boardData,
            [activeLayerKey]: {
              ...activeLayer,
              images: filtered,
              activeImageId: undefined,
              image: filtered[0]?.src,
            },
            selectedTarget: null,
          });
          return;
        }
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
  }, [toolMode, activeImage, calibration.active, selectedComp, boardData, activeLayer, activeLayerKey, isImageLayerSelected, selectedTarget]);

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

  // Upload Images to Active Layer
  const handleAddImagesToLayer = async (
    files: File[],
    customPos?: { x: number; y: number }
  ) => {
    if (!files || files.length === 0) return;
    const isTop = activeLayerKey === "bgTop";
    const targetType = isTop ? "layer_bg_top" : "layer_bg_bottom";
    const newItems: LayerImageItem[] = [];

    const baseX = customPos ? customPos.x : Math.round((-pan.x + 200) / zoom);
    const baseY = customPos ? customPos.y : Math.round((-pan.y + 150) / zoom);

    for (let i = 0; i < files.length; i++) {
      const item = await createLayerImageItemFromFile(files[i], {
        isTop,
        defaultX: baseX + i * 30,
        defaultY: baseY + i * 30,
        order: activeLayer.images.length + i,
        index: i,
      });
      newItems.push(item);
    }

    if (newItems.length === 0) return;

    const combined = [...activeLayer.images, ...newItems];
    const newActiveId = newItems[newItems.length - 1].id;

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
  };

  // Paste from Clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const file = extractImageFromClipboard(e);
      if (file) {
        e.preventDefault();
        await handleAddImagesToLayer([file]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeLayerKey, activeLayer, pan, zoom, boardData]);

  // Keyboard Nudge (Arrows) and Delete for selected image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (toolMode === "images" && activeImage && !activeImage.locked) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;

        if (e.key === "ArrowUp") dy = -step;
        else if (e.key === "ArrowDown") dy = step;
        else if (e.key === "ArrowLeft") dx = -step;
        else if (e.key === "ArrowRight") dx = step;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          const targetLayer = boardData[activeLayerKey];
          const updated = targetLayer.images.map((img) =>
            img.id === activeImage.id ? { ...img, x: img.x + dx, y: img.y + dy } : img
          );
          onChangeBoardData({
            ...boardData,
            [activeLayerKey]: {
              ...targetLayer,
              images: updated,
            },
          });
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          const targetLayer = boardData[activeLayerKey];
          const remaining = targetLayer.images.filter((img) => img.id !== activeImage.id);
          const nextActiveId = remaining[0]?.id;
          const targetType = activeLayerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom";

          onChangeBoardData({
            ...boardData,
            [activeLayerKey]: {
              ...targetLayer,
              images: remaining,
              activeImageId: nextActiveId,
              image: remaining[0]?.src,
            },
            selectedTarget: nextActiveId ? { type: targetType, imageId: nextActiveId } : null,
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [toolMode, activeImage, activeLayerKey, boardData, handleFitAll]);

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

  const visibleComponents = boardData.components.filter((c) => {
    const side = c.layer || "top";
    if (side === "top" && !boardData.showCompsTop) return false;
    if (side === "bottom" && !boardData.showCompsBottom) return false;
    return true;
  });

  return (
    <div
      ref={containerRef}
      className={`cad-canvas-container ${isPanning ? "panning" : ""} ${
        isSpacePressed ? "space-pressed" : ""
      } ${toolMode === "components" ? "mode-components" : "mode-images"} ${
        draggingImage ? "image-dragging" : ""
      }`}
      style={{
        cursor: isPanning
          ? "grabbing"
          : isSpacePressed
          ? "grab"
          : draggingImage
          ? "grabbing"
          : calibration.active
          ? "crosshair"
          : "default",
        userSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCanvasDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCanvasDragOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCanvasDragOver(false);
        const files = extractImagesFromDrop(e);
        if (files.length > 0 && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const dropSvgX = Math.round((e.clientX - rect.left - pan.x) / zoom);
          const dropSvgY = Math.round((e.clientY - rect.top - pan.y) / zoom);
          await handleAddImagesToLayer(files, { x: dropSvgX, y: dropSvgY });
        }
      }}
    >
      {/* Visual Overlay during Drag and Drop */}
      {isCanvasDragOver && (
        <div className="cad-canvas-dragover-overlay">
          <ImageIcon size={48} className="dragover-icon" />
          <h3>Перетащите скан или фото платы сюда</h3>
          <p>
            Изображение будет добавлено на выбранную сторону (
            {activeLayerKey === "bgTop" ? "Top — Лицевая" : "Bottom — Обратная"})
          </p>
        </div>
      )}

      {/* Floating CAD Canvas Contextual Toolbar */}
      <div className="cad-canvas-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        {/* CONTEXTUAL TOOLBAR 1: Подложка (Фон / Фото) */}
        {toolMode === "images" && (
          <div className="toolbar-section image-tools">
            <button
              className="cad-tool-btn primary"
              onClick={async () => {
                const files = await openImageFileDialog();
                if (files.length > 0) {
                  await handleAddImagesToLayer(files);
                }
              }}
              title="Загрузить фото или скан платы на выбранную сторону"
            >
              <Plus size={13} />
              <span>Добавить фото</span>
            </button>

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
              title="Калибровать масштаб: кликните 2 точки на холсте и укажите точное расстояние в мм"
            >
              <Ruler size={13} />
              <span>Калибровка (2 точки)</span>
            </button>
          </div>
        )}

        {/* CONTEXTUAL TOOLBAR 2: Компоненты (Монтаж деталей) */}
        {toolMode === "components" && (
          <div className="toolbar-section comp-tools">
            <span className="section-label">Добавить:</span>
            <button className="cad-tool-btn" onClick={() => handleAddComponent("resistor")} title="Резистор">
              + R
            </button>
            <button className="cad-tool-btn" onClick={() => handleAddComponent("capacitor")} title="Конденсатор">
              + C
            </button>
            <button className="cad-tool-btn" onClick={() => handleAddComponent("diode")} title="Диод">
              + D
            </button>
            <button className="cad-tool-btn" onClick={() => handleAddComponent("ic_soic8")} title="Микросхема SOIC-8">
              + SOIC-8
            </button>
            <button className="cad-tool-btn" onClick={() => handleAddComponent("testpoint")} title="Тестпоинт">
              + TP
            </button>
          </div>
        )}
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
          {/* Background Grid (Infinite Plane) */}
          <rect
            id="cad-bg-plane"
            x="-500000"
            y="-500000"
            width="1000000"
            height="1000000"
            fill="url(#cad-grid-pattern)"
          />

          {/* Render Helper for Image Layer */}
          {(() => {
            const renderImageItem = (layerKey: "bgTop" | "bgBottom", img: LayerImageItem) => {
              if (!img.visible) return null;
              const isSelected =
                toolMode === "images" &&
                activeLayerKey === layerKey &&
                activeImage?.id === img.id;

              const isBeingDragged =
                draggingImage?.id === img.id && imageDragDelta !== null;
              const posX = img.x + (isBeingDragged ? imageDragDelta.dx : 0);
              const posY = img.y + (isBeingDragged ? imageDragDelta.dy : 0);

              const w = img.width || 800;
              const h = img.height || 600;
              const strokeColor = layerKey === "bgTop" ? "#38bdf8" : "#60a5fa";

              return (
                <g
                  key={img.id}
                  id={`cad-img-${img.id}`}
                  transform={`translate(${posX}, ${posY}) rotate(${img.rotation}) scale(${
                    img.mirrored ? -img.scale : img.scale
                  }, ${img.flipV ? -img.scale : img.scale}) translate(${img.mirrored ? -w : 0}, ${
                    img.flipV ? -h : 0
                  })`}
                  style={{
                    filter: `brightness(${img.brightness}%) contrast(${img.contrast}%) ${
                      img.invert ? "invert(1)" : ""
                    }`,
                    opacity: img.opacity,
                    cursor: toolMode === "images" ? (img.locked ? "not-allowed" : isBeingDragged ? "grabbing" : "grab") : "default",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => handleStartImageDrag(e, layerKey, img)}
                >
                  <image
                    href={img.src}
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    preserveAspectRatio="none"
                    style={{ pointerEvents: "auto", userSelect: "none" }}
                  />
                  {isSelected && (
                    <g className="cad-img-selection-box" pointerEvents="none">
                      <rect
                        x={0}
                        y={0}
                        width={w}
                        height={h}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={1.5 / zoom}
                        strokeDasharray="6 3"
                      />
                      {/* Corner Handles - Crisp CAD style */}
                      <rect x={-4 / zoom} y={-4 / zoom} width={8 / zoom} height={8 / zoom} fill="#ffffff" stroke={strokeColor} strokeWidth={1.2 / zoom} />
                      <rect x={w - 4 / zoom} y={-4 / zoom} width={8 / zoom} height={8 / zoom} fill="#ffffff" stroke={strokeColor} strokeWidth={1.2 / zoom} />
                      <rect x={-4 / zoom} y={h - 4 / zoom} width={8 / zoom} height={8 / zoom} fill="#ffffff" stroke={strokeColor} strokeWidth={1.2 / zoom} />
                      <rect x={w - 4 / zoom} y={h - 4 / zoom} width={8 / zoom} height={8 / zoom} fill="#ffffff" stroke={strokeColor} strokeWidth={1.2 / zoom} />
                      {/* Center Crosshair */}
                      <line x1={w / 2 - 8 / zoom} y1={h / 2} x2={w / 2 + 8 / zoom} y2={h / 2} stroke={strokeColor} strokeWidth={1 / zoom} />
                      <line x1={w / 2} y1={h / 2 - 8 / zoom} x2={w / 2} y2={h / 2 + 8 / zoom} stroke={strokeColor} strokeWidth={1 / zoom} />
                    </g>
                  )}
                </g>
              );
            };

            return (
              <>
                {/* Layer 1: Bottom Images (solder side) */}
                {boardData.bgBottom.visible &&
                  boardData.bgBottom.images.map((img) => renderImageItem("bgBottom", img))}

                {/* Layer 2: Top Images (component side) */}
                {boardData.bgTop.visible &&
                  boardData.bgTop.images.map((img) => renderImageItem("bgTop", img))}
              </>
            );
          })()}

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

      {/* Bottom CAD Viewport Status Bar */}
      <div className="cad-canvas-status-bar" onMouseDown={(e) => e.stopPropagation()}>
        <div className="status-item">
          <span className="status-label">X:</span>
          <span className="status-val">{(cursorCadPos.x / 10).toFixed(1)} мм</span>
        </div>
        <div className="status-item">
          <span className="status-label">Y:</span>
          <span className="status-val">{(cursorCadPos.y / 10).toFixed(1)} мм</span>
        </div>
        <div className="status-divider" />
        <div className="status-item cad-status-zoom-group">
          <span className="status-label">Масштаб:</span>
          <button
            className="cad-status-zoom-btn"
            onClick={() => setZoom((z) => Math.max(z / 1.25, 0.02))}
            title="Отдалить (−)"
          >
            −
          </button>
          <span
            className="status-val zoom-interactive"
            onClick={() => setZoom(1)}
            title="Сбросить масштаб 100% (Горячая клавиша: 1)"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="cad-status-zoom-btn"
            onClick={() => setZoom((z) => Math.min(z * 1.25, 30))}
            title="Приблизить (+)"
          >
            +
          </button>
          <button
            className="cad-status-zoom-btn btn-action"
            onClick={handleFitAll}
            title="Вписать всё в экран (Горячая клавиша: F)"
          >
            <Maximize2 size={11} />
            <span>Вписать</span>
          </button>
        </div>
        <div className="status-divider" />
        <div className="status-hints">
          <span>Пробел + ЛКМ / Колёсико: Панорама</span>
          <span>•</span>
          <span>F: Вписать всё</span>
          <span>•</span>
          <span>Колёсико: Масштаб (2%–3000%)</span>
        </div>
      </div>
    </div>
  );
};
