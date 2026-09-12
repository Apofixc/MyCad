import { GraphicItem, PackagePad } from "../types/componentLibrary";
import { getCapsulePath, getDShapePath } from "./footprintGenerator";

export function getArcPath(item: Extract<GraphicItem, { kind: "arc" }>): string {
  const start = item.startAngle * Math.PI / 180;
  const sweep = ((item.endAngle - item.startAngle) % 360 + 360) % 360 || 360;
  const point = (angle: number) =>
    `${item.cx + item.radius * Math.cos(angle)} ${item.cy + item.radius * Math.sin(angle)}`;
  const middle = start + sweep * Math.PI / 360;
  const end = start + sweep * Math.PI / 180;
  return `M ${point(start)} A ${item.radius} ${item.radius} 0 0 1 ${point(middle)} A ${item.radius} ${item.radius} 0 0 1 ${point(end)}`;
}

export function getGraphicPath(item: GraphicItem): string {
  switch (item.kind) {
    case "line": return `M ${item.x1} ${item.y1} L ${item.x2} ${item.y2}`;
    case "arc": return getArcPath(item);
    case "circle": return getCapsulePath(item.cx, item.cy, item.radius * 2, item.radius * 2);
    case "capsule": return getCapsulePath(item.cx, item.cy, item.width, item.height);
    case "d_shape":
      if (item.cutDepth === 0) return getCapsulePath(item.cx, item.cy, item.diameter, item.diameter);
      return getDShapePath(item.cx, item.cy, item.diameter / 2, item.cutOrientation,
        Math.max(-0.999, Math.min(0.999, 1 - item.cutDepth / (item.diameter / 2))));
    case "polygon": return polygonPath(item.points);
    case "rect": return roundedRectPath(item.x, item.y, item.width, item.height, item.roundRadius);
    case "text": return "";
  }
}

export function graphicRotation(item: GraphicItem): [number, number, number] {
  if (item.kind === "rect" || item.kind === "text") return [item.rotation, item.x, item.y];
  if (item.kind === "capsule") return [item.rotation, item.cx, item.cy];
  return [0, 0, 0];
}

function polygonPath(points: [number, number][]): string {
  return points.length ? `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z` : "";
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius = 0): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const l = x - width / 2, t = y - height / 2, b = y + height / 2, right = x + width / 2;
  return `M ${l + r} ${t} H ${right - r} A ${r} ${r} 0 0 1 ${right} ${t + r} V ${b - r} A ${r} ${r} 0 0 1 ${right - r} ${b} H ${l + r} A ${r} ${r} 0 0 1 ${l} ${b - r} V ${t + r} A ${r} ${r} 0 0 1 ${l + r} ${t} Z`;
}

export function getPadPath(pad: PackagePad): string {
  switch (pad.shape) {
    case "circle": return getCapsulePath(pad.x, pad.y, pad.width, pad.width);
    case "oval": return getCapsulePath(pad.x, pad.y, pad.width, pad.height);
    case "d_shape": return getDShapePath(pad.x, pad.y, Math.min(pad.width, pad.height) / 2);
    case "custom_polygon":
      return polygonPath((pad.polygonPoints ?? []).map(([x, y]) => [x + pad.x, y + pad.y]));
    case "chamfered_rect": {
      const l = pad.x - pad.width / 2, r = pad.x + pad.width / 2;
      const t = pad.y - pad.height / 2, b = pad.y + pad.height / 2;
      const c = Math.min(pad.width, pad.height) / 4;
      return polygonPath([[l + c, t], [r, t], [r, b], [l, b], [l, t + c]]);
    }
    default: return roundedRectPath(pad.x, pad.y, pad.width, pad.height,
      pad.shape === "rounded_rect" ? pad.roundRadius ?? Math.min(pad.width, pad.height) / 4 : 0);
  }
}

