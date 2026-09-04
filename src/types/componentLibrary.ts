// src/types/componentLibrary.ts
// Архитектура базы данных радиокомпонентов MyCad

export type MountType = "tht" | "smd";
export type PadShape = "circle" | "rect" | "rounded_rect" | "oval";
export type PackageKeyType = "notch" | "dot" | "chamfer" | "stripe" | "none";
export type PackageFamily =
  | "chip_2pin"    // 0805, 1206, 0603, 2512
  | "axial"        // выводные резисторы, диоды
  | "radial"       // электролитические конденсаторы
  | "dip"          // DIP-8, DIP-14, DIP-16, DIP-40...
  | "soic"         // SOIC-8, SOIC-14, SOIC-16...
  | "sot"          // SOT-23, SOT-223, SOT-89
  | "to"           // TO-92, TO-220, TO-247
  | "qfp"          // TQFP-32, LQFP-48...
  | "connector"    // клеммники, разъемы штыревые
  | "switch"       // кнопки, тумблеры
  | "hardware";    // контрольные точки, монтажные отверстия

// ---------------------------------------------------------------------------
// ФИЗИЧЕСКАЯ ЧАСТЬ (PACKAGE / FOOTPRINT)
// ---------------------------------------------------------------------------

// Физическая контактная площадка (Pad)
export interface PackagePad {
  padNum: number;                 // Номер площадки (1, 2, 3...)
  name?: string;                  // Обозначение на шелкографии ("1", "2", "A", "K", "TAB")
  x: number;                      // Смещение X от центра корпуса (в мм)
  y: number;                      // Смещение Y от центра корпуса (в мм)
  width: number;                  // Ширина медной площадки (мм)
  height: number;                 // Высота медной площадки (мм)
  shape: PadShape;                // Форма площадки
  drillDiameter?: number;         // Диаметр отверстия сверления для THT (мм)
  roundRadius?: number;           // Радиус скругления для rounded_rect (мм)
}

// Тепловые и механические ограничения
export interface PackageConstraints {
  courtyardWidth: number;         // Зона запрета пересечений: ширина (мм)
  courtyardHeight: number;        // Зона запрета пересечений: высота (мм)
  maxHeight: number;              // Максимальная высота корпуса над платой (Z, мм)
  hasThermalPad?: boolean;        // Наличие открытого термопада
  thermalPadNum?: number;         // Номер площадки термопада
  thermalResistanceJunctionCase?: number; // Rth_jc (°C/W)
  thermalResistanceJunctionAir?: number;  // Rth_ja (°C/W)
}

// Вариант визуального исполнения корпуса (Package Variant)
export interface PackageVariant {
  id: string;                     // "black_notch", "white_dot", "metal", "blue_axial"
  name: string;                   // "Черный корпус (вырез)", "Белый корпус (точка 1-го вывода)"
  bodyColor: string;              // Цвет тела ("#181f2c", "#f8fafc", "#2563eb", "#d4af37")
  bodyBorderColor?: string;       // Цвет контура корпуса
  keyType: PackageKeyType;        // Тип ключа ориентации
  keyColor?: string;              // Цвет точки/выреза
  hasPolarityMark?: boolean;      // Метка полярности (+ или полоса катода)
  polarityColor?: string;         // Цвет метки полярности
  silkscreenColor?: string;       // Цвет шелкографии
  orientation?: "horizontal" | "vertical"; // Горизонтальный / вертикальный монтаж
}

// 3D представление корпуса
export interface Package3DModel {
  filePath?: string;              // Путь к файлу STEP/OBJ/GLTF
  offset?: [number, number, number];
  rotation?: [number, number, number];
}

// Полная спецификация физического корпуса
export interface PackageDefinition {
  id: string;                     // "PKG_DIP_8", "PKG_SOIC_8", "PKG_0805", "PKG_TO_220_V"
  name: string;                   // "DIP-8 (шаг 2.54мм)", "SMD 0805 (2012)"
  standard?: string;              // "JEDEC MS-001", "IPC-7351"
  family: PackageFamily;
  mountType: MountType;
  bodyWidth: number;              // Ширина тела корпуса (мм)
  bodyHeight: number;             // Длина/высота тела корпуса (мм)
  pitch: number;                  // Шаг выводов (мм)
  pads: PackagePad[];             // Массив физических контактных площадок
  constraints: PackageConstraints;// Тепловые и механические ограничения
  defaultVariantId: string;       // Вариант исполнения по умолчанию
  variants: PackageVariant[];     // Доступные варианты исполнения (цвета, ключи)
  model3d?: Package3DModel;       // Параметры 3D
}

