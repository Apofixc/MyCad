import React from "react";
import { FolderPlus, Layers, Cpu, Plus, FileCode } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const EmptyWorkspace: React.FC = () => {
  const { manifest, addBoard, addSchematic } = useProjectStore();
  const { openModal } = useUiStore();

  return (
    <div className="cad-empty-workspace-container">
      <div className="cad-start-bg-grid" />

      <div className="cad-empty-workspace-content">
        <div className="cad-start-card cad-empty-card">
          <div className="cad-start-hero" style={{ gap: "10px" }}>
            <div className="cad-start-logo-wrap">
              <FolderPlus size={32} color="#60a5fa" />
            </div>
            <h2 className="cad-start-title" style={{ fontSize: "20px" }}>
              {manifest?.name || "Проект пуст"}
            </h2>
            <p className="cad-start-subtitle" style={{ maxWidth: "420px", textAlign: "center" }}>
              В проекте пока нет открытых документов. Вы можете добавить печатную плату для работы со сканами слоёв или принципиальную схему.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", marginTop: "10px" }}>
            <button
              className="cad-start-action-btn primary"
              onClick={() => addBoard()}
            >
              <Layers size={22} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>Добавить плату (Board)</div>
                <div style={{ fontSize: "11px", opacity: 0.85 }}>Схема монтажной платы, сканы Top / Bottom</div>
              </div>
            </button>

            <button
              className="cad-start-action-btn"
              onClick={() => addSchematic()}
            >
              <Cpu size={20} color="#38bdf8" />
              <div>
                <div style={{ fontWeight: 500, fontSize: "13px" }}>Добавить принципиальную схему</div>
                <div style={{ fontSize: "11px", color: "var(--cad-text-dim)" }}>Электрическая схема соединений (Schematic)</div>
              </div>
            </button>

            <button
              className="cad-start-action-btn"
              onClick={() => openModal("newDocument")}
            >
              <Plus size={20} color="#94a3b8" />
              <div>
                <div style={{ fontWeight: 500, fontSize: "13px" }}>Настроить новый документ...</div>
                <div style={{ fontSize: "11px", color: "var(--cad-text-dim)" }}>Задать собственное имя и параметры</div>
              </div>
            </button>
          </div>
        </div>

        {/* Keyboard hints bar */}
        <div className="cad-hints-pill">
          <span><strong>Ctrl+B</strong> Боковая панель</span>
          <span>•</span>
          <span><strong>Ctrl+S</strong> Сохранить проект</span>
          <span>•</span>
          <span><strong>Колесо мыши</strong> Зум в курсор</span>
          <span>•</span>
          <span><strong>Пробел + ЛКМ</strong> Панорама</span>
        </div>
      </div>
    </div>
  );
};

