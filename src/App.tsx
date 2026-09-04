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
import { ComponentLibraryModal } from "./components/Modals/ComponentLibraryModal";
import { DeviceEditorModal } from "./components/Modals/DeviceEditorModal";
import { PackageEditorModal } from "./components/Modals/PackageEditorModal";
import { ComponentDatabaseService } from "./services/componentDatabase";
import { DeviceDefinition, PackageDefinition } from "./types/componentLibrary";
import { saveProject, openProject } from "./storage";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCode,
  PanelLeft,
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

  // Модальные окна базы данных компонентов
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isDeviceEditorOpen, setIsDeviceEditorOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceDefinition | undefined>(undefined);
  const [isPackageEditorOpen, setIsPackageEditorOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PackageDefinition | undefined>(undefined);

  // Инициализация базы данных компонентов на старте
  useEffect(() => {
    ComponentDatabaseService.getInstance().load().catch(console.error);
  }, []);

  // Состояние боковой панели (Sidebar / ProjectTree)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("mycad_sidebar_width");
    const parsed = saved ? parseInt(saved, 10) : 240;
    return isNaN(parsed) || parsed < 160 || parsed > 700 ? 240 : parsed;
  });

  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("mycad_sidebar_collapsed") === "true";
  });

  // Состояние правой панели (Inspector)
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = localStorage.getItem("mycad_inspector_width");
    const parsed = saved ? parseInt(saved, 10) : 280;
    return isNaN(parsed) || parsed < 220 || parsed > 750 ? 280 : parsed;
  });

  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  // Переключение видимости левой панели
  const handleToggleLeftSidebar = useCallback(() => {
    setIsLeftSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("mycad_sidebar_collapsed", String(next));
      return next;
    });
  }, []);

  const updateLeftSidebarWidth = useCallback((newWidth: number) => {
    setLeftSidebarWidth(newWidth);
    localStorage.setItem("mycad_sidebar_width", String(newWidth));
  }, []);

  const updateInspectorWidth = useCallback((newWidth: number) => {
    setInspectorWidth(newWidth);
    localStorage.setItem("mycad_inspector_width", String(newWidth));
  }, []);

  // Перетаскивание левого разделителя (ProjectTree resize)
  const handleStartResizeLeft = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const targetWidth = startWidth + deltaX;

      // Если уменьшили левее 110px — сворачиваем панель
      if (targetWidth < 110) {
        setIsLeftSidebarCollapsed(true);
        localStorage.setItem("mycad_sidebar_collapsed", "true");
      } else {
        setIsLeftSidebarCollapsed(false);
        localStorage.setItem("mycad_sidebar_collapsed", "false");
        const clamped = Math.max(160, Math.min(650, Math.round(targetWidth)));
        updateLeftSidebarWidth(clamped);
      }
    };

    const onPointerUp = () => {
      setIsDraggingLeft(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [leftSidebarWidth, updateLeftSidebarWidth]);

  const handleResetLeftSidebarWidth = useCallback(() => {
    updateLeftSidebarWidth(240);
    setIsLeftSidebarCollapsed(false);
    localStorage.setItem("mycad_sidebar_collapsed", "false");
  }, [updateLeftSidebarWidth]);

  // Перетаскивание правого разделителя (Inspector resize)
  const handleStartResizeRight = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      // Смещение влево увеличивает инспектор
      const deltaX = startX - moveEvent.clientX;
      const targetWidth = startWidth + deltaX;
      const clamped = Math.max(220, Math.min(750, Math.round(targetWidth)));
      updateInspectorWidth(clamped);
    };

    const onPointerUp = () => {
      setIsDraggingRight(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [inspectorWidth, updateInspectorWidth]);

  const handleResetInspectorWidth = useCallback(() => {
    updateInspectorWidth(280);
  }, [updateInspectorWidth]);

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

  // Горячие клавиши (Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем в текстовых полях ввода
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "s" || e.code === "KeyS")) {
        e.preventDefault();
        handleSaveProject(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "o" || e.code === "KeyO")) {
        e.preventDefault();
        handleOpenProject();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "b" || e.code === "KeyB")) {
        e.preventDefault();
        handleToggleLeftSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveProject, handleOpenProject, handleToggleLeftSidebar]);

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
    const normalized = normalizeBoardData(updated);
    setProject((prev) => {
      if (!prev) return prev;
      const updatedFiles = prev.files.map((f) =>
        f.id === prev.activeFileId ? { ...f, data: normalized } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
  };

  // Update board data for any file by ID
  const handleUpdateBoardDataForFile = (fileId: string, updated: BoardData) => {
    const normalized = normalizeBoardData(updated);
    setProject((prev) => {
      if (!prev) return prev;
      const updatedFiles = prev.files.map((f) =>
        f.id === fileId ? { ...f, data: normalized } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
  };

  // Target & Selection handlers
  const handleSelectTarget = (target: BoardSelectionTarget) => {
    setProject((prev) => {
      if (!prev) return prev;
      const activeFile = prev.files.find((f) => f.id === prev.activeFileId);
      if (!activeFile || activeFile.type !== "board") return prev;

      const board = normalizeBoardData(activeFile.data as BoardData);
      const compId = target?.type === "component" ? target.id : undefined;
      const pinId = target?.type === "component" ? target.pinId : undefined;

      let newToolMode = board.activeToolMode;
      if (target?.type === "layer_bg_top" || target?.type === "layer_bg_bottom") {
        newToolMode = "images";
      } else if (
        target?.type === "layer_comps_top" ||
        target?.type === "layer_comps_bottom" ||
        target?.type === "component"
      ) {
        newToolMode = "components";
      }

      const updatedBoard: BoardData = {
        ...board,
        selectedTarget: target,
        selectedComponentId: compId,
        selectedPinId: pinId,
        activeToolMode: newToolMode,
      };

      const updatedFiles = prev.files.map((f) =>
        f.id === prev.activeFileId ? { ...f, data: updatedBoard } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
  };

  const handleToggleLayerVisibility = (
    fileId: string,
    layerKey: "bg" | "comps" | "bgTop" | "bgBottom" | "compsTop" | "compsBottom"
  ) => {
    setProject((prev) => {
      if (!prev) return prev;
      const targetFile = prev.files.find((f) => f.id === fileId);
      if (!targetFile || targetFile.type !== "board") return prev;

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

      const updatedFiles = prev.files.map((f) =>
        f.id === fileId ? { ...f, data: updatedBoard } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
  };

  const handleToggleLayerLock = (
    fileId: string,
    layerKey: "bg" | "comps" | "bgTop" | "bgBottom" | "compsTop" | "compsBottom"
  ) => {
    setProject((prev) => {
      if (!prev) return prev;
      const targetFile = prev.files.find((f) => f.id === fileId);
      if (!targetFile || targetFile.type !== "board") return prev;

      const board = normalizeBoardData(targetFile.data as BoardData);
      let updatedBoard = { ...board };

      if (layerKey === "bg") {
        const isCurrentlyLocked = Boolean(board.lockBg || (board.bgTop.locked && board.bgBottom.locked));
        const nextLock = !isCurrentlyLocked;
        updatedBoard.lockBg = nextLock;
        updatedBoard.bgTop = { ...board.bgTop, locked: nextLock };
        updatedBoard.bgBottom = { ...board.bgBottom, locked: nextLock };
      } else if (layerKey === "comps") {
        const isCurrentlyLocked = Boolean(board.lockComps || (board.lockCompsTop && board.lockCompsBottom));
        const nextLock = !isCurrentlyLocked;
        updatedBoard.lockComps = nextLock;
        updatedBoard.lockCompsTop = nextLock;
        updatedBoard.lockCompsBottom = nextLock;
      } else if (layerKey === "bgTop") {
        const nextLocked = !board.bgTop.locked;
        updatedBoard.bgTop = { ...board.bgTop, locked: nextLocked };
        if (!nextLocked && board.lockBg) {
          updatedBoard.lockBg = false;
        }
      } else if (layerKey === "bgBottom") {
        const nextLocked = !board.bgBottom.locked;
        updatedBoard.bgBottom = { ...board.bgBottom, locked: nextLocked };
        if (!nextLocked && board.lockBg) {
          updatedBoard.lockBg = false;
        }
      } else if (layerKey === "compsTop") {
        const nextLocked = !board.lockCompsTop;
        updatedBoard.lockCompsTop = nextLocked;
        if (!nextLocked && board.lockComps) {
          updatedBoard.lockComps = false;
        }
      } else if (layerKey === "compsBottom") {
        const nextLocked = !board.lockCompsBottom;
        updatedBoard.lockCompsBottom = nextLocked;
        if (!nextLocked && board.lockComps) {
          updatedBoard.lockComps = false;
        }
      }

      const updatedFiles = prev.files.map((f) =>
        f.id === fileId ? { ...f, data: updatedBoard } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
  };

  const handleSelectComponent = (compId: string | undefined) => {
    setProject((prev) => {
      if (!prev) return prev;
      const activeFile = prev.files.find((f) => f.id === prev.activeFileId);
      if (!activeFile || activeFile.type !== "board") return prev;

      const board = normalizeBoardData(activeFile.data as BoardData);
      const target: BoardSelectionTarget = compId ? { type: "component", id: compId } : null;
      const updatedBoard: BoardData = {
        ...board,
        selectedTarget: target,
        selectedComponentId: compId,
        selectedPinId: compId ? board.selectedPinId : undefined,
      };
      const updatedFiles = prev.files.map((f) =>
        f.id === prev.activeFileId ? { ...f, data: updatedBoard } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
  };

  const handleSelectPin = (compId: string, pinId: string) => {
    setProject((prev) => {
      if (!prev) return prev;
      const activeFile = prev.files.find((f) => f.id === prev.activeFileId);
      if (!activeFile || activeFile.type !== "board") return prev;

      const board = normalizeBoardData(activeFile.data as BoardData);
      const target: BoardSelectionTarget = { type: "component", id: compId, pinId };
      const updatedBoard: BoardData = {
        ...board,
        selectedTarget: target,
        selectedComponentId: compId,
        selectedPinId: pinId,
      };
      const updatedFiles = prev.files.map((f) =>
        f.id === prev.activeFileId ? { ...f, data: updatedBoard } : f
      );
      return { ...prev, files: updatedFiles };
    });
    setIsDirty(true);
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

  const isInspectorActive = Boolean(
    isBoardActive &&
    boardData &&
    (
      ((boardData.selectedTarget?.type === "layer_bg_top" || boardData.selectedTarget?.type === "layer_bg_bottom") && boardData.selectedTarget.imageId) ||
      Boolean(boardData.components.some(c => c.id === (boardData.selectedTarget?.type === "component" ? boardData.selectedTarget.id : boardData.selectedComponentId)))
    )
  );

  return (
    <div className="cad-app-shell">
      {/* CAD Top Menu / Tab Bar */}
      <header className="cad-top-bar">
        <div className="cad-top-left">
          <button
            className={`cad-topbar-toggle-btn ${isLeftSidebarCollapsed ? "is-collapsed" : ""}`}
            onClick={handleToggleLeftSidebar}
            title={isLeftSidebarCollapsed ? "Показать боковую панель (Ctrl+B)" : "Скрыть боковую панель (Ctrl+B)"}
          >
            <PanelLeft size={15} />
          </button>
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
      <div className={`cad-workspace-body ${isDraggingLeft || isDraggingRight ? "cad-resizing-col" : ""}`}>
        {/* Left: KiCad Project Tree with layers dropdown */}
        {!isLeftSidebarCollapsed && (
          <ProjectTree
            width={leftSidebarWidth}
            onToggleCollapse={handleToggleLeftSidebar}
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
            onToggleLayerLock={handleToggleLayerLock}
            onUpdateBoardData={handleUpdateBoardDataForFile}
          />
        )}

        {/* Left Sidebar Resizer */}
        {!isLeftSidebarCollapsed && (
          <div
            className={`cad-resizer cad-resizer-left ${isDraggingLeft ? "is-dragging" : ""}`}
            onPointerDown={handleStartResizeLeft}
            onDoubleClick={handleResetLeftSidebarWidth}
            title="Потяните для изменения ширины (Двойной клик — сброс 240px)"
          >
            <div className="cad-resizer-line" />
          </div>
        )}

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
              onOpenLibrary={() => setIsLibraryModalOpen(true)}
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

        {/* Right Resizer: only when Inspector is active */}
        {isInspectorActive && (
          <div
            className={`cad-resizer cad-resizer-right ${isDraggingRight ? "is-dragging" : ""}`}
            onPointerDown={handleStartResizeRight}
            onDoubleClick={handleResetInspectorWidth}
            title="Потяните для изменения ширины инспектора (Двойной клик — сброс 280px)"
          >
            <div className="cad-resizer-line" />
          </div>
        )}

        {/* Right: Inspector Sidebar */}
        {isBoardActive && boardData && (
          <InspectorSidebar
            width={inspectorWidth}
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

      {/* Component Database Modals */}
      <ComponentLibraryModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        onPlaceOnBoard={(deviceId, packageId, variantId) => {
          if (!project) return;
          const activeFile = project.files.find((f) => f.id === project.activeFileId);
          if (!activeFile || activeFile.type !== "board") return;

          const board = normalizeBoardData(activeFile.data as BoardData);
          const db = ComponentDatabaseService.getInstance();

          const newComp = db.instantiateComponent({
            deviceId,
            packageId,
            variantId,
            x: 0,
            y: 0,
            layer: board.activeSideView === "bottom" ? "bottom" : "top",
            existingComponents: board.components,
          });

          const updatedBoard: BoardData = {
            ...board,
            components: [...board.components, newComp],
            selectedComponentId: newComp.id,
            selectedTarget: { type: "component", id: newComp.id },
          };

          const updatedFiles = project.files.map((f) =>
            f.id === project.activeFileId ? { ...f, data: updatedBoard } : f
          );

          setProject({ ...project, files: updatedFiles });
          setIsDirty(true);
          setToast({
            message: `Размещен компонент ${newComp.refDes} (${newComp.value})`,
            type: "success",
          });
        }}
        onOpenDeviceEditor={(device) => {
          setEditingDevice(device);
          setIsDeviceEditorOpen(true);
        }}
        onOpenPackageEditor={(pkg) => {
          setEditingPackage(pkg);
          setIsPackageEditorOpen(true);
        }}
      />

      <DeviceEditorModal
        isOpen={isDeviceEditorOpen}
        initialDevice={editingDevice}
        onClose={() => {
          setIsDeviceEditorOpen(false);
          setEditingDevice(undefined);
        }}
      />

      <PackageEditorModal
        isOpen={isPackageEditorOpen}
        initialPackage={editingPackage}
        onClose={() => {
          setIsPackageEditorOpen(false);
          setEditingPackage(undefined);
        }}
      />
    </div>
  );
};
