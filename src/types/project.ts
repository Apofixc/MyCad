export interface Pin {
  id: string;        // e.g. "p1", "p2"
  number: number;    // 1, 2, ...
  name?: string;     // e.g. "VCC", "GND", "IN+"
  x: number;         // offset relative to component center in mm/px
  y: number;
  netId?: string;    // e.g. "GND", "NET_12V"
}

export type ComponentType = "resistor" | "capacitor" | "diode" | "ic_soic8" | "ic_dip8" | "testpoint";

export interface ComponentItem {
  id: string;
  refDes: string;     // e.g. "R1", "C5", "U1"
  value: string;      // e.g. "10k", "100nF", "STM32"
  type: ComponentType;
  x: number;          // board canvas position X
  y: number;          // board canvas position Y
  rotation: number;   // 0, 90, 180, 270 degrees
  pins: Pin[];
}

export interface BoardData {
  id: string;
  name: string;       // e.g. "2323.board"
  bgImage?: string;   // data URL or file path for mounting scheme / board photo
  bgOpacity: number;  // 0.0 - 1.0
  bgScale: number;
  bgOffsetX: number;
  bgOffsetY: number;
  components: ComponentItem[];
  selectedComponentId?: string;
  selectedPinId?: string;
}

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

