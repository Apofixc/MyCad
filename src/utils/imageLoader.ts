import { invoke, isTauri as apiIsTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { LayerImageItem } from "../types/project";

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return apiIsTauri() || Boolean((window as any).__TAURI_INTERNALS__);
}

/**
 * Открывает системный проводник для выбора изображений.
 * В окружении Tauri вызывает нативный плагин @tauri-apps/plugin-dialog с последующим
 * получением Data URL через команду Rust `read_image_file`.
 * В веб-окружении использует fallback через временный <input type="file">.
 */
export async function openImageFileDialog(): Promise<File[]> {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: "Изображения (*.png, *.jpg, *.jpeg, *.webp, *.bmp, *.svg)",
            extensions: ["png", "jpg", "jpeg", "webp", "bmp", "svg", "PNG", "JPG", "JPEG", "WEBP", "BMP", "SVG"],
          },
          {
            name: "Все файлы (*.*)",
            extensions: ["*"],
          },
        ],
      });

      if (!selected) return [];

      const paths = Array.isArray(selected) ? selected : [selected];
      const files: File[] = [];

      for (const p of paths) {
        try {
          const res = await invoke<{ name: string; mime: string; data_url?: string; bytes?: number[] }>(
            "read_image_file",
            { path: p }
          );

          if (res.data_url) {
            const response = await fetch(res.data_url);
            const blob = await response.blob();
            const file = new File([blob], res.name, { type: res.mime });
            (file as any).dataUrl = res.data_url;
            files.push(file);
          } else if (res.bytes && res.bytes.length > 0) {
            const u8 = new Uint8Array(res.bytes);
            const blob = new Blob([u8], { type: res.mime });
            const file = new File([blob], res.name, { type: res.mime });
            files.push(file);
          }
        } catch (err) {
          console.error("Ошибка чтения файла через Tauri invoke('read_image_file'):", p, err);
        }
      }

      if (files.length > 0) {
        return files;
      }
    } catch (e) {
      console.error("Ошибка вызова нативного диалога Tauri open():", e);
    }
  }

  // Браузерный fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/jpg, image/webp, image/bmp, image/svg+xml, image/*";
    input.multiple = true;
    input.style.position = "fixed";
    input.style.top = "-9999px";
    input.style.left = "-9999px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.style.width = "1px";
    input.style.height = "1px";

    let resolved = false;

    const cleanup = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    input.onchange = () => {
      if (resolved) return;
      resolved = true;
      const files = Array.from(input.files || []);
      cleanup();
      resolve(files);
    };

    input.oncancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve([]);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Читает файл как Data URL (Base64).
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  if ((file as any).dataUrl) {
    return Promise.resolve((file as any).dataUrl);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Извлекает естественные размеры изображения (naturalWidth, naturalHeight).
 */
export function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || 800,
        height: img.naturalHeight || 600,
      });
    };
    img.onerror = () => {
      resolve({ width: 800, height: 600 });
    };
    img.src = src;
  });
}

/**
 * Ограничивает экстремально большие разрешения сканов и фото (например > 4096 px),
 * чтобы исключить исчерпание видеопамяти браузера, зависание GPU и лаги в интерфейсе.
 * Сохраняет безупречную четкость деталей платы (0.02 мм/пиксель).
 */
export async function normalizeImageResolution(
  src: string,
  maxDimension = 4096
): Promise<{ dataUrl: string; width: number; height: number; wasResized: boolean }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      if (origW <= maxDimension && origH <= maxDimension) {
        resolve({ dataUrl: src, width: origW, height: origH, wasResized: false });
        return;
      }

      const scale = maxDimension / Math.max(origW, origH);
      const targetW = Math.round(origW * scale);
      const targetH = Math.round(origH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ dataUrl: src, width: origW, height: origH, wasResized: false });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const isPng =
        src.startsWith("data:image/png") ||
        (!src.startsWith("data:") && src.toLowerCase().includes(".png"));
      const mime = isPng ? "image/png" : "image/jpeg";
      const quality = isPng ? undefined : 0.94;
      const optimizedUrl = canvas.toDataURL(mime, quality);

      resolve({
        dataUrl: optimizedUrl,
        width: targetW,
        height: targetH,
        wasResized: true,
      });
    };

    img.onerror = () => {
      resolve({ dataUrl: src, width: 800, height: 600, wasResized: false });
    };

    img.src = src;
  });
}

/**
 * Преобразует файл изображения в готовый объект подложки LayerImageItem
 * с реальными размерами и начальными параметрами трансформации.
 * При необходимости автоматически нормализует сверхвысокие разрешения (> 4096px).
 */
export async function createLayerImageItemFromFile(
  file: File,
  params: {
    isTop: boolean;
    defaultX?: number;
    defaultY?: number;
    order?: number;
    index?: number;
  }
): Promise<LayerImageItem> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const normalized = await normalizeImageResolution(rawDataUrl, 4096);

  const cleanName =
    file.name.replace(/\.[^/.]+$/, "") ||
    `Скан_${params.isTop ? "Top" : "Bottom"}_${(params.index ?? 0) + 1}`;

  return {
    id: `img_${params.isTop ? "top" : "bottom"}_${Date.now()}_${params.index ?? 0}`,
    name: cleanName,
    src: normalized.dataUrl,
    x: typeof params.defaultX === "number" ? Math.round(params.defaultX) : 0,
    y: typeof params.defaultY === "number" ? Math.round(params.defaultY) : 0,
    width: normalized.width,
    height: normalized.height,
    scale: 1,
    rotation: 0,
    opacity: 0.85,
    brightness: 100,
    contrast: 100,
    invert: false,
    mirrored: !params.isTop, // Для обратной стороны платы (Bottom) по умолчанию зеркалируем
    flipV: false,
    locked: false,
    visible: true,
    order: params.order ?? 0,
  };
}

/**
 * Создает объект подложки LayerImageItem напрямую из Data URL с указанными размерами.
 */
export function createLayerImageItemFromDataUrl(
  dataUrl: string,
  name: string,
  width: number,
  height: number,
  params: {
    isTop: boolean;
    defaultX?: number;
    defaultY?: number;
    order?: number;
    index?: number;
  }
): LayerImageItem {
  const cleanName = name.replace(/\.[^/.]+$/, "") || `Скан_${params.isTop ? "Top" : "Bottom"}`;
  return {
    id: `img_${params.isTop ? "top" : "bottom"}_${Date.now()}_${params.index ?? 0}`,
    name: cleanName,
    src: dataUrl,
    x: typeof params.defaultX === "number" ? Math.round(params.defaultX) : 0,
    y: typeof params.defaultY === "number" ? Math.round(params.defaultY) : 0,
    width,
    height,
    scale: 1,
    rotation: 0,
    opacity: 0.85,
    brightness: 100,
    contrast: 100,
    invert: false,
    mirrored: !params.isTop,
    flipV: false,
    locked: false,
    visible: true,
    order: params.order ?? 0,
  };
}

/**
 * Извлекает файлы изображений из события Drag-and-Drop.
 */
export function extractImagesFromDrop(e: React.DragEvent): File[] {
  const items = Array.from(e.dataTransfer.files || []);
  return items.filter((f) => f.type.startsWith("image/"));
}

/**
 * Извлекает файл изображения из буфера обмена (Ctrl+V).
 */
export function extractImageFromClipboard(
  e: React.ClipboardEvent | ClipboardEvent
): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  return null;
}
