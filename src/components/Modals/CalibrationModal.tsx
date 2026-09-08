import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Ruler, X, Check } from "lucide-react";

interface CalibrationModalProps {
  isOpen: boolean;
  measuredPx: number;
  currentPxPerMm?: number;
  onApply: (realMm: number) => void;
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  measuredPx,
  currentPxPerMm,
  onApply,
  onClose,
}) => {
  const [realMm, setRealMm] = useState<string>("10.0");

  useEffect(() => {
    if (isOpen) {
      // If currentPxPerMm is available, compute approximate current mm as starting point
      if (currentPxPerMm && currentPxPerMm > 0) {
        const estMm = (measuredPx / currentPxPerMm).toFixed(2);
        setRealMm(estMm);
      } else {
        setRealMm("10.0");
      }
    }
  }, [isOpen, measuredPx, currentPxPerMm]);

  if (!isOpen || measuredPx <= 0) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(realMm.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      onApply(val);
    }
  };

  const currentEstimatedMm = currentPxPerMm && currentPxPerMm > 0
    ? (measuredPx / currentPxPerMm).toFixed(2)
    : null;

  return createPortal(
    <div
      className="cad-modal-backdrop"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="cad-modal-box"
        style={{ maxWidth: "440px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="cad-modal-icon-badge">
              <Ruler size={18} color="#60a5fa" />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>
                Калибровка масштаба изображения
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Привязка пикселей скана платы к миллиметрам (ECAD)
              </div>
            </div>
          </div>
          <button
            type="button"
            className="cad-modal-close-btn"
            onClick={onClose}
            title="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cad-modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "6px",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--cad-text-dim)" }}>Измеренное расстояние на холсте:</span>
                <strong style={{ color: "#38bdf8" }}>{measuredPx.toFixed(1)} px</strong>
              </div>
              {currentEstimatedMm && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--cad-text-dim)" }}>Текущее расчетное расстояние:</span>
                  <span style={{ color: "var(--cad-text)" }}>{currentEstimatedMm} мм</span>
                </div>
              )}
            </div>

            <div className="cad-input-field">
              <label style={{ fontSize: "12px", fontWeight: 500, color: "var(--cad-text)" }}>
                Реальное физическое расстояние (мм) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                value={realMm}
                onChange={(e) => setRealMm(e.target.value)}
                placeholder="2.54, 10.0, 50.0..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: "1px solid var(--cad-border)",
                  background: "var(--cad-bg-input)",
                  color: "var(--cad-text)",
                }}
              />
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "var(--cad-text-dim)", display: "block", marginBottom: "6px" }}>
                Быстрый выбор эталонного размера:
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => setRealMm("2.54")}
                >
                  2.54 мм (DIP / штыри)
                </button>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => setRealMm("1.27")}
                >
                  1.27 мм (SOIC)
                </button>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => setRealMm("10.0")}
                >
                  10.0 мм (линейка)
                </button>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => setRealMm("50.0")}
                >
                  50.0 мм (плата)
                </button>
              </div>
            </div>
          </div>

          <div className="cad-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cad-btn cad-btn-primary"
            >
              <Check size={14} style={{ marginRight: "4px" }} />
              <span>Применить масштаб</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
