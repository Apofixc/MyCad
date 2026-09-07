import { invoke, isTauri as apiIsTauri } from "@tauri-apps/api/core";
import {
  Point2D,
  QuadPoints,
  CropRect,
  EllipseParams,
  loadImageElement,
} from "../utils/perspectiveTransform";
import { resolveImageSrc } from "../utils/imageUrl";

export interface ProcessImageResponse {
  dataUrl: string;
  filePath?: string;
  width: number;
  height: number;
}

export interface ImageProcessOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
  outputPath?: string;
}

function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return apiIsTauri() || Boolean((window as any).__TAURI_INTERNALS__);
}

export function getImageResultDisplaySrc(res: ProcessImageResponse): string {
  if (res.filePath) {
    const baseSrc = resolveImageSrc(res.filePath);
    const separator = baseSrc.includes("?") ? "&" : "?";
    return `${baseSrc}${separator}t=${Date.now()}`;
  }
  return res.dataUrl;
}

function resolveSource(source: string | HTMLImageElement): string {
  return typeof source === "string" ? source : source.src;
}

function detectDefaultMimeType(source: string, fallback = "image/jpeg"): string {
  const s = source.toLowerCase();
  if (s.startsWith("data:image/png") || s.endsWith(".png") || s.includes(".png?") || s.includes(".png#")) {
    return "image/png";
  }
  if (s.startsWith("data:image/webp") || s.endsWith(".webp") || s.includes(".webp?") || s.includes(".webp#")) {
    return "image/webp";
  }
  return fallback;
}

/**
 * Автоматическое определение 4 углов платы (QuadPoints).
 */
export async function detectBoardCornersAuto(
  imageSource: string | HTMLImageElement
): Promise<QuadPoints> {
  const srcStr = resolveSource(imageSource);
  if (isTauri()) {
    try {
      return await invoke<QuadPoints>("detect_board_corners", { source: srcStr });
    } catch (e) {
      console.warn("detect_board_corners error, falling back:", e);
    }
  }

  // Fallback
  const img = typeof imageSource === "string" ? await loadImageElement(srcStr) : imageSource;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  return {
    topLeft: { x: Math.round(w * 0.04), y: Math.round(h * 0.04) },
    topRight: { x: Math.round(w * 0.96), y: Math.round(h * 0.04) },
    bottomRight: { x: Math.round(w * 0.96), y: Math.round(h * 0.96) },
    bottomLeft: { x: Math.round(w * 0.04), y: Math.round(h * 0.96) },
  };
}

/**
 * 4-точечная трансформация перспективы (Homography / Warp Perspective)
 */
export async function warpPerspectiveAuto(
  imageSource: string | HTMLImageElement,
  quad: QuadPoints,
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  const defaultMime = detectDefaultMimeType(srcStr, "image/jpeg");

  if (isTauri()) {
    return invoke<ProcessImageResponse>("process_board_image", {
      request: {
        source: srcStr,
        operation: {
          type: "warpPerspective",
          quad,
          maxDimension: options?.maxDimension,
          quality: options?.quality ? Math.round(options.quality * 100) : 94,
          mimeType: options?.mimeType || defaultMime,
        },
        outputPath: options?.outputPath,
      },
    });
  }

  // Web canvas fallback
  const img = typeof imageSource === "string" ? await loadImageElement(srcStr) : imageSource;
  const canvas = document.createElement("canvas");
  const tw = Math.round(Math.max(10, Math.hypot(quad.topRight.x - quad.topLeft.x, quad.topRight.y - quad.topLeft.y)));
  const th = Math.round(Math.max(10, Math.hypot(quad.bottomLeft.x - quad.topLeft.x, quad.bottomLeft.y - quad.topLeft.y)));
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0, tw, th);
  }
  return {
    dataUrl: canvas.toDataURL(options?.mimeType || defaultMime, options?.quality || 0.92),
    width: tw,
    height: th,
  };
}

/**
 * Прямоугольная обрезка (Crop)
 */
