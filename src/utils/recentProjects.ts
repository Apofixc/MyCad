export interface RecentProjectItem {
  path: string;
  name: string;
  lastOpened: string; // ISO string
  fileCount?: number;
  componentCount?: number;
  author?: string;
  description?: string;
}

const STORAGE_KEY = "mycad_recent_projects_v1";
const MAX_RECENT_ITEMS = 10;

/**
 * Получает список недавних проектов из localStorage, отсортированный по времени последнего открытия.
 */
export function getRecentProjects(): RecentProjectItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
    );
  } catch (e) {
    console.error("Не удалось прочитать список недавних проектов:", e);
    return [];
  }
}

/**
 * Добавляет или обновляет проект в списке недавних.
 */
export function addRecentProject(
  project: Omit<RecentProjectItem, "lastOpened"> & { lastOpened?: string }
): void {
  try {
    const current = getRecentProjects();
    const now = new Date().toISOString();
    
    // Удаляем старую запись по такому же пути, если она была
    const filtered = current.filter((item) => item.path.toLowerCase() !== project.path.toLowerCase());
    
    const newItem: RecentProjectItem = {
      path: project.path,
      name: project.name,
      lastOpened: project.lastOpened || now,
      fileCount: project.fileCount,
      componentCount: project.componentCount,
      author: project.author,
      description: project.description,
    };

    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Не удалось сохранить недавний проект:", e);
  }
}

/**
 * Удаляет проект из истории по пути.
 */
export function removeRecentProject(path: string): void {
  try {
    const current = getRecentProjects();
    const updated = current.filter((item) => item.path.toLowerCase() !== path.toLowerCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Не удалось удалить недавний проект:", e);
  }
}

/**
 * Очищает историю недавних проектов.
 */
export function clearRecentProjects(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Не удалось очистить список недавних проектов:", e);
  }
}

/**
 * Форматирует ISO дату в понятный текст на русском языке:
 * "Только что", "5 минут назад", "Вчера, 14:20", "28 авг."
 */
export function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `Сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return `Вчера, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
    }

    if (diffDays < 7) {
      return `${diffDays} дн. назад`;
    }

    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "Недавно";
  }
}
