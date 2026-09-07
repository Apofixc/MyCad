import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useErrorStore, AppError } from "../../stores/errorStore";
import "./ToastContainer.css";

const ToastItem: React.FC<{ toast: AppError }> = ({ toast }) => {
  const { dismissToast, openLogModal } = useErrorStore();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const duration = toast.duration ?? 5000;
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  // Плавный таймер автоскрытия с поддержкой паузы при наведении курсора
  useEffect(() => {
    if (duration <= 0) return;

    let animationFrameId: number;
    let lastTick = Date.now();

    const tick = () => {
      if (!isPaused) {
        const now = Date.now();
        const delta = now - lastTick;
        lastTick = now;

        remainingTimeRef.current -= delta;
        const pct = Math.max(0, (remainingTimeRef.current / duration) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          handleClose();
          return;
        }
      } else {
        lastTick = Date.now();
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [duration, isPaused]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      dismissToast(toast.id);
    }, 200);
  };

  const handleCopyDetails = async () => {
    const text = `[MyCad ${toast.level.toUpperCase()} | Source: ${toast.source}]\n${toast.message}${
      toast.details ? `\n\nDetails:\n${toast.details}` : ""
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const renderIcon = () => {
    switch (toast.level) {
      case "error":
        return <AlertCircle size={18} color="#ef4444" className="cad-toast-icon" />;
      case "warning":
        return <AlertTriangle size={18} color="#f59e0b" className="cad-toast-icon" />;
      case "info":
        return <Info size={18} color="#3b82f6" className="cad-toast-icon" />;
      case "success":
        return <CheckCircle2 size={18} color="#10b981" className="cad-toast-icon" />;
    }
  };

  const levelLabel = {
    error: "Ошибка",
    warning: "Предупреждение",
    info: "Инфо",
    success: "Успешно",
  }[toast.level];

  return (
    <div
      className={`cad-toast-item level-${toast.level} ${isExiting ? "cad-toast-exit" : ""}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="cad-toast-header">
        {renderIcon()}

        <div className="cad-toast-content">
          <div className="cad-toast-title-row">
            <span className={`cad-toast-badge level-${toast.level}`}>{levelLabel}</span>
            <span className="cad-toast-time">
              {new Date(toast.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          <div className="cad-toast-msg">{toast.message}</div>

          <div className="cad-toast-actions">
            {toast.details && (
              <button
                className="cad-toast-btn-link"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? "Скрыть детали" : "Подробнее"}
              </button>
            )}

            <button
              className="cad-toast-btn-link"
              style={{ display: "flex", alignItems: "center", gap: "3px" }}
              onClick={openLogModal}
            >
              <span>Журнал</span>
              <ExternalLink size={10} />
            </button>
          </div>
        </div>

        <button className="cad-toast-close-btn" onClick={handleClose} title="Закрыть уведомление">
          <X size={14} />
        </button>
      </div>

      {showDetails && toast.details && (
        <div className="cad-toast-details-box">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
            <button
              onClick={handleCopyDetails}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "10.5px",
                color: copied ? "#10b981" : "#93c5fd",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          {toast.details}
        </div>
      )}

      {duration > 0 && (
        <div className="cad-toast-progress-track">
          <div
            className={`cad-toast-progress-bar level-${toast.level}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const activeToasts = useErrorStore((state) => state.activeToasts);

  if (activeToasts.length === 0) return null;

  return (
    <div className="cad-toast-container" aria-live="polite">
      {activeToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
