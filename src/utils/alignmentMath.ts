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

/**
 * Преобразование точки из системы координат платы (мм) в пиксели растровой матрицы изображения слоя
 */
export function boardMmToLayerBitmapPx(
  ptMm: Point2D,
  layer: {
    offsetX?: number;
    offsetY?: number;
    pxPerMm?: number;
    scale?: number;
    rotation?: number;
    mirrored?: boolean;
    flipV?: boolean;
  },
  naturalW: number,
  naturalH: number
): Point2D {
  const pxPerMm = layer.pxPerMm || 23.62;
  const scale = layer.scale || 1.0;
  const wMm = (naturalW / pxPerMm) * scale;
  const hMm = (naturalH / pxPerMm) * scale;

  const cx = (layer.offsetX || 0) + wMm / 2;
  const cy = (layer.offsetY || 0) + hMm / 2;

  let dx = ptMm.x - cx;
  let dy = ptMm.y - cy;

  const rot = layer.rotation || 0;
  if (rot !== 0) {
    const rad = (-rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }

  if (layer.mirrored) dx = -dx;
  if (layer.flipV) dy = -dy;

  const localMmX = dx / scale + (naturalW / pxPerMm) / 2;
  const localMmY = dy / scale + (naturalH / pxPerMm) / 2;

  return {
    x: localMmX * pxPerMm,
    y: localMmY * pxPerMm,
  };
}

/**
 * Расчет выравнивания горизонта с компенсацией точки привязки и зеркалирования
 */
export function calculateHorizonLeveling(
  p1: Point2D,
  p2: Point2D,
  layer: {
    rotation?: number;
    mirrored?: boolean;
    offsetX?: number;
    offsetY?: number;
    pxPerMm?: number;
    scale?: number;
  },
  naturalW: number,
  naturalH: number
): {
  newRotation: number;
  newOffsetX: number;
  newOffsetY: number;
  deltaDeg: number;
  targetType: "horizontal" | "vertical";
  rawAngle: number;
} {
  const rawAngle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

  // Ищем ближайшую ортогональную ось: 0° (вправо), 90° (вниз), 180°/-180° (влево), -90° (вверх)
  const targets = [0, 90, 180, -180, -90];
  let minDiff = Infinity;
  let bestTarget = 0;

  for (const t of targets) {
    let diff = rawAngle - t;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) < Math.abs(minDiff)) {
      minDiff = diff;
      bestTarget = t;
    }
  }

  // Необходимый доворот: компенсация отклонения от целевой оси
  const deltaDeg = Math.round(-minDiff * 100) / 100;
  const targetType: "horizontal" | "vertical" =
    bestTarget === 0 || Math.abs(bestTarget) === 180 ? "horizontal" : "vertical";

  let newRotation = Math.round(((layer.rotation || 0) + deltaDeg) * 100) / 100;
  while (newRotation < 0) newRotation += 360;
  while (newRotation >= 360) newRotation -= 360;

  // Точная компенсация центра: сохраняем точку p1 строго неподвижной в координатах платы
  const pxPerMm = layer.pxPerMm || 23.62;
  const scale = layer.scale || 1.0;
  const wMm = (naturalW / pxPerMm) * scale;
  const hMm = (naturalH / pxPerMm) * scale;

  const oldCx = (layer.offsetX || 0) + wMm / 2;
  const oldCy = (layer.offsetY || 0) + hMm / 2;

  const dRad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(dRad);
  const sin = Math.sin(dRad);

  const vX = oldCx - p1.x;
  const vY = oldCy - p1.y;

  const newCx = p1.x + (vX * cos - vY * sin);
  const newCy = p1.y + (vX * sin + vY * cos);

  const newOffsetX = Math.round((newCx - wMm / 2) * 100) / 100;
  const newOffsetY = Math.round((newCy - hMm / 2) * 100) / 100;

  return { newRotation, newOffsetX, newOffsetY, deltaDeg, targetType, rawAngle };
}

/**
 * 2-точечное аффинное совмещение слоев (Top -> Bottom)
 */
export function calculateLayerRegistration(
  top1: Point2D,
  top2: Point2D,
  bot1: Point2D,
  bot2: Point2D,
  botLayer: {
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
    mirrored?: boolean;
    pxPerMm?: number;
  },
  botNaturalW: number,
  botNaturalH: number
): { newOffsetX: number; newOffsetY: number; newRotation: number; newScale: number } {
  const distTop = Math.hypot(top2.x - top1.x, top2.y - top1.y);
  const distBot = Math.hypot(bot2.x - bot1.x, bot2.y - bot1.y);

  if (distTop < 1e-3 || distBot < 1e-3) {
    throw new Error("Точки для совмещения находятся слишком близко друг к другу");
  }

  const scaleFactor = distTop / distBot;
  const angleTop = Math.atan2(top2.y - top1.y, top2.x - top1.x);
  const angleBot = Math.atan2(bot2.y - bot1.y, bot2.x - bot1.x);

  let deltaRad = angleTop - angleBot;
  while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
  while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
  const deltaDeg = (deltaRad * 180) / Math.PI;

  const origScale = botLayer.scale || 1.0;
  const newScale = Math.round(origScale * scaleFactor * 1000) / 1000;

  let newRotation = Math.round(((botLayer.rotation || 0) + deltaDeg) * 100) / 100;
  while (newRotation < 0) newRotation += 360;
  while (newRotation >= 360) newRotation -= 360;

  // Вычисляем смещение так, чтобы bot1 строго совмещался с top1
  const pxPerMm = botLayer.pxPerMm || 23.62;
  const oldWMm = (botNaturalW / pxPerMm) * origScale;
  const oldHMm = (botNaturalH / pxPerMm) * origScale;
  const oldCx = (botLayer.offsetX || 0) + oldWMm / 2;
  const oldCy = (botLayer.offsetY || 0) + oldHMm / 2;

  // Вектор от старого центра до bot1
  const relX = (bot1.x - oldCx) * scaleFactor;
  const relY = (bot1.y - oldCy) * scaleFactor;

  // Поворачиваем этот вектор на deltaRad
  const cos = Math.cos(deltaRad);
  const sin = Math.sin(deltaRad);
  const rotRelX = relX * cos - relY * sin;
  const rotRelY = relX * sin + relY * cos;

  // Новый центр должен быть таким, чтобы newCenter + rotRel === top1
  const newCx = top1.x - rotRelX;
  const newCy = top1.y - rotRelY;

  const newWMm = (botNaturalW / pxPerMm) * newScale;
  const newHMm = (botNaturalH / pxPerMm) * newScale;

  const newOffsetX = Math.round((newCx - newWMm / 2) * 100) / 100;
  const newOffsetY = Math.round((newCy - newHMm / 2) * 100) / 100;

  return { newOffsetX, newOffsetY, newRotation, newScale };
}
