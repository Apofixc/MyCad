import React from "react";
import {
  PanelLeft,
  PanelRight,
  Save,
  LogOut,
  Layers,
  FileCode,
  Cpu,
} from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

export const TopBar: React.FC = () => {
  const { toggleLeftSidebar, toggleRightSidebar, rightSidebarCollapsed, openModal } = useUiStore();
  const { manifest, isDirty, saveProject, closeProject, activeFileType, selectedImageId, selectedComponentId } = useProjectStore();

  const handleSave = async () => {
    try {
      await saveProject();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="cad-top-bar">
      <div className="cad-top-bar-left">
        <button
          className="cad-top-tool-btn"
          onClick={toggleLeftSidebar}
          title="Скрыть/показать панель проекта (Ctrl+B)"
        >
          <PanelLeft size={16} />
        </button>

        <div className="cad-brand">
          <div className="cad-brand-logo-wrap">
            <Layers size={16} color="#60a5fa" />
          </div>
          <span className="cad-brand-title">MyCad</span>
          <span className="cad-brand-badge">CAD & Inspection</span>
        </div>

        <span className="cad-title-sep">/</span>

        <div className="cad-project-capsule">
          <FileCode size={14} color="#3b82f6" />
          <span className="cad-project-name-text">{manifest?.name || "Без названия"}</span>
          {isDirty && (
            <span className="cad-dirty-pill" title="Есть несохраненные изменения">
              • Не сохранено
            </span>
          )}
        </div>

        {manifest?.description && (
          <span className="cad-project-path" title={manifest.description}>
            {manifest.description}
          </span>
        )}
      </div>

      <div className="cad-top-bar-actions">
        <button
          className="cad-top-tool-btn"
          onClick={() => openModal("componentLibrary")}
          title="Библиотека радиокомпонентов и посадочных мест (корпусов)"
        >
          <Cpu size={16} color="#38bdf8" />
          <span style={{ fontSize: "12px", fontWeight: 600 }}>Библиотека</span>
        </button>

        <button
          className={`cad-top-tool-btn ${isDirty ? "cad-save-needed" : ""}`}
          onClick={handleSave}
          title="Сохранить проект в .mycad (Ctrl+S)"
        >
          <Save size={16} />
          <span style={{ fontSize: "12px", fontWeight: 600 }}>Сохранить</span>
        </button>

        {activeFileType === "board" && (
          <button
            className={`cad-top-tool-btn ${(selectedImageId || selectedComponentId) && !rightSidebarCollapsed ? "active" : ""}`}
            disabled={!selectedImageId && !selectedComponentId}
            onClick={() => {
              if (selectedImageId || selectedComponentId) {
                toggleRightSidebar();
              }
            }}
            title={
              selectedImageId || selectedComponentId
                ? rightSidebarCollapsed
                  ? "Развернуть панель свойств"
                  : "Скрыть панель свойств"
                : "Свойства объекта (выберите скан или компонент на холсте)"
            }
          >
            <PanelRight size={16} />
          </button>
        )}

        <div className="cad-tool-sep" />

        <button
          className="cad-top-tool-btn cad-btn-logout"
          onClick={closeProject}
          title="Закрыть проект и вернуться на стартовую страницу"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
