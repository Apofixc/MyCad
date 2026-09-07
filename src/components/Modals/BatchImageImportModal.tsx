import React, { useState } from "react";
import { X, Images, Sparkles, Check, FileImage, Loader2 } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { engineClient } from "../../api/engineClient";
import "./BatchImageImportModal.css";

export const BatchImageImportModal: React.FC = () => {
  const { modals, closeModal, pendingBatchImport, setPendingBatchImport } = useUiStore();
  const { updateImageLayers } = useProjectStore();

  const [quality, setQuality] = useState<"original" | "optimized">("original");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!modals.batchImport || !pendingBatchImport) return null;

  const { files, filePaths, side } = pendingBatchImport;

  const handleClose = () => {
    setPendingBatchImport(null);
    closeModal("batchImport");
  };

  const handleImport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let pathsToImport: string[] = [];
      if (filePaths && filePaths.length > 0) {
        pathsToImport = filePaths;
      } else if (files && files.length > 0) {
        pathsToImport = files
          .map((f: any) => f.filePath || (f.path as string))
          .filter(Boolean);
      }

      if (pathsToImport.length === 0) {
        throw new Error("Не удалось получить пути к файлам для импорта");
      }

      const importedLayers = await engineClient.importBatchImages(pathsToImport, side);

      if (quality === "optimized") {
        for (const layer of importedLayers) {
          if (layer.width > 4096 || layer.height > 4096) {
            try {
              const opt = await engineClient.processAndSaveImage(
                {
                  source: layer.cachedUrl || layer.imageFile || "",
                  operation: {
                    type: "resize",
                    maxDimension: 4096,
                    quality: 88,
                  },
                },
                side,
                layer.name
              );
              layer.imageFile = opt.imageFile;
              layer.cachedUrl = opt.cachedUrl;
              layer.width = opt.width;
              layer.height = opt.height;
            } catch (optErr) {
              console.warn("Optimizing layer failed:", optErr);
            }
          }
        }
      }

      await updateImageLayers(importedLayers);
      handleClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || err?.toString() || "Ошибка пакетного импорта");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cad-batch-modal-backdrop" onClick={handleClose}>
      <div className="cad-batch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cad-batch-header">
          <div className="title-group">
            <div className="icon-badge">
              <Images size={18} />
            </div>
            <div>
              <div className="title">Пакетный импорт изображений</div>
              <div className="subtitle">
                Добавление {files.length || filePaths?.length || 0} фото на слой{" "}
                <strong style={{ color: side === "top" ? "var(--cad-top-layer)" : "var(--cad-bottom-layer)" }}>
                  {side === "top" ? "Top (Верхний)" : "Bottom (Нижний)"}
                </strong>
              </div>
            </div>
          </div>
          <button className="cad-btn-secondary" onClick={handleClose} style={{ padding: "6px" }}>
            <X size={16} />
          </button>
        </div>

        <div className="cad-batch-content">
          {errorMsg && (
            <div style={{ color: "#ef4444", fontSize: "12px", background: "rgba(239, 68, 68, 0.1)", padding: "8px 12px", borderRadius: "6px" }}>
              {errorMsg}
            </div>
          )}

          <div style={{ fontSize: "12px", color: "var(--cad-text-muted)" }}>
            Обнаруженные файлы:
          </div>

          <div className="cad-batch-file-list">
            {(files.length > 0 ? files : (filePaths || []).map((p) => ({ name: p.split(/[\\/]/).pop() || p }))).map(
              (item, i) => (
                <div key={i} className="cad-batch-file-item">
                  <div className="file-name">
                    <FileImage size={14} color="#38bdf8" />
                    <span>{item.name}</span>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="cad-batch-options">
            <div
              className={`cad-batch-option-card ${quality === "original" ? "active" : ""}`}
              onClick={() => setQuality("original")}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--cad-text-main)", marginBottom: "4px" }}>
                  Оригинальное качество (без сжатия)
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--cad-text-muted)" }}>
                  Сохраняет исходное разрешение и детализацию каждого пикселя. Рекомендуется для точного реверс-инжиниринга.
                </div>
              </div>
              {quality === "original" && <Check size={16} color="var(--cad-accent)" />}
            </div>

            <div
              className={`cad-batch-option-card ${quality === "optimized" ? "active" : ""}`}
              onClick={() => setQuality("optimized")}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--cad-text-main)", marginBottom: "4px" }}>
                  Оптимизированное качество (до 4K)
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--cad-text-muted)" }}>
                  Масштабирует сверхбольшие сканы (&gt;4096px) для экономии оперативной памяти и максимальной плавности холста.
                </div>
              </div>
              {quality === "optimized" && <Check size={16} color="var(--cad-accent)" />}
            </div>
          </div>
        </div>

        <div className="cad-batch-footer">
          <button className="cad-btn-secondary" onClick={handleClose} disabled={loading}>
            Отмена
          </button>
          <button className="cad-btn-primary" onClick={handleImport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Импорт...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Импортировать все ({files.length || filePaths?.length || 0})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
