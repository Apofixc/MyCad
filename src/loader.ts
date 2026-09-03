import { invoke } from "@tauri-apps/api/core";
import type { Component, Footprint, Module, Net, Project } from "./types";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

// Fallback для чистого vite-dev в браузере: собирает проект из reference/*.json
// тем же способом, что import_reference_project в mycad-core.
async function loadFromReferenceJson(): Promise<Project> {
  const fetchJson = async (name: string) => {
    const res = await fetch(`/reference/${name}.json`);
    if (!res.ok) throw new Error(`Не удалось загрузить reference/${name}.json`);
    return res.json();
  };
  const [boardMeta, footprints, presets, components, nets] = await Promise.all([
    fetchJson("boardMeta"),
    fetchJson("footprints"),
    fetchJson("presets"),
    fetchJson("components"),
    fetchJson("nets"),
  ]);

  const footprintMap: Record<string, Footprint> = {};
  for (const [id, f] of Object.entries(footprints as Record<string, Record<string, unknown>>)) {
    footprintMap[id] = {
      id: String(f.id),
      name: String(f.name ?? ""),
      category: String(f.category ?? ""),
      subcategory: String(f.subcategory ?? ""),
      mount_type: (f.mountType as Footprint["mount_type"]) ?? "tht",
      shape: String(f.shape ?? ""),
      width: Number(f.width ?? 0),
      height: Number(f.height ?? 0),
      pin_count: Number(f.pinCount ?? 0),
      pins: ((f.pins as Record<string, unknown>[]) ?? []).map((p) => ({
        num: String(p.num),
        name: String(p.name ?? ""),
        shape: String(p.shape ?? "circle"),
        x_ratio: Number(p.xRatio ?? 0.5),
        y_ratio: Number(p.yRatio ?? 0.5),
      })),
    };
  }

  const comps: Component[] = (components as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    designator: String(c.designator),
    value: String(c.value ?? ""),
    footprint: String(c.footprint),
    x: Number(c.x),
    y: Number(c.y),
    width: Number(c.width),
    height: Number(c.height),
    rotation: Number(c.rotation ?? 0),
    layer: c.layer === "bottom" ? "bottom" : "top",
    locked: Boolean(c.locked),
    show_designator: c.showDesignator !== false,
    show_value: c.showValue === true,
    notes: String(c.notes ?? ""),
    custom_pins: (c.customPins as Record<string, string>) ?? {},
    preset: (c.preset as string) ?? null,
    pin_count: (c.pinCount as number) ?? null,
  }));

  const netMap: Record<string, Net> = {};
  for (const [id, n] of Object.entries(nets as Record<string, Record<string, unknown>>)) {
    netMap[id] = {
      id: String(n.id),
      name: String(n.name),
      label: String(n.label ?? ""),
      type: (n.type as Net["type"]) ?? "signal",
      color: String(n.color ?? ""),
      voltage: (n.voltage as number) ?? null,
      description: String(n.description ?? ""),
      nodes: ((n.nodes as Record<string, unknown>[]) ?? []).map((node) => ({
        comp_id: String(node.compId),
        pin: String(node.pin),
        desc: String(node.desc ?? ""),
      })),
      verified: false,
    };
  }

  const dims = (boardMeta as { dimensions: Record<string, unknown> }).dimensions;
  const module: Module = {
    id: "main",
    name: "Основная плата",
    width_px: Number(dims.widthPx),
    height_px: Number(dims.heightPx),
    board_rect: dims.boardRect as Module["board_rect"],
    images: [
      {
        id: "top-photo",
        path: "backup_20260830_124935/pcb_board.png",
        kind: "top",
        width_px: Number(dims.widthPx),
        height_px: Number(dims.heightPx),
        offset_x: 0,
        offset_y: 0,
        mirrored: false,
      },
    ],
    components: comps,
    nets: netMap,
    calibration: null,
  };

  return {
    name: "Пиррс 1000 Люкс",
    version: 1,
    modules: [module],
    footprints: footprintMap,
    presets: presets as Project["presets"],
    inter_module_links: [],
  };
}

export async function loadReferenceProject(): Promise<Project> {
  if (isTauri()) {
    return invoke<Project>("load_reference_project");
  }
  return loadFromReferenceJson();
}
