import React from "react";
import {
  PanelLeft,
  Save,
  LogOut,
} from "lucide-react";
import { useUiStore } from "../stores/uiStore";
import { useProjectStore } from "../stores/projectStore";

export const TopBar: React.FC = () => {
  const { toggleLeftSidebar } = useUiStore();
  const { manifest, isDirty, saveProject, closeProject } = useProjectStore();

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
          className="cad-tool-btn"
          onClick={toggleLeftSidebar}
          title="Скрыть/показать панель проекта (Ctrl+B)"
        >
          <PanelLeft size={16} />
        </button>

        <div className="cad-brand">
          <span>MyCad</span>
          <span className="cad-brand-badge">Image Align & Inspection</span>
        </div>

        <span className="cad-title-sep">/</span>

        <div className="cad-project-name">
          <span>{manifest?.name || "Без названия"}</span>
          {isDirty && <span className="cad-dirty-star" title="Есть несохраненные изменения">*</span>}
        </div>

        {manifest?.description && (
          <span className="cad-project-path">
            • {manifest.description}
          </span>
        )}
      </div>

      <div className="cad-top-bar-actions">
        <button
          className="cad-tool-btn"
          onClick={handleSave}
          title="Сохранить проект в .mycad (Ctrl+S)"
          style={{ color: isDirty ? "#60a5fa" : undefined }}
        >
          <Save size={16} />
        </button>

        <div className="cad-tool-sep" />

        <button
          className="cad-tool-btn"
          onClick={closeProject}
          title="Закрыть проект"
          style={{ color: "#ef4444" }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
