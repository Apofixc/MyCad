import React, { useState, useEffect, useCallback } from "react";
import {
  Point2D,
  distance,
  angleDegrees,
  calculateLevelingAngle,
  formatMetric,
  CAD_PX_PER_MM,
} from "../../utils/alignmentMath";
import { Ruler, Check, X, Compass } from "lucide-react";

export type MeasureMode = "calibrate" | "level" | "measure" | null;

interface MeasureOverlayProps {
  mode: MeasureMode;
  zoom: number;
  pan: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  onApplyCalibration?: (measuredPx: number, realMm: number) => void;
  onApplyLeveling?: (deltaAngle: number) => void;
  onClose: () => void;
}

export const MeasureOverlay: React.FC<MeasureOverlayProps> = ({
  mode,
  zoom,
  pan,
  containerRef,
  onApplyCalibration,
  onApplyLeveling,
  onClose,
}) => {
  if (!mode) return null;

  const [pt1, setPt1] = useState<Point2D | null>(null);
  const [pt2, setPt2] = useState<Point2D | null>(null);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [realMm, setRealMm] = useState("2.54");

  // Reset points when mode changes
  useEffect(() => {
    setPt1(null);
    setPt2(null);
    setCursorPos(null);
    setShowModal(false);
  }, [mode]);

  // Convert client screen coords to canvas world coords
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point2D | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.round((clientX - rect.left - pan.x) / zoom);
      const y = Math.round((clientY - rect.top - pan.y) / zoom);
      return { x, y };
    },
    [containerRef, pan, zoom]
  );

  // Mouse Move tracking for rubber-band line
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const pt = screenToWorld(e.clientX, e.clientY);
      if (pt) setCursorPos(pt);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [screenToWorld, onClose]);

  // Canvas Click handling
  const handleCanvasClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pt = screenToWorld(e.clientX, e.clientY);
    if (!pt) return;

    if (!pt1) {
      setPt1(pt);
      setPt2(null);
    } else if (!pt2) {
      setPt2(pt);
      if (mode === "calibrate") {
        setShowModal(true);
      } else if (mode === "level") {
        const { deltaAngle } = calculateLevelingAngle(pt1, pt);
        onApplyLeveling?.(deltaAngle);
      }
    } else {
      // In measure mode, 3rd click starts a fresh measurement
      setPt1(pt);
      setPt2(null);
    }
  };

  const endPt = pt2 || cursorPos;
  const currentDistPx = pt1 && endPt ? distance(pt1, endPt) : 0;
  const currentAngle = pt1 && endPt ? angleDegrees(pt1, endPt) : 0;
  const levelingInfo = pt1 && endPt ? calculateLevelingAngle(pt1, endPt) : null;

  return (
    <>
      {/* 1. Fullscreen transparent SVG interaction layer */}
      <svg
        className="cad-measure-overlay-layer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: showModal ? "none" : "auto",
          cursor: "crosshair",
          zIndex: 40,
        }}
        onClick={handleCanvasClick}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Target 1 */}
          {pt1 && (
            <g transform={`translate(${pt1.x}, ${pt1.y})`}>
              <circle cx={0} cy={0} r={6 / zoom} fill="none" stroke="#38bdf8" strokeWidth={2 / zoom} />
              <circle cx={0} cy={0} r={2 / zoom} fill="#38bdf8" />
              <line x1={-10 / zoom} y1={0} x2={10 / zoom} y2={0} stroke="#38bdf8" strokeWidth={1 / zoom} />
              <line x1={0} y1={-10 / zoom} x2={0} y2={10 / zoom} stroke="#38bdf8" strokeWidth={1 / zoom} />
              <text x={8 / zoom} y={-8 / zoom} fill="#38bdf8" fontSize={11 / zoom} fontWeight="bold">
                ①
              </text>
            </g>
          )}

          {/* Rubber band line between pt1 and endPt */}
          {pt1 && endPt && (
            <g className="measure-line-group">
              <line
                x1={pt1.x}
                y1={pt1.y}
                x2={endPt.x}
                y2={endPt.y}
                stroke="#38bdf8"
                strokeWidth={1.5 / zoom}
                strokeDasharray={pt2 ? undefined : `${4 / zoom}, ${3 / zoom}`}
              />

              {/* Target 2 */}
              {pt2 && (
                <g transform={`translate(${pt2.x}, ${pt2.y})`}>
                  <circle cx={0} cy={0} r={6 / zoom} fill="none" stroke="#38bdf8" strokeWidth={2 / zoom} />
                  <circle cx={0} cy={0} r={2 / zoom} fill="#38bdf8" />
                  <text x={8 / zoom} y={-8 / zoom} fill="#38bdf8" fontSize={11 / zoom} fontWeight="bold">
                    ②
                  </text>
                </g>
              )}

              {/* Measurement Info Badge along the line */}
              <g transform={`translate(${(pt1.x + endPt.x) / 2}, ${(pt1.y + endPt.y) / 2 - 12 / zoom})`}>
                <rect
                  x={-75 / zoom}
                  y={-10 / zoom}
                  width={150 / zoom}
                  height={20 / zoom}
                  rx={4 / zoom}
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke="#38bdf8"
                  strokeWidth={1 / zoom}
                />
                <text
                  x={0}
                  y={4 / zoom}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize={10 / zoom}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {mode === "level" && levelingInfo
                    ? `∠${currentAngle.toFixed(1)}° (Δ${levelingInfo.deltaAngle > 0 ? "+" : ""}${levelingInfo.deltaAngle.toFixed(1)}°)`
                    : formatMetric(currentDistPx)}
                </text>
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* 2. Top Banner with Mode Hint */}
      <div className="cad-calibration-banner" onMouseDown={(e) => e.stopPropagation()}>
        <div className="banner-content">
          {mode === "level" ? (
            <Compass size={16} className="banner-icon" />
          ) : (
            <Ruler size={16} className="banner-icon" />
          )}
          <div className="banner-text">
            <strong>
              {mode === "calibrate" && "Калибровка масштаба по 2 точкам"}
              {mode === "level" && "Выравнивание горизонта по 2 точкам"}
              {mode === "measure" && "Измерительная линейка"}
            </strong>
            <span>
              {!pt1
                ? "Кликните первую точку на холсте"
                : !pt2
                ? "Кликните вторую точку для завершения замера"
                : mode === "measure"
                ? "Кликните для начала нового измерения"
                : "Расчет готов"}
            </span>
          </div>
        </div>
        <button className="cad-btn-flat btn-xs" onClick={onClose}>
          Отмена (Esc)
        </button>
      </div>

      {/* 3. Calibration Real MM Input Modal */}
      {showModal && mode === "calibrate" && (
        <div className="cad-modal-backdrop" onClick={onClose}>
          <div className="cad-dialog cad-calib-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cad-dialog-header">
              <div className="dialog-title-wrap">
                <Ruler size={18} />
                <h3>Калибровка масштаба изображения</h3>
              </div>
              <button className="cad-dialog-close" onClick={onClose}>
                <X size={15} />
              </button>
            </div>

            <div className="cad-dialog-body">
              <div className="calib-stats">
                <span>Измеренное расстояние:</span>
                <strong>
                  {currentDistPx.toFixed(1)} px ({(currentDistPx / CAD_PX_PER_MM).toFixed(2)} мм)
                </strong>
              </div>

              <div className="cad-field-group">
                <label>Реальное физическое расстояние (мм):</label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  className="cad-field-input"
                  value={realMm}
                  onChange={(e) => setRealMm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const mm = parseFloat(realMm);
                      if (!isNaN(mm) && mm > 0) {
                        onApplyCalibration?.(currentDistPx, mm);
                        setShowModal(false);
                      }
                    }
                  }}
                />
              </div>

              <div className="calib-presets">
                <span className="preset-label">Быстрый выбор:</span>
                <div className="preset-chips">
                  <button onClick={() => setRealMm("2.54")}>2.54 мм (DIP/SOIC)</button>
                  <button onClick={() => setRealMm("1.27")}>1.27 мм (SOIC pin)</button>
                  <button onClick={() => setRealMm("10.0")}>10.0 мм (линейка)</button>
                  <button onClick={() => setRealMm("50.0")}>50.0 мм</button>
                </div>
              </div>
            </div>

            <div className="cad-dialog-footer">
              <button className="cad-btn-flat" onClick={onClose}>
                Отмена
              </button>
              <button
                className="cad-btn-primary"
                onClick={() => {
                  const mm = parseFloat(realMm);
                  if (!isNaN(mm) && mm > 0) {
                    onApplyCalibration?.(currentDistPx, mm);
                    setShowModal(false);
                  }
                }}
              >
                <Check size={14} />
                <span>Применить масштаб</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
