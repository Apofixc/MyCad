import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Project,
  BoardData,
  ProjectFile,
  ComponentItem,
  ComponentType,
  normalizeBoardData,
} from "./types/project";
import { addRecentProject } from "./utils/recentProjects";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Подсчитывает общее число компонентов в проекте по всем платам.
 */
function countTotalComponents(project: Project): number {
  return project.files.reduce((acc, file) => {
    if (file.type === "board" && file.data) {
      const b = file.data as BoardData;
      return acc + (b.components?.length || 0);
    }
    return acc;
  }, 0);
}

/**
 * Полноценное сохранение проекта.
 * Если saveAs === true или у проекта ещё нет пути (filePath), вызывается нативный диалог сохранения.
 * Иначе сохраняет напрямую в существующий файл.
 */
export async function saveProject(
  project: Project,
  saveAs = false
): Promise<{ project: Project; path: string } | null> {
  let targetPath = project.filePath;

  if (isTauri()) {
    // Если требуется диалог выбора пути
    if (saveAs || !targetPath) {
      const defaultName = `${project.name || "Project"}.mycad`;
      const selected = await save({
        defaultPath: targetPath || defaultName,
        filters: [
          {
            name: "MyCad Project (*.mycad)",
            extensions: ["mycad", "json"],
          },
        ],
      });

      if (!selected) {
        return null; // Пользователь нажал "Отмена"
      }
      targetPath = selected;
    }

    // Извлекаем чистое имя файла из пути для обновления name (если сохранили с новым именем)
    const fileNameWithExt = targetPath.split(/[\\/]/).pop() || "";
    const cleanName = fileNameWithExt.replace(/\.(mycad|json)$/i, "") || project.name;

    const updatedProject: Project = {
      ...project,
      name: cleanName,
      filePath: targetPath,
      updatedAt: new Date().toISOString(),
      formatVersion: 1,
    };

    // Вызов команды Rust для создания ZIP-контейнера .mycad
    await invoke("save_project", {
      path: targetPath,
      project: updatedProject,
    });

    // Сохраняем в список недавних
    addRecentProject({
      path: targetPath,
      name: updatedProject.name,
      fileCount: updatedProject.files.length,
      componentCount: countTotalComponents(updatedProject),
      author: updatedProject.author,
      description: updatedProject.description,
    });

    return { project: updatedProject, path: targetPath };
  }

  // Браузерный fallback для отладки
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fallbackPath = `${project.name || "Project"}.mycad`;
  a.href = url;
  a.download = fallbackPath;
  a.click();
  URL.revokeObjectURL(url);

  const updatedProj: Project = {
    ...project,
    filePath: fallbackPath,
    updatedAt: new Date().toISOString(),
  };

  addRecentProject({
    path: fallbackPath,
    name: updatedProj.name,
    fileCount: updatedProj.files.length,
    componentCount: countTotalComponents(updatedProj),
    author: updatedProj.author,
  });

  return { project: updatedProj, path: fallbackPath };
}

/**
 * Полноценное открытие проекта с диска.
 * Если передан targetPath, открывает конкретный файл (например, из списка недавних).
 * Если targetPath не передан, открывает системный нативный проводник.
 */
