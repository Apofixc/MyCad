// Типы данных проекта — зеркало доменной модели mycad-core (snake_case как в serde).

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Layer = "top" | "bottom";

export interface Component {
  id: string;
  designator: string;
  value: string;
  footprint: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer: Layer;
  locked: boolean;
  show_designator: boolean;
  show_value: boolean;
  notes: string;
  custom_pins: Record<string, string>;
  preset: string | null;
  pin_count: number | null;
}

export type NetType = "ground" | "power" | "signal" | "bus" | "analog" | "io";

export interface NetNode {
  comp_id: string;
  pin: string;
  desc: string;
}

export interface Net {
  id: string;
  name: string;
  label: string;
  type: NetType;
  color: string;
  voltage: number | null;
  description: string;
  nodes: NetNode[];
  verified: boolean;
}

export type ImageKind = "top" | "bottom" | "fragment";

export interface BoardImage {
  id: string;
  path: string;
  kind: ImageKind;
  width_px: number;
  height_px: number;
  offset_x: number;
  offset_y: number;
  mirrored: boolean;
}

export interface Module {
  id: string;
  name: string;
  width_px: number;
  height_px: number;
  board_rect: Rect;
  images: BoardImage[];
  components: Component[];
  nets: Record<string, Net>;
  calibration: { px_per_mm: number } | null;
}

export interface FootprintPin {
  num: string;
  name: string;
  shape: string;
  x_ratio: number;
  y_ratio: number;
}

export interface Footprint {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  mount_type: "tht" | "smd" | "virtual";
  shape: string;
  width: number;
  height: number;
  pin_count: number;
  pins: FootprintPin[];
}

export interface ModulePinRef {
  module_id: string;
  comp_id: string;
  pin: string;
}

export interface InterModuleLink {
  from: ModulePinRef;
  to: ModulePinRef;
  verified: boolean;
  notes: string;
}

export interface Project {
  name: string;
  version: number;
  modules: Module[];
  footprints: Record<string, Footprint>;
  presets: Record<string, unknown>;
  inter_module_links: InterModuleLink[];
}
