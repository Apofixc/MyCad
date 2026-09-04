import React, { useState, useEffect, useCallback } from "react";
import { LayerImageItem } from "../../types/project";
import { CAD_PX_PER_MM } from "../../utils/alignmentMath";

export type TransformHandleType =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "rotate_top"
  | "rotate_nw"
  | "rotate_ne"
  | "rotate_se"
  | "rotate_sw"
  | "move"
  | "pivot";

interface ImageTransformBoxProps {
  image: LayerImageItem;
  zoom: number;
  pan: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  onUpdateImage: (updates: Partial<LayerImageItem>) => void;
}

export const ImageTransformBox: React.FC<ImageTransformBoxProps> = ({
  image,
  zoom,
  pan,
  containerRef,
  isActive,
  onUpdateImage,
}) => {
  // If tool is not active or image is not selected, completely isolate and render nothing
  if (!isActive) return null;

  const [activeDrag, setActiveDrag] = useState<{
    type: TransformHandleType;
    startX: number;
    startY: number;
    origImgX: number;
    origImgY: number;
    origScale: number;
    origRotation: number;
    centerScreenX: number;
    centerScreenY: number;
  } | null>(null);

  const [liveInfo, setLiveInfo] = useState<{
    widthMm: number;
    heightMm: number;
    scale: number;
    angle: number;
  } | null>(null);

  const w = image.width || 800;
  const h = image.height || 600;

  // Handle dimensions scaled for zoom
  const handleSize = Math.max(7 / zoom, 3);
  const strokeW = 1.5 / zoom;
  const rotationStemLen = 26 / zoom;

  // Local handles positions in image coordinate space (0..w, 0..h)
  const handles: { type: TransformHandleType; x: number; y: number; cursor: string }[] = [
    { type: "nw", x: 0, y: 0, cursor: "nwse-resize" },
    { type: "n", x: w / 2, y: 0, cursor: "ns-resize" },
    { type: "ne", x: w, y: 0, cursor: "nesw-resize" },
    { type: "e", x: w, y: h / 2, cursor: "ew-resize" },
    { type: "se", x: w, y: h, cursor: "nwse-resize" },
    { type: "s", x: w / 2, y: h, cursor: "ns-resize" },
    { type: "sw", x: 0, y: h, cursor: "nesw-resize" },
    { type: "w", x: 0, y: h / 2, cursor: "ew-resize" },
  ];

  // Mouse Down on a transform handle
  const handleStartDrag = (e: React.MouseEvent, type: TransformHandleType) => {
    e.stopPropagation();
    e.preventDefault();
    if (image.locked) return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // Compute center of image in screen coordinates for smooth rotation
    const rad = (image.rotation * Math.PI) / 180;
    const centerXLocal = (w * image.scale) / 2;
    const centerYLocal = (h * image.scale) / 2;
    const centerScreenX =
      rect.left + pan.x + (image.x + centerXLocal * Math.cos(rad) - centerYLocal * Math.sin(rad)) * zoom;
    const centerScreenY =
      rect.top + pan.y + (image.y + centerXLocal * Math.sin(rad) + centerYLocal * Math.cos(rad)) * zoom;

    setActiveDrag({
      type,
      startX: e.clientX,
      startY: e.clientY,
      origImgX: image.x,
      origImgY: image.y,
      origScale: image.scale,
      origRotation: image.rotation,
      centerScreenX,
      centerScreenY,
    });

    setLiveInfo({
      widthMm: (w * image.scale) / CAD_PX_PER_MM,
      heightMm: (h * image.scale) / CAD_PX_PER_MM,
      scale: image.scale,
      angle: image.rotation,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!activeDrag || image.locked) return;

      const deltaXScreen = e.clientX - activeDrag.startX;
      const deltaYScreen = e.clientY - activeDrag.startY;

      // 1. ROTATION HANDLE
      if (activeDrag.type.startsWith("rotate")) {
        const dx = e.clientX - activeDrag.centerScreenX;
        const dy = e.clientY - activeDrag.centerScreenY;
        let currentAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // stem is pointing up (90 deg offset)

        // Snap with Shift key (15-degree steps)
        if (e.shiftKey) {
          currentAngle = Math.round(currentAngle / 15) * 15;
        }

        while (currentAngle < 0) currentAngle += 360;
        currentAngle = Math.round((currentAngle % 360) * 10) / 10;

        onUpdateImage({ rotation: currentAngle });
        setLiveInfo({
          widthMm: (w * image.scale) / CAD_PX_PER_MM,
          heightMm: (h * image.scale) / CAD_PX_PER_MM,
          scale: image.scale,
          angle: currentAngle,
        });
        return;
      }

      // 2. RESIZE HANDLES
      // Project screen delta into rotated coordinate space of the image
      const rad = (-image.rotation * Math.PI) / 180;
      const localDx = (deltaXScreen * Math.cos(rad) - deltaYScreen * Math.sin(rad)) / zoom;
      const localDy = (deltaXScreen * Math.sin(rad) + deltaYScreen * Math.cos(rad)) / zoom;

      let scaleMultiplier = 1;
      if (activeDrag.type === "se") {
        scaleMultiplier = Math.max(0.05, 1 + localDx / (w * activeDrag.origScale));
      } else if (activeDrag.type === "nw") {
        scaleMultiplier = Math.max(0.05, 1 - localDx / (w * activeDrag.origScale));
      } else if (activeDrag.type === "ne") {
        scaleMultiplier = Math.max(0.05, 1 + localDx / (w * activeDrag.origScale));
      } else if (activeDrag.type === "sw") {
        scaleMultiplier = Math.max(0.05, 1 - localDx / (w * activeDrag.origScale));
      } else if (activeDrag.type === "e" || activeDrag.type === "w") {
        scaleMultiplier = Math.max(0.05, 1 + (activeDrag.type === "e" ? localDx : -localDx) / (w * activeDrag.origScale));
      } else if (activeDrag.type === "n" || activeDrag.type === "s") {
        scaleMultiplier = Math.max(0.05, 1 + (activeDrag.type === "s" ? localDy : -localDy) / (h * activeDrag.origScale));
      }

      const newScale = Math.round(activeDrag.origScale * scaleMultiplier * 1000) / 1000;

      onUpdateImage({ scale: newScale });
      setLiveInfo({
        widthMm: (w * newScale) / CAD_PX_PER_MM,
        heightMm: (h * newScale) / CAD_PX_PER_MM,
        scale: newScale,
        angle: image.rotation,
      });
    },
    [activeDrag, image, onUpdateImage, pan, w, h, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setActiveDrag(null);
    setLiveInfo(null);
  }, []);

  useEffect(() => {
    if (activeDrag) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [activeDrag, handleMouseMove, handleMouseUp]);

  return (
    <g
      className="cad-image-transform-gizmo"
      transform={`translate(${image.x}, ${image.y}) rotate(${image.rotation}) scale(${
        image.mirrored ? -image.scale : image.scale
      }, ${image.flipV ? -image.scale : image.scale}) translate(${image.mirrored ? -w : 0}, ${
        image.flipV ? -h : 0
      })`}
    >
      {/* 1. Main Bounding Outline */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={strokeW}
        strokeDasharray={`${5 / zoom}, ${4 / zoom}`}
        pointerEvents="none"
      />

      {/* 2. Top Rotation Lollipop Handle */}
      {!image.locked && (
        <g className="rotation-stem-group">
          <line
            x1={w / 2}
            y1={0}
            x2={w / 2}
            y2={-rotationStemLen}
            stroke="#38bdf8"
            strokeWidth={strokeW}
            strokeDasharray={`${3 / zoom}, ${2 / zoom}`}
          />
          <circle
            cx={w / 2}
            cy={-rotationStemLen}
            r={handleSize * 1.1}
            fill="#ffffff"
            stroke="#0284c7"
            strokeWidth={strokeW * 1.2}
            cursor="grab"
            onMouseDown={(e) => handleStartDrag(e, "rotate_top")}
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" }}
          >
            <title>Вращение изображения (Shift для шага 15°)</title>
          </circle>
        </g>
      )}

      {/* 3. Center Anchor (Pivot ⚓) */}
      <g className="anchor-pivot" transform={`translate(${w / 2}, ${h / 2})`}>
        <circle cx={0} cy={0} r={handleSize * 0.9} fill="none" stroke="#38bdf8" strokeWidth={strokeW} />
        <line x1={-handleSize * 1.3} y1={0} x2={handleSize * 1.3} y2={0} stroke="#38bdf8" strokeWidth={strokeW} />
        <line x1={0} y1={-handleSize * 1.3} x2={0} y2={handleSize * 1.3} stroke="#38bdf8" strokeWidth={strokeW} />
      </g>

      {/* 4. Eight Interactive Resize Handles */}
      {!image.locked &&
        handles.map((hnd) => (
          <rect
            key={hnd.type}
            x={hnd.x - handleSize / 2}
            y={hnd.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="#ffffff"
            stroke="#0284c7"
            strokeWidth={strokeW * 1.2}
            cursor={hnd.cursor}
            onMouseDown={(e) => handleStartDrag(e, hnd.type)}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}
          />
        ))}

      {/* 5. Live HUD Metric Badge during drag */}
      {liveInfo && (
        <g transform={`translate(${w / 2}, ${h + 24 / zoom})`} pointerEvents="none">
          <rect
            x={-90 / zoom}
            y={0}
            width={180 / zoom}
            height={26 / zoom}
            rx={4 / zoom}
            fill="rgba(15, 23, 42, 0.92)"
            stroke="#38bdf8"
            strokeWidth={1 / zoom}
          />
          <text
            x={0}
            y={17 / zoom}
            textAnchor="middle"
            fill="#f8fafc"
            fontSize={11 / zoom}
            fontFamily="monospace"
            fontWeight={600}
          >
            {liveInfo.widthMm.toFixed(1)}×{liveInfo.heightMm.toFixed(1)} мм | ∠{liveInfo.angle.toFixed(1)}°
          </text>
        </g>
      )}
    </g>
  );
};
