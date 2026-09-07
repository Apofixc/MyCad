import React, { useState, useMemo } from "react";
import {
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";
import { useErrorStore, AppError, ErrorLevel } from "../../stores/errorStore";
import { generateDiagnosticReport } from "../../utils/errorHandler";
import "./ErrorLogModal.css";

export const ErrorLogModal: React.FC = () => {
  const { errors, isLogModalOpen, closeLogModal, clearErrors, removeError } = useErrorStore();
  const [filterLevel, setFilterLevel] = useState<"all" | ErrorLevel>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredErrors = useMemo(() => {
    return errors.filter((item) => {
      if (filterLevel !== "all" && item.level !== filterLevel) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msgMatch = item.message.toLowerCase().includes(q);
        const detailsMatch = item.details?.toLowerCase().includes(q) ?? false;
        const sourceMatch = item.source.toLowerCase().includes(q);
        return msgMatch || detailsMatch || sourceMatch;
      }
      return true;
    });
  }, [errors, filterLevel, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: errors.length,
      error: errors.filter((e) => e.level === "error").length,
      warning: errors.filter((e) => e.level === "warning").length,
      info: errors.filter((e) => e.level === "info").length,
    };
  }, [errors]);

  if (!isLogModalOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyReport = async () => {
    const report = generateDiagnosticReport(errors);
    try {
      await navigator.clipboard.writeText(report);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopySingle = async (item: AppError) => {
    const text = `[MyCad ${item.level.toUpperCase()} | Source: ${item.source} | ${new Date(
      item.timestamp
    ).toLocaleTimeString()}]\nMessage: ${item.message}${
      item.details ? `\nDetails:\n${item.details}` : ""
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const renderIcon = (level: ErrorLevel) => {
    switch (level) {
      case "error":
        return <AlertCircle size={15} color="#ef4444" />;
      case "warning":
        return <AlertTriangle size={15} color="#f59e0b" />;
      case "info":
        return <Info size={15} color="#3b82f6" />;
      case "success":
        return <CheckCircle2 size={15} color="#10b981" />;
    }
  };

  return (
    <div className="cad-modal-backdrop" onClick={closeLogModal}>
      <div className="cad-modal-box cad-error-log-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} color="#38bdf8" />
            <span>Журнал ошибок и системных событий</span>
          </div>
          <button
            style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
            onClick={closeLogModal}
            title="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="cad-error-log-toolbar">
          <div className="cad-error-filter-tabs">
            <button
              className={`cad-error-filter-btn ${filterLevel === "all" ? "active" : ""}`}
              onClick={() => setFilterLevel("all")}
            >
              Все ({counts.all})
            </button>
            <button
              className={`cad-error-filter-btn ${filterLevel === "error" ? "active" : ""}`}
              onClick={() => setFilterLevel("error")}
            >
              <AlertCircle size={12} color={filterLevel === "error" ? "#fff" : "#ef4444"} />
              Ошибки ({counts.error})
            </button>
            <button
              className={`cad-error-filter-btn ${filterLevel === "warning" ? "active" : ""}`}
              onClick={() => setFilterLevel("warning")}
            >
              <AlertTriangle size={12} color={filterLevel === "warning" ? "#fff" : "#f59e0b"} />
              Предупреждения ({counts.warning})
            </button>
            <button
              className={`cad-error-filter-btn ${filterLevel === "info" ? "active" : ""}`}
              onClick={() => setFilterLevel("info")}
            >
              Инфо ({counts.info})
            </button>
          </div>

          <div className="cad-error-search-box">
            <Search size={13} color="var(--cad-text-dim)" />
            <input
              type="text"
              placeholder="Поиск по тексту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="cad-error-toolbar-actions">
            <button className="cad-error-tool-btn" onClick={handleCopyReport}>
              {copiedAll ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copiedAll ? "Отчет скопирован!" : "Скопировать отчет"}</span>
            </button>

            {errors.length > 0 && (
              <button className="cad-error-tool-btn danger" onClick={clearErrors} title="Очистить журнал">
                <Trash2 size={13} />
                <span>Очистить</span>
              </button>
            )}
          </div>
        </div>

        {/* Body list */}
        <div className="cad-error-list">
          {filteredErrors.length === 0 ? (
            <div className="cad-error-empty-state">
              <CheckCircle2 size={42} color="#10b981" style={{ opacity: 0.8, marginBottom: "12px" }} />
              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", margin: "0 0 6px 0" }}>
                {errors.length === 0 ? "Ошибок не зафиксировано" : "Нет записей по данному фильтру"}
              </h4>
              <p style={{ fontSize: "12px", color: "var(--cad-text-dim)", maxWidth: "380px" }}>
                {errors.length === 0
                  ? "В ходе текущей сессии все подсистемы и интерфейс работают штатно."
                  : "Попробуйте изменить параметры поиска или переключить уровень фильтрации."}
              </p>
            </div>
          ) : (
            filteredErrors.map((item) => {
              const isExpanded = expandedIds[item.id] ?? false;
              const hasDetails = Boolean(item.details);

              return (
                <div key={item.id} className={`cad-error-card level-${item.level}`}>
                  <div className="cad-error-card-header">
                    <div className="cad-error-card-meta">
                      {renderIcon(item.level)}
                      <span className={`cad-toast-badge level-${item.level}`}>
                        {item.level.toUpperCase()}
                      </span>
                      <span className="cad-error-source-badge">src: {item.source}</span>
                      <span className="cad-error-card-time">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        className="cad-toast-close-btn"
                        onClick={() => handleCopySingle(item)}
                        title="Скопировать эту запись"
                      >
                        {copiedId === item.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      </button>
                      <button
                        className="cad-toast-close-btn"
                        onClick={() => removeError(item.id)}
                        title="Удалить запись"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="cad-error-card-message">{item.message}</div>

                  {hasDetails && (
                    <>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11.5px",
                          color: "#60a5fa",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          alignSelf: "flex-start",
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{isExpanded ? "Скрыть подробности" : "Показать стек и подробности"}</span>
                      </button>

                      {isExpanded && (
                        <div className="cad-error-card-details">
                          {item.details}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="cad-error-footer">
          <div>
            Записей в журнале: <strong>{errors.length}</strong> (Ошибок:{" "}
            <span style={{ color: counts.error > 0 ? "#ef4444" : "inherit", fontWeight: counts.error > 0 ? 600 : "normal" }}>
              {counts.error}
            </span>
            , Предупреждений: <span>{counts.warning}</span>)
          </div>

          <button
            onClick={closeLogModal}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#e2e8f0",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
