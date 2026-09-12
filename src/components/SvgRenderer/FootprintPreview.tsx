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

  // Вычисление охватывающей рамки (Bounding Box) в миллиметрах
  let minX = -packageDef.bodyWidth / 2;
  let maxX = packageDef.bodyWidth / 2;
  let minY = -packageDef.bodyHeight / 2;
  let maxY = packageDef.bodyHeight / 2;

  (packageDef.pads || []).forEach((p) => {
    const halfW = p.width / 2;
    const halfH = p.height / 2;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  });

  const padMargin = 2.0;
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
        const radius = Math.min(pad.width, pad.height) / 2;
        const dPath = getDShapePath(pad.x, pad.y, radius, "right", 0.6);
        return (
          <path
            d={dPath}
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

    switch (item.kind) {
      case "line":
        return (
          <line
            key={item.id}
            x1={item.x1}
            y1={item.y1}
            x2={item.x2}
            y2={item.y2}
            stroke={stroke}
            strokeWidth={item.strokeWidth}
            strokeLinecap="round"
          />
        );
      case "arc": {
        const r = item.radius;
        const startRad = (item.startAngle * Math.PI) / 180;
        const endRad = (item.endAngle * Math.PI) / 180;
        const x1 = item.cx + r * Math.cos(startRad);
        const y1 = item.cy + r * Math.sin(startRad);
        const x2 = item.cx + r * Math.cos(endRad);
        const y2 = item.cy + r * Math.sin(endRad);
        const largeArc = Math.abs(item.endAngle - item.startAngle) > 180 ? 1 : 0;
        const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
        return (
          <path
            key={item.id}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={item.strokeWidth}
            strokeLinecap="round"
          />
        );
      }
      case "d_shape":
        return (
          <path
            key={item.id}
            d={getDShapePath(item.cx, item.cy, item.diameter / 2, item.cutOrientation as any, 0.58)}
            fill="none"
            stroke={stroke}
            strokeWidth={item.strokeWidth}
          />
        );
      case "capsule":
        return (
          <path
            key={item.id}
            d={getCapsulePath(item.cx, item.cy, item.width, item.height)}
            fill="none"
            stroke={stroke}
            strokeWidth={item.strokeWidth}
          />
        );
      case "rect":
        return (
          <rect
            key={item.id}
            x={item.x - item.width / 2}
            y={item.y - item.height / 2}
            width={item.width}
            height={item.height}
            rx={item.roundRadius}
            fill={item.filled ? stroke : "none"}
            stroke={stroke}
            strokeWidth={item.strokeWidth}
          />
        );
      case "circle":
        return (
          <circle
            key={item.id}
            cx={item.cx}
            cy={item.cy}
            r={item.radius}
            fill={item.filled ? stroke : "none"}
            stroke={stroke}
            strokeWidth={item.strokeWidth}
          />
        );
      case "polygon":
        return (
          <polygon
            key={item.id}
            points={item.points.map(([px, py]) => `${px},${py}`).join(" ")}
            fill={item.filled ? stroke : "none"}
            stroke={stroke}
            strokeWidth={item.strokeWidth}
          />
        );
      case "text":
        return (
          <text
            key={item.id}
            x={item.x}
            y={item.y}
            fontSize={item.fontSize}
            fill={stroke}
            textAnchor={item.align === "left" ? "start" : item.align === "right" ? "end" : "middle"}
            dominantBaseline="central"
          >
            {item.text}
          </text>
        );
      default:
        return null;
    }
  };

  // Все графические элементы: базовые + вариантные
  const allGraphics: GraphicItem[] = [
    ...(packageDef.graphics || []),
    ...(activeVariant.graphics || []),
  ];

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
      }}
    >
      <svg
        viewBox={viewBox}
        style={{ width: "100%", height: "100%", cursor: interactive ? "crosshair" : "default" }}
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
                <circle
                  cx={pad.x}
                  cy={pad.y}
                  r={pad.drillDiameter / 2}
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
