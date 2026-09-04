import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Project,
  ProjectFile,
  BoardData,
  BoardSelectionTarget,
  LayerImageItem,
  normalizeBoardData,
} from "../../types/project";
import {
  Save,
  Download,
  Plus,
  LogOut,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Cpu,
  Lock,
  Unlock,
  Trash2,
  PanelLeftClose,
  Crosshair,
  Crop,
} from "lucide-react";

interface ProjectTreeProps {
  project: Project;
  isDirty?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
  onSelectFile: (fileId: string) => void;
  onOpenNewFileDialog: () => void;
  onDeleteFile: (fileId: string) => void;
  onSaveProject?: () => void;
  onSaveProjectAs?: () => void;
  onCloseProject?: () => void;
  activeSelectionTarget?: BoardSelectionTarget;
  onSelectTarget?: (target: BoardSelectionTarget) => void;
  onToggleLayerVisibility?: (
    fileId: string,
    layerKey: "bg" | "comps" | "bgTop" | "bgBottom" | "compsTop" | "compsBottom"
  ) => void;
  onToggleLayerLock?: (
    fileId: string,
    layerKey: "bg" | "comps" | "bgTop" | "bgBottom" | "compsTop" | "compsBottom"
  ) => void;
  onUpdateBoardData?: (fileId: string, updatedBoardData: BoardData) => void;
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  project,
  isDirty,
  width,
  onToggleCollapse,
  onSelectFile,
  onOpenNewFileDialog,
  onDeleteFile,
  onSaveProject,
  onSaveProjectAs,
  onCloseProject,
  activeSelectionTarget,
  onSelectTarget,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onUpdateBoardData,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [expandedBoards, setExpandedBoards] = useState<Record<string, boolean>>({});
  const [expandedLayerGroups, setExpandedLayerGroups] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  const isGroupExpanded = (key: string) => expandedLayerGroups[key] !== false;
  const toggleGroupExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLayerGroups((prev) => ({ ...prev, [key]: !isGroupExpanded(key) }));
  };

  // By default, expand active board
  useEffect(() => {
    if (project.activeFileId && !expandedBoards[project.activeFileId]) {
      setExpandedBoards((prev) => ({ ...prev, [project.activeFileId]: true }));
    }
  }, [project.activeFileId]);

  const toggleBoardExpand = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBoards((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  const handleToggleImageVisibility = (
    fileId: string,
    layerKey: "bgTop" | "bgBottom",
    imageId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const file = project.files.find((f) => f.id === fileId);
    if (!file || file.type !== "board") return;
    const board = normalizeBoardData(file.data as BoardData);
    const bg = board[layerKey];
    const updatedImages = (bg.images || []).map((img) =>
      img.id === imageId ? { ...img, visible: !img.visible } : img
    );
    onUpdateBoardData?.(fileId, {
      ...board,
      [layerKey]: { ...bg, images: updatedImages },
    });
  };

  const handleToggleImageLock = (
    fileId: string,
    layerKey: "bgTop" | "bgBottom",
    imageId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const file = project.files.find((f) => f.id === fileId);
    if (!file || file.type !== "board") return;
    const board = normalizeBoardData(file.data as BoardData);
    const bg = board[layerKey];
    const updatedImages = (bg.images || []).map((img) =>
      img.id === imageId ? { ...img, locked: !img.locked } : img
    );
    onUpdateBoardData?.(fileId, {
      ...board,
      [layerKey]: { ...bg, images: updatedImages },
    });
  };

  const handleDeleteImageFromTree = (
    fileId: string,
    layerKey: "bgTop" | "bgBottom",
    imageId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const file = project.files.find((f) => f.id === fileId);
    if (!file || file.type !== "board") return;
    const board = normalizeBoardData(file.data as BoardData);
    const bg = board[layerKey];
    const filtered = (bg.images || []).filter((img) => img.id !== imageId);
    const targetType = layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom";

    const nextSelected =
      activeSelectionTarget?.type === targetType &&
        (activeSelectionTarget as any).imageId === imageId
        ? null
        : activeSelectionTarget || null;

    onUpdateBoardData?.(fileId, {
      ...board,
      [layerKey]: {
        ...bg,
        images: filtered,
        activeImageId: filtered[0]?.id,
        image: filtered[0]?.src,
      },
      selectedTarget: nextSelected,
    });
  };

  // Фокусировка и центрирование холста на выбранном изображении
  const handleFocusImage = (
    fileId: string,
    layerKey: "bgTop" | "bgBottom",
    imageId: string
  ) => {
    onSelectFile(fileId);
    onSelectTarget?.({
      type: layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom",
      imageId,
    });
    // Если слой подложки скрыт, автоматически включаем его видимость
    const file = project.files.find((f) => f.id === fileId);
    if (file && file.type === "board") {
      const board = normalizeBoardData(file.data as BoardData);
      if (!board[layerKey].visible) {
        onToggleLayerVisibility?.(fileId, layerKey);
      }
    }
    window.dispatchEvent(
      new CustomEvent("mycad-focus-image", {
        detail: { layerKey, imageId },
      })
    );
  };

  // Состояние всплывающего быстрого предпросмотра при наведении
  const [hoveredPreview, setHoveredPreview] = useState<{
    fileId: string;
    layerKey: "bgTop" | "bgBottom";
    img: LayerImageItem;
    rect: DOMRect;
    layerTitle: string;
    layerColor: string;
  } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const handleMouseEnterThumb = (
    e: React.MouseEvent<HTMLElement>,
    fileId: string,
    layerKey: "bgTop" | "bgBottom",
    img: LayerImageItem,
    layerTitle: string,
    layerColor: string
  ) => {
    const elRect = e.currentTarget.getBoundingClientRect();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredPreview({ fileId, layerKey, img, rect: elRect, layerTitle, layerColor });
    }, 180);
  };

  const handleMouseLeaveThumb = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredPreview(null);
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

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

  // Отрисовка строки изображения с быстрым доступом, фокусировкой и предпросмотром
  const renderTreeImageItem = (
    img: LayerImageItem,
    _idx: number,
    layerKey: "bgTop" | "bgBottom",
    file: ProjectFile,
    _imagesList: LayerImageItem[],
    layerTitle: string,
    layerColor: string,
    isActiveFile: boolean
  ) => {
    const isImgSelected =
      isActiveFile &&
      activeSelectionTarget?.type === (layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom") &&
      (activeSelectionTarget as any).imageId === img.id;

    const fileBoard = file.type === "board" ? normalizeBoardData(file.data as BoardData) : null;
    const isParentLocked = Boolean(fileBoard && (fileBoard.lockBg || fileBoard[layerKey]?.locked));
    const isImgLocked = Boolean(img.locked || isParentLocked);

    return (
      <div
        key={img.id}
        className={`kicad-tree-image-item ${isImgSelected ? "selected" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectFile(file.id);
            onSelectTarget?.({
              type: layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom",
              imageId: img.id,
            });
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleFocusImage(file.id, layerKey, img.id);
          }}
          title={`${img.name}\nМасштаб: ${Math.round((img.scale || 1) * 100)}% | Угол: ${(img.rotation || 0).toFixed(1)}°\nДвойной клик — показать на холсте`}
        >
          <button
            className="layer-vis-btn"
            onClick={(e) => handleToggleImageVisibility(file.id, layerKey, img.id, e)}
            title={img.visible ? "Скрыть изображение" : "Показать изображение"}
          >
            {img.visible ? <Eye size={11} className="eye-on" /> : <EyeOff size={11} className="eye-off" />}
          </button>

          <button
            className={`tree-lock-btn ${isImgLocked ? "locked" : ""}`}
            onClick={(e) => handleToggleImageLock(file.id, layerKey, img.id, e)}
            title={
              isParentLocked
                ? `Заблокировано (заблокирован ${fileBoard?.lockBg ? "весь слой Подложка" : "подслой " + layerTitle})`
                : img.locked
                ? "Разблокировать"
                : "Заблокировать от перемещения"
            }
          >
            {isImgLocked ? <Lock size={10} /> : <Unlock size={10} />}
          </button>

          <div
            className="tree-img-thumb-mini"
            onMouseEnter={(e) => handleMouseEnterThumb(e, file.id, layerKey, img, layerTitle, layerColor)}
            onMouseLeave={handleMouseLeaveThumb}
            onClick={(e) => {
              e.stopPropagation();
              handleFocusImage(file.id, layerKey, img.id);
            }}
            title="Наведите для быстрого просмотра, кликните для фокусировки на холсте"
          >
            <img
              src={img.src}
              alt=""
              style={{
                transform: img.mirrored ? "scaleX(-1)" : "none",
                opacity: img.visible ? 1 : 0.4,
              }}
            />
          </div>

          <span
            className="tree-img-name"
            onMouseEnter={(e) => handleMouseEnterThumb(e, file.id, layerKey, img, layerTitle, layerColor)}
            onMouseLeave={handleMouseLeaveThumb}
          >
            {img.name}
          </span>

          <div className="tree-img-actions">
            <button
              className="tree-img-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectFile(file.id);
                onSelectTarget?.({
                  type: layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom",
                  imageId: img.id,
                });
                window.dispatchEvent(
                  new CustomEvent("mycad-preprocess-image", {
                    detail: { layerKey, imageId: img.id },
                  })
                );
              }}
              title="Обрезать / Исправить перспективу / Вырезать форму"
            >
              <Crop size={11} />
            </button>
            <button
              className="tree-img-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleFocusImage(file.id, layerKey, img.id);
              }}
              title="Фокусировать и центрировать холст на этом изображении (Двойной клик)"
            >
              <Crosshair size={11} />
            </button>

            <button
              className="tree-img-action-btn danger"
              onClick={(e) => {
                if (isImgLocked) return;
                handleDeleteImageFromTree(file.id, layerKey, img.id, e);
              }}
              disabled={isImgLocked}
              style={isImgLocked ? { opacity: 0.25, cursor: "not-allowed" } : undefined}
              title={isImgLocked ? "Удаление недоступно: слой/изображение заблокировано" : "Удалить это изображение"}
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
    );
  };

  return (
    <>
      <aside className="kicad-tree-panel" style={width ? { width: `${width}px` } : undefined}>
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

          {/* 3. Скрыть панель */}
          {onToggleCollapse && (
            <button
              className="kicad-icon-btn kicad-btn-collapse"
              onClick={onToggleCollapse}
              title="Скрыть панель (Ctrl+B)"
            >
              <PanelLeftClose size={14} />
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
            const isExpanded = isBoard && expandedBoards[file.id] !== false;
            const boardData: BoardData | null = isBoard
              ? normalizeBoardData(file.data as Partial<BoardData>)
              : null;

            const topCompsCount =
              boardData?.components.filter((c) => (c.layer || "top") === "top").length || 0;
            const bottomCompsCount =
              boardData?.components.filter((c) => c.layer === "bottom").length || 0;

            return (
              <div key={file.id} className="kicad-file-branch">
                <div
                  className={`kicad-tree-item file-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    onSelectFile(file.id);
                  }}
                >
                  {/* Chevron for boards to expand layers */}
                  {isBoard ? (
                    <button
                      className="kicad-expand-arrow-btn"
                      onClick={(e) => toggleBoardExpand(file.id, e)}
                      title={isExpanded ? "Свернуть слои" : "Раскрыть слои"}
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  ) : (
                    <span className="kicad-expand-placeholder" />
                  )}

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

                  <span className="item-label" title={file.name}>
                    {file.name}
                  </span>

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

                {/* 2 Основных слоя: Подложка и Компоненты (виртуально делятся на Top и Bottom) */}
                {isBoard && isExpanded && boardData && (
                  <div className="kicad-layers-subgroup">
                    {/* ===== ОСНОВНОЙ СЛОЙ 1: ПОДЛОЖКА ===== */}
                    {(() => {
                      const bgKey = `${file.id}_bg`;
                      const isBgExpanded = isGroupExpanded(bgKey);
                      const isBgVisible = boardData.bgTop.visible || boardData.bgBottom.visible;
                      const isBgLocked = Boolean(
                        boardData.lockBg || (boardData.bgTop.locked && boardData.bgBottom.locked)
                      );
                      const topImagesCount = boardData.bgTop.images?.length || (boardData.bgTop.image ? 1 : 0);
                      const bottomImagesCount = boardData.bgBottom.images?.length || (boardData.bgBottom.image ? 1 : 0);
                      const totalBgImages = topImagesCount + bottomImagesCount;
                      const isBgActive =
                        isActive &&
                        (activeSelectionTarget?.type === "layer_bg_top" ||
                          activeSelectionTarget?.type === "layer_bg_bottom");

                      return (
                        <div className="kicad-layer-group">
                          {/* Заголовок основного слоя: Подложка */}
                          <div
                            className={`kicad-layer-group-header ${isBgActive ? "group-active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectFile(file.id);
                              const targetSide =
                                activeSelectionTarget?.type === "layer_bg_bottom"
                                  ? "layer_bg_bottom"
                                  : "layer_bg_top";
                              onSelectTarget?.({ type: targetSide });
                            }}
                            title="Слой: Подложка (нажмите для выбора, стрелка — раскрыть стороны)"
                          >
                            <button
                              className="kicad-group-expand-btn"
                              onClick={(e) => toggleGroupExpand(bgKey, e)}
                              title={isBgExpanded ? "Свернуть стороны" : "Развернуть стороны"}
                            >
                              {isBgExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>

                            <button
                              className="layer-vis-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerVisibility?.(file.id, "bg");
                              }}
                              title={isBgVisible ? "Скрыть подложку (обе стороны)" : "Показать подложку"}
                            >
                              {isBgVisible ? (
                                <Eye size={13} className="eye-on" />
                              ) : (
                                <EyeOff size={13} className="eye-off" />
                              )}
                            </button>

                            <button
                              className={`tree-lock-btn ${isBgLocked ? "locked" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerLock?.(file.id, "bg");
                              }}
                              title={isBgLocked ? "Разблокировать слой Подложка (обе стороны)" : "Заблокировать слой Подложка (обе стороны)"}
                            >
                              {isBgLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>

                            <ImageIcon size={13} className="layer-group-icon icon-bg" />
                            <span className="layer-group-title">Подложка</span>

                            {totalBgImages > 0 && (
                              <span className="layer-badge-img" title={`Всего снимков: ${totalBgImages}`}>
                                {totalBgImages > 1 ? `${totalBgImages} IMG` : "IMG"}
                              </span>
                            )}
                          </div>

                          {/* Виртуальные подслои: Top (Лицевая) и Bottom (Обратная) с изображениями */}
                          {isBgExpanded && (() => {
                            const topKey = `${file.id}_bg_top`;
                            const isTopExpanded = isGroupExpanded(topKey);
                            const isTopLocked = Boolean(boardData.lockBg || boardData.bgTop.locked);
                            const topImages = boardData.bgTop.images || [];

                            const bottomKey = `${file.id}_bg_bottom`;
                            const isBottomExpanded = isGroupExpanded(bottomKey);
                            const isBottomLocked = Boolean(boardData.lockBg || boardData.bgBottom.locked);
                            const bottomImages = boardData.bgBottom.images || [];

                            return (
                              <div className="kicad-sub-layers-list">
                                {/* Виртуальный подслой: Top */}
                                <div
                                  className={`kicad-layer-tree-item virtual-sub ${isActive && activeSelectionTarget?.type === "layer_bg_top" && !(activeSelectionTarget as any).imageId ? "selected" : ""
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectFile(file.id);
                                    onSelectTarget?.({
                                      type: "layer_bg_top",
                                    });
                                  }}
                                  title="Подложка: Top (Лицевая сторона)"
                                >
                                  {topImages.length > 0 && (
                                    <button
                                      className="kicad-group-expand-btn"
                                      onClick={(e) => toggleGroupExpand(topKey, e)}
                                      title={isTopExpanded ? "Свернуть снимки" : "Развернуть снимки"}
                                    >
                                      {isTopExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                    </button>
                                  )}
                                  <button
                                    className="layer-vis-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(file.id, "bgTop");
                                    }}
                                    title={boardData.bgTop.visible ? "Скрыть Top" : "Показать Top"}
                                  >
                                    {boardData.bgTop.visible ? (
                                      <Eye size={12} className="eye-on" />
                                    ) : (
                                      <EyeOff size={12} className="eye-off" />
                                    )}
                                  </button>
                                  <button
                                    className={`tree-lock-btn ${isTopLocked ? "locked" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerLock?.(file.id, "bgTop");
                                    }}
                                    title={isTopLocked ? "Разблокировать подслой Top" : "Заблокировать подслой Top"}
                                  >
                                    {isTopLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                  </button>
                                  <span className="layer-color-dot dot-bg-top" />
                                  <span className="layer-title">Top (Лицевая)</span>
                                  {topImagesCount > 0 && (
                                    <span className="layer-badge-sub-img">
                                      {topImagesCount > 1 ? `${topImagesCount}` : "1"}
                                    </span>
                                  )}
                                </div>

                                {/* Список снимков на Top */}
                                {isTopExpanded && topImages.length > 0 && (
                                  <div className="kicad-images-subgroup">
                                    {topImages.map((img, idx) =>
                                      renderTreeImageItem(
                                        img,
                                        idx,
                                        "bgTop",
                                        file,
                                        topImages,
                                        "Top (Лицевая)",
                                        "#38bdf8",
                                        isActive
                                      )
                                    )}
                                  </div>
                                )}

                                {/* Виртуальный подслой: Bottom */}
                                <div
                                  className={`kicad-layer-tree-item virtual-sub ${isActive && activeSelectionTarget?.type === "layer_bg_bottom" && !(activeSelectionTarget as any).imageId ? "selected" : ""
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectFile(file.id);
                                    onSelectTarget?.({
                                      type: "layer_bg_bottom",
                                    });
                                  }}
                                  title="Подложка: Bottom (Обратная сторона)"
                                >
                                  {bottomImages.length > 0 && (
                                    <button
                                      className="kicad-group-expand-btn"
                                      onClick={(e) => toggleGroupExpand(bottomKey, e)}
                                      title={isBottomExpanded ? "Свернуть снимки" : "Развернуть снимки"}
                                    >
                                      {isBottomExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                    </button>
                                  )}
                                  <button
                                    className="layer-vis-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(file.id, "bgBottom");
                                    }}
                                    title={boardData.bgBottom.visible ? "Скрыть Bottom" : "Показать Bottom"}
                                  >
                                    {boardData.bgBottom.visible ? (
                                      <Eye size={12} className="eye-on" />
                                    ) : (
                                      <EyeOff size={12} className="eye-off" />
                                    )}
                                  </button>
                                  <button
                                    className={`tree-lock-btn ${isBottomLocked ? "locked" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerLock?.(file.id, "bgBottom");
                                    }}
                                    title={isBottomLocked ? "Разблокировать подслой Bottom" : "Заблокировать подслой Bottom"}
                                  >
                                    {isBottomLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                  </button>
                                  <span className="layer-color-dot dot-bg-bottom" />
                                  <span className="layer-title">Bottom (Обратная)</span>
                                  {boardData.bgBottom.mirrored && <span className="layer-badge-flip">FLIP</span>}
                                  {bottomImagesCount > 0 && (
                                    <span className="layer-badge-sub-img">
                                      {bottomImagesCount > 1 ? `${bottomImagesCount}` : "1"}
                                    </span>
                                  )}
                                </div>

                                {/* Список снимков на Bottom */}
                                {isBottomExpanded && bottomImages.length > 0 && (
                                  <div className="kicad-images-subgroup">
                                    {bottomImages.map((img, idx) =>
                                      renderTreeImageItem(
                                        img,
                                        idx,
                                        "bgBottom",
                                        file,
                                        bottomImages,
                                        "Bottom (Обратная)",
                                        "#10b981",
                                        isActive
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* ===== ОСНОВНОЙ СЛОЙ 2: КОМПОНЕНТЫ ===== */}
                    {(() => {
                      const compsKey = `${file.id}_comps`;
                      const isCompsExpanded = isGroupExpanded(compsKey);
                      const isCompsVisible = boardData.showCompsTop || boardData.showCompsBottom;
                      const isCompsLocked = Boolean(
                        boardData.lockComps || (boardData.lockCompsTop && boardData.lockCompsBottom)
                      );
                      const isCompsActive =
                        isActive &&
                        (activeSelectionTarget?.type === "layer_comps_top" ||
                          activeSelectionTarget?.type === "layer_comps_bottom" ||
                          activeSelectionTarget?.type === "component");

                      return (
                        <div className="kicad-layer-group">
                          {/* Заголовок основного слоя: Компоненты */}
                          <div
                            className={`kicad-layer-group-header ${isCompsActive ? "group-active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectFile(file.id);
                              const targetSide =
                                activeSelectionTarget?.type === "layer_comps_bottom"
                                  ? "layer_comps_bottom"
                                  : "layer_comps_top";
                              onSelectTarget?.({ type: targetSide });
                            }}
                            title="Слой: Компоненты (нажмите для выбора, стрелка — раскрыть стороны)"
                          >
                            <button
                              className="kicad-group-expand-btn"
                              onClick={(e) => toggleGroupExpand(compsKey, e)}
                              title={isCompsExpanded ? "Свернуть стороны" : "Развернуть стороны"}
                            >
                              {isCompsExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>

                            <button
                              className="layer-vis-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerVisibility?.(file.id, "comps");
                              }}
                              title={isCompsVisible ? "Скрыть компоненты (обе стороны)" : "Показать компоненты"}
                            >
                              {isCompsVisible ? (
                                <Eye size={13} className="eye-on" />
                              ) : (
                                <EyeOff size={13} className="eye-off" />
                              )}
                            </button>

                            <button
                              className={`tree-lock-btn ${isCompsLocked ? "locked" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLayerLock?.(file.id, "comps");
                              }}
                              title={isCompsLocked ? "Разблокировать слой Компоненты (обе стороны)" : "Заблокировать слой Компоненты (обе стороны)"}
                            >
                              {isCompsLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>

                            <Cpu size={13} className="layer-group-icon icon-comps" />
                            <span className="layer-group-title">Компоненты</span>

                            <span className="layer-count-badge" title={`Всего деталей: ${boardData.components.length}`}>
                              {boardData.components.length}
                            </span>
                          </div>

                          {/* Виртуальные подслои: Top (Лицевая) и Bottom (Обратная) */}
                          {isCompsExpanded && (() => {
                            const isCompsTopLocked = Boolean(boardData.lockComps || boardData.lockCompsTop);
                            const isCompsBottomLocked = Boolean(boardData.lockComps || boardData.lockCompsBottom);

                            return (
                              <div className="kicad-sub-layers-list">
                                {/* Виртуальный подслой: Top */}
                                <div
                                  className={`kicad-layer-tree-item virtual-sub ${isActive && activeSelectionTarget?.type === "layer_comps_top" ? "selected" : ""
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectFile(file.id);
                                    onSelectTarget?.({ type: "layer_comps_top" });
                                  }}
                                  title="Компоненты: Top (Лицевая сторона)"
                                >
                                  <button
                                    className="layer-vis-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(file.id, "compsTop");
                                    }}
                                    title={boardData.showCompsTop ? "Скрыть Top" : "Показать Top"}
                                  >
                                    {boardData.showCompsTop ? (
                                      <Eye size={12} className="eye-on" />
                                    ) : (
                                      <EyeOff size={12} className="eye-off" />
                                    )}
                                  </button>
                                  <button
                                    className={`tree-lock-btn ${isCompsTopLocked ? "locked" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerLock?.(file.id, "compsTop");
                                    }}
                                    title={isCompsTopLocked ? "Разблокировать компоненты Top" : "Заблокировать компоненты Top"}
                                  >
                                    {isCompsTopLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                  </button>
                                  <span className="layer-color-dot dot-comps-top" />
                                  <span className="layer-title">Top (Лицевая)</span>
                                  <span className="layer-count-badge">{topCompsCount}</span>
                                </div>

                                {/* Виртуальный подслой: Bottom */}
                                <div
                                  className={`kicad-layer-tree-item virtual-sub ${isActive && activeSelectionTarget?.type === "layer_comps_bottom" ? "selected" : ""
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectFile(file.id);
                                    onSelectTarget?.({ type: "layer_comps_bottom" });
                                  }}
                                  title="Компоненты: Bottom (Обратная сторона)"
                                >
                                  <button
                                    className="layer-vis-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerVisibility?.(file.id, "compsBottom");
                                    }}
                                    title={boardData.showCompsBottom ? "Скрыть Bottom" : "Показать Bottom"}
                                  >
                                    {boardData.showCompsBottom ? (
                                      <Eye size={12} className="eye-on" />
                                    ) : (
                                      <EyeOff size={12} className="eye-off" />
                                    )}
                                  </button>
                                  <button
                                    className={`tree-lock-btn ${isCompsBottomLocked ? "locked" : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleLayerLock?.(file.id, "compsBottom");
                                    }}
                                    title={isCompsBottomLocked ? "Разблокировать компоненты Bottom" : "Заблокировать компоненты Bottom"}
                                  >
                                    {isCompsBottomLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                  </button>
                                  <span className="layer-color-dot dot-comps-bottom" />
                                  <span className="layer-title">Bottom (Обратная)</span>
                                  <span className="layer-count-badge">{bottomCompsCount}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}
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

    {/* Всплывающее окно быстрого просмотра изображения при наведении */}
    {hoveredPreview &&
      createPortal(
        <div
          className="cad-image-hover-card"
          style={{
            top: Math.max(10, Math.min(hoveredPreview.rect.top - 20, window.innerHeight - 290)),
            left: hoveredPreview.rect.right + 10,
          }}
          onMouseEnter={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          }}
          onMouseLeave={handleMouseLeaveThumb}
        >
          <div className="hover-card-header">
            <span
              className="hover-card-layer-badge"
              style={{ backgroundColor: hoveredPreview.layerColor }}
            >
              {hoveredPreview.layerTitle}
            </span>
            <span className="hover-card-title" title={hoveredPreview.img.name}>
              {hoveredPreview.img.name}
            </span>
          </div>

          <div className="hover-card-img-wrap">
            <img
              src={hoveredPreview.img.src}
              alt={hoveredPreview.img.name}
              style={{
                transform: hoveredPreview.img.mirrored ? "scaleX(-1)" : "none",
                filter: `brightness(${hoveredPreview.img.brightness || 100}%) contrast(${
                  hoveredPreview.img.contrast || 100
                }%) ${hoveredPreview.img.invert ? "invert(1)" : ""}`,
              }}
            />
          </div>

          <div className="hover-card-meta-grid">
            <div className="hover-meta-item">
              <span className="meta-label">Разрешение:</span>
              <span className="meta-value">
                {hoveredPreview.img.width && hoveredPreview.img.height
                  ? `${hoveredPreview.img.width} × ${hoveredPreview.img.height} px`
                  : "Оригинал"}
              </span>
            </div>
            <div className="hover-meta-item">
              <span className="meta-label">Масштаб:</span>
              <span className="meta-value">
                {Math.round((hoveredPreview.img.scale || 1) * 100)}%
              </span>
            </div>
            <div className="hover-meta-item">
              <span className="meta-label">Поворот:</span>
              <span className="meta-value">
                {(hoveredPreview.img.rotation || 0).toFixed(1)}°
              </span>
            </div>
            <div className="hover-meta-item">
              <span className="meta-label">Прозрачность:</span>
              <span className="meta-value">
                {Math.round((hoveredPreview.img.opacity ?? 1) * 100)}%
              </span>
            </div>
          </div>

          <div className="hover-card-footer">
            <button
              className="hover-card-crop-btn"
              onClick={() => {
                onSelectFile(hoveredPreview.fileId);
                onSelectTarget?.({
                  type: hoveredPreview.layerKey === "bgTop" ? "layer_bg_top" : "layer_bg_bottom",
                  imageId: hoveredPreview.img.id,
                });
                window.dispatchEvent(
                  new CustomEvent("mycad-preprocess-image", {
                    detail: {
                      layerKey: hoveredPreview.layerKey,
                      imageId: hoveredPreview.img.id,
                    },
                  })
                );
                setHoveredPreview(null);
              }}
              title="Обрезать, исправить перспективу или вырезать форму"
            >
              <Crop size={12} />
              <span>Обрезать / Перспектива</span>
            </button>
            <div className="hover-card-hint">
              <Crosshair size={10} />
              <span>Двойной клик в дереве — показать на холсте</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
