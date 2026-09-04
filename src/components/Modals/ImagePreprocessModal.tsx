import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  RotateCcw,
  RotateCw,
  Crop as CropIcon,
  Maximize2,
  Eye,
  Check,
  RefreshCw,
  Sparkles,
  FlipHorizontal,
  FlipVertical,
  Circle as CircleIcon,
  Hexagon,
} from "lucide-react";
import {
  Point2D,
  QuadPoints,
  CropRect,
  EllipseParams,
  loadImageElement,
  warpPerspective,
  cropImage,
  rotateImageFixed,
  flipImage,
  cropPolygon,
  cropEllipse,
  calculateTargetDimensions,
} from "../../utils/perspectiveTransform";
import { normalizeImageResolution } from "../../utils/imageLoader";

export interface ImagePreprocessResult {
  dataUrl: string;
  width: number;
  height: number;
}

interface ImagePreprocessModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName?: string;
  onClose: () => void;
  onApply: (result: ImagePreprocessResult) => void;
  onBypass: () => void;
}

type ToolMode = "perspective" | "crop" | "polygon" | "circle";
type DragHandle =
  | "topLeft"
  | "topRight"
  | "bottomRight"
  | "bottomLeft"
  | "cropN"
  | "cropS"
  | "cropE"
  | "cropW"
  | "cropNW"
  | "cropNE"
  | "cropSE"
  | "cropSW"
  | "cropMove"
  | "circleCenter"
  | "circleN"
  | "circleS"
  | "circleE"
  | "circleW"
  | `polygon_${number}`
  | null;

