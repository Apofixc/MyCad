import React, { useState } from "react";
import {
  X,
  Layers,
  Cpu,
  Plus,
  FilePlus2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";

export const NewDocumentModal: React.FC = () => {
  const { modals, closeModal } = useUiStore();
  const { addBoard, addSchematic, boards, schematics } = useProjectStore();

  const [docType, setDocType] = useState<"board" | "schematic">("board");
  const [docName, setDocName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!modals.newDocument) return null;

  const defaultBoardName =
    boards.length === 0 ? "Печатная плата" : `Печатная плата ${boards.length + 1}`;
  const defaultSchematicName =
    schematics.length === 0
      ? "Принципиальная схема"
      : `Принципиальная схема ${schematics.length + 1}`;

  const currentPlaceholder =
    docType === "board" ? defaultBoardName : defaultSchematicName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalName = docName.trim() || currentPlaceholder;
      if (docType === "board") {
        await addBoard(finalName);
      } else {
        await addSchematic(finalName);
      }
      closeModal("newDocument");
      setDocName("");
    } catch (err) {
      console.error("Ошибка создания документа", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="cad-modal-backdrop"
      onClick={() => closeModal("newDocument")}
    >
      <div
        className="cad-modal-box"
        style={{ maxWidth: "540px", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                background: "rgba(59, 130, 246, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60a5fa",
              }}
            >
              <FilePlus2 size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#f8fafc",
                  letterSpacing: "-0.2px",
                }}
              >
                Добавить документ в проект
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  marginTop: "1px",
                }}
              >
                Выберите тип документа и укажите название
              </div>
            </div>
          </div>

          <button
            type="button"
            className="cad-modal-close-btn"
            onClick={() => closeModal("newDocument")}
            title="Закрыть (Esc)"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cad-modal-body" style={{ gap: "20px" }}>
            {/* 1. Document Type Selector Cards */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#94a3b8",
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                  }}
                >
                  Тип документа
                </label>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {docType === "board" ? "1 документ платы" : "1 принципиальная схема"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                {/* Board Card */}
                <div
                  onClick={() => setDocType("board")}
                  style={{
                    position: "relative",
                    padding: "16px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                    border:
                      docType === "board"
                        ? "1.5px solid #3b82f6"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                    background:
                      docType === "board"
                        ? "linear-gradient(145deg, rgba(59, 130, 246, 0.15) 0%, rgba(30, 58, 138, 0.08) 100%)"
                        : "rgba(255, 255, 255, 0.02)",
                    boxShadow:
                      docType === "board"
                        ? "0 0 0 1px rgba(59, 130, 246, 0.3), 0 8px 24px -4px rgba(59, 130, 246, 0.25)"
                        : "none",
                  }}
                >
                  {/* Active Check Indicator */}
                  {docType === "board" && (
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        color: "#60a5fa",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCircle2 size={16} fill="#1d4ed8" color="#93c5fd" />
                    </div>
                  )}

                  {/* Header in Card */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        background:
                          docType === "board"
                            ? "rgba(59, 130, 246, 0.2)"
                            : "rgba(255, 255, 255, 0.05)",
                        border:
                          docType === "board"
                            ? "1px solid rgba(59, 130, 246, 0.4)"
                            : "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: docType === "board" ? "#60a5fa" : "#94a3b8",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <Layers size={20} />
                    </div>

                    <span
                      style={{
                        fontSize: "10.5px",
                        fontFamily: "var(--cad-font-mono)",
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "5px",
                        background:
                          docType === "board"
                            ? "rgba(59, 130, 246, 0.22)"
                            : "rgba(255, 255, 255, 0.06)",
                        color: docType === "board" ? "#93c5fd" : "#64748b",
                        border:
                          docType === "board"
                            ? "1px solid rgba(59, 130, 246, 0.35)"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      .board
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 600,
                        color: docType === "board" ? "#ffffff" : "#e2e8f0",
                        marginBottom: "4px",
                      }}
                    >
                      Печатная плата
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        lineHeight: 1.45,
                      }}
                    >
                      Печатная плата, сканы Top/Bottom, калибровка и совмещение слоёв
                    </div>
                  </div>
                </div>

                {/* Schematic Card */}
                <div
                  onClick={() => setDocType("schematic")}
                  style={{
                    position: "relative",
                    padding: "16px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
                    border:
                      docType === "schematic"
                        ? "1.5px solid #06b6d4"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                    background:
                      docType === "schematic"
                        ? "linear-gradient(145deg, rgba(6, 182, 212, 0.15) 0%, rgba(14, 116, 144, 0.08) 100%)"
                        : "rgba(255, 255, 255, 0.02)",
                    boxShadow:
                      docType === "schematic"
                        ? "0 0 0 1px rgba(6, 182, 212, 0.3), 0 8px 24px -4px rgba(6, 182, 212, 0.25)"
                        : "none",
                  }}
                >
                  {/* Active Check Indicator */}
                  {docType === "schematic" && (
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        color: "#22d3ee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCircle2 size={16} fill="#0e7490" color="#a5f3fc" />
                    </div>
                  )}

                  {/* Header in Card */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        background:
                          docType === "schematic"
                            ? "rgba(6, 182, 212, 0.2)"
                            : "rgba(255, 255, 255, 0.05)",
                        border:
                          docType === "schematic"
                            ? "1px solid rgba(6, 182, 212, 0.4)"
                            : "1px solid rgba(255, 255, 255, 0.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: docType === "schematic" ? "#22d3ee" : "#94a3b8",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <Cpu size={20} />
                    </div>

                    <span
                      style={{
                        fontSize: "10.5px",
                        fontFamily: "var(--cad-font-mono)",
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "5px",
                        background:
                          docType === "schematic"
                            ? "rgba(6, 182, 212, 0.22)"
                            : "rgba(255, 255, 255, 0.06)",
                        color: docType === "schematic" ? "#a5f3fc" : "#64748b",
                        border:
                          docType === "schematic"
                            ? "1px solid rgba(6, 182, 212, 0.35)"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      .schematic
                    </span>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 600,
                        color: docType === "schematic" ? "#ffffff" : "#e2e8f0",
                        marginBottom: "4px",
                      }}
                    >
                      Принципиальная схема
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        lineHeight: 1.45,
                      }}
                    >
                      Электрическая схема, УГО компонентов и проводные цепи (nets)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Document Name Input */}
            <div className="cad-input-field">
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                }}
              >
                Название документа
              </label>

              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "12px",
                    display: "flex",
                    alignItems: "center",
                    pointerEvents: "none",
                    color: "#64748b",
                  }}
                >
                  <FileText size={16} />
                </div>

                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder={currentPlaceholder}
                  style={{
                    width: "100%",
                    paddingLeft: "38px",
                    paddingRight: docName ? "36px" : "14px",
                    height: "42px",
                    fontSize: "13.5px",
                  }}
                  autoFocus
                />

                {docName && (
                  <button
                    type="button"
                    onClick={() => setDocName("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                    title="Очистить"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11.5px",
                  color: "#64748b",
                  marginTop: "2px",
                }}
              >
                <span>Если оставить пустым, будет использовано:</span>
                <span
                  style={{
                    color: docType === "board" ? "#93c5fd" : "#a5f3fc",
                    fontWeight: 500,
                    background:
                      docType === "board"
                        ? "rgba(59, 130, 246, 0.1)"
                        : "rgba(6, 182, 212, 0.1)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    border:
                      docType === "board"
                        ? "1px solid rgba(59, 130, 246, 0.2)"
                        : "1px solid rgba(6, 182, 212, 0.2)",
                  }}
                >
                  {currentPlaceholder}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="cad-modal-footer">
            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              onClick={() => closeModal("newDocument")}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="cad-btn cad-btn-primary"
              disabled={loading}
              style={{ minWidth: "160px" }}
            >
              <Plus size={16} />
              <span>{loading ? "Создание..." : "Создать документ"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
