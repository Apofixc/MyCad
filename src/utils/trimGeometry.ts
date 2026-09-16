// src/utils/trimGeometry.ts
// Модуль 2D-геометрии для инструмента обрезки контуров (Trim / Ножницы)

import { GraphicItem } from "../types/componentLibrary";

export interface Point2D {
  x: number;
  y: number;
}

export interface TrimSegmentPreview {
  /** Исходный ID элемента, сегмент которого отсекается */
  targetItemId: string;
  /** SVG-путь для красной пунктирной подсветки удаляемого сегмента */
  highlightPath: string;
  /** Точки пересечения (границы сегмента) для отрисовки маркеров ножниц/крестиков */
  boundaryPoints: Point2D[];
  /** Новый список графических элементов после применения операции обрезки */
  newGraphics: GraphicItem[];
}

/** Нормализация угла в градусах к диапазону [0, 360) */
export function normalizeAngleDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Проверка, находится ли угол testDeg внутри дуги от startDeg до endDeg с учетом clockwise */
export function isAngleInArc(
  testDeg: number,
  startDeg: number,
  endDeg: number,
  clockwise = true
): boolean {
  const normTest = normalizeAngleDeg(testDeg);
  const normStart = normalizeAngleDeg(startDeg);
  const normEnd = normalizeAngleDeg(endDeg);

  if (clockwise) {
    const sweep = ((normEnd - normStart) % 360 + 360) % 360;
    const diff = ((normTest - normStart) % 360 + 360) % 360;
    return diff <= sweep + 0.05;
  } else {
    const sweep = ((normStart - normEnd) % 360 + 360) % 360;
    const diff = ((normStart - normTest) % 360 + 360) % 360;
    return diff <= sweep + 0.05;
  }
}

/** Расстояние между двумя точками */
export function dist(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/** Пересечение двух отрезков Line1: (p1->p2) и Line2: (p3->p4) */
export function intersectLineSegments(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): { point: Point2D; t1: number; t2: number } | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-9) return null; // параллельны

  const t1 = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
  const t2 = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;

  if (t1 >= -1e-5 && t1 <= 1 + 1e-5 && t2 >= -1e-5 && t2 <= 1 + 1e-5) {
    return {
      point: {
        x: Math.round((p1.x + t1 * dx1) * 10000) / 10000,
        y: Math.round((p1.y + t1 * dy1) * 10000) / 10000,
      },
      t1: Math.max(0, Math.min(1, t1)),
      t2: Math.max(0, Math.min(1, t2)),
    };
  }
  return null;
}

/** Пересечение отрезка (p1->p2) с окружностью (cx, cy, radius) */
export function intersectLineCircle(
  p1: Point2D,
  p2: Point2D,
  cx: number,
  cy: number,
  r: number
): { point: Point2D; t: number; angleDeg: number }[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - cx;
  const fy = p1.y - cy;

  const a = dx * dx + dy * dy;
  if (a < 1e-9) return [];

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-7) return [];

  const roots: number[] = [];
  if (Math.abs(discriminant) <= 1e-7) {
    roots.push(-b / (2 * a));
  } else {
    const sqrtD = Math.sqrt(Math.max(0, discriminant));
    roots.push((-b - sqrtD) / (2 * a));
    roots.push((-b + sqrtD) / (2 * a));
  }

  const results: { point: Point2D; t: number; angleDeg: number }[] = [];
  for (const t of roots) {
    if (t >= -1e-5 && t <= 1 + 1e-5) {
      const clampedT = Math.max(0, Math.min(1, t));
      const pt: Point2D = {
        x: Math.round((p1.x + clampedT * dx) * 10000) / 10000,
        y: Math.round((p1.y + clampedT * dy) * 10000) / 10000,
      };
      const angle = normalizeAngleDeg((Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI);
      results.push({ point: pt, t: clampedT, angleDeg: angle });
    }
  }
  return results;
}

/** Пересечение двух окружностей */
export function intersectCircleCircle(
  c1: Point2D,
  r1: number,
  c2: Point2D,
  r2: number
): { point: Point2D; angle1: number; angle2: number }[] {
  const d = dist(c1, c2);
  if (d > r1 + r2 + 1e-5 || d < Math.abs(r1 - r2) - 1e-5 || d < 1e-9) return [];

  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = Math.sqrt(Math.max(0, hSq));

  const p0x = c1.x + (a * (c2.x - c1.x)) / d;
  const p0y = c1.y + (a * (c2.y - c1.y)) / d;

  const rx = -(c2.y - c1.y) * (h / d);
  const ry = (c2.x - c1.x) * (h / d);

  const pts: Point2D[] = [
    { x: Math.round((p0x + rx) * 10000) / 10000, y: Math.round((p0y + ry) * 10000) / 10000 },
  ];
  if (h > 1e-5) {
    pts.push({
      x: Math.round((p0x - rx) * 10000) / 10000,
      y: Math.round((p0y - ry) * 10000) / 10000,
    });
  }

  return pts.map((pt) => ({
    point: pt,
    angle1: normalizeAngleDeg((Math.atan2(pt.y - c1.y, pt.x - c1.x) * 180) / Math.PI),
    angle2: normalizeAngleDeg((Math.atan2(pt.y - c2.y, pt.x - c2.x) * 180) / Math.PI),
  }));
}