export const ImagePreprocessModal: React.FC<ImagePreprocessModalProps> = ({
  isOpen,
  imageSrc,
  fileName,
  onClose,
  onApply,
  onBypass,
}) => {
  // Current working image src (can be rotated in-place)
  const [currentSrc, setCurrentSrc] = useState<string>(imageSrc);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [imgDims, setImgDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Mode: perspective, crop, polygon, circle
  const [mode, setMode] = useState<ToolMode>("perspective");

  // Quad points (in image pixel coordinates)
  const [quad, setQuad] = useState<QuadPoints>({
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  });

  // Crop rect (in image pixel coordinates)
  const [cropRect, setCropRect] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Polygon points (in image pixel coordinates)
  const [polygonPoints, setPolygonPoints] = useState<Point2D[]>([]);

  // Circle params (in image pixel coordinates)
  const [circleParams, setCircleParams] = useState<EllipseParams>({
    cx: 0,
    cy: 0,
    rx: 0,
    ry: 0,
  });

  // Preview unwarped result state
  const [showPreview, setShowPreview] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active dragging handle & magnifier state
  const [draggingHandle, setDraggingHandle] = useState<DragHandle>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialQuad: QuadPoints;
    initialCrop: CropRect;
    initialPolygon: Point2D[];
    initialCircle: EllipseParams;
  }>({
    startX: 0,
    startY: 0,
    initialQuad: quad,
    initialCrop: cropRect,
    initialPolygon: [],
    initialCircle: { cx: 0, cy: 0, rx: 0, ry: 0 },
  });

  // Container & viewport geometry
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 500,
  });

  // Canvas zoom and pan within modal
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Magnifier loupe canvas & container ref
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierContainerRef = useRef<HTMLDivElement>(null);

  // Load and initialize image
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    setShowPreview(false);
    setPreviewDataUrl(null);
    setIsProcessing(true);

    loadImageElement(imageSrc)
      .then(async (img) => {
        let workingImg = img;
        let workingSrc = imageSrc;
        const rawW = img.naturalWidth || img.width;
        const rawH = img.naturalHeight || img.height;

        // Если скан/фото имеет гигантское разрешение (например, 14000x10000 px),
        // плавно нормализуем рабочую копию до 4096px без потери деталей схемы
        if (rawW > 4096 || rawH > 4096) {
          const norm = await normalizeImageResolution(imageSrc, 4096);
          workingSrc = norm.dataUrl;
          workingImg = await loadImageElement(norm.dataUrl);
        }

        setCurrentSrc(workingSrc);
        setOriginalImage(workingImg);
        const w = workingImg.naturalWidth || workingImg.width;
        const h = workingImg.naturalHeight || workingImg.height;
        setImgDims({ width: w, height: h });

        // Initialize quad with a 4% inset from edges
        const marginX = Math.round(w * 0.04);
        const marginY = Math.round(h * 0.04);

        setQuad({
          topLeft: { x: marginX, y: marginY },
          topRight: { x: w - marginX, y: marginY },
          bottomRight: { x: w - marginX, y: h - marginY },
          bottomLeft: { x: marginX, y: h - marginY },
        });

        // Initialize crop rect with 4% inset
        setCropRect({
          x: marginX,
          y: marginY,
          width: w - marginX * 2,
          height: h - marginY * 2,
        });

        // Initialize polygon (6-point shape with insets)
        setPolygonPoints([
          { x: marginX + (w - marginX * 2) * 0.25, y: marginY },
          { x: marginX + (w - marginX * 2) * 0.75, y: marginY },
          { x: w - marginX, y: marginY + (h - marginY * 2) * 0.5 },
          { x: marginX + (w - marginX * 2) * 0.75, y: h - marginY },
          { x: marginX + (w - marginX * 2) * 0.25, y: h - marginY },
          { x: marginX, y: marginY + (h - marginY * 2) * 0.5 },
        ]);

        // Initialize circle
        setCircleParams({
          cx: Math.round(w / 2),
          cy: Math.round(h / 2),
          rx: Math.round((w - marginX * 2) / 2),
          ry: Math.round((h - marginY * 2) / 2),
        });
      })
      .catch((err) => {
        console.error("Ошибка загрузки изображения в мастере:", err);
      })
      .finally(() => {
        setIsProcessing(false);
      });
  }, [isOpen, imageSrc]);

  // Fit image to modal container on load or resize
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || imgDims.width === 0 || imgDims.height === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    setViewportSize({ width: rect.width, height: rect.height });

    const padding = 40;
    const availW = Math.max(100, rect.width - padding * 2);
    const availH = Math.max(100, rect.height - padding * 2);

    const scale = Math.min(availW / imgDims.width, availH / imgDims.height, 1);
    setZoom(scale);

    const centerOffsetX = (rect.width - imgDims.width * scale) / 2;
    const centerOffsetY = (rect.height - imgDims.height * scale) / 2;
    setPan({ x: centerOffsetX, y: centerOffsetY });
  }, [imgDims]);

  useEffect(() => {
    if (imgDims.width > 0 && isOpen) {
      fitToScreen();
    }
  }, [imgDims, isOpen, fitToScreen]);

  // Handle Resize
  useEffect(() => {
    const onWindowResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, []);

  // Coordinate transforms: Image Pixel <-> Screen Pixel
  const imageToScreen = useCallback(
    (pt: Point2D): Point2D => ({
      x: pan.x + pt.x * zoom,
      y: pan.y + pt.y * zoom,
    }),
    [pan, zoom]
  );

  // Rotate 90 deg fixed
  const handleRotate = async (angle: 90 | 270) => {
    if (!originalImage) return;
    setIsProcessing(true);
    try {
      const res = await rotateImageFixed(originalImage, angle);
      const newImg = await loadImageElement(res.dataUrl);
      setCurrentSrc(res.dataUrl);
      setOriginalImage(newImg);
      const newW = newImg.naturalWidth;
      const newH = newImg.naturalHeight;
      setImgDims({ width: newW, height: newH });

      // Reset quad and crop to new bounds
      const marginX = Math.round(newW * 0.04);
      const marginY = Math.round(newH * 0.04);
      setQuad({
        topLeft: { x: marginX, y: marginY },
        topRight: { x: newW - marginX, y: marginY },
        bottomRight: { x: newW - marginX, y: newH - marginY },
        bottomLeft: { x: marginX, y: newH - marginY },
      });
      setCropRect({
        x: marginX,
        y: marginY,
        width: newW - marginX * 2,
        height: newH - marginY * 2,
      });
      setPolygonPoints([
        { x: marginX + (newW - marginX * 2) * 0.25, y: marginY },
        { x: marginX + (newW - marginX * 2) * 0.75, y: marginY },
        { x: newW - marginX, y: marginY + (newH - marginY * 2) * 0.5 },
        { x: marginX + (newW - marginX * 2) * 0.75, y: newH - marginY },
        { x: marginX + (newW - marginX * 2) * 0.25, y: newH - marginY },
        { x: marginX, y: marginY + (newH - marginY * 2) * 0.5 },
      ]);
      setCircleParams({
        cx: Math.round(newW / 2),
        cy: Math.round(newH / 2),
        rx: Math.round((newW - marginX * 2) / 2),
        ry: Math.round((newH - marginY * 2) / 2),
      });
      setShowPreview(false);
      setPreviewDataUrl(null);
    } catch (e) {
      console.error("Ошибка при вращении изображения:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Flip Horizontal / Vertical
  const handleFlip = async (horizontal: boolean, vertical: boolean) => {
    if (!originalImage) return;
    setIsProcessing(true);
    try {
      const res = await flipImage(originalImage, horizontal, vertical);
      const newImg = await loadImageElement(res.dataUrl);
      setCurrentSrc(res.dataUrl);
      setOriginalImage(newImg);
      const newW = newImg.naturalWidth;
      const newH = newImg.naturalHeight;
      setImgDims({ width: newW, height: newH });

      if (horizontal) {
        setQuad((q) => ({
          topLeft: { x: newW - q.topRight.x, y: q.topRight.y },
          topRight: { x: newW - q.topLeft.x, y: q.topLeft.y },
          bottomRight: { x: newW - q.bottomLeft.x, y: q.bottomLeft.y },
          bottomLeft: { x: newW - q.bottomRight.x, y: q.bottomRight.y },
        }));
        setCropRect((c) => ({
          ...c,
          x: newW - (c.x + c.width),
        }));
        setPolygonPoints((pts) => pts.map((p) => ({ x: newW - p.x, y: p.y })));
        setCircleParams((cir) => ({ ...cir, cx: newW - cir.cx }));
      }
      if (vertical) {
        setQuad((q) => ({
          topLeft: { x: q.bottomLeft.x, y: newH - q.bottomLeft.y },
          topRight: { x: q.bottomRight.x, y: newH - q.bottomRight.y },
          bottomRight: { x: q.topRight.x, y: newH - q.topRight.y },
          bottomLeft: { x: q.topLeft.x, y: newH - q.topLeft.y },
        }));
        setCropRect((c) => ({
          ...c,
          y: newH - (c.y + c.height),
        }));
        setPolygonPoints((pts) => pts.map((p) => ({ x: p.x, y: newH - p.y })));
        setCircleParams((cir) => ({ ...cir, cy: newH - cir.cy }));
      }
      setShowPreview(false);
      setPreviewDataUrl(null);
    } catch (e) {
      console.error("Ошибка при отражении изображения:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add a vertex to polygon on an edge
  const handleAddPolygonVertex = (insertAfterIndex: number) => {
    setPolygonPoints((prev) => {
      const p1 = prev[insertAfterIndex];
      const p2 = prev[(insertAfterIndex + 1) % prev.length];
      const midPoint = {
        x: Math.round((p1.x + p2.x) / 2),
        y: Math.round((p1.y + p2.y) / 2),
      };
      const next = [...prev];
      next.splice(insertAfterIndex + 1, 0, midPoint);
      return next;
    });
  };

  // Remove vertex from polygon (min 3 points)
  const handleRemovePolygonVertex = (index: number) => {
    if (polygonPoints.length <= 3) return;
    setPolygonPoints((prev) => prev.filter((_, i) => i !== index));
  };

  // Reset handles to borders
  const handleResetPoints = () => {
    if (imgDims.width === 0) return;
    const marginX = Math.round(imgDims.width * 0.04);
    const marginY = Math.round(imgDims.height * 0.04);
    setQuad({
      topLeft: { x: marginX, y: marginY },
      topRight: { x: imgDims.width - marginX, y: marginY },
      bottomRight: { x: imgDims.width - marginX, y: imgDims.height - marginY },
      bottomLeft: { x: marginX, y: imgDims.height - marginY },
    });
    setCropRect({
      x: marginX,
      y: marginY,
      width: imgDims.width - marginX * 2,
      height: imgDims.height - marginY * 2,
    });
    setPolygonPoints([
      { x: marginX + (imgDims.width - marginX * 2) * 0.25, y: marginY },
      { x: marginX + (imgDims.width - marginX * 2) * 0.75, y: marginY },
      { x: imgDims.width - marginX, y: marginY + (imgDims.height - marginY * 2) * 0.5 },
      { x: marginX + (imgDims.width - marginX * 2) * 0.75, y: imgDims.height - marginY },
      { x: marginX + (imgDims.width - marginX * 2) * 0.25, y: imgDims.height - marginY },
      { x: marginX, y: marginY + (imgDims.height - marginY * 2) * 0.5 },
    ]);
    setCircleParams({
      cx: Math.round(imgDims.width / 2),
      cy: Math.round(imgDims.height / 2),
      rx: Math.round((imgDims.width - marginX * 2) / 2),
      ry: Math.round((imgDims.height - marginY * 2) / 2),
    });
    setShowPreview(false);
    setPreviewDataUrl(null);
  };

  // Update Magnifier Canvas
  const updateMagnifier = (imgPt: Point2D, clientX: number, clientY: number) => {
    if (!originalImage || !magnifierCanvasRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    // Position magnifier relative to container, offset from cursor
    const localX = clientX - containerRect.left;
    const localY = clientY - containerRect.top;

    // Put loupe above or below cursor to avoid covering point
    const loupeX = localX > containerRect.width - 150 ? localX - 160 : localX + 30;
    const loupeY = localY < 150 ? localY + 30 : localY - 140;

    const el = magnifierContainerRef.current;
    if (el) {
      el.style.transform = `translate(${loupeX}px, ${loupeY}px)`;
      if (!el.classList.contains("visible")) {
        el.classList.add("visible");
      }
    }

    const canvas = magnifierCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zoom factor for loupe
    const loupeZoom = 2.5;
    const cropSize = canvas.width / loupeZoom;

    ctx.drawImage(
      originalImage,
      imgPt.x - cropSize / 2,
      imgPt.y - cropSize / 2,
      cropSize,
      cropSize,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Draw Crosshair in center of loupe
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 3, cy - 3, 6, 6);
  };

  // Handle Mouse Down on Handles
  const handleHandleMouseDown = (e: React.MouseEvent, handle: DragHandle) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingHandle(handle);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialQuad: { ...quad },
      initialCrop: { ...cropRect },
      initialPolygon: [...polygonPoints],
      initialCircle: { ...circleParams },
    };
  };

  // Pan & Zoom handlers for container
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Left click on empty space or Middle Click -> Pan
    if (e.button === 0 || e.button === 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleContainerWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));

    // Keep point under mouse steady
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Global Mouse Move for Dragging Handles and Panning (Optimized with requestAnimationFrame)
  useEffect(() => {
    let rafId: number | null = null;
    let latestEvent: MouseEvent | null = null;

    const processFrame = () => {
      rafId = null;
      if (!latestEvent) return;
      const e = latestEvent;

      if (isPanningRef.current) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      if (!draggingHandle) return;

      const dx = (e.clientX - dragStartRef.current.startX) / zoom;
      const dy = (e.clientY - dragStartRef.current.startY) / zoom;
      const initQ = dragStartRef.current.initialQuad;
      const initC = dragStartRef.current.initialCrop;

      if (mode === "perspective") {
        let activePoint: Point2D | null = null;
        if (draggingHandle === "topLeft") {
          const pt = {
            x: Math.max(0, Math.min(imgDims.width, initQ.topLeft.x + dx)),
            y: Math.max(0, Math.min(imgDims.height, initQ.topLeft.y + dy)),
          };
          setQuad((prev) => ({ ...prev, topLeft: pt }));
          activePoint = pt;
        } else if (draggingHandle === "topRight") {
          const pt = {
            x: Math.max(0, Math.min(imgDims.width, initQ.topRight.x + dx)),
            y: Math.max(0, Math.min(imgDims.height, initQ.topRight.y + dy)),
          };
          setQuad((prev) => ({ ...prev, topRight: pt }));
          activePoint = pt;
        } else if (draggingHandle === "bottomRight") {
          const pt = {
            x: Math.max(0, Math.min(imgDims.width, initQ.bottomRight.x + dx)),
            y: Math.max(0, Math.min(imgDims.height, initQ.bottomRight.y + dy)),
          };
          setQuad((prev) => ({ ...prev, bottomRight: pt }));
          activePoint = pt;
        } else if (draggingHandle === "bottomLeft") {
          const pt = {
            x: Math.max(0, Math.min(imgDims.width, initQ.bottomLeft.x + dx)),
            y: Math.max(0, Math.min(imgDims.height, initQ.bottomLeft.y + dy)),
          };
          setQuad((prev) => ({ ...prev, bottomLeft: pt }));
          activePoint = pt;
        }

        if (activePoint) {
          updateMagnifier(activePoint, e.clientX, e.clientY);
        }
      } else if (mode === "crop") {
        // Crop Mode Dragging
        const c = { ...initC };
        if (draggingHandle === "cropNW") {
          const newX = Math.max(0, Math.min(initC.x + initC.width - 20, initC.x + dx));
          const newY = Math.max(0, Math.min(initC.y + initC.height - 20, initC.y + dy));
          c.width += c.x - newX;
          c.height += c.y - newY;
          c.x = newX;
          c.y = newY;
        } else if (draggingHandle === "cropNE") {
          const newY = Math.max(0, Math.min(initC.y + initC.height - 20, initC.y + dy));
          c.width = Math.max(20, Math.min(imgDims.width - c.x, initC.width + dx));
          c.height += c.y - newY;
          c.y = newY;
        } else if (draggingHandle === "cropSE") {
          c.width = Math.max(20, Math.min(imgDims.width - c.x, initC.width + dx));
          c.height = Math.max(20, Math.min(imgDims.height - c.y, initC.height + dy));
        } else if (draggingHandle === "cropSW") {
          const newX = Math.max(0, Math.min(initC.x + initC.width - 20, initC.x + dx));
          c.width += c.x - newX;
          c.height = Math.max(20, Math.min(imgDims.height - c.y, initC.height + dy));
          c.x = newX;
        } else if (draggingHandle === "cropN") {
          const newY = Math.max(0, Math.min(initC.y + initC.height - 20, initC.y + dy));
          c.height += c.y - newY;
          c.y = newY;
        } else if (draggingHandle === "cropS") {
          c.height = Math.max(20, Math.min(imgDims.height - c.y, initC.height + dy));
        } else if (draggingHandle === "cropW") {
          const newX = Math.max(0, Math.min(initC.x + initC.width - 20, initC.x + dx));
          c.width += c.x - newX;
          c.x = newX;
        } else if (draggingHandle === "cropE") {
          c.width = Math.max(20, Math.min(imgDims.width - c.x, initC.width + dx));
        } else if (draggingHandle === "cropMove") {
          c.x = Math.max(0, Math.min(imgDims.width - c.width, initC.x + dx));
          c.y = Math.max(0, Math.min(imgDims.height - c.height, initC.y + dy));
        }
        setCropRect(c);
      } else if (mode === "polygon") {
        if (draggingHandle?.startsWith("polygon_")) {
          const idx = parseInt(draggingHandle.replace("polygon_", ""), 10);
          const initPt = dragStartRef.current.initialPolygon[idx];
          if (initPt) {
            const newPt = {
              x: Math.max(0, Math.min(imgDims.width, Math.round(initPt.x + dx))),
              y: Math.max(0, Math.min(imgDims.height, Math.round(initPt.y + dy))),
            };
            setPolygonPoints((prev) => prev.map((p, i) => (i === idx ? newPt : p)));
            updateMagnifier(newPt, e.clientX, e.clientY);
          }
        }
      } else if (mode === "circle") {
        const initCir = dragStartRef.current.initialCircle;
        if (draggingHandle === "circleCenter") {
          const newCx = Math.max(10, Math.min(imgDims.width - 10, Math.round(initCir.cx + dx)));
          const newCy = Math.max(10, Math.min(imgDims.height - 10, Math.round(initCir.cy + dy)));
          setCircleParams((prev) => ({ ...prev, cx: newCx, cy: newCy }));
        } else if (draggingHandle === "circleE") {
          const newRx = Math.max(10, Math.min(imgDims.width, Math.round(initCir.rx + dx)));
          setCircleParams((prev) => ({ ...prev, rx: newRx }));
          updateMagnifier({ x: initCir.cx + newRx, y: initCir.cy }, e.clientX, e.clientY);
        } else if (draggingHandle === "circleW") {
          const newRx = Math.max(10, Math.min(imgDims.width, Math.round(initCir.rx - dx)));
          setCircleParams((prev) => ({ ...prev, rx: newRx }));
          updateMagnifier({ x: initCir.cx - newRx, y: initCir.cy }, e.clientX, e.clientY);
        } else if (draggingHandle === "circleS") {
          const newRy = Math.max(10, Math.min(imgDims.height, Math.round(initCir.ry + dy)));
          setCircleParams((prev) => ({ ...prev, ry: newRy }));
          updateMagnifier({ x: initCir.cx, y: initCir.cy + newRy }, e.clientX, e.clientY);
        } else if (draggingHandle === "circleN") {
          const newRy = Math.max(10, Math.min(imgDims.height, Math.round(initCir.ry - dy)));
          setCircleParams((prev) => ({ ...prev, ry: newRy }));
          updateMagnifier({ x: initCir.cx, y: initCir.cy - newRy }, e.clientX, e.clientY);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      latestEvent = e;
      if (!rafId && (isPanningRef.current || draggingHandle)) {
        rafId = requestAnimationFrame(processFrame);
      }
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      isPanningRef.current = false;
      setDraggingHandle(null);
      if (magnifierContainerRef.current) {
        magnifierContainerRef.current.classList.remove("visible");
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingHandle, zoom, mode, imgDims, originalImage]);

  // Toggle Live Preview
  const savedViewRef = useRef<{ pan: { x: number; y: number }; zoom: number }>({ pan: { x: 0, y: 0 }, zoom: 1 });

  const handleTogglePreview = async () => {
    if (showPreview) {
      setShowPreview(false);
      setPan(savedViewRef.current.pan);
      setZoom(savedViewRef.current.zoom);
      return;
    }

    if (!originalImage) return;
    setIsProcessing(true);
    try {
      let res: { dataUrl: string; width: number; height: number };
      if (mode === "perspective") {
        res = await warpPerspective(originalImage, quad, { maxDimension: 1800 });
      } else if (mode === "crop") {
        res = await cropImage(originalImage, cropRect);
      } else if (mode === "polygon") {
        res = await cropPolygon(originalImage, polygonPoints, { maxDimension: 1800 });
      } else {
        res = await cropEllipse(originalImage, circleParams, { maxDimension: 1800 });
      }
      setPreviewDataUrl(res.dataUrl);
      savedViewRef.current = { pan: { ...pan }, zoom };

      // Fit preview into container
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availW = Math.max(100, rect.width - 60);
        const availH = Math.max(100, rect.height - 60);
        const scale = Math.min(availW / res.width, availH / res.height, 1);
        setZoom(scale);
        setPan({
          x: (rect.width - res.width * scale) / 2,
          y: (rect.height - res.height * scale) / 2,
        });
      }
      setShowPreview(true);
    } catch (e) {
      console.error("Ошибка при создании предпросмотра:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Processing and Insert
  const handleConfirmApply = async () => {
    if (!originalImage) return;
    setIsProcessing(true);
    try {
      let res: { dataUrl: string; width: number; height: number };
      if (mode === "perspective") {
        res = await warpPerspective(originalImage, quad, { maxDimension: 3600 });
      } else if (mode === "crop") {
        res = await cropImage(originalImage, cropRect);
      } else if (mode === "polygon") {
        res = await cropPolygon(originalImage, polygonPoints, { maxDimension: 4096 });
      } else {
        res = await cropEllipse(originalImage, circleParams, { maxDimension: 4096 });
      }
      onApply(res);
    } catch (e) {
      console.error("Ошибка применения трансформации изображения:", e);
      alert("Не удалось обработать изображение: " + (e as any)?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Screen coordinates for Perspective Quad
  const sTL = imageToScreen(quad.topLeft);
  const sTR = imageToScreen(quad.topRight);
  const sBR = imageToScreen(quad.bottomRight);
  const sBL = imageToScreen(quad.bottomLeft);

  // Screen coordinates for Crop Rect
  const sCropTL = imageToScreen({ x: cropRect.x, y: cropRect.y });
  const sCropW = cropRect.width * zoom;
  const sCropH = cropRect.height * zoom;

  // Expected output dimensions
  let outDims = { width: 0, height: 0 };
  if (mode === "perspective") {
    outDims = calculateTargetDimensions(quad, 3400);
  } else if (mode === "crop") {
    outDims = { width: Math.round(cropRect.width), height: Math.round(cropRect.height) };
  } else if (mode === "polygon") {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of polygonPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    outDims = {
      width: Math.max(1, Math.round(maxX - minX)),
      height: Math.max(1, Math.round(maxY - minY)),
    };
  } else {
    outDims = {
      width: Math.round(circleParams.rx * 2),
      height: Math.round(circleParams.ry * 2),
    };
  }

  // Helper: compute interior perspective grid lines for 3x3 subdivisions
  const getSubdividedPoints = (u: number, v: number): Point2D => {
    // Bilinear blend across the 4 corners for the guide grid
    const topX = quad.topLeft.x + (quad.topRight.x - quad.topLeft.x) * u;
    const topY = quad.topLeft.y + (quad.topRight.y - quad.topLeft.y) * u;
    const botX = quad.bottomLeft.x + (quad.bottomRight.x - quad.bottomLeft.x) * u;
    const botY = quad.bottomLeft.y + (quad.bottomRight.y - quad.bottomLeft.y) * u;

    const x = topX + (botX - topX) * v;
    const y = topY + (botY - topY) * v;
    return imageToScreen({ x, y });
  };

  // Global Escape key handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [onClose]);

  return (
    <div
      className="cad-modal-backdrop"
      onClick={onClose}
    >
      <div className="cad-preprocess-modal" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="cad-preprocess-header">
          <div className="header-title-group">
            <div className="header-icon-badge">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="modal-title">Мастер подготовки изображения платы</div>
              <div className="modal-subtitle">
                {fileName || "Скан платы"} • Исходный размер: {imgDims.width} × {imgDims.height} px
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="cad-dialog-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Закрыть (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL TOOLBAR */}
        <div className="cad-preprocess-toolbar">
          {/* Tool Selector Group */}
          <div className="tool-tabs" role="tablist">
            <button
              className={`tool-tab-btn ${mode === "perspective" ? "active" : ""}`}
              onClick={() => {
                setMode("perspective");
                setShowPreview(false);
              }}
              title="Устранить наклон камеры и выпрямить плату по 4 углам (Перспектива)"
            >
              <Maximize2 size={13} />
              <span>4 угла</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "crop" ? "active" : ""}`}
              onClick={() => {
                setMode("crop");
                setShowPreview(false);
              }}
              title="Прямоугольная обрезка лишнего фона и стола"
            >
              <CropIcon size={13} />
              <span>Прямоугольник</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "polygon" ? "active" : ""}`}
              onClick={() => {
                setMode("polygon");
                setShowPreview(false);
              }}
              title="Многоугольная обрезка сложных плат (L-образных, с вырезами) с прозрачным фоном"
            >
              <Hexagon size={13} />
              <span>Полигон</span>
            </button>
            <button
              className={`tool-tab-btn ${mode === "circle" ? "active" : ""}`}
              onClick={() => {
                setMode("circle");
                setShowPreview(false);
              }}
              title="Круглая или овальная обрезка плат с прозрачным фоном"
            >
              <CircleIcon size={13} />
              <span>Круг</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Orientation & Transform Actions */}
          <div className="tool-actions-group">
            <button
              className="cad-tool-btn"
              onClick={() => handleRotate(270)}
              disabled={isProcessing}
              title="Повернуть на 90° против часовой стрелки"
            >
              <RotateCcw size={13} />
              <span>-90°</span>
            </button>
            <button
              className="cad-tool-btn"
              onClick={() => handleRotate(90)}
              disabled={isProcessing}
              title="Повернуть на 90° по часовой стрелке"
            >
              <RotateCw size={13} />
              <span>+90°</span>
            </button>
            <button
              className="cad-tool-btn"
              onClick={() => handleFlip(true, false)}
              disabled={isProcessing}
              title="Отразить по горизонтали (Flip H) — критично для слоя Bottom платы"
            >
              <FlipHorizontal size={13} />
              <span>Зеркало H</span>
            </button>
            <button
              className="cad-tool-btn"
              onClick={() => handleFlip(false, true)}
              disabled={isProcessing}
              title="Отразить по вертикали (Flip V)"
            >
              <FlipVertical size={13} />
              <span>Зеркало V</span>
            </button>
            <button
              className="cad-tool-btn btn-reset"
              onClick={handleResetPoints}
              title="Сбросить точки кадрирования на края"
            >
              <RefreshCw size={12} />
              <span>Сброс</span>
            </button>
          </div>

          <div className="toolbar-spacer" />

          {/* View & Preview Actions */}
          <div className="tool-actions-group">
            <button className="cad-tool-btn" onClick={fitToScreen} title="Вписать изображение в окно">
              <Maximize2 size={13} />
              <span>По размеру</span>
            </button>
            <button
              className={`cad-tool-btn btn-preview ${showPreview ? "btn-active-highlight" : ""}`}
              onClick={handleTogglePreview}
              disabled={isProcessing}
              title="Посмотреть выпрямленный/обрезанный результат"
            >
              <Eye size={13} />
              <span>{showPreview ? "Оригинал" : "Предпросмотр"}</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE VIEWPORT */}
        <div
          ref={containerRef}
          className="cad-preprocess-viewport"
          onMouseDown={handleContainerMouseDown}
          onWheel={handleContainerWheel}
        >
          {/* Main Image Layer */}
          {currentSrc && (
            <div
              className="viewport-image-canvas"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {showPreview && previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Выпрямленный предпросмотр"
                  className="preview-img-result"
                  draggable={false}
                />
              ) : (
                <img
                  src={currentSrc}
                  alt="Исходный снимок"
                  className="original-src-img"
                  draggable={false}
                />
              )}
            </div>
          )}

          {/* SVG Interactive Overlay with Handles (when not in preview mode) */}
          {!showPreview && (
            <svg
              className="viewport-svg-overlay"
              style={{ width: "100%", height: "100%", pointerEvents: "none" }}
            >
              <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
                </filter>
              </defs>

              {/* PERSPECTIVE MODE OVERLAY */}
              {mode === "perspective" && (
                <g>
                  {/* Perspective Grid 3x3 */}
                  {[0.333, 0.667].map((u, i) => {
                    const p1 = getSubdividedPoints(u, 0);
                    const p2 = getSubdividedPoints(u, 1);
                    return (
                      <g key={`vgrid-${i}`}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="rgba(0,0,0,0.7)"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="5 5"
                        />
                      </g>
                    );
                  })}
                  {[0.333, 0.667].map((v, i) => {
                    const p1 = getSubdividedPoints(0, v);
                    const p2 = getSubdividedPoints(1, v);
                    return (
                      <g key={`hgrid-${i}`}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="rgba(0,0,0,0.7)"
                          strokeWidth="2.5"
                        />
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="5 5"
                        />
                      </g>
                    );
                  })}

                  {/* Polygon Boundary */}
                  <polygon
                    points={`${sTL.x},${sTL.y} ${sTR.x},${sTR.y} ${sBR.x},${sBR.y} ${sBL.x},${sBL.y}`}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    filter="url(#shadow)"
                  />

                  {/* 4 Corner Handles */}
                  {[
                    { pt: sTL, handle: "topLeft" as DragHandle, label: "TL" },
                    { pt: sTR, handle: "topRight" as DragHandle, label: "TR" },
                    { pt: sBR, handle: "bottomRight" as DragHandle, label: "BR" },
                    { pt: sBL, handle: "bottomLeft" as DragHandle, label: "BL" },
                  ].map((item) => (
                    <g
                      key={item.handle}
                      style={{ pointerEvents: "all", cursor: "crosshair" }}
                      onMouseDown={(e) => handleHandleMouseDown(e, item.handle)}
                    >
                      {/* Outer Ring */}
                      <circle
                        cx={item.pt.x}
                        cy={item.pt.y}
                        r={12}
                        fill="rgba(56, 189, 248, 0.25)"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        filter="url(#shadow)"
                        className="interactive-corner-handle"
                      />
                      {/* Inner Bullseye */}
                      <circle cx={item.pt.x} cy={item.pt.y} r={3.5} fill="#ffffff" />
                    </g>
                  ))}
                </g>
              )}

              {/* CROP MODE OVERLAY */}
              {mode === "crop" && (
                <g>
                  {/* Darkened mask around crop box */}
                  <path
                    d={`M 0 0 L ${viewportSize.width} 0 L ${viewportSize.width} ${viewportSize.height} L 0 ${viewportSize.height} Z
                        M ${sCropTL.x} ${sCropTL.y} L ${sCropTL.x} ${sCropTL.y + sCropH} L ${sCropTL.x + sCropW} ${sCropTL.y + sCropH} L ${sCropTL.x + sCropW} ${sCropTL.y} Z`}
                    fill="rgba(0, 0, 0, 0.6)"
                    fillRule="evenodd"
                  />

                  {/* Crop Border */}
                  <rect
                    x={sCropTL.x}
                    y={sCropTL.y}
                    width={sCropW}
                    height={sCropH}
                    fill="transparent"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    filter="url(#shadow)"
                    style={{ pointerEvents: "all", cursor: "move" }}
                    onMouseDown={(e) => handleHandleMouseDown(e, "cropMove")}
                  />

                  {/* 3x3 Rule of Thirds Grid */}
                  <line
                    x1={sCropTL.x + sCropW / 3}
                    y1={sCropTL.y}
                    x2={sCropTL.x + sCropW / 3}
                    y2={sCropTL.y + sCropH}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />
                  <line
                    x1={sCropTL.x + (sCropW * 2) / 3}
                    y1={sCropTL.y}
                    x2={sCropTL.x + (sCropW * 2) / 3}
                    y2={sCropTL.y + sCropH}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />
                  <line
                    x1={sCropTL.x}
                    y1={sCropTL.y + sCropH / 3}
                    x2={sCropTL.x + sCropW}
                    y2={sCropTL.y + sCropH / 3}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />
                  <line
                    x1={sCropTL.x}
                    y1={sCropTL.y + (sCropH * 2) / 3}
                    x2={sCropTL.x + sCropW}
                    y2={sCropTL.y + (sCropH * 2) / 3}
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                  />

                  {/* 8 Crop Handles */}
                  {[
                    { x: sCropTL.x, y: sCropTL.y, h: "cropNW" as DragHandle, cur: "nwse-resize" },
                    { x: sCropTL.x + sCropW / 2, y: sCropTL.y, h: "cropN" as DragHandle, cur: "ns-resize" },
                    { x: sCropTL.x + sCropW, y: sCropTL.y, h: "cropNE" as DragHandle, cur: "nesw-resize" },
                    { x: sCropTL.x + sCropW, y: sCropTL.y + sCropH / 2, h: "cropE" as DragHandle, cur: "ew-resize" },
                    { x: sCropTL.x + sCropW, y: sCropTL.y + sCropH, h: "cropSE" as DragHandle, cur: "nwse-resize" },
                    { x: sCropTL.x + sCropW / 2, y: sCropTL.y + sCropH, h: "cropS" as DragHandle, cur: "ns-resize" },
                    { x: sCropTL.x, y: sCropTL.y + sCropH, h: "cropSW" as DragHandle, cur: "nesw-resize" },
                    { x: sCropTL.x, y: sCropTL.y + sCropH / 2, h: "cropW" as DragHandle, cur: "ew-resize" },
                  ].map((item, idx) => (
                    <rect
                      key={`crop-handle-${idx}`}
                      x={item.x - 5}
                      y={item.y - 5}
                      width={10}
                      height={10}
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth="2"
                      filter="url(#shadow)"
                      style={{ pointerEvents: "all", cursor: item.cur }}
                      onMouseDown={(e) => handleHandleMouseDown(e, item.h)}
                    />
                  ))}
                </g>
              )}

              {/* POLYGON MODE OVERLAY */}
              {mode === "polygon" && polygonPoints.length >= 3 && (
                <g>
                  {/* Polygon Boundary */}
                  <polygon
                    points={polygonPoints
                      .map((pt) => {
                        const s = imageToScreen(pt);
                        return `${s.x},${s.y}`;
                      })
                      .join(" ")}
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    filter="url(#shadow)"
                  />

                  {/* Midpoint '+' buttons on each edge to add vertex */}
                  {polygonPoints.map((pt, i) => {
                    const nextPt = polygonPoints[(i + 1) % polygonPoints.length];
                    const s1 = imageToScreen(pt);
                    const s2 = imageToScreen(nextPt);
                    const midX = (s1.x + s2.x) / 2;
                    const midY = (s1.y + s2.y) / 2;
                    return (
                      <g
                        key={`poly-edge-add-${i}`}
                        style={{ pointerEvents: "all", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddPolygonVertex(i);
                        }}
                      >
                        <title>Добавить вершину на этой грани</title>
                        <circle
                          cx={midX}
                          cy={midY}
                          r={7}
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          filter="url(#shadow)"
                        />
                        <text
                          x={midX}
                          y={midY + 3.5}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="bold"
                          style={{ userSelect: "none" }}
                        >
                          +
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertex handles */}
                  {polygonPoints.map((pt, i) => {
                    const s = imageToScreen(pt);
                    return (
                      <g
                        key={`poly-vertex-${i}`}
                        style={{ pointerEvents: "all", cursor: "grab" }}
                        onMouseDown={(e) => handleHandleMouseDown(e, `polygon_${i}` as DragHandle)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemovePolygonVertex(i);
                        }}
                      >
                        <title>{`Вершина ${i + 1} (Перетащите для изменения, ПКМ для удаления)`}</title>
                        <circle
                          cx={s.x}
                          cy={s.y}
                          r={10}
                          fill="rgba(56, 189, 248, 0.3)"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          filter="url(#shadow)"
                        />
                        <circle cx={s.x} cy={s.y} r={3.5} fill="#ffffff" />
                        <text
                          x={s.x}
                          y={s.y - 12}
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                          filter="url(#shadow)"
                          style={{ userSelect: "none" }}
                        >
                          {i + 1}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* CIRCLE / ELLIPSE MODE OVERLAY */}
              {mode === "circle" && (
                <g>
                  {(() => {
                    const sCenter = imageToScreen({ x: circleParams.cx, y: circleParams.cy });
                    const sRx = circleParams.rx * zoom;
                    const sRy = circleParams.ry * zoom;
                    return (
                      <>
                        <ellipse
                          cx={sCenter.x}
                          cy={sCenter.y}
                          rx={sRx}
                          ry={sRy}
                          fill="rgba(56, 189, 248, 0.12)"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                          filter="url(#shadow)"
                        />

                        {/* Center crosshair */}
                        <line
                          x1={sCenter.x - 16}
                          y1={sCenter.y}
                          x2={sCenter.x + 16}
                          y2={sCenter.y}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={sCenter.x}
                          y1={sCenter.y - 16}
                          x2={sCenter.x}
                          y2={sCenter.y + 16}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />

                        {/* Center drag handle */}
                        <circle
                          cx={sCenter.x}
                          cy={sCenter.y}
                          r={9}
                          fill="#38bdf8"
                          stroke="#ffffff"
                          strokeWidth="2"
                          filter="url(#shadow)"
                          style={{ pointerEvents: "all", cursor: "move" }}
                          onMouseDown={(e) => handleHandleMouseDown(e, "circleCenter")}
                        >
                          <title>Переместить центр круга</title>
                        </circle>

                        {/* 4 Radial Handles (N, S, E, W) */}
                        {[
                          { x: sCenter.x, y: sCenter.y - sRy, h: "circleN" as DragHandle, cur: "ns-resize", title: "Радиус по вертикали (Верх)" },
                          { x: sCenter.x, y: sCenter.y + sRy, h: "circleS" as DragHandle, cur: "ns-resize", title: "Радиус по вертикали (Низ)" },
                          { x: sCenter.x + sRx, y: sCenter.y, h: "circleE" as DragHandle, cur: "ew-resize", title: "Радиус по горизонтали (Право)" },
                          { x: sCenter.x - sRx, y: sCenter.y, h: "circleW" as DragHandle, cur: "ew-resize", title: "Радиус по горизонтали (Лево)" },
                        ].map((item, idx) => (
                          <rect
                            key={`circle-handle-${idx}`}
                            x={item.x - 6}
                            y={item.y - 6}
                            width={12}
                            height={12}
                            fill="#ffffff"
                            stroke="#0284c7"
                            strokeWidth="2"
                            filter="url(#shadow)"
                            style={{ pointerEvents: "all", cursor: item.cur }}
                            onMouseDown={(e) => handleHandleMouseDown(e, item.h)}
                          >
                            <title>{item.title}</title>
                          </rect>
                        ))}
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>
          )}

          {/* Floating Magnifier Loupe when dragging corners */}
          <div
            ref={magnifierContainerRef}
            className="cad-corner-loupe"
          >
            <canvas ref={magnifierCanvasRef} width={120} height={120} />
            <div className="loupe-label">Угол платы</div>
          </div>

          {/* Instructions tooltip */}
          <div className="cad-viewport-hint">
            {mode === "perspective" && "Перетащите 4 маркера на реальные углы платы • Колёсико: зум • Пробел/СКМ: панорама"}
            {mode === "crop" && "Потяните за края рамки для кадрирования • Колёсико: зум • Пробел/СКМ: панорама"}
            {mode === "polygon" && "Перетащите вершины • Нажмите [+] на ребре для добавления • ПКМ по точке — удалить"}
            {mode === "circle" && "Перетащите центр круга и 4 боковых маркера радиуса для подгонки"}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="cad-preprocess-footer">
          <div className="footer-meta-info">
            <span className="meta-label">Результат:</span>
            <span className="meta-value">
              {outDims.width} × {outDims.height} px
            </span>
            <span className="meta-hint">
              {mode === "perspective" && "(Выравнивание перспективы)"}
              {mode === "crop" && "(Прямоугольное кадрирование)"}
              {mode === "polygon" && `(Многоугольник, ${polygonPoints.length} вершин, PNG с прозрачностью)`}
              {mode === "circle" && "(Круг/овал, PNG с прозрачностью)"}
            </span>
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="cad-btn-flat"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              disabled={isProcessing}
            >
              Отмена
            </button>
            <button
              className="cad-btn-outline"
              onClick={onBypass}
              disabled={isProcessing}
              title="Вставить файл как есть без обрезки и выравнивания"
            >
              Вставить без обработки
            </button>
            <button
              className="cad-btn-primary with-icon"
              onClick={handleConfirmApply}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="spinner-dots" />
                  <span>Обработка...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Применить и вставить</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
