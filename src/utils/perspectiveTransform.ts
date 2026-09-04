/**
 * Утилиты для геометрической трансформации изображений:
 * - Устранение перспективы по 4 углам (Keystone / 4-Point Homography Warp)
 * - Прямоугольное кадрирование (Crop)
 * - Поворот на 90° / 180° / 270°
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface QuadPoints {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Вычисляет расстояние между двумя точками.
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Оценивает оптимальные размеры прямоугольного вывода (W, H)
 * на основе длин противоположных сторон четырехугольника.
 */
export function calculateTargetDimensions(
  quad: QuadPoints,
  maxDimension = 3600
): { width: number; height: number } {
  const widthTop = distance(quad.topLeft, quad.topRight);
  const widthBottom = distance(quad.bottomLeft, quad.bottomRight);
  const heightLeft = distance(quad.topLeft, quad.bottomLeft);
  const heightRight = distance(quad.topRight, quad.bottomRight);

  let targetW = Math.max(10, Math.round(Math.max(widthTop, widthBottom)));
  let targetH = Math.max(10, Math.round(Math.max(heightLeft, heightRight)));

  // Ограничиваем максимальное измерение для оптимизации производительности и памяти
  if (targetW > maxDimension || targetH > maxDimension) {
    const scale = maxDimension / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  return { width: targetW, height: targetH };
}

/**
 * Загружает HTMLImageElement из строки src (Data URL или URL).
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Выполняет трансформацию перспективы (Unwarp / Homography)
 * на основе 4 угловых точек четырехугольника на исходном изображении.
 * Использует замкнутое аналитическое решение отображения единичного квадрата в 4-угольник (Heckbert)
 * с обратным билинейным сэмплированием пикселей.
 */
export async function warpPerspective(
  sourceImage: HTMLImageElement,
  quad: QuadPoints,
  options?: {
    maxDimension?: number;
    quality?: number;
    mimeType?: string;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const maxDim = options?.maxDimension ?? 3600;
  const { width: targetW, height: targetH } = calculateTargetDimensions(quad, maxDim);

  // 1. Получаем пиксели исходного изображения
  const srcW = sourceImage.naturalWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.height;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Failed to get 2D context for source canvas");

  srcCtx.drawImage(sourceImage, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcPixels = srcData.data;

  // 2. Создаем целевой canvas
  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = targetW;
  dstCanvas.height = targetH;
  const dstCtx = dstCanvas.getContext("2d");
  if (!dstCtx) throw new Error("Failed to get 2D context for dest canvas");

  const dstData = dstCtx.createImageData(targetW, targetH);
  const dstPixels = dstData.data;

  // 3. Вычисляем коэффициенты проективного преобразования из единичного квадрата (u, v) in [0, 1]
  // в четырехугольник (x0, y0), (x1, y1), (x2, y2), (x3, y3) на исходном изображении
  const x0 = quad.topLeft.x;
  const y0 = quad.topLeft.y;
  const x1 = quad.topRight.x;
  const y1 = quad.topRight.y;
  const x2 = quad.bottomRight.x;
  const y2 = quad.bottomRight.y;
  const x3 = quad.bottomLeft.x;
  const y3 = quad.bottomLeft.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;

  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;

  let a: number, b: number, c: number;
  let d: number, e: number, f: number;
  let g: number, h: number;

  const det = dx1 * dy2 - dx2 * dy1;

  if (Math.abs(det) < 1e-7 || (Math.abs(sx) < 1e-7 && Math.abs(sy) < 1e-7)) {
    // Аффинное приближение (параллелограмм)
    a = x1 - x0;
    b = x2 - x1;
    c = x0;
    d = y1 - y0;
    e = y2 - y1;
    f = y0;
    g = 0;
    h = 0;
  } else {
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
  }

  // 4. Проходим по каждому пикселю целевого изображения (x_d, y_d)
  // и вычисляем соответствующую непрерывную координату (x_s, y_s) на источнике
  const invW = 1 / targetW;
  const invH = 1 / targetH;
  let dstIdx = 0;

  for (let yd = 0; yd < targetH; yd++) {
    const v = (yd + 0.5) * invH;
    for (let xd = 0; xd < targetW; xd++) {
      const u = (xd + 0.5) * invW;

      const denom = g * u + h * v + 1;
      const invDenom = Math.abs(denom) > 1e-7 ? 1 / denom : 1;

      const xs = (a * u + b * v + c) * invDenom;
      const ys = (d * u + e * v + f) * invDenom;

      // Билинейная интерполяция
      if (xs >= 0 && xs < srcW - 1 && ys >= 0 && ys < srcH - 1) {
        const xFloor = Math.floor(xs);
        const yFloor = Math.floor(ys);
        const fx = xs - xFloor;
        const fy = ys - yFloor;
        const ifx = 1 - fx;
        const ify = 1 - fy;

        const w00 = ifx * ify;
        const w10 = fx * ify;
        const w01 = ifx * fy;
        const w11 = fx * fy;

        const row0 = yFloor * srcW;
        const row1 = (yFloor + 1) * srcW;
        const idx00 = (row0 + xFloor) << 2;
        const idx10 = (row0 + xFloor + 1) << 2;
        const idx01 = (row1 + xFloor) << 2;
        const idx11 = (row1 + xFloor + 1) << 2;

        dstPixels[dstIdx] = (srcPixels[idx00] * w00 + srcPixels[idx10] * w10 + srcPixels[idx01] * w01 + srcPixels[idx11] * w11) | 0;
        dstPixels[dstIdx + 1] = (srcPixels[idx00 + 1] * w00 + srcPixels[idx10 + 1] * w10 + srcPixels[idx01 + 1] * w01 + srcPixels[idx11 + 1] * w11) | 0;
        dstPixels[dstIdx + 2] = (srcPixels[idx00 + 2] * w00 + srcPixels[idx10 + 2] * w10 + srcPixels[idx01 + 2] * w01 + srcPixels[idx11 + 2] * w11) | 0;
        dstPixels[dstIdx + 3] = (srcPixels[idx00 + 3] * w00 + srcPixels[idx10 + 3] * w10 + srcPixels[idx01 + 3] * w01 + srcPixels[idx11 + 3] * w11) | 0;
      } else if (xs >= -0.5 && xs < srcW && ys >= -0.5 && ys < srcH) {
        // Краевые пиксели — ближайший сосед
        const clX = Math.max(0, Math.min(srcW - 1, Math.round(xs)));
        const clY = Math.max(0, Math.min(srcH - 1, Math.round(ys)));
        const idx = (clY * srcW + clX) << 2;

        dstPixels[dstIdx] = srcPixels[idx];
        dstPixels[dstIdx + 1] = srcPixels[idx + 1];
        dstPixels[dstIdx + 2] = srcPixels[idx + 2];
        dstPixels[dstIdx + 3] = srcPixels[idx + 3];
      } else {
        // За пределами
        dstPixels[dstIdx + 3] = 0;
      }

      dstIdx += 4;
    }
  }

  dstCtx.putImageData(dstData, 0, 0);

  const mime = options?.mimeType || "image/jpeg";
  const quality = options?.quality ?? 0.92;
  const dataUrl = dstCanvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: targetW,
    height: targetH,
  };
}

/**
 * Прямоугольное кадрирование (Crop) изображения.
 */
export async function cropImage(
  sourceImage: HTMLImageElement,
  rect: CropRect,
  options?: {
    quality?: number;
    mimeType?: string;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const srcW = sourceImage.naturalWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.height;

  // Ограничиваем прямоугольник пределами изображения
  const x = Math.max(0, Math.min(srcW - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(srcH - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(srcW - x, Math.round(rect.width)));
  const h = Math.max(1, Math.min(srcH - y, Math.round(rect.height)));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");

  ctx.drawImage(sourceImage, x, y, w, h, 0, 0, w, h);

  const mime = options?.mimeType || "image/jpeg";
  const quality = options?.quality ?? 0.92;
  const dataUrl = canvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: w,
    height: h,
  };
}

/**
 * Поворачивает изображение на фиксированный угол (90, 180, 270 градусов).
 */
export async function rotateImageFixed(
  sourceImage: HTMLImageElement,
  angleDeg: 90 | 180 | 270,
  options?: {
    quality?: number;
    mimeType?: string;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const srcW = sourceImage.naturalWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.height;

  const canvas = document.createElement("canvas");
  const isSwap = angleDeg === 90 || angleDeg === 270;
  canvas.width = isSwap ? srcH : srcW;
  canvas.height = isSwap ? srcW : srcH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.drawImage(sourceImage, -srcW / 2, -srcH / 2);

  const mime = options?.mimeType || "image/jpeg";
  const quality = options?.quality ?? 0.92;
  const dataUrl = canvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}
