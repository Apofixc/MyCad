import React, { useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { useErrorStore } from "../../stores/errorStore";

export const ErrorDialog: React.FC = () => {
  const { currentError, clearError } = useErrorStore();
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentError) return null;

  const handleAction = async () => {
    if (currentError.action?.onClick) {
      try {
        await currentError.action.onClick();
      } finally {
        clearError();
      }
    } else {
      clearError();
    }
  };

  const handleCopy = async () => {
    const fullText = `[Ошибка MyCad]\nСообщение: ${currentError.message}\n${
      currentError.suggestion ? `Рекомендация: ${currentError.suggestion}\n` : ""
    }${currentError.details ? `\nПолный стек / детали:\n${currentError.details}` : ""}`;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const hasDetails = Boolean(currentError.details);

  return (
    <div className="cad-modal-backdrop" onClick={clearError}>
      <div
        className="cad-modal-box"
        style={{ maxWidth: "520px", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="cad-modal-header"
          style={{ borderBottom: "1px solid rgba(239, 68, 68, 0.25)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              className="cad-modal-icon-badge"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.35)",
                boxShadow: "0 0 16px rgba(239, 68, 68, 0.25)",
              }}
            >
              <AlertTriangle size={18} color="#f87171" />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "#f87171", fontSize: "15px" }}>
                {currentError.title || "Произошла ошибка"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Системное уведомление MyCad
              </div>
            </div>
          </div>
          <button
            className="cad-modal-close-btn"
            onClick={clearError}
            title="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Main message */}
          <div style={{ fontSize: "14px", lineHeight: 1.5, color: "#f1f5f9", wordBreak: "break-word" }}>
            {currentError.message}
          </div>

          {/* Suggested action */}
          {currentError.suggestion && (
            <div
              style={{
                fontSize: "12.5px",
                lineHeight: 1.45,
                color: "#cbd5e1",
                background: "rgba(59, 130, 246, 0.1)",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(59, 130, 246, 0.25)",
              }}
            >
              <strong style={{ color: "#93c5fd" }}>Что сделать: </strong>
              {currentError.suggestion}
            </div>
          )}

          {/* Full error details toggle */}
          {hasDetails && (
            <div style={{ marginTop: "4px" }}>
              <button
                onClick={() => setShowFullDetails(!showFullDetails)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  color: "#60a5fa",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showFullDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showFullDetails ? "Скрыть полный текст ошибки" : "Показать полный текст ошибки"}</span>
              </button>

              {showFullDetails && (
                <div
                  style={{
                    marginTop: "8px",
                    background: "rgba(0, 0, 0, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    maxHeight: "160px",
                    overflowY: "auto",
                    fontFamily: "var(--cad-font-mono)",
                    fontSize: "11px",
                    color: "#fca5a5",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    textAlign: "left",
                  }}
                >
                  {currentError.details}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(0, 0, 0, 0.25)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "5px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: copied ? "#10b981" : "#94a3b8",
              fontSize: "12px",
              cursor: "pointer",
            }}
            title="Скопировать описание и стек ошибки"
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copied ? "Скопировано" : "Копировать текст"}</span>
          </button>

          <div style={{ display: "flex", gap: "10px" }}>
            {currentError.action ? (
              <>
                <button
                  onClick={clearError}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={handleAction}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "6px",
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.35)",
                  }}
                >
                  {currentError.action.label}
                </button>
              </>
            ) : (
              <button
                onClick={clearError}
                style={{
                  padding: "7px 18px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Понятно
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
