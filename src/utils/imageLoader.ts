import { invoke, isTauri as apiIsTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { BoardImageLayer } from "../types/cad";
import { resolveImageSrc } from "./imageUrl";
import { resizeImageAuto } from "../services/backendImageProcessor";

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return apiIsTauri() || Boolean((window as any).__TAURI_INTERNALS__);
}

/**
 * Читает файл как Data URL (Base64).
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

/**
 * Определяет реальные пиксельные размеры изображения.
 */
export function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    };
    img.onerror = (err) => {
      reject(new Error(`Не удалось загрузить изображение для вычисления размеров: ${err}`));
    };
    img.src = src;
  });
}

/**
 * Открывает нативный системный диалог выбора файлов изображений.
 * В Tauri вызывает нативный диалог @tauri-apps/plugin-dialog и считывает
 * метаданные через команду Rust `read_image_file`.
 * В веб-браузере использует fallback через скрытый <input type="file">.
 */
export async function openImageFileDialog(): Promise<File[]> {
  if (isTauri()) {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: "Изображения плат (*.png, *.jpg, *.jpeg, *.webp, *.bmp, *.tif, *.tiff, *.svg)",
            extensions: [
              "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "svg",
              "PNG", "JPG", "JPEG", "WEBP", "BMP", "TIF", "TIFF", "SVG",
            ],
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
          const res = await invoke<{
            name: string;
            mime: string;
            filePath: string;
            width?: number;
            height?: number;
          }>("read_image_file", { path: p });

          const targetPath = res.filePath || p;
          const file = new File([], res.name || "image", { type: res.mime });
          (file as any).filePath = targetPath;
          if (res.width && res.height) {
            (file as any).width = res.width;
            (file as any).height = res.height;
          }
          files.push(file);
        } catch (err) {
          console.error("Ошибка при получении метаданных через read_image_file:", p, err);
          const name = p.split(/[/\\]/).pop() || "image";
          const file = new File([], name);
          (file as any).filePath = p;
          files.push(file);
        }
      }

      return files;
    } catch (err) {
      console.warn("Ошибка Tauri диалога выбора файла:", err);
    }
  }

  // Fallback для браузера
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.tif,.tiff,.bmp,.webp";
    input.onchange = () => {
      const files = Array.from(input.files || []);
      resolve(files);
    };
    input.click();
  });
}

/**
 * Нормализует разрешение сверхтяжелых фото (> 4096 px),
 * чтобы не перегружать память GPU и холст браузера.
 */
export async function normalizeImageResolution(
  src: string,
  maxDimension = 4096
): Promise<{ dataUrl: string; filePath?: string; width: number; height: number; wasResized: boolean }> {
  const dims = await getImageDimensions(resolveImageSrc(src));
  const needsResize = dims.width > maxDimension || dims.height > maxDimension;

  if (isTauri() && needsResize) {
    try {
      const res = await resizeImageAuto(src, maxDimension);
      return {
        dataUrl: res.dataUrl,
        filePath: res.filePath,
        width: res.width,
        height: res.height,
        wasResized: true,
      };
    } catch (err) {
      console.warn("Ошибка ресайза в normalizeImageResolution:", err);
    }
  }

  return {
    dataUrl: src,
    filePath: src.startsWith("data:") ? undefined : src,
    width: dims.width,
    height: dims.height,
    wasResized: false,
  };
}

/**
 * Преобразует File в объект слоя платы BoardImageLayer
 * с корректными размерами и стартовыми параметрами трансформации.
 */
