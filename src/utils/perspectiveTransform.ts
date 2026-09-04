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
  const rawSrcW = sourceImage.naturalWidth || sourceImage.width;
  const rawSrcH = sourceImage.naturalHeight || sourceImage.height;

  // Ограничиваем рабочий исходный canvas максимум 4096px,
  // чтобы исключить создание гигантских 600-мегабайтных буферов и зависание JS
  const MAX_SOURCE_DIM = 4096;
  let srcScale = 1;
  let srcW = rawSrcW;
  let srcH = rawSrcH;

  if (rawSrcW > MAX_SOURCE_DIM || rawSrcH > MAX_SOURCE_DIM) {
    srcScale = MAX_SOURCE_DIM / Math.max(rawSrcW, rawSrcH);
    srcW = Math.round(rawSrcW * srcScale);
    srcH = Math.round(rawSrcH * srcScale);
  }

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Failed to get 2D context for source canvas");

  srcCtx.drawImage(sourceImage, 0, 0, srcW, srcH);
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
  const x0 = quad.topLeft.x * srcScale;
  const y0 = quad.topLeft.y * srcScale;
  const x1 = quad.topRight.x * srcScale;
  const y1 = quad.topRight.y * srcScale;
  const x2 = quad.bottomRight.x * srcScale;
  const y2 = quad.bottomRight.y * srcScale;
  const x3 = quad.bottomLeft.x * srcScale;
  const y3 = quad.bottomLeft.y * srcScale;

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
    // Аффинное приближение (параллелограмм / прямоугольник)
    a = x1 - x0;
    b = x3 - x0;
    c = x0;
    d = y1 - y0;
    e = y3 - y0;
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
    const bv_c = b * v + c;
    const ev_f = e * v + f;
    const hv_1 = h * v + 1;

    for (let xd = 0; xd < targetW; xd++) {
      const u = (xd + 0.5) * invW;

      const denom = g * u + hv_1;
      const invDenom = Math.abs(denom) > 1e-7 ? 1 / denom : 1;

      const xs = (a * u + bv_c) * invDenom;
      const ys = (d * u + ev_f) * invDenom;

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
  const quality = options?.quality ?? 0.94;
  const dataUrl = dstCanvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: targetW,
    height: targetH,
  };
}

/**
 * Прямоугольное кадрирование (Crop) изображения с контролем лимита размеров.
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
  let w = Math.max(1, Math.min(srcW - x, Math.round(rect.width)));
  let h = Math.max(1, Math.min(srcH - y, Math.round(rect.height)));

  const MAX_DIM = 4096;
  let scale = 1;
  if (w > MAX_DIM || h > MAX_DIM) {
    scale = MAX_DIM / Math.max(w, h);
  }
  const dstW = Math.round(w * scale);
  const dstH = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(sourceImage, x, y, w, h, 0, 0, dstW, dstH);

  const mime = options?.mimeType || "image/jpeg";
  const quality = options?.quality ?? 0.94;
  const dataUrl = canvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: dstW,
    height: dstH,
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
  let srcW = sourceImage.naturalWidth || sourceImage.width;
  let srcH = sourceImage.naturalHeight || sourceImage.height;

  const MAX_DIM = 4096;
  let scale = 1;
  if (srcW > MAX_DIM || srcH > MAX_DIM) {
    scale = MAX_DIM / Math.max(srcW, srcH);
    srcW = Math.round(srcW * scale);
    srcH = Math.round(srcH * scale);
  }

  const canvas = document.createElement("canvas");
  const isSwap = angleDeg === 90 || angleDeg === 270;
  canvas.width = isSwap ? srcH : srcW;
  canvas.height = isSwap ? srcW : srcH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.drawImage(sourceImage, -srcW / 2, -srcH / 2, srcW, srcH);

  const mime = options?.mimeType || "image/jpeg";
  const quality = options?.quality ?? 0.94;
  const dataUrl = canvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Отражает изображение по горизонтали (Flip H) и/или по вертикали (Flip V).
 */
