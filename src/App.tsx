import React, { useState, useEffect, useCallback } from "react";
import {
  Project,
  BoardData,
  SchematicData,
  ProjectFile,
  BoardSelectionTarget,
  normalizeBoardData,
} from "./types/project";
import { StartScreen } from "./components/StartPage/StartScreen";
import { ProjectTree } from "./components/Sidebar/ProjectTree";
import { BoardCanvas } from "./components/Viewport/BoardCanvas";
import { InspectorSidebar } from "./components/Sidebar/InspectorSidebar";
import { NewFileDialog, ProjectFileType } from "./components/Modals/NewFileDialog";
import { saveProject, openProject } from "./storage";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from "lucide-react";
import "./App.css";

interface ToastInfo {
  message: string;
  type: "success" | "error" | "info";
}

export const App: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Вспомогательное всплывающее уведомление
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Create a new empty project (files are added manually by the user)
  const handleCreateProject = (name: string, description?: string, author?: string) => {
    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name,
      description,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      formatVersion: 1,
      files: [],
      activeFileId: "",
    };

    setProject(newProj);
    setIsDirty(false);
    showToast(`Проект «${name}» создан`, "info");
  };

  // Сохранение проекта
  const handleSaveProject = useCallback(async (saveAs = false) => {
    if (!project || isSaving) return;
    setIsSaving(true);
    try {
      const res = await saveProject(project, saveAs);
      if (res) {
        setProject(res.project);
        setIsDirty(false);
        const fileName = res.path.split(/[\\/]/).pop() || `${res.project.name}.mycad`;
        showToast(`Проект сохранён: ${fileName}`, "success");
      }
    } catch (err) {
      console.error("Ошибка сохранения проекта:", err);
      showToast(`Ошибка сохранения: ${String(err)}`, "error");
    } finally {
      setIsSaving(false);
    }
  }, [project, isSaving, showToast]);

  // Открытие проекта
  const handleOpenProject = useCallback(async (targetPath?: string) => {
    if (isDirty && project) {
      const confirmOpen = window.confirm(
        "В текущем проекте есть несохранённые изменения. Открыть другой проект без сохранения?"
      );
      if (!confirmOpen) return;
    }

    try {
      const res = await openProject(targetPath);
      if (res) {
        const normalizedFiles = res.project.files.map((f) => {
          if (f.type === "board") {
            return {
              ...f,
              data: normalizeBoardData(f.data as Partial<BoardData>),
            };
          }
          return f;
        });
        setProject({ ...res.project, files: normalizedFiles });
        setIsDirty(false);
        showToast(`Проект «${res.project.name}» успешно открыт`, "success");
      }
    } catch (err) {
      console.error("Ошибка открытия проекта:", err);
      showToast(`Не удалось открыть проект: ${String(err)}`, "error");
    }
  }, [isDirty, project, showToast]);

  // Закрытие проекта
  const handleRequestClose = () => {
    if (isDirty) {
      setShowCloseModal(true);
    } else {
      setProject(null);
    }
  };

  // Горячие клавиши (Ctrl+S, Ctrl+Shift+S, Ctrl+O)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем в текстовых полях ввода
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveProject(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleOpenProject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveProject, handleOpenProject]);

  // Create a new file manually (.board or .sch) with custom name
  const handleCreateFile = (type: ProjectFileType, fileName: string) => {
    if (!project) return;
    const fileId = `file_${type}_${Date.now()}`;
    let newFile: ProjectFile;

    if (type === "board") {
      const newBoard: BoardData = normalizeBoardData({
        id: fileId,
        name: fileName,
        components: [],
      });
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
    setIsDirty(true);
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
    setIsDirty(true);
  };

  // Switch active document file
  const handleSelectFile = (fileId: string) => {
    if (!project) return;
    setProject({ ...project, activeFileId: fileId });
  };

  // Update board data of active file
  const handleUpdateActiveBoardData = (updated: BoardData) => {
    if (!project) return;
    const normalized = normalizeBoardData(updated);
    const updatedFiles = project.files.map((f) =>
      f.id === project.activeFileId ? { ...f, data: normalized } : f
    );
    setProject({ ...project, files: updatedFiles });
    setIsDirty(true);
  };

  // Target & Selection handlers
  const handleSelectTarget = (target: BoardSelectionTarget) => {
    if (!project) return;
    const activeFile = project.files.find((f) => f.id === project.activeFileId);
    if (!activeFile || activeFile.type !== "board") return;

    const board = normalizeBoardData(activeFile.data as BoardData);
    const compId = target?.type === "component" ? target.id : undefined;
    const pinId = target?.type === "component" ? target.pinId : undefined;

    handleUpdateActiveBoardData({
      ...board,
      selectedTarget: target,
      selectedComponentId: compId,
      selectedPinId: pinId,
    });
  };

  const handleToggleLayerVisibility = (
    fileId: string,
    layerKey: "bg" | "comps" | "bgTop" | "bgBottom" | "compsTop" | "compsBottom"
  ) => {
    if (!project) return;
    const targetFile = project.files.find((f) => f.id === fileId);
    if (!targetFile || targetFile.type !== "board") return;

    const board = normalizeBoardData(targetFile.data as BoardData);
    let updatedBoard = { ...board };

    if (layerKey === "bg") {
      const anyVisible = board.bgTop.visible || board.bgBottom.visible;
      updatedBoard.bgTop = { ...board.bgTop, visible: !anyVisible };
      updatedBoard.bgBottom = { ...board.bgBottom, visible: !anyVisible };
    } else if (layerKey === "comps") {
      const anyVisible = board.showCompsTop || board.showCompsBottom;
      updatedBoard.showCompsTop = !anyVisible;
      updatedBoard.showCompsBottom = !anyVisible;
    } else if (layerKey === "bgTop") {
      updatedBoard.bgTop = { ...board.bgTop, visible: !board.bgTop.visible };
    } else if (layerKey === "bgBottom") {
      updatedBoard.bgBottom = { ...board.bgBottom, visible: !board.bgBottom.visible };
    } else if (layerKey === "compsTop") {
      updatedBoard.showCompsTop = !board.showCompsTop;
    } else if (layerKey === "compsBottom") {
      updatedBoard.showCompsBottom = !board.showCompsBottom;
    }

    const updatedFiles = project.files.map((f) =>
      f.id === fileId ? { ...f, data: updatedBoard } : f
    );
    setProject({ ...project, files: updatedFiles });
    setIsDirty(true);
  };

  const handleSelectComponent = (compId: string | undefined) => {
    if (!project) return;
    const activeFile = project.files.find((f) => f.id === project.activeFileId);
    if (!activeFile || activeFile.type !== "board") return;

    const board = normalizeBoardData(activeFile.data as BoardData);
    const target: BoardSelectionTarget = compId ? { type: "component", id: compId } : null;
    handleUpdateActiveBoardData({
      ...board,
      selectedTarget: target,
      selectedComponentId: compId,
      selectedPinId: compId ? board.selectedPinId : undefined,
    });
  };

  const handleSelectPin = (compId: string, pinId: string) => {
    if (!project) return;
    const activeFile = project.files.find((f) => f.id === project.activeFileId);
    if (!activeFile || activeFile.type !== "board") return;

    const board = normalizeBoardData(activeFile.data as BoardData);
    const target: BoardSelectionTarget = { type: "component", id: compId, pinId };
    handleUpdateActiveBoardData({
      ...board,
      selectedTarget: target,
      selectedComponentId: compId,
      selectedPinId: pinId,
    });
  };

  if (!project) {
    return (
      <>
        <StartScreen
          onCreateProject={handleCreateProject}
          onOpenProject={() => handleOpenProject()}
          onOpenRecent={(path) => handleOpenProject(path)}
        />
        {toast && (
          <div className={`cad-toast cad-toast-${toast.type}`}>
            {toast.type === "success" && <CheckCircle2 size={16} />}
            {toast.type === "error" && <AlertCircle size={16} />}
            {toast.type === "info" && <FileCode size={16} />}
            <span>{toast.message}</span>
          </div>
        )}
      </>
    );
  }

  const activeFile = project.files.find((f) => f.id === project.activeFileId);
  const isBoardActive = activeFile?.type === "board";
  const boardData = isBoardActive
    ? normalizeBoardData(activeFile.data as Partial<BoardData>)
    : null;

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
          <div className="cad-proj-info-wrap">
            <span className="cad-proj-name">
              {project.name}.mycad
              {isDirty && <span className="cad-dirty-indicator" title="Есть несохранённые изменения">*</span>}
            </span>
            {project.filePath ? (
              <span className="cad-file-path-hint" title={project.filePath}>
                {project.filePath}
              </span>
            ) : (
              <span className="cad-file-unsaved-hint">(Не сохранён на диск)</span>
            )}
          </div>
        </div>

        <div className="cad-top-right">
          {/* Top right is clean */}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="cad-workspace-body">
        {/* Left: KiCad Project Tree with layers dropdown */}
        <ProjectTree
          project={project}
          isDirty={isDirty}
          onSelectFile={handleSelectFile}
          onOpenNewFileDialog={() => setIsNewFileModalOpen(true)}
          onDeleteFile={handleDeleteFile}
          onSaveProject={() => handleSaveProject(false)}
          onSaveProjectAs={() => handleSaveProject(true)}
          onCloseProject={handleRequestClose}
          activeSelectionTarget={boardData?.selectedTarget}
          onSelectTarget={handleSelectTarget}
          onToggleLayerVisibility={handleToggleLayerVisibility}
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
              onSelectTarget={handleSelectTarget}
            />
          ) : activeFile?.type === "sch" ? (
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
          ) : (
            <div className="cad-canvas-blank" />
          )}
        </main>

        {/* Right: Inspector Sidebar */}
        {isBoardActive && boardData && (
          <InspectorSidebar
            boardData={boardData}
            onChangeBoardData={handleUpdateActiveBoardData}
            onSelectComponent={handleSelectComponent}
            onSelectPin={handleSelectPin}
            onSelectTarget={handleSelectTarget}
          />
        )}
      </div>

      {/* Professional CAD Status Bar */}
      <footer className="cad-status-bar">
        <div className="status-item">
          Проект: <strong>{project.name}</strong>
          {isDirty && <span className="status-dirty-badge">Не сохранено</span>}
        </div>
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

      {/* Unsaved Changes Confirmation Modal */}
      {showCloseModal && (
        <div className="cad-modal-backdrop" onClick={() => setShowCloseModal(false)}>
          <div className="cad-dialog cad-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cad-dialog-header">
              <div className="dialog-title-wrap">
                <AlertTriangle size={18} className="dialog-warning-icon" />
                <h3>Несохранённые изменения</h3>
              </div>
              <button
                className="cad-dialog-close"
                onClick={() => setShowCloseModal(false)}
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            <div className="cad-dialog-body">
              <p className="confirm-text">
                В проекте <strong>«{project.name}»</strong> есть несохранённые изменения.
              </p>
              <p className="confirm-subtext">
                Если вы закроете проект без сохранения, все внесённые правки будут потеряны.
              </p>
            </div>

            <div className="cad-dialog-footer">
              <button
                type="button"
                className="cad-btn-flat"
                onClick={() => setShowCloseModal(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="cad-btn-danger"
                onClick={() => {
                  setShowCloseModal(false);
                  setProject(null);
                }}
              >
                Не сохранять
              </button>
              <button
                type="button"
                className="cad-btn-primary"
                onClick={async () => {
                  setShowCloseModal(false);
                  await handleSaveProject(false);
                  setProject(null);
                }}
              >
                Сохранить и закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`cad-toast cad-toast-${toast.type}`}>
          {toast.type === "success" && <CheckCircle2 size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <FileCode size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
