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

  for (const item of items) {
    if (item.kind === "line") {
      const d = distToSegment(cursor, { x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 });
      if (d < bestDist) {
        bestDist = d;
        bestItem = item;
      }
    } else if (item.kind === "circle") {
      const d = Math.abs(dist(cursor, { x: item.cx, y: item.cy }) - item.radius);
      if (d < bestDist) {
        bestDist = d;
        bestItem = item;
      }
    } else if (item.kind === "arc") {
      const dCenter = dist(cursor, { x: item.cx, y: item.cy });
      const d = Math.abs(dCenter - item.radius);
      const angle = (Math.atan2(cursor.y - item.cy, cursor.x - item.cx) * 180) / Math.PI;
      if (d < bestDist && isAngleInArc(angle, item.startAngle, item.endAngle, item.clockwise !== false)) {
        bestDist = d;
        bestItem = item;
      }
    }
  }

  if (!bestItem) return null;

  // 1. ОБРЕЗКА ЛИНИИ
  if (bestItem.kind === "line") {
    const line = bestItem;
    const p1: Point2D = { x: line.x1, y: line.y1 };
    const p2: Point2D = { x: line.x2, y: line.y2 };

    // Находим все точки пересечения этой линии со всеми другими объектами
    const intersections: { t: number; point: Point2D }[] = [];

    for (const other of items) {
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
      return {
        targetItemId: line.id,
        highlightPath: `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`,
        boundaryPoints: [p1, p2],
        newGraphics: items.filter((g) => g.id !== line.id),
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

    return {
      targetItemId: line.id,
      highlightPath: `M ${segStart.point.x} ${segStart.point.y} L ${segEnd.point.x} ${segEnd.point.y}`,
      boundaryPoints: [segStart.point, segEnd.point],
      newGraphics: [
        ...items.filter((g) => g.id !== line.id),
        ...remainingLineSegments,
      ],
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
      newGraphics: [
        ...items.filter((g) => g.id !== circle.id),
        ...remainingArcs,
      ],
    };
  }

  // 3. ОБРЕЗКА ДУГИ
  if (bestItem.kind === "arc") {
    const arc = bestItem;
    const center: Point2D = { x: arc.cx, y: arc.cy };
    const r = arc.radius;
    const isCw = arc.clockwise !== false;

    const intersectionAngles: { angle: number; point: Point2D }[] = [];

    for (const other of items) {
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
      return {
        targetItemId: arc.id,
        highlightPath: "", // уже отрисована
        boundaryPoints: [],
        newGraphics: items.filter((g) => g.id !== arc.id),
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

    return {
      targetItemId: arc.id,
      highlightPath,
      boundaryPoints: [targetSeg.p1, targetSeg.p2],
      newGraphics: [
        ...items.filter((g) => g.id !== arc.id),
        ...remainingSubArcs,
      ],
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
