import React from "react";
import { FolderPlus, Layers, Cpu, FileText } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";

export const EmptyWorkspace: React.FC = () => {
  const { manifest, addBoard, addSchematic } = useProjectStore();

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cad-bg-darker, #0b0f19)",
        color: "var(--cad-text-main, #f8fafc)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          background: "rgba(17, 24, 39, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))",
            border: "1px solid rgba(96, 165, 250, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px auto",
          }}
        >
          <FolderPlus size={32} color="#60a5fa" />
        </div>

        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0" }}>
          {manifest?.name || "Проект пуст"}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--cad-text-muted, #94a3b8)", margin: "0 0 28px 0", lineHeight: "1.5" }}>
          В проекте пока нет открытых документов. Вы можете добавить схему платы для работы со сканами или принципиальную электрическую схему.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              transition: "all 0.2s",
            }}
            onClick={() => addBoard()}
          >
            <Layers size={18} />
            <span>Добавить схему платы (Board)</span>
          </button>

          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              color: "#f1f5f9",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => addSchematic()}
          >
            <Cpu size={18} color="#38bdf8" />
            <span>Добавить принципиальную схему (Schematic)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
