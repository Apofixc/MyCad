import React, { useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { ToolBar } from "./ToolBar";
import { CurtainSlider } from "./CurtainSlider";
import { MagnifierLoupe } from "./MagnifierLoupe";
import { engineClient, resolveImageUrl } from "../../api/engineClient";

export const BoardCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    board,
    selectedImageId,
    selectedImageIds,
    selectImage,
    toggleSelectImage,
    clearSelectedImages,
    updateImageLayers,
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
    activeWorkLayer,
    setPendingPreprocess,
    setPendingBatchImport,
  } = useUiStore();

  // Dragging / Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Image dragging ref for 60 FPS buttery smooth real-time dragging
  const dragRef = useRef<{
    isDragging: boolean;
    hasMoved: boolean;
    startMouseMm: { x: number; y: number };
    startScreen: { x: number; y: number };
    targetLayers: any[];
    initialPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  const dragOffsetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Drag & drop file state
  const [isDragOver, setIsDragOver] = useState(false);

  // Target underlay side strictly follows active working layer from Project Tree
  const targetUnderlaySide: "top" | "bottom" =
    activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top";

  // Custom Event for preprocessing existing image
  useEffect(() => {
    const handleCustomPreprocess = (e: Event) => {
      const ce = e as CustomEvent<{ layerId: string; side: "top" | "bottom" }>;
      if (!ce.detail || !board) return;
      const { layerId, side } = ce.detail;
      const images = side === "top" ? board.data?.bgTop?.images : board.data?.bgBottom?.images;
      const target = images?.find((img) => img.id === layerId);
      if (target) {
        setPendingPreprocess({
          filePath: target.cachedUrl,
          name: target.name,
          side,
          replaceLayerId: target.id,
        });
      }
    };

    window.addEventListener("mycad-preprocess-image", handleCustomPreprocess);
    return () => window.removeEventListener("mycad-preprocess-image", handleCustomPreprocess);
  }, [board, setPendingPreprocess]);

  // Paste from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            setPendingPreprocess({
              file,
              name: `clipboard_${Date.now()}.png`,
              side: targetUnderlaySide,
            });
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [setPendingPreprocess, targetUnderlaySide]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(png|jpe?g|webp|bmp|tif|tiff)$/i.test(f.name)
    );
    if (files.length === 0) return;

    if (files.length === 1) {
      const filePath = (files[0] as any).path || (files[0] as any).filePath;
      setPendingPreprocess({
        file: files[0],
        filePath,
        name: files[0].name,
        side: targetUnderlaySide,
      });
    } else {
      setPendingBatchImport({
        files,
        side: targetUnderlaySide,
      });
    }
  };


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

  // Track whether canvas is dirty and needs redraw (demand-driven rendering)
  const dirtyRef = useRef(true);
  const cursorRafRef = useRef<number | null>(null);

  // Main Render Loop
  useEffect(() => {
    dirtyRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const isActivelyMoving = Boolean(dragRef.current?.isDragging || isPanning);
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
            if (layer.visible) {
              drawImageLayer(
                ctx,
                layer,
                dragOffsetsRef.current.get(layer.id),
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
            if (layer.visible) {
              drawImageLayer(
                ctx,
                layer,
                dragOffsetsRef.current.get(layer.id),
                boardMmToScreen,
                MM_TO_PX,
                zoomFactor,
                loadedImagesRef.current
              );
            }
          });
          ctx.restore();
        }

        // Draw Selection Bounding Boxes & Handles for all selected images
        const allBoardImages = [...board.data.bgBottom.images, ...board.data.bgTop.images];
        allBoardImages.forEach((layer) => {
          const isSelected = selectedImageIds.includes(layer.id) || selectedImageId === layer.id;
          if (layer.visible && isSelected) {
            drawSelectionBox(
              ctx,
              layer,
              dragOffsetsRef.current.get(layer.id),
              boardMmToScreen,
              MM_TO_PX,
              zoomFactor,
              loadedImagesRef.current
            );
          }
        });
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
    selectedImageId,
    selectedImageIds,
  ]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseMm = screenToBoardMm(mouseX, mouseY);

    // Tool: Measure, Calibrate, Level, Register
    if (activeTool === "measure" || activeTool === "calibrate" || activeTool === "level" || activeTool === "register") {
      const next = [...measurePts, [mouseMm.x, mouseMm.y] as [number, number]];
      if (next.length > 2) {
        setMeasurePts([[mouseMm.x, mouseMm.y]]);
      } else {
        setMeasurePts(next);
      }
      return;
    }

    // Middle click (wheel) or Alt + Left click: Always Pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewportPan.x, y: e.clientY - viewportPan.y });
      return;
    }

    // Left click: Image Selection & Moving
    if (e.button === 0) {
      const activeSide = activeWorkLayer.type === "underlay" ? activeWorkLayer.side : "top";
      const topImages = (showTopLayer ? board?.data?.bgTop?.images || [] : []).filter((l) => l.visible);
      const botImages = (showBottomLayer ? board?.data?.bgBottom?.images || [] : []).filter((l) => l.visible);

      // Prioritize active layer side first, top-to-bottom in render order
      const orderedImages =
        activeSide === "bottom"
          ? [...botImages.slice().reverse(), ...topImages.slice().reverse()]
          : [...topImages.slice().reverse(), ...botImages.slice().reverse()];

      let hitLayer: any = null;
      for (const layer of orderedImages) {
        if (isPointInImage(mouseMm, layer, loadedImagesRef.current.get(layer.id))) {
          hitLayer = layer;
          break;
        }
      }

      if (hitLayer) {
        if (hitLayer.locked) {
          selectImage(hitLayer.id, e.shiftKey);
          return;
        }

        const isAlreadySelected = selectedImageIds.includes(hitLayer.id) || selectedImageId === hitLayer.id;
        if (!isAlreadySelected) {
          if (e.shiftKey) {
            toggleSelectImage(hitLayer.id);
          } else {
            selectImage(hitLayer.id);
          }
        }

        const allImages = [...topImages, ...botImages];
        const currentSelectedIds = isAlreadySelected
          ? selectedImageIds.length > 0
            ? selectedImageIds
            : [hitLayer.id]
          : e.shiftKey
            ? [...selectedImageIds, hitLayer.id]
            : [hitLayer.id];

        const layersToMove = allImages.filter(
          (img) => currentSelectedIds.includes(img.id) && !img.locked
        );

        const initialPositions = new Map<string, { x: number; y: number }>();
        layersToMove.forEach((l) => {
          initialPositions.set(l.id, { x: l.offsetX || 0, y: l.offsetY || 0 });
        });

        dragRef.current = {
          isDragging: true,
          hasMoved: false,
          startMouseMm: mouseMm,
          startScreen: { x: e.clientX, y: e.clientY },
          targetLayers: layersToMove.length > 0 ? layersToMove : [hitLayer],
          initialPositions,
        };
        dragOffsetsRef.current.clear();
        return;
      }

      // Clicked on empty canvas: Clear selection and start pan
      if (!e.shiftKey) {
        clearSelectedImages();
      }
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

    // 1. Dragging selected image(s)
    if (dragRef.current?.isDragging) {
      const dist = Math.hypot(
        e.clientX - dragRef.current.startScreen.x,
        e.clientY - dragRef.current.startScreen.y
      );
      if (dist > 3) dragRef.current.hasMoved = true;

      const dxMm = mouseMm.x - dragRef.current.startMouseMm.x;
      const dyMm = mouseMm.y - dragRef.current.startMouseMm.y;

      dragRef.current.targetLayers.forEach((layer) => {
        dragOffsetsRef.current.set(layer.id, { x: dxMm, y: dyMm });
      });
      dirtyRef.current = true;
      if (canvasRef.current && canvasRef.current.style.cursor !== "move") {
        canvasRef.current.style.cursor = "move";
      }
      return;
    }

    // 2. Panning canvas
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

    // 3. Hovering over images
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
    if (dragRef.current?.isDragging) {
      if (dragRef.current.hasMoved) {
        const mouseMm = screenToBoardMm(
          e.clientX - (canvasRef.current?.getBoundingClientRect().left || 0),
          e.clientY - (canvasRef.current?.getBoundingClientRect().top || 0)
        );
        const dxMm = mouseMm.x - dragRef.current.startMouseMm.x;
        const dyMm = mouseMm.y - dragRef.current.startMouseMm.y;

        const updated = dragRef.current.targetLayers.map((layer) => {
          const orig = dragRef.current!.initialPositions.get(layer.id) || { x: 0, y: 0 };
          return {
            ...layer,
            offsetX: Math.round((orig.x + dxMm) * 100) / 100,
            offsetY: Math.round((orig.y + dyMm) * 100) / 100,
          };
        });
        updateImageLayers(updated);
      }
      dragRef.current = null;
      dragOffsetsRef.current.clear();
    }

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
    <div
      className="cad-viewport"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        className="cad-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(12, 14, 18, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "24px 44px",
              background: targetUnderlaySide === "top" ? "rgba(245, 158, 11, 0.16)" : "rgba(6, 182, 212, 0.16)",
              border: `2px dashed ${targetUnderlaySide === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)"}`,
              borderRadius: "12px",
              textAlign: "center",
              width: "380px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ fontWeight: 600, color: targetUnderlaySide === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)", fontSize: "16px", marginBottom: "4px" }}>
              Добавить в слой {targetUnderlaySide === "top" ? "Top (Лицевой)" : "Bottom (Оборотный)"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--cad-text-muted)" }}>
              Файлы будут привязаны к активному слою подложки
            </div>
          </div>
        </div>
      )}

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

function drawSelectionBox(
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

  // Draw selection bounding box with neon glow
  ctx.shadowColor = "rgba(56, 189, 248, 0.75)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(-2, -2, wPx + 4, hPx + 4);

  // 8 handles (4 corners + 4 sides)
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0284c7";
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

  // Name tag badge above top-left
  const sideLabel = layer.side === "top" ? "TOP" : "BOT";
  const badgeText = `${layer.name || "Скан"} (${sideLabel})`;
  ctx.font = "bold 11px JetBrains Mono, monospace";
  const textW = ctx.measureText(badgeText).width;
  const badgeW = textW + 16;
  const badgeH = 20;

  ctx.fillStyle = "rgba(8, 12, 20, 0.9)";
  ctx.fillRect(-2, -badgeH - 6, badgeW, badgeH);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1;
  ctx.strokeRect(-2, -badgeH - 6, badgeW, badgeH);

  ctx.fillStyle = layer.side === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, 6, -badgeH / 2 - 6);

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
