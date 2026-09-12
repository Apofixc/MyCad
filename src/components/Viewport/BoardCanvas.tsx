import React, { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { ToolBar } from "./ToolBar";
import { CurtainSlider } from "./CurtainSlider";
import { MagnifierLoupe } from "./MagnifierLoupe";
import { CalibrationModal } from "../Modals/CalibrationModal";
import { engineClient, resolveImageUrl } from "../../api/engineClient";
import {
  distance,
  formatMetric,
  boardMmToLayerBitmapPx,
  calculateHorizonLeveling,
  calculateLayerRegistration,
} from "../../utils/alignmentMath";
import { notifySuccess, notifyWarning, reportError } from "../../utils/errorHandler";
import { Target, X, Check, RotateCcw, Zap, Play, Pause, Compass } from "lucide-react";
import { BoardImageLayer } from "../../types/cad";
import { PlacedComponent, GraphicItem, PackagePad } from "../../types/componentLibrary";

export type TransformHandleType =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate";

export const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    board,
    selectedImageId,
    selectImage,
    updateImageLayer,
    selectedComponentId,
    selectedComponentIds,
    selectComponent,
    updateComponent,
  } = useProjectStore();

  const {
    activeTool,
    setActiveTool,
    viewportZoom,
    setViewportZoom,
    viewportPan,
    setViewportPan,
    setViewportZoomAndPan,
    setCursorMm,
    showGrid,
    gridStepMm,
    showTopLayer,
    setShowTopLayer,
    showBottomLayer,
    setShowBottomLayer,
    showTopComponents,
    showBottomComponents,
    curtainPosition,
    curtainVertical,
    activeWorkLayer,
    setPendingPreprocess,
    setPendingBatchImport,
  } = useUiStore();

  const compDragRef = useRef<{
    isDragging: boolean;
    hasMoved: boolean;
    startMouseMm: { x: number; y: number };
    targetComp: PlacedComponent;
    initialX: number;
    initialY: number;
  } | null>(null);
  const compDragOffsetRef = useRef<{ id: string; dxMm: number; dyMm: number } | null>(null);

  // Dragging / Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Single-image dragging ref
  const dragRef = useRef<{
    isDragging: boolean;
    hasMoved: boolean;
    startMouseMm: { x: number; y: number };
    startScreen: { x: number; y: number };
    targetLayer: BoardImageLayer;
    initialOffset: { x: number; y: number };
  } | null>(null);

  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

  // Gizmo Dragging Ref (8 handles + rotate lollipop)
  const gizmoDragRef = useRef<{
    handle: TransformHandleType;
    startX: number;
    startY: number;
    origScale: number;
    origRotation: number;
    origOffsetX: number;
    origOffsetY: number;
    centerScreen: { x: number; y: number };
    naturalW: number;
    naturalH: number;
    layer: BoardImageLayer;
  } | null>(null);

  const [liveHud, setLiveHud] = useState<{ x: number; y: number; text: string } | null>(null);

  // Drag & drop file state
  const [isDragOver, setIsDragOver] = useState(false);

  // Target underlay side strictly follows active working layer from Project Tree
  const targetUnderlaySide: "top" | "bottom" =
    activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top";

  // Calibration points and modal state
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);
  const [rubberbandMm, setRubberbandMm] = useState<{ x: number; y: number } | null>(null);
  const [calibrationModal, setCalibrationModal] = useState<{
    isOpen: boolean;
    measuredPx: number;
    currentPxPerMm: number;
    layer: BoardImageLayer;
  } | null>(null);

  // Registration state
  const [registrationState, setRegistrationState] = useState<{
    step: 1 | 2;
    topPts: [number, number][];
    botPts: [number, number][];
  }>({
    step: 1,
    topPts: [],
    botPts: [],
  });

  // Strobe tool state (alternating Top / Bottom layers)
  const [strobePhase, setStrobePhase] = useState<"top" | "bottom">("top");
  const [isStrobePaused, setIsStrobePaused] = useState(false);
  const [strobeSpeedMs, setStrobeSpeedMs] = useState(350);

  // Strobe interval timer effect
  useEffect(() => {
    if (activeTool !== "blink") return;

    // Automatically ensure both layers are enabled so strobe can flip between them
    const { showTopLayer, showBottomLayer } = useUiStore.getState();
    if (!showTopLayer) setShowTopLayer(true);
    if (!showBottomLayer) setShowBottomLayer(true);

    if (isStrobePaused) return;

    const interval = setInterval(() => {
      setStrobePhase((prev) => (prev === "top" ? "bottom" : "top"));
      dirtyRef.current = true;
    }, strobeSpeedMs);

    return () => clearInterval(interval);
  }, [activeTool, isStrobePaused, strobeSpeedMs, setShowTopLayer, setShowBottomLayer]);

  // Reset tool points on tool change
  useEffect(() => {
    setMeasurePts([]);
    setRubberbandMm(null);
    if (activeTool !== "register") {
      setRegistrationState({ step: 1, topPts: [], botPts: [] });
    }
  }, [activeTool]);

  // Escape key cancels active tool and clears selection; Spacebar pauses strobe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMeasurePts([]);
        setRubberbandMm(null);
        setRegistrationState({ step: 1, topPts: [], botPts: [] });
        setActiveTool("select");
      } else if (e.key === " " && activeTool === "blink") {
        e.preventDefault();
        setIsStrobePaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTool, activeTool]);

  // Cache loaded images and their source URLs
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const loadedUrlsRef = useRef<Map<string, string>>(new Map());
  const [, setImagesLoadedTick] = useState(0);

  // Base scale: 1 mm = 10 pixels at 100% zoom
  const MM_TO_PX = 10;
  const zoomFactor = viewportZoom / 100;

  // Convert screen px to board mm
  const screenToBoardMm = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const x = (screenX - viewportPan.x) / (MM_TO_PX * zoomFactor);
      const y = (screenY - viewportPan.y) / (MM_TO_PX * zoomFactor);
      return { x, y };
    },
    [viewportPan, zoomFactor]
  );

  // Convert board mm to screen px
  const boardMmToScreen = useCallback(
    (mmX: number, mmY: number): { x: number; y: number } => {
      const x = mmX * MM_TO_PX * zoomFactor + viewportPan.x;
      const y = mmY * MM_TO_PX * zoomFactor + viewportPan.y;
      return { x, y };
    },
    [viewportPan, zoomFactor]
  );

  // Preload images
  useEffect(() => {
    if (!board) return;
    const allImages = [...(board.data?.bgTop?.images || []), ...(board.data?.bgBottom?.images || [])];
    let isMounted = true;

    // Prune removed layers
    const activeIds = new Set(allImages.map((l) => l.id));
    for (const cachedId of Array.from(loadedImagesRef.current.keys())) {
      if (!activeIds.has(cachedId)) {
        loadedImagesRef.current.delete(cachedId);
        loadedUrlsRef.current.delete(cachedId);
      }
    }

    allImages.forEach(async (imgLayer) => {
      if (!imgLayer.cachedUrl) return;

      const existingImg = loadedImagesRef.current.get(imgLayer.id);
      const existingUrl = loadedUrlsRef.current.get(imgLayer.id);

      // Only skip if image is complete and loaded from the exact same URL
      if (
        existingUrl === imgLayer.cachedUrl &&
        existingImg &&
        existingImg.complete &&
        existingImg.naturalWidth > 0
      ) {
        return;
      }

      // Evict outdated cache entry
      loadedImagesRef.current.delete(imgLayer.id);
      loadedUrlsRef.current.delete(imgLayer.id);

      const img = new window.Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        if (!isMounted) return;
        loadedImagesRef.current.set(imgLayer.id, img);
        loadedUrlsRef.current.set(imgLayer.id, imgLayer.cachedUrl!);
        setImagesLoadedTick((t) => t + 1);
        dirtyRef.current = true;
      };

      img.onerror = async (err) => {
        console.warn(`[BoardCanvas] Failed to load image "${imgLayer.name}" via resolved URL:`, err);
        try {
          const bytes = await engineClient.readImageBytes(imgLayer.cachedUrl!);
          if (!isMounted || !bytes || bytes.length === 0) return;
          const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
          const blobUrl = URL.createObjectURL(blob);
          const fallbackImg = new window.Image();
          fallbackImg.onload = () => {
            if (!isMounted) return;
            loadedImagesRef.current.set(imgLayer.id, fallbackImg);
            loadedUrlsRef.current.set(imgLayer.id, imgLayer.cachedUrl!);
            setImagesLoadedTick((t) => t + 1);
            dirtyRef.current = true;
          };
          fallbackImg.src = blobUrl;
        } catch (readErr) {
          console.error(`[BoardCanvas] Image load completely failed for layer "${imgLayer.name}":`, readErr);
        }
      };

      try {
        const resolvedUrl = await resolveImageUrl(imgLayer.cachedUrl);
        img.src = resolvedUrl;
      } catch {
        img.src = imgLayer.cachedUrl;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [board]);

  // Track canvas dirty state
  const dirtyRef = useRef(true);
  const cursorRafRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const pendingWheelRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);

  // Main Render Loop
  useEffect(() => {
    dirtyRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const isActivelyMoving = Boolean(
        dragRef.current?.isDragging ||
        compDragRef.current?.isDragging ||
        gizmoDragRef.current ||
        isPanning
      );
      if (!dirtyRef.current && !isActivelyMoving) {
        animId = requestAnimationFrame(render);
        return;
      }
      dirtyRef.current = false;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Grid
      if (showGrid) {
        drawGrid(ctx, width, height, viewportPan, zoomFactor, gridStepMm, MM_TO_PX);
      }

      // 2. Draw Board Background Images (Scans)
      if (board) {
        const isBlinkTool = activeTool === "blink";
        const curtainSplit = activeTool === "curtain" ? curtainPosition : null;

        // Draw Bottom Scan
        if (showBottomLayer && (!isBlinkTool || strobePhase === "bottom")) {
          ctx.save();
          if (curtainSplit !== null) {
            ctx.beginPath();
            if (curtainVertical) {
              ctx.rect(width * curtainSplit, 0, width * (1 - curtainSplit), height);
            } else {
              ctx.rect(0, height * curtainSplit, width, height * (1 - curtainSplit));
            }
            ctx.clip();
          }
          board.data.bgBottom.images.forEach((layer) => {
            if (layer.visible) {
              const isSelected = selectedImageId === layer.id;
              const effDrag = isSelected ? dragOffsetRef.current || undefined : undefined;
              drawImageLayer(
                ctx,
                layer,
                effDrag,
                boardMmToScreen,
                MM_TO_PX,
                zoomFactor,
                loadedImagesRef.current
              );
            }
          });
          ctx.restore();
        }

        // Draw Top Scan
        if (showTopLayer && (!isBlinkTool || strobePhase === "top")) {
          ctx.save();
          if (curtainSplit !== null) {
            ctx.beginPath();
            if (curtainVertical) {
              ctx.rect(0, 0, width * curtainSplit, height);
            } else {
              ctx.rect(0, 0, width, height * curtainSplit);
            }
            ctx.clip();
          }
          board.data.bgTop.images.forEach((layer) => {
            if (layer.visible) {
              const isSelected = selectedImageId === layer.id;
              const effDrag = isSelected ? dragOffsetRef.current || undefined : undefined;
              drawImageLayer(
                ctx,
                layer,
                effDrag,
                boardMmToScreen,
                MM_TO_PX,
                zoomFactor,
                loadedImagesRef.current
              );
            }
          });
          ctx.restore();
        }

        // 2.5. Draw Placed Components
        const components = board.data.components || [];
        if (components.length > 0 && (showTopComponents || showBottomComponents)) {
          drawPlacedComponents(
            ctx,
            components,
            boardMmToScreen,
            zoomFactor,
            MM_TO_PX,
            showTopComponents,
            showBottomComponents,
            selectedComponentId,
            compDragOffsetRef.current,
            selectedComponentIds
          );
        }

        // 3. Draw Selection Box & Handles strictly for the single selected image
        const allBoardImages = [...board.data.bgBottom.images, ...board.data.bgTop.images];
        const selectedLayer = allBoardImages.find((l) => l.id === selectedImageId);
        if (selectedLayer && selectedLayer.visible) {
          drawSelectionBox(
            ctx,
            selectedLayer,
            dragOffsetRef.current || undefined,
            boardMmToScreen,
            MM_TO_PX,
            zoomFactor,
            loadedImagesRef.current,
            activeTool === "transform"
          );
        }
      }

      // 4. Draw Active Tool Overlays (Measure / Calibration / Level lines)
      if (measurePts.length > 0) {
        drawMeasurementOverlay(ctx, measurePts, rubberbandMm, boardMmToScreen, activeTool);
      }

      // 5. Draw Registration Targets
      if (activeTool === "register") {
        drawRegistrationTargets(ctx, registrationState, boardMmToScreen);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    board,
    viewportPan,
    zoomFactor,
    showGrid,
    gridStepMm,
    showTopLayer,
    showBottomLayer,
    showTopComponents,
    showBottomComponents,
    selectedComponentId,
    selectedComponentIds,
    activeTool,
    strobePhase,
    curtainPosition,
    curtainVertical,
    measurePts,
    rubberbandMm,
    registrationState,
    boardMmToScreen,
    selectedImageId,
  ]);

  // Helper: Find selected layer
  const getSelectedLayer = useCallback((): BoardImageLayer | null => {
    if (!board || !selectedImageId) return null;
    return (
      board.data.bgTop.images.find((i) => i.id === selectedImageId) ||
      board.data.bgBottom.images.find((i) => i.id === selectedImageId) ||
      null
    );
  }, [board, selectedImageId]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseMm = screenToBoardMm(mouseX, mouseY);

    // Middle click (wheel) or Alt + Left click: Always Pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewportPan.x, y: e.clientY - viewportPan.y });
      return;
    }

    // Tool: Measure
    if (activeTool === "measure") {
      if (measurePts.length === 0 || measurePts.length >= 2) {
        setMeasurePts([[mouseMm.x, mouseMm.y]]);
      } else {
        setMeasurePts([...measurePts, [mouseMm.x, mouseMm.y]]);
      }
      return;
    }

    // Tool: Calibrate
    if (activeTool === "calibrate") {
      const activeLayer = getSelectedLayer() || board?.data?.bgTop?.images[0] || board?.data?.bgBottom?.images[0];
      if (!activeLayer) {
        notifyWarning("Для калибровки выберите изображение на холсте");
        return;
      }

      if (measurePts.length === 0) {
        setMeasurePts([[mouseMm.x, mouseMm.y]]);
      } else if (measurePts.length === 1) {
        const p1 = measurePts[0];
        const p2: [number, number] = [mouseMm.x, mouseMm.y];
        setMeasurePts([p1, p2]);

        const img = loadedImagesRef.current.get(activeLayer.id);
        const naturalW = img?.naturalWidth || 1000;
        const naturalH = img?.naturalHeight || 1000;

        const bp1 = boardMmToLayerBitmapPx({ x: p1[0], y: p1[1] }, activeLayer, naturalW, naturalH);
        const bp2 = boardMmToLayerBitmapPx({ x: p2[0], y: p2[1] }, activeLayer, naturalW, naturalH);
        const measuredPx = Math.hypot(bp2.x - bp1.x, bp2.y - bp1.y);
        const pxPerMm = activeLayer.pxPerMm || 23.62;

        setCalibrationModal({
          isOpen: true,
          measuredPx: Math.round(measuredPx * 10) / 10,
          currentPxPerMm: pxPerMm,
          layer: activeLayer,
        });
      }
      return;
    }

    // Tool: Level (Horizon alignment)
    if (activeTool === "level") {
      const activeSide = activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top";
      const topImages = (showTopLayer ? board?.data?.bgTop?.images || [] : []).filter((l) => l.visible);
      const botImages = (showBottomLayer ? board?.data?.bgBottom?.images || [] : []).filter((l) => l.visible);
      const orderedImages =
        activeSide === "bottom"
          ? [...botImages.slice().reverse(), ...topImages.slice().reverse()]
          : [...topImages.slice().reverse(), ...botImages.slice().reverse()];

      let hitLayer: BoardImageLayer | null = null;
      for (const layer of orderedImages) {
        if (isPointInImage(mouseMm, layer, loadedImagesRef.current.get(layer.id))) {
          hitLayer = layer;
          break;
        }
      }

      const activeLayer =
        hitLayer ||
        getSelectedLayer() ||
        (activeSide === "bottom" ? botImages[0] : topImages[0]) ||
        topImages[0] ||
        botImages[0];

      if (!activeLayer) {
        notifyWarning("Для выравнивания выберите или добавьте изображение на холсте");
        return;
      }

      if (selectedImageId !== activeLayer.id) {
        selectImage(activeLayer.id);
      }

      if (measurePts.length === 0) {
        setMeasurePts([[mouseMm.x, mouseMm.y]]);
      } else if (measurePts.length === 1) {
        const p1 = measurePts[0];
        const p2: [number, number] = [mouseMm.x, mouseMm.y];

        if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) < 0.5) {
          notifyWarning("Точки слишком близко. Укажите вторую точку дальше вдоль базовой линии");
          return;
        }

        setMeasurePts([p1, p2]);

        const img = loadedImagesRef.current.get(activeLayer.id);
        const naturalW = img?.naturalWidth || 1000;
        const naturalH = img?.naturalHeight || 1000;

        try {
          const res = calculateHorizonLeveling(
            { x: p1[0], y: p1[1] },
            { x: p2[0], y: p2[1] },
            activeLayer,
            naturalW,
            naturalH
          );

          const updatedLayer: BoardImageLayer = {
            ...activeLayer,
            rotation: res.newRotation,
            offsetX: res.newOffsetX,
            offsetY: res.newOffsetY,
          };
          updateImageLayer(updatedLayer);
          const typeRu = res.targetType === "horizontal" ? "в горизонт" : "в вертикаль";
          notifySuccess(
            `Выровнено ${typeRu}: доворот на ${res.deltaDeg > 0 ? "+" : ""}${res.deltaDeg.toFixed(2)}° (итоговый угол: ${res.newRotation.toFixed(1)}°)`
          );
          setMeasurePts([]);
          setRubberbandMm(null);
          setActiveTool("select");
        } catch (err) {
          reportError(err, "Ошибка выравнивания горизонта");
        }
      }
      return;
    }

    // Tool: Register (Top/Bottom alignment)
    if (activeTool === "register") {
      if (registrationState.step === 1) {
        const newTop = [...registrationState.topPts, [mouseMm.x, mouseMm.y] as [number, number]];
        if (newTop.length < 2) {
          setRegistrationState((prev) => ({ ...prev, topPts: newTop }));
        } else {
          setRegistrationState({ step: 2, topPts: newTop.slice(0, 2), botPts: [] });
          // Temporarily hide Top layer so the user can clearly see and click points on Bottom without obstruction
          setShowTopLayer(false);
          setShowBottomLayer(true);
          notifySuccess("Опорные точки 1 и 2 на Top зафиксированы. Слой Top скрыт: укажите те же 2 точки на стороне Bottom");
        }
      } else {
        const newBot = [...registrationState.botPts, [mouseMm.x, mouseMm.y] as [number, number]];
        if (newBot.length < 2) {
          setRegistrationState((prev) => ({ ...prev, botPts: newBot }));
        } else {
          const top1 = { x: registrationState.topPts[0][0], y: registrationState.topPts[0][1] };
          const top2 = { x: registrationState.topPts[1][0], y: registrationState.topPts[1][1] };
          const bot1 = { x: newBot[0][0], y: newBot[0][1] };
          const bot2 = { x: newBot[1][0], y: newBot[1][1] };

          const selectedBottomLayer = selectedImageId
            ? board?.data?.bgBottom?.images?.find((img) => img.id === selectedImageId)
            : null;
          const botLayer = selectedBottomLayer || board?.data?.bgBottom?.images?.[0];
          if (!botLayer) {
            notifyWarning("На стороне Bottom не найден скан для совмещения");
            return;
          }

          const botImg = loadedImagesRef.current.get(botLayer.id);
          const naturalW = botImg?.naturalWidth || botLayer.width || 1000;
          const naturalH = botImg?.naturalHeight || botLayer.height || 1000;

          try {
            const res = calculateLayerRegistration(top1, top2, bot1, bot2, botLayer, naturalW, naturalH);
            const updatedBot: BoardImageLayer = {
              ...botLayer,
              offsetX: res.newOffsetX,
              offsetY: res.newOffsetY,
              rotation: res.newRotation,
              scale: res.newScale,
            };
            updateImageLayer(updatedBot);
            selectImage(updatedBot.id);
            setShowTopLayer(true);
            setShowBottomLayer(true);
            notifySuccess("Слои Top и Bottom успешно совмещены");
            setRegistrationState({ step: 1, topPts: [], botPts: [] });
            setActiveTool("select");
          } catch (err: any) {
            reportError(err, "Ошибка совмещения слоев");
          }
        }
      }
      return;
    }

    // Left click in Select or Transform mode
    if (e.button === 0) {
      const selectedLayer = getSelectedLayer();

      // Check if clicked on a transform handle of the currently selected image (ONLY in Transform tool)
      if (activeTool === "transform" && selectedLayer && !selectedLayer.locked) {
        const img = loadedImagesRef.current.get(selectedLayer.id);
        if (img) {
          const hitHandle = getHitHandle(
            { x: mouseX, y: mouseY },
            selectedLayer,
            img,
            boardMmToScreen,
            MM_TO_PX,
            zoomFactor
          );

          if (hitHandle) {
            const effX = selectedLayer.offsetX || 0;
            const effY = selectedLayer.offsetY || 0;
            const pos = boardMmToScreen(effX, effY);
            const pxPerMm = selectedLayer.pxPerMm || 23.62;
            const wMm = (img.naturalWidth / pxPerMm) * (selectedLayer.scale || 1.0);
            const hMm = (img.naturalHeight / pxPerMm) * (selectedLayer.scale || 1.0);
            const wPx = wMm * MM_TO_PX * zoomFactor;
            const hPx = hMm * MM_TO_PX * zoomFactor;

            gizmoDragRef.current = {
              handle: hitHandle,
              startX: e.clientX,
              startY: e.clientY,
              origScale: selectedLayer.scale || 1.0,
              origRotation: selectedLayer.rotation || 0,
              origOffsetX: selectedLayer.offsetX || 0,
              origOffsetY: selectedLayer.offsetY || 0,
              centerScreen: { x: pos.x + wPx / 2, y: pos.y + hPx / 2 },
              naturalW: img.naturalWidth,
              naturalH: img.naturalHeight,
              layer: selectedLayer,
            };
            return;
          }
        }
      }

      // Check if clicked on any placed component
      const components = board?.data?.components || [];
      let hitComp: PlacedComponent | null = null;
      for (let i = components.length - 1; i >= 0; i--) {
        const c = components[i];
        const isTop = c.layer !== "bottom";
        if ((isTop && showTopComponents) || (!isTop && showBottomComponents)) {
          if (c.visible !== false && isPointInComponent(mouseMm, c)) {
            hitComp = c;
            break;
          }
        }
      }

      if (hitComp) {
        selectComponent(hitComp.id, e.ctrlKey || e.metaKey);
        if (!hitComp.locked) {
          compDragRef.current = {
            isDragging: true,
            hasMoved: false,
            startMouseMm: mouseMm,
            targetComp: hitComp,
            initialX: hitComp.xMm ?? hitComp.x ?? 0,
            initialY: hitComp.yMm ?? hitComp.y ?? 0,
          };
          compDragOffsetRef.current = null;
        }
        return;
      }

      // Check if clicked on any image to select and drag
      const activeSide = activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top";
      const topImages = (showTopLayer ? board?.data?.bgTop?.images || [] : []).filter((l) => l.visible);
      const botImages = (showBottomLayer ? board?.data?.bgBottom?.images || [] : []).filter((l) => l.visible);

      const orderedImages =
        activeSide === "bottom"
          ? [...botImages.slice().reverse(), ...topImages.slice().reverse()]
          : [...topImages.slice().reverse(), ...botImages.slice().reverse()];

      let hitLayer: BoardImageLayer | null = null;
      for (const layer of orderedImages) {
        if (isPointInImage(mouseMm, layer, loadedImagesRef.current.get(layer.id))) {
          hitLayer = layer;
          break;
        }
      }

      if (hitLayer) {
        selectImage(hitLayer.id);
        if (!hitLayer.locked) {
          dragRef.current = {
            isDragging: true,
            hasMoved: false,
            startMouseMm: mouseMm,
            startScreen: { x: e.clientX, y: e.clientY },
            targetLayer: hitLayer,
            initialOffset: { x: hitLayer.offsetX || 0, y: hitLayer.offsetY || 0 },
          };
          dragOffsetRef.current = null;
        }
        return;
      }

      // Clicked on empty canvas: Clear selection and start pan
      selectImage(null);
      selectComponent(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewportPan.x, y: e.clientY - viewportPan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseMm = screenToBoardMm(mouseX, mouseY);

    if (!cursorRafRef.current) {
      cursorRafRef.current = requestAnimationFrame(() => {
        setCursorMm(mouseMm);
        cursorRafRef.current = null;
      });
    }

    // Live rubberband for measure / calibrate / level tools
    if (measurePts.length === 1) {
      setRubberbandMm(mouseMm);
      dirtyRef.current = true;
    }

    // 1. Gizmo Handle Dragging (Scale or Rotate)
    if (gizmoDragRef.current) {
      const g = gizmoDragRef.current;
      const deltaScreenX = e.clientX - g.startX;
      const deltaScreenY = e.clientY - g.startY;

      if (g.handle === "rotate") {
        const dx = e.clientX - g.centerScreen.x;
        const dy = e.clientY - g.centerScreen.y;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        if (e.shiftKey) {
          angle = Math.round(angle / 15) * 15;
        }
        while (angle < 0) angle += 360;
        angle = Math.round((angle % 360) * 10) / 10;

        g.layer.rotation = angle;
        setLiveHud({
          x: e.clientX + 15,
          y: e.clientY - 20,
          text: `Угол: ${angle.toFixed(1)}°`,
        });
      } else {
        // Resize handle dragging with pinned opposite anchor
        const rotRad = ((g.origRotation || 0) * Math.PI) / 180;
        const localDx = (deltaScreenX * Math.cos(-rotRad) - deltaScreenY * Math.sin(-rotRad)) / zoomFactor;
        const localDy = (deltaScreenX * Math.sin(-rotRad) + deltaScreenY * Math.cos(-rotRad)) / zoomFactor;

        const pxPerMm = g.layer.pxPerMm || 23.62;
        const origWMm = (g.naturalW / pxPerMm) * g.origScale;
        const origHMm = (g.naturalH / pxPerMm) * g.origScale;
        const baseW = origWMm * MM_TO_PX;
        const baseH = origHMm * MM_TO_PX;

        let anchorRelX = 0;
        let anchorRelY = 0;
        let scaleMult = 1;

        if (g.handle === "se") {
          scaleMult = Math.max(0.05, 1 + (localDx / baseW + localDy / baseH) / 2);
          anchorRelX = -0.5;
          anchorRelY = -0.5;
        } else if (g.handle === "nw") {
          scaleMult = Math.max(0.05, 1 - (localDx / baseW + localDy / baseH) / 2);
          anchorRelX = 0.5;
          anchorRelY = 0.5;
        } else if (g.handle === "ne") {
          scaleMult = Math.max(0.05, 1 + (localDx / baseW - localDy / baseH) / 2);
          anchorRelX = -0.5;
          anchorRelY = 0.5;
        } else if (g.handle === "sw") {
          scaleMult = Math.max(0.05, 1 + (-localDx / baseW + localDy / baseH) / 2);
          anchorRelX = 0.5;
          anchorRelY = -0.5;
        } else if (g.handle === "e") {
          scaleMult = Math.max(0.05, 1 + localDx / baseW);
          anchorRelX = -0.5;
          anchorRelY = 0;
        } else if (g.handle === "w") {
          scaleMult = Math.max(0.05, 1 - localDx / baseW);
          anchorRelX = 0.5;
          anchorRelY = 0;
        } else if (g.handle === "s") {
          scaleMult = Math.max(0.05, 1 + localDy / baseH);
          anchorRelX = 0;
          anchorRelY = -0.5;
        } else if (g.handle === "n") {
          scaleMult = Math.max(0.05, 1 - localDy / baseH);
          anchorRelX = 0;
          anchorRelY = 0.5;
        }

        const newScale = Math.max(0.01, Math.round(g.origScale * scaleMult * 1000) / 1000);

        // Keep opposite anchor point pinned in board space
        const origCx = g.origOffsetX + origWMm / 2;
        const origCy = g.origOffsetY + origHMm / 2;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        const anchorBoardX = origCx + (anchorRelX * origWMm) * cosR - (anchorRelY * origHMm) * sinR;
        const anchorBoardY = origCy + (anchorRelX * origWMm) * sinR + (anchorRelY * origHMm) * cosR;

        const newWMm = (g.naturalW / pxPerMm) * newScale;
        const newHMm = (g.naturalH / pxPerMm) * newScale;

        const newCx = anchorBoardX - ((anchorRelX * newWMm) * cosR - (anchorRelY * newHMm) * sinR);
        const newCy = anchorBoardY - ((anchorRelX * newWMm) * sinR + (anchorRelY * newHMm) * cosR);

        g.layer.scale = newScale;
        g.layer.offsetX = Math.round((newCx - newWMm / 2) * 100) / 100;
        g.layer.offsetY = Math.round((newCy - newHMm / 2) * 100) / 100;

        const curMmW = newWMm.toFixed(1);
        const curMmH = newHMm.toFixed(1);

        setLiveHud({
          x: e.clientX + 15,
          y: e.clientY - 20,
          text: `${curMmW} × ${curMmH} мм (${(newScale * 100).toFixed(0)}%)`,
        });
      }

      dirtyRef.current = true;
      return;
    }

    // 1.5. Dragging placed component
    if (compDragRef.current?.isDragging) {
      const d = compDragRef.current;
      let dx = mouseMm.x - d.startMouseMm.x;
      let dy = mouseMm.y - d.startMouseMm.y;

      if (showGrid && gridStepMm > 0) {
        const targetX = Math.round((d.initialX + dx) / gridStepMm) * gridStepMm;
        const targetY = Math.round((d.initialY + dy) / gridStepMm) * gridStepMm;
        dx = targetX - d.initialX;
        dy = targetY - d.initialY;
      }

      compDragOffsetRef.current = { id: d.targetComp.id, dxMm: dx, dyMm: dy };
      d.hasMoved = true;
      dirtyRef.current = true;
      if (canvasRef.current && canvasRef.current.style.cursor !== "move") {
        canvasRef.current.style.cursor = "move";
      }
      return;
    }

    // 2. Dragging selected image
    if (dragRef.current?.isDragging) {
      const dist = Math.hypot(
        e.clientX - dragRef.current.startScreen.x,
        e.clientY - dragRef.current.startScreen.y
      );
      if (dist > 3) dragRef.current.hasMoved = true;

      const dxMm = mouseMm.x - dragRef.current.startMouseMm.x;
      const dyMm = mouseMm.y - dragRef.current.startMouseMm.y;

      dragOffsetRef.current = { x: dxMm, y: dyMm };
      dirtyRef.current = true;
      if (canvasRef.current && canvasRef.current.style.cursor !== "move") {
        canvasRef.current.style.cursor = "move";
      }
      return;
    }

    // 3. Panning canvas
    if (isPanning) {
      setViewportPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      dirtyRef.current = true;
      if (canvasRef.current && canvasRef.current.style.cursor !== "grabbing") {
        canvasRef.current.style.cursor = "grabbing";
      }
      return;
    }

    // 4. Hover over handles (ONLY in Transform tool) or image
    const selectedLayer = getSelectedLayer();
    if (activeTool === "transform" && selectedLayer && !selectedLayer.locked) {
      const img = loadedImagesRef.current.get(selectedLayer.id);
      if (img) {
        const hitHandle = getHitHandle(
          { x: mouseX, y: mouseY },
          selectedLayer,
          img,
          boardMmToScreen,
          MM_TO_PX,
          zoomFactor
        );
        if (hitHandle) {
          const cursors: Record<TransformHandleType, string> = {
            nw: "nwse-resize",
            se: "nwse-resize",
            ne: "nesw-resize",
            sw: "nesw-resize",
            n: "ns-resize",
            s: "ns-resize",
            e: "ew-resize",
            w: "ew-resize",
            rotate: "grab",
          };
          if (canvasRef.current) canvasRef.current.style.cursor = cursors[hitHandle];
          return;
        }
      }
    }

    // Precision tools use crosshair cursor
    if (
      activeTool === "level" ||
      activeTool === "measure" ||
      activeTool === "calibrate" ||
      activeTool === "register"
    ) {
      if (canvasRef.current && canvasRef.current.style.cursor !== "crosshair") {
        canvasRef.current.style.cursor = "crosshair";
      }
      return;
    }

    // Hover over any visible image
    const activeSide = activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top";
    const topImages = (showTopLayer ? board?.data?.bgTop?.images || [] : []).filter((l) => l.visible);
    const botImages = (showBottomLayer ? board?.data?.bgBottom?.images || [] : []).filter((l) => l.visible);
    const orderedImages =
      activeSide === "bottom"
        ? [...botImages.slice().reverse(), ...topImages.slice().reverse()]
        : [...topImages.slice().reverse(), ...botImages.slice().reverse()];

    let isOverAnyImage = false;
    for (const layer of orderedImages) {
      if (isPointInImage(mouseMm, layer, loadedImagesRef.current.get(layer.id))) {
        isOverAnyImage = true;
        break;
      }
    }

    if (canvasRef.current) {
      const nextCursor = isOverAnyImage ? "move" : "default";
      if (canvasRef.current.style.cursor !== nextCursor) {
        canvasRef.current.style.cursor = nextCursor;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 1. Finish gizmo drag
    if (gizmoDragRef.current) {
      updateImageLayer(gizmoDragRef.current.layer);
      gizmoDragRef.current = null;
      setLiveHud(null);
    }

    // 1.5. Finish component move drag
    if (compDragRef.current?.isDragging) {
      const d = compDragRef.current;
      if (d.hasMoved && compDragOffsetRef.current) {
        const newX = Math.round((d.initialX + compDragOffsetRef.current.dxMm) * 100) / 100;
        const newY = Math.round((d.initialY + compDragOffsetRef.current.dyMm) * 100) / 100;
        updateComponent({ ...d.targetComp, x: newX, y: newY, xMm: newX, yMm: newY });
      }
      compDragRef.current = null;
      compDragOffsetRef.current = null;
      dirtyRef.current = true;
    }

    // 2. Finish image move drag
    if (dragRef.current?.isDragging) {
      if (dragRef.current.hasMoved && dragOffsetRef.current) {
        const target = dragRef.current.targetLayer;
        const updated: BoardImageLayer = {
          ...target,
          offsetX: Math.round((dragRef.current.initialOffset.x + dragOffsetRef.current.x) * 100) / 100,
          offsetY: Math.round((dragRef.current.initialOffset.y + dragOffsetRef.current.y) * 100) / 100,
        };
        updateImageLayer(updated);
      }
      dragRef.current = null;
      dragOffsetRef.current = null;
    }

    setIsPanning(false);
  };

  // Cursor-anchored Zoom on Wheel with rAF batching
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentZoom = pendingWheelRef.current ? pendingWheelRef.current.zoom : viewportZoom;
    const currentPan = pendingWheelRef.current ? pendingWheelRef.current.pan : viewportPan;

    const zoomFactorBefore = currentZoom / 100;
    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.max(10, Math.min(2000, Math.round(currentZoom * zoomDelta)));
    const zoomFactorAfter = nextZoom / 100;

    const newPanX = mouseX - ((mouseX - currentPan.x) * zoomFactorAfter) / zoomFactorBefore;
    const newPanY = mouseY - ((mouseY - currentPan.y) * zoomFactorAfter) / zoomFactorBefore;

    pendingWheelRef.current = { zoom: nextZoom, pan: { x: newPanX, y: newPanY } };

    if (!wheelRafRef.current) {
      wheelRafRef.current = requestAnimationFrame(() => {
        if (pendingWheelRef.current) {
          setViewportZoomAndPan(pendingWheelRef.current.zoom, pendingWheelRef.current.pan);
          pendingWheelRef.current = null;
        }
        wheelRafRef.current = null;
      });
    }
  };

  return (
    <div
      className="cad-viewport-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--cad-bg-deep)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", position: "relative", zIndex: 1 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Floating Toolbar */}
      <ToolBar />

      {/* Live Gizmo HUD */}
      {liveHud && (
        <div
          className="cad-live-transform-hud"
          style={{ left: `${liveHud.x}px`, top: `${liveHud.y}px` }}
        >
          {liveHud.text}
        </div>
      )}

      {/* Strobe Tool HUD */}
      {activeTool === "blink" && (
        <div className="cad-strobe-hud">
          <Zap size={15} color="#f59e0b" />
          <span>Стробоскоп:</span>
          <span
            className={`cad-strobe-phase-badge ${
              strobePhase === "top" ? "cad-strobe-phase-top" : "cad-strobe-phase-bot"
            }`}
          >
            {strobePhase === "top" ? "TOP" : "BOTTOM"}
          </span>
          <button
            type="button"
            className="cad-tree-icon-btn"
            style={{ marginLeft: "4px" }}
            onClick={() => setIsStrobePaused((p) => !p)}
            title={isStrobePaused ? "Возобновить (Пробел)" : "Пауза (Пробел)"}
          >
            {isStrobePaused ? <Play size={13} color="#22c55e" /> : <Pause size={13} color="#f59e0b" />}
          </button>
          <span style={{ fontSize: "11px", color: "var(--cad-text-dim)", marginLeft: "4px" }}>
            Пробел: пауза | Esc: выход
          </span>
          <button
            type="button"
            className="cad-tree-icon-btn"
            style={{ marginLeft: "6px" }}
            onClick={() => setActiveTool("select")}
            title="Выйти из стробоскопа"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Registration Tool Banner */}
      {activeTool === "register" && (
        <div className="cad-registration-banner">
          <Target size={16} color="#60a5fa" />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
            <span style={{ fontWeight: 600 }}>
              {registrationState.step === 1
                ? "Шаг 1: Укажите 2 опорные точки на стороне Top (референс)"
                : "Шаг 2: Укажите те же 2 опорные точки на стороне Bottom"}
            </span>
            <span style={{ color: "var(--cad-text-dim)" }}>
              (Точек: {registrationState.step === 1 ? registrationState.topPts.length : registrationState.botPts.length} / 2)
            </span>
          </div>
          {registrationState.step === 2 && (
            <button
              type="button"
              className="cad-modern-btn cad-btn-ghost cad-btn-xs"
              style={{ fontSize: "11px", padding: "2px 8px" }}
              onClick={() => setShowTopLayer(!showTopLayer)}
              title="Переключить видимость слоя Top для сравнения"
            >
              {showTopLayer ? "Скрыть Top" : "Показать Top (референс)"}
            </button>
          )}
          {((registrationState.step === 1 && registrationState.topPts.length > 0) ||
            (registrationState.step === 2 && registrationState.botPts.length > 0)) && (
            <button
              type="button"
              className="cad-modern-btn cad-btn-ghost cad-btn-xs"
              style={{ fontSize: "11px", padding: "2px 8px" }}
              onClick={() => {
                if (registrationState.step === 1) {
                  setRegistrationState({ step: 1, topPts: [], botPts: [] });
                } else {
                  setRegistrationState((prev) => ({ ...prev, botPts: [] }));
                }
              }}
              title="Сбросить точки текущего шага"
            >
              Сбросить
            </button>
          )}
          {registrationState.step === 2 && (
            <button
              type="button"
              className="cad-modern-btn cad-btn-ghost cad-btn-xs"
              style={{ fontSize: "11px", padding: "2px 8px" }}
              onClick={() => {
                setRegistrationState({ step: 1, topPts: [], botPts: [] });
                setShowTopLayer(true);
              }}
              title="Вернуться к выбору точек на стороне Top"
            >
              К шагу 1
            </button>
          )}
          <button
            type="button"
            className="cad-tree-icon-btn"
            style={{ marginLeft: "8px" }}
            onClick={() => {
              setRegistrationState({ step: 1, topPts: [], botPts: [] });
              setShowTopLayer(true);
              setShowBottomLayer(true);
              setActiveTool("select");
            }}
            title="Отмена совмещения"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Level Tool Banner */}
      {activeTool === "level" && (
        <div className="cad-registration-banner" style={{ borderColor: "#f59e0b" }}>
          <Compass size={16} color="#f59e0b" />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
            <span style={{ fontWeight: 600 }}>
              {measurePts.length === 0
                ? "Шаг 1: Кликните первую точку на НАКЛОННОМ крае платы (или дорожке)"
                : "Шаг 2: Кликните вторую точку на ТОМ ЖЕ наклонном крае (задает текущий угол платы)"}
            </span>
            <span style={{ color: "var(--cad-text-dim)" }}>
              (Точек: {measurePts.length} / 2)
            </span>
          </div>
          <button
            type="button"
            className="cad-tree-icon-btn"
            style={{ marginLeft: "8px" }}
            onClick={() => {
              setMeasurePts([]);
              setRubberbandMm(null);
              setActiveTool("select");
            }}
            title="Отмена выравнивания (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Curtain Slider */}
      {activeTool === "curtain" && <CurtainSlider />}

      {/* Magnifier Loupe */}
      <MagnifierLoupe sourceCanvasRef={canvasRef} />

      {/* Calibration Modal */}
      {calibrationModal && (
        <CalibrationModal
          isOpen={calibrationModal.isOpen}
          measuredPx={calibrationModal.measuredPx}
          currentPxPerMm={calibrationModal.currentPxPerMm}
          onClose={() => {
            setCalibrationModal(null);
            setMeasurePts([]);
            setActiveTool("select");
          }}
          onApply={(realMm) => {
            if (calibrationModal && calibrationModal.measuredPx > 0 && realMm > 0) {
              const newPxPerMm = Math.round((calibrationModal.measuredPx / realMm) * 100) / 100;
              const dpi = Math.round(newPxPerMm * 25.4);
              const updated: BoardImageLayer = {
                ...calibrationModal.layer,
                pxPerMm: newPxPerMm,
                dpi: dpi,
              };
              updateImageLayer(updated);
              notifySuccess(`Калибровка выполнена: ${updated.pxPerMm} px/мм (${updated.dpi} DPI)`);
              setCalibrationModal(null);
              setMeasurePts([]);
              setActiveTool("select");
            }
          }}
        />
      )}
    </div>
  );
};

/* ==========================================================================
   Helper Functions
   ========================================================================== */

function getGizmoHandles(
  layer: BoardImageLayer,
  img: HTMLImageElement,
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  mmToPx: number,
  zoom: number
) {
  const effX = layer.offsetX || 0;
  const effY = layer.offsetY || 0;
  const pos = boardMmToScreen(effX, effY);
  const pxPerMm = layer.pxPerMm || 23.62;
  const wMm = (img.naturalWidth / pxPerMm) * (layer.scale || 1.0);
  const hMm = (img.naturalHeight / pxPerMm) * (layer.scale || 1.0);
  const wPx = wMm * mmToPx * zoom;
  const hPx = hMm * mmToPx * zoom;

  const cx = pos.x + wPx / 2;
  const cy = pos.y + hPx / 2;
  const rot = ((layer.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const rotatePt = (lx: number, ly: number) => ({
    x: cx + (lx * cos - ly * sin),
    y: cy + (lx * sin + ly * cos),
  });

  const hw = wPx / 2;
  const hh = hPx / 2;
  const stemLen = 28;

  return [
    { handle: "nw" as TransformHandleType, ...rotatePt(-hw, -hh) },
    { handle: "n" as TransformHandleType, ...rotatePt(0, -hh) },
    { handle: "ne" as TransformHandleType, ...rotatePt(hw, -hh) },
    { handle: "e" as TransformHandleType, ...rotatePt(hw, 0) },
    { handle: "se" as TransformHandleType, ...rotatePt(hw, hh) },
    { handle: "s" as TransformHandleType, ...rotatePt(0, hh) },
    { handle: "sw" as TransformHandleType, ...rotatePt(-hw, hh) },
    { handle: "w" as TransformHandleType, ...rotatePt(-hw, 0) },
    { handle: "rotate" as TransformHandleType, ...rotatePt(0, -hh - stemLen) },
  ];
}

function getHitHandle(
  mouseScreen: { x: number; y: number },
  layer: BoardImageLayer,
  img: HTMLImageElement,
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  mmToPx: number,
  zoom: number
): TransformHandleType | null {
  const handles = getGizmoHandles(layer, img, boardMmToScreen, mmToPx, zoom);
  const hitRadius = 8;
  for (const h of handles) {
    if (Math.hypot(mouseScreen.x - h.x, mouseScreen.y - h.y) <= hitRadius) {
      return h.handle;
    }
  }
  return null;
}

function isPointInImage(
  ptMm: { x: number; y: number },
  layer: any,
  img: HTMLImageElement | undefined
): boolean {
  if (!img || !img.complete || img.naturalWidth === 0) return false;

  const pxPerMm = layer.pxPerMm || 23.62;
  const scale = layer.scale || 1.0;
  const wMm = (img.naturalWidth / pxPerMm) * scale;
  const hMm = (img.naturalHeight / pxPerMm) * scale;

  const cx = (layer.offsetX || 0) + wMm / 2;
  const cy = (layer.offsetY || 0) + hMm / 2;

  let dx = ptMm.x - cx;
  let dy = ptMm.y - cy;

  const rot = layer.rotation || 0;
  if (rot !== 0) {
    const rad = (-rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }

  const localX = dx + wMm / 2;
  const localY = dy + hMm / 2;

  return localX >= 0 && localX <= wMm && localY >= 0 && localY <= hMm;
}

function isPointInComponent(
  ptMm: { x: number; y: number },
  comp: PlacedComponent
): boolean {
  const compX = comp.xMm ?? comp.x ?? 0;
  const compY = comp.yMm ?? comp.y ?? 0;
  const dx = ptMm.x - compX;
  const dy = ptMm.y - compY;
  const rot = comp.rotationDeg ?? comp.rotation ?? 0;
  const rad = (-rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  const w = comp.packageDef?.bodyWidth || 5;
  const h = comp.packageDef?.bodyHeight || 5;
  const halfW = Math.max(1.8, w / 2 + 0.8);
  const halfH = Math.max(1.8, h / 2 + 0.8);

  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH;
}

function drawPlacedComponents(
  ctx: CanvasRenderingContext2D,
  components: PlacedComponent[],
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  zoomFactor: number,
  mmToPx: number,
  showTop: boolean,
  showBottom: boolean,
  selectedId: string | null,
  dragOffset: { id: string; dxMm: number; dyMm: number } | null,
  selectedIds?: string[]
) {
  if (!components || components.length === 0) return;

  const pxPerMm = mmToPx * zoomFactor;

  for (const comp of components) {
    const isTop = (comp.layer || comp.side || "top") !== "bottom";
    if (isTop && !showTop) continue;
    if (!isTop && !showBottom) continue;
    if (comp.visible === false) continue;

    const isSelected = comp.id === selectedId || (selectedIds ? selectedIds.includes(comp.id) : false);
    let effX = comp.xMm ?? comp.x ?? 0;
    let effY = comp.yMm ?? comp.y ?? 0;
    if (dragOffset && dragOffset.id === comp.id) {
      effX += dragOffset.dxMm;
      effY += dragOffset.dyMm;
    }

    const screenPos = boardMmToScreen(effX, effY);
    const compRot = comp.rotationDeg ?? comp.rotation ?? 0;

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate((compRot * Math.PI) / 180);
    if (!isTop || comp.mirrored) {
      ctx.scale(-1, 1);
    }

    // Извлечение определения корпуса и активного варианта напрямую из БД (PackageDefinition)
    const pkg = comp.packageDef;
    const bodyW = (pkg?.bodyWidth || 5) * pxPerMm;
    const bodyH = (pkg?.bodyHeight || 5) * pxPerMm;

    const variants = pkg?.variants || [];
    const activeVariant =
      variants.find((v) => v.id === comp.selectedVariantId) ||
      variants.find((v) => v.id === pkg?.defaultVariantId) ||
      variants[0] || {
        id: "default",
        name: "Стандартный",
        bodyColor: "#1e293b",
        bodyBorderColor: "#475569",
        keyType: "none",
        graphics: [],
      };

    // -------------------------------------------------------------------------
    // 1. Тело корпуса строго по данным из БД (Body Shape, Variant Colors)
    // -------------------------------------------------------------------------
    const allGraphics: GraphicItem[] = [
      ...(pkg?.graphics || []),
      ...(activeVariant?.graphics || []),
    ];
    const hasCustomGraphics = allGraphics.length > 0;
    const bodyShape = pkg?.bodyShape || (hasCustomGraphics ? "none" : "rect");

    if (bodyShape !== "none") {
      ctx.save();
      // Заливка цветом варианта с легкой прозрачностью для сохранения видимости дорожек/скана
      ctx.fillStyle = activeVariant.bodyColor || "#1e293b";
      ctx.strokeStyle = activeVariant.bodyBorderColor || "#475569";
      ctx.lineWidth = Math.max(1, 0.15 * pxPerMm);

      if (bodyShape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, bodyW / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (bodyShape === "d_shape") {
        const r = bodyW / 2;
        const cutRatio = 0.58;
        const d = r * cutRatio;
        const h = Math.sqrt(Math.max(0.1, r * r - d * d));
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(d, h);
        ctx.lineTo(d, -h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (bodyShape === "capsule") {
        const r = Math.min(bodyW, bodyH) / 2;
        const hw = bodyW / 2 - r;
        ctx.beginPath();
        ctx.arc(-hw, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.arc(hw, 0, r, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (bodyShape === "rect") {
        // Стандартный прямоугольный корпус по габаритам bodyWidth x bodyHeight
        const rx = Math.min(4, Math.min(bodyW, bodyH) * 0.05);
        if (typeof (ctx as any).roundRect === "function" && rx > 0) {
          ctx.beginPath();
          (ctx as any).roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, rx);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
          ctx.strokeRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
        }
      }

      // Ключ первого вывода из варианта (Notch / Dot / Chamfer)
      if (activeVariant.keyType === "notch") {
        const notchR = Math.min(bodyW, bodyH) * 0.1;
        ctx.beginPath();
        ctx.arc(0, -bodyH / 2, notchR, 0, Math.PI);
        ctx.fillStyle = "#0c101d";
        ctx.fill();
        ctx.stroke();
      } else if (activeVariant.keyType === "dot") {
        const dotR = Math.max(1.5, 0.35 * pxPerMm);
        ctx.beginPath();
        ctx.arc(-bodyW / 2 + dotR * 3, -bodyH / 2 + dotR * 3, dotR, 0, Math.PI * 2);
        ctx.fillStyle = "#f8fafc";
        ctx.fill();
      }
      ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 2. Векторные графические элементы из БД (pkg.graphics + variant.graphics)
    // -------------------------------------------------------------------------

    if (allGraphics.length > 0) {
      for (const g of allGraphics) {
        ctx.save();
        const strokeColor = activeVariant.silkscreenColor || (isTop ? "#f8fafc" : "#60a5fa");
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = strokeColor;
        ctx.lineWidth = Math.max(1, (g.strokeWidth || 0.15) * pxPerMm);

        if (g.kind === "line") {
          ctx.beginPath();
          ctx.moveTo(g.x1 * pxPerMm, g.y1 * pxPerMm);
          ctx.lineTo(g.x2 * pxPerMm, g.y2 * pxPerMm);
          ctx.stroke();
        } else if (g.kind === "rect") {
          const gx = (g.x - g.width / 2) * pxPerMm;
          const gy = (g.y - g.height / 2) * pxPerMm;
          const gw = g.width * pxPerMm;
          const gh = g.height * pxPerMm;
          if (g.filled) {
            ctx.fillRect(gx, gy, gw, gh);
          } else {
            ctx.strokeRect(gx, gy, gw, gh);
          }
        } else if (g.kind === "circle") {
          ctx.beginPath();
          ctx.arc(g.cx * pxPerMm, g.cy * pxPerMm, g.radius * pxPerMm, 0, Math.PI * 2);
          if (g.filled) {
            ctx.fill();
          } else {
            ctx.stroke();
          }
        } else if (g.kind === "arc") {
          ctx.beginPath();
          ctx.arc(
            g.cx * pxPerMm,
            g.cy * pxPerMm,
            g.radius * pxPerMm,
            (g.startAngle * Math.PI) / 180,
            (g.endAngle * Math.PI) / 180
          );
          ctx.stroke();
        } else if (g.kind === "d_shape") {
          const r = (g.diameter / 2) * pxPerMm;
          ctx.beginPath();
          ctx.arc(g.cx * pxPerMm, g.cy * pxPerMm, r, -Math.PI / 2, Math.PI / 2, false);
          ctx.lineTo((g.cx - g.diameter / 2 + g.cutDepth) * pxPerMm, g.cy * pxPerMm + r);
          ctx.lineTo((g.cx - g.diameter / 2 + g.cutDepth) * pxPerMm, g.cy * pxPerMm - r);
          ctx.closePath();
          ctx.stroke();
        } else if (g.kind === "capsule") {
          ctx.strokeRect((g.cx - g.width / 2) * pxPerMm, (g.cy - g.height / 2) * pxPerMm, g.width * pxPerMm, g.height * pxPerMm);
        } else if (g.kind === "text") {
          ctx.font = `${Math.max(8, g.fontSize * pxPerMm)}px sans-serif`;
          ctx.textAlign = g.align || "center";
          ctx.fillText(g.text, g.x * pxPerMm, g.y * pxPerMm);
        }
        ctx.restore();
      }
    }

    // -------------------------------------------------------------------------
    // 3. Контактные площадки (Pads) строго по геометрии из БД
    // -------------------------------------------------------------------------
    if (pkg && pkg.pads && pkg.pads.length > 0) {
      pkg.pads.forEach((pad, padIndex) => {
        const padX = pad.x * pxPerMm;
        const padY = pad.y * pxPerMm;
        const padW = Math.max(2, pad.width * pxPerMm);
        const padH = Math.max(2, pad.height * pxPerMm);
        const isTht = Boolean(pad.drillDiameter && pad.drillDiameter > 0);
        const isPin1 = String(pad.padNum) === "1" || padIndex === 0;

        // Цвет медной площадки (THT: янтарный/медный, SMD Top: золото, SMD Bottom: синий, NPTH: крепёжное отверстие)
        const isNpth = pad.plated === false;
        ctx.fillStyle = isNpth
          ? "#334155"
          : isTht
          ? "#d97706"
          : isTop
          ? "#f59e0b"
          : "#3b82f6";

        ctx.strokeStyle = isNpth ? "#1e293b" : isTht ? "#92400e" : isTop ? "#b45309" : "#1d4ed8";
        ctx.lineWidth = 1;

        const padRot = pad.rotation || 0;
        ctx.save();
        if (padRot !== 0) {
          ctx.translate(padX, padY);
          ctx.rotate((padRot * Math.PI) / 180);
          ctx.translate(-padX, -padY);
        }

        if (pad.shape === "circle") {
          ctx.beginPath();
          ctx.arc(padX, padY, padW / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (pad.shape === "rounded_rect") {
          const r = Math.min(padW, padH) * 0.25;
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(padX - padW / 2, padY - padH / 2, padW, padH, r);
          } else {
            ctx.rect(padX - padW / 2, padY - padH / 2, padW, padH);
          }
          ctx.fill();
          ctx.stroke();
        } else if (pad.shape === "chamfered_rect") {
          const ch = Math.min(padW, padH) * 0.25;
          const left = padX - padW / 2;
          const top = padY - padH / 2;
          const right = padX + padW / 2;
          const bot = padY + padH / 2;
          ctx.beginPath();
          ctx.moveTo(left + ch, top);
          ctx.lineTo(right, top);
          ctx.lineTo(right, bot);
          ctx.lineTo(left, bot);
          ctx.lineTo(left, top + ch);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (pad.shape === "d_shape") {
          const r = padW / 2;
          ctx.beginPath();
          ctx.arc(padX, padY, r, -Math.PI / 2, Math.PI / 2, false);
          ctx.lineTo(padX - padW / 2, padY + padH / 2);
          ctx.lineTo(padX - padW / 2, padY - padH / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.rect(padX - padW / 2, padY - padH / 2, padW, padH);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        // Отверстие металлизации (Drill Hole) для THT
        if (isTht) {
          const drillD = Math.max(1.5, (pad.drillDiameter || 1.0) * pxPerMm);
          ctx.fillStyle = "#0c101d";
          ctx.beginPath();
          ctx.arc(padX, padY, drillD / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Номер площадки (Pad Number): белый в отверстии THT, черный на площадке SMD
        if (padW >= 10 && padH >= 10 && pad.padNum !== undefined) {
          ctx.fillStyle = isTht ? "#ffffff" : "#000000";
          const fontSz = Math.max(7, Math.min(11, padH * 0.44));
          ctx.font = `bold ${fontSz}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(pad.padNum), padX, padY);
        }
      });
    }

    // -------------------------------------------------------------------------
    // 4. Позиционное обозначение и номинал (RefDes & Value)
    // -------------------------------------------------------------------------
    const showRef = comp.showRefDes !== false;
    const showVal = comp.showValue !== false && Boolean(comp.value);
    const labelText = showRef && showVal
      ? `${comp.refDes} · ${comp.value}`
      : showRef
      ? comp.refDes
      : showVal
      ? (comp.value || "")
      : "";

    let badgeW = 0;
    let badgeH = 0;
    let badgeY = -bodyH / 2 - 12;

    if (labelText) {
      const fontPx = Math.max(10, Math.min(13, 1.4 * pxPerMm));
      ctx.font = `bold ${fontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textWidth = ctx.measureText(labelText).width;
      badgeW = textWidth + 10;
      badgeH = fontPx + 6;
      // Размещаем над корпусом с достаточным зазором, чтобы не перекрывать маркер вращения
      badgeY = -bodyH / 2 - badgeH / 2 - 6;

      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = isSelected ? 1.5 : 1;

      if (typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        (ctx as any).roundRect(-badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
        ctx.strokeRect(-badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isSelected ? "var(--cad-accent-hover, #60a5fa)" : "#ffffff";
      ctx.fillText(labelText, 0, badgeY);
    }

    // -------------------------------------------------------------------------
    // 5. Рамка и маркеры выделения (Selection Box & Handles)
    // -------------------------------------------------------------------------
    if (isSelected) {
      const selPad = 4;
      const boxW = bodyW + selPad * 2;
      const boxH = bodyH + selPad * 2;

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.setLineDash([]);

      // 4 угловых маркера выделения (белые квадраты с синей окантовкой)
      const handleSize = 6;
      const corners = [
        [-boxW / 2, -boxH / 2],
        [boxW / 2, -boxH / 2],
        [boxW / 2, boxH / 2],
        [-boxW / 2, boxH / 2],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      });

      // Маркер поворота выносим НАД бейджем обозначения (или над корпусом, если бейдж скрыт)
      const startRotY = labelText ? badgeY - badgeH / 2 : -boxH / 2;
      const rotHandleY = startRotY - 12;
      ctx.beginPath();
      ctx.moveTo(0, startRotY);
      ctx.lineTo(0, rotHandleY);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, rotHandleY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
  stepMm: number,
  mmToPx: number
) {
  const baseStepPx = stepMm * mmToPx * zoom;
  if (baseStepPx <= 0) return;

  // Adaptive scaling: keep grid line spacing >= 22px for 60fps performance and clean visuals
  let mult = 1;
  const multipliers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  while (baseStepPx * mult < 22 && mult < 50000) {
    const next = multipliers.find((m) => m > mult);
    if (!next) {
      mult *= 2;
    } else {
      mult = next;
    }
  }

  const stepPx = baseStepPx * mult;

  // Major lines multiplier
  const isMetricDec = [0.1, 1.0, 10.0].some((v) => Math.abs(stepMm - v) < 0.001);
  const majorMult = isMetricDec ? 10 : 5;
  const majorStepPx = stepPx * majorMult;

  ctx.save();

  // 1. Minor grid lines (single path, fast bitwise rounding)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;

  const startX = ((pan.x % stepPx) + stepPx) % stepPx;
  const startY = ((pan.y % stepPx) + stepPx) % stepPx;

  ctx.beginPath();
  for (let x = startX; x <= width; x += stepPx) {
    const px = (x | 0) + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
  }
  for (let y = startY; y <= height; y += stepPx) {
    const py = (y | 0) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
  }
  ctx.stroke();

  // 2. Major grid lines
  if (majorStepPx >= 44) {
    ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
    ctx.lineWidth = 1;
    const majorStartX = ((pan.x % majorStepPx) + majorStepPx) % majorStepPx;
    const majorStartY = ((pan.y % majorStepPx) + majorStepPx) % majorStepPx;

    ctx.beginPath();
    for (let x = majorStartX; x <= width; x += majorStepPx) {
      const px = (x | 0) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = majorStartY; y <= height; y += majorStepPx) {
      const py = (y | 0) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();
  }

  // 3. Board Coordinate Axes
  const originScreenX = (pan.x | 0) + 0.5;
  if (originScreenX >= 0 && originScreenX <= width) {
    ctx.strokeStyle = "rgba(34, 197, 94, 0.35)"; // Green Y axis
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originScreenX, 0);
    ctx.lineTo(originScreenX, height);
    ctx.stroke();
  }

  const originScreenY = (pan.y | 0) + 0.5;
  if (originScreenY >= 0 && originScreenY <= height) {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.35)"; // Red X axis
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, originScreenY);
    ctx.lineTo(width, originScreenY);
    ctx.stroke();
  }

  // 4. (0,0) Board Origin Target & Crosshair
  if (
    pan.x >= -30 &&
    pan.x <= width + 30 &&
    pan.y >= -30 &&
    pan.y <= height + 30
  ) {
    const ox = (pan.x | 0) + 0.5;
    const oy = (pan.y | 0) + 0.5;

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(ox - 12, oy);
    ctx.lineTo(ox + 12, oy);
    ctx.stroke();

    ctx.strokeStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(ox, oy - 12);
    ctx.lineTo(ox, oy + 12);
    ctx.stroke();

    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.fillText("(0, 0)", ox + 8, oy - 7);
  }

  ctx.restore();
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: any,
  dragOffset: { x: number; y: number } | undefined,
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  mmToPx: number,
  zoom: number,
  cache: Map<string, HTMLImageElement>
) {
  const img = cache.get(layer.id);
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const effX = (layer.offsetX || 0) + (dragOffset?.x || 0);
  const effY = (layer.offsetY || 0) + (dragOffset?.y || 0);
  const pos = boardMmToScreen(effX, effY);
  const pxPerMm = layer.pxPerMm || 23.62;
  const wMm = img.naturalWidth / pxPerMm;
  const hMm = img.naturalHeight / pxPerMm;
  const wPx = wMm * mmToPx * zoom * (layer.scale || 1.0);
  const hPx = hMm * mmToPx * zoom * (layer.scale || 1.0);

  ctx.save();
  ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 0.85;

  ctx.translate(pos.x, pos.y);

  if (layer.rotation) {
    ctx.translate(wPx / 2, hPx / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-wPx / 2, -hPx / 2);
  }

  if (layer.mirrored) {
    ctx.translate(wPx, 0);
    ctx.scale(-1, 1);
  }
  if (layer.flipV) {
    ctx.translate(0, hPx);
    ctx.scale(1, -1);
  }

  // Blend mode support
  if (layer.blendMode && layer.blendMode !== "normal") {
    ctx.globalCompositeOperation = layer.blendMode;
  } else {
    ctx.globalCompositeOperation = "source-over";
  }

  // Optical filters & Tint
  let filterStr = "";
  if (layer.brightness !== undefined && layer.brightness !== 100) filterStr += `brightness(${layer.brightness}%) `;
  if (layer.contrast !== undefined && layer.contrast !== 100) filterStr += `contrast(${layer.contrast}%) `;
  if (layer.invert) filterStr += "invert(100%) ";
  if (layer.grayscale) filterStr += "grayscale(100%) ";

  if (layer.tintColor === "green") filterStr += "sepia(100%) hue-rotate(85deg) saturate(220%) ";
  else if (layer.tintColor === "blue") filterStr += "sepia(100%) hue-rotate(180deg) saturate(220%) ";
  else if (layer.tintColor === "red") filterStr += "sepia(100%) hue-rotate(320deg) saturate(250%) ";
  else if (layer.tintColor === "amber") filterStr += "sepia(100%) hue-rotate(30deg) saturate(300%) ";

  if (filterStr) ctx.filter = filterStr.trim();

  ctx.drawImage(img, 0, 0, wPx, hPx);
  ctx.restore();
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  layer: any,
  dragOffset: { x: number; y: number } | undefined,
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  mmToPx: number,
  zoom: number,
  cache: Map<string, HTMLImageElement>,
  isTransformMode: boolean = false
) {
  const img = cache.get(layer.id);
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const effX = (layer.offsetX || 0) + (dragOffset?.x || 0);
  const effY = (layer.offsetY || 0) + (dragOffset?.y || 0);
  const pos = boardMmToScreen(effX, effY);
  const pxPerMm = layer.pxPerMm || 23.62;
  const wMm = (img.naturalWidth / pxPerMm) * (layer.scale || 1.0);
  const hMm = (img.naturalHeight / pxPerMm) * (layer.scale || 1.0);
  const wPx = wMm * mmToPx * zoom;
  const hPx = hMm * mmToPx * zoom;

  ctx.save();
  ctx.translate(pos.x, pos.y);

  if (layer.rotation) {
    ctx.translate(wPx / 2, hPx / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-wPx / 2, -hPx / 2);
  }

  // Bounding box with glow
  ctx.shadowColor = isTransformMode ? "rgba(59, 130, 246, 0.7)" : "rgba(59, 130, 246, 0.35)";
  ctx.shadowBlur = isTransformMode ? 8 : 4;
  ctx.strokeStyle = isTransformMode ? "#60a5fa" : "#3b82f6";
  ctx.lineWidth = isTransformMode ? 1.5 : 1.2;
  ctx.setLineDash(isTransformMode ? [6, 3] : [4, 4]);
  ctx.strokeRect(-2, -2, wPx + 4, hPx + 4);
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  // Render handles and rotation lollipop ONLY in Transform tool
  if (isTransformMode) {
    // Rotation stem & lollipop
    const stemLen = 28;
    ctx.beginPath();
    ctx.moveTo(wPx / 2, -2);
    ctx.lineTo(wPx / 2, -2 - stemLen);
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Rotation handle circle
    ctx.beginPath();
    ctx.arc(wPx / 2, -2 - stemLen, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 8 resize handles
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;

    const hs = 8;
    const handles = [
      { x: -2, y: -2 },
      { x: wPx / 2, y: -2 },
      { x: wPx + 2, y: -2 },
      { x: wPx + 2, y: hPx / 2 },
      { x: wPx + 2, y: hPx + 2 },
      { x: wPx / 2, y: hPx + 2 },
      { x: -2, y: hPx + 2 },
      { x: -2, y: hPx / 2 },
    ];

    handles.forEach((h) => {
      ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
      ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
    });
  }

  // Name tag badge
  const sideLabel = layer.side === "top" ? "TOP" : "BOT";
  const badgeText = `${layer.name || "Скан"} (${sideLabel})${isTransformMode ? " · ТРАНСФОРМАЦИЯ" : ""}`;
  ctx.font = "bold 11px JetBrains Mono, monospace";
  const textW = ctx.measureText(badgeText).width;
  const badgeW = textW + 16;
  const badgeH = 20;

  ctx.fillStyle = "rgba(20, 24, 32, 0.94)";
  ctx.fillRect(-2, -badgeH - 6, badgeW, badgeH);
  ctx.strokeStyle = isTransformMode ? "#60a5fa" : "#3b82f6";
  ctx.lineWidth = 1;
  ctx.strokeRect(-2, -badgeH - 6, badgeW, badgeH);

  ctx.fillStyle = isTransformMode ? "#93c5fd" : "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, 6, -badgeH / 2 - 6);

  ctx.restore();
}

function drawMeasurementOverlay(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  rubberbandMm: { x: number; y: number } | null,
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  activeTool?: string
) {
  const p1 = boardMmToScreen(pts[0][0], pts[0][1]);
  let p2: { x: number; y: number };
  let dxMm: number;
  let dyMm: number;

  if (pts.length >= 2) {
    p2 = boardMmToScreen(pts[1][0], pts[1][1]);
    dxMm = pts[1][0] - pts[0][0];
    dyMm = pts[1][1] - pts[0][1];
  } else if (rubberbandMm) {
    p2 = boardMmToScreen(rubberbandMm.x, rubberbandMm.y);
    dxMm = rubberbandMm.x - pts[0][0];
    dyMm = rubberbandMm.y - pts[0][1];
  } else {
    // Single point
    ctx.save();
    ctx.fillStyle = activeTool === "level" ? "#f59e0b" : "#38bdf8";
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const distMm = Math.hypot(dxMm, dyMm);
  const distMil = distMm * 39.3701;
  const rawAngle = (Math.atan2(dyMm, dxMm) * 180) / Math.PI;

  let strokeColor = "#38bdf8";
  let text = `${distMm.toFixed(2)} мм (${distMil.toFixed(1)} mil)`;

  if (activeTool === "level") {
    strokeColor = "#f59e0b";
    const targets = [0, 90, 180, -180, -90];
    let minDiff = Infinity;
    let bestTarget = 0;
    for (const t of targets) {
      let diff = rawAngle - t;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      if (Math.abs(diff) < Math.abs(minDiff)) {
        minDiff = diff;
        bestTarget = t;
      }
    }
    const deltaDeg = Math.round(-minDiff * 100) / 100;
    const typeRu = bestTarget === 0 || Math.abs(bestTarget) === 180 ? "горизонт" : "вертикаль";
    const isNearZero = Math.abs(deltaDeg) < 1.0;
    text = isNearZero
      ? `Угол: ${rawAngle.toFixed(1)}° · Доворот: ${deltaDeg > 0 ? "+" : ""}${deltaDeg.toFixed(2)}° (линия уже параллельна оси)`
      : `Угол: ${rawAngle.toFixed(1)}° · Доворот: ${deltaDeg > 0 ? "+" : ""}${deltaDeg.toFixed(2)}° (${typeRu})`;

    // Draw reference horizontal axis through p1 to show the target orientation
    ctx.save();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p1.x - 2000, p1.y);
    ctx.lineTo(p1.x + 2000, p1.y);
    ctx.stroke();
    ctx.restore();
  } else if (activeTool === "calibrate") {
    strokeColor = "#10b981";
    text = `База: ${distMm.toFixed(2)} мм (${distMil.toFixed(1)} mil)`;
  }

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  // Endpoints
  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
  ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Distance / Angle label badge
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  ctx.font = "bold 11px JetBrains Mono, monospace";
  const tw = ctx.measureText(text).width + 16;

  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.fillRect(midX - tw / 2, midY - 14, tw, 24);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(midX - tw / 2, midY - 14, tw, 24);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, midX, midY - 2);

  ctx.restore();
}

function drawRegistrationTargets(
  ctx: CanvasRenderingContext2D,
  reg: { step: 1 | 2; topPts: [number, number][]; botPts: [number, number][] },
  boardMmToScreen: (x: number, y: number) => { x: number; y: number }
) {
  const drawTarget = (pt: [number, number], label: string, color: string) => {
    const p = boardMmToScreen(pt[0], pt[1]);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(p.x - 12, p.y);
    ctx.lineTo(p.x + 12, p.y);
    ctx.moveTo(p.x, p.y - 12);
    ctx.lineTo(p.x, p.y + 12);
    ctx.stroke();

    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(label, p.x + 10, p.y - 10);
    ctx.restore();
  };

  // Connecting line for Top reference points
  if (reg.topPts.length === 2) {
    const p1 = boardMmToScreen(reg.topPts[0][0], reg.topPts[0][1]);
    const p2 = boardMmToScreen(reg.topPts[1][0], reg.topPts[1][1]);
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  // Connecting line for Bottom points
  if (reg.botPts.length === 2) {
    const p1 = boardMmToScreen(reg.botPts[0][0], reg.botPts[0][1]);
    const p2 = boardMmToScreen(reg.botPts[1][0], reg.botPts[1][1]);
    ctx.save();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  reg.topPts.forEach((pt, idx) => drawTarget(pt, `Top-${idx + 1}`, "#38bdf8"));
  reg.botPts.forEach((pt, idx) => drawTarget(pt, `Bot-${idx + 1}`, "#f59e0b"));
}
