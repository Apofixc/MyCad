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
  id: string;
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
  components: any[];
  nets: any[];
}

export interface BoardData {
  id: string;
  name: string;
  bgTop: ImageLayerGroup;
  bgBottom: ImageLayerGroup;
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
