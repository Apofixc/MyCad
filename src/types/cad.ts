export type ToolMode =
  | "select"
  | "transform"
  | "calibrate"
  | "level"
  | "register"
  | "curtain"
  | "measure"
  | "magnifier"
  | "blink";

export interface ProjectManifest {
  id: String;
  name: string;
  author?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  formatVersion: number;
  files: ProjectFileRef[];
}

export interface ProjectFileRef {
  id: string;
  name: string;
  fileType: "board" | "sch";
  path: string;
  orderIndex: number;
}

export interface BoardDocument {
  id: string;
  name: string;
  type: "board";
  orderIndex: number;
  data: BoardData;
}

export interface BoardData {
  id: string;
  name: string;
  bgTop: ImageLayerGroup;
  bgBottom: ImageLayerGroup;
  components: ComponentItem[];
  nets: NetInfo[];
}

export interface ImageLayerGroup {
  images: BoardImageLayer[];
}

export interface BoardImageLayer {
  id: string;
  name: string;
  side: "top" | "bottom";
  imageFile?: string;
  cachedUrl?: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  lockAspectRatio: boolean;
  rotation: number;
  opacity: number;
  brightness: number;
  contrast: number;
  invert: boolean;
  grayscale: boolean;
  blendMode: string;
  tintColor: string;
  dpi: number;
  pxPerMm: number;
  mirrored: boolean;
  flipV: boolean;
  locked: boolean;
  visible: boolean;
  width: number;
  height: number;
}

export interface ComponentItem {
  id: string;
  refDes: string;
  value?: string;
  compType: string;
  layer: "top" | "bottom";
  x: number; // in mm
  y: number; // in mm
  rotation: number; // 0, 90, 180, 270
  deviceId?: string;
  packageId?: string;
  packageFamily?: string;
  bodyShape: "rect" | "circle" | "d_shape";
  bodyWidth: number;
  bodyHeight: number;
  bodyColor?: string;
  hasPolarityMark?: boolean;
  pins: PinItem[];
}

export interface PinItem {
  id: string;
  pinNumber: number;
  name?: string;
  relX: number; // offset from center in mm
  relY: number;
  shape: "rect" | "circle" | "round_rect" | "oval";
  width: number;
  height: number;
  drillDiameter?: number;
  netId?: string;
  electricalType?: string;
}

export interface NetInfo {
  id: string;
  name: string;
  color?: string;
  pinCount: number;
}

export interface RecentProject {
  id: string;
  name: string;
  filePath: string;
  componentCount: number;
  lastOpened: string;
  createdAt: string;
}

export interface LibraryDevice {
  id: string;
  name: string;
  categoryId: string;
  prefix: string;
  value?: string;
  description?: string;
  packageId: string;
  tags: string[];
}

export interface PackageTemplate {
  id: string;
  name: string;
  family: string;
  pinCount: number;
  bodyWidth: number;
  bodyHeight: number;
  pins: PinTemplate[];
}

export interface PinTemplate {
  number: number;
  name: string;
  relX: number;
  relY: number;
  width: number;
  height: number;
  shape: string;
}

export interface CrossProbingResult {
  netId: string;
  netName: string;
  pins: CrossProbingPin[];
}

export interface CrossProbingPin {
  componentId: string;
  refDes: string;
  pinNumber: number;
  pinName?: string;
  layer: "top" | "bottom";
  absX: number;
  absY: number;
}

export interface RegistrationResult {
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  scaleFactor: number;
}
