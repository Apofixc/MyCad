import { convertFileSrc, isTauri as apiIsTauri } from "@tauri-apps/api/core";

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return apiIsTauri() || Boolean((window as any).__TAURI_INTERNALS__);
}

/**
 * Преобразует путь или URL к изображению для отображения в Webview:
 * - Если это Data URL (Base64), HTTP/HTTPS URL или Blob URL — оставляет без изменений.
 * - Если это абсолютный путь к локальному файлу на диске в среде Tauri —
 *   конвертирует его через convertFileSrc() в безопасный URL локального asset-протокола.
 * - Для браузера — возвращает исходную строку.
 */
export function resolveImageSrc(src?: string): string {
  if (!src) return "";
  if (
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:") ||
    src.startsWith("asset://")
  ) {
    return src;
  }

  if (isTauri()) {
    try {
      return convertFileSrc(src);
    } catch (e) {
      console.warn("Ошибка преобразования пути через convertFileSrc:", src, e);
      return src;
    }
  }

  return src;
}
