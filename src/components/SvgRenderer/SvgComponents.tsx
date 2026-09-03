import React from "react";
import { ComponentItem } from "../../types/project";

interface SvgComponentProps {
  component: ComponentItem;
  isSelected: boolean;
  selectedPinId?: string;
  activeNetId?: string;
  onSelectComponent: (id: string) => void;
  onSelectPin: (componentId: string, pinId: string) => void;
  onStartDrag: (e: React.MouseEvent, componentId: string) => void;
}

export const SvgComponent: React.FC<SvgComponentProps> = ({
  component,
  isSelected,
  selectedPinId,
  activeNetId,
  onSelectComponent,
  onSelectPin,
  onStartDrag,
}) => {
  const { id, refDes, value, type, x, y, rotation, pins } = component;

  const handleComponentMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectComponent(id);
    onStartDrag(e, id);
  };

  const renderFootprint = () => {
    switch (type) {
      case "resistor":
      case "capacitor": {
        const isCap = type === "capacitor";
        return (
          <g>
            {/* Silkscreen outline */}
            <rect
              x="-21"
              y="-11"
              width="42"
              height="22"
              fill="none"
              stroke={isSelected ? "#38bdf8" : "#94a3b8"}
              strokeWidth={isSelected ? "1.5" : "0.8"}
              strokeDasharray={isCap ? "2 2" : undefined}
            />
            {/* Component Body */}
            <rect
              x="-12"
              y="-7"
              width="24"
              height="14"
              fill={isCap ? "#2563eb" : "#92400e"}
              rx="1.5"
            />
          </g>
        );
      }
      case "diode": {
        return (
          <g>
            <rect
              x="-22"
              y="-11"
              width="44"
              height="22"
              fill="none"
              stroke={isSelected ? "#38bdf8" : "#94a3b8"}
              strokeWidth={isSelected ? "1.5" : "0.8"}
            />
            <rect x="-14" y="-7" width="28" height="14" fill="#1e293b" rx="1.5" />
            {/* Cathode Band */}
            <rect x="6" y="-7" width="4" height="14" fill="#cbd5e1" />
          </g>
        );
      }
      case "ic_soic8":
      case "ic_dip8": {
        return (
          <g>
            {/* IC Body */}
            <rect
              x="-18"
              y="-28"
              width="36"
              height="56"
              fill="#181f2c"
              stroke={isSelected ? "#38bdf8" : "#475569"}
              strokeWidth={isSelected ? "1.5" : "1"}
              rx="2"
            />
            {/* IC Orientation Notch */}
            <path d="M -6 -28 A 6 6 0 0 0 6 -28" fill="none" stroke="#475569" strokeWidth="1.2" />
            {/* Pin 1 Dot */}
            <circle cx="-10" cy="-20" r="2.5" fill="#f43f5e" />
          </g>
        );
      }
      case "testpoint": {
        return (
          <g>
            <circle
              cx="0"
              cy="0"
              r="8"
              fill="none"
              stroke={isSelected ? "#38bdf8" : "#eab308"}
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />
          </g>
        );
      }
      default:
        return (
          <rect
            x="-16"
            y="-16"
            width="32"
            height="32"
            fill="#334155"
            stroke="#64748b"
          />
        );
    }
  };

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      className={`cad-component ${isSelected ? "is-selected" : ""}`}
      onMouseDown={handleComponentMouseDown}
      style={{ cursor: "move" }}
    >
      {/* Footprint body & silk */}
      {renderFootprint()}

      {/* Component Pins / Copper Pads */}
      {pins.map((pin) => {
        const isPinSelected = isSelected && selectedPinId === pin.id;
        const isConnectedNet = Boolean(
          activeNetId && pin.netId && pin.netId === activeNetId
        );

        let padFill = "#d97706"; // ENIG copper
        let padStroke = "#78350f";
        let strokeWidth = "1";

        if (isPinSelected) {
          padFill = "#fde047"; // Active Yellow
          padStroke = "#ffffff";
          strokeWidth = "2";
        } else if (isConnectedNet) {
          padFill = "#00f0ff"; // Boardview Electric Cyan
          padStroke = "#38bdf8";
          strokeWidth = "1.8";
        }

        const isRound = type === "testpoint";
        const padWidth = type.startsWith("ic") ? 14 : 12;
        const padHeight = type.startsWith("ic") ? 8 : 12;

        return (
          <g
            key={pin.id}
            transform={`translate(${pin.x}, ${pin.y})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectComponent(id);
              onSelectPin(id, pin.id);
            }}
            style={{ cursor: "pointer" }}
            className="cad-pin-group"
          >
            {/* Glow circle for active boardview net */}
            {(isConnectedNet || isPinSelected) && (
              <circle
                cx="0"
                cy="0"
                r={isRound ? 11 : 9}
                fill={isPinSelected ? "rgba(253, 224, 71, 0.4)" : "rgba(0, 240, 255, 0.4)"}
                className="pin-glow-ring"
              />
            )}

            {isRound ? (
              <circle cx="0" cy="0" r="6" fill={padFill} stroke={padStroke} strokeWidth={strokeWidth} />
            ) : (
              <rect
                x={-padWidth / 2}
                y={-padHeight / 2}
                width={padWidth}
                height={padHeight}
                rx="1"
                fill={padFill}
                stroke={padStroke}
                strokeWidth={strokeWidth}
              />
            )}

            {/* Pin number */}
            <text
              x="0"
              y="2.5"
              textAnchor="middle"
              fontSize="7"
              fontFamily="monospace"
              fontWeight="700"
              fill={isPinSelected || isConnectedNet ? "#0f172a" : "#ffffff"}
              pointerEvents="none"
            >
              {pin.number}
            </text>
          </g>
        );
      })}

      {/* Component Silkscreen Label */}
      <text
        x="0"
        y={type.startsWith("ic") ? 38 : 20}
        textAnchor="middle"
        fontSize="9"
        fontFamily="sans-serif"
        fontWeight="600"
        fill={isSelected ? "#38bdf8" : "#cbd5e1"}
        pointerEvents="none"
        className="cad-comp-text"
      >
        {refDes}
        {value ? ` ${value}` : ""}
      </text>
    </g>
  );
};