export async function createLayerImageItemFromFile(
  file: File,
  params: {
    isTop: boolean;
    defaultX?: number;
    defaultY?: number;
    index?: number;
    explicitDims?: { width: number; height: number };
    explicitSrc?: string;
    preserveOriginal?: boolean;
  }
): Promise<BoardImageLayer> {
  const filePath = (file as any).filePath as string | undefined;
  let finalSrc: string;
  let width: number;
  let height: number;

  if (params.explicitDims && params.explicitDims.width > 0 && params.explicitDims.height > 0) {
    width = params.explicitDims.width;
    height = params.explicitDims.height;
    finalSrc = params.explicitSrc || (filePath && isTauri() ? filePath : (file as any).dataUrl || "");
    if (!finalSrc) {
      finalSrc = await readFileAsDataUrl(file);
    }
  } else if (filePath && isTauri()) {
    let resolvedPath = filePath;
    let w = (file as any).width as number | undefined;
    let h = (file as any).height as number | undefined;

    const isTiff = /\.(tiff?)$/i.test(resolvedPath);
    if (!w || !h || isTiff) {
      try {
        const info = await invoke<{
          name: string;
          mime: string;
          filePath?: string;
          width?: number;
          height?: number;
        }>("read_image_file", { path: resolvedPath });
        if (info.filePath) resolvedPath = info.filePath;
        if (info.width && info.height) {
          w = info.width;
          h = info.height;
        }
      } catch (err) {
        console.warn("read_image_file info failed:", err);
      }
    }

    if (!w || !h) {
      const dims = await getImageDimensions(resolveImageSrc(resolvedPath));
      w = dims.width;
      h = dims.height;
    }

    if (!params.preserveOriginal && (w > 4096 || h > 4096)) {
      const normalized = await normalizeImageResolution(resolvedPath, 4096);
      finalSrc = normalized.filePath || normalized.dataUrl;
      width = normalized.width;
      height = normalized.height;
    } else {
      finalSrc = resolvedPath;
      width = w;
      height = h;
    }
  } else {
    const rawDataUrl = await readFileAsDataUrl(file);
    if (!params.preserveOriginal) {
      const normalized = await normalizeImageResolution(rawDataUrl, 4096);
      finalSrc = normalized.filePath || normalized.dataUrl;
      width = normalized.width;
      height = normalized.height;
    } else {
      const dims = await getImageDimensions(rawDataUrl);
      finalSrc = rawDataUrl;
      width = dims.width;
      height = dims.height;
    }
  }

  const cleanName =
    file.name.replace(/\.[^/.]+$/, "") ||
    `Фото_${params.isTop ? "Top" : "Bottom"}_${(params.index ?? 0) + 1}`;

  const side: "top" | "bottom" = params.isTop ? "top" : "bottom";

  return {
    id: `img_${side}_${Date.now()}_${params.index ?? 0}`,
    name: cleanName,
    side,
    imageFile: file.name,
    cachedUrl: finalSrc,
    offsetX: typeof params.defaultX === "number" ? Math.round(params.defaultX) : 0,
    offsetY: typeof params.defaultY === "number" ? Math.round(params.defaultY) : 0,
    width,
    height,
    scale: 1,
    lockAspectRatio: true,
    rotation: 0,
    opacity: 0.85,
    brightness: 100,
    contrast: 100,
    invert: false,
    grayscale: false,
    blendMode: "normal",
    tintColor: "none",
    dpi: 600,
    pxPerMm: 23.62,
    mirrored: !params.isTop, // Нижняя сторона (Bottom) по умолчанию зеркалируется
    flipV: false,
    locked: false,
    visible: true,
  };
}

/**
 * Создает объект слоя BoardImageLayer напрямую из параметров.
 */
export function createLayerImageItem(
  src: string,
  name: string,
  width: number,
  height: number,
  params: {
    isTop: boolean;
    defaultX?: number;
    defaultY?: number;
    index?: number;
  }
): BoardImageLayer {
  const cleanName = name.replace(/\.[^/.]+$/, "") || `Фото_${params.isTop ? "Top" : "Bottom"}`;
  const side: "top" | "bottom" = params.isTop ? "top" : "bottom";
  return {
    id: `img_${side}_${Date.now()}_${params.index ?? 0}`,
    name: cleanName,
    side,
    imageFile: cleanName,
    cachedUrl: src,
    offsetX: typeof params.defaultX === "number" ? Math.round(params.defaultX) : 0,
    offsetY: typeof params.defaultY === "number" ? Math.round(params.defaultY) : 0,
    width,
    height,
    scale: 1,
    lockAspectRatio: true,
    rotation: 0,
    opacity: 0.85,
    brightness: 100,
    contrast: 100,
    invert: false,
    grayscale: false,
    blendMode: "normal",
    tintColor: "none",
    dpi: 600,
    pxPerMm: 23.62,
    mirrored: !params.isTop,
    flipV: false,
    locked: false,
    visible: true,
  };
}

export const createLayerImageItemFromDataUrl = createLayerImageItem;

/**
 * Извлекает файлы изображений из события Drag & Drop.
 */
export function extractImagesFromDrop(e: React.DragEvent): File[] {
  const items = Array.from(e.dataTransfer.files || []);
  return items
    .filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(png|jpe?g|webp|bmp|tiff?|svg)$/i.test(f.name)
    )
    .map((f) => {
      const nativePath = (f as any).path;
      if (nativePath && !(f as any).filePath) {
        (f as any).filePath = nativePath;
      }
      return f;
    });
}

/**
 * Извлекает изображение из буфера обмена (Ctrl+V).
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
