import React, { useState, useEffect } from "react";
import { X, Sparkles, Zap, Image as ImageIcon, AlertTriangle, Check } from "lucide-react";
import { getImageDimensions } from "../../utils/imageLoader";
import { resolveImageSrc } from "../../utils/imageUrl";
import "../../preprocess.css";

export interface BatchImageImportModalProps {
  isOpen: boolean;
  files: File[];
  onConfirm: (preserveOriginal: boolean) => void;
  onCancel: () => void;
}

interface FileMeta {
  file: File;
  width?: number;
  height?: number;
  isHighRes?: boolean;
}

export const BatchImageImportModal: React.FC<BatchImageImportModalProps> = ({
  isOpen,
  files,
  onConfirm,
  onCancel,
}) => {
  const [selectedQuality, setSelectedQuality] = useState<"optimize" | "original">("original");
  const [fileMetas, setFileMetas] = useState<FileMeta[]>([]);
  const [loadingDims, setLoadingDims] = useState(false);

  useEffect(() => {
    if (!isOpen || files.length === 0) {
      setFileMetas([]);
      return;
    }

    let isMounted = true;
    setLoadingDims(true);

    const loadMeta = async () => {
      const metas: FileMeta[] = [];
      for (const f of files) {
        const filePath = (f as any).filePath as string | undefined;
        let w: number | undefined;
        let h: number | undefined;
        try {
          if (filePath) {
            const dims = await getImageDimensions(resolveImageSrc(filePath));
            w = dims.width;
            h = dims.height;
          }
        } catch {
          // ignore
        }
        const isHighRes = (w && w > 4096) || (h && h > 4096);
        metas.push({
          file: f,
          width: w,
          height: h,
          isHighRes: Boolean(isHighRes),
        });
      }

      if (isMounted) {
        setFileMetas(metas);
        // Если обнаружены файлы > 4096px, рекомендуем оптимизировать, но оставляем выбор за пользователем
        setLoadingDims(false);
      }
    };

    loadMeta();

    return () => {
      isMounted = false;
    };
  }, [isOpen, files]);

  if (!isOpen) return null;

  const hasHighResFiles = fileMetas.some((m) => m.isHighRes);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="batch-import-modal-overlay">
      <div
        className="batch-import-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="batch-import-modal-header">
          <div className="batch-import-title-group">
            <div className="batch-import-title-icon">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3>Импорт нескольких изображений</h3>
              <p className="batch-import-subtitle">
                Выбрано файлов: <strong>{files.length}</strong>. Выберите режим качества для вставки на плату
              </p>
            </div>
          </div>
          <button
            className="batch-import-close-btn"
            onClick={onCancel}
            title="Закрыть (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="batch-import-modal-body">
          {/* Options Grid */}
          <div className="batch-import-options-grid">
            {/* Option: Original Quality */}
            <div
              className={`batch-import-card ${selectedQuality === "original" ? "selected" : ""}`}
              onClick={() => setSelectedQuality("original")}
              role="button"
              tabIndex={0}
            >
              <div className="batch-import-card-header">
                <div className="batch-import-icon-box original-icon-box">
                  <Sparkles size={20} />
                </div>
                <div className="batch-import-badges">
                  <span className="batch-badge badge-cyan">Оригинал 1:1</span>
                  {selectedQuality === "original" && (
                    <span className="batch-check-indicator">
                      <Check size={13} />
                    </span>
                  )}
                </div>
              </div>
              <div className="batch-import-card-title">Исходное качество</div>
              <div className="batch-import-card-desc">
                Сохраняет 100% пикселей и четкость без компрессии. Идеально для реверс-инжиниринга, трассировки тонких проводников и мелких надписей.
              </div>
            </div>

            {/* Option: Optimized */}
            <div
              className={`batch-import-card ${selectedQuality === "optimize" ? "selected" : ""}`}
              onClick={() => setSelectedQuality("optimize")}
              role="button"
              tabIndex={0}
            >
              <div className="batch-import-card-header">
                <div className="batch-import-icon-box optimize-icon-box">
                  <Zap size={20} />
                </div>
                <div className="batch-import-badges">
                  <span className="batch-badge badge-amber">До 4096 px</span>
                  {selectedQuality === "optimize" && (
                    <span className="batch-check-indicator">
                      <Check size={13} />
                    </span>
                  )}
                </div>
              </div>
              <div className="batch-import-card-title">Оптимизировать (до 4096px)</div>
              <div className="batch-import-card-desc">
                Уменьшает файлы более 4K через фильтр Lanczos3 на Rust. Экономит видеопамять и ускоряет рендеринг при зумировании холста.
              </div>
            </div>
          </div>

          {/* High-res warning if detected */}
          {hasHighResFiles && (
            <div className="batch-import-alert">
              <AlertTriangle size={17} className="batch-alert-icon" />
              <div className="batch-alert-text">
                Обнаружены сканы со сверхвысоким разрешением (более 4096 px). При выборе «Оригинал 1:1» они сохранят максимальную детализацию, но потребуют больше видеопамяти.
              </div>
            </div>
          )}

          {/* Files List Preview */}
          <div className="batch-import-files-section">
            <div className="batch-import-files-heading">
              Список файлов ({files.length})
              {loadingDims && <span className="batch-loading-text">Анализ размеров...</span>}
            </div>
            <div className="batch-import-files-list">
              {fileMetas.map((item, idx) => (
                <div key={idx} className="batch-file-row">
                  <div className="batch-file-info">
                    <span className="batch-file-name" title={item.file.name}>
                      {item.file.name}
                    </span>
                    {item.file.size > 0 && (
                      <span className="batch-file-size">
                        {formatFileSize(item.file.size)}
                      </span>
                    )}
                  </div>
                  <div className="batch-file-details">
                    {item.width && item.height ? (
                      <span className={`batch-file-dims ${item.isHighRes ? "highlight" : ""}`}>
                        {item.width} × {item.height} px
                      </span>
                    ) : null}
                    {item.isHighRes && (
                      <span className="batch-badge badge-amber-sm">4K+</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="batch-import-modal-footer">
          <button className="batch-btn batch-btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button
            className="batch-btn batch-btn-primary"
            onClick={() => onConfirm(selectedQuality === "original")}
          >
            Вставить изображения ({files.length})
          </button>
        </div>
      </div>
    </div>
  );
};
