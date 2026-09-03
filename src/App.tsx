import React, { useState } from "react";
import { Project, BoardData, SchematicData } from "./types/project";
import { StartScreen } from "./components/StartPage/StartScreen";
import { ProjectTree } from "./components/Sidebar/ProjectTree";
import { BoardCanvas } from "./components/Viewport/BoardCanvas";
import { InspectorSidebar } from "./components/Sidebar/InspectorSidebar";
import "./App.css";

export const App: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);

  // Create a new project with .board and .sch documents
  const handleCreateProject = (name: string, description?: string, author?: string) => {
    const boardId = `file_board_${Date.now()}`;
    const schId = `file_sch_${Date.now()}`;

    const newBoard: BoardData = {
      id: boardId,
      name: `${name}.board`,
      bgOpacity: 0.8,
      bgScale: 1,
      bgOffsetX: 0,
      bgOffsetY: 0,
      components: [],
    };

    const newSch: SchematicData = {
      id: schId,
      name: `${name}.sch`,
      notes: description || ("Принципиальная схема проекта " + name),
    };

    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name,
      description,
      author,
      createdAt: new Date().toISOString(),
      files: [
        { id: boardId, name: `${name}.board`, type: "board", data: newBoard },
        { id: schId, name: `${name}.sch`, type: "sch", data: newSch },
      ],
      activeFileId: boardId,
    };

    setProject(newProj);
  };

  // Add extra board file to project
  const handleAddBoard = () => {
    if (!project) return;
    const count = project.files.filter((f) => f.type === "board").length + 1;
    const newBoardId = `file_board_${Date.now()}`;
    const newBoardName = `${project.name}_Board${count}.board`;

    const newBoard: BoardData = {
      id: newBoardId,
      name: newBoardName,
      bgOpacity: 0.8,
      bgScale: 1,
      bgOffsetX: 0,
      bgOffsetY: 0,
      components: [],
    };

    setProject({
      ...project,
      files: [
        ...project.files,
        { id: newBoardId, name: newBoardName, type: "board", data: newBoard },
      ],
      activeFileId: newBoardId,
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
            <button
              key={file.id}
              className={`cad-doc-tab ${file.id === project.activeFileId ? "active" : ""}`}
              onClick={() => handleSelectFile(file.id)}
            >
              {file.type === "board" ? (
                <span className="tab-indicator board-dot" />
              ) : (
                <span className="tab-indicator sch-dot" />
              )}
              <span>{file.name}</span>
            </button>
          ))}
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
          onAddBoard={handleAddBoard}
          onCloseProject={() => setProject(null)}
        />

        {/* Center: Canvas Viewport */}
        <main className="cad-canvas-area">
          {isBoardActive && boardData ? (
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
        <div className="status-item">Документ: <strong>{activeFile?.name}</strong></div>
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
    </div>
  );
};
