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
  createLayerImageItemFromDataUrl,
  readFileAsDataUrl,
  extractImagesFromDrop,
  extractImageFromClipboard,
  normalizeImageResolution,
} from "../../utils/imageLoader";
import {
  ImagePreprocessModal,
  ImagePreprocessResult,
} from "../Modals/ImagePreprocessModal";
import {
  Plus,
  Ruler,
  Check,
  X,
  Image as ImageIcon,
  Maximize2,
  Move,
  Compass,
  Columns2,
  ZoomIn,
  Target,
  DraftingCompass,
  Eye,
} from "lucide-react";
import { ImageTransformBox } from "./ImageTransformBox";
import { MeasureOverlay } from "./MeasureOverlay";
import { InteractiveCurtain } from "./InteractiveCurtain";
import { ScreenMagnifier } from "./ScreenMagnifier";
import {
  calculateCalibratedScale,
  calculate2PointRegistration,
  Point2D,
} from "../../utils/alignmentMath";

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
  const cursorXRef = useRef<HTMLSpanElement>(null);
  const cursorYRef = useRef<HTMLSpanElement>(null);

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

  // Active Image Tool (1 of 8 specialized CAD tools)
  type ActiveImageTool =
    | "transform"
    | "calibrate"
    | "level"
    | "register"
    | "curtain"
    | "measure"
    | "magnifier"
    | "blink"
    | null;

  const [activeImageTool, setActiveImageTool] = useState<ActiveImageTool>("transform");
  const [curtainSplitPercent, setCurtainSplitPercent] = useState<number>(50);
  const [blinkSide, setBlinkSide] = useState<"top" | "bottom">("top");
  const [registrationState, setRegistrationState] = useState<{
    step: 1 | 2;
    activeSide: "top" | "bottom";
    topPts: Point2D[];
    bottomPts: Point2D[];
  }>({ step: 1, activeSide: "top", topPts: [], bottomPts: [] });
  const [regCursorPos, setRegCursorPos] = useState<Point2D | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // 2-Point Calibration Tool State (legacy compatibility)
  const [calibration, setCalibration] = useState<CalibrationState>({
    active: false,
    step: 1,
    realMm: "2.54",
    showModal: false,
  });

  // Pending Image for Preprocessing Modal (Crop / Perspective)
  const [pendingPreprocess, setPendingPreprocess] = useState<{
    file?: File;
    dataUrl: string;
    name: string;
    customPos?: { x: number; y: number };
    replaceLayerKey?: "bgTop" | "bgBottom";
    replaceImageId?: string;
  } | null>(null);

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

    const handlePreprocessEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ layerKey: "bgTop" | "bgBottom"; imageId: string }>;
      const lk = customEvent.detail?.layerKey;
      const id = customEvent.detail?.imageId;
      if (!lk || !id) return;
      const targetLayer = boardData[lk];
      const targetItem = targetLayer.images.find((img) => img.id === id);
      if (targetItem) {
        setPendingPreprocess({
          dataUrl: targetItem.src,
          name: targetItem.name,
          replaceLayerKey: lk,
          replaceImageId: targetItem.id,
        });
      }
    };

    window.addEventListener("mycad-start-calibration", handleCalibrationEvent);
    window.addEventListener("mycad-focus-image", handleFocusImageEvent);
    window.addEventListener("mycad-preprocess-image", handlePreprocessEvent);
    return () => {
      window.removeEventListener("mycad-start-calibration", handleCalibrationEvent);
      window.removeEventListener("mycad-focus-image", handleFocusImageEvent);
      window.removeEventListener("mycad-preprocess-image", handlePreprocessEvent);
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
        if (cursorXRef.current) cursorXRef.current.textContent = `${(svgX / 10).toFixed(1)} мм`;
        if (cursorYRef.current) cursorYRef.current.textContent = `${(svgY / 10).toFixed(1)} мм`;
        if (calibration.active) {
          setCalibration((prev) => ({ ...prev, cursorPos: { x: svgX, y: svgY } }));
        }
        if (activeImageTool === "register") {
          setRegCursorPos({ x: svgX, y: svgY });
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
      activeImageTool,
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
        if (activeImageTool && activeImageTool !== "transform") {
          setActiveImageTool("transform");
          setRegistrationState({ step: 1, activeSide: "top", topPts: [], bottomPts: [] });
          return;
        }
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

  // Listener for switching active image tool from inspector (e.g. calibration)
  useEffect(() => {
    const handleSetTool = (e: Event) => {
      const customEvt = e as CustomEvent<{ tool: ActiveImageTool }>;
      if (customEvt.detail?.tool) {
        setActiveImageTool(customEvt.detail.tool);
      }
    };
    window.addEventListener("cad:set-image-tool", handleSetTool);
    return () => window.removeEventListener("cad:set-image-tool", handleSetTool);
  }, []);

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

  // Upload Images to Active Layer (Raw insertion)
  const rawInsertImages = async (
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

  // Upload Images to Active Layer (With Preprocessing Wizard)
  const handleAddImagesToLayer = async (
    files: File[],
    customPos?: { x: number; y: number }
  ) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      try {
        const rawDataUrl = await readFileAsDataUrl(files[0]);
        const normalized = await normalizeImageResolution(rawDataUrl, 4096);
        setPendingPreprocess({
          file: files[0],
          dataUrl: normalized.dataUrl,
          name: files[0].name,
          customPos,
        });
        return;
      } catch (err) {
        console.error("Ошибка чтения файла изображения:", err);
      }
    }
    await rawInsertImages(files, customPos);
  };

  // Apply processed result from Preprocessing Modal
  const handlePreprocessApply = (result: ImagePreprocessResult) => {
    if (!pendingPreprocess) return;

    // Case 1: Editing existing image in-place
    if (pendingPreprocess.replaceImageId && pendingPreprocess.replaceLayerKey) {
      const lk = pendingPreprocess.replaceLayerKey;
      const targetLayer = boardData[lk];
      const updatedImages = targetLayer.images.map((img) =>
        img.id === pendingPreprocess.replaceImageId
          ? {
              ...img,
              src: result.dataUrl,
              width: result.width,
              height: result.height,
            }
          : img
      );

      onChangeBoardData({
        ...boardData,
        [lk]: {
          ...targetLayer,
          images: updatedImages,
          image: updatedImages[0]?.src,
        },
      });
      setPendingPreprocess(null);
      return;
    }

    // Case 2: Inserting newly preprocessed image
    const isTop = activeLayerKey === "bgTop";
    const targetType = isTop ? "layer_bg_top" : "layer_bg_bottom";
    const baseX = pendingPreprocess.customPos
      ? pendingPreprocess.customPos.x
      : Math.round((-pan.x + 200) / zoom);
    const baseY = pendingPreprocess.customPos
      ? pendingPreprocess.customPos.y
      : Math.round((-pan.y + 150) / zoom);

    const newItem = createLayerImageItemFromDataUrl(
      result.dataUrl,
      pendingPreprocess.name,
      result.width,
      result.height,
      {
        isTop,
        defaultX: baseX,
        defaultY: baseY,
        order: activeLayer.images.length,
      }
    );

    const combined = [...activeLayer.images, newItem];
    onChangeBoardData({
      ...boardData,
      [activeLayerKey]: {
        ...activeLayer,
        images: combined,
        activeImageId: newItem.id,
        image: combined[0]?.src,
        visible: true,
      },
      selectedTarget: { type: targetType, imageId: newItem.id },
    });
    setPendingPreprocess(null);
  };

  // Bypass processing and insert directly as-is
  const handlePreprocessBypass = async () => {
    if (!pendingPreprocess) return;
    if (pendingPreprocess.file) {
      await rawInsertImages([pendingPreprocess.file], pendingPreprocess.customPos);
    }
    setPendingPreprocess(null);
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

      if (e.key === "Shift" && !e.repeat) {
        setIsShiftPressed(true);
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
      if (e.key === "Shift") {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [toolMode, activeImage, activeLayerKey, boardData, handleFitAll]);

  // Blink comparator loop
  useEffect(() => {
    if (activeImageTool !== "blink") return;
    const interval = window.setInterval(() => {
      setBlinkSide((s) => (s === "top" ? "bottom" : "top"));
    }, 400);
    return () => window.clearInterval(interval);
  }, [activeImageTool]);

  // Apply Leveling Angle (Tool 3)
  const handleApplyLeveling = (deltaAngle: number) => {
    if (!activeImage) return;
    const newRot = Math.round(((activeImage.rotation + deltaAngle) % 360) * 100) / 100;
    handleUpdateActiveImage({ rotation: newRot });
    setActiveImageTool("transform");
  };

  // Apply Calibrated Scale (Tool 2)
  const handleApplyCalibratedScale = (measuredDistancePx: number, realDistanceMm: number) => {
    if (!activeImage) return;
    const newScale = calculateCalibratedScale(measuredDistancePx, realDistanceMm, activeImage.scale);
    handleUpdateActiveImage({ scale: newScale });
    setActiveImageTool("transform");
  };

  // Apply 2-Point Registration (Tool 4) with Shift+Click and automatic layer switching
  const handleRegistrationCanvasClick = (e: React.MouseEvent) => {
    if (activeImageTool !== "register" || !containerRef.current) return;
    // Require Shift key to place a fiducial point, preventing accidental clicks while navigating
    if (!e.shiftKey) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const clickY = Math.round((e.clientY - rect.top - pan.y) / zoom);
    const pt: Point2D = { x: clickX, y: clickY };

    if (registrationState.step === 1) {
      const updated = [...registrationState.topPts, pt];
      if (updated.length >= 2) {
        // Automatically switch to Bottom layer view!
        const botTargetId = boardData.bgBottom.images[0]?.id;
        onChangeBoardData({
          ...boardData,
          selectedTarget: botTargetId ? { type: "layer_bg_bottom", imageId: botTargetId } : null,
        });
        setRegistrationState({ step: 2, activeSide: "bottom", topPts: updated, bottomPts: [] });
      } else {
        setRegistrationState({ ...registrationState, topPts: updated });
      }
    } else if (registrationState.step === 2) {
      const updated = [...registrationState.bottomPts, pt];
      if (updated.length >= 2) {
        const bottomImg = boardData.bgBottom.images[0];
        if (bottomImg) {
          const reg = calculate2PointRegistration(
            registrationState.topPts[0],
            registrationState.topPts[1],
            updated[0],
            updated[1],
            { x: bottomImg.x, y: bottomImg.y }
          );
          const updatedBottomImages = boardData.bgBottom.images.map((img, idx) =>
            idx === 0
              ? {
                  ...img,
                  x: reg.newOriginX,
                  y: reg.newOriginY,
                  rotation: Math.round(((img.rotation + reg.rotationDelta) % 360) * 10) / 10,
                  scale: Math.round(img.scale * reg.scaleRatio * 1000) / 1000,
                }
              : img
          );
          onChangeBoardData({
            ...boardData,
            bgBottom: {
              ...boardData.bgBottom,
              images: updatedBottomImages,
            },
          });
        }
        setActiveImageTool("transform");
        setRegistrationState({ step: 1, activeSide: "top", topPts: [], bottomPts: [] });
        setRegCursorPos(null);
      } else {
        setRegistrationState({ ...registrationState, bottomPts: updated });
      }
    }
  };

  // Apply 2-Point Calibration (legacy)
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

            <div className="toolbar-divider" />

            {/* 1. Выбор и трансформация */}
            <button
              className={`cad-tool-btn ${activeImageTool === "transform" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool("transform")}
              title="Выбор и трансформация (масштабирование и поворот)"
            >
              <Move size={13} />
              <span>Трансформация</span>
            </button>

            {/* 2. Калибровка масштаба (2 точки) */}
            <button
              className={`cad-tool-btn ${activeImageTool === "calibrate" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool(activeImageTool === "calibrate" ? "transform" : "calibrate")}
              title="Калибровать масштаб: кликните 2 точки на холсте и укажите точное расстояние в мм"
            >
              <Ruler size={13} />
              <span>Калибровка</span>
            </button>

            {/* 3. Выравнивание горизонта */}
            <button
              className={`cad-tool-btn ${activeImageTool === "level" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool(activeImageTool === "level" ? "transform" : "level")}
              title="Выровнять горизонт: кликните 2 точки одной линии для устранения перекоса скана"
            >
              <Compass size={13} />
              <span>Горизонт</span>
            </button>

            {/* 4. Совмещение слоев Top / Bottom */}
            <button
              className={`cad-tool-btn ${activeImageTool === "register" ? "btn-active-highlight" : ""}`}
              onClick={() => {
                const nextTool = activeImageTool === "register" ? "transform" : "register";
                setActiveImageTool(nextTool);
                setRegistrationState({ step: 1, activeSide: "top", topPts: [], bottomPts: [] });
                if (nextTool === "register") {
                  const topTargetId = boardData.bgTop.images[0]?.id;
                  onChangeBoardData({
                    ...boardData,
                    selectedTarget: topTargetId ? { type: "layer_bg_top", imageId: topTargetId } : null,
                  });
                }
              }}
              title="Совмещение слоев Top и Bottom по 2 переходным отверстиям (Shift + Клик)"
            >
              <Target size={13} />
              <span>Совмещение</span>
            </button>

            {/* 5. Шторка сравнения */}
            <button
              className={`cad-tool-btn ${activeImageTool === "curtain" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool(activeImageTool === "curtain" ? "transform" : "curtain")}
              title="Интерактивная шторка сравнения (сплиттер слоев Top vs Bottom)"
            >
              <Columns2 size={13} />
              <span>Шторка</span>
            </button>

            {/* 6. Измерительная линейка */}
            <button
              className={`cad-tool-btn ${activeImageTool === "measure" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool(activeImageTool === "measure" ? "transform" : "measure")}
              title="Измерительная линейка: свободный замер расстояний в мм и mil"
            >
              <DraftingCompass size={13} />
              <span>Линейка</span>
            </button>

            {/* 7. Экранная лупа */}
            <button
              className={`cad-tool-btn ${activeImageTool === "magnifier" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool(activeImageTool === "magnifier" ? "transform" : "magnifier")}
              title="Экранная лупа 4x / 8x для прецизионного наведения (нажмите Z для смены зума)"
            >
              <ZoomIn size={13} />
              <span>Лупа</span>
            </button>

            {/* 8. Мерцание (Блинк-компаратор) */}
            <button
              className={`cad-tool-btn ${activeImageTool === "blink" ? "btn-active-highlight" : ""}`}
              onClick={() => setActiveImageTool(activeImageTool === "blink" ? "transform" : "blink")}
              title="Мерцание (Блинк-компаратор) слоев Top и Bottom"
            >
              <Eye size={13} />
              <span>Блинк</span>
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

      {/* Registration Tool Banner */}
      {activeImageTool === "register" && (
        <div className="cad-calibration-banner" onMouseDown={(e) => e.stopPropagation()}>
          <div className="banner-content">
            <Target size={16} className="banner-icon" />
            <div className="banner-text">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <strong>
                  Совмещение слоев Top и Bottom (
                  {registrationState.step === 1 ? "Шаг 1: Лицевая сторона Top" : "Шаг 2: Обратная сторона Bottom"}
                  )
                </strong>

                {/* Visual Pair Status Chips */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontSize: "10px",
                    fontWeight: "bold",
                    background: "rgba(8, 47, 73, 0.5)",
                    color: "#38bdf8",
                    border: "1px solid #0284c7",
                  }}
                  title="Пара ①: Top-1 ↔ Bot-1"
                >
                  Пара ①: {registrationState.topPts.length > 0 ? "✓ Top" : "Top"} ↔{" "}
                  {registrationState.bottomPts.length > 0
                    ? "✓ Bot"
                    : registrationState.step === 2 && registrationState.bottomPts.length === 0
                    ? "укажите на Bottom"
                    : "ожидание"}
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontSize: "10px",
                    fontWeight: "bold",
                    background: "rgba(69, 26, 3, 0.5)",
                    color: "#f59e0b",
                    border: "1px solid #d97706",
                  }}
                  title="Пара ②: Top-2 ↔ Bot-2"
                >
                  Пара ②: {registrationState.topPts.length > 1 ? "✓ Top" : "Top"} ↔{" "}
                  {registrationState.bottomPts.length > 1
                    ? "✓ Bot"
                    : registrationState.step === 2 && registrationState.bottomPts.length === 1
                    ? "укажите на Bottom"
                    : "ожидание"}
                </span>
              </div>

              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontSize: "10px",
                    fontWeight: "bold",
                    background: isShiftPressed ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)",
                    color: isShiftPressed ? "#4ade80" : "#facc15",
                    border: isShiftPressed ? "1px solid #22c55e" : "1px solid #eab308",
                  }}
                >
                  {isShiftPressed ? "✓ Shift зажат — кликните отверстие" : "Удерживайте Shift + Клик"}
                </span>
                <span style={{ color: "#e2e8f0", fontSize: "11px" }}>
                  {registrationState.step === 1 && registrationState.topPts.length === 0 && (
                    <>Укажите 1-е базовое отверстие на <strong>Top</strong> (Пара ①)</>
                  )}
                  {registrationState.step === 1 && registrationState.topPts.length === 1 && (
                    <>Укажите 2-е базовое отверстие на <strong>Top</strong> (Пара ②)</>
                  )}
                  {registrationState.step === 2 && registrationState.bottomPts.length === 0 && (
                    <>Укажите ТО ЖЕ отверстие на <strong>Bottom</strong> для Пары ① (<span style={{ color: "#38bdf8", fontWeight: "bold" }}>голубой луч</span>)</>
                  )}
                  {registrationState.step === 2 && registrationState.bottomPts.length === 1 && (
                    <>Укажите ТО ЖЕ отверстие на <strong>Bottom</strong> для Пары ② (<span style={{ color: "#f59e0b", fontWeight: "bold" }}>оранжевый луч</span>)</>
                  )}
                </span>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Manual Layer Switch Toggle Button */}
            <button
              className="cad-btn-flat btn-xs"
              onClick={() => {
                const nextSide = registrationState.activeSide === "top" ? "bottom" : "top";
                setRegistrationState({
                  ...registrationState,
                  activeSide: nextSide,
                  step: nextSide === "top" ? 1 : 2,
                });
                const targetId =
                  nextSide === "top"
                    ? boardData.bgTop.images[0]?.id
                    : boardData.bgBottom.images[0]?.id;
                onChangeBoardData({
                  ...boardData,
                  selectedTarget: targetId
                    ? { type: nextSide === "top" ? "layer_bg_top" : "layer_bg_bottom", imageId: targetId }
                    : null,
                });
              }}
              title="Переключить отображаемый слой вручную"
            >
              Слой: {registrationState.activeSide === "top" ? "Top" : "Bottom"} (переключить)
            </button>

            {/* Undo last point button */}
            {((registrationState.step === 1 && registrationState.topPts.length > 0) ||
              (registrationState.step === 2 && registrationState.bottomPts.length > 0)) && (
              <button
                className="cad-btn-flat btn-xs"
                onClick={() => {
                  if (registrationState.step === 2 && registrationState.bottomPts.length > 0) {
                    setRegistrationState({
                      ...registrationState,
                      bottomPts: registrationState.bottomPts.slice(0, -1),
                    });
                  } else if (registrationState.step === 1 && registrationState.topPts.length > 0) {
                    setRegistrationState({
                      ...registrationState,
                      topPts: registrationState.topPts.slice(0, -1),
                    });
                  }
                }}
                title="Отменить последнюю точку"
              >
                Отменить точку
              </button>
            )}

            <button
              className="cad-btn-flat btn-xs"
              onClick={() => {
                setActiveImageTool("transform");
                setRegistrationState({ step: 1, activeSide: "top", topPts: [], bottomPts: [] });
              }}
            >
              Отмена (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Blink Comparator Banner */}
      {activeImageTool === "blink" && (
        <div className="cad-calibration-banner" onMouseDown={(e) => e.stopPropagation()}>
          <div className="banner-content">
            <Eye size={16} className="banner-icon" />
            <div className="banner-text">
              <strong>Режим мерцания (Блинк-компаратор)</strong>
              <span>
                Активен слой: {blinkSide === "top" ? "Top (Лицевая сторона)" : "Bottom (Обратная сторона)"} (частота 2.5 Гц)
              </span>
            </div>
          </div>
          <button
            className="cad-btn-flat btn-xs"
            onClick={() => setActiveImageTool("transform")}
          >
            Остановить (Esc)
          </button>
        </div>
      )}

      {/* Measure / Calibrate / Level Overlay (Tools 2, 3, 6) */}
      <MeasureOverlay
        mode={
          activeImageTool === "calibrate"
            ? "calibrate"
            : activeImageTool === "level"
            ? "level"
            : activeImageTool === "measure"
            ? "measure"
            : null
        }
        zoom={zoom}
        pan={pan}
        containerRef={containerRef}
        onApplyCalibration={handleApplyCalibratedScale}
        onApplyLeveling={handleApplyLeveling}
        onClose={() => setActiveImageTool("transform")}
      />

      {/* Interactive Curtain Overlay (Tool 5) */}
      <InteractiveCurtain
        isActive={activeImageTool === "curtain"}
        splitPercent={curtainSplitPercent}
        onChangeSplitPercent={setCurtainSplitPercent}
        containerRef={containerRef}
        onClose={() => setActiveImageTool("transform")}
      />

      {/* Screen Magnifier Overlay (Tool 7) */}
      <ScreenMagnifier
        isActive={activeImageTool === "magnifier"}
        containerRef={containerRef}
        pan={pan}
        zoom={zoom}
        onClose={() => setActiveImageTool("transform")}
      />

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

      {/* Image Preprocessing Wizard Modal (Crop & 4-Point Perspective) */}
      {pendingPreprocess && (
        <ImagePreprocessModal
          isOpen={Boolean(pendingPreprocess)}
          imageSrc={pendingPreprocess.dataUrl}
          fileName={pendingPreprocess.name}
          onClose={() => setPendingPreprocess(null)}
          onApply={handlePreprocessApply}
          onBypass={handlePreprocessBypass}
        />
      )}

      {/* SVG Viewport */}
      <svg
        className="cad-svg-canvas"
        width="100%"
        height="100%"
        onClick={(e) => {
          if (activeImageTool === "register") handleRegistrationCanvasClick(e);
        }}
      >
        <defs>
          <pattern id="cad-grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.75" fill="rgba(148, 163, 184, 0.15)" />
          </pattern>
          {/* Curtain Split ClipPath if active */}
          {activeImageTool === "curtain" && (
            <clipPath id="cad-curtain-clip" clipPathUnits="userSpaceOnUse">
              <rect
                x="-500000"
                y="-500000"
                width={
                  500000 +
                  ((containerRef.current
                    ? containerRef.current.clientWidth * (curtainSplitPercent / 100) - pan.x
                    : 0) /
                    zoom)
                }
                height="1000000"
              />
            </clipPath>
          )}
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

              // Build visual filters
              const filterParts: string[] = [];
              if (img.brightness !== 100) filterParts.push(`brightness(${img.brightness}%)`);
              if (img.contrast !== 100) filterParts.push(`contrast(${img.contrast}%)`);
              if (img.invert) filterParts.push("invert(1)");
              if (img.grayscale) filterParts.push("grayscale(100%)");
              if (img.tintColor && img.tintColor !== "none") {
                if (img.tintColor === "red") filterParts.push("sepia(100%) hue-rotate(320deg) saturate(300%)");
                else if (img.tintColor === "blue") filterParts.push("sepia(100%) hue-rotate(180deg) saturate(300%)");
                else if (img.tintColor === "green") filterParts.push("sepia(100%) hue-rotate(80deg) saturate(300%)");
                else if (img.tintColor === "amber") filterParts.push("sepia(100%) hue-rotate(10deg) saturate(300%)");
              }
              const cssFilter = filterParts.length > 0 ? filterParts.join(" ") : undefined;

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
                    filter: cssFilter,
                    mixBlendMode: (img.blendMode && img.blendMode !== "normal" ? img.blendMode : undefined) as any,
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
                    {/* If selected in Transform mode, render interactive Transform Box with 8 handles and rotation */}
                    {isSelected && activeImageTool === "transform" && (
                      <ImageTransformBox
                        image={img}
                        zoom={zoom}
                        pan={pan}
                        containerRef={containerRef}
                        isActive={isSelected && activeImageTool === "transform"}
                        onUpdateImage={handleUpdateActiveImage}
                      />
                    )}
                  </g>
                );
              };

              return (
                <>
                  {/* Layer 1: Bottom Images (solder side) */}
                  {boardData.bgBottom.visible &&
                    (activeImageTool !== "blink" || blinkSide === "bottom") && (
                      <g
                        style={{
                          opacity:
                            activeImageTool === "register"
                              ? registrationState.activeSide === "bottom"
                                ? 1
                                : 0.25
                              : undefined,
                        }}
                      >
                        {boardData.bgBottom.images.map((img) => renderImageItem("bgBottom", img))}
                      </g>
                    )}

                  {/* Layer 2: Top Images (component side) */}
                  {boardData.bgTop.visible &&
                    (activeImageTool !== "blink" || blinkSide === "top") && (
                      <g
                        clipPath={
                          activeImageTool === "curtain" && containerRef.current
                            ? "url(#cad-curtain-clip)"
                            : undefined
                        }
                        style={{
                          opacity:
                            activeImageTool === "register"
                              ? registrationState.activeSide === "top"
                                ? 1
                                : 0.25
                              : undefined,
                        }}
                      >
                        {boardData.bgTop.images.map((img) => renderImageItem("bgTop", img))}
                      </g>
                    )}
                </>
              );
            })()}

            {/* Registration Targets in SVG with clear pair linkage */}
            {activeImageTool === "register" && (
              <g className="cad-registration-targets" pointerEvents="none">
                {/* 1. Top Baseline (between Top-1 and Top-2) */}
                {registrationState.topPts.length === 2 && (() => {
                  const p1 = registrationState.topPts[0];
                  const p2 = registrationState.topPts[1];
                  const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                  const distMm = (distPx / 10).toFixed(1);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  return (
                    <g key="top_baseline" opacity={0.65}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#94a3b8"
                        strokeWidth={1.5 / zoom}
                        strokeDasharray="4 4"
                      />
                      <rect
                        x={midX - 34 / zoom}
                        y={midY - 9 / zoom}
                        width={68 / zoom}
                        height={18 / zoom}
                        rx={4 / zoom}
                        fill="rgba(15, 23, 42, 0.85)"
                        stroke="#475569"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={midX}
                        y={midY + 4 / zoom}
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontSize={9.5 / zoom}
                        fontFamily="monospace"
                      >
                        База: {distMm}мм
                      </text>
                    </g>
                  );
                })()}

                {/* 2. Step 1 Elastic Line from Top-1 to cursor */}
                {registrationState.step === 1 && registrationState.topPts.length === 1 && regCursorPos && (() => {
                  const p1 = registrationState.topPts[0];
                  const cur = regCursorPos;
                  const distMm = (Math.hypot(cur.x - p1.x, cur.y - p1.y) / 10).toFixed(1);
                  return (
                    <g key="step1_rubber_band">
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={cur.x}
                        y2={cur.y}
                        stroke="#f59e0b"
                        strokeWidth={1.5 / zoom}
                        strokeDasharray="4 4"
                        opacity={0.8}
                      />
                      <rect
                        x={cur.x + 10 / zoom}
                        y={cur.y - 20 / zoom}
                        width={90 / zoom}
                        height={18 / zoom}
                        rx={3 / zoom}
                        fill="rgba(15, 23, 42, 0.9)"
                        stroke="#f59e0b"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={cur.x + 15 / zoom}
                        y={cur.y - 7 / zoom}
                        fill="#f59e0b"
                        fontSize={9.5 / zoom}
                        fontWeight="bold"
                      >
                        Репер ②: {distMm} мм
                      </text>
                    </g>
                  );
                })()}

                {/* 3. Pair 1 Link: Connecting Top-1 and Bot-1 */}
                {registrationState.topPts[0] && registrationState.bottomPts[0] && (() => {
                  const t1 = registrationState.topPts[0];
                  const b1 = registrationState.bottomPts[0];
                  const distMm = (Math.hypot(b1.x - t1.x, b1.y - t1.y) / 10).toFixed(2);
                  const midX = (t1.x + b1.x) / 2;
                  const midY = (t1.y + b1.y) / 2;
                  return (
                    <g key="pair1_linked">
                      <line
                        x1={t1.x}
                        y1={t1.y}
                        x2={b1.x}
                        y2={b1.y}
                        stroke="#38bdf8"
                        strokeWidth={2.5 / zoom}
                        strokeDasharray="5 3"
                      />
                      <rect
                        x={midX - 48 / zoom}
                        y={midY - 10 / zoom}
                        width={96 / zoom}
                        height={20 / zoom}
                        rx={4 / zoom}
                        fill="rgba(8, 47, 73, 0.9)"
                        stroke="#38bdf8"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={midX}
                        y={midY + 4 / zoom}
                        textAnchor="middle"
                        fill="#38bdf8"
                        fontSize={10 / zoom}
                        fontWeight="bold"
                      >
                        Пара ①: {distMm} мм
                      </text>
                    </g>
                  );
                })()}

                {/* 4. Pair 1 Elastic Guide: from Top-1 to cursor while waiting for Bot-1 */}
                {registrationState.step === 2 && registrationState.bottomPts.length === 0 && registrationState.topPts[0] && regCursorPos && (() => {
                  const t1 = registrationState.topPts[0];
                  const cur = regCursorPos;
                  const distMm = (Math.hypot(cur.x - t1.x, cur.y - t1.y) / 10).toFixed(1);
                  return (
                    <g key="pair1_guide">
                      <line
                        x1={t1.x}
                        y1={t1.y}
                        x2={cur.x}
                        y2={cur.y}
                        stroke="#38bdf8"
                        strokeWidth={2 / zoom}
                        strokeDasharray="6 4"
                      />
                      <rect
                        x={cur.x + 12 / zoom}
                        y={cur.y - 20 / zoom}
                        width={130 / zoom}
                        height={22 / zoom}
                        rx={4 / zoom}
                        fill="rgba(8, 47, 73, 0.92)"
                        stroke="#38bdf8"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={cur.x + 18 / zoom}
                        y={cur.y - 5 / zoom}
                        fill="#38bdf8"
                        fontSize={10 / zoom}
                        fontWeight="bold"
                      >
                        Ответная точка Пары ① ({distMm} мм)
                      </text>
                    </g>
                  );
                })()}

                {/* 5. Pair 2 Link: Connecting Top-2 and Bot-2 */}
                {registrationState.topPts[1] && registrationState.bottomPts[1] && (() => {
                  const t2 = registrationState.topPts[1];
                  const b2 = registrationState.bottomPts[1];
                  const distMm = (Math.hypot(b2.x - t2.x, b2.y - t2.y) / 10).toFixed(2);
                  const midX = (t2.x + b2.x) / 2;
                  const midY = (t2.y + b2.y) / 2;
                  return (
                    <g key="pair2_linked">
                      <line
                        x1={t2.x}
                        y1={t2.y}
                        x2={b2.x}
                        y2={b2.y}
                        stroke="#f59e0b"
                        strokeWidth={2.5 / zoom}
                        strokeDasharray="5 3"
                      />
                      <rect
                        x={midX - 48 / zoom}
                        y={midY - 10 / zoom}
                        width={96 / zoom}
                        height={20 / zoom}
                        rx={4 / zoom}
                        fill="rgba(69, 26, 3, 0.9)"
                        stroke="#f59e0b"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={midX}
                        y={midY + 4 / zoom}
                        textAnchor="middle"
                        fill="#f59e0b"
                        fontSize={10 / zoom}
                        fontWeight="bold"
                      >
                        Пара ②: {distMm} мм
                      </text>
                    </g>
                  );
                })()}

                {/* 6. Pair 2 Elastic Guide: from Top-2 to cursor while waiting for Bot-2 */}
                {registrationState.step === 2 && registrationState.bottomPts.length === 1 && registrationState.topPts[1] && regCursorPos && (() => {
                  const t2 = registrationState.topPts[1];
                  const cur = regCursorPos;
                  const distMm = (Math.hypot(cur.x - t2.x, cur.y - t2.y) / 10).toFixed(1);
                  return (
                    <g key="pair2_guide">
                      <line
                        x1={t2.x}
                        y1={t2.y}
                        x2={cur.x}
                        y2={cur.y}
                        stroke="#f59e0b"
                        strokeWidth={2 / zoom}
                        strokeDasharray="6 4"
                      />
                      <rect
                        x={cur.x + 12 / zoom}
                        y={cur.y - 20 / zoom}
                        width={130 / zoom}
                        height={22 / zoom}
                        rx={4 / zoom}
                        fill="rgba(69, 26, 3, 0.92)"
                        stroke="#f59e0b"
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={cur.x + 18 / zoom}
                        y={cur.y - 5 / zoom}
                        fill="#f59e0b"
                        fontSize={10 / zoom}
                        fontWeight="bold"
                      >
                        Ответная точка Пары ② ({distMm} мм)
                      </text>
                    </g>
                  );
                })()}

                {/* 7. Render Top Fiducials with Pair Identifiers */}
                {registrationState.topPts.map((pt, idx) => {
                  const isPair1 = idx === 0;
                  const color = isPair1 ? "#38bdf8" : "#f59e0b";
                  const bgFill = isPair1 ? "rgba(8, 47, 73, 0.9)" : "rgba(69, 26, 3, 0.9)";
                  const isWaiting =
                    registrationState.step === 2 &&
                    ((isPair1 && registrationState.bottomPts.length === 0) ||
                      (!isPair1 && registrationState.bottomPts.length === 1));

                  return (
                    <g key={`reg_top_${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      {/* Pulsing radar ring when this point is actively awaiting counterpart */}
                      {isWaiting && (
                        <circle cx={0} cy={0} r={10 / zoom} fill="none" stroke={color} strokeWidth={1.5 / zoom}>
                          <animate
                            attributeName="r"
                            values={`${8 / zoom};${24 / zoom}`}
                            dur="1.3s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="1;0"
                            dur="1.3s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}

                      {/* Precision Crosshair */}
                      <line x1={-12 / zoom} y1={0} x2={12 / zoom} y2={0} stroke={color} strokeWidth={1 / zoom} />
                      <line x1={0} y1={-12 / zoom} x2={0} y2={12 / zoom} stroke={color} strokeWidth={1 / zoom} />
                      <circle cx={0} cy={0} r={7 / zoom} fill="none" stroke={color} strokeWidth={1.8 / zoom} />
                      <circle cx={0} cy={0} r={2.5 / zoom} fill={color} />

                      {/* Badge Pill */}
                      <rect
                        x={10 / zoom}
                        y={-18 / zoom}
                        width={64 / zoom}
                        height={18 / zoom}
                        rx={3 / zoom}
                        fill={bgFill}
                        stroke={color}
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={15 / zoom}
                        y={-5 / zoom}
                        fill={color}
                        fontSize={9.5 / zoom}
                        fontWeight="bold"
                      >
                        {isPair1 ? "① Top" : "② Top"}
                      </text>
                    </g>
                  );
                })}

                {/* 8. Render Bottom Fiducials with Pair Identifiers */}
                {registrationState.bottomPts.map((pt, idx) => {
                  const isPair1 = idx === 0;
                  const color = isPair1 ? "#38bdf8" : "#f59e0b";
                  const bgFill = isPair1 ? "rgba(8, 47, 73, 0.9)" : "rgba(69, 26, 3, 0.9)";

                  return (
                    <g key={`reg_bot_${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      <line x1={-12 / zoom} y1={0} x2={12 / zoom} y2={0} stroke={color} strokeWidth={1 / zoom} />
                      <line x1={0} y1={-12 / zoom} x2={0} y2={12 / zoom} stroke={color} strokeWidth={1 / zoom} />
                      <circle cx={0} cy={0} r={7 / zoom} fill="none" stroke={color} strokeWidth={1.8 / zoom} />
                      <circle cx={0} cy={0} r={2.5 / zoom} fill={color} />

                      <rect
                        x={10 / zoom}
                        y={-18 / zoom}
                        width={64 / zoom}
                        height={18 / zoom}
                        rx={3 / zoom}
                        fill={bgFill}
                        stroke={color}
                        strokeWidth={1 / zoom}
                      />
                      <text
                        x={15 / zoom}
                        y={-5 / zoom}
                        fill={color}
                        fontSize={9.5 / zoom}
                        fontWeight="bold"
                      >
                        {isPair1 ? "① Bot" : "② Bot"}
                      </text>
                    </g>
                  );
                })}
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

      {/* Bottom CAD Viewport Status Bar */}
      <div className="cad-canvas-status-bar" onMouseDown={(e) => e.stopPropagation()}>
        <div className="status-item">
          <span className="status-label">X:</span>
          <span ref={cursorXRef} className="status-val">0.0 мм</span>
        </div>
        <div className="status-item">
          <span className="status-label">Y:</span>
          <span ref={cursorYRef} className="status-val">0.0 мм</span>
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
