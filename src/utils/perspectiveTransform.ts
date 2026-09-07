/**
 * Геометрические типы и UI-утилиты для трансформации изображений.
 * Тяжелая обработка пикселей (гомография, обрезка, поворот, масштабирование)
 * делегирована высокопроизводительному Rust-бэкенду (см. src/services/backendImageProcessor.ts).
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

export interface EllipseParams {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Вычисляет евклидово расстояние между двумя точками.
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
  maxDimension?: number
): { width: number; height: number } {
  const widthTop = distance(quad.topLeft, quad.topRight);
  const widthBottom = distance(quad.bottomLeft, quad.bottomRight);
  const heightLeft = distance(quad.topLeft, quad.bottomLeft);
  const heightRight = distance(quad.topRight, quad.bottomRight);

  let targetW = Math.max(10, Math.round(Math.max(widthTop, widthBottom)));
  let targetH = Math.max(10, Math.round(Math.max(heightLeft, heightRight)));

  if (maxDimension && maxDimension > 0 && (targetW > maxDimension || targetH > maxDimension)) {
    const scale = maxDimension / Math.max(targetW, targetH);
    targetW = Math.max(10, Math.round(targetW * scale));
    targetH = Math.max(10, Math.round(targetH * scale));
  }

  return { width: targetW, height: targetH };
}

/**
 * Загружает HTMLImageElement по URL / data URL.
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Не удалось загрузить изображение: ${src}, ${e}`));
    img.src = src;
  });
}
