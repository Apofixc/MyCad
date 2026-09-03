import type { Component, Footprint } from "./types";

export interface PinPosition {
  num: string;
  name: string;
  x: number;
  y: number;
}

/** Мировые координаты пинов компонента (позиции из footprint + поворот компонента). */
export function pinPositions(c: Component, fp: Footprint | undefined): PinPosition[] {
  if (!fp || fp.pins.length === 0) return [];
  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;
  const rad = (c.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return fp.pins.map((p) => {
    const lx = (p.x_ratio - 0.5) * c.width;
    const ly = (p.y_ratio - 0.5) * c.height;
    return {
      num: p.num,
      name: p.name,
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    };
  });
}

export interface Point {
  x: number;
  y: number;
}

/** Рёбра минимального остовного дерева (алгоритм Прима) для ratlines цепи. */
export function mstEdges(points: Point[]): Array<[Point, Point]> {
  if (points.length < 2) return [];
  const inTree = new Array(points.length).fill(false);
  const dist = new Array(points.length).fill(Infinity);
  const parent = new Array(points.length).fill(-1);
  dist[0] = 0;
  for (let iter = 0; iter < points.length; iter++) {
    let u = -1;
    for (let i = 0; i < points.length; i++) {
      if (!inTree[i] && (u === -1 || dist[i] < dist[u])) u = i;
    }
    inTree[u] = true;
    for (let v = 0; v < points.length; v++) {
      if (inTree[v]) continue;
      const dx = points[u].x - points[v].x;
      const dy = points[u].y - points[v].y;
      const d = dx * dx + dy * dy;
      if (d < dist[v]) {
        dist[v] = d;
        parent[v] = u;
      }
    }
  }
  const edges: Array<[Point, Point]> = [];
  for (let v = 1; v < points.length; v++) {
    if (parent[v] >= 0) edges.push([points[parent[v]], points[v]]);
  }
  return edges;
}
