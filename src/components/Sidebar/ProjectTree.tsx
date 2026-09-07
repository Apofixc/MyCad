import React, { useState } from "react";
import {
  Folder,
  FolderPlus,
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
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const ProjectTree: React.FC = () => {
  const {
    manifest,
    activeFileId,
    board,
    schematic,
    selectedImageId,
    selectImage,
    updateImageLayer,
    deleteImageLayer,
    addBoard,
    addSchematic,
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
    openModal,
  } = useUiStore();

  // Collapsible section states
  const [schematicsOpen, setSchematicsOpen] = useState(true);
  const [boardsOpen, setBoardsOpen] = useState(true);
  const [expandedBoards, setExpandedBoards] = useState<Record<string, boolean>>({});
  const [topSidesOpen, setTopSidesOpen] = useState<Record<string, boolean>>({});
  const [botSidesOpen, setBotSidesOpen] = useState<Record<string, boolean>>({});

  // Inline rename state
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Add menu popup state
  const [showAddMenu, setShowAddMenu] = useState(false);

  const files = manifest?.files || [];
  const schematicFiles = files.filter((f) => f.fileType === "schematic");
  const boardFiles = files.filter((f) => f.fileType === "board");

  const isBoardExpanded = (id: string) => expandedBoards[id] ?? true;
  const toggleBoardExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBoards((prev) => ({ ...prev, [id]: !isBoardExpanded(id) }));
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

  // Sidebar drag-to-resize logic
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftSidebarWidth(Math.max(200, Math.min(480, newWidth)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <aside className="cad-sidebar cad-sidebar-left" style={{ width: `${leftSidebarWidth}px`, display: "flex", flexDirection: "column" }}>
      {/* Project Header */}
      <div className="cad-sidebar-header" style={{ position: "relative", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          <Folder size={15} color="#3b82f6" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: "12px",
              color: "#f1f5f9",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={manifest?.name}
          >
            {manifest?.name || "Дерево проекта"}
          </span>
        </div>

        {/* Add File Button with Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            style={{
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60a5fa",
              borderRadius: "4px",
              padding: "3px 6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
            }}
            onClick={() => setShowAddMenu(!showAddMenu)}
            title="Добавить в проект..."
          >
            <Plus size={13} />
            <span>Добавить</span>
          </button>

          {showAddMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                background: "#1e293b",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "6px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
                zIndex: 100,
                minWidth: "190px",
                padding: "4px",
              }}
            >
              <button
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  color: "#f1f5f9",
                  fontSize: "12px",
                  textAlign: "left",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => {
                  setShowAddMenu(false);
                  addBoard();
                }}
              >
                <Layers size={14} color="#60a5fa" />
                <span>Схема платы</span>
              </button>

              <button
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  color: "#f1f5f9",
                  fontSize: "12px",
                  textAlign: "left",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => {
                  setShowAddMenu(false);
                  addSchematic();
                }}
              >
                <Cpu size={14} color="#38bdf8" />
                <span>Принципиальная схема</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Content Tree */}
      <div className="cad-sidebar-content" style={{ flex: 1, overflowY: "auto" }}>
        {files.length === 0 ? (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <FolderPlus size={32} color="#64748b" />
            <div style={{ fontSize: "12px", color: "var(--cad-text-muted)" }}>
              В проекте нет файлов
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "7px 10px",
                  background: "rgba(59, 130, 246, 0.12)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  color: "#60a5fa",
                  borderRadius: "6px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
                onClick={() => addBoard()}
              >
                <Plus size={13} />
                <span>Создать схему платы</span>
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "7px 10px",
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  color: "#38bdf8",
                  borderRadius: "6px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
                onClick={() => addSchematic()}
              >
                <Plus size={13} />
                <span>Создать принципиальную схему</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Section 1: ПРИНЦИПИАЛЬНЫЕ СХЕМЫ */}
            <div className="cad-tree-section">
              <div
                className="cad-tree-header"
                style={{ padding: "6px 10px", cursor: "pointer" }}
                onClick={() => setSchematicsOpen(!schematicsOpen)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {schematicsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <Cpu size={13} color="#38bdf8" />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#cbd5e1" }}>
                    Принципиальные схемы
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    ({schematicFiles.length})
                  </span>
                </div>
                <button
                  style={{ background: "transparent", border: "none", color: "#38bdf8", cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    addSchematic();
                  }}
                  title="Добавить принципиальную схему"
                >
                  <Plus size={13} />
                </button>
              </div>

              {schematicsOpen && (
                <div className="cad-tree-items">
                  {schematicFiles.length === 0 ? (
                    <div style={{ padding: "6px 12px 6px 26px", fontSize: "11px", color: "var(--cad-text-dim)" }}>
                      Нет схем. Нажмите [+]
                    </div>
                  ) : (
                    schematicFiles.map((f) => {
                      const isActive = activeFileId === f.id;
                      const isEditing = editingFileId === f.id;

                      return (
                        <div
                          key={f.id}
                          className={`cad-tree-item ${isActive ? "selected" : ""}`}
                          style={{ paddingLeft: "24px", cursor: "pointer" }}
                          onClick={() => setActiveFile(f.id)}
                        >
                          <FileCode size={13} color="#38bdf8" />

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
                                  if (e.key === "Enter") submitRename(f.id);
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
                                }}
                              />
                              <button
                                style={{ background: "transparent", border: "none", color: "#4ade80", cursor: "pointer" }}
                                onClick={() => submitRename(f.id)}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                                onClick={() => setEditingFileId(null)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                className="cad-tree-item-name"
                                title={f.name}
                                onDoubleClick={(e) => startRename(f.id, f.name, e)}
                              >
                                {f.name}
                              </span>
                              <button
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--cad-text-dim)",
                                  cursor: "pointer",
                                  opacity: 0.7,
                                }}
                                onClick={(e) => startRename(f.id, f.name, e)}
                                title="Переименовать"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--cad-text-dim)",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => handleRemove(f.id, f.name, e)}
                                title="Удалить схему"
                              >
                                <Trash2 size={11} color="#ef4444" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Section 2: СХЕМЫ ПЛАТ */}
            <div className="cad-tree-section">
              <div
                className="cad-tree-header"
                style={{ padding: "6px 10px", cursor: "pointer" }}
                onClick={() => setBoardsOpen(!boardsOpen)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {boardsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <Layers size={13} color="#60a5fa" />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#cbd5e1" }}>
                    Схемы плат
                  </span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    ({boardFiles.length})
                  </span>
                </div>
                <button
                  style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    addBoard();
                  }}
                  title="Добавить схему платы"
                >
                  <Plus size={13} />
                </button>
              </div>

              {boardsOpen && (
                <div className="cad-tree-items">
                  {boardFiles.length === 0 ? (
                    <div style={{ padding: "6px 12px 6px 26px", fontSize: "11px", color: "var(--cad-text-dim)" }}>
                      Нет плат. Нажмите [+]
                    </div>
                  ) : (
                    boardFiles.map((f) => {
                      const isActive = activeFileId === f.id;
                      const expanded = isBoardExpanded(f.id);
                      const isEditing = editingFileId === f.id;

                      const activeBoardData = isActive ? board?.data : null;
                      const bgTopImages = activeBoardData?.bgTop.images || [];
                      const bgBottomImages = activeBoardData?.bgBottom.images || [];

                      const isTopSideOpen = topSidesOpen[f.id] ?? true;
                      const isBotSideOpen = botSidesOpen[f.id] ?? true;

                      return (
                        <div key={f.id} style={{ display: "flex", flexDirection: "column" }}>
                          {/* Board Header Item */}
                          <div
                            className={`cad-tree-item ${isActive ? "selected" : ""}`}
                            style={{ paddingLeft: "16px", cursor: "pointer" }}
                            onClick={() => setActiveFile(f.id)}
                          >
                            <span onClick={(e) => toggleBoardExpand(f.id, e)} style={{ display: "flex", alignItems: "center" }}>
                              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                            <Layers size={13} color="#60a5fa" />

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
                                    if (e.key === "Enter") submitRename(f.id);
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
                                  }}
                                />
                                <button
                                  style={{ background: "transparent", border: "none", color: "#4ade80", cursor: "pointer" }}
                                  onClick={() => submitRename(f.id)}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                                  onClick={() => setEditingFileId(null)}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span
                                  className="cad-tree-item-name"
                                  title={f.name}
                                  onDoubleClick={(e) => startRename(f.id, f.name, e)}
                                >
                                  {f.name}
                                </span>
                                <button
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--cad-text-dim)",
                                    cursor: "pointer",
                                    opacity: 0.7,
                                  }}
                                  onClick={(e) => startRename(f.id, f.name, e)}
                                  title="Переименовать"
                                >
                                  <Edit2 size={11} />
                                </button>
                                <button
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--cad-text-dim)",
                                    cursor: "pointer",
                                  }}
                                  onClick={(e) => handleRemove(f.id, f.name, e)}
                                  title="Удалить плату"
                                >
                                  <Trash2 size={11} color="#ef4444" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Nested Layers inside the Board */}
                          {expanded && (
                            <div style={{ marginLeft: "14px", borderLeft: "1px dashed rgba(255, 255, 255, 0.1)" }}>
                              {/* Sub-branch: Top Layer */}
                              <div className="cad-tree-section" style={{ margin: 0 }}>
                                <div
                                  className="cad-tree-header"
                                  style={{ padding: "4px 8px 4px 14px", cursor: "pointer" }}
                                  onClick={() =>
                                    setTopSidesOpen((prev) => ({ ...prev, [f.id]: !isTopSideOpen }))
                                  }
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {isTopSideOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    <span style={{ color: "var(--cad-top-layer)", fontSize: "11px", fontWeight: 600 }}>
                                      Top сторона (Лицевая)
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    {isActive && (
                                      <button
                                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowTopLayer(!showTopLayer);
                                        }}
                                        title={showTopLayer ? "Скрыть слой Top" : "Показать слой Top"}
                                      >
                                        {showTopLayer ? <Eye size={12} /> : <EyeOff size={12} color="var(--cad-text-dim)" />}
                                      </button>
                                    )}
                                    <button
                                      style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer" }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isActive) setActiveFile(f.id);
                                        openModal("preprocess");
                                      }}
                                      title="Импортировать скан Top"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>

                                {isTopSideOpen && (
                                  <div className="cad-tree-items">
                                    {!isActive ? (
                                      <div style={{ padding: "4px 12px 4px 28px", color: "var(--cad-text-dim)", fontSize: "10px" }}>
                                        Нажмите на плату для просмотра слоев
                                      </div>
                                    ) : bgTopImages.length === 0 ? (
                                      <div style={{ padding: "4px 12px 4px 28px", color: "var(--cad-text-dim)", fontSize: "10px" }}>
                                        Нет фото Top. Нажмите [+]
                                      </div>
                                    ) : (
                                      bgTopImages.map((img) => {
                                        const isSelected = selectedImageId === img.id;
                                        return (
                                          <div
                                            key={img.id}
                                            className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                            style={{ paddingLeft: "26px" }}
                                            onClick={() => selectImage(img.id)}
                                          >
                                            <ImageIcon size={12} color="var(--cad-top-layer)" />
                                            <span className="cad-tree-item-name" title={img.name} style={{ fontSize: "11px" }}>
                                              {img.name}
                                            </span>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, visible: !img.visible });
                                              }}
                                              title={img.visible ? "Скрыть" : "Показать"}
                                            >
                                              {img.visible ? <Eye size={11} /> : <EyeOff size={11} color="var(--cad-text-dim)" />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, locked: !img.locked });
                                              }}
                                              title={img.locked ? "Разблокировать" : "Заблокировать"}
                                            >
                                              {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteImageLayer(img.id);
                                              }}
                                              title="Удалить слой"
                                            >
                                              <Trash2 size={11} color="#ef4444" />
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Sub-branch: Bottom Layer */}
                              <div className="cad-tree-section" style={{ margin: 0 }}>
                                <div
                                  className="cad-tree-header"
                                  style={{ padding: "4px 8px 4px 14px", cursor: "pointer" }}
                                  onClick={() =>
                                    setBotSidesOpen((prev) => ({ ...prev, [f.id]: !isBotSideOpen }))
                                  }
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    {isBotSideOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    <span style={{ color: "var(--cad-bot-layer)", fontSize: "11px", fontWeight: 600 }}>
                                      Bottom сторона (Оборотная)
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    {isActive && (
                                      <button
                                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowBottomLayer(!showBottomLayer);
                                        }}
                                        title={showBottomLayer ? "Скрыть слой Bottom" : "Показать слой Bottom"}
                                      >
                                        {showBottomLayer ? <Eye size={12} /> : <EyeOff size={12} color="var(--cad-text-dim)" />}
                                      </button>
                                    )}
                                    <button
                                      style={{ background: "transparent", border: "none", color: "#06b6d4", cursor: "pointer" }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isActive) setActiveFile(f.id);
                                        openModal("preprocess");
                                      }}
                                      title="Импортировать скан Bottom"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>

                                {isBotSideOpen && (
                                  <div className="cad-tree-items">
                                    {!isActive ? (
                                      <div style={{ padding: "4px 12px 4px 28px", color: "var(--cad-text-dim)", fontSize: "10px" }}>
                                        Нажмите на плату для просмотра слоев
                                      </div>
                                    ) : bgBottomImages.length === 0 ? (
                                      <div style={{ padding: "4px 12px 4px 28px", color: "var(--cad-text-dim)", fontSize: "10px" }}>
                                        Нет фото Bottom. Нажмите [+]
                                      </div>
                                    ) : (
                                      bgBottomImages.map((img) => {
                                        const isSelected = selectedImageId === img.id;
                                        return (
                                          <div
                                            key={img.id}
                                            className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                            style={{ paddingLeft: "26px" }}
                                            onClick={() => selectImage(img.id)}
                                          >
                                            <ImageIcon size={12} color="var(--cad-bot-layer)" />
                                            <span className="cad-tree-item-name" title={img.name} style={{ fontSize: "11px" }}>
                                              {img.name}
                                            </span>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, visible: !img.visible });
                                              }}
                                              title={img.visible ? "Скрыть" : "Показать"}
                                            >
                                              {img.visible ? <Eye size={11} /> : <EyeOff size={11} color="var(--cad-text-dim)" />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, locked: !img.locked });
                                              }}
                                              title={img.locked ? "Разблокировать" : "Заблокировать"}
                                            >
                                              {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteImageLayer(img.id);
                                              }}
                                              title="Удалить слой"
                                            >
                                              <Trash2 size={11} color="#ef4444" />
                                            </button>
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
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Resize Handle */}
      <div className="cad-sidebar-resizer-left" onMouseDown={handleMouseDown} />
    </aside>
  );
};
