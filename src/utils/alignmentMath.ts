/**
 * alignmentMath.ts
 * Чистые геометрические и математические утилиты для CAD-выравнивания,
 * калибровки и метрических расчетов в MyCad.
 * В базовой системе координат MyCad: 1 мм = 10 px при масштабе 100% (zoom = 1).
 */

export interface Point2D {
  x: number;
  y: number;
}

export const CAD_PX_PER_MM = 10;
export const MM_TO_MILS = 39.3700787;

/**
 * Евклидово расстояние между двумя точками в плоскости
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

/**
 * Угол наклона отрезка p1 -> p2 в градусах (-180..180)
 */
export function angleDegrees(p1: Point2D, p2: Point2D): number {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
}

/**
 * Расчет угла доворота для выравнивания линии в строгий горизонт (0°) или вертикаль (90°).
 */
export function calculateLevelingAngle(
  p1: Point2D,
  p2: Point2D,
  targetMode: "auto" | "horizontal" | "vertical" = "auto"
): { deltaAngle: number; targetAngle: number; targetType: "horizontal" | "vertical" } {
  const rawAngle = angleDegrees(p1, p2);

  // Нормализация угла в диапазон [-90, 90]
  let normalized = rawAngle;
  while (normalized > 90) normalized -= 180;
  while (normalized < -90) normalized += 180;

  let targetType: "horizontal" | "vertical" = "horizontal";
  if (targetMode === "auto") {
    targetType = Math.abs(normalized) <= 45 ? "horizontal" : "vertical";
  } else {
    targetType = targetMode;
  }

  let deltaAngle = 0;
  let targetAngle = 0;

  if (targetType === "horizontal") {
    deltaAngle = -normalized;
    targetAngle = 0;
  } else {
    const diffToPlus90 = 90 - normalized;
    const diffToMinus90 = -90 - normalized;
    deltaAngle = Math.abs(diffToPlus90) < Math.abs(diffToMinus90) ? diffToPlus90 : diffToMinus90;
    targetAngle = 90;
  }

  deltaAngle = Math.round(deltaAngle * 100) / 100;
  return { deltaAngle, targetAngle, targetType };
}

/**
 * Расчет нового масштаба по 2 точкам калибровки
 */
export function calculateCalibratedScale(
  measuredDistancePx: number,
  realDistanceMm: number,
  currentScale: number,
  pxPerMm = CAD_PX_PER_MM
): number {
  if (measuredDistancePx <= 0 || realDistanceMm <= 0) return currentScale;
  const targetPx = realDistanceMm * pxPerMm;
  const ratio = targetPx / measuredDistancePx;
  return Math.round(currentScale * ratio * 1000) / 1000;
}

/**
 * Конвертация экранных пикселей в миллиметры
 */
export function pxToMm(px: number, pxPerMm = CAD_PX_PER_MM): number {
  return Math.round((px / pxPerMm) * 100) / 100;
}

/**
 * Конвертация миллиметров в милы (тысячные дюйма)
 */
export function mmToMil(mm: number): number {
  return Math.round(mm * MM_TO_MILS * 10) / 10;
}

/**
 * Форматирование метрического размера для подсказок: "2.54 мм (100.0 mil)"
 */
export function formatMetric(px: number, pxPerMm = CAD_PX_PER_MM): string {
  const mm = pxToMm(px, pxPerMm);
  const mil = mmToMil(mm);
  return `${mm.toFixed(2)} мм (${mil.toFixed(1)} mil)`;
}
