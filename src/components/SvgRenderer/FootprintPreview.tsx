// src/components/SvgRenderer/FootprintPreview.tsx
// Интерактивный рендерер посадочного места в формате SVG с поддержкой всех форм площадок (SMD/THT/D-Shape/полигоны), векторной графики и вариантов исполнения

import React, { useState } from "react";
import {
  PackageDefinition,
  PackageVariant,
  PackagePad,
  GraphicItem,
  PadShape,
} from "../../types/componentLibrary";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { getDShapePath, getCapsulePath } from "../../utils/footprintGenerator";
import { getGraphicPath, graphicRotation, getPadPath, getFootprintBounds } from "../../utils/footprintGeometry";

interface FootprintPreviewProps {
  packageDef: PackageDefinition;
  variant?: PackageVariant;
  width?: number | string;
  height?: number | string;
  showDimensions?: boolean;
  showCourtyard?: boolean;
  showGrid?: boolean;
  interactive?: boolean;
  selectedPadNum?: string | null;
  onSelectPad?: (padNum: string) => void;
  padLabels?: Record<string, string>;
  padColors?: Record<string, string>;
  unassignedPadNums?: Set<string>;
}

export const FootprintPreview: React.FC<FootprintPreviewProps> = ({
  packageDef,
  variant,
  width = "100%",
  height = 280,
  showDimensions = true,
  showCourtyard = true,
  showGrid = true,
  interactive = true,
  selectedPadNum,
  onSelectPad,
  padLabels,
  padColors,
  unassignedPadNums,
}) => {
  const [hoveredPadNum, setHoveredPadNum] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const safeVariants = packageDef?.variants || [];
  const activeVariant: PackageVariant =
    variant ||
    safeVariants.find((v) => v.id === packageDef?.defaultVariantId) ||
    safeVariants[0] || {
      id: "default",
      name: "Стандартный",
      bodyColor: "#1e293b",
      bodyBorderColor: "#475569",
      keyType: "none",
      graphics: [],
    };

  // Все графические элементы: базовые + вариантные
  const allGraphics: GraphicItem[] = [
    ...(packageDef.graphics || []),
    ...(activeVariant.graphics || []),
  ];

  // Вычисление охватывающей рамки (Bounding Box) в миллиметрах
  const bounds = getFootprintBounds(packageDef.pads || [], allGraphics);
  let minX = Math.min(-packageDef.bodyWidth / 2, bounds.minX);
  let maxX = Math.max(packageDef.bodyWidth / 2, bounds.maxX);
  let minY = Math.min(-packageDef.bodyHeight / 2, bounds.minY);
  let maxY = Math.max(packageDef.bodyHeight / 2, bounds.maxY);

  (packageDef.pads || []).forEach((p) => {
    const halfW = p.width / 2;
    const halfH = p.height / 2;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  });

  // Учитываем все графические элементы шелкографии, контуров и сборки
  allGraphics.forEach((g) => {
    switch (g.kind) {
      case "line":
        minX = Math.min(minX, g.x1, g.x2);
        maxX = Math.max(maxX, g.x1, g.x2);
        minY = Math.min(minY, g.y1, g.y2);
        maxY = Math.max(maxY, g.y1, g.y2);
        break;
      case "rect": {
        const halfW = g.width / 2;
        const halfH = g.height / 2;
        minX = Math.min(minX, g.x - halfW);
        maxX = Math.max(maxX, g.x + halfW);
        minY = Math.min(minY, g.y - halfH);
        maxY = Math.max(maxY, g.y + halfH);
        break;
      }
      case "circle":
        minX = Math.min(minX, g.cx - g.radius);
        maxX = Math.max(maxX, g.cx + g.radius);
        minY = Math.min(minY, g.cy - g.radius);
        maxY = Math.max(maxY, g.cy + g.radius);
        break;
      case "arc":
        minX = Math.min(minX, g.cx - g.radius);
        maxX = Math.max(maxX, g.cx + g.radius);
        minY = Math.min(minY, g.cy - g.radius);
        maxY = Math.max(maxY, g.cy + g.radius);
        break;
      case "polygon":
        if (g.points) {
          g.points.forEach(([px, py]) => {
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
          });
        }
        break;
      default:
        break;
    }
  });

  // Учитываем зону отчуждения (Courtyard)
  if (showCourtyard && packageDef.constraints?.courtyardWidth && packageDef.constraints?.courtyardHeight) {
    const halfCw = packageDef.constraints.courtyardWidth / 2;
    const halfCh = packageDef.constraints.courtyardHeight / 2;
    minX = Math.min(minX, -halfCw);
    maxX = Math.max(maxX, halfCw);
    minY = Math.min(minY, -halfCh);
    maxY = Math.max(maxY, halfCh);
  }

  const padMargin = 2.5;
  const viewW = Math.max(8.0, (maxX - minX + padMargin * 2) / zoomScale);
  const viewH = Math.max(8.0, (maxY - minY + padMargin * 2) / zoomScale);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const viewBox = `${cx - viewW / 2} ${cy - viewH / 2} ${viewW} ${viewH}`;

  const renderPadShape = (
    pad: PackagePad,
    isSelected: boolean,
    isHovered: boolean,
    signalColor?: string,
    isUnassigned?: boolean
  ) => {
    const copperColor = pad.drillDiameter ? "#d97706" : "#f59e0b"; // THT янтарный, SMD медный
    const strokeColor = isSelected
      ? "#38bdf8"
      : isHovered
      ? "#60a5fa"
      : signalColor
      ? signalColor
      : isUnassigned
      ? "rgba(245, 158, 11, 0.7)"
      : "#b45309";
    const strokeWidth = isSelected ? 0.25 : isHovered ? 0.18 : signalColor ? 0.14 : isUnassigned ? 0.1 : 0.08;

    const transform = pad.rotation ? `rotate(${pad.rotation}, ${pad.x}, ${pad.y})` : undefined;

    switch (pad.shape) {
      case "circle":
        return (
          <circle
            cx={pad.x}
            cy={pad.y}
            r={pad.width / 2}
            fill={copperColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );

      case "rounded_rect":
        return (
          <rect
            x={pad.x - pad.width / 2}
            y={pad.y - pad.height / 2}
            width={pad.width}
            height={pad.height}
            rx={pad.roundRadius ?? Math.min(pad.width, pad.height) * 0.25}
            fill={copperColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );

      case "oval":
        return (
          <rect
            x={pad.x - pad.width / 2}
            y={pad.y - pad.height / 2}
            width={pad.width}
            height={pad.height}
            rx={Math.min(pad.width, pad.height) / 2}
            fill={copperColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );

      case "d_shape": {
        return (
          <path
            d={getPadPath(pad)}
            fill={copperColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
      }

      case "custom_polygon":
        if (pad.polygonPoints && pad.polygonPoints.length > 2) {
          const pointsStr = pad.polygonPoints
            .map(([px, py]) => `${pad.x + px},${pad.y + py}`)
            .join(" ");
          return (
            <polygon
              points={pointsStr}
              fill={copperColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              transform={transform}
            />
          );
        }
        // Fallback to rect
        return (
          <rect
            x={pad.x - pad.width / 2}
            y={pad.y - pad.height / 2}
            width={pad.width}
            height={pad.height}
            fill={copperColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );

      case "chamfered_rect":
        return <path d={getPadPath(pad)} fill={copperColor} stroke={strokeColor}
          strokeWidth={strokeWidth} transform={transform} />;
      case "rect":
      default:
        return (
          <rect
            x={pad.x - pad.width / 2}
            y={pad.y - pad.height / 2}
            width={pad.width}
            height={pad.height}
            fill={copperColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
          />
        );
    }
  };

  const renderGraphicItem = (item: GraphicItem) => {
    const stroke = item.layer.includes("silk")
      ? activeVariant.silkscreenColor || "#f8fafc"
      : item.layer.includes("courtyard")
      ? "#a855f7"
      : "#94a3b8";

    const [angle, cx, cy] = graphicRotation(item);
    const transform = `rotate(${angle} ${cx} ${cy})`;
    return item.kind === "text"
      ? <text key={item.id} x={item.x} y={item.y} fontSize={item.fontSize} fill={stroke}
          transform={transform} textAnchor={item.align === "left" ? "start" : item.align === "right" ? "end" : "middle"}
          dominantBaseline="central">{item.text}</text>
      : <path key={item.id} d={getGraphicPath(item)} transform={transform} stroke={stroke}
          strokeWidth={item.strokeWidth} fill={"filled" in item && item.filled ? stroke : "none"} />;
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        backgroundColor: "#090d16",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #1e293b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        minHeight: 0,
      }}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", cursor: interactive ? "crosshair" : "default" }}
      >
        <defs>
          {/* Сетка */}
          <pattern id="cadGrid" width="1" height="1" patternUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="0.04" fill="#334155" />
          </pattern>
        </defs>

        {/* Фоновая координатная сетка */}
        {showGrid && (
          <rect
            x={cx - viewW}
            y={cy - viewH}
            width={viewW * 2}
            height={viewH * 2}
            fill="url(#cadGrid)"
          />
        )}

        {/* Оси координат X и Y */}
        <line x1={-viewW} y1={0} x2={viewW} y2={0} stroke="#334155" strokeWidth="0.04" />
        <line x1={0} y1={-viewH} x2={0} y2={viewH} stroke="#334155" strokeWidth="0.04" />
        {/* Начало координат (0,0) */}
        <circle cx={0} cy={0} r={0.15} fill="none" stroke="#ef4444" strokeWidth="0.05" />
        <line x1={-0.3} y1={0} x2={0.3} y2={0} stroke="#ef4444" strokeWidth="0.04" />
        <line x1={0} y1={-0.3} x2={0} y2={0.3} stroke="#ef4444" strokeWidth="0.04" />

        {/* Тело корпуса (Body / Fabrication) */}
        {packageDef.bodyShape === "circle" ? (
          <circle
            cx={0}
            cy={0}
            r={packageDef.bodyWidth / 2}
            fill={activeVariant.bodyColor}
            stroke={activeVariant.bodyBorderColor || "#475569"}
            strokeWidth="0.1"
          />
        ) : packageDef.bodyShape === "d_shape" ? (
          <path
            d={getDShapePath(0, 0, packageDef.bodyWidth / 2, (packageDef.dShapeCut as any) || "right", 0.58)}
            fill={activeVariant.bodyColor}
            stroke={activeVariant.bodyBorderColor || "#475569"}
            strokeWidth="0.1"
          />
        ) : packageDef.bodyShape === "capsule" ? (
          <path
            d={getCapsulePath(0, 0, packageDef.bodyWidth, packageDef.bodyHeight)}
            fill={activeVariant.bodyColor}
            stroke={activeVariant.bodyBorderColor || "#475569"}
            strokeWidth="0.1"
          />
        ) : (
          <rect
            x={-packageDef.bodyWidth / 2}
            y={-packageDef.bodyHeight / 2}
            width={packageDef.bodyWidth}
            height={packageDef.bodyHeight}
            rx={0.2}
            fill={activeVariant.bodyColor}
            stroke={activeVariant.bodyBorderColor || "#475569"}
            strokeWidth="0.1"
          />
        )}

        {/* Ключ первого вывода (Notch, Dot, Chamfer) */}
        {activeVariant.keyType === "notch" && (
          <path
            d={`M -0.8 ${-packageDef.bodyHeight / 2} A 0.8 0.8 0 0 0 0.8 ${-packageDef.bodyHeight / 2}`}
            fill="none"
            stroke={activeVariant.bodyBorderColor || "#94a3b8"}
            strokeWidth="0.12"
          />
        )}
        {activeVariant.keyType === "dot" && (
          <circle
            cx={-packageDef.bodyWidth / 2 + 0.6}
            cy={-packageDef.bodyHeight / 2 + 0.6}
            r={0.35}
            fill="#f8fafc"
          />
        )}

        {/* Векторная графика (линии шелкографии, дуги, надписи) */}
        {allGraphics.map(renderGraphicItem)}

        {/* Контактные площадки (Pads) */}
        {(packageDef.pads || []).map((pad) => {
          const isSelected = selectedPadNum === pad.padNum;
          const isHovered = hoveredPadNum === pad.padNum;
          const assignedLabel = padLabels?.[pad.padNum];
          const padColor = padColors?.[pad.padNum];
          const isUnassigned = unassignedPadNums?.has(pad.padNum);

          return (
            <g
              key={pad.padNum}
              style={{ cursor: interactive ? "pointer" : "default" }}
              onMouseEnter={() => interactive && setHoveredPadNum(pad.padNum)}
              onMouseLeave={() => interactive && setHoveredPadNum(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (interactive && onSelectPad) onSelectPad(pad.padNum);
              }}
            >
              {/* Медная контактная площадка */}
              {renderPadShape(pad, isSelected, isHovered, padColor, isUnassigned)}

              {/* Сверловка THT (Drill Hole) */}
              {pad.drillDiameter && pad.drillDiameter > 0 && (
                <path
                  d={getCapsulePath(pad.x, pad.y,
                    pad.drillShape === "slot" ? Math.max(pad.drillDiameter, pad.slotLength ?? 0) : pad.drillDiameter,
                    pad.drillDiameter)}
                  transform={`rotate(${pad.rotation} ${pad.x} ${pad.y})`}
                  fill="#0f172a"
                  stroke="#475569"
                  strokeWidth="0.04"
                />
              )}

              {/* Номер / Название вывода и привязанный схемный сигнал */}
              {assignedLabel ? (
                <g style={{ pointerEvents: "none", userSelect: "none" }}>
                  {/* Номер площадки корпуса */}
                  <text
                    x={pad.x}
                    y={pad.y - Math.min(pad.width, pad.height) * 0.16}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255, 255, 255, 0.75)"
                    fontSize={Math.min(pad.width, pad.height) * 0.26}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    #{pad.padNum}
                  </text>
                  {/* Имя схемного вывода (VCC, GND, TX, etc.) */}
                  <text
                    x={pad.x}
                    y={pad.y + Math.min(pad.width, pad.height) * 0.22}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={padColor || "#38bdf8"}
                    fontSize={Math.min(pad.width, pad.height) * 0.32}
                    fontWeight="900"
                    fontFamily="sans-serif"
                  >
                    {assignedLabel}
                  </text>
                </g>
              ) : (
                <text
                  x={pad.x}
                  y={pad.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isUnassigned ? "#fde68a" : "#ffffff"}
                  fontSize={Math.min(pad.width, pad.height) * 0.42}
                  fontWeight="bold"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {pad.name || pad.padNum}
                </text>
              )}
            </g>
          );
        })}

        {/* Зона отчуждения (Courtyard) */}
        {showCourtyard && packageDef.constraints?.courtyardWidth > 0 && (
          <rect
            x={-packageDef.constraints.courtyardWidth / 2}
            y={-packageDef.constraints.courtyardHeight / 2}
            width={packageDef.constraints.courtyardWidth}
            height={packageDef.constraints.courtyardHeight}
            fill="none"
            stroke="#c084fc"
            strokeWidth="0.05"
            strokeDasharray="0.3 0.2"
          />
        )}
      </svg>

      {/* Панель управления зумом */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 4,
          background: "rgba(15, 23, 42, 0.8)",
          padding: "3px 6px",
          borderRadius: 6,
          border: "1px solid #334155",
        }}
      >
        <button
          onClick={() => setZoomScale((z) => Math.min(4.0, z * 1.25))}
          title="Приблизить"
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoomScale((z) => Math.max(0.25, z / 1.25))}
          title="Отдалить"
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={() => setZoomScale(1.0)}
          title="Сбросить масштаб (100%)"
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};
