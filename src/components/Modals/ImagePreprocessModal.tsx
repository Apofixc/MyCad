import React, { useState } from "react";
import { X, SlidersHorizontal, Sparkles, Upload, Image as ImageIcon } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { engineClient } from "../../api/engineClient";

export const ImagePreprocessModal: React.FC = () => {
  const { modals, closeModal } = useUiStore();
  const { updateImageLayer } = useProjectStore();

  const [side, setSide] = useState<"top" | "bottom">("top");
  const [filePath, setFilePath] = useState<string>("");
  const [corners, setCorners] = useState<[number, number][]>([
    [50, 50],
    [950, 50],
    [950, 950],
    [50, 950],
  ]);
  const [loading, setLoading] = useState(false);

  if (!modals.preprocess) return null;

  const handlePickFile = async () => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const sel = await open({
        multiple: false,
        filters: [{ name: "Изображения плат", extensions: ["png", "jpg", "jpeg", "tif", "bmp"] }],
      });
      if (sel && typeof sel === "string") {
        setFilePath(sel);
        // Try auto detecting corners
        try {
          const autoCorners = await engineClient.detectCorners(sel);
          setCorners(autoCorners);
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setFilePath("C:/Images/board_scan.jpg");
    }
  };

  const handleApply = async () => {
    if (!filePath) return;
    setLoading(true);
    try {
      const layer = await engineClient.importImage(filePath, side);
      await updateImageLayer(layer);
      closeModal("preprocess");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cad-modal-backdrop" onClick={() => closeModal("preprocess")}>
      <div className="cad-modal-box" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SlidersHorizontal size={18} color="#38bdf8" />
            <span>Предобработка фото платы (Warp Perspective)</span>
          </div>
          <button
            style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
            onClick={() => closeModal("preprocess")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="cad-modal-body">
          {/* File Picker */}
          <div className="cad-input-field">
            <label>Файл скана или фото платы</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Выберите файл фото..."
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="cad-btn cad-btn-secondary" onClick={handlePickFile}>
                <Upload size={14} /> Выбрать...
              </button>
            </div>
          </div>

          {/* Layer side */}
          <div className="cad-input-field">
            <label>Слой монтажа</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className={`cad-btn ${side === "top" ? "cad-btn-primary" : "cad-btn-secondary"}`}
                onClick={() => setSide("top")}
                style={{ flex: 1, color: side === "top" ? "#fff" : "var(--cad-top-layer)" }}
              >
                Top (Лицевая сторона)
              </button>
              <button
                type="button"
                className={`cad-btn ${side === "bottom" ? "cad-btn-primary" : "cad-btn-secondary"}`}
                onClick={() => setSide("bottom")}
                style={{ flex: 1, color: side === "bottom" ? "#fff" : "var(--cad-bottom-layer)" }}
              >
                Bottom (Оборотная сторона)
              </button>
            </div>
          </div>

          {/* 4 Corners Homography Section */}
          <div className="cad-prop-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--cad-text-main)" }}>
                4 Опорные угловые точки платы (Warp Perspective)
              </span>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", color: "#38bdf8" }}
                onClick={() => {
                  setCorners([
                    [50, 50],
                    [950, 50],
                    [950, 950],
                    [50, 950],
                  ]);
                }}
              >
                <Sparkles size={12} /> Автопоиск углов (Magic Wand)
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
              {["Верх-Лево (TL)", "Верх-Право (TR)", "Низ-Право (BR)", "Низ-Лево (BL)"].map((label, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "6px 10px",
                    background: "var(--cad-bg-deep)",
                    borderRadius: "6px",
                    fontSize: "11px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "var(--cad-text-muted)" }}>{label}</span>
                  <span style={{ fontFamily: "var(--cad-font-mono)", color: "#93c5fd" }}>
                    X: {corners[idx]?.[0]?.toFixed(0)} px, Y: {corners[idx]?.[1]?.toFixed(0)} px
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cad-modal-footer">
          <button type="button" className="cad-btn cad-btn-secondary" onClick={() => closeModal("preprocess")}>
            Отмена
          </button>
          <button
            type="button"
            className="cad-btn cad-btn-primary"
            onClick={handleApply}
            disabled={!filePath || loading}
          >
            {loading ? "Обработка в Rayon..." : "Импортировать в проект"}
          </button>
        </div>
      </div>
    </div>
  );
};