export function getFootprintBounds(pads: PackagePad[], graphics: GraphicItem[]) {
  const points: [number, number][] = [];
  const box = (x: number, y: number, w: number, h: number, rotation = 0) => {
    const angle = rotation * Math.PI / 180;
    for (const dx of [-w / 2, w / 2]) for (const dy of [-h / 2, h / 2]) {
      points.push([x + dx * Math.cos(angle) - dy * Math.sin(angle),
        y + dx * Math.sin(angle) + dy * Math.cos(angle)]);
    }
  };
  pads.forEach((p) => {
    if (p.shape === "custom_polygon" && p.polygonPoints) {
      const angle = p.rotation * Math.PI / 180;
      p.polygonPoints.forEach(([x, y]) => points.push([
        p.x + x * Math.cos(angle) - y * Math.sin(angle),
        p.y + x * Math.sin(angle) + y * Math.cos(angle),
      ]));
    } else box(p.x, p.y, p.width, p.shape === "circle" ? p.width : p.height, p.rotation);
  });
  graphics.forEach((g) => {
    switch (g.kind) {
      case "line": points.push([g.x1, g.y1], [g.x2, g.y2]); break;
      case "polygon": points.push(...g.points); break;
      case "rect": box(g.x, g.y, g.width, g.height, g.rotation); break;
      case "capsule": box(g.cx, g.cy, g.width, g.height, g.rotation); break;
      case "circle":
      case "arc": box(g.cx, g.cy, g.radius * 2, g.radius * 2); break;
      case "d_shape": box(g.cx, g.cy, g.diameter, g.diameter); break;
      case "text": {
        const width = g.text.length * g.fontSize;
        const offset = g.align === "left" ? width / 2 : g.align === "right" ? -width / 2 : 0;
        box(g.x + offset * Math.cos(g.rotation * Math.PI / 180),
          g.y + offset * Math.sin(g.rotation * Math.PI / 180), width, g.fontSize, g.rotation);
        break;
      }
    }
  });
  if (!points.length) return { minX: -3, minY: -2, maxX: 3, maxY: 2 };
  return {
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
  };
}

export function appendUniquePads(existing: PackagePad[], incoming: PackagePad[]): PackagePad[] {
  const used = new Set(existing.map((p) => p.padNum));
  let next = 1;
  return [...existing, ...incoming.map((pad) => {
    let padNum = pad.padNum;
    if (used.has(padNum)) {
      while (used.has(String(next))) next++;
      padNum = String(next++);
    }
    used.add(padNum);
    return { ...pad, padNum, name: pad.name === pad.padNum ? padNum : pad.name };
  })];
}

export function polygonToPad(item: Extract<GraphicItem, { kind: "polygon" }>, padNum: string): PackagePad {
  const bounds = getFootprintBounds([], [item]);
  const x = (bounds.minX + bounds.maxX) / 2, y = (bounds.minY + bounds.maxY) / 2;
  return {
    padNum, name: padNum, x, y, rotation: 0, shape: "custom_polygon",
    width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY,
    polygonPoints: item.points.map(([px, py]) => [px - x, py - y]),
  };
}

export function validateFootprint(pads: PackagePad[], graphics: GraphicItem[]): string | null {
  const numbers = new Set<string>();
  for (const pad of pads) {
    if (!pad.padNum.trim() || numbers.has(pad.padNum.trim())) return "Номера площадок должны быть заполнены и уникальны.";
    numbers.add(pad.padNum.trim());
    if (![pad.x, pad.y, pad.width, pad.height, pad.rotation].every(Number.isFinite) || pad.width <= 0 || pad.height <= 0)
      return `Площадка ${pad.padNum}: размеры должны быть положительными, координаты — конечными.`;
    if (pad.drillDiameter !== undefined && (!Number.isFinite(pad.drillDiameter) || pad.drillDiameter < 0))
      return `Площадка ${pad.padNum}: некорректный диаметр отверстия.`;
    if (pad.roundRadius !== undefined && (!Number.isFinite(pad.roundRadius) || pad.roundRadius < 0))
      return `Площадка ${pad.padNum}: некорректное скругление.`;
    if (pad.drillShape === "slot" && (!Number.isFinite(pad.slotLength) || (pad.slotLength ?? 0) < (pad.drillDiameter ?? 0)))
      return `Площадка ${pad.padNum}: длина отверстия меньше диаметра.`;
    if (pad.shape === "custom_polygon" && (!pad.polygonPoints || pad.polygonPoints.length < 3 ||
      pad.polygonPoints.some((point) => !point.every(Number.isFinite))))
      return `Площадка ${pad.padNum}: задайте минимум три вершины полигона.`;
  }
  for (const g of graphics) {
    if (Object.values(g).some((value) => typeof value === "number" && !Number.isFinite(value)) || g.strokeWidth <= 0)
      return "Проверьте координаты и толщину линий контура.";
    if ((g.kind === "rect" || g.kind === "capsule") && (g.width <= 0 || g.height <= 0) ||
      (g.kind === "circle" || g.kind === "arc") && g.radius <= 0 ||
      g.kind === "text" && g.fontSize <= 0 ||
      g.kind === "rect" && g.roundRadius < 0 ||
      g.kind === "d_shape" && (g.diameter <= 0 || g.cutDepth < 0 || g.cutDepth >= g.diameter))
      return "Размеры элементов должны быть положительными; срез — меньше диаметра.";
    if (g.kind === "polygon" && (g.points.length < 3 || g.points.some((point) => !point.every(Number.isFinite))))
      return "В контуре нужны минимум три вершины с конечными координатами.";
  }
  return null;
}
