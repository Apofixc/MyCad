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
  | { type: "layer_bg_top"; imageId?: string }
  | { type: "layer_bg_bottom"; imageId?: string }
  | { type: "layer_comps_top" }
  | { type: "layer_comps_bottom" }
  | null;

export type ImageBlendMode = "normal" | "multiply" | "screen" | "difference" | "overlay";

export interface LayerImageItem {
  id: string;
  name: string;        // e.g. "Скан_платы_1.png"
  src: string;         // data URL / base64 or file path
  x: number;           // canvas offset X
  y: number;           // canvas offset Y
  width?: number;      // natural width
  height?: number;     // natural height
  scale: number;       // scale factor (default 1)
  lockAspectRatio?: boolean; // lock aspect ratio on scale/dimensions
  rotation: number;    // rotation angle in degrees (e.g. 0.0, 0.5, 90.0)
  opacity: number;     // 0.0 - 1.0 (default 0.85)
  brightness: number;  // 30 - 200% (default 100)
  contrast: number;    // 50 - 250% (default 100)
  invert: boolean;     // inverted colors (dark mode scan)
  grayscale?: boolean; // black & white mode
  blendMode?: ImageBlendMode; // layer blend mode (e.g. "difference")
  tintColor?: string;  // tint color overlay ("none" | "red" | "blue" | "green" etc.)
  dpi?: number;        // scan resolution (e.g. 600)
  pxPerMm?: number;    // physical scale calibration (pixels per mm)
  mirrored?: boolean;  // horizontal flip (Flip X)
  flipV?: boolean;     // vertical flip (Flip Y)
  locked?: boolean;    // lock against accidental movement
  visible: boolean;    // visibility of this specific image
  order: number;       // z-index order within layer
}

