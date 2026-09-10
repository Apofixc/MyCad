// src/utils/footprintGenerator.ts
// Векторные утилиты, генераторы массивов площадок и пресеты по стандарту IPC-7351 / JEDEC

import {
  PackagePad,
  PadShape,
  MountType,
  GraphicItem,
  PackageDefinition,
  PackageVariant,
} from "../types/componentLibrary";

// ---------------------------------------------------------------------------
// ГЕОМЕТРИЯ D-ОБРАЗНОГО КОРПУСА И ДУГ
// ---------------------------------------------------------------------------

export type DShapeCutOrientation = "top" | "right" | "bottom" | "left";

/**
 * Точный расчет замкнутого SVG-контура усеченной окружности (D-образная форма TO-92)
 * Представляет собой дугу окружности (> 240 градусов) с плоской секущей хордой.
 */
export function getDShapePath(
  cx: number,
  cy: number,
  radius: number,
  orientation: DShapeCutOrientation = "right",
  cutRatio: number = 0.58
): string {
  const d = radius * cutRatio;
  const h = Math.sqrt(Math.max(0.1, radius * radius - d * d));
  const R = radius;

  switch (orientation) {
    case "right": {
      const xCut = cx + d;
      const y1 = cy - h;
      const y2 = cy + h;
      return `M ${xCut} ${y1} L ${xCut} ${y2} A ${R} ${R} 0 1 1 ${xCut} ${y1} Z`;
    }
    case "top": {
      const yCut = cy - d;
      const x1 = cx - h;
      const x2 = cx + h;
      return `M ${x1} ${yCut} L ${x2} ${yCut} A ${R} ${R} 0 1 1 ${x1} ${yCut} Z`;
    }
    case "bottom": {
      const yCut = cy + d;
      const x1 = cx + h;
      const x2 = cx - h;
      return `M ${x1} ${yCut} L ${x2} ${yCut} A ${R} ${R} 0 1 1 ${x1} ${yCut} Z`;
    }
    case "left": {
      const xCut = cx - d;
      const y1 = cy + h;
      const y2 = cy - h;
      return `M ${xCut} ${y1} L ${xCut} ${y2} A ${R} ${R} 0 1 1 ${xCut} ${y1} Z`;
    }
  }
}

/**
 * Расчет SVG пути для капсулы/стадиона (кварцевые резонаторы «лодочки» HC-49S)
 */
export function getCapsulePath(
  cx: number,
  cy: number,
  width: number,
  height: number
): string {
  const r = Math.min(width, height) / 2;
  const isHorizontal = width >= height;

  if (isHorizontal) {
    const dx = width / 2 - r;
    const top = cy - r;
    const bottom = cy + r;
    return `M ${cx - dx} ${top} L ${cx + dx} ${top} A ${r} ${r} 0 0 1 ${cx + dx} ${bottom} L ${cx - dx} ${bottom} A ${r} ${r} 0 0 1 ${cx - dx} ${top} Z`;
  } else {
    const dy = height / 2 - r;
    const left = cx - r;
    const right = cx + r;
    return `M ${left} ${cy - dy} A ${r} ${r} 0 0 1 ${right} ${cy - dy} L ${right} ${cy + dy} A ${r} ${r} 0 0 1 ${left} ${cy + dy} Z`;
  }
}

// ---------------------------------------------------------------------------
// ГЕНЕРАТОРЫ МАССИВОВ КОНТАКТНЫХ ПЛОЩАДОК (ARRAY GENERATORS)
// ---------------------------------------------------------------------------

export interface PadTemplate {
  width: number;
  height: number;
  shape: PadShape;
  drillDiameter?: number;
  plated?: boolean;
  roundRadius?: number;
}

/**
 * 1. Линейный массив (Linear Array)
 */
export function generateLinearPadArray(
  count: number,
  pitch: number,
  direction: "horizontal" | "vertical",
  startPadNum: number = 1,
  padTpl: PadTemplate = { width: 1.5, height: 1.5, shape: "circle", drillDiameter: 0.8 }
): PackagePad[] {
  const pads: PackagePad[] = [];
  const totalSpan = (count - 1) * pitch;
  const startOffset = -totalSpan / 2;

  for (let i = 0; i < count; i++) {
    const offset = startOffset + i * pitch;
    const x = direction === "horizontal" ? offset : 0;
    const y = direction === "vertical" ? offset : 0;
    const num = String(startPadNum + i);

    pads.push({
      padNum: num,
      name: num,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      width: padTpl.width,
      height: padTpl.height,
      rotation: 0,
      shape: padTpl.shape,
      drillDiameter: padTpl.drillDiameter,
      plated: padTpl.plated ?? (padTpl.drillDiameter ? true : undefined),
      roundRadius: padTpl.roundRadius,
    });
  }

  return pads;
}

/**
 * 2. Двухрядный массив (DIP / SOIC Dual Array по стандарту JEDEC U-Shape)
 */
