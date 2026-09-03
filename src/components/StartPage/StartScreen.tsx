import React, { useState } from "react";

interface StartScreenProps {
  onCreateProject: (name: string) => void;
  onOpenExistingProject?: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onCreateProject,
  onOpenExistingProject,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("Project_1");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreateProject(projectName.trim());
  };

  return (
    <div className="cad-start-screen">
      <div className="cad-start-container">
        {/* Header */}
        <div className="cad-start-header">
          <div className="cad-brand">
            <svg className="cad-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <path d="M7 2v4M17 2v4M2 7h4M2 17h4M22 7h-4M22 17h-4M7 22v-4M17 22v-4" />
              <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
            </svg>
            <div>
              <h1>MyCad</h1>
              <span className="cad-version">PCB Reverse Engineering & Boardview v0.1.0</span>
            </div>
          </div>
        </div>

        {/* Main Content: Actions & Recent */}
        <div className="cad-start-body">
          {/* Left: Quick Actions */}
          <div className="cad-start-actions">
            <h2>Начало работы</h2>
            <button
              className="cad-btn-primary"
              onClick={() => setShowModal(true)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Создать новый проект</span>
            </button>

            <button
              className="cad-btn-outline"
              onClick={onOpenExistingProject || (() => setShowModal(true))}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7l3-4h12l3 4M3 7h18" />
              </svg>
              <span>Открыть проект...</span>
            </button>
          </div>

          {/* Right: Recent Projects */}
          <div className="cad-start-recent">
            <h2>Недавние проекты</h2>
            <div className="cad-recent-list">
              <div className="cad-recent-item" onClick={() => onCreateProject("2323")}>
                <svg className="recent-file-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div className="recent-meta">
                  <div className="recent-name">2323.mycad</div>
                  <div className="recent-path">C:/Users/mihai/OneDrive/Рабочий стол/MyCad/2323.mycad</div>
                </div>
                <div className="recent-date">Сегодня</div>
              </div>

              <div className="cad-recent-item" onClick={() => onCreateProject("Пиррс_1000_Люкс")}>
                <svg className="recent-file-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <div className="recent-meta">
                  <div className="recent-name">Пиррс_1000_Люкс.mycad</div>
                  <div className="recent-path">C:/Users/mihai/OneDrive/Рабочий стол/Пиррс 1000-Люкс</div>
                </div>
                <div className="recent-date">Вчера</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="cad-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="cad-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cad-dialog-header">
              <h3>Создание нового проекта</h3>
              <button className="cad-dialog-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="cad-dialog-body">
                <label className="cad-label">Имя проекта:</label>
                <input
                  type="text"
                  className="cad-input"
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Например: 2323"
                />
                <p className="cad-hint">В проекте будут автоматически созданы файлы платы (.board) и схемы (.sch).</p>
              </div>
              <div className="cad-dialog-footer">
                <button
                  type="button"
                  className="cad-btn-flat"
                  onClick={() => setShowModal(false)}
                >
                  Отмена
                </button>
                <button type="submit" className="cad-btn-primary">
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