export interface BackgroundLayer {
  images: LayerImageItem[]; // Multi-image support per layer
  activeImageId?: string;   // currently selected image within this layer
  visible: boolean;         // layer visibility
  opacity: number;          // layer master opacity 0.0 - 1.0 (default 0.85)
  brightness: number;       // layer master brightness 50 - 200% (default 100)
  contrast: number;         // layer master contrast 50 - 250% (default 100)
  invert: boolean;          // dark mode invert
  mirrored?: boolean;       // horizontal flip for Bottom side
  scale: number;            // layer master scale factor (default 1)
  offsetX: number;          // layer master X offset
  offsetY: number;          // layer master Y offset
  // Legacy single image compatibility
  image?: string;
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
  activeToolMode?: "images" | "components"; // Contextual tool mode
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
  images: [],
  activeImageId: undefined,
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

const migrateLegacyImage = (
  layerKey: "top" | "bottom",
  layer?: Partial<BackgroundLayer>,
  legacyImg?: string
): LayerImageItem[] => {
  if (layer?.images && Array.isArray(layer.images) && layer.images.length > 0) {
    return layer.images.map((img, idx) => ({
      id: img.id || `img_${layerKey}_${idx}_${Date.now()}`,
      name: img.name || `Изображение ${idx + 1}`,
      src: img.src || (img as any).image || "",
      x: typeof img.x === "number" ? img.x : (layer.offsetX || 0),
      y: typeof img.y === "number" ? img.y : (layer.offsetY || 0),
      width: img.width,
      height: img.height,
      scale: typeof img.scale === "number" ? img.scale : (layer.scale || 1),
      lockAspectRatio: typeof img.lockAspectRatio === "boolean" ? img.lockAspectRatio : true,
      rotation: typeof img.rotation === "number" ? img.rotation : 0,
      opacity: typeof img.opacity === "number" ? img.opacity : (layer.opacity ?? 0.85),
      brightness: typeof img.brightness === "number" ? img.brightness : (layer.brightness ?? 100),
      contrast: typeof img.contrast === "number" ? img.contrast : (layer.contrast ?? 100),
      invert: typeof img.invert === "boolean" ? img.invert : (layer.invert ?? false),
      grayscale: typeof img.grayscale === "boolean" ? img.grayscale : false,
      blendMode: img.blendMode || "normal",
      tintColor: img.tintColor || "none",
      dpi: typeof img.dpi === "number" ? img.dpi : 600,
      pxPerMm: typeof img.pxPerMm === "number" ? img.pxPerMm : 23.62,
      mirrored: typeof img.mirrored === "boolean" ? img.mirrored : (layer.mirrored ?? (layerKey === "bottom")),
      flipV: typeof img.flipV === "boolean" ? img.flipV : false,
      locked: typeof img.locked === "boolean" ? img.locked : false,
      visible: typeof img.visible === "boolean" ? img.visible : true,
      order: typeof img.order === "number" ? img.order : idx,
    }));
  }

  const singleImg = layer?.image || legacyImg;
  if (singleImg) {
    return [
      {
        id: `img_${layerKey}_1`,
        name: layerKey === "top" ? "Скан Top (Лицевая)" : "Скан Bottom (Обратная)",
        src: singleImg,
        x: layer?.offsetX ?? 0,
        y: layer?.offsetY ?? 0,
        scale: layer?.scale ?? 1,
        rotation: 0,
        opacity: layer?.opacity ?? 0.85,
        brightness: layer?.brightness ?? 100,
        contrast: layer?.contrast ?? 100,
        invert: layer?.invert ?? false,
        mirrored: layer?.mirrored ?? (layerKey === "bottom"),
        flipV: false,
        locked: false,
        visible: true,
        order: 0,
      },
    ];
  }

  return [];
};

export const normalizeBoardData = (raw: Partial<BoardData>): BoardData => {
  const legacyImage = raw.bgImage;
  const legacyOpacity = typeof raw.bgOpacity === "number" ? raw.bgOpacity : 0.85;
  const legacyScale = typeof raw.bgScale === "number" ? raw.bgScale : 1;
  const legacyOffsetX = typeof raw.bgOffsetX === "number" ? raw.bgOffsetX : 0;
  const legacyOffsetY = typeof raw.bgOffsetY === "number" ? raw.bgOffsetY : 0;

  const topImages = migrateLegacyImage("top", raw.bgTop, legacyImage);
  const bgTop: BackgroundLayer = {
    ...createDefaultBackgroundLayer(false),
    ...(raw.bgTop || {}),
    images: topImages,
    activeImageId: raw.bgTop?.activeImageId || topImages[0]?.id,
    image: topImages[0]?.src || legacyImage,
    opacity: raw.bgTop?.opacity ?? legacyOpacity,
    scale: raw.bgTop?.scale ?? legacyScale,
    offsetX: raw.bgTop?.offsetX ?? legacyOffsetX,
    offsetY: raw.bgTop?.offsetY ?? legacyOffsetY,
  };

  const bottomImages = migrateLegacyImage("bottom", raw.bgBottom, undefined);
  const bgBottom: BackgroundLayer = {
    ...createDefaultBackgroundLayer(true),
    ...(raw.bgBottom || {}),
    images: bottomImages,
    activeImageId: raw.bgBottom?.activeImageId || bottomImages[0]?.id,
    image: bottomImages[0]?.src,
  };

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

  // Determine active tool mode strictly based on the active layer/selection target:
  let activeToolMode: "images" | "components" = "images";
  if (
    selectedTarget?.type === "layer_comps_top" ||
    selectedTarget?.type === "layer_comps_bottom" ||
    selectedTarget?.type === "component"
  ) {
    activeToolMode = "components";
  } else if (
    selectedTarget?.type === "layer_bg_top" ||
    selectedTarget?.type === "layer_bg_bottom"
  ) {
    activeToolMode = "images";
  } else if (raw.activeToolMode) {
    activeToolMode = raw.activeToolMode;
  } else if (components.length > 0 && bgTop.images.length === 0 && bgBottom.images.length === 0) {
    activeToolMode = "components";
  } else {
    activeToolMode = "images";
  }

  return {
    id: raw.id || `file_board_${Date.now()}`,
    name: raw.name || "board.board",
    bgTop,
    bgBottom,
    activeSideView: raw.activeSideView || "top",
    activeToolMode,
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

