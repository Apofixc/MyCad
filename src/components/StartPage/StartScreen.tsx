import React, { useState, useEffect } from "react";
import {
  Cpu,
  Plus,
  FolderOpen,
  FileCode,
  Clock,
  X,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  RecentProjectItem,
  getRecentProjects,
  removeRecentProject,
  formatRelativeDate,
} from "../../utils/recentProjects";

interface StartScreenProps {
  onCreateProject: (name: string, description?: string, author?: string) => void;
  onOpenProject: () => void;
  onOpenRecent: (path: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onCreateProject,
  onOpenProject,
  onOpenRecent,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("Project_1");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>([]);

  // Загружаем актуальный список недавних проектов
  useEffect(() => {
    setRecentProjects(getRecentProjects());
  }, []);

  const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeRecentProject(path);
    setRecentProjects(getRecentProjects());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreateProject(
      projectName.trim(),
      description.trim() || undefined,
      author.trim() || undefined
    );
  };

  return (
    <div className="cad-start-screen">
      {/* Dynamic Background Matrix / Circuit Grid */}
      <div className="cad-start-bg-grid" />
      <div className="cad-start-glow" />

      <div className="cad-start-container">
        {/* Header with Logo & System Status */}
        <div className="cad-start-header">
          <div className="cad-brand">
            <div className="cad-logo-wrapper">
              <Cpu className="cad-logo-icon" size={26} />
              <span className="cad-logo-pulse" />
            </div>
            <div className="cad-brand-text">
              <div className="cad-title-row">
                <h1>MyCad</h1>
                <span className="cad-badge">CAD System</span>
              </div>
              <p className="cad-version">PCB Reverse Engineering & Boardview v0.1.0</p>
            </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="cad-start-body">
          {/* Left: Actions */}
          <div className="cad-start-actions">
            <div className="cad-section-label">Начало работы</div>

            <button
              className="cad-btn-primary cad-start-btn"
              onClick={() => setShowModal(true)}
            >
              <div className="btn-icon-box">
                <Plus size={18} />
              </div>
              <div className="btn-text-content">
                <span className="btn-title">Создать новый проект</span>
                <span className="btn-sub">Монтажная плата и схема</span>
              </div>
            </button>

            <button
              className="cad-btn-outline cad-start-btn"
              onClick={onOpenProject}
            >
              <div className="btn-icon-box">
                <FolderOpen size={18} />
              </div>
              <div className="btn-text-content">
                <span className="btn-title">Открыть проект...</span>
                <span className="btn-sub">Контейнер .mycad или .json</span>
              </div>
            </button>
          </div>

          {/* Right: Recent Projects */}
          <div className="cad-start-recent">
            <div className="cad-section-label-row">
              <div className="cad-section-label">Недавние проекты</div>
              {recentProjects.length > 0 && (
                <span className="cad-recent-count">{recentProjects.length}</span>
              )}
            </div>

            <div className="cad-recent-list">
              {recentProjects.length > 0 ? (
                recentProjects.map((item) => (
                  <div
                    key={item.path}
                    className="cad-recent-item"
                    onClick={() => onOpenRecent(item.path)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="recent-file-icon-box">
                      <FileCode size={20} />
                    </div>
                    <div className="recent-meta">
                      <div className="recent-name-row">
                        <span className="recent-name">{item.name}.mycad</span>
                        {item.componentCount !== undefined && item.componentCount > 0 && (
                          <span className="recent-badge">
                            {item.componentCount} комп.
                          </span>
                        )}
                      </div>
                      <div className="recent-path" title={item.path}>
                        {item.path}
                      </div>
                    </div>
                    <div className="recent-meta-right">
                      <span className="recent-date" title={new Date(item.lastOpened).toLocaleString()}>
                        <Clock size={12} /> {formatRelativeDate(item.lastOpened)}
                      </span>
                      <button
                        className="recent-delete-btn"
                        onClick={(e) => handleRemoveRecent(e, item.path)}
                        title="Удалить из списка недавних"
                      >
                        <X size={14} />
                      </button>
                      <ChevronRight size={14} className="recent-arrow" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="cad-recent-empty">
                  <div className="empty-icon-wrap">
                    <Layers size={32} />
                  </div>
                  <p className="empty-title">Список недавних проектов пуст</p>
                  <p className="empty-sub">
                    Создайте новый проект или откройте существующий файл с диска
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog for New Project */}
      {showModal && (
        <div className="cad-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="cad-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cad-dialog-header">
              <div className="dialog-title-wrap">
                <Plus size={16} className="dialog-title-icon" />
                <h3>Создание нового проекта</h3>
              </div>
              <button
                className="cad-dialog-close"
                onClick={() => setShowModal(false)}
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="cad-dialog-body">
                <div className="cad-form-group">
                  <label className="cad-label" htmlFor="cad-project-name-input">
                    Имя проекта <span className="cad-required">*</span>
                  </label>
                  <input
                    id="cad-project-name-input"
                    type="text"
                    className="cad-input"
                    autoFocus
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Например: 2323"
                  />
                </div>

                <div className="cad-form-group">
                  <label className="cad-label" htmlFor="cad-project-author-input">
                    Автор / Инженер:
                  </label>
                  <input
                    id="cad-project-author-input"
                    type="text"
                    className="cad-input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Например: Иванов А. В."
                  />
                </div>

                <div className="cad-form-group">
                  <label className="cad-label" htmlFor="cad-project-desc-input">
                    Описание проекта:
                  </label>
                  <textarea
                    id="cad-project-desc-input"
                    className="cad-input cad-textarea"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Назначение платы, ревизия, ключевые характеристики..."
                  />
                </div>
              </div>

              <div className="cad-dialog-footer">
                <button
                  type="button"
                  className="cad-btn-flat"
                  onClick={() => setShowModal(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="cad-btn-primary" disabled={!projectName.trim()}>
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
