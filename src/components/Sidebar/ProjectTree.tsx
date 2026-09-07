import React, { useState, useEffect } from "react";
import {
  Folder,
  Cpu,
  Layers,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  X,
  FileCode,
  CircleDot,
  Network,
  Workflow,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { BoardImageLayer } from "../../types/cad";

interface ContextMenuState {
  x: number;
  y: number;
  targetImage?: BoardImageLayer;
  allSideImages: BoardImageLayer[];
  targetIds: string[];
  groupTitle: string;
}

export const ProjectTree: React.FC = () => {
  const {
    manifest,
    boards,
    schematics,
    activeFileId,
    selectedImageId,
    selectedImageIds,
    selectImage,
    toggleSelectImage,
    selectAllImages,
    clearSelectedImages,
    updateImageLayer,
    updateImageLayers,
    batchSetVisibility,
    batchSetLocked,
    batchDeleteLayers,
    deleteImageLayer,
    removeFile,
    renameFile,
    setActiveFile,
  } = useProjectStore();

  const {
    leftSidebarWidth,
    setLeftSidebarWidth,
    showTopLayer,
    setShowTopLayer,
    showBottomLayer,
    setShowBottomLayer,
    showTopComponents,
    setShowTopComponents,
    showBottomComponents,
    setShowBottomComponents,
    showSchematicBg,
    setShowSchematicBg,
    showSchematicWorking,
    setShowSchematicWorking,
    showTopCopper,
    setShowTopCopper,
    showBottomCopper,
    setShowBottomCopper,
    showVias,
    setShowVias,
    toggleAllCopper,
    toggleAllComponents,
    openModal,
    setPreprocessSide,
  } = useUiStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Collapsible groups
  const [schematicsGroupOpen, setSchematicsGroupOpen] = useState(true);
  const [boardsGroupOpen, setBoardsGroupOpen] = useState(true);
  const [expandedBoards, setExpandedBoards] = useState<Record<string, boolean>>({});
  const [expandedSchematics, setExpandedSchematics] = useState<Record<string, boolean>>({});
  const [expandedSides, setExpandedSides] = useState<Record<string, boolean>>({});

  // Inline rename state
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const files = manifest?.files || [];
  const schematicFiles = files.filter((f) => f.fileType === "schematic");
  const boardFiles = files.filter((f) => f.fileType === "board");

  const isBoardOpen = (id: string) => expandedBoards[id] ?? true;
  const toggleBoard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBoards((prev) => ({ ...prev, [id]: !isBoardOpen(id) }));
  };

  const isSchematicOpen = (id: string) => expandedSchematics[id] ?? true;
  const toggleSchematic = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSchematics((prev) => ({ ...prev, [id]: !isSchematicOpen(id) }));
  };

  const isSideOpen = (sideKey: string, defaultOpen = true) => expandedSides[sideKey] ?? defaultOpen;
  const toggleSide = (sideKey: string, e: React.MouseEvent, defaultOpen = true) => {
    e.stopPropagation();
    setExpandedSides((prev) => ({ ...prev, [sideKey]: !isSideOpen(sideKey, defaultOpen) }));
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFileId(id);
    setEditingName(currentName);
  };

  const submitRename = async (id: string) => {
    if (editingName.trim()) {
      await renameFile(id, editingName.trim());
    }
    setEditingFileId(null);
  };

  const handleRemove = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Удалить документ "${name}" из проекта?`)) {
      await removeFile(id);
    }
  };

  // Drag-to-resize left sidebar
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftSidebarWidth(Math.max(180, Math.min(600, newWidth)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <aside
      className="cad-sidebar cad-sidebar-left"
      style={{
        width: `${leftSidebarWidth}px`,
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* 1. Header with Project Name & Add Document Button */}
      <div
        className="cad-sidebar-header"
        style={{
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
          <Folder size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: "11.5px",
              color: "#f1f5f9",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={manifest?.name}
          >
            {manifest?.name || "Проект"}
          </span>
        </div>

        <button
          className="cad-tree-icon-btn"
          onClick={() => openModal("newDocument")}
          title="Добавить документ в проект"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 2. File Tree */}
      <div className="cad-sidebar-content" style={{ flex: 1, overflowY: "auto", padding: "6px 4px", gap: "6px" }}>
        {/* ========================================================================= */}
        {/* SECTION A: СХЕМЫ                                                         */}
        {/* ========================================================================= */}
        <div className="cad-tree-section">
          <div
            className="cad-tree-header"
            onClick={() => setSchematicsGroupOpen(!schematicsGroupOpen)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {schematicsGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Cpu size={13} color="#38bdf8" />
              <span>СХЕМЫ</span>
            </div>
            {schematicFiles.length > 0 && (
              <span className="cad-tree-badge">{schematicFiles.length}</span>
            )}
          </div>

          {schematicsGroupOpen && (
            <div className="cad-tree-items">
              {schematicFiles.length === 0 ? (
                <div style={{ padding: "4px 12px", fontSize: "11px", color: "#64748b" }}>
                  (нет схем)
                </div>
              ) : (
                schematicFiles.map((file) => {
                  const isActive = activeFileId === file.id;
                  const isOpen = isSchematicOpen(file.id);
                  const isEditing = editingFileId === file.id;

                  const schData = schematics.find((s) => s.id === file.id);
                  const bgImages = schData?.data?.bg?.images || [];
                  const compCount = schData?.data?.components?.length || 0;
                  const netsCount = schData?.data?.nets?.length || 0;

                  const schBgKey = `${file.id}_bg`;
                  const schWorkKey = `${file.id}_work`;
                  const isBgOpen = isSideOpen(schBgKey);
                  const isWorkOpen = isSideOpen(schWorkKey);

                  return (
                    <div key={file.id}>
                      {/* Schematic Document Row */}
                      <div
                        className={`cad-tree-item ${isActive ? "selected" : ""}`}
                        onClick={() => setActiveFile(file.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flex: 1 }}>
                          <span
                            onClick={(e) => toggleSchematic(file.id, e)}
                            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                          >
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>

                          <FileCode size={13} color="#38bdf8" style={{ flexShrink: 0 }} />

                          {isEditing ? (
                            <div
                              style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") submitRename(file.id);
                                  if (e.key === "Escape") setEditingFileId(null);
                                }}
                                style={{
                                  background: "#0f172a",
                                  border: "1px solid #38bdf8",
                                  color: "#fff",
                                  fontSize: "11px",
                                  padding: "2px 4px",
                                  borderRadius: "3px",
                                  width: "100%",
                                  outline: "none",
                                }}
                              />
                              <button
                                style={{ background: "transparent", border: "none", color: "#4ade80", cursor: "pointer", padding: "1px" }}
                                onClick={() => submitRename(file.id)}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "1px" }}
                                onClick={() => setEditingFileId(null)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="cad-tree-item-name"
                              title={file.name}
                              style={{
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? "#ffffff" : "#cbd5e1",
                              }}
                              onDoubleClick={(e) => startRename(file.id, file.name, e)}
                            >
                              {file.name}
                            </span>
                          )}
                        </div>

                        {/* Hover Actions */}
                        {!isEditing && (
                          <div className="cad-tree-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="cad-tree-icon-btn"
                              onClick={(e) => startRename(file.id, file.name, e)}
                              title="Переименовать"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              className="cad-tree-icon-btn"
                              onClick={(e) => handleRemove(file.id, file.name, e)}
                              title="Удалить схему"
                            >
                              <Trash2 size={11} color="#ef4444" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Schematic Layers Branch */}
                      {isOpen && (
                        <div className="cad-tree-branch">
                          {/* 1. Слой подложки (скан) */}
                          <div>
                            {(() => {
                              const isAllSchBgVisible = bgImages.length > 0 ? bgImages.every((img) => img.visible) && showSchematicBg : showSchematicBg;
                              const isAllSchBgLocked = bgImages.length > 0 && bgImages.every((img) => img.locked);
                              return (
                                <>
                                  <div
                                    className="cad-tree-item"
                                    onClick={(e) => toggleSide(schBgKey, e)}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                      <span>
                                        {isBgOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                      </span>
                                      <div className="cad-tree-swatch swatch-schematic" />
                                      <span className="cad-tree-item-name" style={{ color: "#e2e8f0" }}>
                                        Подложка (скан)
                                      </span>
                                      {bgImages.length > 0 && (
                                        <span className="cad-tree-badge">{bgImages.length}</span>
                                      )}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className={`cad-tree-icon-btn ${isAllSchBgVisible ? "active" : ""}`}
                                        onClick={async () => {
                                          if (!isActive) setActiveFile(file.id);
                                          const nextVis = !isAllSchBgVisible;
                                          setShowSchematicBg(nextVis);
                                          if (bgImages.length > 0) {
                                            await batchSetVisibility(bgImages.map((i) => i.id), nextVis);
                                          }
                                        }}
                                        title={isAllSchBgVisible ? "Скрыть все сканы схемы" : "Показать все сканы схемы"}
                                      >
                                        {isAllSchBgVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                      <button
                                        className="cad-tree-icon-btn"
                                        onClick={async () => {
                                          if (!isActive) setActiveFile(file.id);
                                          const nextLock = !isAllSchBgLocked;
                                          if (bgImages.length > 0) {
                                            await batchSetLocked(bgImages.map((i) => i.id), nextLock);
                                          }
                                        }}
                                        title={isAllSchBgLocked ? "Разблокировать все сканы схемы" : "Заблокировать все сканы схемы"}
                                      >
                                        {isAllSchBgLocked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                                      </button>
                                      <button
                                        className="cad-tree-icon-btn"
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          openModal("preprocess");
                                        }}
                                        title="Импортировать скан схемы"
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {isBgOpen && (
                                    <div className="cad-tree-subbranch">
                                      {bgImages.length === 0 ? (
                                        <button
                                          className="cad-tree-ghost-btn"
                                          onClick={() => {
                                            if (!isActive) setActiveFile(file.id);
                                            openModal("preprocess");
                                          }}
                                        >
                                          <Plus size={11} />
                                          <span>Загрузить скан</span>
                                        </button>
                                      ) : (
                                        bgImages.map((img) => {
                                          const isSelected = selectedImageId === img.id && isActive;
                                          const isMultiSelected = selectedImageIds.includes(img.id);
                                          return (
                                            <div
                                              key={img.id}
                                              className={`cad-tree-item ${isSelected ? "selected" : ""} ${isMultiSelected ? "multi-selected" : ""}`}
                                              onClick={(e) => {
                                                if (!isActive) setActiveFile(file.id);
                                                if (e.ctrlKey || e.metaKey) {
                                                  toggleSelectImage(img.id);
                                                } else if (e.shiftKey && selectedImageIds.length > 0) {
                                                  const lastId = selectedImageIds[selectedImageIds.length - 1];
                                                  const idx1 = bgImages.findIndex((i) => i.id === lastId);
                                                  const idx2 = bgImages.findIndex((i) => i.id === img.id);
                                                  if (idx1 >= 0 && idx2 >= 0) {
                                                    const [start, end] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
                                                    const rangeIds = bgImages.slice(start, end + 1).map((i) => i.id);
                                                    selectAllImages(Array.from(new Set([...selectedImageIds, ...rangeIds])));
                                                  } else {
                                                    selectImage(img.id);
                                                  }
                                                } else {
                                                  selectImage(img.id);
                                                }
                                              }}
                                              onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (!isActive) setActiveFile(file.id);
                                                const targetIds = isMultiSelected && selectedImageIds.length > 1 ? selectedImageIds : [img.id];
                                                setContextMenu({
                                                  x: e.clientX,
                                                  y: e.clientY,
                                                  targetImage: img,
                                                  allSideImages: bgImages,
                                                  targetIds,
                                                  groupTitle: "Подложка схемы",
                                                });
                                              }}
                                            >
                                              <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flex: 1 }}>
                                                <div
                                                  className={`cad-tree-checkbox ${isMultiSelected ? "checked" : ""}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!isActive) setActiveFile(file.id);
                                                    toggleSelectImage(img.id);
                                                  }}
                                                  title="Выбрать для групповых действий"
                                                >
                                                  {isMultiSelected && <Check size={9} color="#ffffff" />}
                                                </div>
                                                <ImageIcon size={11} color="#818cf8" style={{ flexShrink: 0 }} />
                                                <span className="cad-tree-item-name" style={{ fontSize: "11px" }}>
                                                  {img.name}
                                                </span>
                                                {img.locked && <Lock size={10} color="#f59e0b" style={{ flexShrink: 0 }} />}
                                              </div>
                                              <div className="cad-tree-actions" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  className="cad-tree-icon-btn"
                                                  onClick={() => updateImageLayer({ ...img, visible: !img.visible })}
                                                  title={img.visible ? "Скрыть" : "Показать"}
                                                >
                                                  {img.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                                </button>
                                                <button
                                                  className="cad-tree-icon-btn"
                                                  onClick={() => updateImageLayer({ ...img, locked: !img.locked })}
                                                  title={img.locked ? "Разблокировать" : "Заблокировать"}
                                                >
                                                  {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                                </button>
                                                <button
                                                  className="cad-tree-icon-btn"
                                                  onClick={() => deleteImageLayer(img.id)}
                                                  title="Удалить скан"
                                                >
                                                  <Trash2 size={11} color="#ef4444" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* 2. Слой схемы (Вектор) */}
                          <div>
                            <div
                              className="cad-tree-item"
                              onClick={(e) => toggleSide(schWorkKey, e)}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                <span>
                                  {isWorkOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                </span>
                                <div className="cad-tree-swatch swatch-copper" />
                                <span className="cad-tree-item-name" style={{ color: "#e2e8f0" }}>
                                  Схема (Вектор)
                                </span>
                              </div>

                              <div onClick={(e) => e.stopPropagation()}>
                                <button
                                  className={`cad-tree-icon-btn ${showSchematicWorking ? "active" : ""}`}
                                  onClick={() => {
                                    if (!isActive) setActiveFile(file.id);
                                    setShowSchematicWorking(!showSchematicWorking);
                                  }}
                                  title={showSchematicWorking ? "Скрыть векторную схему" : "Показать векторную схему"}
                                >
                                  {showSchematicWorking ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                              </div>
                            </div>

                            {isWorkOpen && (
                              <div className="cad-tree-subbranch">
                                <div className="cad-tree-item" style={{ cursor: "default" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Cpu size={11} color="#7dd3fc" />
                                    <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Компоненты (УГО)</span>
                                  </div>
                                  {compCount > 0 && <span className="cad-tree-badge">{compCount}</span>}
                                </div>
                                <div className="cad-tree-item" style={{ cursor: "default" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Network size={11} color="#34d399" />
                                    <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Электрические цепи</span>
                                  </div>
                                  {netsCount > 0 && <span className="cad-tree-badge">{netsCount}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION B: ПЛАТЫ                                                         */}
        {/* ========================================================================= */}
        <div className="cad-tree-section">
          <div
            className="cad-tree-header"
            onClick={() => setBoardsGroupOpen(!boardsGroupOpen)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {boardsGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Layers size={13} color="#60a5fa" />
              <span>ПЛАТЫ</span>
            </div>
            {boardFiles.length > 0 && (
              <span className="cad-tree-badge">{boardFiles.length}</span>
            )}
          </div>

          {boardsGroupOpen && (
            <div className="cad-tree-items">
              {boardFiles.length === 0 ? (
                <div style={{ padding: "4px 12px", fontSize: "11px", color: "#64748b" }}>
                  (нет плат)
                </div>
              ) : (
                boardFiles.map((file) => {
                  const isActive = activeFileId === file.id;
                  const isOpen = isBoardOpen(file.id);
                  const isEditing = editingFileId === file.id;

                  const boardData = boards.find((b) => b.id === file.id);
                  const bgTopImages = boardData?.data?.bgTop?.images || [];
                  const bgBottomImages = boardData?.data?.bgBottom?.images || [];
                  const viasCount = boardData?.data?.vias?.length || 0;

                  const boardComponents = boardData?.data?.components || [];
                  const topComponents = boardComponents.filter((c) => c.side === "top");
                  const botComponents = boardComponents.filter((c) => c.side === "bottom");
                  const totalComponentsCount = boardComponents.length;
                  const totalBgCount = bgTopImages.length + bgBottomImages.length;

                  const bgGroupKey = `${file.id}_bg_group`;
                  const compGroupKey = `${file.id}_comp_group`;
                  const copperKey = `${file.id}_copper`;

                  const topBgKey = `${file.id}_top_bg`;
                  const botBgKey = `${file.id}_bot_bg`;
                  const topCompKey = `${file.id}_top_comp`;
                  const botCompKey = `${file.id}_bot_comp`;

                  const isBgGroupOpen = isSideOpen(bgGroupKey, true);
                  const isCompGroupOpen = isSideOpen(compGroupKey, true);
                  const isCopperOpen = isSideOpen(copperKey, false);

                  const isTopBgOpen = isSideOpen(topBgKey, true);
                  const isBotBgOpen = isSideOpen(botBgKey, true);
                  const isTopCompOpen = isSideOpen(topCompKey, true);
                  const isBotCompOpen = isSideOpen(botCompKey, true);

                  return (
                    <div key={file.id}>
                      {/* Board Document Row */}
                      <div
                        className={`cad-tree-item ${isActive ? "selected" : ""}`}
                        onClick={() => setActiveFile(file.id)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flex: 1 }}>
                          <span
                            onClick={(e) => toggleBoard(file.id, e)}
                            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                          >
                            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>

                          <Layers size={13} color="#60a5fa" style={{ flexShrink: 0 }} />

                          {isEditing ? (
                            <div
                              style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") submitRename(file.id);
                                  if (e.key === "Escape") setEditingFileId(null);
                                }}
                                style={{
                                  background: "#0f172a",
                                  border: "1px solid #60a5fa",
                                  color: "#fff",
                                  fontSize: "11px",
                                  padding: "2px 4px",
                                  borderRadius: "3px",
                                  width: "100%",
                                  outline: "none",
                                }}
                              />
                              <button
                                style={{ background: "transparent", border: "none", color: "#4ade80", cursor: "pointer", padding: "1px" }}
                                onClick={() => submitRename(file.id)}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "1px" }}
                                onClick={() => setEditingFileId(null)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="cad-tree-item-name"
                              title={file.name}
                              style={{
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? "#ffffff" : "#cbd5e1",
                              }}
                              onDoubleClick={(e) => startRename(file.id, file.name, e)}
                            >
                              {file.name}
                            </span>
                          )}
                        </div>

                        {/* Hover Actions */}
                        {!isEditing && (
                          <div className="cad-tree-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="cad-tree-icon-btn"
                              onClick={(e) => startRename(file.id, file.name, e)}
                              title="Переименовать"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              className="cad-tree-icon-btn"
                              onClick={(e) => handleRemove(file.id, file.name, e)}
                              title="Удалить плату"
                            >
                              <Trash2 size={11} color="#ef4444" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Board Layers Branch */}
                      {isOpen && (
                        <div className="cad-tree-branch">
                          {/* ========================================================================= */}
                          {/* 1. ПОДЛОЖКА (СКАНИ / ФОТО)                                                */}
                          {/* ========================================================================= */}
                          <div>
                            {(() => {
                              const allBgImages = [...bgTopImages, ...bgBottomImages];
                              const isAllBgVisible = totalBgCount > 0 && allBgImages.every((img) => img.visible) && showTopLayer && showBottomLayer;
                              const isAllBgLocked = totalBgCount > 0 && allBgImages.every((img) => img.locked);

                              const isAllTopVisible = bgTopImages.length > 0 ? bgTopImages.every((img) => img.visible) && showTopLayer : showTopLayer;
                              const isAllTopLocked = bgTopImages.length > 0 && bgTopImages.every((img) => img.locked);

                              const isAllBotVisible = bgBottomImages.length > 0 ? bgBottomImages.every((img) => img.visible) && showBottomLayer : showBottomLayer;
                              const isAllBotLocked = bgBottomImages.length > 0 && bgBottomImages.every((img) => img.locked);

                              return (
                                <>
                                  <div
                                    className="cad-tree-item"
                                    onClick={(e) => toggleSide(bgGroupKey, e, true)}
                                    style={{ fontWeight: 600 }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                      <span>{isBgGroupOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                      <ImageIcon size={12} color="#818cf8" style={{ flexShrink: 0 }} />
                                      <span className="cad-tree-item-name" style={{ color: "#e2e8f0" }}>
                                        Подложка
                                      </span>
                                      {totalBgCount > 0 && <span className="cad-tree-badge">{totalBgCount}</span>}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className={`cad-tree-icon-btn ${isAllBgVisible ? "active" : ""}`}
                                        onClick={async () => {
                                          if (!isActive) setActiveFile(file.id);
                                          const nextVis = !isAllBgVisible;
                                          setShowTopLayer(nextVis);
                                          setShowBottomLayer(nextVis);
                                          if (allBgImages.length > 0) {
                                            await batchSetVisibility(allBgImages.map((i) => i.id), nextVis);
                                          }
                                        }}
                                        title={isAllBgVisible ? "Скрыть все сканы подложки (Top и Bottom)" : "Показать все сканы подложки (Top и Bottom)"}
                                      >
                                        {isAllBgVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                      <button
                                        className="cad-tree-icon-btn"
                                        onClick={async () => {
                                          if (!isActive) setActiveFile(file.id);
                                          const nextLock = !isAllBgLocked;
                                          if (allBgImages.length > 0) {
                                            await batchSetLocked(allBgImages.map((i) => i.id), nextLock);
                                          }
                                        }}
                                        title={isAllBgLocked ? "Разблокировать все сканы подложки" : "Заблокировать все сканы подложки"}
                                      >
                                        {isAllBgLocked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                                      </button>
                                    </div>
                                  </div>

                                  {isBgGroupOpen && (
                                    <div className="cad-tree-subbranch">
                                      {/* 1.1 Top (Лицевая) */}
                                      <div>
                                        <div
                                          className="cad-tree-item"
                                          onClick={(e) => toggleSide(topBgKey, e, true)}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                            <span>{isTopBgOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                            <div className="cad-tree-swatch swatch-top" />
                                            <span className="cad-tree-item-name" style={{ color: "#cbd5e1" }}>
                                              Top (Лицевая)
                                            </span>
                                            {bgTopImages.length > 0 && <span className="cad-tree-badge">{bgTopImages.length}</span>}
                                          </div>

                                          <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                              className={`cad-tree-icon-btn ${isAllTopVisible ? "active" : ""}`}
                                              onClick={async () => {
                                                if (!isActive) setActiveFile(file.id);
                                                const nextVis = !isAllTopVisible;
                                                setShowTopLayer(nextVis);
                                                if (bgTopImages.length > 0) {
                                                  await batchSetVisibility(bgTopImages.map((i) => i.id), nextVis);
                                                }
                                              }}
                                              title={isAllTopVisible ? "Скрыть слой Top и все сканы" : "Показать слой Top и все сканы"}
                                            >
                                              {isAllTopVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                            </button>
                                            <button
                                              className="cad-tree-icon-btn"
                                              onClick={async () => {
                                                if (!isActive) setActiveFile(file.id);
                                                const nextLock = !isAllTopLocked;
                                                if (bgTopImages.length > 0) {
                                                  await batchSetLocked(bgTopImages.map((i) => i.id), nextLock);
                                                }
                                              }}
                                              title={isAllTopLocked ? "Разблокировать все сканы Top" : "Заблокировать все сканы Top"}
                                            >
                                              {isAllTopLocked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                                            </button>
                                            <button
                                              className="cad-tree-icon-btn"
                                              onClick={() => {
                                                if (!isActive) setActiveFile(file.id);
                                                setPreprocessSide("top");
                                                openModal("preprocess");
                                              }}
                                              title="Импортировать скан Top"
                                            >
                                              <Plus size={12} />
                                            </button>
                                          </div>
                                        </div>

                                        {isTopBgOpen && (
                                          <div className="cad-tree-subbranch">
                                            {bgTopImages.length === 0 ? (
                                              <button
                                                className="cad-tree-ghost-btn"
                                                onClick={() => {
                                                  if (!isActive) setActiveFile(file.id);
                                                  setPreprocessSide("top");
                                                  openModal("preprocess");
                                                }}
                                              >
                                                <Plus size={11} />
                                                <span>Загрузить скан Top</span>
                                              </button>
                                            ) : (
                                              bgTopImages.map((img) => {
                                                const isSelected = selectedImageId === img.id && isActive;
                                                const isMultiSelected = selectedImageIds.includes(img.id);
                                                return (
                                                  <div
                                                    key={img.id}
                                                    className={`cad-tree-item ${isSelected ? "selected" : ""} ${isMultiSelected ? "multi-selected" : ""}`}
                                                    onClick={(e) => {
                                                      if (!isActive) setActiveFile(file.id);
                                                      if (e.ctrlKey || e.metaKey) {
                                                        toggleSelectImage(img.id);
                                                      } else if (e.shiftKey && selectedImageIds.length > 0) {
                                                        const lastId = selectedImageIds[selectedImageIds.length - 1];
                                                        const idx1 = bgTopImages.findIndex((i) => i.id === lastId);
                                                        const idx2 = bgTopImages.findIndex((i) => i.id === img.id);
                                                        if (idx1 >= 0 && idx2 >= 0) {
                                                          const [start, end] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
                                                          const rangeIds = bgTopImages.slice(start, end + 1).map((i) => i.id);
                                                          selectAllImages(Array.from(new Set([...selectedImageIds, ...rangeIds])));
                                                        } else {
                                                          selectImage(img.id);
                                                        }
                                                      } else {
                                                        selectImage(img.id);
                                                      }
                                                    }}
                                                    onContextMenu={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      if (!isActive) setActiveFile(file.id);
                                                      const targetIds = isMultiSelected && selectedImageIds.length > 1 ? selectedImageIds : [img.id];
                                                      setContextMenu({
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        targetImage: img,
                                                        allSideImages: bgTopImages,
                                                        targetIds,
                                                        groupTitle: "Top сканы",
                                                      });
                                                    }}
                                                  >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flex: 1 }}>
                                                      <div
                                                        className={`cad-tree-checkbox ${isMultiSelected ? "checked" : ""}`}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (!isActive) setActiveFile(file.id);
                                                          toggleSelectImage(img.id);
                                                        }}
                                                        title="Выбрать для групповых действий"
                                                      >
                                                        {isMultiSelected && <Check size={9} color="#ffffff" />}
                                                      </div>
                                                      <ImageIcon size={11} color="#f87171" style={{ flexShrink: 0 }} />
                                                      <span className="cad-tree-item-name" style={{ fontSize: "11px" }}>
                                                        {img.name}
                                                      </span>
                                                      {img.locked && <Lock size={10} color="#f59e0b" style={{ flexShrink: 0 }} />}
                                                    </div>
                                                    <div className="cad-tree-actions" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                                                      <button
                                                        className="cad-tree-icon-btn"
                                                        onClick={() => updateImageLayer({ ...img, visible: !img.visible })}
                                                        title={img.visible ? "Скрыть" : "Показать"}
                                                      >
                                                        {img.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                                      </button>
                                                      <button
                                                        className="cad-tree-icon-btn"
                                                        onClick={() => updateImageLayer({ ...img, locked: !img.locked })}
                                                        title={img.locked ? "Разблокировать" : "Заблокировать"}
                                                      >
                                                        {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                                      </button>
                                                      <button
                                                        className="cad-tree-icon-btn"
                                                        onClick={() => deleteImageLayer(img.id)}
                                                        title="Удалить скан"
                                                      >
                                                        <Trash2 size={11} color="#ef4444" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* 1.2 Bottom (Оборотная) */}
                                      <div>
                                        <div
                                          className="cad-tree-item"
                                          onClick={(e) => toggleSide(botBgKey, e, true)}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                            <span>{isBotBgOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                            <div className="cad-tree-swatch swatch-bottom" />
                                            <span className="cad-tree-item-name" style={{ color: "#cbd5e1" }}>
                                              Bottom (Оборотная)
                                            </span>
                                            {bgBottomImages.length > 0 && <span className="cad-tree-badge">{bgBottomImages.length}</span>}
                                          </div>

                                          <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                            <button
                                              className={`cad-tree-icon-btn ${isAllBotVisible ? "active" : ""}`}
                                              onClick={async () => {
                                                if (!isActive) setActiveFile(file.id);
                                                const nextVis = !isAllBotVisible;
                                                setShowBottomLayer(nextVis);
                                                if (bgBottomImages.length > 0) {
                                                  await batchSetVisibility(bgBottomImages.map((i) => i.id), nextVis);
                                                }
                                              }}
                                              title={isAllBotVisible ? "Скрыть слой Bottom и все сканы" : "Показать слой Bottom и все сканы"}
                                            >
                                              {isAllBotVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                            </button>
                                            <button
                                              className="cad-tree-icon-btn"
                                              onClick={async () => {
                                                if (!isActive) setActiveFile(file.id);
                                                const nextLock = !isAllBotLocked;
                                                if (bgBottomImages.length > 0) {
                                                  await batchSetLocked(bgBottomImages.map((i) => i.id), nextLock);
                                                }
                                              }}
                                              title={isAllBotLocked ? "Разблокировать все сканы Bottom" : "Заблокировать все сканы Bottom"}
                                            >
                                              {isAllBotLocked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                                            </button>
                                            <button
                                              className="cad-tree-icon-btn"
                                              onClick={() => {
                                                if (!isActive) setActiveFile(file.id);
                                                setPreprocessSide("bottom");
                                                openModal("preprocess");
                                              }}
                                              title="Импортировать скан Bottom"
                                            >
                                              <Plus size={12} />
                                            </button>
                                          </div>
                                        </div>

                                        {isBotBgOpen && (
                                          <div className="cad-tree-subbranch">
                                            {bgBottomImages.length === 0 ? (
                                              <button
                                                className="cad-tree-ghost-btn"
                                                onClick={() => {
                                                  if (!isActive) setActiveFile(file.id);
                                                  setPreprocessSide("bottom");
                                                  openModal("preprocess");
                                                }}
                                              >
                                                <Plus size={11} />
                                                <span>Загрузить скан Bottom</span>
                                              </button>
                                            ) : (
                                              bgBottomImages.map((img) => {
                                                const isSelected = selectedImageId === img.id && isActive;
                                                const isMultiSelected = selectedImageIds.includes(img.id);
                                                return (
                                                  <div
                                                    key={img.id}
                                                    className={`cad-tree-item ${isSelected ? "selected" : ""} ${isMultiSelected ? "multi-selected" : ""}`}
                                                    onClick={(e) => {
                                                      if (!isActive) setActiveFile(file.id);
                                                      if (e.ctrlKey || e.metaKey) {
                                                        toggleSelectImage(img.id);
                                                      } else if (e.shiftKey && selectedImageIds.length > 0) {
                                                        const lastId = selectedImageIds[selectedImageIds.length - 1];
                                                        const idx1 = bgBottomImages.findIndex((i) => i.id === lastId);
                                                        const idx2 = bgBottomImages.findIndex((i) => i.id === img.id);
                                                        if (idx1 >= 0 && idx2 >= 0) {
                                                          const [start, end] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
                                                          const rangeIds = bgBottomImages.slice(start, end + 1).map((i) => i.id);
                                                          selectAllImages(Array.from(new Set([...selectedImageIds, ...rangeIds])));
                                                        } else {
                                                          selectImage(img.id);
                                                        }
                                                      } else {
                                                        selectImage(img.id);
                                                      }
                                                    }}
                                                    onContextMenu={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      if (!isActive) setActiveFile(file.id);
                                                      const targetIds = isMultiSelected && selectedImageIds.length > 1 ? selectedImageIds : [img.id];
                                                      setContextMenu({
                                                        x: e.clientX,
                                                        y: e.clientY,
                                                        targetImage: img,
                                                        allSideImages: bgBottomImages,
                                                        targetIds,
                                                        groupTitle: "Bottom сканы",
                                                      });
                                                    }}
                                                  >
                                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", flex: 1 }}>
                                                      <div
                                                        className={`cad-tree-checkbox ${isMultiSelected ? "checked" : ""}`}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (!isActive) setActiveFile(file.id);
                                                          toggleSelectImage(img.id);
                                                        }}
                                                        title="Выбрать для групповых действий"
                                                      >
                                                        {isMultiSelected && <Check size={9} color="#ffffff" />}
                                                      </div>
                                                      <ImageIcon size={11} color="#38bdf8" style={{ flexShrink: 0 }} />
                                                      <span className="cad-tree-item-name" style={{ fontSize: "11px" }}>
                                                        {img.name}
                                                      </span>
                                                      {img.locked && <Lock size={10} color="#f59e0b" style={{ flexShrink: 0 }} />}
                                                    </div>
                                                    <div className="cad-tree-actions" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                                                      <button
                                                        className="cad-tree-icon-btn"
                                                        onClick={() => updateImageLayer({ ...img, visible: !img.visible })}
                                                        title={img.visible ? "Скрыть" : "Показать"}
                                                      >
                                                        {img.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                                      </button>
                                                      <button
                                                        className="cad-tree-icon-btn"
                                                        onClick={() => updateImageLayer({ ...img, locked: !img.locked })}
                                                        title={img.locked ? "Разблокировать" : "Заблокировать"}
                                                      >
                                                        {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                                      </button>
                                                      <button
                                                        className="cad-tree-icon-btn"
                                                        onClick={() => deleteImageLayer(img.id)}
                                                        title="Удалить скан"
                                                      >
                                                        <Trash2 size={11} color="#ef4444" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* ========================================================================= */}
                          {/* 2. КОМПОНЕНТЫ (СХЕМА РАСПОЛОЖЕНИЯ)                                       */}
                          {/* ========================================================================= */}
                          <div>
                            {(() => {
                              const isAllComponentsVisible = showTopComponents && showBottomComponents;
                              return (
                                <div
                                  className="cad-tree-item"
                                  onClick={(e) => toggleSide(compGroupKey, e, true)}
                                  style={{ fontWeight: 600 }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                    <span>{isCompGroupOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                    <Cpu size={12} color="#a855f7" style={{ flexShrink: 0 }} />
                                    <span className="cad-tree-item-name" style={{ color: "#e2e8f0" }}>
                                      Компоненты
                                    </span>
                                    {totalComponentsCount > 0 && (
                                      <span className="cad-tree-badge">{totalComponentsCount}</span>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className={`cad-tree-icon-btn ${isAllComponentsVisible ? "active" : ""}`}
                                      onClick={() => {
                                        if (!isActive) setActiveFile(file.id);
                                        toggleAllComponents(!isAllComponentsVisible);
                                      }}
                                      title={isAllComponentsVisible ? "Скрыть все компоненты (Top и Bottom)" : "Показать все компоненты (Top и Bottom)"}
                                    >
                                      {isAllComponentsVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {isCompGroupOpen && (
                              <div className="cad-tree-subbranch">
                                {/* 2.1 Top Components */}
                                <div>
                                  <div
                                    className="cad-tree-item"
                                    onClick={(e) => toggleSide(topCompKey, e, true)}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                      <span>{isTopCompOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                      <div className="cad-tree-swatch swatch-top" />
                                      <span className="cad-tree-item-name" style={{ color: "#cbd5e1" }}>
                                        Top (Лицевой монтаж)
                                      </span>
                                      {topComponents.length > 0 && <span className="cad-tree-badge">{topComponents.length}</span>}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className={`cad-tree-icon-btn ${showTopComponents ? "active" : ""}`}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          setShowTopComponents(!showTopComponents);
                                        }}
                                        title={showTopComponents ? "Скрыть компоненты Top" : "Показать компоненты Top"}
                                      >
                                        {showTopComponents ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                    </div>
                                  </div>

                                  {isTopCompOpen && (
                                    <div className="cad-tree-subbranch">
                                      {topComponents.length === 0 ? (
                                        <div style={{ padding: "3px 12px", fontSize: "10.5px", color: "#64748b", fontStyle: "italic" }}>
                                          (нет компонентов)
                                        </div>
                                      ) : (
                                        topComponents.map((comp) => (
                                          <div key={comp.id} className="cad-tree-item" style={{ fontSize: "11px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                              <CircleDot size={10} color="#f87171" style={{ flexShrink: 0 }} />
                                              <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{comp.refDes}</span>
                                              {comp.name && <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>{comp.name}</span>}
                                              {comp.package && <span style={{ color: "#64748b", fontSize: "10px" }}>({comp.package})</span>}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* 2.2 Bottom Components */}
                                <div>
                                  <div
                                    className="cad-tree-item"
                                    onClick={(e) => toggleSide(botCompKey, e, true)}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                      <span>{isBotCompOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                      <div className="cad-tree-swatch swatch-bottom" />
                                      <span className="cad-tree-item-name" style={{ color: "#cbd5e1" }}>
                                        Bottom (Оборотный монтаж)
                                      </span>
                                      {botComponents.length > 0 && <span className="cad-tree-badge">{botComponents.length}</span>}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className={`cad-tree-icon-btn ${showBottomComponents ? "active" : ""}`}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          setShowBottomComponents(!showBottomComponents);
                                        }}
                                        title={showBottomComponents ? "Скрыть компоненты Bottom" : "Показать компоненты Bottom"}
                                      >
                                        {showBottomComponents ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                    </div>
                                  </div>

                                  {isBotCompOpen && (
                                    <div className="cad-tree-subbranch">
                                      {botComponents.length === 0 ? (
                                        <div style={{ padding: "3px 12px", fontSize: "10.5px", color: "#64748b", fontStyle: "italic" }}>
                                          (нет компонентов)
                                        </div>
                                      ) : (
                                        botComponents.map((comp) => (
                                          <div key={comp.id} className="cad-tree-item" style={{ fontSize: "11px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                              <CircleDot size={10} color="#38bdf8" style={{ flexShrink: 0 }} />
                                              <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{comp.refDes}</span>
                                              {comp.name && <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>{comp.name}</span>}
                                              {comp.package && <span style={{ color: "#64748b", fontSize: "10px" }}>({comp.package})</span>}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* ========================================================================= */}
                          {/* 3. СЛОИ ТОПОЛОГИИ (МЕДЬ) — Сворачиваемый блок                            */}
                          {/* ========================================================================= */}
                          <div>
                            {(() => {
                              const isAllCopperVisible = showTopCopper && showBottomCopper && showVias;
                              return (
                                <div
                                  className="cad-tree-item"
                                  onClick={(e) => toggleSide(copperKey, e, false)}
                                  style={{ opacity: 0.9 }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                    <span>
                                      {isCopperOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                    </span>
                                    <div className="cad-tree-swatch swatch-copper" />
                                    <span className="cad-tree-item-name" style={{ color: "#cbd5e1" }}>
                                      Слои топологии (медь)
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "2px" }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className={`cad-tree-icon-btn ${isAllCopperVisible ? "active" : ""}`}
                                      onClick={() => {
                                        if (!isActive) setActiveFile(file.id);
                                        toggleAllCopper(!isAllCopperVisible);
                                      }}
                                      title={isAllCopperVisible ? "Скрыть все медные слои и Vias" : "Показать все медные слои и Vias"}
                                    >
                                      {isAllCopperVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {isCopperOpen && (
                              <div className="cad-tree-subbranch">
                                {/* Top Copper */}
                                <div className="cad-tree-item">
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <div className="cad-tree-swatch swatch-top" />
                                    <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Top Copper (Лицевой)</span>
                                  </div>
                                  <button
                                    className={`cad-tree-icon-btn ${showTopCopper ? "active" : ""}`}
                                    onClick={() => {
                                      if (!isActive) setActiveFile(file.id);
                                      setShowTopCopper(!showTopCopper);
                                    }}
                                    title={showTopCopper ? "Скрыть Top Copper" : "Показать Top Copper"}
                                  >
                                    {showTopCopper ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>
                                </div>

                                {/* Bottom Copper */}
                                <div className="cad-tree-item">
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <div className="cad-tree-swatch swatch-bottom" />
                                    <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Bottom Copper (Оборотный)</span>
                                  </div>
                                  <button
                                    className={`cad-tree-icon-btn ${showBottomCopper ? "active" : ""}`}
                                    onClick={() => {
                                      if (!isActive) setActiveFile(file.id);
                                      setShowBottomCopper(!showBottomCopper);
                                    }}
                                    title={showBottomCopper ? "Скрыть Bottom Copper" : "Показать Bottom Copper"}
                                  >
                                    {showBottomCopper ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>
                                </div>

                                {/* Vias */}
                                <div className="cad-tree-item">
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <div className="cad-tree-swatch swatch-vias" />
                                    <span style={{ fontSize: "11px", color: "#cbd5e1" }}>Переходные отв. (Vias)</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    {viasCount > 0 && <span className="cad-tree-badge">{viasCount}</span>}
                                    <button
                                      className={`cad-tree-icon-btn ${showVias ? "active" : ""}`}
                                      onClick={() => {
                                        if (!isActive) setActiveFile(file.id);
                                        setShowVias(!showVias);
                                      }}
                                      title={showVias ? "Скрыть Vias" : "Показать Vias"}
                                    >
                                      {showVias ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Batch Selection Action Bar */}
      {selectedImageIds.length > 0 && (
        <div className="cad-batch-bar" onClick={(e) => e.stopPropagation()}>
          <div className="cad-batch-header">
            <span>Выбрано слоев:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="cad-batch-count">{selectedImageIds.length}</span>
              <button
                className="cad-tree-icon-btn"
                style={{ width: "16px", height: "16px" }}
                onClick={clearSelectedImages}
                title="Снять выбор со всех слоев"
              >
                <X size={11} />
              </button>
            </div>
          </div>
          <div className="cad-batch-buttons">
            <button
              className="cad-batch-btn"
              onClick={() => batchSetVisibility(selectedImageIds, true)}
              title="Показать все выбранные слои"
            >
              <Eye size={11} color="#38bdf8" />
              <span>Показать</span>
            </button>
            <button
              className="cad-batch-btn"
              onClick={() => batchSetVisibility(selectedImageIds, false)}
              title="Скрыть все выбранные слои"
            >
              <EyeOff size={11} color="#94a3b8" />
              <span>Скрыть</span>
            </button>
            <button
              className="cad-batch-btn"
              onClick={() => batchSetLocked(selectedImageIds, true)}
              title="Заблокировать все выбранные слои"
            >
              <Lock size={11} color="#f59e0b" />
              <span>Блок.</span>
            </button>
            <button
              className="cad-batch-btn"
              onClick={() => batchSetLocked(selectedImageIds, false)}
              title="Разблокировать все выбранные слои"
            >
              <Unlock size={11} color="#10b981" />
              <span>Разблок.</span>
            </button>
          </div>
          <button
            className="cad-batch-btn danger"
            style={{ width: "100%", marginTop: "2px" }}
            onClick={() => {
              if (window.confirm(`Удалить ${selectedImageIds.length} выбранных слоев?`)) {
                batchDeleteLayers(selectedImageIds);
              }
            }}
            title="Удалить все выбранные слои"
          >
            <Trash2 size={11} />
            <span>Удалить выбранные ({selectedImageIds.length})</span>
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="cad-context-menu"
          style={{
            top: `${Math.min(window.innerHeight - 220, Math.max(10, contextMenu.y))}px`,
            left: `${Math.min(window.innerWidth - 230, Math.max(10, contextMenu.x))}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.targetImage && (
            <div
              className="cad-context-item"
              onClick={async () => {
                const others = contextMenu.allSideImages.filter((i) => i.id !== contextMenu.targetImage!.id);
                if (others.length > 0) {
                  await batchSetVisibility(others.map((i) => i.id), false);
                }
                await updateImageLayer({ ...contextMenu.targetImage!, visible: true });
                setContextMenu(null);
              }}
            >
              <Eye size={12} color="#38bdf8" />
              <span>Изолировать (скрыть остальные)</span>
            </div>
          )}
          <div
            className="cad-context-item"
            onClick={async () => {
              await batchSetVisibility(contextMenu.targetIds, true);
              setContextMenu(null);
            }}
          >
            <Eye size={12} />
            <span>Показать {contextMenu.targetIds.length > 1 ? `выбранные (${contextMenu.targetIds.length})` : "этот слой"}</span>
          </div>
          <div
            className="cad-context-item"
            onClick={async () => {
              await batchSetVisibility(contextMenu.targetIds, false);
              setContextMenu(null);
            }}
          >
            <EyeOff size={12} />
            <span>Скрыть {contextMenu.targetIds.length > 1 ? `выбранные (${contextMenu.targetIds.length})` : "этот слой"}</span>
          </div>
          <div className="cad-context-divider" />
          <div
            className="cad-context-item"
            onClick={async () => {
              await batchSetLocked(contextMenu.targetIds, true);
              setContextMenu(null);
            }}
          >
            <Lock size={12} color="#f59e0b" />
            <span>Заблокировать {contextMenu.targetIds.length > 1 ? `выбранные (${contextMenu.targetIds.length})` : "этот слой"}</span>
          </div>
          <div
            className="cad-context-item"
            onClick={async () => {
              await batchSetLocked(contextMenu.targetIds, false);
              setContextMenu(null);
            }}
          >
            <Unlock size={12} color="#10b981" />
            <span>Разблокировать {contextMenu.targetIds.length > 1 ? `выбранные (${contextMenu.targetIds.length})` : "этот слой"}</span>
          </div>
          <div className="cad-context-divider" />
          {contextMenu.allSideImages.length > 0 && (
            <div
              className="cad-context-item"
              onClick={() => {
                selectAllImages(contextMenu.allSideImages.map((i) => i.id));
                setContextMenu(null);
              }}
            >
              <Check size={12} />
              <span>Выбрать все в «{contextMenu.groupTitle}»</span>
            </div>
          )}
          {contextMenu.targetIds.length > 1 && (
            <div
              className="cad-context-item danger"
              onClick={async () => {
                if (window.confirm(`Удалить ${contextMenu.targetIds.length} выбранных слоев?`)) {
                  await batchDeleteLayers(contextMenu.targetIds);
                }
                setContextMenu(null);
              }}
            >
              <Trash2 size={12} color="#ef4444" />
              <span>Удалить выбранные ({contextMenu.targetIds.length})</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Sidebar Resizer */}
      <div
        className="cad-sidebar-resizer-left"
        onMouseDown={handleMouseDown}
        title="Перетащите для изменения ширины дерева проекта"
      />
    </aside>
  );
};
