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

export type ActiveWorkLayer =
  | { type: "underlay"; side: "top" | "bottom" }
  | { type: "components"; side: "top" | "bottom" }
  | { type: "copper"; side: "top" | "bottom" }
  | { type: "vias" };

export interface ProjectManifest {
  id: string;
  name: string;
  author?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  formatVersion: number;
  files: ProjectFileRef[];
}

export interface ProjectFullState {
  manifest: ProjectManifest;
  boards: BoardDocument[];
  schematics: SchematicDocument[];
  activeFileId: string | null;
}

export interface ProjectFileRef {
  id: string;
  name: string;
  fileType: "board" | "schematic";
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

export interface SchematicDocument {
  id: string;
  name: string;
  type: "schematic";
  orderIndex: number;
  data: SchematicData;
}

export interface SchematicData {
  id: string;
  name: string;
  bg?: ImageLayerGroup;
  components: any[];
  nets: any[];
}

export interface BoardComponent {
  id: string;
  refDes: string; // e.g. "R1", "C2", "DD1"
  name?: string; // e.g. "10k", "0.1uF", "K155LA3"
  side: "top" | "bottom";
  package?: string; // e.g. "0805", "DIP-14", "SOIC-8"
  x?: number;
  y?: number;
  rotation?: number;
  pinned?: boolean;
}

export interface BoardData {
  id: string;
  name: string;
  bgTop: ImageLayerGroup;
  bgBottom: ImageLayerGroup;
  components?: BoardComponent[];
  traces?: any[];
  vias?: any[];
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

export interface RecentProject {
  id: string;
  name: string;
  filePath: string;
  lastOpened: string;
  createdAt: string;
}

export interface RegistrationResult {
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  scaleFactor: number;
}