export async function openProject(
  targetPath?: string
): Promise<{ project: Project; path: string } | null> {
  if (isTauri()) {
    let filePath = targetPath;

    if (!filePath) {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "MyCad Project (*.mycad, *.json)",
            extensions: ["mycad", "json"],
          },
        ],
      });

      if (!selected) return null;
      filePath = Array.isArray(selected) ? selected[0] : selected;
    }

    if (!filePath) return null;

    // Читаем проект через Rust команду
    const rawData = await invoke<Record<string, unknown>>("load_project", { path: filePath });
    const project = normalizeLoadedProject(rawData, filePath);

    // Добавляем в недавние проекты
    addRecentProject({
      path: filePath,
      name: project.name,
      fileCount: project.files.length,
      componentCount: countTotalComponents(project),
      author: project.author,
      description: project.description,
    });

    return { project, path: filePath };
  }

  // Браузерный fallback (выбор файла через input)
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mycad,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);

      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const project = normalizeLoadedProject(raw, file.name);

        addRecentProject({
          path: file.name,
          name: project.name,
          fileCount: project.files.length,
          componentCount: countTotalComponents(project),
          author: project.author,
        });

        resolve({ project, path: file.name });
      } catch (err) {
        console.error("Ошибка открытия файла проекта:", err);
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Нормализует загруженные сырые данные в актуальную структуру Project.
 * Обрабатывает как новый формат, так и legacy-структуру прототипа.
 */
function normalizeLoadedProject(raw: Record<string, unknown>, filePath: string): Project {
  // Legacy формат mycad-core (если есть поле modules)
  if (Array.isArray(raw.modules) && raw.modules.length > 0) {
    return convertLegacyProject(raw, filePath);
  }

  const fileNameWithExt = filePath.split(/[\\/]/).pop() || "Project";
  const fallbackName = fileNameWithExt.replace(/\.(mycad|json)$/i, "");

  const files: ProjectFile[] = Array.isArray(raw.files)
    ? (raw.files as ProjectFile[]).map((f, i) => {
        const fileType = f.type === "sch" ? "sch" : "board";
        return {
          id: f.id || `file_${i}_${Date.now()}`,
          name: f.name || `Документ_${i + 1}`,
          type: fileType,
          data:
            fileType === "sch"
              ? f.data || { id: f.id, name: f.name }
              : normalizeBoardData((f.data as Partial<BoardData>) || { id: f.id, name: f.name }),
        };
      })
    : [];

  const activeFileId =
    typeof raw.activeFileId === "string" && files.some((f) => f.id === raw.activeFileId)
      ? raw.activeFileId
      : files.length > 0
      ? files[0].id
      : "";

  return {
    id: String(raw.id || `proj_${Date.now()}`),
    name: String(raw.name || fallbackName),
    description: typeof raw.description === "string" ? raw.description : undefined,
    author: typeof raw.author === "string" ? raw.author : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    formatVersion: typeof raw.formatVersion === "number" ? raw.formatVersion : 1,
    filePath,
    files,
    activeFileId,
  };
}

/**
 * Конвертирует проект старого формата (mycad-core с модулями и компонентами)
 * в новый древовидный формат с полноценным .board файлом.
 */
function convertLegacyProject(raw: Record<string, unknown>, filePath: string): Project {
  const modules = raw.modules as Array<Record<string, unknown>>;
  const mod = modules[0] || {};
  const compsRaw = (mod.components as Array<Record<string, unknown>>) || [];

  const convertedComponents: ComponentItem[] = compsRaw.map((c, idx) => {
    let type: ComponentType = "resistor";
    const des = String(c.designator || "").toUpperCase();
    if (des.startsWith("R")) type = "resistor";
    else if (des.startsWith("C")) type = "capacitor";
    else if (des.startsWith("VD") || des.startsWith("D")) type = "diode";
    else if (des.startsWith("U") || des.startsWith("DD") || des.startsWith("DA")) type = "ic_soic8";
    else if (des.startsWith("TP") || des.startsWith("XP")) type = "testpoint";

    return {
      id: String(c.id || `comp_${idx}`),
      refDes: String(c.designator || `C${idx}`),
      value: String(c.value || ""),
      type,
      x: Number(c.x || 0),
      y: Number(c.y || 0),
      rotation: Number(c.rotation || 0),
      pins: [
        { id: "p1", number: 1, x: -10, y: 0 },
        { id: "p2", number: 2, x: 10, y: 0 },
      ],
    };
  });

  const boardId = `file_board_${Date.now()}`;
  const boardData: BoardData = normalizeBoardData({
    id: boardId,
    name: `${raw.name || "Плата"}.board`,
    bgImage: "backup_20260830_124935/pcb_board.png",
    bgOpacity: 0.85,
    bgScale: 1,
    bgOffsetX: 0,
    bgOffsetY: 0,
    components: convertedComponents,
  });

  const boardFile: ProjectFile = {
    id: boardId,
    name: boardData.name,
    type: "board",
    data: boardData,
  };

  return {
    id: `proj_${Date.now()}`,
    name: String(raw.name || "Проект"),
    description: "Импортировано из референс-проекта",
    author: "Инженер",
    createdAt: new Date().toISOString(),
    filePath,
    files: [boardFile],
    activeFileId: boardId,
  };
}