// ---------------------------------------------------------------------------
// ЭЛЕКТРИЧЕСКАЯ / ЛОГИЧЕСКАЯ ЧАСТЬ (DEVICE / SYMBOL)
// ---------------------------------------------------------------------------

// Электрический тип вывода
export type PinElectricalType =
  | "input"           // Входной сигнал
  | "output"          // Выходной сигнал
  | "bidirectional"   // Двунаправленный (GPIO, шина данных)
  | "power_in"        // Вход питания (VCC, VDD, 5V, 12V)
  | "power_out"       // Выход питания (VOUT, LDO)
  | "ground"          // Земля / общий (GND, VSS)
  | "passive"         // Пассивный вывод (резисторы, конденсаторы, катушки, диоды)
  | "open_collector"  // Открытый коллектор / открытый сток
  | "no_connect";     // Не подключен (NC)

// Логический вывод компонента
export interface LogicalPin {
  id: string;                     // Уникальный ID пина ("1", "2" или "IN+", "OUT", "VCC")
  name: string;                   // Читаемое обозначение ("1", "2", "IN+", "VCC", "GND", "RESET")
  electricalType: PinElectricalType;
  unit?: string;                  // Секция / вентиль ("Unit A", "Unit B", "Power")
  description?: string;           // Описание функции ("Неинвертирующий вход ОУ 1")
}

// Привязка логических выводов девайса к физическому корпусу (Pin-to-Pad Mapping)
export interface PackageMapping {
  packageId: string;              // Ссылка на ID корпуса из библиотеки корпусов
  defaultVariantId?: string;      // Вариант исполнения корпуса по умолчанию
  pinMap: Record<string, number>; // logicalPin.id -> physical padNum на корпусе
}

// Электрические параметры компонента
export interface ElectricalParameters {
  value?: string;                 // Номинал ("10k", "100nF", "1N4148", "TL072CN", "STM32F103")
  tolerance?: string;             // Допуск ("1%", "5%", "10%")
  voltageRating?: string;         // Рабочее напряжение ("50V", "16V", "400V")
  powerRating?: string;           // Мощность ("0.125W", "0.25W", "1W")
  maxCurrent?: string;            // Максимальный ток ("1A", "100mA")
  operatingTemp?: string;         // Рабочий диапазон температур ("-40°C...+85°C")
  custom?: Record<string, string>;// Пользовательские характеристики (key-value)
}

// Единая универсальная сущность радиодетали
export interface DeviceDefinition {
  id: string;                     // Уникальный ID ("DEV_RES", "DEV_CAP", "DEV_TL072", "DEV_NE555")
  name: string;                   // "Резистор постоянный", "TL072CN (Сдвоенный ОУ)", "Таймер 555"
  category: string;               // ID категории верхнего уровня ("passives", "semiconductors", "ics"...)
  subcategory: string;            // ID подкатегории ("resistors", "capacitors", "opamps"...)
  designatorPrefix: string;       // Префикс позиционного обозначения по ГОСТ ("R", "C", "DA", "DD", "VT", "VD"...)
  description: string;            // Описание функционала, схемотехнические заметки
  datasheet?: string;             // Ссылка на документацию (URL или файл)
  tags: string[];                 // Ключевые слова для поиска
  parameters: ElectricalParameters;
  logicalPins: LogicalPin[];      // Все логические выводы устройства
  supportedPackages: PackageMapping[]; // Поддерживаемые корпуса с таблицами привязки вывода к площадке
}

// ---------------------------------------------------------------------------
// ИЕРАРХИЧЕСКИЙ КАТАЛОГ (CATALOG CATEGORIES)
// ---------------------------------------------------------------------------

export interface CatalogSubcategory {
  id: string;
  name: string;
  description?: string;
}

export interface CatalogCategory {
  id: string;
  name: string;
  icon?: string;                  // Emoji или имя иконки lucide
  description?: string;
  subcategories: CatalogSubcategory[];
}

// Payload полной библиотеки для загрузки и сохранения
export interface ComponentLibraryPayload {
  categories: CatalogCategory[];
  packages: PackageDefinition[];
  devices: DeviceDefinition[];
}
