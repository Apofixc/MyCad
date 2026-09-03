import { invoke } from "@tauri-apps/api/core";
import type { Project } from "./types";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

const DEFAULT_PATH_KEY = "mycad_last_project_path";

export async function saveProject(project: Project): Promise<string | null> {
  if (isTauri()) {
    const last = localStorage.getItem(DEFAULT_PATH_KEY) ?? `${project.name}.mycad.json`;
    const path = window.prompt("Путь для сохранения проекта:", last);
    if (!path) return null;
    await invoke("save_project", { path, project });
    localStorage.setItem(DEFAULT_PATH_KEY, path);
    return path;
  }
  // Браузерный fallback: скачивание файла
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name}.mycad.json`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}

export async function openProject(): Promise<Project | null> {
  if (isTauri()) {
    const last = localStorage.getItem(DEFAULT_PATH_KEY) ?? "";
    const path = window.prompt("Путь к файлу проекта:", last);
    if (!path) return null;
    const project = await invoke<Project>("load_project", { path });
    localStorage.setItem(DEFAULT_PATH_KEY, path);
    return project;
  }
  // Браузерный fallback: выбор файла
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.mycad";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(JSON.parse(await file.text()) as Project);
    };
    input.click();
  });
}
