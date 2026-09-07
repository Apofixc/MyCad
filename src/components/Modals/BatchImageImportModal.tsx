import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Images,
  Sparkles,
  Check,
  FileImage,
  Loader2,
  Trash2,
  Zap,
  Cpu,
  Layers,
  ArrowLeftRight,
} from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { engineClient, resolveImageUrl } from "../../api/engineClient";
import "./BatchImageImportModal.css";

interface BatchItem {
  id: string;
  name: string;
  path?: string;
  file?: File;
  sizeBytes?: number;
  sizeStr?: string;
  ext: string;
  width?: number;
  height?: number;
  mp?: number;
  sizeMm?: string;
  thumbUrl?: string;
}

const FileThumbnailCard: React.FC<{
  item: BatchItem;
  onMetaLoaded: (
    id: string,
    meta: {
      thumbUrl: string;
      width: number;
      height: number;
      mp: number;
      sizeMm: string;
      sizeBytes?: number;
    }
  ) => void;
  onRemove: (id: string) => void;
}> = ({ item, onMetaLoaded, onRemove }) => {
  useEffect(() => {
    let active = true;

    const loadMetaAndThumb = async () => {
      try {
        let blob: Blob | null = null;
        if (item.file) {
          blob = item.file;
        } else if (item.path) {
          const resolved = await resolveImageUrl(item.path);
          const resp = await fetch(resolved);
          blob = await resp.blob();
        }

        if (!blob || !active) return;

        // Decode off main thread via hardware-accelerated worker bitmap
        const bmp = await createImageBitmap(blob);
        if (!active) {
          bmp.close();
          return;
        }

        const w = bmp.width;
        const h = bmp.height;
        const mp = (w * h) / 1_000_000;
        // Standard 600 DPI conversion (23.62 px/mm)
        const mmW = (w / 23.62).toFixed(0);
        const mmH = (h / 23.62).toFixed(0);
        const sizeMm = `${mmW} × ${mmH} мм`;

        // Render lightweight 88px thumbnail
        const maxThumb = 88;
        const scale = Math.min(maxThumb / w, maxThumb / h, 1);
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "medium";
          ctx.drawImage(bmp, 0, 0, tw, th);
        }
        bmp.close(); // Crucial: free hundreds of MBs of raw bitmap memory immediately!

        const thumbUrl = canvas.toDataURL("image/jpeg", 0.75);

        if (active) {
          onMetaLoaded(item.id, {
            thumbUrl,
            width: w,
            height: h,
            mp,
            sizeMm,
            sizeBytes: blob.size,
          });
        }
      } catch (err) {
        console.warn("Failed to generate fast thumbnail for:", item.name, err);
      }
    };

    loadMetaAndThumb();

    return () => {
      active = false;
    };
  }, [item.id, item.file, item.path, onMetaLoaded]);

  return (
    <div className="cad-batch-file-card">
      <div className="cad-batch-thumb-wrap">
        {item.thumbUrl ? (
          <img src={item.thumbUrl} alt={item.name} className="cad-batch-thumb-img" />
        ) : (
          <FileImage size={20} className="cad-batch-thumb-placeholder" />
        )}
      </div>

      <div className="cad-batch-file-info">
        <div className="cad-batch-file-name" title={item.name}>
          {item.name}
        </div>
        <div className="cad-batch-file-meta">
          <span className="cad-batch-ext-tag">{item.ext}</span>
          {item.width && item.height ? (
            <>
              <span className="cad-batch-res-tag">
                {item.width} × {item.height} px
              </span>
              <span className="cad-batch-mp-tag">{item.mp?.toFixed(1)} МП</span>
              <span className="cad-batch-dim-tag">~{item.sizeMm}</span>
            </>
          ) : (
            <span className="cad-batch-size-tag">Определение параметров...</span>
          )}
          {item.sizeStr && <span className="cad-batch-size-tag">{item.sizeStr}</span>}
        </div>
      </div>

      <button
        className="cad-batch-remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        title="Исключить из очереди импорта"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

export const BatchImageImportModal: React.FC = () => {
  const { modals, closeModal, pendingBatchImport, setPendingBatchImport } = useUiStore();
  const { updateImageLayers } = useProjectStore();

  const [quality, setQuality] = useState<"original" | "optimized">("original");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [targetSide, setTargetSide] = useState<"top" | "bottom">("top");

  useEffect(() => {
    if (!pendingBatchImport) {
      setItems([]);
      return;
    }

    setTargetSide(pendingBatchImport.side);

    const rawFiles = pendingBatchImport.files || [];
    const rawPaths = pendingBatchImport.filePaths || [];

    if (rawPaths.length > 0) {
      const mapped: BatchItem[] = rawPaths.map((p, idx) => {
        const name = p.split(/[\\/]/).pop() || p;
        const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "IMG";
        return {
          id: `path-${idx}-${name}`,
          name,
          path: p,
          ext,
        };
      });
      setItems(mapped);
    } else if (rawFiles.length > 0) {
      const mapped: BatchItem[] = rawFiles.map((f, idx) => {
        const p = (f as any).filePath || (f as any).path;
        const name = f.name;
        const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "IMG";
        const sizeMb = f.size ? `${(f.size / (1024 * 1024)).toFixed(1)} МБ` : "";
        return {
          id: `file-${idx}-${name}`,
          name,
          path: p,
          file: f,
          sizeBytes: f.size,
          sizeStr: sizeMb,
          ext,
        };
      });
      setItems(mapped);
    }
  }, [pendingBatchImport]);

  const handleMetaLoaded = useCallback(
    (
      id: string,
      meta: {
        thumbUrl: string;
        width: number;
        height: number;
        mp: number;
        sizeMm: string;
        sizeBytes?: number;
      }
    ) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          return {
            ...it,
            ...meta,
            sizeStr: meta.sizeBytes
              ? `${(meta.sizeBytes / (1024 * 1024)).toFixed(1)} МБ`
              : it.sizeStr,
          };
        })
      );
    },
    []
  );

  if (!modals.batchImport || !pendingBatchImport) return null;

  const handleClose = () => {
    setPendingBatchImport(null);
    closeModal("batchImport");
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      if (next.length === 0) {
        handleClose();
      }
      return next;
    });
  };

  const toggleSide = () => {
    setTargetSide((prev) => (prev === "top" ? "bottom" : "top"));
  };

  // Aggregated informativeness stats
  const totalMp = items.reduce((acc, it) => acc + (it.mp || 0), 0);
  const totalBytes = items.reduce((acc, it) => acc + (it.sizeBytes || 0), 0);
  const totalSizeStr =
    totalBytes > 0 ? `${(totalBytes / (1024 * 1024)).toFixed(1)} МБ` : "Авто";
  const totalWidthEst = items.reduce((acc, it) => {
    const w = it.width ? Math.round(it.width / 23.62) : 80;
    return acc + w + 15;
  }, 0);

  const handleImport = async () => {
    if (items.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const pathsToImport = items
        .map((it) => it.path || (it.file ? (it.file as any).filePath || (it.file as any).path : null))
        .filter(Boolean) as string[];

      if (pathsToImport.length === 0) {
        throw new Error("Не удалось определить пути к файлам для импорта");
      }

      const importedLayers = await engineClient.importBatchImages(pathsToImport, targetSide);

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
                targetSide,
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

      // Automatically arrange images side by side to prevent overlapping
      const { boards, board } = useProjectStore.getState();
      const currentBoard = board || boards[0];
      const existing =
        targetSide === "top"
          ? currentBoard?.data?.bgTop?.images
          : currentBoard?.data?.bgBottom?.images;

      let currentX = 0;
      if (existing && existing.length > 0) {
        for (const ex of existing) {
          const exW = ((ex.width || 2000) / (ex.pxPerMm || 23.62)) * (ex.scale || 1);
          const r = (ex.offsetX || 0) + exW;
          if (r > currentX) currentX = r;
        }
        if (currentX > 0) currentX += 15; // 15mm gap after the last existing image
      }

      for (const layer of importedLayers) {
        layer.offsetX = Math.round(currentX);
        layer.offsetY = 0;
        const wMm = ((layer.width || 2000) / (layer.pxPerMm || 23.62)) * (layer.scale || 1);
        currentX += wMm + 15; // 15mm gap between each new image
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
        {/* Header */}
        <div className="cad-batch-header">
          <div className="title-group">
            <div className="icon-badge">
              <Images size={18} />
            </div>
            <div>
              <div className="title">Пакетный импорт изображений</div>
              <div className="subtitle">
                Добавление изображений на целевой слой проекта
              </div>
            </div>
          </div>
          <div className="cad-batch-header-right">
            <div
              className={`cad-batch-layer-tag ${targetSide}`}
              onClick={toggleSide}
              title="Нажмите для переключения слоя (Top / Bottom)"
            >
              <span>Слой:</span>
              <strong>{targetSide === "top" ? "Top (Верхний)" : "Bottom (Нижний)"}</strong>
              <ArrowLeftRight size={12} style={{ marginLeft: "4px", opacity: 0.7 }} />
            </div>
            <button className="cad-batch-close-btn" onClick={handleClose} title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="cad-batch-content">
          {errorMsg && (
            <div
              style={{
                color: "#ef4444",
                fontSize: "12px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                padding: "8px 12px",
                borderRadius: "6px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Quick Summary Informative Bar */}
          <div className="cad-batch-summary-bar">
            <div className="summary-item">
              <span className="summary-label">Файлов:</span>
              <span className="summary-value">{items.length} шт.</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-item">
              <span className="summary-label">Суммарно:</span>
              <span className="summary-value">
                {totalMp > 0 ? `${totalMp.toFixed(1)} МП` : "..."}
              </span>
            </div>
            <div className="summary-divider" />
            <div className="summary-item">
              <span className="summary-label">Общий объем:</span>
              <span className="summary-value">{totalSizeStr}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-item">
              <span className="summary-label">Охват платы:</span>
              <span className="summary-value">
                {totalWidthEst > 15 ? `~${totalWidthEst} мм` : "—"}
              </span>
            </div>
          </div>

          {/* Section Header */}
          <div className="cad-batch-section-header">
            <span className="cad-batch-section-title">Очередь импорта и параметры</span>
            <span className="cad-batch-count-pill">{items.length} фото</span>
          </div>

          {/* File Thumbnail List */}
          <div className="cad-batch-file-list">
            {items.map((item) => (
              <FileThumbnailCard
                key={item.id}
                item={item}
                onMetaLoaded={handleMetaLoaded}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* Quality Grid (2 columns) */}
          <div className="cad-batch-quality-grid">
            <div
              className={`cad-batch-quality-card ${quality === "original" ? "active" : ""}`}
              onClick={() => setQuality("original")}
            >
              <div className="quality-header">
                <div className="quality-icon-badge original">
                  <Zap size={15} />
                </div>
                <span className="quality-pill">1:1 Пиксели</span>
              </div>
              <div>
                <div className="quality-title">Оригинал (без сжатия)</div>
                <div className="quality-desc">
                  Максимальная детализация каждого пикселя для реверс-инжиниринга дорожек и SMD-выводов.
                </div>
              </div>
              <div className="quality-specs">
                <span className="quality-spec-badge">RAM: ~120-400 МБ / файл</span>
                <span className="quality-spec-badge">100% точность</span>
              </div>
              {quality === "original" && (
                <div className="quality-check-mark">
                  <Check size={11} strokeWidth={3} />
                </div>
              )}
            </div>

            <div
              className={`cad-batch-quality-card ${quality === "optimized" ? "active" : ""}`}
              onClick={() => setQuality("optimized")}
            >
              <div className="quality-header">
                <div className="quality-icon-badge optimized">
                  <Cpu size={15} />
                </div>
                <span className="quality-pill">До 4K UHD</span>
              </div>
              <div>
                <div className="quality-title">Оптимизация (до 4K)</div>
                <div className="quality-desc">
                  Масштабирование сканов &gt;4096px для экономии RAM и высокой плавности холста.
                </div>
              </div>
              <div className="quality-specs">
                <span className="quality-spec-badge">RAM: ~25-45 МБ / файл</span>
                <span className="quality-spec-badge">60+ FPS на холсте</span>
              </div>
              {quality === "optimized" && (
                <div className="quality-check-mark">
                  <Check size={11} strokeWidth={3} />
                </div>
              )}
            </div>
          </div>

          {/* Auto Placement Banner */}
          <div className="cad-batch-placement-banner">
            <Layers size={16} className="placement-icon" />
            <div className="placement-text">
              <div>
                <span className="placement-label">Расположение на плате: </span>
                <span className="placement-val">
                  В ряд горизонтально с технологическим зазором 15 мм
                </span>
              </div>
              <div className="placement-seq">
                {items.slice(0, 3).map((it, idx) => (
                  <span key={it.id} className="seq-step">
                    {idx + 1}. {it.name.length > 15 ? it.name.substring(0, 13) + "…" : it.name}
                  </span>
                ))}
                {items.length > 3 && (
                  <span className="seq-step">+{items.length - 3} ещё</span>
                )}
              </div>
            </div>
            <span className="placement-badge">Без наложения</span>
          </div>
        </div>

        {/* Footer */}
        <div className="cad-batch-footer">
          <div className="cad-batch-footer-left">
            Всего к импорту: <strong style={{ color: "#38bdf8" }}>{items.length}</strong> фото (
            {totalMp > 0 ? `~${totalMp.toFixed(0)} МП` : "..."})
          </div>
          <div className="cad-batch-footer-right">
            <button className="cad-btn-secondary" onClick={handleClose} disabled={loading}>
              Отмена
            </button>
            <button
              className="cad-btn-primary"
              onClick={handleImport}
              disabled={loading || items.length === 0}
              style={{ minWidth: "170px" }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Импорт {items.length}...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Импортировать ({items.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
