// src/components/SvgRenderer/FootprintPreview.tsx
// Интерактивный векторный предпросмотр посадочного места и вариантов исполнения корпуса

import React, { useState } from "react";
import {
  PackageDefinition,
  PackageVariant,
  PackagePad,
  DeviceDefinition,
} from "../../types/componentLibrary";

interface FootprintPreviewProps {
  packageDef: PackageDefinition;
  variant?: PackageVariant;
  deviceDef?: DeviceDefinition;
  width?: number;
  height?: number;
  showDimensions?: boolean;
  showCourtyard?: boolean;
  interactive?: boolean;
  onSelectPad?: (padNum: number) => void;
}

export const FootprintPreview: React.FC<FootprintPreviewProps> = ({
  packageDef,
  variant,
  deviceDef,
  width = 360,
  height = 280,
  showDimensions = true,
  showCourtyard = true,
  interactive = true,
  onSelectPad,
}) => {
  const [hoveredPadNum, setHoveredPadNum] = useState<number | null>(null);

  // Выбираем активный вариант
  const activeVariant: PackageVariant =
    variant ||
    packageDef.variants.find((v) => v.id === packageDef.defaultVariantId) ||
    packageDef.variants[0] || {
      id: "default",
      name: "Стандартный",
      bodyColor: "#1e293b",
      bodyBorderColor: "#475569",
      keyType: "none",
    };

  // Маппинг логических имен: padNum -> logicalPin.name
  const padLabels: Record<number, string> = {};
  if (deviceDef) {
    const mapping = deviceDef.supportedPackages.find((m) => m.packageId === packageDef.id);
    if (mapping) {
      for (const [logPinId, padNum] of Object.entries(mapping.pinMap)) {
        const logPin = deviceDef.logicalPins.find((p) => p.id === logPinId);
        if (logPin) {
          padLabels[padNum] = logPin.name;
        }
      }
    }
  }

  // Расчет границ (bounding box) для центрирования и масштабирования
  const { bodyWidth, bodyHeight, pads, constraints } = packageDef;
  const courtW = Math.max(bodyWidth + 2, constraints?.courtyardWidth || bodyWidth + 2);
  const courtH = Math.max(bodyHeight + 2, constraints?.courtyardHeight || bodyHeight + 2);

  // Вычисляем охватывающий прямоугольник с учетом всех площадок
  let minX = -courtW / 2;
  let maxX = courtW / 2;
  let minY = -courtH / 2;
  let maxY = courtH / 2;

  pads.forEach((p) => {
    minX = Math.min(minX, p.x - p.width / 2 - 1);
    maxX = Math.max(maxX, p.x + p.width / 2 + 1);
    minY = Math.min(minY, p.y - p.height / 2 - 1);
    maxY = Math.max(maxY, p.y + p.height / 2 + 1);
  });

  // Добавляем отступ для размерных линий
  const padMargin = showDimensions ? 2.5 : 1.5;
  const viewWidth = Math.max(12, (maxX - minX) + padMargin * 2);
  const viewHeight = Math.max(12, (maxY - minY) + padMargin * 2);

  const viewBox = `${-(viewWidth / 2)} ${-(viewHeight / 2)} ${viewWidth} ${viewHeight}`;

  const renderPadShape = (pad: PackagePad, isHovered: boolean) => {
    const isSelected = hoveredPadNum === pad.padNum;
    const fillColor = isSelected ? "#38bdf8" : isHovered ? "#67e8f9" : "#d97706";
    const strokeColor = isSelected ? "#0284c7" : "#b45309";
    const strokeWidth = 0.08;

    const x = pad.x - pad.width / 2;
    const y = pad.y - pad.height / 2;

    switch (pad.shape) {
      case "circle":
        return (
          <g key={pad.padNum}>
            <circle
              cx={pad.x}
              cy={pad.y}
              r={pad.width / 2}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {pad.drillDiameter && (
              <circle cx={pad.x} cy={pad.y} r={pad.drillDiameter / 2} fill="#0f172a" />
            )}
          </g>
        );
      case "rounded_rect":
        return (
          <g key={pad.padNum}>
            <rect
              x={x}
              y={y}
              width={pad.width}
              height={pad.height}
              rx={pad.roundRadius || 0.2}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {pad.drillDiameter && (
              <circle cx={pad.x} cy={pad.y} r={pad.drillDiameter / 2} fill="#0f172a" />
            )}
          </g>
        );
      case "oval":
        return (
          <g key={pad.padNum}>
            <rect
              x={x}
              y={y}
              width={pad.width}
              height={pad.height}
              rx={Math.min(pad.width, pad.height) / 2}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {pad.drillDiameter && (
              <circle cx={pad.x} cy={pad.y} r={pad.drillDiameter / 2} fill="#0f172a" />
            )}
          </g>
        );
      case "rect":
      default:
        return (
          <g key={pad.padNum}>
            <rect
              x={x}
              y={y}
              width={pad.width}
              height={pad.height}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {pad.drillDiameter && (
              <circle cx={pad.x} cy={pad.y} r={pad.drillDiameter / 2} fill="#0f172a" />
            )}
          </g>
        );
    }
  };

  const renderKeyFeature = () => {
    const halfW = bodyWidth / 2;
    const halfH = bodyHeight / 2;

    switch (activeVariant.keyType) {
      case "notch": {
        // Полувырез сверху
        const r = Math.min(1.2, bodyWidth * 0.2);
        return (
          <path
            d={`M ${-r} ${-halfH} A ${r} ${r} 0 0 0 ${r} ${-halfH}`}
            fill="none"
            stroke={activeVariant.keyColor || "#64748b"}
            strokeWidth="0.15"
          />
        );
      }
      case "dot": {
        // Точка у вывода 1
        const dotR = 0.35;
        return (
          <circle
            cx={-halfW + 0.8}
            cy={-halfH + 0.8}
            r={dotR}
            fill={activeVariant.keyColor || "#ef4444"}
          />
        );
      }
      case "chamfer": {
        // Скошенный угол
        const ch = 0.8;
        return (
          <line
            x1={-halfW}
            y1={-halfH + ch}
            x2={-halfW + ch}
            y2={-halfH}
            stroke={activeVariant.keyColor || "#38bdf8"}
            strokeWidth="0.2"
          />
        );
      }
      case "stripe": {
        // Полоса полярности (например, катод диода или минус электролита)
        return (
          <rect
            x={-halfW}
            y={-halfH}
            width={bodyWidth}
            height={0.6}
            fill={activeVariant.polarityColor || "#ffffff"}
            opacity={0.8}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="footprint-preview-container" style={{ width, height, position: "relative" }}>
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        style={{
          backgroundColor: "#0b0f19",
          borderRadius: "8px",
          border: "1px solid #1e293b",
          display: "block",
        }}
      >
        <defs>
          {/* Сетка */}
          <pattern id="grid_dots" width="1" height="1" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.04" fill="#334155" opacity="0.6" />
          </pattern>
          {/* Осевые линии */}
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 2 L 10 5 L 0 8 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Фоновая миллиметровая сетка */}
        <rect
          x={-(viewWidth / 2)}
          y={-(viewHeight / 2)}
          width={viewWidth}
          height={viewHeight}
          fill="url(#grid_dots)"
        />

        {/* Оси X и Y */}
        <line x1={-viewWidth / 2} y1="0" x2={viewWidth / 2} y2="0" stroke="#1e293b" strokeWidth="0.05" />
        <line x1="0" y1={-viewHeight / 2} x2="0" y2={viewHeight / 2} stroke="#1e293b" strokeWidth="0.05" />

        {/* Courtyard (зона запрета пересечений) */}
        {showCourtyard && (
          <rect
            x={-courtW / 2}
            y={-courtH / 2}
            width={courtW}
            height={courtH}
            fill="none"
            stroke="#eab308"
            strokeWidth="0.06"
            strokeDasharray="0.3 0.2"
            opacity="0.7"
          />
        )}

        {/* Тело компонента (Body) с цветом варианта */}
        <g id="body_geometry">
          <rect
            x={-bodyWidth / 2}
            y={-bodyHeight / 2}
            width={bodyWidth}
            height={bodyHeight}
            fill={activeVariant.bodyColor || "#1e293b"}
            stroke={activeVariant.bodyBorderColor || "#475569"}
            strokeWidth="0.12"
            rx={packageDef.family === "dip" || packageDef.family === "soic" ? 0.3 : 0.15}
          />

          {/* Ключ ориентации */}
          {renderKeyFeature()}

          {/* Метка полярности + если задана */}
          {activeVariant.hasPolarityMark && activeVariant.keyType !== "stripe" && (
            <text
              x={-bodyWidth / 2 + 0.8}
              y={-bodyHeight / 2 + 1.1}
              fill={activeVariant.polarityColor || "#ffffff"}
              fontSize="0.8"
              fontWeight="bold"
            >
              +
            </text>
          )}
        </g>

        {/* Контактные площадки (Pads) */}
        <g id="pads_layer">
          {pads.map((pad) => {
            const isHovered = hoveredPadNum === pad.padNum;
            return (
              <g
                key={pad.padNum}
                style={{ cursor: interactive ? "pointer" : "default" }}
                onMouseEnter={() => setHoveredPadNum(pad.padNum)}
                onMouseLeave={() => setHoveredPadNum(null)}
                onClick={() => onSelectPad?.(pad.padNum)}
              >
                {renderPadShape(pad, isHovered)}

                {/* Номер вывода внутри площадки */}
                <text
                  x={pad.x}
                  y={pad.y + 0.15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize="0.45"
                  fontWeight="bold"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {pad.padNum}
                </text>

                {/* Выносная подпись логического имени если есть */}
                {padLabels[pad.padNum] && (
                  <text
                    x={pad.x + (pad.x >= 0 ? 0.9 : -0.9)}
                    y={pad.y + 0.1}
                    textAnchor={pad.x >= 0 ? "start" : "end"}
                    fill="#38bdf8"
                    fontSize="0.38"
                    fontWeight="bold"
                    style={{ pointerEvents: "none" }}
                  >
                    {padLabels[pad.padNum]}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Размерные стрелки (Габариты) */}
        {showDimensions && (
          <g id="dimension_arrows" opacity="0.85">
            {/* Ширина внизу */}
            <line
              x1={-bodyWidth / 2}
              y1={bodyHeight / 2 + 1.2}
              x2={bodyWidth / 2}
              y2={bodyHeight / 2 + 1.2}
              stroke="#64748b"
              strokeWidth="0.05"
            />
            <text
              x="0"
              y={bodyHeight / 2 + 1.8}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="0.42"
            >
              W: {bodyWidth.toFixed(2)} mm
            </text>

            {/* Высота справа */}
            <line
              x1={bodyWidth / 2 + 1.2}
              y1={-bodyHeight / 2}
              x2={bodyWidth / 2 + 1.2}
              y2={bodyHeight / 2}
              stroke="#64748b"
              strokeWidth="0.05"
            />
            <text
              x={bodyWidth / 2 + 1.8}
              y="0"
              textAnchor="start"
              dominantBaseline="middle"
              fill="#94a3b8"
              fontSize="0.42"
            >
              H: {bodyHeight.toFixed(2)} mm
            </text>
          </g>
        )}
      </svg>

      {/* Плашка подсказки при наведении на пин */}
      {hoveredPadNum && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            border: "1px solid #38bdf8",
            borderRadius: "4px",
            padding: "4px 8px",
            color: "#e2e8f0",
            fontSize: "11px",
            pointerEvents: "none",
            backdropFilter: "blur(4px)",
          }}
        >
          <strong>Вывод {hoveredPadNum}</strong>
          {padLabels[hoveredPadNum] && (
            <span style={{ color: "#38bdf8", marginLeft: "6px" }}>
              ({padLabels[hoveredPadNum]})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
