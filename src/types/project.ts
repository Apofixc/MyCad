export interface Pin {
  id: string;        // e.g. "p1", "p2"
  number: number;    // 1, 2, ...
  name?: string;     // e.g. "VCC", "GND", "IN+"
  x: number;         // offset relative to component center in mm/px
  y: number;
  netId?: string;    // e.g. "GND", "NET_12V"
}

export type ComponentType = "resistor" | "capacitor" | "diode" | "ic_soic8" | "ic_dip8" | "testpoint";

export type BoardSide = "top" | "bottom";

export type BoardSelectionTarget =
  | { type: "component"; id: string; pinId?: string }
  | { type: "layer_bg_top" }
  | { type: "layer_bg_bottom" }
  | { type: "layer_comps_top" }
  | { type: "layer_comps_bottom" }
  | null;

export interface BackgroundLayer {
  image?: string;       // data URL or file path for mounting scheme / board photo
  visible: boolean;     // layer visibility
  opacity: number;      // 0.0 - 1.0 (default 0.85)
  brightness: number;   // 50 - 200% (default 100)
  contrast: number;     // 50 - 250% (default 100)
  invert: boolean;      // dark mode invert for scanned schematics
  mirrored?: boolean;   // horizontal flip for Bottom side
  scale: number;        // scale factor (default 1)
  offsetX: number;      // X offset for alignment
  offsetY: number;      // Y offset for alignment
}

export interface ComponentItem {
  id: string;
  refDes: string;     // e.g. "R1", "C5", "U1"
  value: string;      // e.g. "10k", "100nF", "STM32"
  type: ComponentType;
  x: number;          // board canvas position X
  y: number;          // board canvas position Y
  rotation: number;   // 0, 90, 180, 270 degrees
  layer?: BoardSide;  // "top" | "bottom" (default "top")
  pins: Pin[];
}

export interface BoardData {
  id: string;
  name: string;       // e.g. "2323.board"
  bgTop: BackgroundLayer;
  bgBottom: BackgroundLayer;
  activeSideView: "top" | "bottom" | "both";
  showCompsTop: boolean;
  showCompsBottom: boolean;
  components: ComponentItem[];
  selectedTarget?: BoardSelectionTarget;
  // Legacy fields retained for backwards compatibility
  bgImage?: string;
  bgOpacity?: number;
  bgScale?: number;
  bgOffsetX?: number;
  bgOffsetY?: number;
  selectedComponentId?: string;
  selectedPinId?: string;
}

export const createDefaultBackgroundLayer = (mirrored = false): BackgroundLayer => ({
  image: undefined,
  visible: true,
  opacity: 0.85,
  brightness: 100,
  contrast: 100,
  invert: false,
  mirrored,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});

export const normalizeBoardData = (raw: Partial<BoardData>): BoardData => {
  const legacyImage = raw.bgImage;
  const legacyOpacity = typeof raw.bgOpacity === "number" ? raw.bgOpacity : 0.85;
  const legacyScale = typeof raw.bgScale === "number" ? raw.bgScale : 1;
  const legacyOffsetX = typeof raw.bgOffsetX === "number" ? raw.bgOffsetX : 0;
  const legacyOffsetY = typeof raw.bgOffsetY === "number" ? raw.bgOffsetY : 0;

  const bgTop: BackgroundLayer = raw.bgTop
    ? { ...createDefaultBackgroundLayer(false), ...raw.bgTop }
    : {
        ...createDefaultBackgroundLayer(false),
        image: legacyImage,
        opacity: legacyOpacity,
        scale: legacyScale,
        offsetX: legacyOffsetX,
        offsetY: legacyOffsetY,
      };

  const bgBottom: BackgroundLayer = raw.bgBottom
    ? { ...createDefaultBackgroundLayer(true), ...raw.bgBottom }
    : createDefaultBackgroundLayer(true);

  const components: ComponentItem[] = (raw.components || []).map((c) => ({
    ...c,
    layer: c.layer || "top",
  }));

  let selectedTarget: BoardSelectionTarget = raw.selectedTarget || null;
  if (!selectedTarget && raw.selectedComponentId) {
    selectedTarget = {
      type: "component",
      id: raw.selectedComponentId,
      pinId: raw.selectedPinId,
    };
  }

  return {
    id: raw.id || `file_board_${Date.now()}`,
    name: raw.name || "board.board",
    bgTop,
    bgBottom,
    activeSideView: raw.activeSideView || "top",
    showCompsTop: raw.showCompsTop !== false,
    showCompsBottom: raw.showCompsBottom !== false,
    components,
    selectedTarget,
    selectedComponentId: raw.selectedComponentId,
    selectedPinId: raw.selectedPinId,
  };
};

export interface SchematicData {
  id: string;
  name: string;       // e.g. "2323.sch"
  notes?: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  type: "board" | "sch";
  data: BoardData | SchematicData;
}

export interface Project {
  id: string;
  name: string;       // e.g. "2323"
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
  formatVersion?: number;
  filePath?: string;  // Absolute path on filesystem if saved/opened
  files: ProjectFile[];
  activeFileId: string;
}

