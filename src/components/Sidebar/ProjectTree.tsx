import React from "react";
import { Project, ProjectFile } from "../../types/project";

interface ProjectTreeProps {
  project: Project;
  onSelectFile: (fileId: string) => void;
  onAddBoard: () => void;
  onCloseProject: () => void;
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  project,
  onSelectFile,
  onAddBoard,
  onCloseProject,
}) => {
  return (
    <aside className="kicad-tree-panel">
      <div className="kicad-tree-header">
        <span className="kicad-tree-title">Файлы проекта</span>
        <div className="kicad-header-actions">
          <button
            className="kicad-icon-btn"
            onClick={onAddBoard}
            title="Добавить плату (.board)"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2v12M2 8h12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="kicad-tree-content">
        {/* Project root node */}
        <div className="kicad-tree-item root-item">
          <svg className="kicad-folder-icon" viewBox="0 0 16 16" width="15" height="15" fill="#38bdf8">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.293a1 1 0 0 1 .707.293L7.707 3.5H13.5A1.5 1.5 0 0 1 15 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
          </svg>
          <span className="item-label">{project.name}.mycad</span>
        </div>

        {/* Tree children */}
        <div className="kicad-children-group">
          {project.files.map((file: ProjectFile) => {
            const isActive = project.activeFileId === file.id;
            const isBoard = file.type === "board";

            return (
              <div
                key={file.id}
                className={`kicad-tree-item file-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectFile(file.id)}
              >
                {/* Genuine KiCad-style vector icons */}
                {isBoard ? (
                  <svg className="doc-icon board-icon" viewBox="0 0 16 16" width="15" height="15">
                    <rect width="16" height="16" rx="2" fill="#15803d" />
                    <circle cx="4" cy="4" r="1.5" fill="#facc15" />
                    <circle cx="12" cy="4" r="1.5" fill="#facc15" />
                    <circle cx="8" cy="12" r="1.5" fill="#facc15" />
                    <path d="M4 4h4v8M12 4h-4" fill="none" stroke="#86efac" strokeWidth="1.2" />
                  </svg>
                ) : (
                  <svg className="doc-icon sch-icon" viewBox="0 0 16 16" width="15" height="15">
                    <rect width="16" height="16" rx="2" fill="#b45309" />
                    <path d="M2 8h3l2-4 2 8 2-4h3" fill="none" stroke="#fef08a" strokeWidth="1.4" />
                  </svg>
                )}

                <span className="item-label">{file.name}</span>
                {isActive && <div className="kicad-active-marker" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="kicad-tree-footer">
        <button className="kicad-btn-subtle" onClick={onCloseProject}>
          Закрыть проект
        </button>
      </div>
    </aside>
  );
};