export async function flipImage(
  sourceImage: HTMLImageElement,
  horizontal: boolean,
  vertical: boolean,
  options?: {
    quality?: number;
    mimeType?: string;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  let srcW = sourceImage.naturalWidth || sourceImage.width;
  let srcH = sourceImage.naturalHeight || sourceImage.height;

  const MAX_DIM = 4096;
  let scale = 1;
  if (srcW > MAX_DIM || srcH > MAX_DIM) {
    scale = MAX_DIM / Math.max(srcW, srcH);
    srcW = Math.round(srcW * scale);
    srcH = Math.round(srcH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.save();
  ctx.translate(horizontal ? srcW : 0, vertical ? srcH : 0);
  ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
  ctx.drawImage(sourceImage, 0, 0, srcW, srcH);
  ctx.restore();

  const mime = options?.mimeType || "image/jpeg";
  const quality = options?.quality ?? 0.94;
  const dataUrl = canvas.toDataURL(mime, quality);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

export interface EllipseParams {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Многоугольная обрезка (Polygon Crop) по произвольному набору вершин.
 * Обрезает изображение до Bounding Box многоугольника, а все внешние пиксели делает прозрачными (PNG).
 */
export async function cropPolygon(
  sourceImage: HTMLImageElement,
  points: Point2D[],
  options?: {
    maxDimension?: number;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (points.length < 3) {
    throw new Error("Polygon must contain at least 3 points");
  }

  const srcW = sourceImage.naturalWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.height;

  // 1. Вычисляем Bounding Box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  // Ограничиваем пределами исходного изображения
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(srcW, Math.ceil(maxX));
  maxY = Math.min(srcH, Math.ceil(maxY));

  let boxW = Math.max(1, maxX - minX);
  let boxH = Math.max(1, maxY - minY);

  const maxDim = options?.maxDimension ?? 4096;
  let scale = 1;
  if (boxW > maxDim || boxH > maxDim) {
    scale = maxDim / Math.max(boxW, boxH);
  }

  const dstW = Math.round(boxW * scale);
  const dstH = Math.round(boxH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 2. Создаем путь клиппинга многоугольника
  ctx.beginPath();
  const startX = (points[0].x - minX) * scale;
  const startY = (points[0].y - minY) * scale;
  ctx.moveTo(startX, startY);

  for (let i = 1; i < points.length; i++) {
    const px = (points[i].x - minX) * scale;
    const py = (points[i].y - minY) * scale;
    ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.clip();

  // 3. Отрисовываем исходное изображение со смещением
  ctx.drawImage(
    sourceImage,
    -minX * scale,
    -minY * scale,
    srcW * scale,
    srcH * scale
  );

  // Возвращаем PNG для сохранения прозрачности за пределами многоугольника
  const dataUrl = canvas.toDataURL("image/png");

  return {
    dataUrl,
    width: dstW,
    height: dstH,
  };
}

/**
 * Круглая / овальная обрезка (Ellipse Crop).
 * Обрезает изображение до внешнего габарита круга, внешние пиксели — прозрачный PNG.
 */
export async function cropEllipse(
  sourceImage: HTMLImageElement,
  ellipse: EllipseParams,
  options?: {
    maxDimension?: number;
  }
): Promise<{ dataUrl: string; width: number; height: number }> {
  const srcW = sourceImage.naturalWidth || sourceImage.width;
  const srcH = sourceImage.naturalHeight || sourceImage.height;

  const rx = Math.max(1, ellipse.rx);
  const ry = Math.max(1, ellipse.ry);

  let minX = Math.max(0, Math.floor(ellipse.cx - rx));
  let minY = Math.max(0, Math.floor(ellipse.cy - ry));
  let maxX = Math.min(srcW, Math.ceil(ellipse.cx + rx));
  let maxY = Math.min(srcH, Math.ceil(ellipse.cy + ry));

  let boxW = Math.max(1, maxX - minX);
  let boxH = Math.max(1, maxY - minY);

  const maxDim = options?.maxDimension ?? 4096;
  let scale = 1;
  if (boxW > maxDim || boxH > maxDim) {
    scale = maxDim / Math.max(boxW, boxH);
  }

  const dstW = Math.round(boxW * scale);
  const dstH = Math.round(boxH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Центр относительно canvas
  const cCanvasX = (ellipse.cx - minX) * scale;
  const cCanvasY = (ellipse.cy - minY) * scale;
  const rCanvasX = rx * scale;
  const rCanvasY = ry * scale;

  ctx.beginPath();
  ctx.ellipse(cCanvasX, cCanvasY, rCanvasX, rCanvasY, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    sourceImage,
    -minX * scale,
    -minY * scale,
    srcW * scale,
    srcH * scale
  );

  const dataUrl = canvas.toDataURL("image/png");

  return {
    dataUrl,
    width: dstW,
    height: dstH,
  };
}