/** Извлечение линейных отрезков из прямоугольников, полигонов и линий для универсального пересечения */
export function getItemSubSegments(item: GraphicItem): { p1: Point2D; p2: Point2D }[] {
  if (item.kind === "line") {
    return [{ p1: { x: item.x1, y: item.y1 }, p2: { x: item.x2, y: item.y2 } }];
  }
  if (item.kind === "polygon" && item.points && item.points.length >= 2) {
    const res: { p1: Point2D; p2: Point2D }[] = [];
    for (let i = 0; i < item.points.length; i++) {
      const p1 = item.points[i];
      const p2 = item.points[(i + 1) % item.points.length];
      res.push({ p1: { x: p1[0], y: p1[1] }, p2: { x: p2[0], y: p2[1] } });
    }
    return res;
  }
  if (item.kind === "rect") {
    const halfW = item.width / 2;
    const halfH = item.height / 2;
    const rotRad = ((item.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const rotate = (dx: number, dy: number): Point2D => ({
      x: item.x + dx * cosR - dy * sinR,
      y: item.y + dx * sinR + dy * cosR,
    });
    const c1 = rotate(-halfW, -halfH);
    const c2 = rotate(halfW, -halfH);
    const c3 = rotate(halfW, halfH);
    const c4 = rotate(-halfW, halfH);
    return [
      { p1: c1, p2: c2 },
      { p1: c2, p2: c3 },
      { p1: c3, p2: c4 },
      { p1: c4, p2: c1 },
    ];
  }
  return [];
}

/**
 * Разбить составную фигуру (прямоугольник, полигон, D-контур, капсулу) на атомарные отрезки и дуги.
 */
export function explodeGraphicItem(item: GraphicItem): GraphicItem[] {
  if (item.kind === "rect") {
    const halfW = item.width / 2;
    const halfH = item.height / 2;
    const r = Math.max(0, Math.min(item.roundRadius || 0, halfW, halfH));
    const rotRad = ((item.rotation || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const rotate = (p: Point2D): Point2D => ({
      x: Math.round((item.x + p.x * cosR - p.y * sinR) * 10000) / 10000,
      y: Math.round((item.y + p.x * sinR + p.y * cosR) * 10000) / 10000,
    });

    if (r <= 0.001) {
      const p1 = rotate({ x: -halfW, y: -halfH });
      const p2 = rotate({ x: halfW, y: -halfH });
      const p3 = rotate({ x: halfW, y: halfH });
      const p4 = rotate({ x: -halfW, y: halfH });
      return [
        { kind: "line", id: `line_${crypto.randomUUID()}`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, strokeWidth: item.strokeWidth, layer: item.layer },
        { kind: "line", id: `line_${crypto.randomUUID()}`, x1: p2.x, y1: p2.y, x2: p3.x, y2: p3.y, strokeWidth: item.strokeWidth, layer: item.layer },
        { kind: "line", id: `line_${crypto.randomUUID()}`, x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y, strokeWidth: item.strokeWidth, layer: item.layer },
        { kind: "line", id: `line_${crypto.randomUUID()}`, x1: p4.x, y1: p4.y, x2: p1.x, y2: p1.y, strokeWidth: item.strokeWidth, layer: item.layer },
      ];
    } else {
      const res: GraphicItem[] = [];
      const addLine = (pA: Point2D, pB: Point2D) => {
        const p1 = rotate(pA), p2 = rotate(pB);
        res.push({ kind: "line", id: `line_${crypto.randomUUID()}`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, strokeWidth: item.strokeWidth, layer: item.layer });
      };
      const addArc = (centerLocal: Point2D, startAngleDeg: number, endAngleDeg: number) => {
        const c = rotate(centerLocal);
        const rotDeg = item.rotation || 0;
        res.push({
          kind: "arc",
          id: `arc_${crypto.randomUUID()}`,
          cx: c.x,
          cy: c.y,
          radius: r,
          startAngle: normalizeAngleDeg(startAngleDeg + rotDeg),
          endAngle: normalizeAngleDeg(endAngleDeg + rotDeg),
          clockwise: true,
          strokeWidth: item.strokeWidth,
          layer: item.layer,
        });
      };

      if (halfW - r > 0.001) addLine({ x: -halfW + r, y: -halfH }, { x: halfW - r, y: -halfH });
      addArc({ x: halfW - r, y: -halfH + r }, 270, 360);
      if (halfH - r > 0.001) addLine({ x: halfW, y: -halfH + r }, { x: halfW, y: halfH - r });
      addArc({ x: halfW - r, y: halfH - r }, 0, 90);
      if (halfW - r > 0.001) addLine({ x: halfW - r, y: halfH }, { x: -halfW + r, y: halfH });
      addArc({ x: -halfW + r, y: halfH - r }, 90, 180);
      if (halfH - r > 0.001) addLine({ x: -halfW, y: halfH - r }, { x: -halfW, y: -halfH + r });
      addArc({ x: -halfW + r, y: -halfH + r }, 180, 270);

      return res;
    }
  }

  if (item.kind === "polygon") {
    const pts = item.points;
    if (!pts || pts.length < 2) return [];
    const res: GraphicItem[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      res.push({
        kind: "line",
        id: `line_${crypto.randomUUID()}`,
        x1: p1[0],
        y1: p1[1],
        x2: p2[0],
        y2: p2[1],
        strokeWidth: item.strokeWidth,
        layer: item.layer,
      });
    }
    return res;
  }

  return [item];
}

/**
 * Сэмплирование дуги на цепочку точек
 */
function sampleArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean,
  reverse: boolean
): Point2D[] {
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const a1 = norm(startAngle);
  const a2 = norm(endAngle);
  let sweep = clockwise ? ((a2 - a1) % 360 + 360) % 360 : ((a1 - a2) % 360 + 360) % 360;
  if (sweep < 0.1) sweep = 360;

  const steps = Math.max(8, Math.min(64, Math.ceil(sweep / 5)));
  const pts: Point2D[] = [];

  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const angDeg = clockwise ? a1 + sweep * frac : a1 - sweep * frac;
    const rad = (angDeg * Math.PI) / 180;
    pts.push({
      x: Math.round((cx + r * Math.cos(rad)) * 10000) / 10000,
      y: Math.round((cy + r * Math.sin(rad)) * 10000) / 10000,
    });
  }

  if (reverse) pts.reverse();
  return pts;
}

interface SegmentEnd {
  item: GraphicItem;
  pA: Point2D;
  pB: Point2D;
}

function getItemEndpoints(item: GraphicItem): SegmentEnd | null {
  if (item.kind === "line") {
    return {
      item,
      pA: { x: item.x1, y: item.y1 },
      pB: { x: item.x2, y: item.y2 },
    };
  }
  if (item.kind === "arc") {
    const r = item.radius;
    const sRad = (item.startAngle * Math.PI) / 180;
    const eRad = (item.endAngle * Math.PI) / 180;
    return {
      item,
      pA: {
        x: Math.round((item.cx + r * Math.cos(sRad)) * 10000) / 10000,
        y: Math.round((item.cy + r * Math.sin(sRad)) * 10000) / 10000,
      },
      pB: {
        x: Math.round((item.cx + r * Math.cos(eRad)) * 10000) / 10000,
        y: Math.round((item.cy + r * Math.sin(eRad)) * 10000) / 10000,
      },
    };
  }
  return null;
}

/**
 * Объединение смежных коллинеарных отрезков на одном слое
 */
export function autoMergeCollinearLines(items: GraphicItem[]): GraphicItem[] {
  let result = [...items];
  let changed = true;

  while (changed) {
    changed = false;
    const lines = result.filter((g): g is Extract<GraphicItem, { kind: "line" }> => g.kind === "line");
    if (lines.length < 2) break;

    const tol = 0.08;

    for (let i = 0; i < lines.length; i++) {
      const l1 = lines[i];
      const dx1 = l1.x2 - l1.x1;
      const dy1 = l1.y2 - l1.y1;
      const len1 = Math.hypot(dx1, dy1);
      if (len1 < 1e-4) continue;
      const u1x = dx1 / len1, u1y = dy1 / len1;

      for (let j = i + 1; j < lines.length; j++) {
        const l2 = lines[j];
        if (l1.layer !== l2.layer || l1.strokeWidth !== l2.strokeWidth) continue;

        const dx2 = l2.x2 - l2.x1;
        const dy2 = l2.y2 - l2.y1;
        const len2 = Math.hypot(dx2, dy2);
        if (len2 < 1e-4) continue;
        const u2x = dx2 / len2, u2y = dy2 / len2;

        const dot = u1x * u2x + u1y * u2y;
        const isParallel = Math.abs(dot) > 0.9995;
        if (!isParallel) continue;

        const p1A = { x: l1.x1, y: l1.y1 }, p1B = { x: l1.x2, y: l1.y2 };
        const p2A = { x: l2.x1, y: l2.y1 }, p2B = { x: l2.x2, y: l2.y2 };

        let mergedStart: Point2D | null = null;
        let mergedEnd: Point2D | null = null;

        if (dist(p1B, p2A) < tol && dot > 0.99) {
          mergedStart = p1A; mergedEnd = p2B;
        } else if (dist(p1A, p2B) < tol && dot > 0.99) {
          mergedStart = p2A; mergedEnd = p1B;
        } else if (dist(p1B, p2B) < tol && dot < -0.99) {
          mergedStart = p1A; mergedEnd = p2A;
        } else if (dist(p1A, p2A) < tol && dot < -0.99) {
          mergedStart = p1B; mergedEnd = p2B;
        }

        if (mergedStart && mergedEnd) {
          const mergedLine: GraphicItem = {
            kind: "line",
            id: l1.id,
            x1: Math.round(mergedStart.x * 10000) / 10000,
            y1: Math.round(mergedStart.y * 10000) / 10000,
            x2: Math.round(mergedEnd.x * 10000) / 10000,
            y2: Math.round(mergedEnd.y * 10000) / 10000,
            strokeWidth: l1.strokeWidth,
            layer: l1.layer,
          };

          result = result.filter((g) => g.id !== l1.id && g.id !== l2.id);
          result.push(mergedLine);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return result;
}

/**
 * Объединение замкнутых цепочек отрезков и дуг в единый произвольный замкнутый контур (polygon)
 */
export function autoMergeClosedLoops(items: GraphicItem[]): { newItems: GraphicItem[]; createdPolygonIds: string[] } {
  let result = [...items];
  const createdPolygonIds: string[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    const segments: SegmentEnd[] = [];
    for (const it of result) {
      const end = getItemEndpoints(it);
      if (end) segments.push(end);
    }

    if (segments.length < 2) break;

    const layers = Array.from(new Set(segments.map((s) => s.item.layer)));
    for (const layer of layers) {
      const layerSegs = segments.filter((s) => s.item.layer === layer);
      if (layerSegs.length < 2) continue;

      const tol = 0.15; // 150 микрон

      for (let startIdx = 0; startIdx < layerSegs.length; startIdx++) {
        const startSeg = layerSegs[startIdx];
        const visitedIds = new Set<string>([startSeg.item.id]);

        type Step = { seg: SegmentEnd; fromAtoB: boolean };
        const path: Step[] = [{ seg: startSeg, fromAtoB: true }];
        let curPoint = startSeg.pB;
        let closed = false;

        while (true) {
          const next = layerSegs.find((candidate) => {
            if (visitedIds.has(candidate.item.id)) return false;
            return dist(curPoint, candidate.pA) < tol || dist(curPoint, candidate.pB) < tol;
          });

          if (!next) {
            if (path.length >= 2 && dist(curPoint, startSeg.pA) < tol) {
              closed = true;
            }
            break;
          }

          visitedIds.add(next.item.id);
          const matchesA = dist(curPoint, next.pA) < tol;
          const fromAtoB = matchesA;
          curPoint = fromAtoB ? next.pB : next.pA;
          path.push({ seg: next, fromAtoB });

          if (path.length >= 2 && dist(curPoint, startSeg.pA) < tol) {
            closed = true;
            break;
          }
        }

        if (closed && path.length >= 2) {
          const polyPoints: Point2D[] = [];

          for (const step of path) {
            const it = step.seg.item;
            if (it.kind === "line") {
              const startPt = step.fromAtoB ? step.seg.pA : step.seg.pB;
              polyPoints.push(startPt);
            } else if (it.kind === "arc") {
              const cw = it.clockwise !== false;
              const arcPts = sampleArc(it.cx, it.cy, it.radius, it.startAngle, it.endAngle, cw, !step.fromAtoB);
              for (let a = 0; a < arcPts.length - 1; a++) {
                polyPoints.push(arcPts[a]);
              }
            }
          }

          let area2 = 0;
          for (let p = 0; p < polyPoints.length; p++) {
            const p1 = polyPoints[p];
            const p2 = polyPoints[(p + 1) % polyPoints.length];
            area2 += p1.x * p2.y - p2.x * p1.y;
          }

          if (Math.abs(area2) > 0.01) {
            const loopIds = new Set(path.map((s) => s.seg.item.id));
            const newId = `poly_${crypto.randomUUID()}`;
            const newPoly: GraphicItem = {
              kind: "polygon",
              id: newId,
              points: polyPoints.map((pt) => [Math.round(pt.x * 10000) / 10000, Math.round(pt.y * 10000) / 10000]),
              strokeWidth: path[0].seg.item.strokeWidth,
              layer: layer,
              filled: false,
            };

            result = result.filter((g) => !loopIds.has(g.id));
            result.push(newPoly);
            createdPolygonIds.push(newId);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }
  }

  return { newItems: result, createdPolygonIds };
}

/**
 * Ручное и автоматическое объединение контуров с возвратом ID созданного полигона
 */
export function joinGraphics(items: GraphicItem[]): { newGraphics: GraphicItem[]; createdPolygonId: string | null } {
  let result = autoMergeCollinearLines(items);
  const loopRes = autoMergeClosedLoops(result);
  return {
    newGraphics: loopRes.newItems,
    createdPolygonId: loopRes.createdPolygonIds[0] || null,
  };
}

/**
 * Универсальное автоматическое слияние геометрии (обратная совместимость)
 */
export function autoMergeGraphics(items: GraphicItem[]): GraphicItem[] {
  return joinGraphics(items).newGraphics;
}

/**
 * Ручное объединение выбранных графических элементов (Join, J)
 */
export function mergeSelectedGraphics(selectedIds: string[], items: GraphicItem[]): GraphicItem[] {
  if (selectedIds.length < 2) return items;
  const selectedSet = new Set(selectedIds);
  const selectedItems = items.filter((g) => selectedSet.has(g.id));
  const otherItems = items.filter((g) => !selectedSet.has(g.id));

  const merged = autoMergeGraphics(selectedItems);
  if (merged.length < selectedItems.length) {
    return [...otherItems, ...merged];
  }
  return items;
}

/**
 * Главная функция: находит ближайший отсекаемый сегмент под курсором мыши.
 * Возвращает превью для красной подсветки и итоговый массив графики newGraphics.
 */
export function findHoveredTrimSegment(
  cursor: Point2D,
  items: GraphicItem[],
  maxHitDistance = 0.5 // порог попадания курсора в мм
): TrimSegmentPreview | null {
  if (!items.length) return null;

  // Ищем элемент, наиболее близкий к курсору
  let bestDist = maxHitDistance;
  let bestItem: GraphicItem | null = null;
  let parentItem: GraphicItem | null = null;
  let siblingParts: GraphicItem[] = [];

  for (const item of items) {
    if (item.kind === "line") {
      const d = distToSegment(cursor, { x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 });
      if (d < bestDist) {
        bestDist = d;
        bestItem = item;
        parentItem = null;
        siblingParts = [];
      }
    } else if (item.kind === "circle") {
      const d = Math.abs(dist(cursor, { x: item.cx, y: item.cy }) - item.radius);
      if (d < bestDist) {
        bestDist = d;
        bestItem = item;
        parentItem = null;
        siblingParts = [];
      }
    } else if (item.kind === "arc") {
      const dCenter = dist(cursor, { x: item.cx, y: item.cy });
      const d = Math.abs(dCenter - item.radius);
      const angle = (Math.atan2(cursor.y - item.cy, cursor.x - item.cx) * 180) / Math.PI;
      if (d < bestDist && isAngleInArc(angle, item.startAngle, item.endAngle, item.clockwise !== false)) {
        bestDist = d;
        bestItem = item;
        parentItem = null;
        siblingParts = [];
      }
    } else if (item.kind === "rect" || item.kind === "polygon") {
      const parts = explodeGraphicItem(item);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.kind === "line") {
          const d = distToSegment(cursor, { x: part.x1, y: part.y1 }, { x: part.x2, y: part.y2 });
          if (d < bestDist) {
            bestDist = d;
            bestItem = part;
            parentItem = item;
            siblingParts = parts.filter((_, idx) => idx !== i);
          }
        } else if (part.kind === "arc") {
          const dCenter = dist(cursor, { x: part.cx, y: part.cy });
          const d = Math.abs(dCenter - part.radius);
          const angle = (Math.atan2(cursor.y - part.cy, cursor.x - part.cx) * 180) / Math.PI;
          if (d < bestDist && isAngleInArc(angle, part.startAngle, part.endAngle, part.clockwise !== false)) {
            bestDist = d;
            bestItem = part;
            parentItem = item;
            siblingParts = parts.filter((_, idx) => idx !== i);
          }
        }
      }
    }
  }

  if (!bestItem) return null;

  // Все элементы, с которыми может пересекаться целевой отрезок/дуга
  const otherCuttingItems = [
    ...items.filter((g) => g.id !== (parentItem ? parentItem.id : bestItem!.id)),
    ...siblingParts,
  ];

  // 1. ОБРЕЗКА ЛИНИИ
  if (bestItem.kind === "line") {
    const line = bestItem;
    const p1: Point2D = { x: line.x1, y: line.y1 };
    const p2: Point2D = { x: line.x2, y: line.y2 };

    // Находим все точки пересечения этой линии со всеми другими объектами
    const intersections: { t: number; point: Point2D }[] = [];

    for (const other of otherCuttingItems) {
      if (other.id === line.id) continue;
      if (other.kind === "line") {
        const hit = intersectLineSegments(p1, p2, { x: other.x1, y: other.y1 }, { x: other.x2, y: other.y2 });
        if (hit && hit.t1 > 0.001 && hit.t1 < 0.999) {
          intersections.push({ t: hit.t1, point: hit.point });
        }
      } else if (other.kind === "circle") {
        const hits = intersectLineCircle(p1, p2, other.cx, other.cy, other.radius);
        for (const h of hits) {
          if (h.t > 0.001 && h.t < 0.999) intersections.push({ t: h.t, point: h.point });
        }
      } else if (other.kind === "arc") {
        const hits = intersectLineCircle(p1, p2, other.cx, other.cy, other.radius);
        for (const h of hits) {
          if (h.t > 0.001 && h.t < 0.999 && isAngleInArc(h.angleDeg, other.startAngle, other.endAngle, other.clockwise !== false)) {
            intersections.push({ t: h.t, point: h.point });
          }
        }
      } else if (other.kind === "rect" || other.kind === "polygon") {
        for (const seg of getItemSubSegments(other)) {
          const hit = intersectLineSegments(p1, p2, seg.p1, seg.p2);
          if (hit && hit.t1 > 0.001 && hit.t1 < 0.999) {
            intersections.push({ t: hit.t1, point: hit.point });
          }
        }
      }
    }

    // Если линия ни с чем не пересекается — клик удаляет её целиком
    if (!intersections.length) {
      const remainingNoInter = parentItem
        ? [...items.filter((g) => g.id !== parentItem.id), ...siblingParts]
        : items.filter((g) => g.id !== line.id);
      return {
        targetItemId: parentItem ? parentItem.id : line.id,
        highlightPath: `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`,
        boundaryPoints: [p1, p2],
        newGraphics: autoMergeGraphics(remainingNoInter),
      };
    }

    // Сортируем параметры t по возрастанию
    intersections.sort((a, b) => a.t - b.t);

    // Устраняем близкие дубликаты точек пересечения
    const uniqueT: { t: number; point: Point2D }[] = [];
    for (const cur of intersections) {
      if (!uniqueT.length || cur.t - uniqueT[uniqueT.length - 1].t > 0.005) {
        uniqueT.push(cur);
      }
    }

    // Формируем интервалы сегментов: [0, t1], [t1, t2], ..., [tn, 1]
    const allT = [
      { t: 0, point: p1 },
      ...uniqueT,
      { t: 1, point: p2 },
    ];

    // Вычисляем проекцию курсора на отрезок (параметр t)
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    const cursorT = lenSq > 1e-9 ? Math.max(0, Math.min(1, ((cursor.x - p1.x) * dx + (cursor.y - p1.y) * dy) / lenSq)) : 0;

    // Находим, в какой именно сегмент попал курсор
    let segIdx = -1;
    for (let i = 0; i < allT.length - 1; i++) {
      if (cursorT >= allT[i].t - 0.002 && cursorT <= allT[i + 1].t + 0.002) {
        segIdx = i;
        break;
      }
    }
    if (segIdx === -1) segIdx = 0;

    const segStart = allT[segIdx];
    const segEnd = allT[segIdx + 1];

    // Формируем результирующие линии после удаления выбранного сегмента segIdx
    const remainingLineSegments: GraphicItem[] = [];
    for (let i = 0; i < allT.length - 1; i++) {
      if (i === segIdx) continue; // удаляемый сегмент пропускаем
      const s0 = allT[i];
      const s1 = allT[i + 1];
      if (dist(s0.point, s1.point) > 0.01) {
        remainingLineSegments.push({
          kind: "line",
          id: `line_${crypto.randomUUID()}`,
          x1: s0.point.x,
          y1: s0.point.y,
          x2: s1.point.x,
          y2: s1.point.y,
          strokeWidth: line.strokeWidth,
          layer: line.layer,
        });
      }
    }

    const remainingLineAll = parentItem
      ? [...items.filter((g) => g.id !== parentItem.id), ...siblingParts, ...remainingLineSegments]
      : [...items.filter((g) => g.id !== line.id), ...remainingLineSegments];

    return {
      targetItemId: parentItem ? parentItem.id : line.id,
      highlightPath: `M ${segStart.point.x} ${segStart.point.y} L ${segEnd.point.x} ${segEnd.point.y}`,
      boundaryPoints: [segStart.point, segEnd.point],
      newGraphics: autoMergeGraphics(remainingLineAll),
    };
  }

  // 2. ОБРЕЗКА ОКРУЖНОСТИ
  if (bestItem.kind === "circle") {
    const circle = bestItem;
    const center: Point2D = { x: circle.cx, y: circle.cy };
    const r = circle.radius;

    // Находим все углы пересечения со всеми другими элементами
    const intersectionAngles: { angle: number; point: Point2D }[] = [];

    for (const other of items) {
      if (other.id === circle.id) continue;
      if (other.kind === "line") {
        const hits = intersectLineCircle({ x: other.x1, y: other.y1 }, { x: other.x2, y: other.y2 }, circle.cx, circle.cy, r);
        for (const h of hits) intersectionAngles.push({ angle: h.angleDeg, point: h.point });
      } else if (other.kind === "circle") {
        const hits = intersectCircleCircle(center, r, { x: other.cx, y: other.cy }, other.radius);
        for (const h of hits) intersectionAngles.push({ angle: h.angle1, point: h.point });
      } else if (other.kind === "arc") {
        const hits = intersectCircleCircle(center, r, { x: other.cx, y: other.cy }, other.radius);
        for (const h of hits) {
          if (isAngleInArc(h.angle2, other.startAngle, other.endAngle, other.clockwise !== false)) {
            intersectionAngles.push({ angle: h.angle1, point: h.point });
          }
        }
      } else if (other.kind === "rect" || other.kind === "polygon") {
        for (const seg of getItemSubSegments(other)) {
          const hits = intersectLineCircle(seg.p1, seg.p2, circle.cx, circle.cy, r);
          for (const h of hits) intersectionAngles.push({ angle: h.angleDeg, point: h.point });
        }
      }
    }

    // Если пересечений < 2, круг нельзя разрезать на дуги
    if (intersectionAngles.length < 2) {
      return {
        targetItemId: circle.id,
        highlightPath: `M ${circle.cx - r} ${circle.cy} A ${r} ${r} 0 0 1 ${circle.cx + r} ${circle.cy} A ${r} ${r} 0 0 1 ${circle.cx - r} ${circle.cy}`,
        boundaryPoints: [],
        newGraphics: items.filter((g) => g.id !== circle.id),
      };
    }

    // Сортируем углы
    intersectionAngles.sort((a, b) => a.angle - b.angle);

    // Фильтруем дубликаты углов
    const uniqueAngles: { angle: number; point: Point2D }[] = [];
    for (const a of intersectionAngles) {
      if (!uniqueAngles.length || a.angle - uniqueAngles[uniqueAngles.length - 1].angle > 0.5) {
        uniqueAngles.push(a);
      }
    }
    if (uniqueAngles.length < 2) return null;

    // Создаем круговые сегменты: [a0, a1], [a1, a2], ..., [an, a0]
    const segments: { startA: number; endA: number; p1: Point2D; p2: Point2D }[] = [];
    for (let i = 0; i < uniqueAngles.length; i++) {
      const cur = uniqueAngles[i];
      const next = uniqueAngles[(i + 1) % uniqueAngles.length];
      segments.push({
        startA: cur.angle,
        endA: next.angle,
        p1: cur.point,
        p2: next.point,
      });
    }

    // Угол курсора
    const cursorAngle = normalizeAngleDeg((Math.atan2(cursor.y - circle.cy, cursor.x - circle.cx) * 180) / Math.PI);

    // Находим сегмент, в который попадает курсор
    let targetSegIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      if (isAngleInArc(cursorAngle, segments[i].startA, segments[i].endA, true)) {
        targetSegIdx = i;
        break;
      }
    }

    const targetSeg = segments[targetSegIdx];

    // При удалении targetSeg, остальные сегменты объединяются в дугу или несколько дуг
    const remainingArcs: GraphicItem[] = [];
    if (segments.length === 2) {
      // Идеальный случай: окружность разделена на 2 части (например, TO-92). Оставшаяся часть — одна дуга!
      const keepSeg = segments[1 - targetSegIdx];
      remainingArcs.push({
        kind: "arc",
        id: `arc_${crypto.randomUUID()}`,
        cx: circle.cx,
        cy: circle.cy,
        radius: circle.radius,
        startAngle: keepSeg.startA,
        endAngle: keepSeg.endA,
        clockwise: true,
        strokeWidth: circle.strokeWidth,
        layer: circle.layer,
      });
    } else {
      // 3 и более сегментов
      for (let i = 0; i < segments.length; i++) {
        if (i === targetSegIdx) continue;
        const s = segments[i];
        remainingArcs.push({
          kind: "arc",
          id: `arc_${crypto.randomUUID()}`,
          cx: circle.cx,
          cy: circle.cy,
          radius: circle.radius,
          startAngle: s.startA,
          endAngle: s.endA,
          clockwise: true,
          strokeWidth: circle.strokeWidth,
          layer: circle.layer,
        });
      }
    }

    // Подсветка отсекаемого сегмента
    const sweep = ((targetSeg.endA - targetSeg.startA) % 360 + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    const highlightPath = `M ${targetSeg.p1.x} ${targetSeg.p1.y} A ${r} ${r} 0 ${largeArc} 1 ${targetSeg.p2.x} ${targetSeg.p2.y}`;

    return {
      targetItemId: circle.id,
      highlightPath,
      boundaryPoints: [targetSeg.p1, targetSeg.p2],
      newGraphics: autoMergeGraphics([
        ...items.filter((g) => g.id !== circle.id),
        ...remainingArcs,
      ]),
    };
  }

  // 3. ОБРЕЗКА ДУГИ
  if (bestItem.kind === "arc") {
    const arc = bestItem;
    const center: Point2D = { x: arc.cx, y: arc.cy };
    const r = arc.radius;
    const isCw = arc.clockwise !== false;

    const intersectionAngles: { angle: number; point: Point2D }[] = [];

    for (const other of otherCuttingItems) {
      if (other.id === arc.id) continue;
      if (other.kind === "line") {
        const hits = intersectLineCircle({ x: other.x1, y: other.y1 }, { x: other.x2, y: other.y2 }, arc.cx, arc.cy, r);
        for (const h of hits) {
          if (isAngleInArc(h.angleDeg, arc.startAngle, arc.endAngle, isCw)) {
            intersectionAngles.push({ angle: h.angleDeg, point: h.point });
          }
        }
      } else if (other.kind === "circle" || other.kind === "arc") {
        const hits = intersectCircleCircle(center, r, { x: other.cx, y: other.cy }, other.radius);
        for (const h of hits) {
          if (isAngleInArc(h.angle1, arc.startAngle, arc.endAngle, isCw)) {
            if (other.kind === "circle" || isAngleInArc(h.angle2, other.startAngle, other.endAngle, other.clockwise !== false)) {
              intersectionAngles.push({ angle: h.angle1, point: h.point });
            }
          }
        }
      } else if (other.kind === "rect" || other.kind === "polygon") {
        for (const seg of getItemSubSegments(other)) {
          const hits = intersectLineCircle(seg.p1, seg.p2, arc.cx, arc.cy, r);
          for (const h of hits) {
            if (isAngleInArc(h.angleDeg, arc.startAngle, arc.endAngle, isCw)) {
              intersectionAngles.push({ angle: h.angleDeg, point: h.point });
            }
          }
        }
      }
    }

    // Если дуга ни с чем не пересекается — клик удаляет её
    if (!intersectionAngles.length) {
      const remainingArcNoInter = parentItem
        ? [...items.filter((g) => g.id !== parentItem.id), ...siblingParts]
        : items.filter((g) => g.id !== arc.id);
      return {
        targetItemId: parentItem ? parentItem.id : arc.id,
        highlightPath: "", // уже отрисована
        boundaryPoints: [],
        newGraphics: autoMergeGraphics(remainingArcNoInter),
      };
    }

    // Сортируем углы по ходу движения дуги от startAngle
    const normStart = normalizeAngleDeg(arc.startAngle);
    intersectionAngles.sort((a, b) => {
      const diffA = isCw
        ? ((a.angle - normStart) % 360 + 360) % 360
        : ((normStart - a.angle) % 360 + 360) % 360;
      const diffB = isCw
        ? ((b.angle - normStart) % 360 + 360) % 360
        : ((normStart - b.angle) % 360 + 360) % 360;
      return diffA - diffB;
    });

    const startRad = (arc.startAngle * Math.PI) / 180;
    const endRad = (arc.endAngle * Math.PI) / 180;
    const startPt: Point2D = { x: arc.cx + r * Math.cos(startRad), y: arc.cy + r * Math.sin(startRad) };
    const endPt: Point2D = { x: arc.cx + r * Math.cos(endRad), y: arc.cy + r * Math.sin(endRad) };

    const allArcPts = [
      { angle: arc.startAngle, point: startPt },
      ...intersectionAngles,
      { angle: arc.endAngle, point: endPt },
    ];

    const cursorAngle = (Math.atan2(cursor.y - arc.cy, cursor.x - arc.cx) * 180) / Math.PI;
    let segIdx = 0;
    for (let i = 0; i < allArcPts.length - 1; i++) {
      if (isAngleInArc(cursorAngle, allArcPts[i].angle, allArcPts[i + 1].angle, isCw)) {
        segIdx = i;
        break;
      }
    }

    const targetSeg = { p1: allArcPts[segIdx].point, p2: allArcPts[segIdx + 1].point, startA: allArcPts[segIdx].angle, endA: allArcPts[segIdx + 1].angle };
    const remainingSubArcs: GraphicItem[] = [];
    for (let i = 0; i < allArcPts.length - 1; i++) {
      if (i === segIdx) continue;
      const s0 = allArcPts[i];
      const s1 = allArcPts[i + 1];
      remainingSubArcs.push({
        kind: "arc",
        id: `arc_${crypto.randomUUID()}`,
        cx: arc.cx,
        cy: arc.cy,
        radius: arc.radius,
        startAngle: s0.angle,
        endAngle: s1.angle,
        clockwise: isCw,
        strokeWidth: arc.strokeWidth,
        layer: arc.layer,
      });
    }

    const sweep = isCw
      ? ((targetSeg.endA - targetSeg.startA) % 360 + 360) % 360
      : ((targetSeg.startA - targetSeg.endA) % 360 + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    const sweepFlag = isCw ? 1 : 0;
    const highlightPath = `M ${targetSeg.p1.x} ${targetSeg.p1.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${targetSeg.p2.x} ${targetSeg.p2.y}`;

    const remainingArcAll = parentItem
      ? [...items.filter((g) => g.id !== parentItem.id), ...siblingParts, ...remainingSubArcs]
      : [...items.filter((g) => g.id !== arc.id), ...remainingSubArcs];

    return {
      targetItemId: parentItem ? parentItem.id : arc.id,
      highlightPath,
      boundaryPoints: [targetSeg.p1, targetSeg.p2],
      newGraphics: autoMergeGraphics(remainingArcAll),
    };
  }

  return null;
}

/** Расстояние от точки p до отрезка [v, w] */
function distToSegment(p: Point2D, v: Point2D, w: Point2D): number {
  const l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y);
  if (l2 === 0) return dist(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}
