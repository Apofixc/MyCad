import React, { useState } from "react";
import { Project, BoardData, SchematicData, ProjectFile } from "./types/project";
import { StartScreen } from "./components/StartPage/StartScreen";
import { ProjectTree } from "./components/Sidebar/ProjectTree";
import { BoardCanvas } from "./components/Viewport/BoardCanvas";
import { InspectorSidebar } from "./components/Sidebar/InspectorSidebar";
import { NewFileDialog, ProjectFileType } from "./components/Modals/NewFileDialog";
import "./App.css";

export const App: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);

  // Create a new empty project (files are added manually by the user)
  const handleCreateProject = (name: string, description?: string, author?: string) => {
    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name,
      description,
      author,
      createdAt: new Date().toISOString(),
      files: [],
      activeFileId: "",
    };

    setProject(newProj);
  };

  // Create a new file manually (.board or .sch) with custom name
  const handleCreateFile = (type: ProjectFileType, fileName: string) => {
    if (!project) return;
    const fileId = `file_${type}_${Date.now()}`;
    let newFile: ProjectFile;

    if (type === "board") {
      const newBoard: BoardData = {
        id: fileId,
        name: fileName,
        bgOpacity: 0.8,
        bgScale: 1,
        bgOffsetX: 0,
        bgOffsetY: 0,
        components: [],
      };
      newFile = { id: fileId, name: fileName, type: "board", data: newBoard };
    } else {
      const newSch: SchematicData = {
        id: fileId,
        name: fileName,
        notes: `Принципиальная схема документа ${fileName}`,
      };
      newFile = { id: fileId, name: fileName, type: "sch", data: newSch };
    }

    setProject({
      ...project,
      files: [...project.files, newFile],
      activeFileId: fileId,
    });
  };

  // Delete/close file from project
  const handleDeleteFile = (fileId: string) => {
    if (!project) return;
    const remainingFiles = project.files.filter((f) => f.id !== fileId);
    let nextActiveId = project.activeFileId;
    if (project.activeFileId === fileId) {
      nextActiveId = remainingFiles.length > 0 ? remainingFiles[0].id : "";
    }
    setProject({
      ...project,
      files: remainingFiles,
      activeFileId: nextActiveId,
    });
  };

  // Switch active document file
  const handleSelectFile = (fileId: string) => {
    if (!project) return;
    setProject({ ...project, activeFileId: fileId });
  };

  // Update board data of active file
  const handleUpdateActiveBoardData = (updated: BoardData) => {
    if (!project) return;
    const updatedFiles = project.files.map((f) =>
      f.id === project.activeFileId ? { ...f, data: updated } : f
    );
    setProject({ ...project, files: updatedFiles });
  };

  // Selection handlers
  const handleSelectComponent = (compId: string | undefined) => {
    if (!project) return;
    const activeFile = project.files.find((f) => f.id === project.activeFileId);
    if (!activeFile || activeFile.type !== "board") return;

    const board = activeFile.data as BoardData;
    handleUpdateActiveBoardData({
      ...board,
      selectedComponentId: compId,
      selectedPinId: compId ? board.selectedPinId : undefined,
    });
  };

  const handleSelectPin = (compId: string, pinId: string) => {
    if (!project) return;
    const activeFile = project.files.find((f) => f.id === project.activeFileId);
    if (!activeFile || activeFile.type !== "board") return;

    const board = activeFile.data as BoardData;
    handleUpdateActiveBoardData({
      ...board,
      selectedComponentId: compId,
      selectedPinId: pinId,
    });
  };

  if (!project) {
    return <StartScreen onCreateProject={handleCreateProject} />;
  }

  const activeFile = project.files.find((f) => f.id === project.activeFileId);
  const isBoardActive = activeFile?.type === "board";
  const boardData = isBoardActive ? (activeFile.data as BoardData) : null;

  let activeNetId: string | undefined = undefined;
  if (boardData && boardData.selectedComponentId && boardData.selectedPinId) {
    const comp = boardData.components.find((c) => c.id === boardData.selectedComponentId);
    const pin = comp?.pins.find((p) => p.id === boardData.selectedPinId);
    activeNetId = pin?.netId;
  }

  return (
    <div className="cad-app-shell">
      {/* CAD Top Menu / Tab Bar */}
      <header className="cad-top-bar">
        <div className="cad-top-left">
          <div className="cad-app-title">MyCad</div>
          <span className="cad-sep">/</span>
          <span className="cad-proj-name">{project.name}.mycad</span>
        </div>

        {/* Clean document tabs */}
        <div className="cad-doc-tabs">
          {project.files.map((file) => (
            <div
              key={file.id}
              className={`cad-doc-tab ${file.id === project.activeFileId ? "active" : ""}`}
              onClick={() => handleSelectFile(file.id)}
            >
              {file.type === "board" ? (
                <span className="tab-indicator board-dot" />
              ) : (
                <span className="tab-indicator sch-dot" />
              )}
              <span className="cad-tab-title">{file.name}</span>
              <button
                className="cad-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFile(file.id);
                }}
                title={`Удалить ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="cad-tab-add-btn"
            onClick={() => setIsNewFileModalOpen(true)}
            title="Добавить новый файл (+)"
          >
            +
          </button>
        </div>

        <div className="cad-top-right">
          <button className="cad-btn-ghost" onClick={() => setProject(null)}>
            Закрыть проект
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="cad-workspace-body">
        {/* Left: KiCad Project Tree */}
        <ProjectTree
          project={project}
          onSelectFile={handleSelectFile}
          onOpenNewFileDialog={() => setIsNewFileModalOpen(true)}
          onDeleteFile={handleDeleteFile}
          onCloseProject={() => setProject(null)}
        />

        {/* Center: Canvas Viewport */}
        <main className="cad-canvas-area">
          {project.files.length === 0 ? (
            <div className="cad-empty-workspace">
              <div className="empty-workspace-card">
                <div className="empty-workspace-icon">
                  <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="#38bdf8" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <h3>В проекте пока нет файлов</h3>
                <p>
                  Добавьте печатную плату (.board) или схему (.sch), выбрав тип и имя.
                </p>
                <button
                  className="cad-btn-primary empty-add-btn"
                  onClick={() => setIsNewFileModalOpen(true)}
                >
                  + Создать файл
                </button>
              </div>
            </div>
          ) : isBoardActive && boardData ? (
            <BoardCanvas
              boardData={boardData}
              onChangeBoardData={handleUpdateActiveBoardData}
              activeNetId={activeNetId}
              onSelectComponent={handleSelectComponent}
              onSelectPin={handleSelectPin}
            />
          ) : (
            <div className="cad-schematic-placeholder">
              <div className="placeholder-box">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#64748b" strokeWidth="1.5">
                  <path d="M2 12h4l3-7 4 14 3-7h6" />
                </svg>
                <h3>{activeFile?.name}</h3>
                <p>Принципиальная электрическая схема.</p>
                <small>Для расстановки деталей и монтажки переключитесь на вкладку платы (.board).</small>
              </div>
            </div>
          )}
        </main>

        {/* Right: Inspector Sidebar */}
        {isBoardActive && boardData && (
          <InspectorSidebar
            boardData={boardData}
            onChangeBoardData={handleUpdateActiveBoardData}
            onSelectComponent={handleSelectComponent}
            onSelectPin={handleSelectPin}
          />
        )}
      </div>

      {/* Professional CAD Status Bar */}
      <footer className="cad-status-bar">
        <div className="status-item">Проект: <strong>{project.name}</strong></div>
        {project.author && (
          <div className="status-item">Автор: <strong>{project.author}</strong></div>
        )}
        <div className="status-item">
          Документ: <strong>{activeFile ? activeFile.name : "Нет открытых файлов"}</strong>
        </div>
        {isBoardActive && boardData && (
          <>
            <div className="status-item">Компонентов: <strong>{boardData.components.length}</strong></div>
            {activeNetId && (
              <div className="status-item status-net">
                Цепь: <span className="net-pill">{activeNetId}</span>
              </div>
            )}
          </>
        )}
      </footer>

      {/* New File Modal */}
      <NewFileDialog
        isOpen={isNewFileModalOpen}
        onClose={() => setIsNewFileModalOpen(false)}
        onCreate={handleCreateFile}
        existingFileNames={project.files.map((f) => f.name)}
      />
    </div>
  );
};
