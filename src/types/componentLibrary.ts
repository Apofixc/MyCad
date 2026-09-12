// src/types/componentLibrary.ts
// Единые типы для библиотеки компонентов, посадочных мест и векторного CAD-редактора
// Строго соответствуют доменным моделям бэкенда Rust (src-tauri/src/cad/footprint.rs и src-tauri/src/library/model.rs)

export type MountType = "smd" | "tht" | "mixed";

export type PadShape =
  | "rect"
  | "rounded_rect"
  | "circle"
  | "oval"
  | "d_shape"
  | "chamfered_rect"
  | "custom_polygon";

export type DrillShape = "round" | "slot";

export type GraphicLayer =
  | "top_silk"
  | "bottom_silk"
  | "top_fab"
  | "bottom_fab"
  | "top_courtyard"
  | "bottom_courtyard";

export interface PackagePad {
  /** Номер или буквенно-цифровой индекс вывода ("1", "2", "A1", "EP", "MH1") */
  padNum: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: PadShape;
  drillDiameter?: number;
  drillShape?: DrillShape;
  slotLength?: number;
  roundRadius?: number;
  plated?: boolean;
  polygonPoints?: [number, number][];
  chamferCorners?: number[];
}

export type GraphicItem =
  | {
      kind: "line";
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      strokeWidth: number;
      layer: GraphicLayer;
    }
  | {
      kind: "arc";
      id: string;
      cx: number;
      cy: number;
      radius: number;
      startAngle: number;
      endAngle: number;
      strokeWidth: number;
      layer: GraphicLayer;
    }
  | {
      kind: "d_shape";
      id: string;
      cx: number;
      cy: number;
      diameter: number;
      cutDepth: number;
      cutOrientation: "top" | "bottom" | "left" | "right";
      strokeWidth: number;
      layer: GraphicLayer;
    }
  | {
      kind: "capsule";
      id: string;
      cx: number;
      cy: number;
      width: number;
      height: number;
      rotation: number;
      strokeWidth: number;
      layer: GraphicLayer;
    }
  | {
      kind: "rect";
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      roundRadius: number;
      rotation: number;
      strokeWidth: number;
      layer: GraphicLayer;
      filled?: boolean;
    }
  | {
      kind: "circle";
      id: string;
      cx: number;
      cy: number;
      radius: number;
      strokeWidth: number;
      layer: GraphicLayer;
      filled?: boolean;
    }
  | {
      kind: "polygon";
      id: string;
      points: [number, number][];
      strokeWidth: number;
      layer: GraphicLayer;
      filled?: boolean;
    }
  | {
      kind: "text";
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      rotation: number;
      strokeWidth: number;
      layer: GraphicLayer;
      align: "center" | "left" | "right";
    };

export type PackageKeyType = "notch" | "dot" | "chamfer" | "stripe" | "none";

export interface PackageVariant {
  id: string;
  name: string;
  bodyColor: string;
  bodyBorderColor?: string;
  keyType: PackageKeyType;
  keyColor?: string;
  silkscreenColor?: string;
  graphics: GraphicItem[];
}

export interface PackageConstraints {
  courtyardWidth: number;
  courtyardHeight: number;
  maxHeight: number;
  hasThermalPad?: boolean;
  thermalPadNum?: string;
  solderMaskMargin?: number;
  pasteMaskMargin?: number;
}

export interface Package3DModel {
  filePath?: string;
  offset?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface PackageDefinition {
  id: string;
  name: string;
  standard?: string;
  family?: string;
  mountType: MountType;
  bodyShape?: string;
  dShapeCut?: string;
  bodyWidth: number;
  bodyHeight: number;
  pitch?: number;
  pads: PackagePad[];
  graphics: GraphicItem[];
  constraints: PackageConstraints;
  defaultVariantId: string;
  variants: PackageVariant[];
  model3d?: Package3DModel;
}

export type PinElectricalType =
  | "passive"
  | "input"
  | "output"
  | "bidirectional"
  | "power_in"
  | "power_out"
  | "ground"
  | "open_collector"
  | "tri_state"
  | "no_connect"
  | "unspecified";

/** Семантическая / функциональная роль вывода (физическая природа сигнала) */
export type PinSignalRole =
  | "passive" // Резисторы, конденсаторы, дроссели, контакты
  | "power" // Силовые шины (VCC, VDD, 5V, 3V3, VBUS)
  | "ground" // Земляные шины (GND, AGND, PGND)
  | "digital" // Цифровые сигналы и шины данных
  | "analog" // Аналоговые цепи (АЦП, ЦАП, ОУ, датчики)
  | "diff_pair" // Дифференциальные пары (USB D+/D-, CAN, Ethernet, LVDS)
  | "rf" // Высокочастотные цепи (антенны, RF, 50 Ом)
  | "clock" // Тактовые линии и кварцевые резонаторы (XTAL, OSC, CLK)
  | "shield" // Экран разъема, корпус, земля шасси
  | "control"; // Управляющие сигналы (~RESET, EN, CS, INT)

export interface LogicalPin {
  id: string;
  name: string;
  electricalType: PinElectricalType;
  pinRole?: PinSignalRole;
  unit?: string;
  description?: string;
  isInverted?: boolean;
  isClock?: boolean;
  swapGroup?: string;
  altFunctions?: string[];
}

export interface PackageMapping {
  packageId: string;
  defaultVariantId?: string;
  pinMap: Record<string, string>;
  /** Расширенное сопоставление 1-к-многим (логический пин -> несколько номеров площадок) */
  multiPinMap?: Record<string, string[]>;
}

export interface ElectricalParameters {
  value?: string;
  tolerance?: string;
  voltageRating?: string;
  powerRating?: string;
  maxCurrent?: string;
  operatingTemp?: string;
  custom?: Record<string, string>;
}

export interface DeviceDefinition {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  designatorPrefix: string;
  description: string;
  datasheet?: string;
  manufacturer?: string;
  mpn?: string;
  tags: string[];
  parameters?: ElectricalParameters;
  isBase?: boolean;
  logicalPins: LogicalPin[];
  supportedPackages: PackageMapping[];
}

export interface PlacedComponent {
  id: string;
  refDes: string;
  deviceId?: string;
  packageId: string;
  variantId?: string;
  selectedVariantId?: string;
  x: number;
  y: number;
  xMm?: number;
  yMm?: number;
  rotation: number;
  rotationDeg?: number;
  layer: "top" | "bottom";
  side?: "top" | "bottom";
  name?: string;
  package?: string;
  value?: string;
  mirrored?: boolean;
  locked?: boolean;
  visible?: boolean;
  showRefDes?: boolean;
  showValue?: boolean;
  refDesOffset?: [number, number];
  packageDef?: PackageDefinition;
  parameters?: ElectricalParameters;
  manufacturer?: string;
  mpn?: string;
  description?: string;
  note?: string;
}

export interface CatalogSubcategory {
  id: string;
  name: string;
  description?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  subcategories: CatalogSubcategory[];
}

export interface ComponentLibraryPayload {
  categories: CatalogCategory[];
  packages: PackageDefinition[];
  devices: DeviceDefinition[];
}
