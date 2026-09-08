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
  Eye,
  Grid,
  HelpCircle,
  ArrowLeft,
  RefreshCw,
  SplitSquareVertical,
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
import { reportError } from "../../utils/errorHandler";
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
  const { modals, closeModal, pendingPreprocess, setPendingPreprocess, activeWorkLayer } =
    useUiStore();
  const { updateImageLayer } = useProjectStore();

  const side: "top" | "bottom" =
    pendingPreprocess?.side ||
    (activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top");

  const [mode, setMode] = useState<ToolMode>("perspective");
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

  // Magnifier Loupe
  const [loupeState, setLoupeState] = useState<{
    visible: boolean;
    screenX: number;
    screenY: number;
    imgX: number;
    imgY: number;
  }>({ visible: false, screenX: 0, screenY: 0, imgX: 0, imgY: 0 });

  // Quick Preview State
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewDims, setPreviewDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [showOriginalCompare, setShowOriginalCompare] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showCustomResModal, setShowCustomResModal] = useState<boolean>(false);
  const [customResInput, setCustomResInput] = useState<string>("3000");
  const [isSplitCompare, setIsSplitCompare] = useState<boolean>(false);
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editViewportRef = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null);
  const previewViewportRef = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null);
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

      const isRotated90 = rotationAngle === 90 || rotationAngle === 270;
      const effW = isRotated90 ? imgH : imgW;
      const effH = isRotated90 ? imgW : imgH;

      const pad = 48;
      const scale = Math.min((vw - pad) / effW, (vh - pad) / effH, 1.5);
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

    setErrorMsg(null);
    setRotationAngle(0);
    setIsFlippedH(side === "bottom"); // default flip H for bottom scan
    setIsFlippedV(false);
    setMode("perspective");
    setIsPreviewMode(false);
    setIsSplitCompare(false);
    setSplitPos(0.5);
    previewCanvasRef.current = null;
    compareCanvasRef.current = null;
    editViewportRef.current = null;
    previewViewportRef.current = null;
    hasFittedRef.current = false;

    let sourceUrl = pendingPreprocess.filePath || pendingPreprocess.dataUrl || "";

    const loadImg = async () => {
      setLoading(true);
      try {
        let displayUrl = sourceUrl;
        const filePath =
          pendingPreprocess.filePath ||
          (pendingPreprocess.file as any)?.path ||
          (pendingPreprocess.file as any)?.filePath;

        if (filePath) {
          displayUrl = await resolveImageUrl(filePath);
        } else if (pendingPreprocess.file) {
          const isTif =
            /\.(tiff?)$/i.test(pendingPreprocess.file.name) ||
            pendingPreprocess.file.type.includes("tiff");
          if (isTif && typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
            const buf = await pendingPreprocess.file.arrayBuffer();
            displayUrl = await engineClient.convertTiffBytes(new Uint8Array(buf));
          } else if (!sourceUrl) {
            displayUrl = URL.createObjectURL(pendingPreprocess.file);
          }
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

  // Layout measurements fit
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

  // Screen to Preview Image Coordinates (for previewCanvas)
  const screenToPreview = useCallback(
    (sx: number, sy: number): Point2D => {
      const activeW = previewCanvasRef.current?.width || naturalDims.width || 800;
      const activeH = previewCanvasRef.current?.height || naturalDims.height || 600;
      let x = (sx - pan.x) / zoom;
      let y = (sy - pan.y) / zoom;
      if (rotationAngle !== 0 || isFlippedH || isFlippedV) {
        const cx = activeW / 2;
        const cy = activeH / 2;
        let dx = x - cx;
        let dy = y - cy;
        if (isFlippedH) dx = -dx;
        if (isFlippedV) dy = -dy;
        if (rotationAngle !== 0) {
          const rad = (rotationAngle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
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

  // Preview Image to Screen Coordinates
  const previewToScreen = useCallback(
    (px: number, py: number): Point2D => {
      const activeW = previewCanvasRef.current?.width || naturalDims.width || 800;
      const activeH = previewCanvasRef.current?.height || naturalDims.height || 600;
      let x = px;
      let y = py;
      if (rotationAngle !== 0 || isFlippedH || isFlippedV) {
        const cx = activeW / 2;
        const cy = activeH / 2;
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

  // Auto-detect corners with Magic Wand
  const handleAutoDetect = async () => {
    const rawPath =
      pendingPreprocess?.filePath ||
      (pendingPreprocess?.file as any)?.path ||
      (pendingPreprocess?.file as any)?.filePath;
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
  const handleClose = useCallback(() => {
    setPendingPreprocess(null);
    closeModal("preprocess");
  }, [closeModal, setPendingPreprocess]);

  // Construct operation object
  const getOperation = useCallback(
    (forPreview: boolean = false) => {
      const maxDim = forPreview ? 1400 : maxDimension > 0 ? maxDimension : undefined;
      if (mode === "perspective") {
        return {
          type: "warpPerspective" as const,
          quad,
          maxDimension: maxDim,
          quality: 88,
          mimeType: "image/jpeg",
        };
      } else if (mode === "crop") {
        return {
          type: "crop" as const,
          rect: cropRect,
          maxDimension: maxDim,
          quality: 88,
          mimeType: "image/jpeg",
        };
      } else if (mode === "polygon") {
        return {
          type: "cropPolygon" as const,
          points: polygonPoints,
          maxDimension: maxDim,
          quality: 88,
        };
      } else {
        return {
          type: "cropEllipse" as const,
          cx: ellipseParams.cx,
          cy: ellipseParams.cy,
          rx: ellipseParams.rx,
          ry: ellipseParams.ry,
          maxDimension: maxDim,
          quality: 88,
        };
      }
    },
    [mode, quad, cropRect, polygonPoints, ellipseParams, maxDimension]
  );

// ==========================================================================
// Ultra-Fast GPU-Accelerated Client-Side Preview Generators (<15ms)
// ==========================================================================

function renderPerspectiveWarp(
  img: HTMLImageElement,
  quad: QuadPoints,
  maxPreviewDim = 2048
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const dTop = Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y);
  const dBottom = Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y);
  const dLeft = Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y);
  const dRight = Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y);

  const avgW = Math.max(10, Math.round((dTop + dBottom) / 2));
  const avgH = Math.max(10, Math.round((dLeft + dRight) / 2));

  const maxSide = Math.max(avgW, avgH);
  const scale = maxSide > maxPreviewDim ? maxPreviewDim / maxSide : 1.0;
  const dstW = Math.max(10, Math.round(avgW * scale));
  const dstH = Math.max(10, Math.round(avgH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) return { canvas, width: dstW, height: dstH };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const x0 = quad.topLeft.x;
  const y0 = quad.topLeft.y;
  const x1 = quad.topRight.x;
  const y1 = quad.topRight.y;
  const x2 = quad.bottomRight.x;
  const y2 = quad.bottomRight.y;
  const x3 = quad.bottomLeft.x;
  const y3 = quad.bottomLeft.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;

  let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0;
  const det = dx1 * dy2 - dx2 * dy1;

  if (Math.abs(det) < 1e-7 || (sx === 0 && sy === 0)) {
    a = x1 - x0;
    b = x3 - x0;
    c = x0;
    d = y1 - y0;
    e = y3 - y0;
    f = y0;
    g = 0;
    h = 0;
  } else {
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
  }

  const mapUV = (u: number, v: number): Point2D => {
    const denom = g * u + h * v + 1;
    return {
      x: (a * u + b * v + c) / denom,
      y: (d * u + e * v + f) / denom,
    };
  };

  const cols = 32;
  const rows = 32;

  const drawTriangle = (
    d0: Point2D,
    d1: Point2D,
    d2: Point2D,
    s0: Point2D,
    s1: Point2D,
    s2: Point2D
  ) => {
    ctx.save();
    ctx.beginPath();
    const cx = (d0.x + d1.x + d2.x) / 3;
    const cy = (d0.y + d1.y + d2.y) / 3;
    const ex = 0.02;
    ctx.moveTo(d0.x + (d0.x - cx) * ex, d0.y + (d0.y - cy) * ex);
    ctx.lineTo(d1.x + (d1.x - cx) * ex, d1.y + (d1.y - cy) * ex);
    ctx.lineTo(d2.x + (d2.x - cx) * ex, d2.y + (d2.y - cy) * ex);
    ctx.closePath();
    ctx.clip();

    const deltaS = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (Math.abs(deltaS) > 1e-6) {
      const m11 = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / deltaS;
      const m12 = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / deltaS;
      const m21 = ((s1.x - s0.x) * (d2.x - d0.x) - (s2.x - s0.x) * (d1.x - d0.x)) / deltaS;
      const m22 = ((s1.x - s0.x) * (d2.y - d0.y) - (s2.x - s0.x) * (d1.y - d0.y)) / deltaS;
      const tdx = d0.x - m11 * s0.x - m21 * s0.y;
      const tdy = d0.y - m12 * s0.x - m22 * s0.y;

      ctx.transform(m11, m12, m21, m22, tdx, tdy);
      ctx.drawImage(img, 0, 0);
    }
    ctx.restore();
  };

  for (let cIdx = 0; cIdx < cols; cIdx++) {
    const u0 = cIdx / cols;
    const u1 = (cIdx + 1) / cols;
    for (let rIdx = 0; rIdx < rows; rIdx++) {
      const v0 = rIdx / rows;
      const v1 = (rIdx + 1) / rows;

      const d00 = { x: u0 * dstW, y: v0 * dstH };
      const d10 = { x: u1 * dstW, y: v0 * dstH };
      const d11 = { x: u1 * dstW, y: v1 * dstH };
      const d01 = { x: u0 * dstW, y: v1 * dstH };

      const s00 = mapUV(u0, v0);
      const s10 = mapUV(u1, v0);
      const s11 = mapUV(u1, v1);
      const s01 = mapUV(u0, v1);

      drawTriangle(d00, d10, d01, s00, s10, s01);
      drawTriangle(d10, d11, d01, s10, s11, s01);
    }
  }

  return { canvas, width: dstW, height: dstH };
}

function renderCropPreview(
  img: HTMLImageElement,
  rect: CropRect,
  maxPreviewDim = 2048
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const w = Math.max(10, Math.round(rect.width));
  const h = Math.max(10, Math.round(rect.height));
  const maxSide = Math.max(w, h);
  const scale = maxSide > maxPreviewDim ? maxPreviewDim / maxSide : 1.0;
  const dstW = Math.max(10, Math.round(w * scale));
  const dstH = Math.max(10, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, dstW, dstH);
  }
  return { canvas, width: dstW, height: dstH };
}

function renderEllipsePreview(
  img: HTMLImageElement,
  params: { cx: number; cy: number; rx: number; ry: number },
  maxPreviewDim = 2048
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const w = Math.max(10, Math.round(params.rx * 2));
  const h = Math.max(10, Math.round(params.ry * 2));
  const maxSide = Math.max(w, h);
  const scale = maxSide > maxPreviewDim ? maxPreviewDim / maxSide : 1.0;
  const dstW = Math.max(10, Math.round(w * scale));
  const dstH = Math.max(10, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.beginPath();
    ctx.ellipse(dstW / 2, dstH / 2, dstW / 2, dstH / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    const sx = params.cx - params.rx;
    const sy = params.cy - params.ry;
    ctx.drawImage(img, sx, sy, params.rx * 2, params.ry * 2, 0, 0, dstW, dstH);
  }
  return { canvas, width: dstW, height: dstH };
}

function renderPolygonPreview(
  img: HTMLImageElement,
  points: Point2D[],
  maxPreviewDim = 2048
): { canvas: HTMLCanvasElement; width: number; height: number } {
  if (points.length < 3) {
    return renderCropPreview(
      img,
      { x: 0, y: 0, width: img.naturalWidth || 1000, height: img.naturalHeight || 1000 },
      maxPreviewDim
    );
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(10, Math.round(maxX - minX));
  const h = Math.max(10, Math.round(maxY - minY));
  const maxSide = Math.max(w, h);
  const scale = maxSide > maxPreviewDim ? maxPreviewDim / maxSide : 1.0;
  const dstW = Math.max(10, Math.round(w * scale));
  const dstH = Math.max(10, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = (p.x - minX) * scale;
      const y = (p.y - minY) * scale;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, minX, minY, w, h, 0, 0, dstW, dstH);
  }
  return { canvas, width: dstW, height: dstH };
}

function renderOriginalCompare(
  img: HTMLImageElement,
  mode: ToolMode,
  quad: QuadPoints,
  cropRect: CropRect,
  ellipseParams: { cx: number; cy: number; rx: number; ry: number },
  polygonPoints: Point2D[],
  targetW: number,
  targetH: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (mode === "perspective") {
    const minX = Math.min(quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x);
    const minY = Math.min(quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y);
    const maxX = Math.max(quad.topLeft.x, quad.topRight.x, quad.bottomRight.x, quad.bottomLeft.x);
    const maxY = Math.max(quad.topLeft.y, quad.topRight.y, quad.bottomRight.y, quad.bottomLeft.y);
    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);
    ctx.drawImage(img, minX, minY, w, h, 0, 0, targetW, targetH);
  } else if (mode === "crop") {
    ctx.drawImage(img, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, targetW, targetH);
  } else if (mode === "circle") {
    const sx = ellipseParams.cx - ellipseParams.rx;
    const sy = ellipseParams.cy - ellipseParams.ry;
    ctx.drawImage(img, sx, sy, ellipseParams.rx * 2, ellipseParams.ry * 2, 0, 0, targetW, targetH);
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygonPoints) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);
    ctx.drawImage(img, minX, minY, w, h, 0, 0, targetW, targetH);
  }

  return canvas;
}

function drawAlignmentGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  zoom: number
) {
  ctx.save();
  const gridSize = 40;
  const majorStep = 5;
  ctx.lineWidth = Math.max(0.5, 1 / zoom);

  // Fine grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.18)";
  ctx.beginPath();
  for (let gx = 0; gx <= w; gx += gridSize) {
    if (gx % (gridSize * majorStep) !== 0) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
    }
  }
  for (let gy = 0; gy <= h; gy += gridSize) {
    if (gy % (gridSize * majorStep) !== 0) {
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
    }
  }
  ctx.stroke();

  // Major grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.48)";
  ctx.lineWidth = Math.max(1, 1.5 / zoom);
  ctx.beginPath();
  for (let gx = 0; gx <= w; gx += gridSize * majorStep) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
  }
  for (let gy = 0; gy <= h; gy += gridSize * majorStep) {
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
  }
  ctx.stroke();

  ctx.restore();
}

  // Quick Preview Generator (Ultra-Fast Client-Side Render in <15ms)
  const loadPreview = useCallback(() => {
    const img = loadedImageRef.current;
    if (!img) return;
    setPreviewLoading(true);
    setErrorMsg(null);

    requestAnimationFrame(() => {
      try {
        let res: { canvas: HTMLCanvasElement; width: number; height: number };
        if (mode === "perspective") {
          res = renderPerspectiveWarp(img, quad, 2048);
        } else if (mode === "crop") {
          res = renderCropPreview(img, cropRect, 2048);
        } else if (mode === "circle") {
          res = renderEllipsePreview(img, ellipseParams, 2048);
        } else {
          res = renderPolygonPreview(img, polygonPoints, 2048);
        }

        const comp = renderOriginalCompare(
          img,
          mode,
          quad,
          cropRect,
          ellipseParams,
          polygonPoints,
          res.width,
          res.height
        );

        previewCanvasRef.current = res.canvas;
        compareCanvasRef.current = comp;
        setPreviewDims({ width: res.width, height: res.height });
        setPreviewLoading(false);

        // Viewport isolation: restore previous preview viewport if it exists, otherwise fit
        if (previewViewportRef.current) {
          setPan(previewViewportRef.current.pan);
          setZoom(previewViewportRef.current.zoom);
        } else {
          fitToScreen(res.width, res.height);
        }
      } catch (e: any) {
        console.error("Fast preview failed:", e);
        setErrorMsg("Ошибка предпросмотра: " + (e?.message || e));
        setPreviewLoading(false);
      }
    });
  }, [mode, quad, cropRect, ellipseParams, polygonPoints, fitToScreen]);

  // Toggle Quick Preview with isolated viewport memory
  const togglePreview = useCallback(() => {
    if (isPreviewMode) {
      previewViewportRef.current = { pan, zoom };
      setIsPreviewMode(false);
      if (editViewportRef.current) {
        setPan(editViewportRef.current.pan);
        setZoom(editViewportRef.current.zoom);
      } else if (naturalDims.width > 0) {
        fitToScreen(naturalDims.width, naturalDims.height);
      }
    } else {
      editViewportRef.current = { pan, zoom };
      setIsPreviewMode(true);
      loadPreview();
    }
  }, [isPreviewMode, pan, zoom, naturalDims, fitToScreen, loadPreview]);

  // Bypass: insert original without transformations
  const handleBypass = async () => {
    if (!pendingPreprocess) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const rawPath =
        pendingPreprocess.filePath ||
        (pendingPreprocess.file as any)?.path ||
        (pendingPreprocess.file as any)?.filePath;
      if (rawPath) {
        const layer = await engineClient.importImage(rawPath, side);
        layer.mirrored = isFlippedH;
        layer.flipV = isFlippedV;
        layer.rotation = rotationAngle;

        const { boards, board } = useProjectStore.getState();
        const currentBoard = board || boards[0];
        const existing =
          side === "top" ? currentBoard?.data?.bgTop?.images : currentBoard?.data?.bgBottom?.images;

        const replaceId = pendingPreprocess.replaceLayerId;
        const targetOldLayer = replaceId ? existing?.find((l) => l.id === replaceId) : null;

        if (targetOldLayer) {
          layer.id = targetOldLayer.id;
          layer.offsetX = targetOldLayer.offsetX;
          layer.offsetY = targetOldLayer.offsetY;
          layer.scale = targetOldLayer.scale;
          layer.rotation = targetOldLayer.rotation !== undefined ? targetOldLayer.rotation : rotationAngle;
          layer.mirrored = isFlippedH;
          layer.flipV = isFlippedV;
          layer.opacity = targetOldLayer.opacity;
          layer.brightness = targetOldLayer.brightness;
          layer.contrast = targetOldLayer.contrast;
          layer.invert = targetOldLayer.invert;
          layer.grayscale = targetOldLayer.grayscale;
          layer.blendMode = targetOldLayer.blendMode;
          layer.tintColor = targetOldLayer.tintColor;
          layer.pxPerMm = targetOldLayer.pxPerMm;
          layer.dpi = targetOldLayer.dpi;
        } else if (existing && existing.length > 0) {
          let maxRight = 0;
          for (const ex of existing) {
            const exW = ((ex.width || 2000) / (ex.pxPerMm || 23.62)) * (ex.scale || 1);
            const r = (ex.offsetX || 0) + exW;
            if (r > maxRight) maxRight = r;
          }
          if (maxRight > 0) {
            layer.offsetX = Math.round(maxRight + 15);
            layer.offsetY = 0;
          }
        }

        await updateImageLayer(layer);
      }
      handleClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Ошибка импорта исходного файла");
      reportError(e, "Ошибка импорта исходного файла", { source: "canvas" });
    } finally {
      setLoading(false);
    }
  };

  // Apply transformation
  const handleApply = useCallback(async () => {
    if (!pendingPreprocess) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const rawPath =
        pendingPreprocess.filePath ||
        (pendingPreprocess.file as any)?.path ||
        (pendingPreprocess.file as any)?.filePath;
      const source = rawPath || pendingPreprocess.dataUrl || currentSrc;
      const op = getOperation(false);

      const layer = await engineClient.processAndSaveImage(
        { source, operation: op as any },
        side,
        pendingPreprocess.name
      );

      layer.mirrored = isFlippedH;
      layer.flipV = isFlippedV;
      layer.rotation = rotationAngle;

      const { boards, board } = useProjectStore.getState();
      const currentBoard = board || boards[0];
      const existing =
        side === "top" ? currentBoard?.data?.bgTop?.images : currentBoard?.data?.bgBottom?.images;

      const replaceId = pendingPreprocess.replaceLayerId;
      const targetOldLayer = replaceId ? existing?.find((l) => l.id === replaceId) : null;

      if (targetOldLayer) {
        layer.id = targetOldLayer.id;
        layer.offsetX = targetOldLayer.offsetX;
        layer.offsetY = targetOldLayer.offsetY;
        layer.scale = targetOldLayer.scale;
        layer.rotation = targetOldLayer.rotation !== undefined ? targetOldLayer.rotation : rotationAngle;
        layer.mirrored = isFlippedH;
        layer.flipV = isFlippedV;
        layer.opacity = targetOldLayer.opacity;
        layer.brightness = targetOldLayer.brightness;
        layer.contrast = targetOldLayer.contrast;
        layer.invert = targetOldLayer.invert;
        layer.grayscale = targetOldLayer.grayscale;
        layer.blendMode = targetOldLayer.blendMode;
        layer.tintColor = targetOldLayer.tintColor;
        layer.pxPerMm = targetOldLayer.pxPerMm;
        layer.dpi = targetOldLayer.dpi;
      } else if (existing && existing.length > 0) {
        let maxRight = 0;
        for (const ex of existing) {
          const exW = ((ex.width || 2000) / (ex.pxPerMm || 23.62)) * (ex.scale || 1);
          const r = (ex.offsetX || 0) + exW;
          if (r > maxRight) maxRight = r;
        }
        if (maxRight > 0) {
          layer.offsetX = Math.round(maxRight + 15);
          layer.offsetY = 0;
        }
      }

      await updateImageLayer(layer);
      handleClose();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Ошибка применения трансформации");
      reportError(e, "Ошибка применения трансформации изображения", { source: "canvas" });
    } finally {
      setLoading(false);
    }
  }, [
    pendingPreprocess,
    currentSrc,
    getOperation,
    side,
    isFlippedH,
    isFlippedV,
    rotationAngle,
    updateImageLayer,
    handleClose,
  ]);

  // Keyboard shortcuts listener
  useEffect(() => {
    if (!modals.preprocess) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "p" || e.key === "P" || e.key === "з" || e.key === "З") {
        e.preventDefault();
        togglePreview();
      } else if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") {
        e.preventDefault();
        if (e.shiftKey) {
          setRotationAngle((r) => (r - 90 + 360) % 360);
        } else {
          setRotationAngle((r) => (r + 90) % 360);
        }
      } else if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") {
        e.preventDefault();
        setIsFlippedH((f) => !f);
      } else if (e.key === "0") {
        e.preventDefault();
        fitToScreen();
      } else if (e.key === "1") {
        e.preventDefault();
        setZoom(1);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(30, z * 1.3));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.001, z / 1.3));
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (isPreviewMode) {
          setIsPreviewMode(false);
          if (naturalDims.width > 0) fitToScreen(naturalDims.width, naturalDims.height);
        } else {
          handleClose();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modals.preprocess,
    isPreviewMode,
    showShortcutsModal,
    naturalDims,
    togglePreview,
    fitToScreen,
    handleClose,
    handleApply,
  ]);

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

    if (isPreviewMode && previewCanvasRef.current) {
      const activeW = previewCanvasRef.current.width;
      const activeH = previewCanvasRef.current.height;

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Center transform
      const cx = activeW / 2;
      const cy = activeH / 2;
      ctx.translate(cx, cy);
      if (rotationAngle !== 0) ctx.rotate((rotationAngle * Math.PI) / 180);
      if (isFlippedH || isFlippedV) ctx.scale(isFlippedH ? -1 : 1, isFlippedV ? -1 : 1);
      ctx.translate(-cx, -cy);

      if (isSplitCompare && compareCanvasRef.current) {
        const splitX = Math.round(activeW * splitPos);

        // 1. Left side: Original unwarped
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, activeH);
        ctx.clip();
        ctx.drawImage(compareCanvasRef.current, 0, 0, activeW, activeH);
        ctx.restore();

        // 2. Right side: Straightened board
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, activeW - splitX, activeH);
        ctx.clip();
        ctx.drawImage(previewCanvasRef.current, 0, 0, activeW, activeH);
        if (showGridOverlay) {
          drawAlignmentGrid(ctx, activeW, activeH, zoom);
        }
        ctx.restore();

        // 3. Split line
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = Math.max(1.5, 2 / zoom);
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, activeH);
        ctx.stroke();

        // Handle on divider
        const handleR = Math.max(7, 9 / zoom);
        ctx.fillStyle = "#0284c7";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1.2, 1.8 / zoom);
        ctx.beginPath();
        ctx.arc(splitX, activeH / 2, handleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner arrow grips inside handle
        ctx.fillStyle = "#ffffff";
        const arrSize = Math.max(2.5, 3.5 / zoom);
        ctx.beginPath();
        ctx.moveTo(splitX - arrSize * 1.5, activeH / 2);
        ctx.lineTo(splitX - arrSize * 0.5, activeH / 2 - arrSize);
        ctx.lineTo(splitX - arrSize * 0.5, activeH / 2 + arrSize);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(splitX + arrSize * 1.5, activeH / 2);
        ctx.lineTo(splitX + arrSize * 0.5, activeH / 2 - arrSize);
        ctx.lineTo(splitX + arrSize * 0.5, activeH / 2 + arrSize);
        ctx.fill();

        // Elegant "ДО" and "ПОСЛЕ" HUD indicators along divider
        ctx.font = `bold ${Math.max(10, 12 / zoom)}px sans-serif`;
        const pad = Math.max(4, 6 / zoom);
        const barH = Math.max(16, 20 / zoom);
        const textY = 12 / zoom + barH * 0.72;

        if (splitX > 60 / zoom) {
          const text = "ДО";
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
          ctx.fillRect(splitX - tw - pad * 3, 12 / zoom, tw + pad * 2, barH);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(text, splitX - tw - pad * 2, textY);
        }
        if (activeW - splitX > 60 / zoom) {
          const text = "ПОСЛЕ";
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
          ctx.fillRect(splitX + pad, 12 / zoom, tw + pad * 2, barH);
          ctx.fillStyle = "#38bdf8";
          ctx.fillText(text, splitX + pad * 2, textY);
        }

        ctx.restore();
      } else if (showOriginalCompare && compareCanvasRef.current) {
        // Seamless in-place switch to original
        ctx.drawImage(compareCanvasRef.current, 0, 0, activeW, activeH);
      } else {
        // Straightened preview
        ctx.drawImage(previewCanvasRef.current, 0, 0, activeW, activeH);
        if (showGridOverlay) {
          drawAlignmentGrid(ctx, activeW, activeH, zoom);
        }
      }

      ctx.restore();
    } else {
      // Normal edit mode
      const cx = naturalDims.width / 2;
      const cy = naturalDims.height / 2;

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      ctx.translate(cx, cy);
      if (rotationAngle !== 0) ctx.rotate((rotationAngle * Math.PI) / 180);
      if (isFlippedH || isFlippedV) ctx.scale(isFlippedH ? -1 : 1, isFlippedV ? -1 : 1);
      ctx.translate(-cx, -cy);

      ctx.drawImage(img, 0, 0, naturalDims.width, naturalDims.height);
      ctx.restore();
    }

    ctx.restore();
  }, [
    pan,
    zoom,
    naturalDims,
    previewDims,
    rotationAngle,
    isFlippedH,
    isFlippedV,
    viewportSize,
    isPreviewMode,
    isSplitCompare,
    splitPos,
    showGridOverlay,
    showOriginalCompare,
  ]);

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

      const mag = 4;

      ctx.save();
      ctx.translate(size / 2, size / 2);
      if (rotationAngle !== 0) ctx.rotate((rotationAngle * Math.PI) / 180);
      if (isFlippedH || isFlippedV) ctx.scale(isFlippedH ? -1 : 1, isFlippedV ? -1 : 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        -imgPt.x * mag,
        -imgPt.y * mag,
        (img.naturalWidth || naturalDims.width) * mag,
        (img.naturalHeight || naturalDims.height) * mag
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(size / 2, 0);
      ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2);
      ctx.lineTo(size, size / 2);
      ctx.stroke();

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
    const rect = containerRef.current?.getBoundingClientRect();
    const screenX = rect ? e.clientX - rect.left : e.clientX;
    const screenY = rect ? e.clientY - rect.top : e.clientY;

    if (e.button === 0 && isPreviewMode && isSplitCompare && previewCanvasRef.current) {
      const activeW = previewCanvasRef.current.width;
      const activeH = previewCanvasRef.current.height;
      const splitX = activeW * splitPos;
      const splitScreenTop = previewToScreen(splitX, 0);
      const splitScreenBottom = previewToScreen(splitX, activeH);
      const splitScreenMid = previewToScreen(splitX, activeH / 2);

      const distToMid = Math.hypot(screenX - splitScreenMid.x, screenY - splitScreenMid.y);
      const dx = splitScreenBottom.x - splitScreenTop.x;
      const dy = splitScreenBottom.y - splitScreenTop.y;
      const lenSq = dx * dx + dy * dy;
      let distToLine = Infinity;
      if (lenSq > 0) {
        const t = Math.max(0, Math.min(1, ((screenX - splitScreenTop.x) * dx + (screenY - splitScreenTop.y) * dy) / lenSq));
        const projX = splitScreenTop.x + t * dx;
        const projY = splitScreenTop.y + t * dy;
        distToLine = Math.hypot(screenX - projX, screenY - projY);
      }

      if (distToMid < 24 || distToLine < 18) {
        setIsDraggingSplit(true);
        return;
      }
    }

    if (e.button === 1 || e.altKey || (e.button === 0 && (!activeHandle || isPreviewMode))) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Track real cursor coordinates for HUD
    const imgPt = screenToImage(screenX, screenY);
    setCursorPos({
      x: Math.round(Math.max(0, Math.min(naturalDims.width, imgPt.x))),
      y: Math.round(Math.max(0, Math.min(naturalDims.height, imgPt.y))),
    });

    if (isDraggingSplit && isPreviewMode && previewCanvasRef.current) {
      const activeW = previewCanvasRef.current.width;
      const pt = screenToPreview(screenX, screenY);
      const newPos = Math.max(0.01, Math.min(0.99, pt.x / activeW));
      setSplitPos(newPos);
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (isPreviewMode || !activeHandle) return;

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
    setIsDraggingSplit(false);
    setIsPanning(false);
    setActiveHandle(null);
    setLoupeState((prev) => ({ ...prev, visible: false }));
  };

  if (!modals.preprocess || !pendingPreprocess) return null;

  // Screen coordinates for overlay
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

  // Informative HUD calculations
  const totalMegapixels =
    naturalDims.width > 0 && naturalDims.height > 0
      ? ((naturalDims.width * naturalDims.height) / 1000000).toFixed(1)
      : "0";

  let selectionDimensions = "";
  let selectionAspect = "";

  if (mode === "perspective") {
    const dTop = Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y);
    const dBottom = Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y);
    const dLeft = Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y);
    const dRight = Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y);
    const estW = Math.round((dTop + dBottom) / 2);
    const estH = Math.round((dLeft + dRight) / 2);
    selectionDimensions = `~${estW} × ${estH} px`;
    selectionAspect = estH > 0 ? `${(estW / estH).toFixed(2)}:1` : "1:1";
  } else if (mode === "crop") {
    const cW = Math.round(cropRect.width);
    const cH = Math.round(cropRect.height);
    selectionDimensions = `${cW} × ${cH} px`;
    selectionAspect = cH > 0 ? `${(cW / cH).toFixed(2)}:1` : "1:1";
  } else if (mode === "circle") {
    const d1 = Math.round(ellipseParams.rx * 2);
    const d2 = Math.round(ellipseParams.ry * 2);
    selectionDimensions = `⌀ ${d1} × ${d2} px`;
    selectionAspect = d2 > 0 ? `${(d1 / d2).toFixed(2)}:1` : "1:1";
  } else {
    selectionDimensions = `Многоугольник: ${polygonPoints.length} верш.`;
  }

  const getResultingDimensions = (maxDim: number) => {
    let rawW = 0;
    let rawH = 0;
    if (mode === "perspective") {
      const dTop = Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y);
      const dBottom = Math.hypot(quad.bottomRight.x - quad.bottomLeft.x, quad.bottomRight.y - quad.bottomLeft.y);
      const dLeft = Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y);
      const dRight = Math.hypot(quad.bottomRight.x - quad.topRight.x, quad.bottomRight.y - quad.topRight.y);
      rawW = Math.round((dTop + dBottom) / 2);
      rawH = Math.round((dLeft + dRight) / 2);
    } else if (mode === "crop") {
      rawW = Math.round(cropRect.width);
      rawH = Math.round(cropRect.height);
    } else if (mode === "circle") {
      rawW = Math.round(ellipseParams.rx * 2);
      rawH = Math.round(ellipseParams.ry * 2);
    } else {
      if (polygonPoints.length === 0) return { w: naturalDims.width, h: naturalDims.height, mp: "0" };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of polygonPoints) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      rawW = Math.round(maxX - minX);
      rawH = Math.round(maxY - minY);
    }

    if (rawW <= 0 || rawH <= 0) {
      rawW = naturalDims.width || 1000;
      rawH = naturalDims.height || 1000;
    }

    if (maxDim > 0) {
      const maxSide = Math.max(rawW, rawH);
      if (maxSide > maxDim) {
        const scale = maxDim / maxSide;
        rawW = Math.round(rawW * scale);
        rawH = Math.round(rawH * scale);
      }
    }

    const mp = ((rawW * rawH) / 1000000).toFixed(1);
    return { w: rawW, h: rawH, mp };
  };

  const currRes = getResultingDimensions(maxDimension);

  return (
    <div className="cad-preprocess-backdrop" onClick={handleClose}>
      <div className="cad-preprocess-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cad-preprocess-header">
          <div className="header-title-group">
            <div className="header-icon-badge">
              <SlidersHorizontal size={17} />
            </div>
            <div>
              <div className="modal-title">
                <span>Предобработка фото платы</span>
                {naturalDims.width > 0 && (
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>
                    ({naturalDims.width} × {naturalDims.height} px • {totalMegapixels} MP)
                  </span>
                )}
              </div>
              <div className="modal-subtitle">
                <span>Кадрирование и коррекция перспективы</span>
              </div>
            </div>
          </div>

          <div className="cad-header-actions">
            {/* Active layer badge */}
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "5px",
                background: side === "top" ? "rgba(245, 158, 11, 0.12)" : "rgba(6, 182, 212, 0.12)",
                border: `1px solid ${
                  side === "top" ? "rgba(245, 158, 11, 0.35)" : "rgba(6, 182, 212, 0.35)"
                }`,
                color: side === "top" ? "var(--cad-top-layer, #f59e0b)" : "var(--cad-bottom-layer, #06b6d4)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>Слой:</span>
              <span>{side.toUpperCase()} ({side === "top" ? "Лицевой" : "Оборотный"})</span>
            </div>

            {/* Shortcuts help button */}
            <button
              className="cad-header-btn"
              onClick={() => setShowShortcutsModal((s) => !s)}
              title="Горячие клавиши"
            >
              <HelpCircle size={16} />
            </button>

            {/* Close button */}
            <button className="cad-header-btn close" onClick={handleClose} title="Закрыть [Esc]">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Shortcuts Popover */}
        {showShortcutsModal && (
          <div className="cad-shortcuts-popover" onClick={(e) => e.stopPropagation()}>
            <div className="popover-title">
              <span>Горячие клавиши</span>
              <X
                size={14}
                style={{ cursor: "pointer", color: "#94a3b8" }}
                onClick={() => setShowShortcutsModal(false)}
              />
            </div>
            <div className="cad-shortcut-row">
              <span>Быстрый просмотр</span>
              <kbd className="cad-kbd-badge">P</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Поворот на 90°</span>
              <kbd className="cad-kbd-badge">R</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Отразить по горизонтали</span>
              <kbd className="cad-kbd-badge">F</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>По размеру окна</span>
              <kbd className="cad-kbd-badge">0</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Масштаб 1:1</span>
              <kbd className="cad-kbd-badge">1</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Приблизить / Отдалить</span>
              <kbd className="cad-kbd-badge">+ / -</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Панорамирование</span>
              <kbd className="cad-kbd-badge">Space + Drag</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Применить</span>
              <kbd className="cad-kbd-badge">Enter</kbd>
            </div>
            <div className="cad-shortcut-row">
              <span>Закрыть / Назад</span>
              <kbd className="cad-kbd-badge">Esc</kbd>
            </div>
          </div>
        )}

        {/* Compact Modern Toolbar */}
        <div className="cad-preprocess-toolbar">
          {/* Mode Selector Tabs */}
          <div className="tool-tabs">
            <button
              className={`tool-tab-btn ${mode === "perspective" && !isPreviewMode ? "active" : ""}`}
              onClick={() => {
                setMode("perspective");
                if (isPreviewMode) setIsPreviewMode(false);
              }}
              title="Выравнивание трапеции по 4 углам"
            >
              <Shapes size={13} />
              <span>Трапеция</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "crop" && !isPreviewMode ? "active" : ""}`}
              onClick={() => {
                setMode("crop");
                if (isPreviewMode) setIsPreviewMode(false);
              }}
              title="Прямоугольное кадрирование"
            >
              <Crop size={13} />
              <span>Рамка</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "polygon" && !isPreviewMode ? "active" : ""}`}
              onClick={() => {
                setMode("polygon");
                if (isPreviewMode) setIsPreviewMode(false);
              }}
              title="Кадрирование по произвольному многоугольнику"
            >
              <Layers size={13} />
              <span>Многоугольник</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "circle" && !isPreviewMode ? "active" : ""}`}
              onClick={() => {
                setMode("circle");
                if (isPreviewMode) setIsPreviewMode(false);
              }}
              title="Круг или эллипс"
            >
              <CircleDot size={13} />
              <span>Овал</span>
            </button>
          </div>

          {/* Auto Detect Corners (shown only in perspective mode) */}
          {mode === "perspective" && !isPreviewMode && (
            <button
              className="auto-detect-btn"
              onClick={handleAutoDetect}
              disabled={isDetecting || !pendingPreprocess.filePath}
              title="Автоопределение углов платы компьютерным зрением"
            >
              {isDetecting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              <span>Авто-углы</span>
            </button>
          )}

          <div className="toolbar-divider" />

          {/* Quick orientation transforms */}
          <div className="cad-preprocess-btn-group">
            <button
              className="cad-preprocess-icon-btn"
              onClick={() => setRotationAngle((r) => (r - 90 + 360) % 360)}
              title="Повернуть на 90° влево [Shift+R]"
            >
              <RotateCcw size={13} />
            </button>
            <button
              className="cad-preprocess-icon-btn"
              onClick={() => setRotationAngle((r) => (r + 90) % 360)}
              title="Повернуть на 90° вправо [R]"
            >
              <RotateCw size={13} />
            </button>
            <button
              className={`cad-preprocess-icon-btn ${isFlippedH ? "active" : ""}`}
              onClick={() => setIsFlippedH((f) => !f)}
              title="Отразить по горизонтали [F]"
            >
              <FlipHorizontal size={13} />
            </button>
            <button
              className={`cad-preprocess-icon-btn ${isFlippedV ? "active" : ""}`}
              onClick={() => setIsFlippedV((f) => !f)}
              title="Отразить по вертикали"
            >
              <FlipVertical size={13} />
            </button>
            {(rotationAngle !== 0 || isFlippedH || isFlippedV) && (
              <span className="cad-preprocess-orientation-badge" title="Текущая трансформация">
                {rotationAngle !== 0 ? `${rotationAngle}°` : ""}
                {isFlippedH ? " ⇄" : ""}
                {isFlippedV ? " ⇅" : ""}
              </span>
            )}
          </div>

          <div className="toolbar-divider" />

          {/* Quick Preview Toggle Button */}
          <button
            className={`cad-preview-toggle-btn ${isPreviewMode ? "active" : ""}`}
            onClick={togglePreview}
            disabled={loading || isDetecting}
            title="Быстрый просмотр выровненной платы в реальном времени [P]"
          >
            {previewLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isPreviewMode ? (
              <ArrowLeft size={13} />
            ) : (
              <Eye size={13} />
            )}
            <span>{isPreviewMode ? "К редактору" : "Быстрый просмотр"}</span>
            <kbd className="cad-kbd-badge">P</kbd>
          </button>

          <div className="toolbar-spacer" />

          {/* Zoom & Fit Navigation */}
          <div className="cad-preprocess-btn-group">
            <button className="cad-preprocess-icon-btn" onClick={() => fitToScreen()} title="По размеру окна [0]">
              <Maximize2 size={13} />
            </button>
            <button
              className="cad-preprocess-icon-btn"
              onClick={() => {
                setZoom(1);
                const c = containerRef.current;
                if (c && naturalDims.width > 0) {
                  setPan({
                    x: (c.clientWidth - naturalDims.width) / 2,
                    y: (c.clientHeight - naturalDims.height) / 2,
                  });
                }
              }}
              title="Масштаб 1:1 (100%) [1]"
            >
              <span style={{ fontSize: "10px", fontWeight: 700 }}>1:1</span>
            </button>
            <button
              className="cad-preprocess-icon-btn"
              onClick={() => setZoom((z) => Math.max(0.001, z / 1.3))}
              title="Отдалить [-]"
            >
              <ZoomOut size={13} />
            </button>
            <span className="cad-zoom-label" onClick={() => fitToScreen()} title="Кликните для сброса по окну">
              {zoom < 0.1 ? `${(zoom * 100).toFixed(1)}%` : `${Math.round(zoom * 100)}%`}
            </span>
            <button
              className="cad-preprocess-icon-btn"
              onClick={() => setZoom((z) => Math.min(30, z * 1.3))}
              title="Приблизить [+]"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          className="cad-preprocess-viewport"
          style={{ cursor: isDraggingSplit ? "ew-resize" : undefined }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Main Rendering Canvas */}
          <canvas ref={canvasRef} className="cad-preprocess-canvas-layer" />

          {/* Informative Floating CAD HUD */}
          <div className="cad-preprocess-hud">
            <div className="cad-hud-item">
              <span className="cad-hud-label">Зона:</span>
              <span className="cad-hud-value highlight">{selectionDimensions}</span>
              {selectionAspect && <span style={{ color: "#64748b", fontSize: "10px" }}>({selectionAspect})</span>}
            </div>

            <div className="cad-hud-divider" />

            {cursorPos && (
              <>
                <div className="cad-hud-item">
                  <span className="cad-hud-label">Курсор:</span>
                  <span className="cad-hud-value">
                    X:{cursorPos.x} Y:{cursorPos.y}
                  </span>
                </div>
                <div className="cad-hud-divider" />
              </>
            )}

            <div className="cad-hud-item">
              <span className="cad-hud-label">Зум:</span>
              <span className="cad-hud-value">{Math.round(zoom * 100)}%</span>
            </div>
          </div>

          {/* Quick Preview Floating Toolbar Overlay (Active when Preview is ON) */}
          {isPreviewMode && (
            <div className="cad-preview-toolbar-overlay" onClick={(e) => e.stopPropagation()}>
              <button
                className={`cad-preview-btn ${showGridOverlay ? "active" : ""}`}
                onClick={() => setShowGridOverlay((g) => !g)}
                title="Отобразить проверочную координатную сетку для контроля параллельности дорожек"
              >
                <Grid size={13} />
                <span>Сетка</span>
              </button>

              <button
                className={`cad-preview-btn ${isSplitCompare ? "active" : ""}`}
                onClick={() => setIsSplitCompare((s) => !s)}
                title="Включить интерактивную шторку До / После (можно двигать мышью прямо по изображению)"
              >
                <SplitSquareVertical size={13} />
                <span>Шторка До/После</span>
              </button>

              {isSplitCompare ? (
                <div className="cad-split-slider-container">
                  <span className="cad-split-label">До</span>
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={Math.round(splitPos * 100)}
                    onChange={(e) => setSplitPos(Number(e.target.value) / 100)}
                    className="cad-split-range-input"
                    title={`Позиция разделения: ${Math.round(splitPos * 100)}%`}
                  />
                  <span className="cad-split-label">После</span>
                </div>
              ) : (
                <button
                  className={`cad-preview-btn ${showOriginalCompare ? "active" : ""}`}
                  onMouseDown={() => setShowOriginalCompare(true)}
                  onMouseUp={() => setShowOriginalCompare(false)}
                  onMouseLeave={() => setShowOriginalCompare(false)}
                  onClick={() => setShowOriginalCompare((c) => !c)}
                  title="Зажмите или кликните для мгновенного бесшовного сравнения с исходным участком"
                >
                  <Eye size={13} />
                  <span>{showOriginalCompare ? "Исходник" : "Зажать: Исходник"}</span>
                </button>
              )}

              <button className="cad-preview-btn" onClick={loadPreview} title="Перерисовать быстрый предпросмотр">
                <RefreshCw size={12} className={previewLoading ? "animate-spin" : ""} />
                <span>Обновить</span>
              </button>
            </div>
          )}

          {/* Interactive SVG Overlay (Only in Edit Mode) */}
          {!isPreviewMode && (
            <svg className="cad-preprocess-svg-overlay">
              {/* Mode 1: Perspective Quad Overlay */}
              {mode === "perspective" && (
                <>
                  {/* Perspective optical center diagonals */}
                  <line
                    x1={tlScreen.x}
                    y1={tlScreen.y}
                    x2={brScreen.x}
                    y2={brScreen.y}
                    stroke="rgba(59, 130, 246, 0.35)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={trScreen.x}
                    y1={trScreen.y}
                    x2={blScreen.x}
                    y2={blScreen.y}
                    stroke="rgba(59, 130, 246, 0.35)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />

                  {/* Quad boundary polygon */}
                  <polygon
                    points={`${tlScreen.x},${tlScreen.y} ${trScreen.x},${trScreen.y} ${brScreen.x},${brScreen.y} ${blScreen.x},${blScreen.y}`}
                    fill="rgba(59, 130, 246, 0.12)"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="6 3"
                  />

                  {/* 4 Corner Numbered Handles */}
                  {[
                    { key: "topLeft", pt: tlScreen, num: "1", label: "TL" },
                    { key: "topRight", pt: trScreen, num: "2", label: "TR" },
                    { key: "bottomRight", pt: brScreen, num: "3", label: "BR" },
                    { key: "bottomLeft", pt: blScreen, num: "4", label: "BL" },
                  ].map((item) => (
                    <g key={item.key}>
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r="10"
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cad-preprocess-handle"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setActiveHandle(item.key as DragHandle);
                        }}
                      />
                      <text x={item.pt.x} y={item.pt.y} className="cad-handle-num">
                        {item.num}
                      </text>
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
                    style={{ cursor: "move" }}
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
                  {/* Edges midpoint "+" buttons to add new vertices */}
                  {polygonPoints.map((p, idx) => {
                    const nextP = polygonPoints[(idx + 1) % polygonPoints.length];
                    const s1 = imageToScreen(p.x, p.y);
                    const s2 = imageToScreen(nextP.x, nextP.y);
                    const midX = (s1.x + s2.x) / 2;
                    const midY = (s1.y + s2.y) / 2;
                    return (
                      <g
                        key={`edge_add_${idx}`}
                        className="cad-polygon-add-btn"
                        style={{ pointerEvents: "all" }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const newPt = {
                            x: Math.round((p.x + nextP.x) / 2),
                            y: Math.round((p.y + nextP.y) / 2),
                          };
                          setPolygonPoints((prev) => {
                            const next = [...prev];
                            next.splice(idx + 1, 0, newPt);
                            return next;
                          });
                        }}
                      >
                        <title>Добавить вершину</title>
                        {/* Invisible large hit area */}
                        <circle cx={midX} cy={midY} r="14" fill="transparent" style={{ pointerEvents: "all" }} />
                        {/* Visible badge */}
                        <circle
                          cx={midX}
                          cy={midY}
                          r="7.5"
                          fill="#0f172a"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          className="cad-add-badge"
                          style={{ pointerEvents: "all" }}
                        />
                        <text
                          x={midX}
                          y={midY}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#38bdf8"
                          fontSize="11px"
                          fontWeight="bold"
                          style={{ pointerEvents: "none" }}
                        >
                          +
                        </text>
                      </g>
                    );
                  })}
                  {/* Vertices handles */}
                  {polygonPoints.map((p, idx) => {
                    const sPt = imageToScreen(p.x, p.y);
                    return (
                      <g key={idx}>
                        <title>{`Вершина ${idx + 1} (двойной клик — удалить)`}</title>
                        <circle
                          cx={sPt.x}
                          cy={sPt.y}
                          r="7.5"
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="cad-preprocess-handle"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setActiveHandle(`poly_${idx}` as DragHandle);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (polygonPoints.length > 3) {
                              setPolygonPoints((prev) => prev.filter((_, i) => i !== idx));
                            }
                          }}
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {/* Mode 4: Circle / Ellipse Overlay */}
              {mode === "circle" && (() => {
                const cPt = imageToScreen(ellipseParams.cx, ellipseParams.cy);
                const rPt = imageToScreen(ellipseParams.cx + ellipseParams.rx, ellipseParams.cy);
                const rxS = Math.abs(rPt.x - cPt.x) || ellipseParams.rx * zoom;
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
                      r="7.5"
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
                      r="6.5"
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
          )}

          {/* Floating Magnifier Loupe */}
          {!isPreviewMode && (
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
          )}

          {/* Bottom Hint */}
          <div className="cad-preprocess-hint">
            {isPreviewMode ? (
              <span>👁️ Режим быстрого просмотра: оцените выравнивание платы по сетке перед применением.</span>
            ) : mode === "perspective" ? (
              <span>Перетащите 4 маркера на реальные углы платы для выравнивания трапеции. Нажмите P для предпросмотра.</span>
            ) : mode === "crop" ? (
              <span>Потяните за края рамки или центр для кадрирования. Нажмите P для предпросмотра.</span>
            ) : mode === "polygon" ? (
              <span>Многоугольник: перетаскивайте вершины, нажмите [+] на ребре для добавления точки (двойной клик — удалить).</span>
            ) : (
              <span>Настройте центр и радиус для круглых печатных плат.</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="cad-preprocess-footer">
          <div className="cad-preprocess-footer-left">
            <div className="cad-res-control-group">
              <span className="cad-res-title">Разрешение:</span>

              <div className="cad-res-pills">
                <button
                  className={`cad-res-pill ${maxDimension === 0 ? "active" : ""}`}
                  onClick={() => setMaxDimension(0)}
                  title="Без сжатия — сохранить исходную детализацию всех дорожек и переходных отверстий"
                >
                  Оригинал (100%)
                </button>
                <button
                  className={`cad-res-pill ${maxDimension === 4096 ? "active" : ""}`}
                  onClick={() => setMaxDimension(4096)}
                  title="4K (до 4096 px) — высокая чёткость, быстрая работа"
                >
                  4K
                </button>
                <button
                  className={`cad-res-pill ${maxDimension === 2048 ? "active" : ""}`}
                  onClick={() => setMaxDimension(2048)}
                  title="2K (до 2048 px) — экономия памяти для слабых ПК"
                >
                  2K
                </button>
                <button
                  className={`cad-res-pill ${maxDimension > 0 && maxDimension !== 4096 && maxDimension !== 2048 ? "active" : ""}`}
                  onClick={() => setShowCustomResModal((s) => !s)}
                  title="Задать собственное ограничение разрешения в пикселях"
                >
                  {maxDimension > 0 && maxDimension !== 4096 && maxDimension !== 2048 ? `${maxDimension} px` : "Своё..."}
                </button>
              </div>

              {/* Resulting Dimensions Badge */}
              <div className="cad-res-result-badge" title="Результирующий размер сохраняемого изображения платы">
                <span className="badge-arrow">➜</span>
                <span className="badge-dims">{currRes.w} × {currRes.h} px</span>
                <span className="badge-mp">({currRes.mp} MP)</span>
              </div>

              {/* Custom Resolution Popover */}
              {showCustomResModal && (
                <div className="cad-custom-res-popover" onClick={(e) => e.stopPropagation()}>
                  <div className="custom-res-header">
                    <span>Макс. сторона (px):</span>
                    <X
                      size={12}
                      onClick={() => setShowCustomResModal(false)}
                      style={{ cursor: "pointer", color: "#94a3b8" }}
                    />
                  </div>
                  <div className="custom-res-input-row">
                    <input
                      type="number"
                      min={300}
                      max={40000}
                      step={100}
                      value={customResInput}
                      onChange={(e) => setCustomResInput(e.target.value)}
                      placeholder="3000"
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(customResInput, 10);
                        if (val >= 200) {
                          setMaxDimension(val);
                          setShowCustomResModal(false);
                        }
                      }}
                    >
                      ОК
                    </button>
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <span style={{ color: "#ef4444", fontSize: "11.5px" }}>
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
