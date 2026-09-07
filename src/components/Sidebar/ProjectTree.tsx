import React, { useState } from "react";
import {
  Folder,
  Image,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Cpu,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Sliders,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";

export const ProjectTree: React.FC = () => {
  const {
    board,
    selectedComponentId,
    selectedImageId,
    selectComponent,
    selectImage,
    updateImageLayer,
  } = useProjectStore();

  const {
    leftSidebarWidth,
    setLeftSidebarWidth,
    showTopLayer,
    setShowTopLayer,
    showBottomLayer,
    setShowBottomLayer,
    showComponentsTop,
    setShowComponentsTop,
    showComponentsBottom,
    setShowComponentsBottom,
    openModal,
  } = useUiStore();

  const [topOpen, setTopOpen] = useState(true);
  const [botOpen, setBotOpen] = useState(true);
  const [compTopOpen, setCompTopOpen] = useState(true);
  const [compBotOpen, setCompBotOpen] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");

  const bgTopImages = board?.data.bgTop.images || [];
  const bgBottomImages = board?.data.bgBottom.images || [];

  const compsTop = (board?.data.components || []).filter(
    (c) =>
      c.layer === "top" &&
      (c.refDes.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.value?.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const compsBot = (board?.data.components || []).filter(
    (c) =>
      c.layer === "bottom" &&
      (c.refDes.toLowerCase().includes(searchFilter.toLowerCase()) ||
        c.value?.toLowerCase().includes(searchFilter.toLowerCase()))
  );

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
          <Folder size={14} color="#60a5fa" />
          <span>Слои и дерево проекта</span>
        </div>
      </div>

      <div className="cad-sidebar-content">
        {/* Search components filter */}
        <div style={{ position: "relative", marginBottom: "4px" }}>
          <Search size={12} color="var(--cad-text-dim)" style={{ position: "absolute", left: "8px", top: "8px" }} />
          <input
            type="text"
            placeholder="Поиск детали (R1, U2)..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "5px 8px 5px 26px",
              fontSize: "11px",
              background: "var(--cad-bg-deep)",
              border: "1px solid var(--cad-border)",
              borderRadius: "4px",
              color: "#fff",
            }}
          />
        </div>

        {/* Section 1: Сканы Top */}
        <div className="cad-tree-section">
          <div className="cad-tree-header" onClick={() => setTopOpen(!topOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {topOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ color: "var(--cad-top-layer)", fontWeight: 600 }}>Сканы Top (Лицевая)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTopLayer(!showTopLayer);
                }}
                title={showTopLayer ? "Скрыть слой" : "Показать слой"}
              >
                {showTopLayer ? <Eye size={13} /> : <EyeOff size={13} color="var(--cad-text-dim)" />}
              </button>
              <button
                style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal("preprocess");
                }}
                title="Добавить скан Top"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {topOpen && (
            <div className="cad-tree-items">
              {bgTopImages.length === 0 ? (
                <div style={{ padding: "4px 8px", fontSize: "11px", color: "var(--cad-text-dim)" }}>
                  Нет сканов (нажмите + для импорта)
                </div>
              ) : (
                bgTopImages.map((img) => (
                  <div
                    key={img.id}
                    className={`cad-tree-item ${selectedImageId === img.id ? "active" : ""}`}
                    onClick={() => selectImage(img.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Image size={13} color="var(--cad-top-layer)" />
                      <span style={{ fontSize: "11px" }}>{img.name}</span>
                    </div>

                    <div className="cad-tree-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
                        onClick={() => updateImageLayer({ ...img, visible: !img.visible })}
                      >
                        {img.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
                        onClick={() => updateImageLayer({ ...img, locked: !img.locked })}
                      >
                        {img.locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section 2: Сканы Bottom */}
        <div className="cad-tree-section">
          <div className="cad-tree-header" onClick={() => setBotOpen(!botOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {botOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ color: "var(--cad-bottom-layer)", fontWeight: 600 }}>Сканы Bottom (Оборот)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBottomLayer(!showBottomLayer);
                }}
                title={showBottomLayer ? "Скрыть слой" : "Показать слой"}
              >
                {showBottomLayer ? <Eye size={13} /> : <EyeOff size={13} color="var(--cad-text-dim)" />}
              </button>
              <button
                style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal("preprocess");
                }}
                title="Добавить скан Bottom"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {botOpen && (
            <div className="cad-tree-items">
              {bgBottomImages.length === 0 ? (
                <div style={{ padding: "4px 8px", fontSize: "11px", color: "var(--cad-text-dim)" }}>
                  Нет сканов (нажмите + для импорта)
                </div>
              ) : (
                bgBottomImages.map((img) => (
                  <div
                    key={img.id}
                    className={`cad-tree-item ${selectedImageId === img.id ? "active" : ""}`}
                    onClick={() => selectImage(img.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Image size={13} color="var(--cad-bottom-layer)" />
                      <span style={{ fontSize: "11px" }}>{img.name}</span>
                    </div>

                    <div className="cad-tree-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
                        onClick={() => updateImageLayer({ ...img, visible: !img.visible })}
                      >
                        {img.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
                        onClick={() => updateImageLayer({ ...img, locked: !img.locked })}
                      >
                        {img.locked ? <Lock size={12} color="#f59e0b" /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section 3: Детали Top */}
        <div className="cad-tree-section">
          <div className="cad-tree-header" onClick={() => setCompTopOpen(!compTopOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {compTopOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontWeight: 600 }}>Детали Top ({compsTop.length})</span>
            </div>
            <button
              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                setShowComponentsTop(!showComponentsTop);
              }}
            >
              {showComponentsTop ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>

          {compTopOpen && (
            <div className="cad-tree-items">
              {compsTop.map((c) => (
                <div
                  key={c.id}
                  className={`cad-tree-item ${selectedComponentId === c.id ? "active" : ""}`}
                  onClick={() => selectComponent(c.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Cpu size={13} color="var(--cad-top-layer)" />
                    <span style={{ fontWeight: 600, fontFamily: "var(--cad-font-mono)", fontSize: "11px" }}>{c.refDes}</span>
                    {c.value && (
                      <span style={{ fontSize: "10px", color: "var(--cad-text-dim)" }}>({c.value})</span>
                    )}
                  </div>
                  <span style={{ fontSize: "9px", color: "var(--cad-text-dim)", fontFamily: "var(--cad-font-mono)" }}>
                    {c.pins.length}p
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Детали Bottom */}
        <div className="cad-tree-section">
          <div className="cad-tree-header" onClick={() => setCompBotOpen(!compBotOpen)}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {compBotOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontWeight: 600 }}>Детали Bottom ({compsBot.length})</span>
            </div>
            <button
              style={{ background: "transparent", border: "none", color: "var(--cad-text-muted)", cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                setShowComponentsBottom(!showComponentsBottom);
              }}
            >
              {showComponentsBottom ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>

          {compBotOpen && (
            <div className="cad-tree-items">
              {compsBot.map((c) => (
                <div
                  key={c.id}
                  className={`cad-tree-item ${selectedComponentId === c.id ? "active" : ""}`}
                  onClick={() => selectComponent(c.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Cpu size={13} color="var(--cad-bottom-layer)" />
                    <span style={{ fontWeight: 600, fontFamily: "var(--cad-font-mono)", fontSize: "11px" }}>{c.refDes}</span>
                    {c.value && (
                      <span style={{ fontSize: "10px", color: "var(--cad-text-dim)" }}>({c.value})</span>
                    )}
                  </div>
                  <span style={{ fontSize: "9px", color: "var(--cad-text-dim)", fontFamily: "var(--cad-font-mono)" }}>
                    {c.pins.length}p
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "4px",
          height: "100%",
          cursor: "col-resize",
          background: "transparent",
        }}
      />
    </aside>
  );
};
