import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Ruler, X, Check } from "lucide-react";
import { PackageDefinition } from "../../types/componentLibrary";
import { packageReferenceDistance, PackageReference } from "../../utils/calibration";
import { FootprintPreview } from "../SvgRenderer/FootprintPreview";
import { reportError } from "../../utils/errorHandler";
import { useLibraryStore } from "../../stores/libraryStore";

interface CalibrationModalProps {
  isOpen: boolean;
  measuredPx: number;
  currentPxPerMm?: number;
  packages?: PackageDefinition[];
  initialPackageId?: string;
  onApply: (realMm: number) => Promise<boolean>;
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  measuredPx,
  currentPxPerMm,
  packages = [],
  initialPackageId,
  onApply,
  onClose,
}) => {
  const storePackages = useLibraryStore((state) => state.packages);
  const availablePackages = packages && packages.length > 0 ? packages : storePackages;

  const [realMm, setRealMm] = useState<string>("10.0");
  const [packageId, setPackageId] = useState("");
  const [reference, setReference] = useState<PackageReference>("width");
  const [fromPad, setFromPad] = useState("");
  const [toPad, setToPad] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const pkg = availablePackages.find((p) => p.id === packageId);
  const distance = pkg ? packageReferenceDistance(pkg, reference, fromPad, toPad) : Number(realMm.replace(",", "."));

  // Auto-load packages from SQLite store if not loaded yet
  useEffect(() => {
    if (isOpen && availablePackages.length === 0) {
      useLibraryStore.getState().loadAll();
    }
  }, [isOpen, availablePackages.length]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isApplying) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, isApplying, onClose]);

  // Reset and auto-configure reference when opened
  useEffect(() => {
    if (isOpen) {
      const selectedId = initialPackageId ?? "";
      setPackageId(selectedId);

      const targetPkg = availablePackages.find((p) => p.id === selectedId);
      if (targetPkg) {
        if (targetPkg.pitch && targetPkg.pitch > 0) {
          setReference("pitch");
          setFromPad("");
          setToPad("");
        } else if (targetPkg.pads && targetPkg.pads.length >= 2) {
          setReference("pads");
          setFromPad(targetPkg.pads[0].padNum);
          setToPad(targetPkg.pads[1].padNum);
        } else {
          setReference("width");
          setFromPad("");
          setToPad("");
        }
      } else {
        setReference("width");
        setFromPad("");
        setToPad("");
      }

      // If currentPxPerMm is available, compute approximate current mm as starting point
      if (currentPxPerMm && currentPxPerMm > 0) {
        const estMm = (measuredPx / currentPxPerMm).toFixed(2);
        setRealMm(estMm);
      } else {
        setRealMm("10.0");
      }
    }
  }, [isOpen, measuredPx, currentPxPerMm, initialPackageId, availablePackages]);

  if (!isOpen || measuredPx <= 0) return null;

  const handlePackageSelect = (newPkgId: string) => {
    setPackageId(newPkgId);
    if (!newPkgId) {
      setFromPad("");
      setToPad("");
      return;
    }
    const found = availablePackages.find((p) => p.id === newPkgId);
    if (found) {
      if (found.pitch && found.pitch > 0) {
        setReference("pitch");
        setFromPad("");
        setToPad("");
      } else if (found.pads && found.pads.length >= 2) {
        setReference("pads");
        setFromPad(found.pads[0].padNum);
        setToPad(found.pads[1].padNum);
      } else {
        setReference("width");
        setFromPad("");
        setToPad("");
      }
    }
  };

  const handleReferenceSelect = (newRef: PackageReference) => {
    setReference(newRef);
    if (newRef === "pads" && pkg && pkg.pads && pkg.pads.length >= 2) {
      if (!fromPad || !toPad || fromPad === toPad) {
        setFromPad(pkg.pads[0].padNum);
        setToPad(pkg.pads[1].padNum);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isApplying || distance === null || !Number.isFinite(distance) || distance <= 0) return;
    setIsApplying(true);
    try { await onApply(distance); }
    catch (error) { reportError(error, "Ошибка калибровки"); }
    finally { setIsApplying(false); }
  };

  const currentEstimatedMm = currentPxPerMm && currentPxPerMm > 0
    ? (measuredPx / currentPxPerMm).toFixed(2)
    : null;

  return createPortal(
    <div
      className="cad-modal-backdrop"
      onClick={() => { if (!isApplying) onClose(); }}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="cad-modal-box"
        style={{ maxWidth: "520px", maxHeight: "95vh", overflowY: "auto" }}
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
            disabled={isApplying}
            title="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={isApplying} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="cad-modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label className="form-label">Эталон размера (из библиотеки корпусов)
              <select className="cad-input" value={packageId} onChange={(event) => handlePackageSelect(event.target.value)}>
                <option value="">Ввести расстояние вручную</option>
                {availablePackages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {pkg && <>
              <label className="form-label">Измеренная часть корпуса
                <select className="cad-input" value={reference}
                  onChange={(event) => handleReferenceSelect(event.target.value as PackageReference)}>
                  <option value="pitch" disabled={!pkg.pitch}>Шаг выводов (Pitch: {pkg.pitch ? `${pkg.pitch} мм` : "нет"})</option>
                  <option value="pads">Между центрами площадок</option>
                  <option value="width">Ширина корпуса ({pkg.bodyWidth ? `${pkg.bodyWidth} мм` : "W"})</option>
                  <option value="height">Высота корпуса ({pkg.bodyHeight ? `${pkg.bodyHeight} мм` : "H"})</option>
                </select>
              </label>
              {reference === "pads" && <div style={{ display: "flex", gap: 8 }}>
                {[fromPad, toPad].map((padNum, index) => <label key={index} className="form-label">
                  {index === 0 ? "От площадки" : "До площадки"}
                  <select className="cad-input" value={padNum}
                    onChange={(event) => index === 0 ? setFromPad(event.target.value) : setToPad(event.target.value)}>
                    <option value="">Выберите</option>
                    {pkg.pads.map((p) => <option key={p.padNum} value={p.padNum}>Контакт {p.padNum}</option>)}
                  </select>
                </label>)}
              </div>}
              <FootprintPreview packageDef={pkg} height={150} interactive={reference === "pads"}
                showCourtyard={false} padColors={{ [fromPad]: "#38bdf8", [toPad]: "#22c55e" }}
                onSelectPad={(padNum) => { if (!fromPad || toPad) { setFromPad(padNum); setToPad(""); } else setToPad(padNum); }} />
              <p style={{ fontSize: 12, margin: 0, color: "var(--cad-text-muted)" }}>Две отмеченные точки на фото должны соответствовать выбранному размеру:
                {reference === "pads" ? " центрам площадок." : reference === "pitch" ? " центрам соседних выводов одного ряда." : " противоположным граням корпуса, без выводов."}
                {" "}Если это не так, отмените калибровку и отметьте точки заново.</p>
              {distance === null && <p role="alert" style={{ color: "#ef4444", fontSize: "12px", margin: 0 }}>Выберите две разные площадки с ненулевым расстоянием.</p>}
            </>}
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
                step="any"
                min="0.000001"
                required
                autoFocus
                value={pkg ? (distance !== null ? Number(distance.toFixed(4)).toString() : "") : realMm}
                readOnly={!!pkg}
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
                  onClick={() => { setPackageId(""); setRealMm("2.54"); }}
                >
                  2.54 мм (DIP / штыри)
                </button>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => { setPackageId(""); setRealMm("1.27"); }}
                >
                  1.27 мм (SOIC)
                </button>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => { setPackageId(""); setRealMm("10.0"); }}
                >
                  10.0 мм (линейка)
                </button>
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => { setPackageId(""); setRealMm("50.0"); }}
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
              disabled={distance === null || !Number.isFinite(distance) || distance <= 0}
              className="cad-btn cad-btn-primary"
            >
              <Check size={14} style={{ marginRight: "4px" }} />
              <span>Применить масштаб</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>,
    document.body
  );
};