export async function cropImageAuto(
  imageSource: string | HTMLImageElement,
  rect: CropRect,
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  const defaultMime = detectDefaultMimeType(srcStr, "image/jpeg");

  if (isTauri()) {
    return invoke<ProcessImageResponse>("process_board_image", {
      request: {
        source: srcStr,
        operation: {
          type: "crop",
          rect,
          maxDimension: options?.maxDimension,
          quality: options?.quality ? Math.round(options.quality * 100) : 94,
          mimeType: options?.mimeType || defaultMime,
        },
        outputPath: options?.outputPath,
      },
    });
  }

  const img = typeof imageSource === "string" ? await loadImageElement(srcStr) : imageSource;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width);
  canvas.height = Math.round(rect.height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  }
  return {
    dataUrl: canvas.toDataURL(options?.mimeType || defaultMime, options?.quality || 0.92),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

/**
 * Поворот на 90, 180 или 270 градусов
 */
export async function rotateImageAuto(
  imageSource: string | HTMLImageElement,
  angleDeg: 90 | 180 | 270,
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  const defaultMime = detectDefaultMimeType(srcStr, "image/jpeg");

  if (isTauri()) {
    return invoke<ProcessImageResponse>("process_board_image", {
      request: {
        source: srcStr,
        operation: {
          type: "rotate",
          angleDeg,
          quality: options?.quality ? Math.round(options.quality * 100) : 94,
          mimeType: options?.mimeType || defaultMime,
        },
        outputPath: options?.outputPath,
      },
    });
  }

  const img = typeof imageSource === "string" ? await loadImageElement(srcStr) : imageSource;
  const canvas = document.createElement("canvas");
  const is90or270 = angleDeg === 90 || angleDeg === 270;
  canvas.width = is90or270 ? img.naturalHeight || img.height : img.naturalWidth || img.width;
  canvas.height = is90or270 ? img.naturalWidth || img.width : img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(img, -(img.naturalWidth || img.width) / 2, -(img.naturalHeight || img.height) / 2);
  }
  return {
    dataUrl: canvas.toDataURL(options?.mimeType || defaultMime, options?.quality || 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Отражение по горизонтали / вертикали (Flip)
 */
export async function flipImageAuto(
  imageSource: string | HTMLImageElement,
  horizontal: boolean,
  vertical: boolean,
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  const defaultMime = detectDefaultMimeType(srcStr, "image/jpeg");

  if (isTauri()) {
    return invoke<ProcessImageResponse>("process_board_image", {
      request: {
        source: srcStr,
        operation: {
          type: "flip",
          horizontal,
          vertical,
          quality: options?.quality ? Math.round(options.quality * 100) : 94,
          mimeType: options?.mimeType || defaultMime,
        },
        outputPath: options?.outputPath,
      },
    });
  }

  const img = typeof imageSource === "string" ? await loadImageElement(srcStr) : imageSource;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
    ctx.drawImage(
      img,
      horizontal ? -canvas.width : 0,
      vertical ? -canvas.height : 0
    );
    ctx.restore();
  }
  return {
    dataUrl: canvas.toDataURL(options?.mimeType || defaultMime, options?.quality || 0.92),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Полигональная обрезка
 */
export async function cropPolygonAuto(
  imageSource: string | HTMLImageElement,
  points: Point2D[],
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  return invoke<ProcessImageResponse>("process_board_image", {
    request: {
      source: srcStr,
      operation: {
        type: "cropPolygon",
        points,
        maxDimension: options?.maxDimension,
        quality: options?.quality ? Math.round(options.quality * 100) : 94,
        mimeType: options?.mimeType || "image/png",
      },
      outputPath: options?.outputPath,
    },
  });
}

/**
 * Круговая / эллиптическая обрезка
 */
export async function cropEllipseAuto(
  imageSource: string | HTMLImageElement,
  params: EllipseParams,
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  return invoke<ProcessImageResponse>("process_board_image", {
    request: {
      source: srcStr,
      operation: {
        type: "cropEllipse",
        cx: params.cx,
        cy: params.cy,
        rx: params.rx,
        ry: params.ry,
        maxDimension: options?.maxDimension,
        quality: options?.quality ? Math.round(options.quality * 100) : 94,
        mimeType: options?.mimeType || "image/png",
      },
      outputPath: options?.outputPath,
    },
  });
}

/**
 * Оптимизация разрешения (Lanczos3)
 */
export async function resizeImageAuto(
  imageSource: string | HTMLImageElement,
  maxDimension: number,
  options?: ImageProcessOptions
): Promise<ProcessImageResponse> {
  const srcStr = resolveSource(imageSource);
  const defaultMime = detectDefaultMimeType(srcStr, "image/jpeg");
  return invoke<ProcessImageResponse>("process_board_image", {
    request: {
      source: srcStr,
      operation: {
        type: "resize",
        maxDimension,
        quality: options?.quality ? Math.round(options.quality * 100) : 94,
        mimeType: options?.mimeType || defaultMime,
      },
      outputPath: options?.outputPath,
    },
  });
}