export function generateDualPadArray(
  totalPins: number,
  pitch: number,
  rowDistance: number,
  padTpl: PadTemplate = { width: 1.6, height: 1.6, shape: "circle", drillDiameter: 0.8 }
): PackagePad[] {
  const pinsPerSide = Math.floor(totalPins / 2);
  const pads: PackagePad[] = [];
  const totalY = (pinsPerSide - 1) * pitch;
  const startY = -totalY / 2;
  const halfDist = rowDistance / 2;

  // Левый ряд: сверху вниз (1 .. pinsPerSide)
  for (let i = 0; i < pinsPerSide; i++) {
    const num = String(i + 1);
    pads.push({
      padNum: num,
      name: num,
      x: -halfDist,
      y: Math.round((startY + i * pitch) * 1000) / 1000,
      width: padTpl.width,
      height: padTpl.height,
      rotation: 0,
      shape: i === 0 && padTpl.shape === "circle" ? "rect" : padTpl.shape, // Pin 1 прямоугольный маркер
      drillDiameter: padTpl.drillDiameter,
      plated: padTpl.plated ?? true,
      roundRadius: padTpl.roundRadius,
    });
  }

  // Правый ряд: снизу вверх (pinsPerSide + 1 .. totalPins)
  for (let i = 0; i < pinsPerSide; i++) {
    const num = String(pinsPerSide + 1 + i);
    pads.push({
      padNum: num,
      name: num,
      x: halfDist,
      y: Math.round((startY + (pinsPerSide - 1 - i) * pitch) * 1000) / 1000,
      width: padTpl.width,
      height: padTpl.height,
      rotation: 0,
      shape: padTpl.shape,
      drillDiameter: padTpl.drillDiameter,
      plated: padTpl.plated ?? true,
      roundRadius: padTpl.roundRadius,
    });
  }

  return pads;
}

/**
 * 3. Четырехсторонний массив (Quad / QFP / QFN Array)
 */
export function generateQuadPadArray(
  pinsPerSide: number,
  pitch: number,
  distance: number,
  padTpl: PadTemplate = { width: 0.3, height: 1.5, shape: "rounded_rect", roundRadius: 0.05 },
  withThermalPad: boolean = false,
  thermalPadSize: number = 4.0
): PackagePad[] {
  const pads: PackagePad[] = [];
  const halfDist = distance / 2;
  const totalSpan = (pinsPerSide - 1) * pitch;
  const startSpan = -totalSpan / 2;

  let currentNum = 1;

  // Сторона 1: Левая (Left) - сверху вниз
  for (let i = 0; i < pinsPerSide; i++) {
    pads.push({
      padNum: String(currentNum++),
      x: -halfDist,
      y: Math.round((startSpan + i * pitch) * 1000) / 1000,
      width: padTpl.height, // для боковых повернуто
      height: padTpl.width,
      rotation: 0,
      shape: padTpl.shape,
      roundRadius: padTpl.roundRadius,
    });
  }

  // Сторона 2: Нижняя (Bottom) - слева направо
  for (let i = 0; i < pinsPerSide; i++) {
    pads.push({
      padNum: String(currentNum++),
      x: Math.round((startSpan + i * pitch) * 1000) / 1000,
      y: halfDist,
      width: padTpl.width,
      height: padTpl.height,
      rotation: 0,
      shape: padTpl.shape,
      roundRadius: padTpl.roundRadius,
    });
  }

  // Сторона 3: Правая (Right) - снизу вверх
  for (let i = 0; i < pinsPerSide; i++) {
    pads.push({
      padNum: String(currentNum++),
      x: halfDist,
      y: Math.round((startSpan + (pinsPerSide - 1 - i) * pitch) * 1000) / 1000,
      width: padTpl.height,
      height: padTpl.width,
      rotation: 0,
      shape: padTpl.shape,
      roundRadius: padTpl.roundRadius,
    });
  }

  // Сторона 4: Верхняя (Top) - справа налево
  for (let i = 0; i < pinsPerSide; i++) {
    pads.push({
      padNum: String(currentNum++),
      x: Math.round((startSpan + (pinsPerSide - 1 - i) * pitch) * 1000) / 1000,
      y: -halfDist,
      width: padTpl.width,
      height: padTpl.height,
      rotation: 0,
      shape: padTpl.shape,
      roundRadius: padTpl.roundRadius,
    });
  }

  // Центральный Exposed Thermal Pad
  if (withThermalPad) {
    pads.push({
      padNum: "EP",
      name: "EPAD",
      x: 0,
      y: 0,
      width: thermalPadSize,
      height: thermalPadSize,
      rotation: 0,
      shape: "rect",
    });
  }

  return pads;
}

/**
 * 4. Матричный массив BGA / PGA (Matrix Array)
 */
