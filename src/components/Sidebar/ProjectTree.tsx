import React, { useState } from "react";
import {
  Folder,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const ProjectTree: React.FC = () => {
  const {
    board,
    selectedImageId,
    selectImage,
    updateImageLayer,
    deleteImageLayer,
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

  const [topOpen, setTopOpen] = useState(true);
  const [botOpen, setBotOpen] = useState(true);

  const bgTopImages = board?.data.bgTop.images || [];
  const bgBottomImages = board?.data.bgBottom.images || [];

  // Resizing logic
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <aside className="cad-sidebar cad-sidebar-left" style={{ width: `${leftSidebarWidth}px` }}>
      <div className="cad-sidebar-header">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Layers size={14} color="#60a5fa" />
          <span>Слои изображений платы</span>
        </div>
      </div>

      <div className="cad-sidebar-content">
        {/* Section 1: Сканы Top */}
        <div className="cad-tree-section">
          <div className="cad-tree-header" onClick={() => setTopOpen(!topOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {topOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ color: "var(--cad-top-layer)", fontWeight: 600 }}>Top сторона (Лицевая)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTopLayer(!showTopLayer);
                }}
                title={showTopLayer ? "Скрыть слой Top" : "Показать слой Top"}
              >
                {showTopLayer ? <Eye size={13} /> : <EyeOff size={13} color="var(--cad-text-dim)" />}
              </button>
              <button
                style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal("preprocess");
                }}
                title="Импортировать скан Top"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {topOpen && (
            <div className="cad-tree-items">
              {bgTopImages.length === 0 ? (
                <div style={{ padding: "8px 12px", color: "var(--cad-text-dim)", fontSize: "11px" }}>
                  Нет фото Top. Нажмите [+] для импорта.
                </div>
              ) : (
                bgTopImages.map((img) => {
                  const isSelected = selectedImageId === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                      onClick={() => selectImage(img.id)}
                    >
                      <ImageIcon size={13} color="var(--cad-top-layer)" />
                      <span className="cad-tree-item-name" title={img.name}>
                        {img.name}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--cad-text-dim)", marginLeft: "auto", marginRight: "4px" }}>
                        {img.width}x{img.height}
                      </span>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateImageLayer({ ...img, visible: !img.visible });
                        }}
                        title={img.visible ? "Скрыть" : "Показать"}
                      >
                        {img.visible ? <Eye size={12} /> : <EyeOff size={12} color="var(--cad-text-dim)" />}
                      </button>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateImageLayer({ ...img, locked: !img.locked });
                        }}
                        title={img.locked ? "Разблокировать" : "Заблокировать"}
                      >
                        {img.locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                      </button>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImageLayer(img.id);
                        }}
                        title="Удалить слой"
                      >
                        <Trash2 size={12} color="#ef4444" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 2: Сканы Bottom */}
        <div className="cad-tree-section">
          <div className="cad-tree-header" onClick={() => setBotOpen(!botOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {botOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ color: "var(--cad-bot-layer)", fontWeight: 600 }}>Bottom сторона (Оборотная)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBottomLayer(!showBottomLayer);
                }}
                title={showBottomLayer ? "Скрыть слой Bottom" : "Показать слой Bottom"}
              >
                {showBottomLayer ? <Eye size={13} /> : <EyeOff size={13} color="var(--cad-text-dim)" />}
              </button>
              <button
                style={{ background: "transparent", border: "none", color: "#06b6d4", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal("preprocess");
                }}
                title="Импортировать скан Bottom"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {botOpen && (
            <div className="cad-tree-items">
              {bgBottomImages.length === 0 ? (
                <div style={{ padding: "8px 12px", color: "var(--cad-text-dim)", fontSize: "11px" }}>
                  Нет фото Bottom. Нажмите [+] для импорта.
                </div>
              ) : (
                bgBottomImages.map((img) => {
                  const isSelected = selectedImageId === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`cad-tree-item ${isSelected ? "selected" : ""}`}
                      onClick={() => selectImage(img.id)}
                    >
                      <ImageIcon size={13} color="var(--cad-bot-layer)" />
                      <span className="cad-tree-item-name" title={img.name}>
                        {img.name}
                      </span>
                      <span style={{ fontSize: "10px", color: "var(--cad-text-dim)", marginLeft: "auto", marginRight: "4px" }}>
                        {img.width}x{img.height}
                      </span>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateImageLayer({ ...img, visible: !img.visible });
                        }}
                        title={img.visible ? "Скрыть" : "Показать"}
                      >
                        {img.visible ? <Eye size={12} /> : <EyeOff size={12} color="var(--cad-text-dim)" />}
                      </button>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateImageLayer({ ...img, locked: !img.locked });
                        }}
                        title={img.locked ? "Разблокировать" : "Заблокировать"}
                      >
                        {img.locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                      </button>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImageLayer(img.id);
                        }}
                        title="Удалить слой"
                      >
                        <Trash2 size={12} color="#ef4444" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <div className="cad-sidebar-resizer-left" onMouseDown={handleMouseDown} />
    </aside>
  );
};
