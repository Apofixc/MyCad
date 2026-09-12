import { BoardImageLayer } from "../types/cad";
import { PackageDefinition } from "../types/componentLibrary";

export type PackageReference = "width" | "height" | "pitch" | "pads";

export function packageReferenceDistance(pkg: PackageDefinition, reference: PackageReference, from?: string, to?: string): number | null {
  let distance: number | undefined;
  if (reference === "width") distance = pkg.bodyWidth;
  else if (reference === "height") distance = pkg.bodyHeight;
  else if (reference === "pitch") distance = pkg.pitch;
  else {
    const a = pkg.pads.find((p) => p.padNum === from), b = pkg.pads.find((p) => p.padNum === to);
    if (a && b) distance = Math.hypot(a.x - b.x, a.y - b.y);
  }
  return distance !== undefined && Number.isFinite(distance) && distance > 0 ? distance : null;
}

export function calibrateImageLayer(layer: BoardImageLayer, measuredPx: number, realMm: number,
  anchor: { bitmapX: number; bitmapY: number; boardX: number; boardY: number; width: number; height: number }): BoardImageLayer {
  if (![measuredPx, realMm].every((value) => Number.isFinite(value) && value > 0))
    throw new Error("Для калибровки нужны положительные расстояния.");
  const pxPerMm = measuredPx / realMm;
  const width = anchor.width / pxPerMm, height = anchor.height / pxPerMm;
  const dx = (anchor.bitmapX / pxPerMm - width / 2) * (layer.mirrored ? -1 : 1);
  const dy = (anchor.bitmapY / pxPerMm - height / 2) * (layer.flipV ? -1 : 1);
  const angle = (layer.rotation || 0) * Math.PI / 180;
  return {
    ...layer, pxPerMm, dpi: pxPerMm * 25.4, scale: 1,
    offsetX: anchor.boardX - dx * Math.cos(angle) + dy * Math.sin(angle) - width / 2,
    offsetY: anchor.boardY - dx * Math.sin(angle) - dy * Math.cos(angle) - height / 2,
  };
}
