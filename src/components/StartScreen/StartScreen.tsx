import React, { useEffect, useState } from "react";
import { Layers, Plus, FolderOpen, Clock, FileCode, Trash2, ChevronRight } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { engineClient } from "../../api/engineClient";
import { RecentProject } from "../../types/cad";
import { reportError } from "../../utils/errorHandler";

export const StartScreen: React.FC = () => {
  const { openModal } = useUiStore();
  const { openProject } = useProjectStore();
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecents();
  }, []);

  const loadRecents = async () => {
    try {
      const list = await engineClient.getRecentProjects();
      setRecents(Array.isArray(list) ? list : []);
    } catch (e) {
      reportError(e, "Ошибка при получении недавних проектов", { source: "tauri", toast: false });
    }
  };

  const handleOpenFileDialog = async () => {
    setLoading(true);
    try {
      // Check if Tauri dialog is available
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          filters: [{ name: "Проект MyCad", extensions: ["mycad", "json"] }],
        });
        if (selected && typeof selected === "string") {
          await openProject(selected);
        }
      } else {
        // Fallback for browser preview
        await openProject("C:/Projects/Pirrs_1000_Lux.mycad");
      }
    } catch (e: any) {
      reportError(e, "Не удалось открыть проект", { source: "tauri" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (path: string) => {
    setLoading(true);
    try {
      await openProject(path);
    } catch (e: any) {
      reportError(e, `Не удалось открыть проект "${path}" (возможно, файл перемещен или удален)`, { source: "tauri" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await engineClient.removeRecentProject(path);
      setRecents((prev) => prev.filter((r) => r.filePath !== path));
    } catch (err) {
      reportError(err, "Ошибка удаления проекта из списка недавних", { source: "tauri" });
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const time = date.getTime();
      if (isNaN(time)) return "недавно";
      const diffMs = Date.now() - time;
      if (diffMs < 0) return "только что";
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return "только что";
      if (diffMinutes < 60) return `${diffMinutes} мин назад`;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 24) return `${diffHours} ч назад`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} дн назад`;
    } catch {
      return "недавно";
    }
  };

  return (
    <div className="cad-start-container">
      <div className="cad-start-bg-grid" />

      <div className="cad-start-content">
        <div className="cad-start-hero">
          <div className="cad-start-logo-wrap">
            <Layers size={36} color="#60a5fa" />
          </div>
          <h1 className="cad-start-title">MyCad</h1>
          <p className="cad-start-subtitle">
            Профессиональная CAD-система для реинжиниринга, инспекции и ремонта печатных плат
          </p>
        </div>

        <div className="cad-start-grid">
          {/* Quick Start actions */}
          <div className="cad-start-card">
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>НАЧАЛО РАБОТЫ</h2>

            <button
              className="cad-start-action-btn primary"
              onClick={() => openModal("newProject")}
              disabled={loading}
            >
              <Plus size={22} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>Создать новый проект</div>
                <div style={{ fontSize: "11px", opacity: 0.85 }}>Монтажная плата и контейнер .mycad</div>
              </div>
            </button>

            <button
              className="cad-start-action-btn"
              onClick={handleOpenFileDialog}
              disabled={loading}
            >
              <FolderOpen size={20} color="#38bdf8" />
              <div>
                <div style={{ fontWeight: 500, fontSize: "13px" }}>Открыть проект...</div>
                <div style={{ fontSize: "11px", color: "var(--cad-text-dim)" }}>Файл архива .mycad на диске</div>
              </div>
            </button>
          </div>

          {/* Recent projects */}
          <div className="cad-start-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>НЕДАВНИЕ ПРОЕКТЫ</h2>
              <span style={{ fontSize: "11px", color: "var(--cad-text-dim)", fontFamily: "var(--cad-font-mono)" }}>
                {recents.length} файлов
              </span>
            </div>

            <div className="cad-recent-list">
              {recents.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--cad-text-dim)", fontSize: "12px" }}>
                  История недавних проектов пуста
                </div>
              ) : (
                recents.map((item) => (
                  <div
                    key={item.id}
                    className="cad-recent-item"
                    onClick={() => handleOpenRecent(item.filePath)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <FileCode size={18} color="#3b82f6" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: "#fff" }}>{item.name}</span>
                          <span style={{ fontSize: "10px", padding: "1px 5px", background: "rgba(59,130,246,0.15)", borderRadius: "3px", color: "#60a5fa" }}>
                            .mycad
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--cad-text-dim)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {item.filePath}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--cad-text-dim)" }}>
                        <Clock size={11} />
                        {formatRelativeTime(item.lastOpened)}
                      </div>
                      <button
                        style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer", padding: "4px" }}
                        onClick={(e) => handleRemoveRecent(e, item.filePath)}
                        title="Удалить из недавних"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight size={14} color="var(--cad-text-dim)" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Keyboard hints bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "8px 18px", background: "rgba(20,24,32,0.7)", border: "1px solid var(--cad-border)", borderRadius: "20px", fontSize: "11px", color: "var(--cad-text-dim)" }}>
          <span><strong>Ctrl+N</strong> Новый проект</span>
          <span>•</span>
          <span><strong>Ctrl+O</strong> Открыть</span>
          <span>•</span>
          <span><strong>Ctrl+S</strong> Сохранить</span>
          <span>•</span>
          <span><strong>Пробел + ЛКМ</strong> Панорама</span>
          <span>•</span>
          <span><strong>Колесо мыши</strong> Зум в курсор</span>
        </div>
      </div>
    </div>
  );
};
