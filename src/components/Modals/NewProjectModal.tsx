import React, { useState } from "react";
import { X, Folder, Plus } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";

export const NewProjectModal: React.FC = () => {
  const { modals, closeModal } = useUiStore();
  const { createProject } = useProjectStore();

  const [name, setName] = useState("Project_1");
  const [author, setAuthor] = useState("");
  const [desc, setDesc] = useState("");
  const [dirPath, setDirPath] = useState("C:/Projects");
  const [loading, setLoading] = useState(false);

  if (!modals.newProject) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const fullPath = `${dirPath.replace(/\\/g, "/")}/${name.trim()}.mycad`;
      await createProject(fullPath, name.trim(), author.trim() || undefined, desc.trim() || undefined);
      closeModal("newProject");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cad-modal-backdrop" onClick={() => closeModal("newProject")}>
      <div className="cad-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="cad-modal-icon-badge">
              <Plus size={18} color="#60a5fa" />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>
                Создание нового проекта MyCad
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Контейнер файла архива платы и схем .mycad
              </div>
            </div>
          </div>
          <button
            className="cad-modal-close-btn"
            onClick={() => closeModal("newProject")}
            title="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cad-modal-body">
            <div className="cad-input-field">
              <label>Имя проекта *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project_1, MainBoard_Rev2..."
              />
            </div>

            <div className="cad-input-field">
              <label>Папка размещения проекта</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={dirPath}
                  onChange={(e) => setDirPath(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  onClick={async () => {
                    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
                      const { open } = await import("@tauri-apps/plugin-dialog");
                      const sel = await open({ directory: true });
                      if (sel && typeof sel === "string") setDirPath(sel);
                    }
                  }}
                >
                  <Folder size={14} />
                </button>
              </div>
            </div>

            <div className="cad-input-field">
              <label>Автор / Инженер</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Инженер-электроник..."
              />
            </div>

            <div className="cad-input-field">
              <label>Описание проекта</label>
              <textarea
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ремонт и восстановление топологии платы..."
              />
            </div>
          </div>

          <div className="cad-modal-footer">
            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              onClick={() => closeModal("newProject")}
              disabled={loading}
            >
              Отмена
            </button>
            <button type="submit" className="cad-btn cad-btn-primary" disabled={loading}>
              {loading ? "Создание..." : "Создать .mycad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
