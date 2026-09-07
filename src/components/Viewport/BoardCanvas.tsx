import React, { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { ToolBar } from "./ToolBar";
import { CurtainSlider } from "./CurtainSlider";
import { MagnifierLoupe } from "./MagnifierLoupe";

export const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
  } = useUiStore();

  // Dragging / Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calibration / Measurement points
  const [measurePts, setMeasurePts] = useState<[number, number][]>([]);

  // Cache loaded images
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

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
    const allImages = [...board.data.bgTop.images, ...board.data.bgBottom.images];
    allImages.forEach((imgLayer) => {
      if (imgLayer.cachedUrl && !loadedImagesRef.current.has(imgLayer.id)) {
        const img = new window.Image();
        img.src = imgLayer.cachedUrl;
        img.onload = () => {
          loadedImagesRef.current.set(imgLayer.id, img);
        };
      }
    });
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

  return (
    <div className="cad-viewport">
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
  if (!img || !img.complete) return;

  const pos = boardMmToScreen(layer.offsetX, layer.offsetY);
  const pxPerMm = layer.pxPerMm || 23.62;
  const wMm = img.width / pxPerMm;
  const hMm = img.height / pxPerMm;
  const wPx = wMm * mmToPx * zoom * (layer.scale || 1.0);
  const hPx = hMm * mmToPx * zoom * (layer.scale || 1.0);

  ctx.save();
  ctx.globalAlpha = layer.opacity || 0.85;
  ctx.translate(pos.x, pos.y);
  if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.mirrored) ctx.scale(-1, 1);
  if (layer.flipV) ctx.scale(1, -1);

  // Apply filters
  let filterStr = "";
  if (layer.brightness !== 100) filterStr += `brightness(${layer.brightness}%) `;
  if (layer.contrast !== 100) filterStr += `contrast(${layer.contrast}%) `;
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
