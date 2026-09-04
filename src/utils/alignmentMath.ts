/**
 * alignmentMath.ts
 * Чистые математические утилиты для работы с геометрией, калибровкой,
 * выравниванием горизонта и аффинным совмещением слоев платы в MyCad.
 * В метрической системе MyCad: 1 мм = 10 px (0.1 мм = 1 px).
 */

export interface Point2D {
  x: number;
  y: number;
}

export const CAD_PX_PER_MM = 10;
export const MM_TO_MILS = 39.3700787;

/**
 * Евклидово расстояние между двумя точками
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
 * Расчет доворота для выравнивания линии в строгий горизонт или вертикаль.
 * Возвращает необходимую дельту угла (в градусах), чтобы повернуть изображение.
 */
export function calculateLevelingAngle(
  p1: Point2D,
  p2: Point2D,
  targetMode: "auto" | "horizontal" | "vertical" = "auto"
): { deltaAngle: number; targetAngle: number; targetType: "horizontal" | "vertical" } {
  let rawAngle = angleDegrees(p1, p2);

  // Нормализуем в диапазон -90..90 для удобства анализа направления
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
    // Цель: угол 0° (линия идет горизонтально).
    // Если линия наклонена на +2°, нужно повернуть на -2°
    deltaAngle = -normalized;
    targetAngle = 0;
  } else {
    // Цель: угол 90° (или -90°)
    const diffToPlus90 = 90 - normalized;
    const diffToMinus90 = -90 - normalized;
    deltaAngle = Math.abs(diffToPlus90) < Math.abs(diffToMinus90) ? diffToPlus90 : diffToMinus90;
    targetAngle = 90;
  }

  // Округляем до 3 знаков
  deltaAngle = Math.round(deltaAngle * 1000) / 1000;
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
 * 2-точечное выравнивание (Similarity Transformation) для совмещения Top и Bottom слоев:
 * Находит необходимый сдвиг dx, dy, масштабирование s и угол поворота dAngle.
 */
export function calculate2PointRegistration(
  source1: Point2D,
  source2: Point2D,
  target1: Point2D,
  target2: Point2D
): {
  dx: number;
  dy: number;
  rotationDelta: number;
  scaleRatio: number;
} {
  const dSource = distance(source1, source2);
  const dTarget = distance(target1, target2);

  const scaleRatio = dTarget > 0 ? dSource / dTarget : 1;

  const angleSource = angleDegrees(source1, source2);
  const angleTarget = angleDegrees(target1, target2);
  let rotationDelta = angleSource - angleTarget;

  while (rotationDelta > 180) rotationDelta -= 360;
  while (rotationDelta < -180) rotationDelta += 360;

  // Смещение центра target1 к source1
  const dx = source1.x - target1.x;
  const dy = source1.y - target1.y;

  return {
    dx: Math.round(dx * 10) / 10,
    dy: Math.round(dy * 10) / 10,
    rotationDelta: Math.round(rotationDelta * 100) / 100,
    scaleRatio: Math.round(scaleRatio * 1000) / 1000,
  };
}

/**
 * Конвертация экранных пикселей в физические миллиметры
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
 * Форматирование метрического размера
 */
export function formatMetric(px: number, pxPerMm = CAD_PX_PER_MM): string {
  const mm = pxToMm(px, pxPerMm);
  const mil = mmToMil(mm);
  return `${mm.toFixed(2)} мм (${mil.toFixed(1)} mil)`;
}
