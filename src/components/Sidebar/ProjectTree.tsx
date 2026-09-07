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
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const ProjectTree: React.FC = () => {
  const {
    manifest,
    boards,
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

  // Collapsible groups
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
      {/* 1. Clean CAD Header with Project Name & minimal Add Menu */}
      <div
        className="cad-sidebar-header"
        style={{
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
          <Folder size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 600,
              fontSize: "11px",
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
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#cbd5e1",
            borderRadius: "4px",
            padding: "3px 6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            transition: "all 0.15s ease",
          }}
          onClick={() => openModal("newDocument")}
          title="Добавить документ в проект"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
            e.currentTarget.style.color = "#93c5fd";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
            e.currentTarget.style.color = "#cbd5e1";
          }}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* 2. File Tree (Clean CAD Explorer) */}
      <div className="cad-sidebar-content" style={{ flex: 1, overflowY: "auto", padding: "6px 0", gap: "8px" }}>
        {/* SECTION A: ПРИНЦИПИАЛЬНЫЕ СХЕМЫ */}
        <div style={{ padding: "0 4px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px",
              cursor: "pointer",
              borderRadius: "4px",
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 600,
            }}
            onClick={() => setSchematicsGroupOpen(!schematicsGroupOpen)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {schematicsGroupOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <Cpu size={12} color="#38bdf8" />
              <span>СХЕМЫ</span>
              <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 400 }}>
                ({schematicFiles.length})
              </span>
            </div>
          </div>

          {schematicsGroupOpen && (
            <div style={{ paddingLeft: "8px", marginTop: "2px" }}>
              {schematicFiles.length === 0 ? (
                <div style={{ padding: "3px 12px", fontSize: "10px", color: "#64748b" }}>
                  (нет схем)
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
                        paddingLeft: "12px",
                        paddingRight: "6px",
                        cursor: "pointer",
                      }}
                      onClick={() => setActiveFile(file.id)}
                    >
                      <FileCode size={12} color="#38bdf8" style={{ flexShrink: 0 }} />

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
                            <Check size={11} />
                          </button>
                          <button
                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "1px" }}
                            onClick={() => setEditingFileId(null)}
                          >
                            <X size={11} />
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
                              fontSize: "11px",
                            }}
                            onDoubleClick={(e) => startRename(file.id, file.name, e)}
                          >
                            {file.name}
                          </span>

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

        {/* SECTION B: СХЕМЫ ПЛАТ */}
        <div style={{ padding: "0 4px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 8px",
              cursor: "pointer",
              borderRadius: "4px",
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 600,
            }}
            onClick={() => setBoardsGroupOpen(!boardsGroupOpen)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {boardsGroupOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <Layers size={12} color="#60a5fa" />
              <span>ПЛАТЫ</span>
              <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 400 }}>
                ({boardFiles.length})
              </span>
            </div>
          </div>

          {boardsGroupOpen && (
            <div style={{ paddingLeft: "8px", marginTop: "2px" }}>
              {boardFiles.length === 0 ? (
                <div style={{ padding: "3px 12px", fontSize: "10px", color: "#64748b" }}>
                  (нет плат)
                </div>
              ) : (
                boardFiles.map((file) => {
                  const isActive = activeFileId === file.id;
                  const isOpen = isBoardOpen(file.id);
                  const isEditing = editingFileId === file.id;

                  const boardData = boards.find((b) => b.id === file.id);
                  const bgTopImages = boardData?.data.bgTop.images || [];
                  const bgBottomImages = boardData?.data.bgBottom.images || [];

                  const topSideKey = `${file.id}_top`;
                  const botSideKey = `${file.id}_bot`;
                  const isTopOpen = isSideOpen(topSideKey);
                  const isBotOpen = isSideOpen(botSideKey);

                  return (
                    <div key={file.id} style={{ marginBottom: "2px" }}>
                      {/* Board Node Row */}
                      <div
                        className={`cad-tree-item ${isActive ? "selected" : ""}`}
                        style={{
                          paddingLeft: "6px",
                          paddingRight: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => setActiveFile(file.id)}
                      >
                        <span
                          onClick={(e) => toggleBoard(file.id, e)}
                          style={{ display: "flex", alignItems: "center", marginRight: "3px" }}
                        >
                          {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </span>

                        <Layers size={12} color="#60a5fa" style={{ flexShrink: 0 }} />

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
                              <Check size={11} />
                            </button>
                            <button
                              style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "1px" }}
                              onClick={() => setEditingFileId(null)}
                            >
                              <X size={11} />
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
                                fontSize: "11px",
                              }}
                              onDoubleClick={(e) => startRename(file.id, file.name, e)}
                            >
                              {file.name}
                            </span>

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

                      {/* Board Layers (Top & Bottom) */}
                      {isOpen && (
                        <div style={{ marginLeft: "14px", borderLeft: "1px dashed rgba(255, 255, 255, 0.1)" }}>
                          {/* Top Side */}
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "2px 6px 2px 10px",
                                cursor: "pointer",
                                fontSize: "10px",
                              }}
                              onClick={(e) => toggleSide(topSideKey, e)}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                {isTopOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                <span style={{ color: "var(--cad-top-layer, #f87171)", fontWeight: 600 }}>
                                  Top (Лицевая)
                                </span>
                                <span style={{ fontSize: "9px", color: "#64748b" }}>
                                  ({bgTopImages.length})
                                </span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                {isActive && (
                                  <button
                                    style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowTopLayer(!showTopLayer);
                                    }}
                                    title={showTopLayer ? "Скрыть слой Top" : "Показать слой Top"}
                                  >
                                    {showTopLayer ? <Eye size={11} /> : <EyeOff size={11} color="var(--cad-text-dim)" />}
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
                                  <Plus size={11} />
                                </button>
                              </div>
                            </div>

                            {isTopOpen && (
                              <div style={{ paddingLeft: "14px" }}>
                                {bgTopImages.length === 0 ? (
                                  <div style={{ padding: "1px 6px 3px 6px", fontSize: "9px", color: "#64748b" }}>
                                    (нет фото Top)
                                  </div>
                                ) : (
                                  bgTopImages.map((img) => {
                                    const isSelected = selectedImageId === img.id && isActive;

                                    return (
                                      <div
                                        key={img.id}
                                        className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                        style={{ paddingLeft: "6px", paddingRight: "4px", paddingBottom: "2px", paddingTop: "2px" }}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          selectImage(img.id);
                                        }}
                                      >
                                        <ImageIcon size={10} color="var(--cad-top-layer, #f87171)" />
                                        <span
                                          className="cad-tree-item-name"
                                          title={img.name}
                                          style={{ fontSize: "10px", color: isSelected ? "#fff" : "#cbd5e1" }}
                                        >
                                          {img.name}
                                        </span>
                                        <button
                                          style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateImageLayer({ ...img, visible: !img.visible });
                                          }}
                                          title={img.visible ? "Скрыть" : "Показать"}
                                        >
                                          {img.visible ? <Eye size={10} /> : <EyeOff size={10} color="var(--cad-text-dim)" />}
                                        </button>
                                        <button
                                          style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateImageLayer({ ...img, locked: !img.locked });
                                          }}
                                          title={img.locked ? "Разблокировать" : "Заблокировать"}
                                        >
                                          {img.locked ? <Lock size={10} color="#f59e0b" /> : <Unlock size={10} />}
                                        </button>
                                        <button
                                          style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteImageLayer(img.id);
                                          }}
                                          title="Удалить скан"
                                        >
                                          <Trash2 size={10} color="#ef4444" />
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bottom Side */}
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "2px 6px 2px 10px",
                                cursor: "pointer",
                                fontSize: "10px",
                              }}
                              onClick={(e) => toggleSide(botSideKey, e)}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                {isBotOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                <span style={{ color: "var(--cad-bot-layer, #38bdf8)", fontWeight: 600 }}>
                                  Bottom (Оборотная)
                                </span>
                                <span style={{ fontSize: "9px", color: "#64748b" }}>
                                  ({bgBottomImages.length})
                                </span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                {isActive && (
                                  <button
                                    style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowBottomLayer(!showBottomLayer);
                                    }}
                                    title={showBottomLayer ? "Скрыть слой Bottom" : "Показать слой Bottom"}
                                  >
                                    {showBottomLayer ? <Eye size={11} /> : <EyeOff size={11} color="var(--cad-text-dim)" />}
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
                                  <Plus size={11} />
                                </button>
                              </div>
                            </div>

                            {isBotOpen && (
                              <div style={{ paddingLeft: "14px" }}>
                                {bgBottomImages.length === 0 ? (
                                  <div style={{ padding: "1px 6px 3px 6px", fontSize: "9px", color: "#64748b" }}>
                                    (нет фото Bottom)
                                  </div>
                                ) : (
                                  bgBottomImages.map((img) => {
                                    const isSelected = selectedImageId === img.id && isActive;

                                    return (
                                      <div
                                        key={img.id}
                                        className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                                        style={{ paddingLeft: "6px", paddingRight: "4px", paddingBottom: "2px", paddingTop: "2px" }}
                                        onClick={() => {
                                          if (!isActive) setActiveFile(file.id);
                                          selectImage(img.id);
                                        }}
                                      >
                                        <ImageIcon size={10} color="var(--cad-bot-layer, #38bdf8)" />
                                        <span
                                          className="cad-tree-item-name"
                                          title={img.name}
                                          style={{ fontSize: "10px", color: isSelected ? "#fff" : "#cbd5e1" }}
                                        >
                                          {img.name}
                                        </span>
                                        <button
                                          style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateImageLayer({ ...img, visible: !img.visible });
                                          }}
                                          title={img.visible ? "Скрыть" : "Показать"}
                                        >
                                          {img.visible ? <Eye size={10} /> : <EyeOff size={10} color="var(--cad-text-dim)" />}
                                        </button>
                                        <button
                                          style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateImageLayer({ ...img, locked: !img.locked });
                                          }}
                                          title={img.locked ? "Разблокировать" : "Заблокировать"}
                                        >
                                          {img.locked ? <Lock size={10} color="#f59e0b" /> : <Unlock size={10} />}
                                        </button>
                                        <button
                                          style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer", padding: "1px" }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteImageLayer(img.id);
                                          }}
                                          title="Удалить скан"
                                        >
                                          <Trash2 size={10} color="#ef4444" />
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
      </div>

      {/* 3. Fully functional Sidebar Resizer */}
      <div
        className="cad-sidebar-resizer-left"
        onMouseDown={handleMouseDown}
        title="Перетащите для изменения ширины дерева проекта"
      />
    </aside>
  );
};
