import React, { useState } from "react";
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

export const ProjectTree: React.FC = () => {
  const {
    manifest,
    boards,
    schematics,
    activeFileId,
    selectedImageId,
    selectImage,
    updateImageLayer,
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
    openModal,
  } = useUiStore();

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
                                  className={`cad-tree-icon-btn ${showSchematicBg ? "active" : ""}`}
                                  onClick={() => {
                                    if (!isActive) setActiveFile(file.id);
                                    setShowSchematicBg(!showSchematicBg);
                                  }}
                                  title={showSchematicBg ? "Скрыть подложку схемы" : "Показать подложку схемы"}
                                >
                                  {showSchematicBg ? <Eye size={12} /> : <EyeOff size={12} />}
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
                                    return (
                                      <div
                                        key={img.id}
                                        className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          selectImage(img.id);
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                          <ImageIcon size={11} color="#818cf8" style={{ flexShrink: 0 }} />
                                          <span className="cad-tree-item-name" style={{ fontSize: "11px" }}>
                                            {img.name}
                                          </span>
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
                                        className={`cad-tree-icon-btn ${showTopLayer ? "active" : ""}`}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          setShowTopLayer(!showTopLayer);
                                        }}
                                        title={showTopLayer ? "Скрыть слой Top" : "Показать слой Top"}
                                      >
                                        {showTopLayer ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                      <button
                                        className="cad-tree-icon-btn"
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
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
                                            openModal("preprocess");
                                          }}
                                        >
                                          <Plus size={11} />
                                          <span>Загрузить скан Top</span>
                                        </button>
                                      ) : (
                                        bgTopImages.map((img) => {
                                          const isSelected = selectedImageId === img.id && isActive;
                                          return (
                                            <div
                                              key={img.id}
                                              className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                              onClick={() => {
                                                if (!isActive) setActiveFile(file.id);
                                                selectImage(img.id);
                                              }}
                                            >
                                              <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                                <ImageIcon size={11} color="#f87171" style={{ flexShrink: 0 }} />
                                                <span className="cad-tree-item-name" style={{ fontSize: "11px" }}>
                                                  {img.name}
                                                </span>
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
                                        className={`cad-tree-icon-btn ${showBottomLayer ? "active" : ""}`}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          setShowBottomLayer(!showBottomLayer);
                                        }}
                                        title={showBottomLayer ? "Скрыть слой Bottom" : "Показать слой Bottom"}
                                      >
                                        {showBottomLayer ? <Eye size={12} /> : <EyeOff size={12} />}
                                      </button>
                                      <button
                                        className="cad-tree-icon-btn"
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
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
                                            openModal("preprocess");
                                          }}
                                        >
                                          <Plus size={11} />
                                          <span>Загрузить скан Bottom</span>
                                        </button>
                                      ) : (
                                        bgBottomImages.map((img) => {
                                          const isSelected = selectedImageId === img.id && isActive;
                                          return (
                                            <div
                                              key={img.id}
                                              className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                              onClick={() => {
                                                if (!isActive) setActiveFile(file.id);
                                                selectImage(img.id);
                                              }}
                                            >
                                              <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", flex: 1 }}>
                                                <ImageIcon size={11} color="#38bdf8" style={{ flexShrink: 0 }} />
                                                <span className="cad-tree-item-name" style={{ fontSize: "11px" }}>
                                                  {img.name}
                                                </span>
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
                          </div>

                          {/* ========================================================================= */}
                          {/* 2. КОМПОНЕНТЫ (СХЕМА РАСПОЛОЖЕНИЯ)                                       */}
                          {/* ========================================================================= */}
                          <div>
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
                            </div>

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
                            </div>

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

      {/* 3. Sidebar Resizer */}
      <div
        className="cad-sidebar-resizer-left"
        onMouseDown={handleMouseDown}
        title="Перетащите для изменения ширины дерева проекта"
      />
    </aside>
  );
};