export function generateMatrixPadArray(
  rows: number,
  cols: number,
  pitch: number,
  padDiameter: number = 0.4
): PackagePad[] {
  const letters = "ABCDEFGHJKLMNPRTUVWY"; // Исключены I, O, Q, S, Z по стандарту JEDEC
  const pads: PackagePad[] = [];
  const startX = -((cols - 1) * pitch) / 2;
  const startY = -((rows - 1) * pitch) / 2;

  for (let r = 0; r < rows; r++) {
    const rowLetter = letters[r % letters.length];
    for (let c = 0; c < cols; c++) {
      const colNum = c + 1;
      const padNum = `${rowLetter}${colNum}`;

      pads.push({
        padNum,
        name: padNum,
        x: Math.round((startX + c * pitch) * 1000) / 1000,
        y: Math.round((startY + r * pitch) * 1000) / 1000,
        width: padDiameter,
        height: padDiameter,
        rotation: 0,
        shape: "circle",
      });
    }
  }

  return pads;
}

/**
 * 5. Круговой / Радиальный массив (Polar Array)
 */
export function generatePolarPadArray(
  count: number,
  radius: number,
  startAngleDeg: number = 0,
  padTpl: PadTemplate = { width: 1.4, height: 1.4, shape: "circle", drillDiameter: 0.8 }
): PackagePad[] {
  const pads: PackagePad[] = [];
  const angleStep = (2 * Math.PI) / count;
  const startRad = (startAngleDeg * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    const angle = startRad + i * angleStep;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const num = String(i + 1);

    pads.push({
      padNum: num,
      name: num,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      width: padTpl.width,
      height: padTpl.height,
      rotation: Math.round(((angle * 180) / Math.PI) * 10) / 10,
      shape: padTpl.shape,
      drillDiameter: padTpl.drillDiameter,
      plated: padTpl.plated ?? true,
      roundRadius: padTpl.roundRadius,
    });
  }

  return pads;
}

// ---------------------------------------------------------------------------
// ВЫРАВНИВАНИЕ И ОБРАБОТКА ГРУПП ПЛОЩАДОК (ALIGNMENT & CAD TOOLS)
// ---------------------------------------------------------------------------

export function centerPads(pads: PackagePad[]): PackagePad[] {
  if (pads.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pads.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return pads.map((p) => ({
    ...p,
    x: Math.round((p.x - cx) * 1000) / 1000,
    y: Math.round((p.y - cy) * 1000) / 1000,
  }));
}

export function alignPads(
  pads: PackagePad[],
  padNums: string[],
  alignment: "left" | "right" | "top" | "bottom" | "center_x" | "center_y"
): PackagePad[] {
  const selected = pads.filter((p) => padNums.includes(p.padNum));
  if (selected.length < 2) return pads;

  let targetVal = 0;
  if (alignment === "left") targetVal = Math.min(...selected.map((p) => p.x));
  if (alignment === "right") targetVal = Math.max(...selected.map((p) => p.x));
  if (alignment === "top") targetVal = Math.min(...selected.map((p) => p.y));
  if (alignment === "bottom") targetVal = Math.max(...selected.map((p) => p.y));
  if (alignment === "center_x") targetVal = (Math.min(...selected.map((p) => p.x)) + Math.max(...selected.map((p) => p.x))) / 2;
  if (alignment === "center_y") targetVal = (Math.min(...selected.map((p) => p.y)) + Math.max(...selected.map((p) => p.y))) / 2;

  return pads.map((p) => {
    if (!padNums.includes(p.padNum)) return p;
    if (alignment === "left" || alignment === "right" || alignment === "center_x") {
      return { ...p, x: targetVal };
    } else {
      return { ...p, y: targetVal };
    }
  });
}

/**
 * Автоматическая генерация прямоугольника шелкографии вокруг контактных площадок
 */
export function generateAutoSilkscreen(
  pads: PackagePad[],
  margin: number = 0.6,
  strokeWidth: number = 0.15
): GraphicItem[] {
  if (pads.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pads.forEach((p) => {
    const halfW = p.width / 2;
    const halfH = p.height / 2;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  });

  const x1 = minX - margin;
  const y1 = minY - margin;
  const x2 = maxX + margin;
  const y2 = maxY + margin;

  const rectItem: GraphicItem = {
    kind: "rect",
    id: `auto_silk_${Date.now()}`,
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    width: x2 - x1,
    height: y2 - y1,
    roundRadius: 0.2,
    rotation: 0,
    strokeWidth,
    layer: "top_silk",
    filled: false,
  };

  // Маркер вывода 1 (точка)
  const dotItem: GraphicItem = {
    kind: "circle",
    id: `pin1_dot_${Date.now()}`,
    cx: x1 - 0.5,
    cy: y1,
    radius: 0.3,
    strokeWidth: 0.1,
    layer: "top_silk",
    filled: true,
  };

  return [rectItem, dotItem];
}
