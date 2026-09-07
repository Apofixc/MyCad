import React, { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { ToolBar } from "./ToolBar";
import { CurtainSlider } from "./CurtainSlider";
import { MagnifierLoupe } from "./MagnifierLoupe";
import { engineClient, resolveImageUrl } from "../../api/engineClient";

import { Image as ImageIcon } from "lucide-react";
import {
  extractImagesFromDrop,
  extractImageFromClipboard,
  readFileAsDataUrl,
} from "../../utils/imageLoader";

export const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    board,
    selectedImageId,
    selectImage,
  } = useProjectStore();

  const {
    activeTool,
    viewportZoom,
    setViewportZoom,
    viewportPan,
    setViewportPan,
    setCursorMm,
    showGrid,
    gridStepMm,
    showTopLayer,
    showBottomLayer,
    curtainPosition,
    curtainVertical,
    setPendingPreprocess,
    setPendingBatchImport,
  } = useUiStore();

  // Drag-and-drop overlay state
  const [isCanvasDragOver, setIsCanvasDragOver] = useState(false);

  // Dragging / Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calibration / Measurement points
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);

  // Cache loaded images
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
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

    allImages.forEach(async (imgLayer) => {
      if (!imgLayer.cachedUrl) return;

      const existing = loadedImagesRef.current.get(imgLayer.id);
      if (existing && existing.complete && existing.naturalWidth > 0) return;

      const img = new window.Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        if (!isMounted) return;
        loadedImagesRef.current.set(imgLayer.id, img);
        setImagesLoadedTick((t) => t + 1);
      };

      img.onerror = async (err) => {
        console.warn(`[BoardCanvas] Failed to load image "${imgLayer.name}" via resolved URL, attempting raw bytes fallback:`, err);
        try {
          const bytes = await engineClient.readImageBytes(imgLayer.cachedUrl!);
          if (!isMounted || !bytes || bytes.length === 0) return;
          const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
          const blobUrl = URL.createObjectURL(blob);
          const fallbackImg = new window.Image();
          fallbackImg.onload = () => {
            if (!isMounted) return;
            loadedImagesRef.current.set(imgLayer.id, fallbackImg);
            setImagesLoadedTick((t) => t + 1);
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

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
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
        const curtainSplit = activeTool === "curtain" ? curtainPosition : null;

        // Draw Bottom Scan
        if (showBottomLayer) {
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
            if (layer.visible) drawImageLayer(ctx, layer, boardMmToScreen, MM_TO_PX, zoomFactor, loadedImagesRef.current);
          });
          ctx.restore();
        }

        // Draw Top Scan
        if (showTopLayer) {
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
            if (layer.visible) drawImageLayer(ctx, layer, boardMmToScreen, MM_TO_PX, zoomFactor, loadedImagesRef.current);
          });
          ctx.restore();
        }
      }

      // 3. Draw Active Tool Overlays (Measure / Calibration lines)
      if (measurePts.length > 0) {
        drawMeasurementOverlay(ctx, measurePts, boardMmToScreen);
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
    activeTool,
    curtainPosition,
    curtainVertical,
    measurePts,
    boardMmToScreen,
  ]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Tool: Measure, Calibrate, Level, Register
    if (activeTool === "measure" || activeTool === "calibrate" || activeTool === "level" || activeTool === "register") {
      const mouseMm = screenToBoardMm(mouseX, mouseY);
      const next = [...measurePts, [mouseMm.x, mouseMm.y] as [number, number]];
      if (next.length > 2) {
        setMeasurePts([[mouseMm.x, mouseMm.y]]);
      } else {
        setMeasurePts(next);
      }
      return;
    }

    // Default: Pan canvas
    setIsPanning(true);
    setPanStart({ x: e.clientX - viewportPan.x, y: e.clientY - viewportPan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mouseMm = screenToBoardMm(mouseX, mouseY);
    setCursorMm(mouseMm);

    if (isPanning) {
      setViewportPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Cursor-anchored Zoom on Wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactorBefore = viewportZoom / 100;
    const zoomDelta = e.deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.max(10, Math.min(2000, Math.round(viewportZoom * zoomDelta)));
    const zoomFactorAfter = nextZoom / 100;

    // Anchor zoom to cursor position
    const newPanX = mouseX - ((mouseX - viewportPan.x) * zoomFactorAfter) / zoomFactorBefore;
    const newPanY = mouseY - ((mouseY - viewportPan.y) * zoomFactorAfter) / zoomFactorBefore;

    setViewportZoom(nextZoom);
    setViewportPan({ x: newPanX, y: newPanY });
  };

  // Clipboard Paste (Ctrl+V)
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
        const side = showTopLayer ? "top" : "bottom";
        const centerMm = screenToBoardMm(
          (canvasRef.current?.clientWidth || 800) / 2,
          (canvasRef.current?.clientHeight || 600) / 2
        );
        const dataUrl = await readFileAsDataUrl(file);
        setPendingPreprocess({
          file,
          dataUrl,
          name: file.name || "Снимок_платы",
          side,
          customPos: centerMm,
        });
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [showTopLayer, screenToBoardMm, setPendingPreprocess]);

  return (
    <div
      ref={containerRef}
      className="cad-viewport"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCanvasDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCanvasDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsCanvasDragOver(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCanvasDragOver(false);

        const files = extractImagesFromDrop(e);
        if (files.length === 0) return;

        const rect = containerRef.current?.getBoundingClientRect();
        const mouseX = e.clientX - (rect?.left || 0);
        const mouseY = e.clientY - (rect?.top || 0);
        const dropMm = screenToBoardMm(mouseX, mouseY);
        const side = showTopLayer ? "top" : "bottom";

        if (files.length === 1) {
          const f = files[0];
          const filePath = (f as any).filePath as string | undefined;
          const dataUrl = filePath ? filePath : await readFileAsDataUrl(f);
          setPendingPreprocess({
            file: f,
            filePath,
            dataUrl,
            name: f.name,
            side,
            customPos: dropMm,
          });
        } else {
          setPendingBatchImport({
            files,
            side,
            customPos: dropMm,
          });
        }
      }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isCanvasDragOver && (
        <div className="cad-canvas-dragover-overlay">
          <ImageIcon size={48} className="dragover-icon" />
          <h3>Бросьте сюда фото платы</h3>
          <p>
            Изображения будут добавлены в слой{" "}
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>
              {showTopLayer ? "Top (Лицевая сторона)" : "Bottom (Оборотная сторона)"}
            </span>
          </p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="cad-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Floating Glass Toolbars */}
      <ToolBar />
      <CurtainSlider />
      <MagnifierLoupe sourceCanvasRef={canvasRef} />

      {/* Viewport Coordinate HUD */}
      <div className="cad-hud-overlay">
        <span>X: <span className="cad-hud-coord">{screenToBoardMm(0, 0).x.toFixed(2)}</span></span>
        <span>Y: <span className="cad-hud-coord">{screenToBoardMm(0, 0).y.toFixed(2)}</span></span>
        <span>Зум: {viewportZoom}%</span>
        <button
          className="cad-hud-btn"
          style={{
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#38bdf8",
            borderRadius: "4px",
            padding: "2px 6px",
            cursor: "pointer",
            fontSize: "10px",
            marginLeft: "6px",
          }}
          onClick={() => {
            setViewportZoom(100);
            setViewportPan({ x: 80, y: 80 });
          }}
          title="Сбросить масштаб и положение (80, 80)"
        >
          Сброс вида
        </button>
      </div>
    </div>
  );
};

// ===================== DRAWING HELPERS =====================

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: { x: number; y: number },
  zoom: number,
  stepMm: number,
  mmToPx: number
) {
  const stepPx = stepMm * mmToPx * zoom;
  if (stepPx < 8) return; // Too dense to draw

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;

  const startX = pan.x % stepPx;
  const startY = pan.y % stepPx;

  ctx.beginPath();
  for (let x = startX; x < width; x += stepPx) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = startY; y < height; y += stepPx) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Major 5mm lines
  const majorStepPx = stepPx * 5;
  if (majorStepPx >= 20) {
    ctx.strokeStyle = "rgba(59, 130, 246, 0.08)";
    ctx.lineWidth = 1;
    const majorStartX = pan.x % majorStepPx;
    const majorStartY = pan.y % majorStepPx;

    ctx.beginPath();
    for (let x = majorStartX; x < width; x += majorStepPx) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = majorStartY; y < height; y += majorStepPx) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  // Draw (0,0) Board Origin Cross
  ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pan.x - 15, pan.y);
  ctx.lineTo(pan.x + 15, pan.y);
  ctx.moveTo(pan.x, pan.y - 15);
  ctx.lineTo(pan.x, pan.y + 15);
  ctx.stroke();

  ctx.restore();
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: any,
  boardMmToScreen: (x: number, y: number) => { x: number; y: number },
  mmToPx: number,
  zoom: number,
  cache: Map<string, HTMLImageElement>
) {
  const img = cache.get(layer.id);
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const pos = boardMmToScreen(layer.offsetX || 0, layer.offsetY || 0);
  const pxPerMm = layer.pxPerMm || 23.62;
  const wMm = img.naturalWidth / pxPerMm;
  const hMm = img.naturalHeight / pxPerMm;
  const wPx = wMm * mmToPx * zoom * (layer.scale || 1.0);
  const hPx = hMm * mmToPx * zoom * (layer.scale || 1.0);

  ctx.save();
  ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 0.85;

  // Apply position
  ctx.translate(pos.x, pos.y);

  // Rotate around center
  if (layer.rotation) {
    ctx.translate(wPx / 2, hPx / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-wPx / 2, -hPx / 2);
  }

  // Flip within bounding box
  if (layer.mirrored) {
    ctx.translate(wPx, 0);
    ctx.scale(-1, 1);
  }
  if (layer.flipV) {
    ctx.translate(0, hPx);
    ctx.scale(1, -1);
  }

  // Blend mode
  if (layer.blendMode && layer.blendMode !== "normal") {
    ctx.globalCompositeOperation = layer.blendMode;
  }

  // Apply filters
  let filterStr = "";
  if (layer.brightness !== undefined && layer.brightness !== 100) filterStr += `brightness(${layer.brightness}%) `;
  if (layer.contrast !== undefined && layer.contrast !== 100) filterStr += `contrast(${layer.contrast}%) `;
  if (layer.invert) filterStr += "invert(100%) ";
  if (layer.grayscale) filterStr += "grayscale(100%) ";
  if (filterStr) ctx.filter = filterStr.trim();

  ctx.drawImage(img, 0, 0, wPx, hPx);
  ctx.restore();
}

function drawMeasurementOverlay(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  boardMmToScreen: (x: number, y: number) => { x: number; y: number }
) {
  if (pts.length < 2) return;
  const p1 = boardMmToScreen(pts[0][0], pts[0][1]);
  const p2 = boardMmToScreen(pts[1][0], pts[1][1]);

  const dxMm = pts[1][0] - pts[0][0];
  const dyMm = pts[1][1] - pts[0][1];
  const distMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm);

  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  // Draw endpoints
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
  ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw distance label
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fillRect(midX - 40, midY - 12, 80, 24);
  ctx.strokeStyle = "#38bdf8";
  ctx.strokeRect(midX - 40, midY - 12, 80, 24);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${distMm.toFixed(2)} mm`, midX, midY);

  ctx.restore();
}
