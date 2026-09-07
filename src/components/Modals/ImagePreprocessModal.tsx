import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  SlidersHorizontal,
  Sparkles,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Check,
  FastForward,
  Crop,
  Layers,
  Shapes,
  CircleDot,
  Loader2,
} from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import {
  engineClient,
  resolveImageUrl,
  Point2D,
  QuadPoints,
  CropRect,
} from "../../api/engineClient";
import "./ImagePreprocessModal.css";

type ToolMode = "perspective" | "crop" | "polygon" | "circle";

type DragHandle =
  | "topLeft"
  | "topRight"
  | "bottomRight"
  | "bottomLeft"
  | "cropNW"
  | "cropNE"
  | "cropSE"
  | "cropSW"
  | "cropN"
  | "cropS"
  | "cropE"
  | "cropW"
  | "cropMove"
  | "circleCenter"
  | "circleRadius"
  | `poly_${number}`
  | null;

export const ImagePreprocessModal: React.FC = () => {
  const { modals, closeModal, pendingPreprocess, setPendingPreprocess, preprocessSide } =
    useUiStore();
  const { updateImageLayer } = useProjectStore();

  const [mode, setMode] = useState<ToolMode>("perspective");
  const [side, setSide] = useState<"top" | "bottom">("top");
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Transforms & Tools State
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);
  const [isFlippedV, setIsFlippedV] = useState<boolean>(false);
  const [maxDimension, setMaxDimension] = useState<number>(0); // 0 = unlimited

  // 1. Perspective 4-points
  const [quad, setQuad] = useState<QuadPoints>({
    topLeft: { x: 50, y: 50 },
    topRight: { x: 950, y: 50 },
    bottomRight: { x: 950, y: 950 },
    bottomLeft: { x: 50, y: 950 },
  });

  // 2. Crop Rect
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 100,
    y: 100,
    width: 800,
    height: 600,
  });

  // 3. Polygon
  const [polygonPoints, setPolygonPoints] = useState<Point2D[]>([]);

  // 4. Circle / Ellipse
  const [ellipseParams, setEllipseParams] = useState<{
    cx: number;
    cy: number;
    rx: number;
    ry: number;
  }>({ cx: 500, cy: 500, rx: 300, ry: 300 });

  // Dragging state
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialCropRect, setInitialCropRect] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

  // Loupe
  const [loupeState, setLoupeState] = useState<{
    visible: boolean;
    screenX: number;
    screenY: number;
    imgX: number;
    imgY: number;
  }>({ visible: false, screenX: 0, screenY: 0, imgX: 0, imgY: 0 });

  const [loading, setLoading] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const hasFittedRef = useRef<boolean>(false);

  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Attach ResizeObserver to viewport container for responsive resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setViewportSize({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Fit image inside viewport
  const fitToScreen = useCallback(
    (w?: number, h?: number, vpW?: number, vpH?: number) => {
      const container = containerRef.current;
      const vw = vpW || container?.clientWidth || viewportSize.width || 800;
      const vh = vpH || container?.clientHeight || viewportSize.height || 600;
      const imgW = w || naturalDims.width;
      const imgH = h || naturalDims.height;

      if (!imgW || !imgH || vw <= 0 || vh <= 0) return;

      // When rotated 90 or 270 degrees, effective width and height swap
      const isRotated90 = rotationAngle === 90 || rotationAngle === 270;
      const effW = isRotated90 ? imgH : imgW;
      const effH = isRotated90 ? imgW : imgH;

      const pad = 48;
      const scale = Math.min((vw - pad) / effW, (vh - pad) / effH, 1.5);
      // Support massive scans (e.g. 15,000+ px) without artificial cutoffs
      const clampedScale = Math.max(scale, 0.001);

      setZoom(clampedScale);
      setPan({
        x: (vw - imgW * clampedScale) / 2,
        y: (vh - imgH * clampedScale) / 2,
      });
    },
    [naturalDims, viewportSize, rotationAngle]
  );

  // Initialize on open
  useEffect(() => {
    if (!modals.preprocess || !pendingPreprocess) return;

    const s = pendingPreprocess.side || preprocessSide || "top";
    setSide(s);
    setErrorMsg(null);
    setRotationAngle(0);
    setIsFlippedH(s === "bottom"); // default flip H for bottom scan
    setIsFlippedV(false);
    setMode("perspective");
    hasFittedRef.current = false;

    let sourceUrl = pendingPreprocess.filePath || pendingPreprocess.dataUrl || "";

    const loadImg = async () => {
      setLoading(true);
      try {
        let displayUrl = sourceUrl;
        if (pendingPreprocess.filePath) {
          displayUrl = await resolveImageUrl(pendingPreprocess.filePath);
        } else if (pendingPreprocess.file && !sourceUrl) {
          displayUrl = URL.createObjectURL(pendingPreprocess.file);
        }
        setCurrentSrc(displayUrl);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          loadedImageRef.current = img;
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          setNaturalDims({ width: w, height: h });

          // Default 4-corners with 4% margin
          const q: QuadPoints = {
            topLeft: { x: w * 0.04, y: h * 0.04 },
            topRight: { x: w * 0.96, y: h * 0.04 },
            bottomRight: { x: w * 0.96, y: h * 0.96 },
            bottomLeft: { x: w * 0.04, y: h * 0.96 },
          };
          setQuad(q);

          // Default crop rect
          setCropRect({
            x: w * 0.05,
            y: h * 0.05,
            width: w * 0.9,
            height: h * 0.9,
          });

          // Default polygon
          setPolygonPoints([
            { x: w * 0.1, y: h * 0.1 },
            { x: w * 0.9, y: h * 0.1 },
            { x: w * 0.9, y: h * 0.9 },
            { x: w * 0.1, y: h * 0.9 },
          ]);

          // Default ellipse
          setEllipseParams({
            cx: w / 2,
            cy: h / 2,
            rx: (w * 0.45) / 2,
            ry: (h * 0.45) / 2,
          });

          setLoading(false);
          hasFittedRef.current = true;
          fitToScreen(w, h);
        };
        img.onerror = () => {
          setErrorMsg("Не удалось загрузить изображение");
          setLoading(false);
        };
        img.src = displayUrl;
      } catch (err: any) {
        setErrorMsg(err?.message || "Ошибка загрузки изображения");
        setLoading(false);
      }
    };

    loadImg();
  }, [modals.preprocess, pendingPreprocess]);

  // Once layout measurements are ready, fit if not yet fitted
  useEffect(() => {
    if (viewportSize.width > 50 && viewportSize.height > 50 && naturalDims.width > 0) {
      if (!hasFittedRef.current) {
        hasFittedRef.current = true;
        fitToScreen(naturalDims.width, naturalDims.height, viewportSize.width, viewportSize.height);
      }
    }
  }, [viewportSize, naturalDims, fitToScreen]);

  // Image to Screen Coordinates (synchronously applying center-based rotation and flipping)
  const imageToScreen = useCallback(
    (ix: number, iy: number): Point2D => {
      let x = ix;
      let y = iy;
      if (rotationAngle !== 0 || isFlippedH || isFlippedV) {
        const cx = (naturalDims.width || 800) / 2;
        const cy = (naturalDims.height || 600) / 2;
        let dx = x - cx;
        let dy = y - cy;
        if (rotationAngle !== 0) {
          const rad = (rotationAngle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rx = dx * cos - dy * sin;
          const ry = dx * sin + dy * cos;
          dx = rx;
          dy = ry;
        }
        if (isFlippedH) dx = -dx;
        if (isFlippedV) dy = -dy;
        x = dx + cx;
        y = dy + cy;
      }
      return {
        x: x * zoom + pan.x,
        y: y * zoom + pan.y,
      };
    },
    [pan, zoom, naturalDims, rotationAngle, isFlippedH, isFlippedV]
  );

  // Screen to Image Coordinates (exact inverse of imageToScreen)
  const screenToImage = useCallback(
    (sx: number, sy: number): Point2D => {
      let x = (sx - pan.x) / zoom;
      let y = (sy - pan.y) / zoom;
      if (rotationAngle !== 0 || isFlippedH || isFlippedV) {
        const cx = (naturalDims.width || 800) / 2;
        const cy = (naturalDims.height || 600) / 2;
        let dx = x - cx;
        let dy = y - cy;
        if (isFlippedH) dx = -dx;
        if (isFlippedV) dy = -dy;
        if (rotationAngle !== 0) {
          const rad = (rotationAngle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          // Inverse rotation by -rotationAngle
          const rx = dx * cos + dy * sin;
          const ry = -dx * sin + dy * cos;
          dx = rx;
          dy = ry;
        }
        x = dx + cx;
        y = dy + cy;
      }
      return { x, y };
    },
    [pan, zoom, naturalDims, rotationAngle, isFlippedH, isFlippedV]
  );

  // Auto-detect corners with Magic Wand
  const handleAutoDetect = async () => {
    const rawPath = pendingPreprocess?.filePath;
    if (!rawPath) return;

    setIsDetecting(true);
    setErrorMsg(null);
    try {
      const autoQuad = await engineClient.detectCorners(rawPath);
      if (autoQuad && autoQuad.topLeft) {
        setQuad(autoQuad);
      }
    } catch (e: any) {
      console.warn("Auto detect failed, keeping current corners:", e);
    } finally {
      setIsDetecting(false);
    }
  };

  // Close modal
  const handleClose = () => {
    setPendingPreprocess(null);
    closeModal("preprocess");
  };

  // Bypass: insert original without transformations
  const handleBypass = async () => {
    if (!pendingPreprocess) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const rawPath = pendingPreprocess.filePath;
      if (rawPath) {
        const layer = await engineClient.importImage(rawPath, side);
        layer.mirrored = isFlippedH;
        layer.flipV = isFlippedV;
        layer.rotation = rotationAngle;
        await updateImageLayer(layer);
      }
      handleClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Ошибка импорта исходного файла");
    } finally {
      setLoading(false);
    }
  };

  // Apply transformation
  const handleApply = async () => {
    if (!pendingPreprocess) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const source = pendingPreprocess.filePath || pendingPreprocess.dataUrl || currentSrc;
      let op: any;

      const maxDim = maxDimension > 0 ? maxDimension : undefined;

      if (mode === "perspective") {
        op = {
          type: "warpPerspective",
          quad,
          maxDimension: maxDim,
          quality: 90,
          mimeType: "image/png",
        };
      } else if (mode === "crop") {
        op = {
          type: "crop",
          rect: cropRect,
          maxDimension: maxDim,
          quality: 90,
          mimeType: "image/png",
        };
      } else if (mode === "polygon") {
        op = {
          type: "cropPolygon",
          points: polygonPoints,
          maxDimension: maxDim,
          quality: 90,
        };
      } else {
        op = {
          type: "cropEllipse",
          cx: ellipseParams.cx,
          cy: ellipseParams.cy,
          rx: ellipseParams.rx,
          ry: ellipseParams.ry,
          maxDimension: maxDim,
          quality: 90,
        };
      }

      const layer = await engineClient.processAndSaveImage(
        { source, operation: op },
        side,
        pendingPreprocess.name
      );

      layer.mirrored = isFlippedH;
      layer.flipV = isFlippedV;
      layer.rotation = rotationAngle;

      await updateImageLayer(layer);
      handleClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Ошибка применения трансформации");
    } finally {
      setLoading(false);
    }
  };

  // Render Viewport Canvas & Overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    const container = containerRef.current;
    if (!canvas || !img || naturalDims.width === 0 || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // High quality downsampling for massive scans
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw Transformed Image onto Canvas
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Center transform
    const cx = naturalDims.width / 2;
    const cy = naturalDims.height / 2;
    ctx.translate(cx, cy);
    if (rotationAngle !== 0) ctx.rotate((rotationAngle * Math.PI) / 180);
    if (isFlippedH || isFlippedV) ctx.scale(isFlippedH ? -1 : 1, isFlippedV ? -1 : 1);
    ctx.translate(-cx, -cy);

    ctx.drawImage(img, 0, 0, naturalDims.width, naturalDims.height);
    ctx.restore();

    ctx.restore();
  }, [pan, zoom, naturalDims, rotationAngle, isFlippedH, isFlippedV, viewportSize]);

  // Update Magnifier Loupe
  const updateLoupe = useCallback(
    (imgPt: Point2D, screenPt: Point2D) => {
      const loupeCanvas = loupeCanvasRef.current;
      const img = loadedImageRef.current;
      if (!loupeCanvas || !img) return;

      const ctx = loupeCanvas.getContext("2d");
      if (!ctx) return;

      const size = 128;
      if (loupeCanvas.width !== size || loupeCanvas.height !== size) {
        loupeCanvas.width = size;
        loupeCanvas.height = size;
      }

      ctx.clearRect(0, 0, size, size);

      // Loupe zoom factor
      const mag = 4;

      ctx.save();
      ctx.translate(size / 2, size / 2);
      if (rotationAngle !== 0) ctx.rotate((rotationAngle * Math.PI) / 180);
      if (isFlippedH || isFlippedV) ctx.scale(isFlippedH ? -1 : 1, isFlippedV ? -1 : 1);
      ctx.imageSmoothingEnabled = false; // pixel-crisp magnification
      ctx.drawImage(
        img,
        -imgPt.x * mag,
        -imgPt.y * mag,
        (img.naturalWidth || naturalDims.width) * mag,
        (img.naturalHeight || naturalDims.height) * mag
      );
      ctx.restore();

      // Subpixel Crosshair
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(size / 2, 0);
      ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size, size / 2);
      ctx.stroke();

      // Center ring
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      setLoupeState({
        visible: true,
        screenX: screenPt.x,
        screenY: screenPt.y,
        imgX: Math.round(imgPt.x),
        imgY: Math.round(imgPt.y),
      });
    },
    [rotationAngle, isFlippedH, isFlippedV, naturalDims]
  );

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.001, Math.min(30, zoom * factor));

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || (e.button === 0 && !activeHandle)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!activeHandle) return;

    const imgPt = screenToImage(screenX, screenY);
    imgPt.x = Math.max(0, Math.min(naturalDims.width, imgPt.x));
    imgPt.y = Math.max(0, Math.min(naturalDims.height, imgPt.y));

    if (mode === "perspective") {
      setQuad((prev) => ({
        ...prev,
        [activeHandle as keyof QuadPoints]: imgPt,
      }));
      updateLoupe(imgPt, { x: screenX, y: screenY });
    } else if (mode === "crop") {
      setCropRect((prev) => {
        let { x, y, width, height } = prev;
        if (activeHandle === "cropNW") {
          const rX = x + width;
          const rY = y + height;
          x = Math.min(imgPt.x, rX - 10);
          y = Math.min(imgPt.y, rY - 10);
          width = rX - x;
          height = rY - y;
        } else if (activeHandle === "cropNE") {
          const rY = y + height;
          width = Math.max(10, imgPt.x - x);
          y = Math.min(imgPt.y, rY - 10);
          height = rY - y;
        } else if (activeHandle === "cropSE") {
          width = Math.max(10, imgPt.x - x);
          height = Math.max(10, imgPt.y - y);
        } else if (activeHandle === "cropSW") {
          const rX = x + width;
          x = Math.min(imgPt.x, rX - 10);
          width = rX - x;
          height = Math.max(10, imgPt.y - y);
        } else if (activeHandle === "cropN") {
          const rY = y + height;
          y = Math.min(imgPt.y, rY - 10);
          height = rY - y;
        } else if (activeHandle === "cropS") {
          height = Math.max(10, imgPt.y - y);
        } else if (activeHandle === "cropE") {
          width = Math.max(10, imgPt.x - x);
        } else if (activeHandle === "cropW") {
          const rX = x + width;
          x = Math.min(imgPt.x, rX - 10);
          width = rX - x;
        } else if (activeHandle === "cropMove") {
          const dx = (screenX - dragStartPos.x) / zoom;
          const dy = (screenY - dragStartPos.y) / zoom;
          x = Math.max(0, Math.min(naturalDims.width - width, initialCropRect.x + dx));
          y = Math.max(0, Math.min(naturalDims.height - height, initialCropRect.y + dy));
        }
        return { x, y, width, height };
      });
    } else if (mode === "circle") {
      if (activeHandle === "circleCenter") {
        setEllipseParams((prev) => ({ ...prev, cx: imgPt.x, cy: imgPt.y }));
      } else if (activeHandle === "circleRadius") {
        setEllipseParams((prev) => ({
          ...prev,
          rx: Math.max(10, Math.abs(imgPt.x - prev.cx)),
          ry: Math.max(10, Math.abs(imgPt.y - prev.cy)),
        }));
      }
    } else if (mode === "polygon" && activeHandle?.startsWith("poly_")) {
      const idx = parseInt(activeHandle.replace("poly_", ""), 10);
      setPolygonPoints((prev) => {
        const next = [...prev];
        next[idx] = imgPt;
        return next;
      });
      updateLoupe(imgPt, { x: screenX, y: screenY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setActiveHandle(null);
    setLoupeState((prev) => ({ ...prev, visible: false }));
  };

  if (!modals.preprocess || !pendingPreprocess) return null;

  // Convert points for SVG overlay
  const tlScreen = imageToScreen(quad.topLeft.x, quad.topLeft.y);
  const trScreen = imageToScreen(quad.topRight.x, quad.topRight.y);
  const brScreen = imageToScreen(quad.bottomRight.x, quad.bottomRight.y);
  const blScreen = imageToScreen(quad.bottomLeft.x, quad.bottomLeft.y);

  const cropTl = imageToScreen(cropRect.x, cropRect.y);
  const cropBr = imageToScreen(cropRect.x + cropRect.width, cropRect.y + cropRect.height);
  const cropScreen = {
    x: Math.min(cropTl.x, cropBr.x),
    y: Math.min(cropTl.y, cropBr.y),
    width: Math.abs(cropBr.x - cropTl.x),
    height: Math.abs(cropBr.y - cropTl.y),
  };

  return (
    <div className="cad-preprocess-backdrop" onClick={handleClose}>
      <div className="cad-preprocess-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cad-preprocess-header">
          <div className="header-title-group">
            <div className="header-icon-badge">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <div className="modal-title">
                Предобработка фото платы ({naturalDims.width} × {naturalDims.height} px)
              </div>
              <div className="modal-subtitle">
                Кадрирование, выравнивание перспективы и подготовка для PCB слоя{" "}
                <strong style={{ color: side === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)" }}>
                  {side.toUpperCase()}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Side selector */}
            <div className="cad-preprocess-side-select">
              <button
                className={`cad-preprocess-side-btn ${side === "top" ? "active top" : ""}`}
                onClick={() => setSide("top")}
              >
                Top (Верхний)
              </button>
              <button
                className={`cad-preprocess-side-btn ${side === "bottom" ? "active bottom" : ""}`}
                onClick={() => {
                  setSide("bottom");
                  setIsFlippedH(true);
                }}
              >
                Bottom (Нижний)
              </button>
            </div>

            <button className="header-close-btn" onClick={handleClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="cad-preprocess-toolbar">
          {/* Tool Modes */}
          <div className="tool-tabs">
            <button
              className={`tool-tab-btn ${mode === "perspective" ? "active" : ""}`}
              onClick={() => setMode("perspective")}
              title="Выравнивание трапеции по 4 углам"
            >
              <Shapes size={14} />
              <span>4 Угла (Трапеция)</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "crop" ? "active" : ""}`}
              onClick={() => setMode("crop")}
              title="Прямоугольное кадрирование"
            >
              <Crop size={14} />
              <span>Прямоугольник</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "polygon" ? "active" : ""}`}
              onClick={() => setMode("polygon")}
              title="Многоугольник"
            >
              <Layers size={14} />
              <span>Многоугольник</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "circle" ? "active" : ""}`}
              onClick={() => setMode("circle")}
              title="Круг или эллипс"
            >
              <CircleDot size={14} />
              <span>Круг/Овал</span>
            </button>
          </div>

          {mode === "perspective" && (
            <button
              className="cad-preprocess-tool-btn auto-detect-btn"
              onClick={handleAutoDetect}
              disabled={isDetecting || !pendingPreprocess.filePath}
              title="Найти углы платы автоматически с помощью компьютерного зрения"
            >
              {isDetecting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>Магическая палочка</span>
            </button>
          )}

          <div className="toolbar-divider" />

          {/* Quick transforms */}
          <div className="tool-actions-group">
            <button
              className="cad-preprocess-tool-btn"
              onClick={() => setRotationAngle((r) => (r - 90 + 360) % 360)}
              title="Повернуть на 90° против часовой стрелки"
            >
              <RotateCcw size={13} />
              <span>90° влево</span>
            </button>
            <button
              className="cad-preprocess-tool-btn"
              onClick={() => setRotationAngle((r) => (r + 90) % 360)}
              title="Повернуть на 90° по часовой стрелке"
            >
              <RotateCw size={13} />
              <span>90° вправо</span>
            </button>
            <button
              className={`cad-preprocess-tool-btn ${isFlippedH ? "active" : ""}`}
              onClick={() => setIsFlippedH((f) => !f)}
              title="Отзеркалить по горизонтали (рекомендуется для Bottom-сканов)"
            >
              <FlipHorizontal size={13} />
              <span>Отзеркалить</span>
            </button>
            <button
              className={`cad-preprocess-tool-btn ${isFlippedV ? "active" : ""}`}
              onClick={() => setIsFlippedV((f) => !f)}
              title="Отзеркалить по вертикали"
            >
              <FlipVertical size={13} />
            </button>
          </div>

          <div className="toolbar-spacer" />

          {/* Zoom & Fit */}
          <div className="tool-actions-group">
            <button className="cad-preprocess-tool-btn" onClick={() => fitToScreen()} title="По размеру окна">
              <Maximize2 size={13} />
              <span>По размеру</span>
            </button>
            <button
              className="cad-preprocess-tool-btn"
              onClick={() => setZoom((z) => Math.min(30, z * 1.3))}
              title="Приблизить"
            >
              <ZoomIn size={13} />
            </button>
            <span style={{ fontSize: "11px", color: "var(--cad-text-muted)", minWidth: "38px", textAlign: "center" }}>
              {zoom < 0.1 ? `${(zoom * 100).toFixed(1)}%` : `${Math.round(zoom * 100)}%`}
            </span>
            <button
              className="cad-preprocess-tool-btn"
              onClick={() => setZoom((z) => Math.max(0.001, z / 1.3))}
              title="Отдалить"
            >
              <ZoomOut size={13} />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          className="cad-preprocess-viewport"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Main Rendering Canvas */}
          <canvas ref={canvasRef} className="cad-preprocess-canvas-layer" />

          {/* Interactive SVG Overlay */}
          <svg className="cad-preprocess-svg-overlay">
            {/* Mode 1: Perspective Quad Overlay */}
            {mode === "perspective" && (
              <>
                <polygon
                  points={`${tlScreen.x},${tlScreen.y} ${trScreen.x},${trScreen.y} ${brScreen.x},${brScreen.y} ${blScreen.x},${blScreen.y}`}
                  fill="rgba(56, 189, 248, 0.12)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />
                {/* 4 Corner Handles */}
                {[
                  { key: "topLeft", pt: tlScreen, label: "Top-Left" },
                  { key: "topRight", pt: trScreen, label: "Top-Right" },
                  { key: "bottomRight", pt: brScreen, label: "Bottom-Right" },
                  { key: "bottomLeft", pt: blScreen, label: "Bottom-Left" },
                ].map((item) => (
                  <g key={item.key}>
                    <circle
                      cx={item.pt.x}
                      cy={item.pt.y}
                      r="7"
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cad-preprocess-handle"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle(item.key as DragHandle);
                      }}
                    />
                  </g>
                ))}
              </>
            )}

            {/* Mode 2: Rectangular Crop Overlay */}
            {mode === "crop" && (
              <>
                <rect
                  x={cropScreen.x}
                  y={cropScreen.y}
                  width={cropScreen.width}
                  height={cropScreen.height}
                  className="cad-preprocess-crop-rect"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setActiveHandle("cropMove");
                    setDragStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    setInitialCropRect(cropRect);
                  }}
                  style={{ cursor: "move", fill: "rgba(56, 189, 248, 0.12)" }}
                />
                {/* 8 Resize Handles */}
                {[
                  { handle: "cropNW", cx: cropScreen.x, cy: cropScreen.y },
                  { handle: "cropNE", cx: cropScreen.x + cropScreen.width, cy: cropScreen.y },
                  { handle: "cropSE", cx: cropScreen.x + cropScreen.width, cy: cropScreen.y + cropScreen.height },
                  { handle: "cropSW", cx: cropScreen.x, cy: cropScreen.y + cropScreen.height },
                  { handle: "cropN", cx: cropScreen.x + cropScreen.width / 2, cy: cropScreen.y },
                  { handle: "cropS", cx: cropScreen.x + cropScreen.width / 2, cy: cropScreen.y + cropScreen.height },
                  { handle: "cropE", cx: cropScreen.x + cropScreen.width, cy: cropScreen.y + cropScreen.height / 2 },
                  { handle: "cropW", cx: cropScreen.x, cy: cropScreen.y + cropScreen.height / 2 },
                ].map((item) => (
                  <circle
                    key={item.handle}
                    cx={item.cx}
                    cy={item.cy}
                    r="6"
                    className="cad-preprocess-crop-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setActiveHandle(item.handle as DragHandle);
                    }}
                  />
                ))}
              </>
            )}

            {/* Mode 3: Polygon Overlay */}
            {mode === "polygon" && polygonPoints.length > 0 && (
              <>
                <polygon
                  points={polygonPoints
                    .map((p) => {
                      const s = imageToScreen(p.x, p.y);
                      return `${s.x},${s.y}`;
                    })
                    .join(" ")}
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                {polygonPoints.map((p, idx) => {
                  const sPt = imageToScreen(p.x, p.y);
                  return (
                    <circle
                      key={idx}
                      cx={sPt.x}
                      cy={sPt.y}
                      r="6"
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cad-preprocess-handle"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle(`poly_${idx}` as DragHandle);
                      }}
                    />
                  );
                })}
              </>
            )}

            {/* Mode 4: Circle / Ellipse Overlay */}
            {mode === "circle" && (() => {
              const cPt = imageToScreen(ellipseParams.cx, ellipseParams.cy);
              const rPt = imageToScreen(ellipseParams.cx + ellipseParams.rx, ellipseParams.cy);
              const rxS = Math.abs(rPt.x - cPt.x) || (ellipseParams.rx * zoom);
              const ryS = ellipseParams.ry * zoom;
              return (
                <>
                  <ellipse
                    cx={cPt.x}
                    cy={cPt.y}
                    rx={rxS}
                    ry={ryS}
                    fill="rgba(56, 189, 248, 0.15)"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />
                  <circle
                    cx={cPt.x}
                    cy={cPt.y}
                    r="7"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cad-preprocess-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setActiveHandle("circleCenter");
                    }}
                  />
                  <circle
                    cx={cPt.x + rxS}
                    cy={cPt.y}
                    r="6"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="cad-preprocess-handle"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setActiveHandle("circleRadius");
                    }}
                  />
                </>
              );
            })()}
          </svg>

          {/* Floating Magnifier Loupe */}
          <div
            className={`cad-preprocess-loupe ${loupeState.visible ? "visible" : ""}`}
            style={{
              left: `${Math.min(window.innerWidth - 180, Math.max(20, loupeState.screenX + 30))}px`,
              top: `${Math.min(window.innerHeight - 180, Math.max(20, loupeState.screenY - 140))}px`,
            }}
          >
            <canvas ref={loupeCanvasRef} />
            <div className="loupe-label">
              X:{loupeState.imgX} Y:{loupeState.imgY}
            </div>
          </div>

          {/* Bottom Hint */}
          <div className="cad-preprocess-hint">
            {mode === "perspective" && "Перетащите 4 маркера на реальные углы платы для выравнивания трапеции."}
            {mode === "crop" && "Потяните за края рамки или центр для кадрирования нужной области."}
            {mode === "polygon" && "Перемещайте точки контура платы для произвольной обрезки."}
            {mode === "circle" && "Настройте центр и радиус для круглых печатных плат."}
          </div>
        </div>

        {/* Footer */}
        <div className="cad-preprocess-footer">
          <div className="cad-preprocess-footer-left">
            <div className="cad-preprocess-scale-select">
              <span>Лимит разрешения:</span>
              <select
                value={maxDimension}
                onChange={(e) => setMaxDimension(parseInt(e.target.value, 10))}
              >
                <option value={0}>Исходное (без сжатия)</option>
                <option value={4096}>4K (макс 4096 px)</option>
                <option value={2048}>2K (макс 2048 px)</option>
                <option value={1920}>1080p (макс 1920 px)</option>
              </select>
            </div>

            {errorMsg && (
              <span style={{ color: "#ef4444", fontSize: "12px" }}>
                {errorMsg}
              </span>
            )}
          </div>

          <div className="cad-preprocess-footer-right">
            <button className="cad-btn-secondary" onClick={handleClose} disabled={loading}>
              Отмена
            </button>
            <button
              className="cad-btn-secondary"
              onClick={handleBypass}
              disabled={loading}
              title="Вставить фото без кадрирования и трансформации"
            >
              <FastForward size={14} />
              <span>Пропустить (как есть)</span>
            </button>
            <button className="cad-btn-primary" onClick={handleApply} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Обработка...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Применить</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
