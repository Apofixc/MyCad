import React, { useState } from "react";
import {
  Cpu,
  Plus,
  FolderOpen,
  FileCode,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";

interface StartScreenProps {
  onCreateProject: (name: string, description?: string, author?: string) => void;
  onOpenExistingProject?: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onCreateProject,
  onOpenExistingProject,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("Project_1");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");

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
              onClick={onOpenExistingProject || (() => setShowModal(true))}
            >
              <div className="btn-icon-box">
                <FolderOpen size={18} />
              </div>
              <div className="btn-text-content">
                <span className="btn-title">Открыть проект...</span>
                <span className="btn-sub">Файлы .mycad или .board</span>
              </div>
            </button>
          </div>

          {/* Right: Recent Projects */}
          <div className="cad-start-recent">
            <div className="cad-section-label">Недавние проекты</div>

            <div className="cad-recent-list">
              <div
                className="cad-recent-item"
                onClick={() => onCreateProject("2323")}
                role="button"
                tabIndex={0}
              >
                <div className="recent-file-icon-box">
                  <FileCode size={20} />
                </div>
                <div className="recent-meta">
                  <div className="recent-name">2323.mycad</div>
                  <div className="recent-path">C:/Users/mihai/OneDrive/Рабочий стол/MyCad/2323.mycad</div>
                </div>
                <div className="recent-meta-right">
                  <span className="recent-date">
                    <Clock size={12} /> Сегодня
                  </span>
                  <ChevronRight size={14} className="recent-arrow" />
                </div>
              </div>

              <div
                className="cad-recent-item"
                onClick={() => onCreateProject("Пиррс_1000_Люкс")}
                role="button"
                tabIndex={0}
              >
                <div className="recent-file-icon-box">
                  <FileCode size={20} />
                </div>
                <div className="recent-meta">
                  <div className="recent-name">Пиррс_1000_Люкс.mycad</div>
                  <div className="recent-path">C:/Users/mihai/OneDrive/Рабочий стол/Пиррс 1000-Люкс</div>
                </div>
                <div className="recent-meta-right">
                  <span className="recent-date">
                    <Clock size={12} /> Вчера
                  </span>
                  <ChevronRight size={14} className="recent-arrow" />
                </div>
              </div>
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
