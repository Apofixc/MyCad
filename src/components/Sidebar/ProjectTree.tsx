import React, { useState, useRef, useEffect } from "react";
import { Project, ProjectFile } from "../../types/project";
import { Save, Download, Plus, LogOut } from "lucide-react";

interface ProjectTreeProps {
  project: Project;
  isDirty?: boolean;
  onSelectFile: (fileId: string) => void;
  onOpenNewFileDialog: () => void;
  onDeleteFile: (fileId: string) => void;
  onSaveProject?: () => void;
  onSaveProjectAs?: () => void;
  onCloseProject?: () => void;
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  project,
  isDirty,
  onSelectFile,
  onOpenNewFileDialog,
  onDeleteFile,
  onSaveProject,
  onSaveProjectAs,
  onCloseProject,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие контекстного меню при клике в любое место или Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <aside className="kicad-tree-panel">
      {/* Чистый заголовок панели: только основные инструменты */}
      <div className="kicad-tree-header">
        <span className="kicad-tree-title">Проект</span>
        <div className="kicad-header-actions">
          {/* 1. Создать файл */}
          <button
            className="kicad-icon-btn"
            onClick={onOpenNewFileDialog}
            title="Добавить файл в проект (+)"
          >
            <Plus size={14} />
          </button>

          {/* 2. Быстрое сохранение */}
          {onSaveProject && (
            <button
              className={`kicad-icon-btn ${isDirty ? "kicad-btn-save-dirty" : ""}`}
              onClick={onSaveProject}
              title={isDirty ? "Сохранить проект (Ctrl+S) *" : "Проект сохранён (Ctrl+S)"}
            >
              <Save size={14} />
              {isDirty && <span className="kicad-save-badge" />}
            </button>
          )}
        </div>
      </div>

      <div className="kicad-tree-content">
        {/* Project root node: правый клик открывает контекстное меню */}
        <div
          className="kicad-tree-item root-item"
          onContextMenu={handleRootContextMenu}
          title="Правый клик: действия с проектом (Сохранить, Закрыть)"
        >
          <svg className="kicad-folder-icon" viewBox="0 0 16 16" width="15" height="15" fill="#38bdf8">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.293a1 1 0 0 1 .707.293L7.707 3.5H13.5A1.5 1.5 0 0 1 15 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
          </svg>
          <span className="item-label" title={project.filePath || `${project.name}.mycad`}>
            {project.name}.mycad
          </span>
          {isDirty && (
            <span className="kicad-root-dirty-marker" title="Есть несохранённые изменения">
              *
            </span>
          )}
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

                <span className="item-label" title={file.name}>{file.name}</span>

                <button
                  className="kicad-item-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(file.id);
                  }}
                  title={`Удалить ${file.name}`}
                >
                  ×
                </button>

                {isActive && <div className="kicad-active-marker" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Нативное контекстное меню CAD по правому клику */}
      {contextMenu && (
        <div
          className="cad-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          ref={menuRef}
        >
          <button
            className="cad-context-item"
            onClick={() => {
              setContextMenu(null);
              onOpenNewFileDialog();
            }}
          >
            <Plus size={14} />
            <span>Добавить файл...</span>
          </button>

          {onSaveProject && (
            <button
              className="cad-context-item"
              onClick={() => {
                setContextMenu(null);
                onSaveProject();
              }}
            >
              <Save size={14} />
              <span>Сохранить</span>
              <span className="context-shortcut">Ctrl+S</span>
            </button>
          )}

          {onSaveProjectAs && (
            <button
              className="cad-context-item"
              onClick={() => {
                setContextMenu(null);
                onSaveProjectAs();
              }}
            >
              <Download size={14} />
              <span>Сохранить как...</span>
              <span className="context-shortcut">Ctrl+Shift+S</span>
            </button>
          )}

          <div className="cad-context-separator" />

          {onCloseProject && (
            <button
              className="cad-context-item item-danger"
              onClick={() => {
                setContextMenu(null);
                onCloseProject();
              }}
            >
              <LogOut size={14} />
              <span>Закрыть проект</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
