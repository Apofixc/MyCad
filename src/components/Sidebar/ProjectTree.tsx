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
  Sparkles,
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

  // Collapsible tree groups
  const [schematicsGroupOpen, setSchematicsGroupOpen] = useState(true);
  const [boardsGroupOpen, setBoardsGroupOpen] = useState(true);
  const [expandedBoards, setExpandedBoards] = useState<Record<string, boolean>>({});
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

  const isSideOpen = (sideKey: string) => expandedSides[sideKey] ?? true;
  const toggleSide = (sideKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSides((prev) => ({ ...prev, [sideKey]: !isSideOpen(sideKey) }));
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
      setLeftSidebarWidth(Math.max(220, Math.min(500, newWidth)));
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
        borderRight: "1px solid var(--cad-border, #1f293d)",
      }}
    >
      {/* 1. Project Title & Quick Actions */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Folder size={14} color="#60a5fa" />
            </div>
            <span
              style={{
                fontWeight: 600,
                fontSize: "12px",
                color: "#f8fafc",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={manifest?.name}
            >
              {manifest?.name || "Дерево проекта"}
            </span>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "1px 5px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.06)",
              color: "#94a3b8",
            }}
          >
            {files.length} док.
          </span>
        </div>

        {/* Quick Add Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "5px 8px",
              background: "rgba(96, 165, 250, 0.1)",
              border: "1px solid rgba(96, 165, 250, 0.25)",
              color: "#93c5fd",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onClick={() => addBoard()}
            title="Создать новую схему платы в проекте"
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(96, 165, 250, 0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(96, 165, 250, 0.1)")}
          >
            <Plus size={12} />
            <span>+ Плата</span>
          </button>

          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "5px 8px",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              color: "#7dd3fc",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onClick={() => addSchematic()}
            title="Создать новую принципиальную схему в проекте"
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(56, 189, 248, 0.1)")}
          >
            <Plus size={12} />
            <span>+ Схема</span>
          </button>
        </div>
      </div>

      {/* 2. Tree Content Area */}
      <div className="cad-sidebar-content" style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {files.length === 0 ? (
          /* Empty Project State */
          <div style={{ padding: "32px 16px", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px dashed rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px auto",
              }}
            >
              <FolderPlus size={22} color="#64748b" />
            </div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
              Проект пуст
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4", marginBottom: "16px" }}>
              Добавьте схему платы или принципиальную схему для начала работы
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#fff",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
                }}
                onClick={() => addBoard()}
              >
                <Layers size={13} />
                <span>Добавить схему платы</span>
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={() => addSchematic()}
              >
                <Cpu size={13} color="#38bdf8" />
                <span>Добавить принципиальную схему</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* GROUP 1: ПРИНЦИПИАЛЬНЫЕ СХЕМЫ */}
            <div style={{ marginBottom: "6px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 10px 4px 8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  letterSpacing: "0.02em",
                }}
                onClick={() => setSchematicsGroupOpen(!schematicsGroupOpen)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {schematicsGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Cpu size={12} color="#38bdf8" />
                  <span>ПРИНЦИПИАЛЬНЫЕ СХЕМЫ</span>
                  <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 400 }}>
                    ({schematicFiles.length})
                  </span>
                </div>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#38bdf8",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    addSchematic();
                  }}
                  title="Создать принципиальную схему"
                >
                  <Plus size={13} />
                </button>
              </div>

              {schematicsGroupOpen && (
                <div>
                  {schematicFiles.length === 0 ? (
                    <div style={{ padding: "4px 12px 4px 26px", fontSize: "11px", color: "#64748b" }}>
                      Нет схем в проекте
                    </div>
                  ) : (
                    schematicFiles.map((file) => {
                      const isActive = activeFileId === file.id;
                      const isEditing = editingFileId === file.id;

                      return (
                        <div
                          key={file.id}
                          className={`cad-tree-item ${isActive ? "selected" : ""}`}
                          style={{
                            paddingLeft: "22px",
                            paddingRight: "8px",
                            cursor: "pointer",
                            position: "relative",
                          }}
                          onClick={() => setActiveFile(file.id)}
                        >
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
                            <>
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

                              {isActive && (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    padding: "1px 4px",
                                    background: "rgba(56, 189, 248, 0.2)",
                                    color: "#38bdf8",
                                    borderRadius: "3px",
                                    marginRight: "4px",
                                    flexShrink: 0,
                                  }}
                                >
                                  АКТИВНА
                                </span>
                              )}

                              <div style={{ display: "flex", alignItems: "center", gap: "2px", marginLeft: "auto" }}>
                                <button
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--cad-text-dim)",
                                    cursor: "pointer",
                                    padding: "2px",
                                  }}
                                  onClick={(e) => startRename(file.id, file.name, e)}
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
                                    padding: "2px",
                                  }}
                                  onClick={(e) => handleRemove(file.id, file.name, e)}
                                  title="Удалить схему"
                                >
                                  <Trash2 size={11} color="#ef4444" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* GROUP 2: СХЕМЫ ПЛАТ */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 10px 4px 8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  letterSpacing: "0.02em",
                }}
                onClick={() => setBoardsGroupOpen(!boardsGroupOpen)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  {boardsGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Layers size={12} color="#60a5fa" />
                  <span>СХЕМЫ ПЛАТ</span>
                  <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 400 }}>
                    ({boardFiles.length})
                  </span>
                </div>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#60a5fa",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    addBoard();
                  }}
                  title="Создать схему платы"
                >
                  <Plus size={13} />
                </button>
              </div>

              {boardsGroupOpen && (
                <div>
                  {boardFiles.length === 0 ? (
                    <div style={{ padding: "4px 12px 4px 26px", fontSize: "11px", color: "#64748b" }}>
                      Нет плат в проекте
                    </div>
                  ) : (
                    boardFiles.map((file) => {
                      const isActive = activeFileId === file.id;
                      const isOpen = isBoardOpen(file.id);
                      const isEditing = editingFileId === file.id;

                      // Find full board data
                      const boardData = boards.find((b) => b.id === file.id);
                      const bgTopImages = boardData?.data.bgTop.images || [];
                      const bgBottomImages = boardData?.data.bgBottom.images || [];

                      const topSideKey = `${file.id}_top`;
                      const botSideKey = `${file.id}_bot`;
                      const isTopOpen = isSideOpen(topSideKey);
                      const isBotOpen = isSideOpen(botSideKey);

                      return (
                        <div key={file.id} style={{ marginBottom: "2px" }}>
                          {/* Board Item Row */}
                          <div
                            className={`cad-tree-item ${isActive ? "selected" : ""}`}
                            style={{
                              paddingLeft: "14px",
                              paddingRight: "8px",
                              cursor: "pointer",
                            }}
                            onClick={() => setActiveFile(file.id)}
                          >
                            <span
                              onClick={(e) => toggleBoard(file.id, e)}
                              style={{ display: "flex", alignItems: "center", marginRight: "4px" }}
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
                              <>
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

                                {isActive && (
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      padding: "1px 4px",
                                      background: "rgba(96, 165, 250, 0.2)",
                                      color: "#60a5fa",
                                      borderRadius: "3px",
                                      marginRight: "4px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    АКТИВНА
                                  </span>
                                )}

                                <div style={{ display: "flex", alignItems: "center", gap: "2px", marginLeft: "auto" }}>
                                  <button
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "var(--cad-text-dim)",
                                      cursor: "pointer",
                                      padding: "2px",
                                    }}
                                    onClick={(e) => startRename(file.id, file.name, e)}
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
                                      padding: "2px",
                                    }}
                                    onClick={(e) => handleRemove(file.id, file.name, e)}
                                    title="Удалить плату"
                                  >
                                    <Trash2 size={11} color="#ef4444" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Board Child Nodes: Top Side and Bottom Side */}
                          {isOpen && (
                            <div style={{ marginLeft: "18px", borderLeft: "1px dashed rgba(255, 255, 255, 0.12)" }}>
                              {/* 2.1 Top Side Node */}
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "3px 8px 3px 12px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                  }}
                                  onClick={(e) => toggleSide(topSideKey, e)}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    {isTopOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                    <span style={{ color: "var(--cad-top-layer, #f87171)", fontWeight: 600 }}>
                                      Top (Лицевая)
                                    </span>
                                    <span style={{ fontSize: "10px", color: "#64748b" }}>
                                      ({bgTopImages.length})
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                    {isActive && (
                                      <button
                                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
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
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--cad-top-layer, #f87171)",
                                        cursor: "pointer",
                                        padding: "1px",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isActive) setActiveFile(file.id);
                                        openModal("preprocess");
                                      }}
                                      title="Импортировать скан Top"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>

                                {isTopOpen && (
                                  <div style={{ paddingLeft: "16px" }}>
                                    {bgTopImages.length === 0 ? (
                                      <div style={{ padding: "2px 8px 4px 10px", fontSize: "10px", color: "#64748b" }}>
                                        Нет сканов Top. Нажмите [+]
                                      </div>
                                    ) : (
                                      bgTopImages.map((img) => {
                                        const isSelected = selectedImageId === img.id && isActive;

                                        return (
                                          <div
                                            key={img.id}
                                            className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                            style={{ paddingLeft: "8px", paddingRight: "6px" }}
                                            onClick={() => {
                                              if (!isActive) setActiveFile(file.id);
                                              selectImage(img.id);
                                            }}
                                          >
                                            <ImageIcon size={11} color="var(--cad-top-layer, #f87171)" />
                                            <span
                                              className="cad-tree-item-name"
                                              title={img.name}
                                              style={{ fontSize: "11px", color: isSelected ? "#fff" : "#cbd5e1" }}
                                            >
                                              {img.name}
                                            </span>
                                            <span style={{ fontSize: "9px", color: "#64748b", marginRight: "2px" }}>
                                              {img.width}x{img.height}
                                            </span>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, visible: !img.visible });
                                              }}
                                              title={img.visible ? "Скрыть" : "Показать"}
                                            >
                                              {img.visible ? <Eye size={11} /> : <EyeOff size={11} color="var(--cad-text-dim)" />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, locked: !img.locked });
                                              }}
                                              title={img.locked ? "Разблокировать" : "Заблокировать"}
                                            >
                                              {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteImageLayer(img.id);
                                              }}
                                              title="Удалить скан"
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

                              {/* 2.2 Bottom Side Node */}
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "3px 8px 3px 12px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                  }}
                                  onClick={(e) => toggleSide(botSideKey, e)}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    {isBotOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                    <span style={{ color: "var(--cad-bot-layer, #38bdf8)", fontWeight: 600 }}>
                                      Bottom (Оборотная)
                                    </span>
                                    <span style={{ fontSize: "10px", color: "#64748b" }}>
                                      ({bgBottomImages.length})
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                    {isActive && (
                                      <button
                                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
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
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--cad-bot-layer, #38bdf8)",
                                        cursor: "pointer",
                                        padding: "1px",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isActive) setActiveFile(file.id);
                                        openModal("preprocess");
                                      }}
                                      title="Импортировать скан Bottom"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>

                                {isBotOpen && (
                                  <div style={{ paddingLeft: "16px" }}>
                                    {bgBottomImages.length === 0 ? (
                                      <div style={{ padding: "2px 8px 4px 10px", fontSize: "10px", color: "#64748b" }}>
                                        Нет сканов Bottom. Нажмите [+]
                                      </div>
                                    ) : (
                                      bgBottomImages.map((img) => {
                                        const isSelected = selectedImageId === img.id && isActive;

                                        return (
                                          <div
                                            key={img.id}
                                            className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                            style={{ paddingLeft: "8px", paddingRight: "6px" }}
                                            onClick={() => {
                                              if (!isActive) setActiveFile(file.id);
                                              selectImage(img.id);
                                            }}
                                          >
                                            <ImageIcon size={11} color="var(--cad-bot-layer, #38bdf8)" />
                                            <span
                                              className="cad-tree-item-name"
                                              title={img.name}
                                              style={{ fontSize: "11px", color: isSelected ? "#fff" : "#cbd5e1" }}
                                            >
                                              {img.name}
                                            </span>
                                            <span style={{ fontSize: "9px", color: "#64748b", marginRight: "2px" }}>
                                              {img.width}x{img.height}
                                            </span>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, visible: !img.visible });
                                              }}
                                              title={img.visible ? "Скрыть" : "Показать"}
                                            >
                                              {img.visible ? <Eye size={11} /> : <EyeOff size={11} color="var(--cad-text-dim)" />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateImageLayer({ ...img, locked: !img.locked });
                                              }}
                                              title={img.locked ? "Разблокировать" : "Заблокировать"}
                                            >
                                              {img.locked ? <Lock size={11} color="#f59e0b" /> : <Unlock size={11} />}
                                            </button>
                                            <button
                                              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteImageLayer(img.id);
                                              }}
                                              title="Удалить скан"
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
