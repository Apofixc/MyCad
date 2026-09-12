// src/components/Modals/DeviceEditorModal.tsx
// Модальное окно создания и редактирования радиокомпонента (Device / Component)
// Управление логическими выводами схемы, спецификацией BOM, электрическими параметрами и сопоставлением Pin-to-Pad Mapping

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DeviceDefinition,
  PackageDefinition,
  LogicalPin,
  PinElectricalType,
  PackageMapping,
} from "../../types/componentLibrary";
import {
  X,
  Save,
  Plus,
  Trash2,
  Cpu,
  Box,
  ArrowRight,
  ArrowRightLeft,
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  ExternalLink,
  Tag,
  Star,
  ArrowUpDown,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  ListPlus,
  Copy,
  ChevronUp,
  ChevronDown,
  Check,
  RefreshCw,
  FileText,
  Download,
} from "lucide-react";
import { FootprintPreview } from "../SvgRenderer/FootprintPreview";

interface DeviceEditorModalProps {
  isOpen: boolean;
  initialDevice?: DeviceDefinition | null;
  availablePackages: PackageDefinition[];
  onClose: () => void;
  onSave: (device: DeviceDefinition) => void;
  onCreateNewPackage?: () => void;
}

interface ElectricalTypeConfig {
  value: PinElectricalType;
  label: string;
  shortLabel: string;
  color: string;
}

const ELECTRICAL_TYPES: ElectricalTypeConfig[] = [
  { value: "power_in", label: "Питание (Power In)", shortLabel: "Питание", color: "#ef4444" },
  { value: "ground", label: "Земля (Ground/GND)", shortLabel: "Земля", color: "#10b981" },
  { value: "input", label: "Вход (Input)", shortLabel: "Вход", color: "#3b82f6" },
  { value: "output", label: "Выход (Output)", shortLabel: "Выход", color: "#f59e0b" },
  { value: "bidirectional", label: "Двунаправл. (I/O)", shortLabel: "Двунапр.", color: "#8b5cf6" },
  { value: "passive", label: "Пассивный (Passive)", shortLabel: "Пассив.", color: "#94a3b8" },
  { value: "power_out", label: "Выход пит. (Pwr Out)", shortLabel: "Вых.пит.", color: "#ec4899" },
  { value: "open_collector", label: "Откр. коллектор (OC)", shortLabel: "ОК", color: "#d97706" },
  { value: "no_connect", label: "Не подключен (NC)", shortLabel: "NC", color: "#64748b" },
];

interface TaxonomySubcategory {
  id: string;
  name: string;
  defaultPrefix: string;
}

interface TaxonomyCategory {
  id: string;
  name: string;
  defaultPrefix: string;
  subcategories: TaxonomySubcategory[];
}

export const COMPONENT_TAXONOMY: TaxonomyCategory[] = [
  {
    id: "passives",
    name: "Пассивные компоненты",
    defaultPrefix: "R",
    subcategories: [
      { id: "resistors", name: "Резисторы и триммеры", defaultPrefix: "R" },
      { id: "capacitors", name: "Конденсаторы", defaultPrefix: "C" },
      { id: "inductors", name: "Индуктивности и дроссели", defaultPrefix: "L" },
      { id: "protection", name: "Защита цепей (предохранители, варисторы)", defaultPrefix: "FU" },
    ],
  },
  {
    id: "semiconductors",
    name: "Полупроводники (Дискретные)",
    defaultPrefix: "VD",
    subcategories: [
      { id: "diodes", name: "Диоды и выпрямители", defaultPrefix: "VD" },
      { id: "transistors", name: "Транзисторы (BJT, MOSFET, IGBT)", defaultPrefix: "VT" },
      { id: "thyristors", name: "Тиристоры и симисторы", defaultPrefix: "VS" },
      { id: "zener_tvs", name: "Стабилитроны и защитные диоды (TVS)", defaultPrefix: "VD" },
    ],
  },
  {
    id: "ics",
    name: "Интегральные микросхемы (IC)",
    defaultPrefix: "U",
    subcategories: [
      { id: "opamps", name: "Операционные усилители и компараторы", defaultPrefix: "DA" },
      { id: "timers_pwm", name: "Таймеры и ШИМ-контроллеры", defaultPrefix: "DA" },
      { id: "logic", name: "Цифровая логика 74xx / 40xx", defaultPrefix: "DD" },
      { id: "interfaces", name: "Интерфейсы и драйверы (RS-485, CAN, USB)", defaultPrefix: "DA" },
      { id: "memory", name: "Память EEPROM / Flash / SRAM", defaultPrefix: "DD" },
    ],
  },
  {
    id: "mcu",
    name: "Микроконтроллеры, DSP и ПЛИС",
    defaultPrefix: "U",
    subcategories: [
      { id: "wifi_bt", name: "Модули Wi-Fi / Bluetooth (ESP, NRF)", defaultPrefix: "U" },
      { id: "arm_cortex", name: "Микроконтроллеры ARM Cortex (STM32, RP2040)", defaultPrefix: "DD" },
      { id: "avr", name: "Микроконтроллеры 8-бит (AVR, PIC)", defaultPrefix: "DD" },
      { id: "fpga", name: "ПЛИС, FPGA и CPLD", defaultPrefix: "DD" },
      { id: "dev_boards", name: "Отладочные платы и модули", defaultPrefix: "MOD" },
    ],
  },
  {
    id: "power",
    name: "Источники и управление питанием",
    defaultPrefix: "DA",
    subcategories: [
      { id: "ldo", name: "Линейные стабилизаторы (LDO)", defaultPrefix: "DA" },
      { id: "dcdc", name: "Импульсные DC-DC преобразователи", defaultPrefix: "DA" },
      { id: "chargers", name: "Контроллеры заряда Li-Ion (BMS)", defaultPrefix: "DA" },
      { id: "holders", name: "Держатели батарей и элементы", defaultPrefix: "GB" },
    ],
  },
  {
    id: "connectors",
    name: "Разъемы и соединители",
    defaultPrefix: "XP",
    subcategories: [
      { id: "headers", name: "Штыревые линейки (Pin Header)", defaultPrefix: "XP" },
      { id: "terminals", name: "Винтовые и пружинные клеммники", defaultPrefix: "XT" },
      { id: "usb_ports", name: "USB порты (Type-C, Micro)", defaultPrefix: "XS" },
      { id: "dc_power", name: "Разъемы питания (DC Jack)", defaultPrefix: "XS" },
      { id: "audio_signal", name: "Аудио и сигнальные порты (RJ45, Jack 3.5)", defaultPrefix: "XS" },
    ],
  },
  {
    id: "switches",
    name: "Коммутация и электромеханика",
    defaultPrefix: "SW",
    subcategories: [
      { id: "buttons", name: "Тактовые кнопки", defaultPrefix: "SW" },
      { id: "relays", name: "Реле электромагнитные и твердотельные", defaultPrefix: "K" },
      { id: "toggles", name: "Тумблеры и DIP-переключатели", defaultPrefix: "SA" },
      { id: "encoders", name: "Энкодеры поворотные", defaultPrefix: "SW" },
    ],
  },
  {
    id: "opto",
    name: "Оптоэлектроника и индикация",
    defaultPrefix: "HL",
    subcategories: [
      { id: "leds", name: "Светодиоды (SMD / THT)", defaultPrefix: "HL" },
      { id: "addressable_leds", name: "Адресные светодиоды (WS2812)", defaultPrefix: "HL" },
      { id: "displays", name: "Дисплеи (OLED, LCD 1602)", defaultPrefix: "HG" },
      { id: "seven_segment", name: "Семисегментные индикаторы", defaultPrefix: "HG" },
      { id: "optocouplers", name: "Оптопары и оптореле", defaultPrefix: "VU" },
    ],
  },
  {
    id: "sensors",
    name: "Датчики и сенсоры",
    defaultPrefix: "BK",
    subcategories: [
      { id: "temp_humidity", name: "Температура и влажность (DHT, DS18B20)", defaultPrefix: "BK" },
      { id: "pressure_baro", name: "Давление и барометры (BMP280)", defaultPrefix: "BK" },
      { id: "imu", name: "Акселерометры и IMU (MPU6050)", defaultPrefix: "BK" },
      { id: "current_voltage", name: "Ток и напряжение (ACS712, INA219)", defaultPrefix: "DA" },
      { id: "optical_magnetic", name: "Оптические датчики и датчики Холла", defaultPrefix: "BL" },
    ],
  },
  {
    id: "crystals",
    name: "Кварцы и тактирование",
    defaultPrefix: "ZQ",
    subcategories: [
      { id: "crystals_mhz", name: "Кварцевые резонаторы (MHz)", defaultPrefix: "ZQ" },
      { id: "crystals_watch", name: "Часовые кварцы (32.768 kHz)", defaultPrefix: "ZQ" },
      { id: "oscillators", name: "Активные генераторы (OSC, TCXO)", defaultPrefix: "G" },
    ],
  },
  {
    id: "audio",
    name: "Акустика и звук",
    defaultPrefix: "HA",
    subcategories: [
      { id: "buzzers", name: "Пьезозуммеры (Buzzer 5V/12V)", defaultPrefix: "HA" },
      { id: "speakers", name: "Динамики миниатюрные", defaultPrefix: "BA" },
      { id: "microphones", name: "Микрофоны (Электретные, MEMS)", defaultPrefix: "BM" },
    ],
  },
  {
    id: "rf_wireless",
    name: "ВЧ, СВЧ и беспроводная связь",
    defaultPrefix: "WA",
    subcategories: [
      { id: "antennas", name: "Антенны (Chip, PCB, SMA)", defaultPrefix: "WA" },
      { id: "rf_modules", name: "Радиомодули (LoRa, GNSS/GPS, LTE)", defaultPrefix: "MOD" },
      { id: "rf_filters", name: "ВЧ фильтры и балуны (SAW, Balun)", defaultPrefix: "ZF" },
      { id: "rf_amps", name: "ВЧ усилители (LNA, PA)", defaultPrefix: "DA" },
    ],
  },
  {
    id: "transformers",
    name: "Трансформаторы и моточные узлы",
    defaultPrefix: "T",
    subcategories: [
      { id: "pulse_trans", name: "Импульсные трансформаторы (Flyback)", defaultPrefix: "T" },
      { id: "mains_trans", name: "Сетевые трансформаторы 50/60 Гц", defaultPrefix: "T" },
      { id: "current_trans", name: "Токовые трансформаторы", defaultPrefix: "TA" },
      { id: "lan_magnetics", name: "Ethernet LAN Magnetics", defaultPrefix: "T" },
    ],
  },
  {
    id: "emi_filtering",
    name: "ЭМС и фильтрация помех (EMI/RFI)",
    defaultPrefix: "L",
    subcategories: [
      { id: "chokes", name: "Синфазные дроссели (Common Mode)", defaultPrefix: "L" },
      { id: "ferrite", name: "Ферритовые бусины (Ferrite Beads)", defaultPrefix: "FB" },
      { id: "filters", name: "Сетевые фильтры ЭМС", defaultPrefix: "FL" },
    ],
  },
  {
    id: "modules",
    name: "Модули и мезонины",
    defaultPrefix: "MOD",
    subcategories: [
      { id: "functional", name: "Готовые функциональные модули", defaultPrefix: "MOD" },
      { id: "mezzanine", name: "Мезонинные платы", defaultPrefix: "A" },
    ],
  },
  {
    id: "mechanical",
    name: "Служебные, крепеж и механика",
    defaultPrefix: "MH",
    subcategories: [
      { id: "holes", name: "Крепежные отверстия", defaultPrefix: "MH" },
      { id: "testpoints", name: "Контрольные точки (Testpoint)", defaultPrefix: "TP" },
      { id: "heatsinks", name: "Радиаторы охлаждения", defaultPrefix: "HS" },
    ],
  },
];

export const DeviceEditorModal: React.FC<DeviceEditorModalProps> = ({
  isOpen,
  initialDevice,
  availablePackages,
  onClose,
  onSave,
  onCreateNewPackage,
}) => {
  // Активная вкладка в верхней карточке (Основные & BOM / Электропараметры)
  const [activeSubTab, setActiveSubTab] = useState<"info" | "specs">("info");

  // Идентификация и метаданные
  const [id, setId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<string>("Пассивные компоненты");
  const [subcategory, setSubcategory] = useState<string>("Резисторы и триммеры");
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [isCustomSubcategory, setIsCustomSubcategory] = useState<boolean>(false);
  const [designatorPrefix, setDesignatorPrefix] = useState<string>("R");
  const [description, setDescription] = useState<string>("");
  const [datasheet, setDatasheet] = useState<string>("");
  const [manufacturer, setManufacturer] = useState<string>("");
  const [mpn, setMpn] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");

  // Электрические параметры
  const [paramValue, setParamValue] = useState<string>("");
  const [tolerance, setTolerance] = useState<string>("");
  const [voltageRating, setVoltageRating] = useState<string>("");
  const [powerRating, setPowerRating] = useState<string>("");
  const [maxCurrent, setMaxCurrent] = useState<string>("");
  const [operatingTemp, setOperatingTemp] = useState<string>("");
  const [customParams, setCustomParams] = useState<Array<{ key: string; value: string }>>([]);

  // Логические выводы схемы
  const [logicalPins, setLogicalPins] = useState<LogicalPin[]>([]);

  // Тип компонента: Базовый (Generic / Шаблон) vs Конкретный (Фиксированный)
  const [isBase, setIsBase] = useState<boolean>(false);

  // Поддерживаемые корпуса и маппинг
  const [supportedPackages, setSupportedPackages] = useState<PackageMapping[]>([]);
  const [activePackageId, setActivePackageId] = useState<string>("");

  // Выделение и интерактивность сопоставления
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [activePadNum, setActivePadNum] = useState<string | null>(null);
  const [pinSearchQuery, setPinSearchQuery] = useState<string>("");
  const [pinUnitFilter, setPinUnitFilter] = useState<string>("all");

  // Вкладка левой панели: "properties" (Параметры и BOM) или "pins" (Выводы схемы)
  const [activeLeftTab, setActiveLeftTab] = useState<"properties" | "pins">("properties");
  const [quickPinName, setQuickPinName] = useState<string>("");

  // Визуальный диалог добавления корпуса из библиотеки
  const [isPkgPickerOpen, setIsPkgPickerOpen] = useState<boolean>(false);
  const [pkgPickerSearch, setPkgPickerSearch] = useState<string>("");
  const [pkgPickerMountFilter, setPkgPickerMountFilter] = useState<"all" | "smd" | "tht">("all");

  // Пакетный генератор выводов
  const [isPinGenOpen, setIsPinGenOpen] = useState<boolean>(false);
  const [pinGenMode, setPinGenMode] = useState<"range" | "list">("range");
  const [pinGenPrefix, setPinGenPrefix] = useState<string>("D");
  const [pinGenStart, setPinGenStart] = useState<number>(0);
  const [pinGenEnd, setPinGenEnd] = useState<number>(7);
  const [pinGenList, setPinGenList] = useState<string>("VCC, GND, IN, OUT");
  const [pinGenType, setPinGenType] = useState<PinElectricalType>("passive");
  const [pinGenUnit, setPinGenUnit] = useState<string>("");

  // Мультивыбор выводов для групповых операций
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set());

  // Массовый импорт таблицы выводов из буфера обмена (Datasheet / TSV / CSV)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState<boolean>(false);
  const [bulkImportText, setBulkImportText] = useState<string>("");
  const [bulkImportMode, setBulkImportMode] = useState<"append" | "replace">("append");

  // Фильтрация и интерактивность сопоставления
  const [mappingFilter, setMappingFilter] = useState<"all" | "unmapped" | "conflicts">("all");
  const [mappingSearchQuery, setMappingSearchQuery] = useState<string>("");
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState<boolean>(true);

  // Кэш сопоставления pinId -> padNum для защиты от потери связей при промежуточной очистке имени вывода
  const pinIdToPadCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isOpen) return;

    if (initialDevice) {
      setId(initialDevice.id);
      setName(initialDevice.name);
      setIsBase(Boolean(initialDevice.isBase));

      const initCat = initialDevice.category || "Интегральные микросхемы (IC)";
      const initSub = initialDevice.subcategory || "";
      setCategory(initCat);
      setSubcategory(initSub);

      const catMatch = COMPONENT_TAXONOMY.find((c) => c.name === initCat);
      setIsCustomCategory(!catMatch);
      const subMatch = catMatch?.subcategories.find((s) => s.name === initSub);
      setIsCustomSubcategory(!subMatch && !catMatch);

      setDesignatorPrefix(initialDevice.designatorPrefix || "U");
      setDescription(initialDevice.description || "");
      setDatasheet(initialDevice.datasheet || "");
      setManufacturer(initialDevice.manufacturer || "");
      setMpn(initialDevice.mpn || "");
      setTags(initialDevice.tags || []);
      setTagInput("");

      // Электропараметры
      if (initialDevice.isBase) {
        setParamValue("");
        setTolerance("");
        setVoltageRating("");
        setPowerRating("");
        setMaxCurrent("");
        setOperatingTemp("");
        setCustomParams([]);
      } else {
        setParamValue(initialDevice.parameters?.value || "");
        setTolerance(initialDevice.parameters?.tolerance || "");
        setVoltageRating(initialDevice.parameters?.voltageRating || "");
        setPowerRating(initialDevice.parameters?.powerRating || "");
        setMaxCurrent(initialDevice.parameters?.maxCurrent || "");
        setOperatingTemp(initialDevice.parameters?.operatingTemp || "");
        setCustomParams(
          Object.entries(initialDevice.parameters?.custom || {}).map(([k, v]) => ({
            key: k,
            value: v,
          }))
        );
      }

      setLogicalPins(initialDevice.logicalPins || []);
      setSupportedPackages(initialDevice.supportedPackages || []);
      setActivePackageId(
        initialDevice.supportedPackages?.[0]?.packageId ||
          availablePackages[0]?.id ||
          ""
      );
    } else {
      const newId = `dev_${Date.now()}`;
      setId(newId);
      setName("Новый компонент");
      setIsBase(false);

      const defCat = COMPONENT_TAXONOMY[0];
      const defSub = defCat.subcategories[0];
      setCategory(defCat.name);
      setSubcategory(defSub.name);
      setDesignatorPrefix(defSub.defaultPrefix);
      setIsCustomCategory(false);
      setIsCustomSubcategory(false);
      setDescription("");
      setDatasheet("");
      setManufacturer("");
      setMpn("");
      setTags([]);
      setTagInput("");

      setParamValue("");
      setTolerance("");
      setVoltageRating("");
      setPowerRating("");
      setMaxCurrent("");
      setOperatingTemp("");
      setCustomParams([]);

      // По умолчанию для пассивных 2-выводных компонентов — пины 1 и 2
      setLogicalPins([
        { id: "pin_1", name: "1", electricalType: "passive", description: "Вывод 1" },
        { id: "pin_2", name: "2", electricalType: "passive", description: "Вывод 2" },
      ]);
      const firstPkg = availablePackages[0];
      if (firstPkg) {
        setSupportedPackages([
          {
            packageId: firstPkg.id,
            defaultVariantId: firstPkg.defaultVariantId,
            pinMap: {
              "1": firstPkg.pads[0]?.padNum || "1",
              "2": firstPkg.pads[1]?.padNum || "2",
            },
          },
        ]);
        setActivePackageId(firstPkg.id);
      } else {
        setSupportedPackages([]);
        setActivePackageId("");
      }
    }
  }, [isOpen, initialDevice, availablePackages]);

  // Пресеты распиновки для сложных полупроводников и базовых компонентов
  const applyPinPreset = (presetKey: string) => {
    switch (presetKey) {
      case "rlc":
        setLogicalPins([
          { id: `pin_${Date.now()}_1`, name: "1", electricalType: "passive", description: "Вывод 1" },
          { id: `pin_${Date.now()}_2`, name: "2", electricalType: "passive", description: "Вывод 2" },
        ]);
        break;
      case "diode":
        setLogicalPins([
          { id: `pin_${Date.now()}_a`, name: "A", electricalType: "passive", description: "Анод" },
          { id: `pin_${Date.now()}_k`, name: "K", electricalType: "passive", description: "Катод" },
        ]);
        break;
      case "bjt_npn":
      case "bjt_pnp":
        setLogicalPins([
          { id: `pin_${Date.now()}_b`, name: "B", electricalType: "input", description: "База (Base)" },
          { id: `pin_${Date.now()}_c`, name: "C", electricalType: "output", description: "Коллектор (Collector)" },
          { id: `pin_${Date.now()}_e`, name: "E", electricalType: "passive", description: "Эмиттер (Emitter)" },
        ]);
        break;
      case "mosfet_n":
      case "mosfet_p":
        setLogicalPins([
          { id: `pin_${Date.now()}_g`, name: "G", electricalType: "input", description: "Затвор (Gate)" },
          { id: `pin_${Date.now()}_d`, name: "D", electricalType: "output", description: "Сток (Drain)" },
          { id: `pin_${Date.now()}_s`, name: "S", electricalType: "passive", description: "Исток (Source)" },
        ]);
        break;
      case "ldo3":
        setLogicalPins([
          { id: `pin_${Date.now()}_in`, name: "VIN", electricalType: "power_in", description: "Вход (VIN)" },
          { id: `pin_${Date.now()}_out`, name: "VOUT", electricalType: "power_out", description: "Выход (VOUT)" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Общий (GND/ADJ)" },
        ]);
        break;
      case "opamp_single":
        setLogicalPins([
          { id: `pin_${Date.now()}_inp`, name: "IN+", electricalType: "input", description: "Неинвертирующий вход +" },
          { id: `pin_${Date.now()}_inm`, name: "IN-", electricalType: "input", description: "Инвертирующий вход -" },
          { id: `pin_${Date.now()}_out`, name: "OUT", electricalType: "output", description: "Выход ОУ" },
          { id: `pin_${Date.now()}_vp`, name: "V+", electricalType: "power_in", description: "Питание V+" },
          { id: `pin_${Date.now()}_vm`, name: "V-", electricalType: "power_in", description: "Питание V- / GND" },
        ]);
        break;
      case "opamp_dual":
        setLogicalPins([
          { id: `pin_${Date.now()}_1inp`, name: "1IN+", electricalType: "input", unit: "A", description: "Вход + (Unit A)" },
          { id: `pin_${Date.now()}_1inm`, name: "1IN-", electricalType: "input", unit: "A", description: "Вход - (Unit A)" },
          { id: `pin_${Date.now()}_1out`, name: "1OUT", electricalType: "output", unit: "A", description: "Выход (Unit A)" },
          { id: `pin_${Date.now()}_2inp`, name: "2IN+", electricalType: "input", unit: "B", description: "Вход + (Unit B)" },
          { id: `pin_${Date.now()}_2inm`, name: "2IN-", electricalType: "input", unit: "B", description: "Вход - (Unit B)" },
          { id: `pin_${Date.now()}_2out`, name: "2OUT", electricalType: "output", unit: "B", description: "Выход (Unit B)" },
          { id: `pin_${Date.now()}_vcc`, name: "VCC", electricalType: "power_in", description: "Питание VCC" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Земля GND" },
        ]);
        break;
      case "header_1x4":
        setLogicalPins([
          { id: `pin_${Date.now()}_1`, name: "1", electricalType: "passive", description: "Контакт 1" },
          { id: `pin_${Date.now()}_2`, name: "2", electricalType: "passive", description: "Контакт 2" },
          { id: `pin_${Date.now()}_3`, name: "3", electricalType: "passive", description: "Контакт 3" },
          { id: `pin_${Date.now()}_4`, name: "4", electricalType: "passive", description: "Контакт 4" },
        ]);
        break;
      case "pwr_logic":
        setLogicalPins([
          { id: `pin_${Date.now()}_vcc`, name: "VCC", electricalType: "power_in", description: "Питание VCC" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Общий GND" },
          { id: `pin_${Date.now()}_in`, name: "IN", electricalType: "input", description: "Входной сигнал" },
          { id: `pin_${Date.now()}_out`, name: "OUT", electricalType: "output", description: "Выходной сигнал" },
        ]);
        break;
      case "i2c_eeprom":
        setLogicalPins([
          { id: `pin_${Date.now()}_a0`, name: "A0", electricalType: "input", description: "Адресный вход A0" },
          { id: `pin_${Date.now()}_a1`, name: "A1", electricalType: "input", description: "Адресный вход A1" },
          { id: `pin_${Date.now()}_a2`, name: "A2", electricalType: "input", description: "Адресный вход A2" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Общий провод GND" },
          { id: `pin_${Date.now()}_sda`, name: "SDA", electricalType: "bidirectional", description: "Линия данных I2C SDA" },
          { id: `pin_${Date.now()}_scl`, name: "SCL", electricalType: "input", isClock: true, description: "Тактирование I2C SCL" },
          { id: `pin_${Date.now()}_wp`, name: "WP", electricalType: "input", isInverted: true, description: "Защита записи ~WP" },
          { id: `pin_${Date.now()}_vcc`, name: "VCC", electricalType: "power_in", description: "Питание VCC" },
        ]);
        break;
      case "spi_flash":
        setLogicalPins([
          { id: `pin_${Date.now()}_cs`, name: "CS#", electricalType: "input", isInverted: true, description: "Выбор чипа ~CS" },
          { id: `pin_${Date.now()}_so`, name: "SO", electricalType: "output", description: "Данные MISO/SO" },
          { id: `pin_${Date.now()}_wp`, name: "WP#", electricalType: "input", isInverted: true, description: "Защита записи ~WP" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Общий GND" },
          { id: `pin_${Date.now()}_si`, name: "SI", electricalType: "input", description: "Данные MOSI/SI" },
          { id: `pin_${Date.now()}_sck`, name: "SCK", electricalType: "input", isClock: true, description: "Тактирование SPI SCK" },
          { id: `pin_${Date.now()}_hold`, name: "HOLD#", electricalType: "input", isInverted: true, description: "Удержание ~HOLD" },
          { id: `pin_${Date.now()}_vcc`, name: "VCC", electricalType: "power_in", description: "Питание VCC" },
        ]);
        break;
      case "dcdc_buck":
        setLogicalPins([
          { id: `pin_${Date.now()}_vin`, name: "VIN", electricalType: "power_in", description: "Входное напряжение" },
          { id: `pin_${Date.now()}_en`, name: "EN", electricalType: "input", description: "Включение Enable" },
          { id: `pin_${Date.now()}_boot`, name: "BOOT", electricalType: "passive", description: "Вольтодобавка Bootstrap" },
          { id: `pin_${Date.now()}_sw`, name: "SW", electricalType: "output", description: "Ключевая точка Switch" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Силовая и сигнальная земля" },
          { id: `pin_${Date.now()}_fb`, name: "FB", electricalType: "input", description: "Обратная связь Feedback" },
          { id: `pin_${Date.now()}_comp`, name: "COMP", electricalType: "passive", description: "Коррекция компенсации" },
          { id: `pin_${Date.now()}_vout`, name: "VOUT", electricalType: "power_out", description: "Выход стабилизатора" },
        ]);
        break;
      case "swd_header":
        setLogicalPins([
          { id: `pin_${Date.now()}_vcc`, name: "VCC", electricalType: "power_in", description: "Опорное питание VCC" },
          { id: `pin_${Date.now()}_swdio`, name: "SWDIO", electricalType: "bidirectional", description: "Данные SWD IO" },
          { id: `pin_${Date.now()}_swclk`, name: "SWCLK", electricalType: "input", isClock: true, description: "Тактирование SWD CLK" },
          { id: `pin_${Date.now()}_gnd`, name: "GND", electricalType: "ground", description: "Общий провод GND" },
          { id: `pin_${Date.now()}_nrst`, name: "NRST", electricalType: "output", isInverted: true, description: "Аппаратный сброс ~RESET" },
        ]);
        break;
    }
  };

  const currentPkgDef = availablePackages.find((p) => p.id === activePackageId);
  const currentMapping = supportedPackages.find((m) => m.packageId === activePackageId);

  // Синхронизация кэша pinId -> padNum для защиты от потери привязок при переименовании
  useEffect(() => {
    if (!currentMapping) return;
    logicalPins.forEach((pin) => {
      const padNum = currentMapping.pinMap[pin.name];
      if (padNum) {
        pinIdToPadCacheRef.current.set(pin.id, padNum);
      }
    });
  }, [currentMapping, logicalPins]);

  // Список всех уникальных секций схемы (Units: A, B, C...)
  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    logicalPins.forEach((p) => {
      if (p.unit && p.unit.trim()) set.add(p.unit.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [logicalPins]);

  // Фильтрация выводов по поисковому запросу и выбранной секции схемы
  const filteredLogicalPins = useMemo(() => {
    return logicalPins.filter((p) => {
      if (pinUnitFilter !== "all") {
        if ((p.unit || "").toUpperCase() !== pinUnitFilter) return false;
      }
      if (pinSearchQuery.trim()) {
        const q = pinSearchQuery.trim().toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = (p.description || "").toLowerCase().includes(q);
        const matchesType = p.electricalType.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesType) return false;
      }
      return true;
    });
  }, [logicalPins, pinUnitFilter, pinSearchQuery]);

  // Детектор дубликатов имен выводов (предупреждение при двух одинаковых именах)
  const duplicatePinNames = useMemo(() => {
    const counts: Record<string, number> = {};
    logicalPins.forEach((p) => {
      const n = p.name.trim().toUpperCase();
      if (n) counts[n] = (counts[n] || 0) + 1;
    });
    const dupes = new Set<string>();
    Object.entries(counts).forEach(([k, v]) => {
      if (v > 1) dupes.add(k);
    });
    return dupes;
  }, [logicalPins]);

  // Статистика использования контактных площадок текущего корпуса (детектор конфликтов)
  const padUsageCount = useMemo(() => {
    const counts: Record<string, string[]> = {};
    if (!currentMapping) return counts;
    Object.entries(currentMapping.pinMap).forEach(([pinName, padNum]) => {
      if (!padNum) return;
      if (!counts[padNum]) counts[padNum] = [];
      counts[padNum].push(pinName);
    });
    return counts;
  }, [currentMapping]);

  // Свободные (не сопоставленные) площадки текущего корпуса
  const unassignedPads = useMemo(() => {
    if (!currentPkgDef || !currentMapping) return [];
    const usedPadNums = new Set(Object.values(currentMapping.pinMap).filter(Boolean));
    return currentPkgDef.pads.filter((p) => !usedPadNums.has(p.padNum));
  }, [currentPkgDef, currentMapping]);

  // Полнота сопоставления текущего корпуса
  const mappingCoverage = useMemo(() => {
    if (!currentMapping || logicalPins.length === 0) {
      return { mapped: 0, total: 0, percent: 0, unassignedPadCount: 0, isFullyReady: false };
    }
    const mappedCount = logicalPins.filter((p) => Boolean(currentMapping.pinMap[p.name])).length;
    const unassignedPadCount = unassignedPads.length;
    const isFullyReady = mappedCount === logicalPins.length && unassignedPadCount === 0;
    return {
      mapped: mappedCount,
      total: logicalPins.length,
      percent: Math.round((mappedCount / logicalPins.length) * 100),
      unassignedPadCount,
      isFullyReady,
    };
  }, [currentMapping, logicalPins, unassignedPads]);

  // Оценка готовности распиновки для каждого привязанного корпуса
  const getPackageReadiness = (pkgMapping: PackageMapping) => {
    const pkgDef = availablePackages.find((p) => p.id === pkgMapping.packageId);
    const padCount = pkgDef?.pads.length || 0;
    if (logicalPins.length === 0) {
      return { mapped: 0, total: 0, padCount, unassignedPadCount: padCount, isComplete: false };
    }
    const mapped = logicalPins.filter((p) => Boolean(pkgMapping.pinMap[p.name])).length;
    const usedPads = new Set(Object.values(pkgMapping.pinMap).filter(Boolean));
    const unassignedPadCount = Math.max(0, padCount - usedPads.size);
    const isComplete = mapped === logicalPins.length && unassignedPadCount === 0;
    return {
      mapped,
      total: logicalPins.length,
      padCount,
      unassignedPadCount,
      isComplete,
    };
  };

  // Вычисление меток сигналов и цветов для контактных площадок футпринта
  const { padLabels, padColors, unassignedPadNums } = useMemo(() => {
    const labels: Record<string, string> = {};
    const colors: Record<string, string> = {};
    const unassigned = new Set<string>();

    if (!currentPkgDef) return { padLabels: labels, padColors: colors, unassignedPadNums: unassigned };

    if (currentMapping) {
      Object.entries(currentMapping.pinMap).forEach(([pinName, padNum]) => {
        if (padNum) {
          labels[padNum] = pinName;
          const found = logicalPins.find((p) => p.name === pinName);
          if (found) {
            const cfg = ELECTRICAL_TYPES.find((t) => t.value === found.electricalType);
            if (cfg) colors[padNum] = cfg.color;
          }
        }
      });
    }

    currentPkgDef.pads.forEach((p) => {
      if (!labels[p.padNum]) unassigned.add(p.padNum);
    });

    return { padLabels: labels, padColors: colors, unassignedPadNums: unassigned };
  }, [currentPkgDef, currentMapping, logicalPins]);

  // Фильтрация таблицы сопоставления по статусу привязки и поисковому запросу
  const mappingFilteredPins = useMemo(() => {
    return filteredLogicalPins.filter((pin) => {
      const assignedPad = currentMapping?.pinMap[pin.name];
      if (mappingSearchQuery.trim()) {
        const q = mappingSearchQuery.toLowerCase();
        const matchesPin = pin.name.toLowerCase().includes(q);
        const matchesPad = assignedPad && assignedPad.toLowerCase().includes(q);
        if (!matchesPin && !matchesPad) return false;
      }
      if (mappingFilter === "unmapped") return !assignedPad;
      if (mappingFilter === "conflicts") {
        return Boolean(assignedPad && (padUsageCount[assignedPad] || []).length > 1);
      }
      return true;
    });
  }, [filteredLogicalPins, currentMapping, mappingFilter, mappingSearchQuery, padUsageCount]);

  const unmappedCount = useMemo(() => {
    if (!currentMapping) return logicalPins.length;
    return logicalPins.filter((p) => !currentMapping.pinMap[p.name]).length;
  }, [currentMapping, logicalPins]);

  const conflictCount = useMemo(() => {
    let count = 0;
    Object.values(padUsageCount).forEach((pins) => {
      if (pins.length > 1) count += pins.length;
    });
    return count;
  }, [padUsageCount]);

  // Групповое управление выводами (Bulk Selection & Actions)
  const handleToggleSelectAllPins = () => {
    if (selectedPinIds.size === filteredLogicalPins.length && filteredLogicalPins.length > 0) {
      setSelectedPinIds(new Set());
    } else {
      setSelectedPinIds(new Set(filteredLogicalPins.map((p) => p.id)));
    }
  };

  const handleTogglePinSelect = (id: string) => {
    const next = new Set(selectedPinIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPinIds(next);
  };

  const handleBulkSetElectricalType = (type: PinElectricalType) => {
    if (selectedPinIds.size === 0) return;
    setLogicalPins(
      logicalPins.map((p) => (selectedPinIds.has(p.id) ? { ...p, electricalType: type } : p))
    );
  };

  const handleBulkSetUnit = (unit: string) => {
    if (selectedPinIds.size === 0) return;
    setLogicalPins(
      logicalPins.map((p) =>
        selectedPinIds.has(p.id) ? { ...p, unit: unit.trim().toUpperCase() || undefined } : p
      )
    );
  };

  const handleBulkDeletePins = () => {
    if (selectedPinIds.size === 0) return;
    if (!window.confirm(`Удалить выбранные выводы (${selectedPinIds.size} шт.)?`)) return;
    setLogicalPins(logicalPins.filter((p) => !selectedPinIds.has(p.id)));
    setSelectedPinIds(new Set());
  };

  // Парсинг текста из буфера обмена для массового импорта таблицы выводов
  const parseBulkImportText = (raw: string) => {
    if (!raw.trim()) return [];
    const lines = raw.split(/\r?\n/);
    const results: Array<{
      name: string;
      electricalType: PinElectricalType;
      unit?: string;
      description?: string;
    }> = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;

      let parts: string[] = [];
      if (trimmed.includes("\t")) {
        parts = trimmed.split("\t");
      } else if (trimmed.includes(";")) {
        parts = trimmed.split(";");
      } else if (trimmed.includes(",")) {
        parts = trimmed.split(",");
      } else {
        parts = trimmed.split(/\s{2,}|\s+/);
      }
      parts = parts.map((p) => p.trim()).filter(Boolean);
      if (parts.length === 0) return;

      let pinName = parts[0];
      let pinDesc = "";
      let pinType: PinElectricalType = "passive";
      let pinUnit = "";

      // Если первый элемент - число (№ вывода), а второй - имя сигнала
      if (parts.length >= 2 && /^\d+$/.test(parts[0]) && !/^\d+$/.test(parts[1])) {
        pinName = parts[1];
        pinDesc = `Пин #${parts[0]}`;
        parts = [parts[1], ...parts.slice(2)];
      }

      const remainingTokens: string[] = [];
      parts.slice(1).forEach((tok) => {
        const lower = tok.toLowerCase();
        if (/^(gnd|ground|земля|vss|0v)$/i.test(lower)) {
          pinType = "ground";
        } else if (/^(power_in|pwr|power|питание|vcc|vdd|vin|vbat|vbus)$/i.test(lower)) {
          pinType = "power_in";
        } else if (/^(power_out|вых.*пит|vref|out_pwr)$/i.test(lower)) {
          pinType = "power_out";
        } else if (/^(input|in|вход|btn|rx|din)$/i.test(lower)) {
          pinType = "input";
        } else if (/^(output|out|выход|led|tx|dout)$/i.test(lower)) {
          pinType = "output";
        } else if (/^(bidirectional|bidi|двунапр|io|gpio|sda|scl)$/i.test(lower)) {
          pinType = "bidirectional";
        } else if (/^(open_collector|oc|ок)$/i.test(lower)) {
          pinType = "open_collector";
        } else if (/^(no_connect|nc|не\s*подкл)$/i.test(lower)) {
          pinType = "no_connect";
        } else if (/^(passive|пассивный)$/i.test(lower)) {
          pinType = "passive";
        } else if (/^(unit\s*|секц\w*\s*)?([a-d])$/i.test(lower)) {
          const m = lower.match(/[a-d]$/i);
          if (m) pinUnit = m[0].toUpperCase();
        } else {
          remainingTokens.push(tok);
        }
      });

      // Если тип не указан явно, определяем по общепринятым префиксам имени
      if (pinType === "passive") {
        const nameLower = pinName.toLowerCase();
        if (/gnd|vss|ground/i.test(nameLower)) pinType = "ground";
        else if (/vcc|vdd|vbat|vin|vbus|3v3|5v/i.test(nameLower)) pinType = "power_in";
        else if (/nc|n\.c\./i.test(nameLower)) pinType = "no_connect";
        else if (/clk|sck|scl|rx|in|din|cs|en|rst|reset/i.test(nameLower)) pinType = "input";
        else if (/tx|out|dout|led/i.test(nameLower)) pinType = "output";
        else if (/io|sda|bidi/i.test(nameLower)) pinType = "bidirectional";
      }

      const extraDesc = remainingTokens.join(" ");
      if (extraDesc) {
        pinDesc = pinDesc ? `${pinDesc} — ${extraDesc}` : extraDesc;
      }

      results.push({
        name: pinName,
        electricalType: pinType,
        unit: pinUnit || undefined,
        description: pinDesc || undefined,
      });
    });

    return results;
  };

  const handleApplyBulkImport = () => {
    const parsed = parseBulkImportText(bulkImportText);
    if (parsed.length === 0) {
      alert("Не удалось распознать выводы. Вставьте таблицу строк (например: 1 VCC Power In Питание).");
      return;
    }

    const newLogicalPins: LogicalPin[] = parsed.map((p, idx) => ({
      id: `pin_${Date.now()}_${idx}`,
      name: p.name,
      electricalType: p.electricalType,
      unit: p.unit,
      description: p.description,
    }));

    if (bulkImportMode === "replace") {
      setLogicalPins(newLogicalPins);
    } else {
      setLogicalPins([...logicalPins, ...newLogicalPins]);
    }
    setIsBulkImportOpen(false);
    setBulkImportText("");
  };

  // Добавление / удаление тегов
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Пользовательские параметры (Custom Key-Values)
  const handleAddCustomParam = () => {
    setCustomParams([...customParams, { key: "", value: "" }]);
  };

  const handleUpdateCustomParam = (index: number, key: string, value: string) => {
    const updated = [...customParams];
    updated[index] = { key, value };
    setCustomParams(updated);
  };

  const handleRemoveCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index));
  };

  // Управление выводами схемы
  const handleAddPin = () => {
    const nextNum = logicalPins.length + 1;
    const newPin: LogicalPin = {
      id: `pin_${Date.now()}_${nextNum}`,
      name: `PIN${nextNum}`,
      electricalType: "passive",
    };
    setLogicalPins([...logicalPins, newPin]);
    setSelectedPinId(newPin.id);
  };

  const handleAddPowerPins = () => {
    const hasVCC = logicalPins.some((p) => p.name.toUpperCase() === "VCC");
    const hasGND = logicalPins.some((p) => p.name.toUpperCase() === "GND");
    const newItems: LogicalPin[] = [];

    if (!hasVCC) {
      newItems.push({
        id: `pin_${Date.now()}_vcc`,
        name: "VCC",
        electricalType: "power_in",
        description: "Питание VCC",
      });
    }
    if (!hasGND) {
      newItems.push({
        id: `pin_${Date.now()}_gnd`,
        name: "GND",
        electricalType: "ground",
        description: "Общий провод GND",
      });
    }
    if (newItems.length > 0) {
      setLogicalPins([...logicalPins, ...newItems]);
      setSelectedPinId(newItems[0].id);
    }
  };

  // Быстрое добавление одного вывода
  const handleQuickAddPin = () => {
    const trimmed = quickPinName.trim();
    const pinName = trimmed || `${logicalPins.length + 1}`;
    const newPin: LogicalPin = {
      id: `pin_${Date.now()}_${logicalPins.length + 1}`,
      name: pinName,
      electricalType: "passive",
    };
    setLogicalPins((prev) => [...prev, newPin]);
    setSelectedPinId(newPin.id);
    setQuickPinName("");
  };

  // Импорт логических выводов схемы из контактных площадок выбранного корпуса
  const handleImportPinsFromPackage = () => {
    if (!currentPkgDef || !currentPkgDef.pads || currentPkgDef.pads.length === 0) return;
    if (logicalPins.length > 0) {
      if (
        !window.confirm(
          `Заменить текущие выводы (${logicalPins.length} шт.) выводами из контактных площадок корпуса ${currentPkgDef.name} (${currentPkgDef.pads.length} шт.)?`
        )
      ) {
        return;
      }
    }
    const newPins: LogicalPin[] = currentPkgDef.pads.map((pad, idx) => ({
      id: `pin_${Date.now()}_${idx}`,
      name: pad.name && pad.name.trim() ? pad.name.trim() : pad.padNum,
      electricalType: "passive" as PinElectricalType,
      description: pad.name && pad.name.trim() !== pad.padNum ? `Площадка #${pad.padNum}` : undefined,
    }));
    setLogicalPins(newPins);

    // Если активен корпус, сразу сопоставляем 1:1 с площадками
    if (activePackageId) {
      const autoMap: Record<string, string> = {};
      newPins.forEach((p, idx) => {
        const pad = currentPkgDef.pads[idx];
        if (pad) {
          autoMap[p.name] = pad.padNum;
        }
      });
      setSupportedPackages((prev) =>
        prev.map((item) =>
          item.packageId === activePackageId ? { ...item, pinMap: autoMap } : item
        )
      );
    }
  };

  // Очистка всех выводов схемы
  const handleClearAllPins = () => {
    if (logicalPins.length === 0) return;
    if (window.confirm("Удалить все выводы схемы?")) {
      setLogicalPins([]);
      handleClearMapping();
    }
  };

  // Каскадное удаление вывода из схемы и сопоставления всех корпусов
  const handleRemovePin = (pinId: string) => {
    const targetPin = logicalPins.find((p) => p.id === pinId);
    if (targetPin) {
      const pinName = targetPin.name;
      setSupportedPackages((prev) =>
        prev.map((pkg) => {
          if (pinName in pkg.pinMap) {
            const nextPinMap = { ...pkg.pinMap };
            delete nextPinMap[pinName];
            return { ...pkg, pinMap: nextPinMap };
          }
          return pkg;
        })
      );
    }
    setLogicalPins((prev) => prev.filter((p) => p.id !== pinId));
    if (selectedPinId === pinId) setSelectedPinId(null);
  };

  // Каскадное обновление вывода (при переименовании обновляет ключи в pinMap всех корпусов без потери связей)
  const handleUpdatePin = (pinId: string, updates: Partial<LogicalPin>) => {
    const targetPin = logicalPins.find((p) => p.id === pinId);
    if (!targetPin) return;

    const oldName = targetPin.name;
    const newName = updates.name !== undefined ? updates.name : oldName;

    // Если имя изменилось — выполняем безопасное каскадное обновление в pinMap всех корпусов
    if (updates.name !== undefined && oldName !== newName) {
      const trimmedNew = newName.trim();
      const cachedPad = pinIdToPadCacheRef.current.get(pinId);

      setSupportedPackages((prev) =>
        prev.map((pkg) => {
          const nextPinMap = { ...pkg.pinMap };
          const val = nextPinMap[oldName] || cachedPad;

          if (oldName in nextPinMap) {
            delete nextPinMap[oldName];
          }

          // Если новое имя не пустое и для вывода была привязка — восстанавливаем/присваиваем её
          if (trimmedNew && val) {
            nextPinMap[trimmedNew] = val;
          }

          return { ...pkg, pinMap: nextPinMap };
        })
      );
    }

    setLogicalPins((prev) =>
      prev.map((p) => (p.id === pinId ? { ...p, ...updates } : p))
    );
  };

  // Перемещение вывода вверх / вниз в списке УГО
  const handleMovePin = (pinId: string, direction: "up" | "down") => {
    const idx = logicalPins.findIndex((p) => p.id === pinId);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === logicalPins.length - 1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const nextList = [...logicalPins];
    const [item] = nextList.splice(idx, 1);
    nextList.splice(targetIdx, 0, item);
    setLogicalPins(nextList);
  };

  // Быстрая смена местами первых двух выводов (Swap 1 ↔ 2) со сменой привязки площадок
  const handleSwapFirstTwoPins = () => {
    if (logicalPins.length < 2) return;
    const p1 = logicalPins[0];
    const p2 = logicalPins[1];

    // Меняем порядок в массиве выводов
    setLogicalPins([p2, p1, ...logicalPins.slice(2)]);

    // Также меняем сопоставление контактных площадок в активном корпусе
    if (activePackageId) {
      setSupportedPackages((prev) =>
        prev.map((pkg) => {
          if (pkg.packageId !== activePackageId) return pkg;
          const nextPinMap = { ...pkg.pinMap };
          const pad1 = nextPinMap[p1.name];
          const pad2 = nextPinMap[p2.name];

          if (pad1 !== undefined || pad2 !== undefined) {
            if (pad2 !== undefined) nextPinMap[p1.name] = pad2;
            else delete nextPinMap[p1.name];

            if (pad1 !== undefined) nextPinMap[p2.name] = pad1;
            else delete nextPinMap[p2.name];
          }

          return { ...pkg, pinMap: nextPinMap };
        })
      );
    }
  };

  // Пакетный генератор серий выводов
  const handleExecutePinGen = () => {
    const newPins: LogicalPin[] = [];
    const timestamp = Date.now();

    if (pinGenMode === "range") {
      const minVal = Math.min(pinGenStart, pinGenEnd);
      const maxVal = Math.max(pinGenStart, pinGenEnd);
      for (let i = minVal; i <= maxVal; i++) {
        const pinName = `${pinGenPrefix}${i}`;
        newPins.push({
          id: `pin_${timestamp}_${i}`,
          name: pinName,
          electricalType: pinGenType,
          unit: pinGenUnit.trim() ? pinGenUnit.trim().toUpperCase() : undefined,
          description: `${pinGenPrefix ? `Линия ${pinGenPrefix}` : "Вывод"} ${i}`,
        });
      }
    } else {
      const rawNames = pinGenList
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      rawNames.forEach((pName, idx) => {
        newPins.push({
          id: `pin_${timestamp}_${idx}`,
          name: pName,
          electricalType: pinGenType,
          unit: pinGenUnit.trim() ? pinGenUnit.trim().toUpperCase() : undefined,
          description: `Вывод ${pName}`,
        });
      });
    }

    if (newPins.length > 0) {
      setLogicalPins([...logicalPins, ...newPins]);
      setSelectedPinId(newPins[0].id);
    }
    setIsPinGenOpen(false);
  };

  // Привязка корпусов и маппинг
  const handleAddPackageBinding = (pkgId: string) => {
    if (supportedPackages.some((p) => p.packageId === pkgId)) {
      setActivePackageId(pkgId);
      setIsPkgPickerOpen(false);
      return;
    }
    const pkg = availablePackages.find((p) => p.id === pkgId);
    if (!pkg) return;

    const autoMap: Record<string, string> = {};
    logicalPins.forEach((pin, idx) => {
      const pad = pkg.pads[idx];
      if (pad) autoMap[pin.name] = pad.padNum;
    });

    const newBinding: PackageMapping = {
      packageId: pkgId,
      defaultVariantId: pkg.defaultVariantId,
      pinMap: autoMap,
    };

    setSupportedPackages([...supportedPackages, newBinding]);
    setActivePackageId(pkgId);
    setIsPkgPickerOpen(false);
  };

  const handleRemovePackageBinding = (pkgId: string) => {
    const remaining = supportedPackages.filter((p) => p.packageId !== pkgId);
    setSupportedPackages(remaining);
    if (activePackageId === pkgId) {
      setActivePackageId(remaining[0]?.packageId || "");
    }
  };

  // Назначение корпуса основным по умолчанию (⭐ Primary Package)
  const handleSetPrimaryPackage = (pkgId: string) => {
    const idx = supportedPackages.findIndex((p) => p.packageId === pkgId);
    if (idx <= 0) return;
    const reordered = [...supportedPackages];
    const [target] = reordered.splice(idx, 1);
    reordered.unshift(target);
    setSupportedPackages(reordered);
    setActivePackageId(pkgId);
  };

  // Выбор варианта исполнения корпуса по умолчанию
  const handleSelectDefaultVariant = (pkgId: string, variantId: string) => {
    setSupportedPackages(
      supportedPackages.map((p) =>
        p.packageId === pkgId ? { ...p, defaultVariantId: variantId } : p
      )
    );
  };

  // Копирование сопоставления распиновки из другого привязанного корпуса
  const handleCopyMappingFrom = (sourcePkgId: string) => {
    const source = supportedPackages.find((p) => p.packageId === sourcePkgId);
    if (!source || !activePackageId) return;
    setSupportedPackages(
      supportedPackages.map((item) =>
        item.packageId === activePackageId
          ? { ...item, pinMap: { ...source.pinMap } }
          : item
      )
    );
  };

  const handleUpdatePinMapping = (logicalPinName: string, padNum: string) => {
    if (!activePackageId) return;
    setSupportedPackages(
      supportedPackages.map((item) => {
        if (item.packageId !== activePackageId) return item;
        const nextMap = { ...item.pinMap };
        if (padNum) {
          nextMap[logicalPinName] = padNum;
        } else {
          delete nextMap[logicalPinName];
        }
        return {
          ...item,
          pinMap: nextMap,
        };
      })
    );
  };

  // Умное авто-сопоставление с поддержкой синонимов цепей питания, земли и номеров
  const handleSmartAutoMap = () => {
    if (!currentPkgDef || !activePackageId) return;
    const newMap: Record<string, string> = {};
    const usedPads = new Set<string>();

    const POWER_SYNONYMS = new Set(["VCC", "VDD", "3V3", "+3.3V", "+5V", "5V", "VIN", "VBUS", "VBAT", "VDDA", "VREF"]);
    const GND_SYNONYMS = new Set(["GND", "VSS", "0V", "AGND", "DGND", "PGND", "EP", "THERMAL_PAD", "THERMAL", "PAD"]);

    // 1. Точное совпадение: padNum === pin.name или pad.name === pin.name
    logicalPins.forEach((pin) => {
      const pinNameUpper = pin.name.trim().toUpperCase();
      const exactPad = currentPkgDef.pads.find(
        (p) =>
          !usedPads.has(p.padNum) &&
          (p.padNum.toUpperCase() === pinNameUpper || (p.name && p.name.toUpperCase() === pinNameUpper))
      );
      if (exactPad) {
        newMap[pin.name] = exactPad.padNum;
        usedPads.add(exactPad.padNum);
      }
    });

    // 2. Сопоставление по синонимам питания и земли
    logicalPins.forEach((pin) => {
      if (newMap[pin.name]) return;
      const pinUpper = pin.name.trim().toUpperCase();
      const isPower = POWER_SYNONYMS.has(pinUpper);
      const isGnd = GND_SYNONYMS.has(pinUpper);

      if (isPower || isGnd) {
        const synonymPad = currentPkgDef.pads.find((p) => {
          if (usedPads.has(p.padNum)) return false;
          const pNameUpper = (p.name || "").trim().toUpperCase();
          if (isPower && POWER_SYNONYMS.has(pNameUpper)) return true;
          if (isGnd && GND_SYNONYMS.has(pNameUpper)) return true;
          return false;
        });
        if (synonymPad) {
          newMap[pin.name] = synonymPad.padNum;
          usedPads.add(synonymPad.padNum);
        }
      }
    });

    // 3. Для оставшихся — если в имени пина есть число (напр. "PIN 1" -> pad "1", "D2" -> pad "2")
    logicalPins.forEach((pin) => {
      if (newMap[pin.name]) return;
      const match = pin.name.match(/\d+/);
      if (match) {
        const numStr = match[0];
        const padMatch = currentPkgDef.pads.find(
          (p) => !usedPads.has(p.padNum) && p.padNum === numStr
        );
        if (padMatch) {
          newMap[pin.name] = padMatch.padNum;
          usedPads.add(padMatch.padNum);
        }
      }
    });

    setSupportedPackages(
      supportedPackages.map((item) =>
        item.packageId === activePackageId
          ? { ...item, pinMap: { ...item.pinMap, ...newMap } }
          : item
      )
    );
  };

  const handleAutoMapSequential = () => {
    if (!currentPkgDef || !activePackageId) return;
    const newMap: Record<string, string> = {};
    logicalPins.forEach((pin, index) => {
      if (index < currentPkgDef.pads.length) {
        newMap[pin.name] = currentPkgDef.pads[index].padNum;
      }
    });
    setSupportedPackages(
      supportedPackages.map((item) =>
        item.packageId === activePackageId ? { ...item, pinMap: newMap } : item
      )
    );
  };

  const handleClearMapping = () => {
    if (!activePackageId) return;
    setSupportedPackages(
      supportedPackages.map((item) =>
        item.packageId === activePackageId ? { ...item, pinMap: {} } : item
      )
    );
  };

  // Интерактивный клик по контактной площадке в превью чертежа с авто-шагом
  const handlePadSelect = (padNum: string) => {
    setActivePadNum(padNum);
    if (selectedPinId) {
      const targetPin = logicalPins.find((p) => p.id === selectedPinId);
      if (targetPin) {
        handleUpdatePinMapping(targetPin.name, padNum);

        if (isAutoAdvanceEnabled) {
          // Ищем следующий несопоставленный вывод
          const currIdx = logicalPins.findIndex((p) => p.id === selectedPinId);
          const nextUnmapped =
            logicalPins.slice(currIdx + 1).find((p) => !currentMapping?.pinMap[p.name] && p.name !== targetPin.name) ||
            logicalPins.find((p) => p.id !== targetPin.id && !currentMapping?.pinMap[p.name] && p.name !== targetPin.name);
          if (nextUnmapped) {
            setSelectedPinId(nextUnmapped.id);
          }
        }
        return;
      }
    }
    // Если пин не выбран, проверяем, назначен ли padNum на какой-либо пин
    if (currentMapping) {
      const entry = Object.entries(currentMapping.pinMap).find(([_, num]) => num === padNum);
      if (entry) {
        const foundPin = logicalPins.find((p) => p.name === entry[0]);
        if (foundPin) {
          setSelectedPinId(foundPin.id);
          return;
        }
      }
      // Если площадка свободна, находим первый несопоставленный пин и связываем его
      const firstUnmapped = logicalPins.find((p) => !currentMapping.pinMap[p.name]);
      if (firstUnmapped) {
        handleUpdatePinMapping(firstUnmapped.name, padNum);
        setSelectedPinId(firstUnmapped.id);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Укажите название радиодетали");
      return;
    }

    const customRecord: Record<string, string> = {};
    customParams.forEach((p) => {
      if (p.key.trim() && p.value.trim()) {
        customRecord[p.key.trim()] = p.value.trim();
      }
    });

    const dev: DeviceDefinition = {
      id: id || `dev_${Date.now()}`,
      name: name.trim(),
      category: category.trim() || "ICs",
      subcategory: subcategory.trim() || "",
      designatorPrefix: designatorPrefix.trim() || "U",
      description: description.trim(),
      datasheet: isBase ? undefined : (datasheet.trim() || undefined),
      manufacturer: isBase ? undefined : (manufacturer.trim() || undefined),
      mpn: isBase ? undefined : (mpn.trim() || undefined),
      tags: tags.filter((t) => t.trim().length > 0),
      parameters: isBase
        ? undefined
        : {
            value: paramValue.trim() || undefined,
            tolerance: tolerance.trim() || undefined,
            voltageRating: voltageRating.trim() || undefined,
            powerRating: powerRating.trim() || undefined,
            maxCurrent: maxCurrent.trim() || undefined,
            operatingTemp: operatingTemp.trim() || undefined,
            custom: Object.keys(customRecord).length > 0 ? customRecord : undefined,
          },
      isBase,
      logicalPins,
      supportedPackages,
    };

    onSave(dev);
    onClose();
  };

  // Число заполненных электропараметров для индикации на вкладке
  const filledSpecsCount = [
    paramValue,
    tolerance,
    voltageRating,
    powerRating,
    maxCurrent,
    operatingTemp,
  ].filter(Boolean).length + customParams.filter((p) => p.key && p.value).length;

  if (!isOpen) return null;

  return (
    <div className="cad-modal-backdrop" style={{ zIndex: 1050 }} onClick={onClose}>
      <div className="device-editor-box" onClick={(e) => e.stopPropagation()}>
        {/* Шапка модального окна */}
        <div className="cad-modal-header" style={{ padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="cad-modal-icon-badge" style={{ width: 34, height: 34, borderRadius: 8 }}>
              <Cpu size={18} color="var(--cad-accent-hover)" />
            </div>
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--cad-text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{name || "Новый компонент"}</span>
                {designatorPrefix && (
                  <span
                    style={{
                      fontSize: "10px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "var(--cad-accent-hover)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                      fontFamily: "var(--cad-font-mono)",
                    }}
                  >
                    {designatorPrefix}
                  </span>
                )}
                {!isBase && paramValue && (
                  <span style={{ fontSize: "11px", color: "var(--cad-net-active, #10b981)", fontWeight: 500 }}>
                    • {paramValue}
                  </span>
                )}
                {isBase && (
                  <span
                    style={{
                      fontSize: "10px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#93c5fd",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    Шаблон (Generic)
                  </span>
                )}
                {!isBase && mpn && (
                  <span style={{ fontSize: "11px", color: "var(--cad-text-dim)", fontWeight: 400 }}>
                    [{mpn}]
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Спецификация радиокомпонента, схемные выводы (Pins) и посадочные места (Footprints)
              </div>
            </div>
          </div>
          <button type="button" className="cad-modal-close-btn" onClick={onClose} title="Закрыть (Esc)">
            <X size={15} />
          </button>
        </div>

        {/* Верхняя глобальная панель вкладок редактора */}
        <div className="device-global-tabs-bar">
          <button
            type="button"
            className={`device-global-tab-btn ${activeLeftTab === "properties" ? "active" : ""}`}
            onClick={() => setActiveLeftTab("properties")}
          >
            <FileText size={14} />
            <span>1. Параметры детали & Корпуса</span>
            {supportedPackages.length > 0 && (
              <span className="device-chip-count">{supportedPackages.length} корп.</span>
            )}
          </button>
          <button
            type="button"
            className={`device-global-tab-btn ${activeLeftTab === "pins" ? "active" : ""}`}
            onClick={() => setActiveLeftTab("pins")}
          >
            <Sparkles size={14} />
            <span>2. Выводы схемы (Pins) & Сопоставление</span>
            <span className="device-chip-count">{logicalPins.length} шт.</span>
            {mappingCoverage && mappingCoverage.total > 0 && (
              <span
                className={`mapping-coverage-pill ${mappingCoverage.percent === 100 ? "complete" : "partial"}`}
                style={{ padding: "1px 6px", fontSize: "10px" }}
              >
                {mappingCoverage.mapped}/{mappingCoverage.total} ({mappingCoverage.percent}%)
              </span>
            )}
            {duplicatePinNames.size > 0 && (
              <span
                style={{ color: "#ef4444", display: "inline-flex", alignItems: "center", gap: 2 }}
                title="Обнаружены одинаковые имена выводов!"
              >
                <AlertTriangle size={12} />
              </span>
            )}
          </button>
        </div>

        {/* Тело модального окна: двухколоночная CAD-сетка */}
        <div className="device-editor-grid">
          {activeLeftTab === "properties" ? (
            <>
              {/* Левая колонка Вкладки 1: Параметры детали */}
              <div className="device-col">
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 10 }}>
                {/* Селектор назначения компонента: Базовый шаблон vs Готовая деталь */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    background: "var(--cad-bg-panel, #181d26)",
                    border: "1px solid var(--cad-border, #283344)",
                    borderRadius: 8,
                    padding: "6px 8px",
                    marginBottom: 8,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: isBase ? "1.5px solid var(--cad-accent, #3b82f6)" : "1px solid var(--cad-border, #283344)",
                      background: isBase ? "rgba(59, 130, 246, 0.16)" : "var(--cad-bg-surface, #141820)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => {
                      setIsBase(true);
                      setActiveSubTab("info");
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: isBase ? "var(--cad-accent, #3b82f6)" : "rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isBase ? "#fff" : "var(--cad-text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      <Box size={15} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: isBase ? "#93c5fd" : "var(--cad-text-main)" }}>
                        Базовый компонент (Generic)
                      </span>
                      <span style={{ fontSize: 9.5, color: "var(--cad-text-muted)", marginTop: 2, lineHeight: 1.25 }}>
                        Шаблон для схемы (R, C, VT). Номинал задается по месту на плате
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: !isBase ? "1.5px solid var(--cad-accent, #3b82f6)" : "1px solid var(--cad-border, #283344)",
                      background: !isBase ? "rgba(59, 130, 246, 0.16)" : "var(--cad-bg-surface, #141820)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setIsBase(false)}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: !isBase ? "var(--cad-accent, #3b82f6)" : "rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: !isBase ? "#fff" : "var(--cad-text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      <Tag size={15} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: !isBase ? "#93c5fd" : "var(--cad-text-main)" }}>
                        Готовая деталь (BOM)
                      </span>
                      <span style={{ fontSize: 9.5, color: "var(--cad-text-muted)", marginTop: 2, lineHeight: 1.25 }}>
                        Каталожная деталь: фиксированный артикул MPN и номинал
                      </span>
                    </div>
                  </button>
                </div>

                {/* Карточка 1: Переключаемые вкладки «Основные & BOM» и «Электропараметры» */}
                <div className="device-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div className="device-card-header" style={{ flexShrink: 0 }}>
                    <div className="device-tab-group">
                      <button
                        type="button"
                        className={`device-tab-btn ${activeSubTab === "info" ? "active" : ""}`}
                        onClick={() => setActiveSubTab("info")}
                      >
                        <Info size={12} />
                        <span>{isBase ? "Основные параметры" : "Основные & BOM"}</span>
                      </button>
                      {!isBase && (
                        <button
                          type="button"
                          className={`device-tab-btn ${activeSubTab === "specs" ? "active" : ""}`}
                          onClick={() => setActiveSubTab("specs")}
                        >
                          <Zap size={12} />
                          <span>Паспортные электропараметры</span>
                          {filledSpecsCount > 0 && (
                            <span className="device-chip-count" style={{ marginLeft: 3 }}>
                              {filledSpecsCount}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 4, display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeSubTab === "info" ? (
                /* Вкладка 1: Основные метаданные и спецификация (BOM) */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Название (Part Name):</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="напр. NE555, STM32F103, 1N4148"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 12, fontWeight: 600 }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Префикс УГО:</label>
                      <input
                        type="text"
                        value={designatorPrefix}
                        onChange={(e) => setDesignatorPrefix(e.target.value)}
                        placeholder="U, R, C, VT"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 12, textAlign: "center", fontWeight: "bold" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {/* Выбор категории */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <label className="form-label" style={{ fontSize: 10, margin: 0 }}>Категория:</label>
                        <button
                          type="button"
                          style={{
                            fontSize: 9.5,
                            color: "var(--cad-accent-hover)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          onClick={() => setIsCustomCategory(!isCustomCategory)}
                          title="Переключить между готовым списком категорий и ручным вводом"
                        >
                          {isCustomCategory ? "← Из каталога" : "Ввести вручную"}
                        </button>
                      </div>

                      {isCustomCategory ? (
                        <input
                          type="text"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          placeholder="Введите категорию..."
                          className="cad-input"
                          style={{ width: "100%", padding: "4px 8px", fontSize: 11, height: 26 }}
                        />
                      ) : (
                        <select
                          value={category}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__custom__") {
                              setIsCustomCategory(true);
                              setIsCustomSubcategory(true);
                            } else {
                              setIsCustomCategory(false);
                              setCategory(val);
                              const foundCat = COMPONENT_TAXONOMY.find((c) => c.name === val);
                              if (foundCat && foundCat.subcategories.length > 0) {
                                setIsCustomSubcategory(false);
                                const firstSub = foundCat.subcategories[0];
                                setSubcategory(firstSub.name);
                                setDesignatorPrefix(firstSub.defaultPrefix);
                              }
                            }
                          }}
                          className="cad-input"
                          style={{ width: "100%", padding: "4px 8px", fontSize: 11, height: 26 }}
                        >
                          {COMPONENT_TAXONOMY.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                          <option value="__custom__">+ Другая (ввести вручную)...</option>
                        </select>
                      )}
                    </div>

                    {/* Выбор подкатегории */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <label className="form-label" style={{ fontSize: 10, margin: 0 }}>Подкатегория:</label>
                        {!isCustomCategory && (
                          <button
                            type="button"
                            style={{
                              fontSize: 9.5,
                              color: "var(--cad-accent-hover)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            onClick={() => setIsCustomSubcategory(!isCustomSubcategory)}
                            title="Переключить между списком подкатегорий и ручным вводом"
                          >
                            {isCustomSubcategory ? "← Из каталога" : "Ввести вручную"}
                          </button>
                        )}
                      </div>

                      {isCustomSubcategory || isCustomCategory ? (
                        <input
                          type="text"
                          value={subcategory}
                          onChange={(e) => setSubcategory(e.target.value)}
                          placeholder="Введите подкатегорию..."
                          className="cad-input"
                          style={{ width: "100%", padding: "4px 8px", fontSize: 11, height: 26 }}
                        />
                      ) : (
                        <select
                          value={subcategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "__custom__") {
                              setIsCustomSubcategory(true);
                            } else {
                              setIsCustomSubcategory(false);
                              setSubcategory(val);
                              const curCat = COMPONENT_TAXONOMY.find((c) => c.name === category);
                              const subDef = curCat?.subcategories.find((s) => s.name === val);
                              if (subDef) {
                                setDesignatorPrefix(subDef.defaultPrefix);
                              }
                            }
                          }}
                          className="cad-input"
                          style={{ width: "100%", padding: "4px 8px", fontSize: 11, height: 26 }}
                        >
                          {(() => {
                            const curCat = COMPONENT_TAXONOMY.find((c) => c.name === category);
                            const list = curCat?.subcategories || [];
                            return (
                              <>
                                {list.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name} ({s.defaultPrefix})
                                  </option>
                                ))}
                                <option value="__custom__">+ Другая (ввести вручную)...</option>
                              </>
                            );
                          })()}
                        </select>
                      )}
                    </div>
                  </div>

                  {!isBase && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 10 }}>Производитель (Manufacturer):</label>
                        <input
                          type="text"
                          value={manufacturer}
                          onChange={(e) => setManufacturer(e.target.value)}
                          placeholder="TI, ST, Microchip, Yageo..."
                          className="cad-input"
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 10 }}>Артикул детали (MPN):</label>
                        <input
                          type="text"
                          value={mpn}
                          onChange={(e) => setMpn(e.target.value)}
                          placeholder="STM32F103C8T6, NE555P..."
                          className="cad-input"
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11, fontFamily: "var(--cad-font-mono)" }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: !isBase ? "1fr 1fr" : "1fr", gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Описание (Description):</label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Краткое функциональное описание"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                    </div>
                    {!isBase && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label className="form-label" style={{ fontSize: 10 }}>Ссылка на Datasheet (URL):</label>
                          {datasheet && (
                            <a
                              href={datasheet}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 10, color: "var(--cad-accent-hover)", display: "flex", alignItems: "center", gap: 2, textDecoration: "none" }}
                              title="Открыть документацию в браузере"
                            >
                              <ExternalLink size={10} /> Открыть
                            </a>
                          )}
                        </div>
                        <input
                          type="text"
                          value={datasheet}
                          onChange={(e) => setDatasheet(e.target.value)}
                          placeholder="https://... или pdf"
                          className="cad-input"
                          style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                        />
                      </div>
                    )}
                  </div>

                  {isBase && (
                    <div style={{ padding: "8px 10px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 6, fontSize: 11, color: "#93c5fd", lineHeight: 1.4 }}>
                      💡 <strong>Базовый компонент (Generic):</strong> это схемный шаблон (R, C, VT и др.). У него нет статического номинала, допуска, напряжения или артикула MPN — все характеристики и номинал задаются инженером индивидуально при установке на плату.
                    </div>
                  )}

                  {/* Теги компонента */}
                  <div>
                    <label className="form-label" style={{ fontSize: 10, marginBottom: 4 }}>
                      Теги и ключевые слова (Tags):
                    </label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minHeight: 26 }}>
                      {tags.map((t) => (
                        <span key={t} className="device-tag-chip">
                          <Tag size={10} />
                          <span>{t}</span>
                          <button
                            type="button"
                            className="device-tag-remove"
                            onClick={() => handleRemoveTag(t)}
                            title="Удалить тег"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                      <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 120 }}>
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder="+ тег (Enter)"
                          className="cad-input"
                          style={{ flex: 1, padding: "3px 6px", fontSize: 11, height: 24 }}
                        />
                        <button
                          type="button"
                          className="cad-btn-secondary"
                          style={{ padding: "0 6px", height: 24, fontSize: 11 }}
                          onClick={handleAddTag}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Вкладка 2: Электрические характеристики и предельные режимы */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Номинал (Value):</label>
                      <input
                        type="text"
                        value={paramValue}
                        onChange={(e) => setParamValue(e.target.value)}
                        placeholder="10k, 0.1uF, 3.3V, 16MHz"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11, fontWeight: 600, color: "var(--cad-net-active, #10b981)" }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Класс точности / Допуск:</label>
                      <input
                        type="text"
                        list="tolerance-presets"
                        value={tolerance}
                        onChange={(e) => setTolerance(e.target.value)}
                        placeholder="±1%, ±5%, ±10%"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                      <datalist id="tolerance-presets">
                        <option value="±0.1%" />
                        <option value="±0.5%" />
                        <option value="±1%" />
                        <option value="±2%" />
                        <option value="±5%" />
                        <option value="±10%" />
                        <option value="±20%" />
                      </datalist>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Рабочее напряжение:</label>
                      <input
                        type="text"
                        list="voltage-presets"
                        value={voltageRating}
                        onChange={(e) => setVoltageRating(e.target.value)}
                        placeholder="3.3V, 5V, 16V, 50V, 250V"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                      <datalist id="voltage-presets">
                        <option value="3.3V" />
                        <option value="5V" />
                        <option value="12V" />
                        <option value="16V" />
                        <option value="25V" />
                        <option value="50V" />
                        <option value="100V" />
                        <option value="250V" />
                        <option value="400V" />
                      </datalist>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Рассеиваемая мощность:</label>
                      <input
                        type="text"
                        list="power-presets"
                        value={powerRating}
                        onChange={(e) => setPowerRating(e.target.value)}
                        placeholder="0.125W (1/8W), 0.25W, 1W"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                      <datalist id="power-presets">
                        <option value="0.063W (0402)" />
                        <option value="0.1W (0603)" />
                        <option value="0.125W (0805)" />
                        <option value="0.25W (1206)" />
                        <option value="0.5W" />
                        <option value="1W" />
                        <option value="2W" />
                        <option value="5W" />
                      </datalist>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Максимальный ток:</label>
                      <input
                        type="text"
                        list="current-presets"
                        value={maxCurrent}
                        onChange={(e) => setMaxCurrent(e.target.value)}
                        placeholder="20mA, 100mA, 1.5A, 10A"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                      <datalist id="current-presets">
                        <option value="20mA" />
                        <option value="100mA" />
                        <option value="500mA" />
                        <option value="1A" />
                        <option value="1.5A" />
                        <option value="3A" />
                        <option value="5A" />
                        <option value="10A" />
                      </datalist>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Температурный диапазон:</label>
                      <input
                        type="text"
                        list="temp-presets"
                        value={operatingTemp}
                        onChange={(e) => setOperatingTemp(e.target.value)}
                        placeholder="-40°C..+85°C (Industrial)"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                      <datalist id="temp-presets">
                        <option value="-40°C..+85°C (Industrial)" />
                        <option value="-40°C..+125°C (Automotive)" />
                        <option value="0°C..+70°C (Commercial)" />
                        <option value="-55°C..+150°C (Military)" />
                      </datalist>
                    </div>
                  </div>

                  {/* Пользовательские характеристики (Custom Key-Value) */}
                  <div style={{ marginTop: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Дополнительные параметры (Custom):</label>
                      <button
                        type="button"
                        className="cad-btn-secondary"
                        style={{ fontSize: 10, padding: "1px 6px", height: 20 }}
                        onClick={handleAddCustomParam}
                      >
                        <Plus size={10} /> Добавить параметр
                      </button>
                    </div>

                    {customParams.length === 0 ? (
                      <div style={{ fontSize: 10, color: "var(--cad-text-dim)", padding: "4px 0" }}>
                        Нет кастомных параметров (ESR, индуктивность, частота, корпус-донор и др.).
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 75, overflowY: "auto" }}>
                        {customParams.map((p, idx) => (
                          <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="text"
                              value={p.key}
                              onChange={(e) => handleUpdateCustomParam(idx, e.target.value, p.value)}
                              placeholder="Имя параметра"
                              className="cad-input"
                              style={{ flex: 1, padding: "2px 6px", fontSize: 11 }}
                            />
                            <input
                              type="text"
                              value={p.value}
                              onChange={(e) => handleUpdateCustomParam(idx, p.key, e.target.value)}
                              placeholder="Значение"
                              className="cad-input"
                              style={{ flex: 1, padding: "2px 6px", fontSize: 11 }}
                            />
                            <button
                              type="button"
                              className="cad-icon-btn danger"
                              style={{ width: 20, height: 20, padding: 0 }}
                              onClick={() => handleRemoveCustomParam(idx)}
                              title="Удалить"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

              {/* Навигационная плашка перехода к выводам внизу карточки параметров */}
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--cad-text-muted)" }}>
                  Выводов схемы (Pins): <strong style={{ color: "var(--cad-text-main)" }}>{logicalPins.length} шт.</strong>
                </span>
                {duplicatePinNames.size > 0 && (
                  <span
                    style={{ color: "#ef4444", fontSize: 10.5, display: "inline-flex", alignItems: "center", gap: 4 }}
                    title="Обнаружены одинаковые имена выводов!"
                  >
                    <AlertTriangle size={12} />
                    <span>Повторяющиеся имена</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Правая колонка Вкладки 1: Управление привязанными корпусами и обзор чертежа */}
          <div className="device-col">
            {/* Карточка 1: Привязанные корпуса */}
            <div className="device-card" style={{ flexShrink: 0 }}>
              <div className="device-card-header">
                <div className="device-card-title">
                  <Box size={13} />
                  <span>Привязанные корпуса</span>
                  <span className="device-chip-count">{supportedPackages.length}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    className="cad-btn-primary"
                    style={{ fontSize: 10, padding: "3px 10px", height: 24, gap: 4 }}
                    onClick={() => {
                      setPkgPickerSearch("");
                      setPkgPickerMountFilter("all");
                      setIsPkgPickerOpen(true);
                    }}
                    title="Открыть каталог библиотеки для выбора и привязки корпуса"
                  >
                    <Plus size={12} /> Выбрать из библиотеки...
                  </button>
                  {onCreateNewPackage && (
                    <button
                      type="button"
                      className="cad-btn-secondary"
                      style={{ fontSize: 10, padding: "3px 8px", height: 24 }}
                      onClick={onCreateNewPackage}
                      title="Создать новое посадочное место в редакторе корпусов"
                    >
                      Создать корпус
                    </button>
                  )}
                </div>
              </div>

              {/* Список привязанных корпусов в виде стильных CAD-чипов со статусом и основным корпусом ⭐ */}
              <div className="device-pkg-chips-wrap">
                {supportedPackages.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--cad-text-dim)", padding: "4px 0" }}>
                    Корпуса не привязаны. Нажмите «Выбрать из библиотеки...», чтобы привязать посадочное место.
                  </div>
                ) : (
                  supportedPackages.map((binding, idx) => {
                    const pkg = availablePackages.find((p) => p.id === binding.packageId);
                    const isSelected = activePackageId === binding.packageId;
                    const isPrimary = idx === 0;
                    const readiness = getPackageReadiness(binding);

                    return (
                      <div
                        key={binding.packageId}
                        className={`device-pkg-chip ${isSelected ? "active" : ""}`}
                        onClick={() => setActivePackageId(binding.packageId)}
                        title={`Нажмите для выбора корпуса ${pkg?.name || binding.packageId}`}
                      >
                        {/* Кнопка назначения основного корпуса ⭐ */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimaryPackage(binding.packageId);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: isPrimary ? "default" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            color: isPrimary ? "#fbbf24" : "var(--cad-text-dim)",
                            flexShrink: 0,
                          }}
                          title={isPrimary ? "Основной корпус детали (Primary ⭐)" : "Сделать основным корпусом (⭐)"}
                        >
                          <Star size={12} fill={isPrimary ? "#fbbf24" : "none"} />
                        </button>

                        <Box size={12} style={{ flexShrink: 0 }} color={isSelected ? "var(--cad-accent-hover)" : "var(--cad-text-dim)"} />

                        <div className="device-pkg-chip-title">
                          <span style={{ fontWeight: isSelected ? 600 : 500 }}>
                            {pkg?.name || binding.packageId}
                          </span>
                          {pkg && (
                            <span style={{ fontSize: 10, color: "var(--cad-text-dim)", marginLeft: 6 }}>
                              ({pkg.pads.length}п.)
                            </span>
                          )}
                        </div>

                        <div className="device-pkg-chip-actions">
                          {/* Индикатор готовности распиновки */}
                          <span className={`pkg-status-badge ${readiness.isComplete ? "complete" : "partial"}`}>
                            {readiness.isComplete ? (
                              <>
                                <CheckCircle2 size={9} /> {readiness.mapped}/{readiness.total}
                              </>
                            ) : (
                              <>
                                {readiness.mapped}/{readiness.total}
                              </>
                            )}
                          </span>

                          <button
                            type="button"
                            className="device-pkg-chip-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePackageBinding(binding.packageId);
                            }}
                            title="Отвязать этот корпус"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Настройки выбранного корпуса: выбор варианта исполнения и копирование распиновки */}
              {currentPkgDef && currentMapping && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    paddingTop: 6,
                    borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                    fontSize: 10.5,
                  }}
                >
                  {/* Выбор варианта исполнения корпуса */}
                  {currentPkgDef.variants && currentPkgDef.variants.length > 1 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <label style={{ color: "var(--cad-text-muted)" }}>Вариант корпуса:</label>
                      <select
                        value={currentMapping.defaultVariantId || currentPkgDef.defaultVariantId}
                        onChange={(e) => handleSelectDefaultVariant(currentPkgDef.id, e.target.value)}
                        className="cad-input"
                        style={{ fontSize: 10, padding: "2px 6px", height: 22 }}
                      >
                        {currentPkgDef.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ color: "var(--cad-text-dim)" }}>
                      Тип монтажа: <strong>{currentPkgDef.mountType.toUpperCase()}</strong> | Площадок: <strong>{currentPkgDef.pads.length}</strong>
                    </div>
                  )}

                  {/* Копирование распиновки из другого привязанного корпуса */}
                  {supportedPackages.length > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Copy size={11} color="var(--cad-text-dim)" />
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleCopyMappingFrom(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="cad-input"
                        style={{ fontSize: 10, padding: "2px 6px", height: 22, maxWidth: 170 }}
                        title="Скопировать распиновку из другого корпуса, если нумерация выводов совпадает"
                      >
                        <option value="" disabled>Скопировать распиновку из...</option>
                        {supportedPackages
                          .filter((p) => p.packageId !== activePackageId)
                          .map((p) => {
                            const otherPkg = availablePackages.find((ap) => ap.id === p.packageId);
                            return (
                              <option key={p.packageId} value={p.packageId}>
                                {otherPkg?.name || p.packageId}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Предупреждение о нехватке контактных площадок у корпуса */}
              {currentPkgDef && currentPkgDef.pads.length < logicalPins.length && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#fca5a5",
                    fontSize: 10.5,
                  }}
                >
                  <AlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0 }} />
                  <span>
                    Внимание: у корпуса площадок ({currentPkgDef.pads.length}) меньше, чем выводов схемы ({logicalPins.length}). Часть сигналов не сможет быть выведена на плату!
                  </span>
                </div>
              )}
            </div>

            {/* Карточка 2: Обзор чертежа посадочного места выбранного корпуса */}
            <div className="device-pkg-overview-card">
              <div className="device-card-header" style={{ paddingBottom: 6 }}>
                <div className="device-card-title" style={{ gap: 6 }}>
                  <Box size={13} color="#60a5fa" />
                  <span>Чертёж посадочного места</span>
                </div>
                {currentPkgDef && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="mapping-sub-pkg-tag">{currentPkgDef.mountType.toUpperCase()}</span>
                    <span className="mapping-sub-pkg-dot">•</span>
                    <span className="mapping-sub-pkg-tag">{currentPkgDef.pads.length} площадок</span>
                  </div>
                )}
              </div>

              {currentPkgDef ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: "var(--cad-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {currentPkgDef.name}
                    </div>
                    {currentPkgDef.variants && currentPkgDef.variants.length > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: "var(--cad-text-muted)" }}>Исполнение:</span>
                        <select
                          value={currentMapping?.defaultVariantId || currentPkgDef.defaultVariantId}
                          onChange={(e) => handleSelectDefaultVariant(currentPkgDef.id, e.target.value)}
                          className="cad-input"
                          style={{ fontSize: 10, padding: "1px 6px", height: 22 }}
                        >
                          {currentPkgDef.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minHeight: 160, display: "flex", flexDirection: "column", background: "rgba(0, 0, 0, 0.25)", borderRadius: 6, border: "1px solid var(--cad-border)", overflow: "hidden", position: "relative" }}>
                    <FootprintPreview
                      packageDef={currentPkgDef}
                      variant={currentPkgDef.variants?.find((v) => v.id === (currentMapping?.defaultVariantId || currentPkgDef.defaultVariantId))}
                      showDimensions={true}
                      interactive={false}
                      padLabels={padLabels}
                      padColors={padColors}
                      unassignedPadNums={unassignedPadNums}
                      height="100%"
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 4 }}>
                    <div style={{ fontSize: 11, color: "var(--cad-text-muted)" }}>
                      Готовность распиновки:{" "}
                      <strong style={{ color: mappingCoverage.percent === 100 ? "#10b981" : "#f59e0b" }}>
                        {mappingCoverage.mapped}/{mappingCoverage.total} ({mappingCoverage.percent}%)
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    color: "var(--cad-text-dim)",
                    padding: 24,
                    textAlign: "center",
                  }}
                >
                  <Box size={40} color="var(--cad-border)" />
                  <div style={{ fontSize: 13, color: "var(--cad-text-muted)", fontWeight: 600 }}>
                    Корпус не выбран
                  </div>
                  <div style={{ fontSize: 11, maxWidth: 280 }}>
                    Привяжите посадочное место из библиотеки выше, чтобы просмотреть чертёж и сопоставить выводы.
                  </div>
                  <button
                    type="button"
                    className="cad-btn-primary"
                    style={{ fontSize: 11, padding: "5px 14px", gap: 6, marginTop: 4 }}
                    onClick={() => {
                      setPkgPickerSearch("");
                      setPkgPickerMountFilter("all");
                      setIsPkgPickerOpen(true);
                    }}
                  >
                    <Plus size={13} /> Выбрать из библиотеки...
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Левая колонка Вкладки 2: Логические выводы схемы (Logical Pins) */}
          <div className="device-col">
            <div className="device-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
            {/* Верхняя панель действий (Unified CAD Toolbar) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                paddingBottom: 8,
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                flexShrink: 0,
                flexWrap: "nowrap",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                className="cad-btn-primary"
                style={{ fontSize: 10.5, padding: "3px 8px", height: 24, gap: 4, fontWeight: 600, flexShrink: 0 }}
                onClick={handleAddPin}
                title="Добавить новый логический вывод (Ins)"
              >
                <Plus size={12} /> Пин
              </button>
              <select
                className="cad-input"
                style={{ fontSize: 10, padding: "2px 4px", height: 24, width: 88, flexShrink: 0, cursor: "pointer" }}
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  applyPinPreset(val);
                  e.target.value = "";
                }}
                title="Готовые шаблоны выводов для компонентов"
              >
                <option value="" disabled>⚡ Пресет...</option>
                <option value="rlc">Пассивный 2-pin (1, 2)</option>
                <option value="diode">Диод (Анод A, Катод K)</option>
                <option value="bjt_npn">BJT NPN (B, C, E)</option>
                <option value="mosfet_n">MOSFET N-Ch (G, D, S)</option>
                <option value="ldo3">LDO 3-pin (VIN, VOUT, GND)</option>
                <option value="opamp_single">ОУ одиночный (IN+, IN-, OUT...)</option>
                <option value="opamp_dual">ОУ сдвоенный (Unit A, B + PWR)</option>
                <option value="header_1x4">Штыревой разъем (1..4)</option>
                <option value="pwr_logic">ИМС логики (VCC, GND, IN, OUT)</option>
                <option value="i2c_eeprom">I2C EEPROM (A0-A2, I2C, WP, VCC)</option>
                <option value="spi_flash">SPI Flash (CS#, SPI, WP#, HOLD#)</option>
                <option value="dcdc_buck">DC-DC Buck (VIN, SW, BOOT, FB...)</option>
                <option value="swd_header">SWD Отладка (SWDIO, SWCLK, NRST)</option>
              </select>
              <button
                type="button"
                className="cad-btn-secondary"
                style={{ fontSize: 10, padding: "2px 6px", height: 24, gap: 4, flexShrink: 0 }}
                onClick={() => setIsPinGenOpen(true)}
                title="Генератор шин и диапазонов выводов (D0..D7, 1..16, список)"
              >
                <ListPlus size={11} color="var(--cad-accent-hover)" /> Серия...
              </button>
              <button
                type="button"
                className="cad-btn-secondary"
                style={{ fontSize: 10, padding: "2px 6px", height: 24, gap: 3, flexShrink: 0 }}
                onClick={handleAddPowerPins}
                title="Быстро добавить выводы VCC и GND"
              >
                <Zap size={11} color="#f59e0b" /> +PWR
              </button>

              <div style={{ width: 1, height: 14, background: "rgba(255, 255, 255, 0.08)", margin: "0 1px", flexShrink: 0 }} />

              <button
                type="button"
                className="cad-btn-secondary"
                style={{ fontSize: 10, padding: "2px 6px", height: 24, gap: 4, flexShrink: 0 }}
                onClick={() => {
                  setBulkImportText("");
                  setIsBulkImportOpen(true);
                }}
                title="Импортировать выводы из таблицы даташита, Excel или CSV"
              >
                <FileText size={11} color="#60a5fa" /> Импорт...
              </button>
              {currentPkgDef && currentPkgDef.pads && currentPkgDef.pads.length > 0 && (
                <button
                  type="button"
                  className="cad-btn-secondary"
                  style={{ fontSize: 10, padding: "2px 6px", height: 24, gap: 4, flexShrink: 0 }}
                  onClick={handleImportPinsFromPackage}
                  title={`Импортировать выводы из площадок корпуса ${currentPkgDef.name} (${currentPkgDef.pads.length} площадок)`}
                >
                  <Download size={11} color="#10b981" /> Из корпуса ({currentPkgDef.pads.length})
                </button>
              )}

              {/* Разделитель-распорка для прижатия к правому краю */}
              <div style={{ flex: 1, minWidth: 2 }} />

              {logicalPins.length >= 2 && (
                <button
                  type="button"
                  className="cad-btn-secondary"
                  style={{ fontSize: 10, padding: "2px 6px", height: 24, gap: 3, flexShrink: 0 }}
                  onClick={handleSwapFirstTwoPins}
                  title="Поменять местами выводы 1 и 2 (Swap 1↔2)"
                >
                  <ArrowUpDown size={11} /> 1↔2
                </button>
              )}
              {logicalPins.length > 0 && (
                <button
                  type="button"
                  className="cad-btn-secondary"
                  style={{ fontSize: 10, padding: "2px 5px", height: 24, color: "#ef4444", flexShrink: 0 }}
                  onClick={handleClearAllPins}
                  title="Очистить все выводы"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {/* Строка поиска, секций и статуса */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <Search size={11} style={{ position: "absolute", left: 8, color: "var(--cad-text-dim)" }} />
                <input
                  type="text"
                  value={pinSearchQuery}
                  onChange={(e) => setPinSearchQuery(e.target.value)}
                  placeholder="Быстрый поиск по имени или описанию..."
                  className="cad-input"
                  style={{ width: "100%", padding: "4px 8px 4px 26px", fontSize: 11, height: 26, borderRadius: 5 }}
                />
                {pinSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPinSearchQuery("")}
                    style={{ position: "absolute", right: 6, background: "none", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {availableUnits.length > 0 && (
                <select
                  value={pinUnitFilter}
                  onChange={(e) => setPinUnitFilter(e.target.value)}
                  className="cad-input"
                  style={{ fontSize: 10.5, padding: "2px 8px", height: 26, maxWidth: 110 }}
                >
                  <option value="all">Все секции</option>
                  {availableUnits.map((u) => (
                    <option key={u} value={u}>
                      Секция {u}
                    </option>
                  ))}
                </select>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span className="device-chip-count" style={{ fontSize: 10.5, padding: "2px 8px" }}>
                  {filteredLogicalPins.length} из {logicalPins.length} шт.
                </span>
                {duplicatePinNames.size > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "#ef4444",
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: 10,
                      padding: "1px 7px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontWeight: 600,
                    }}
                    title="Обнаружены одинаковые имена выводов! Сделайте их уникальными."
                  >
                    <AlertTriangle size={11} /> Дубликаты!
                  </span>
                )}
              </div>
            </div>

            {/* Всплывающая панель групповых действий над выбранными выводами */}
            {selectedPinIds.size > 0 && (
              <div className="pin-bulk-bar">
                <div className="pin-bulk-title">
                  <CheckCircle2 size={13} />
                  <span>Выбрано: {selectedPinIds.size} из {logicalPins.length}</span>
                </div>
                <div className="pin-bulk-actions">
                  <select
                    className="cad-input"
                    style={{ fontSize: 10.5, height: 24, padding: "2px 6px" }}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkSetElectricalType(e.target.value as PinElectricalType);
                        e.target.value = "";
                      }
                    }}
                    title="Установить единый тип сигнала для всех выбранных выводов"
                  >
                    <option value="" disabled>Тип сигнала...</option>
                    {ELECTRICAL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="cad-input"
                    style={{ fontSize: 10.5, height: 24, padding: "2px 6px" }}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value !== undefined) {
                        handleBulkSetUnit(e.target.value === "none" ? "" : e.target.value);
                        e.target.value = "";
                      }
                    }}
                    title="Назначить секцию УГО для всех выбранных выводов"
                  >
                    <option value="" disabled>Секция УГО...</option>
                    <option value="none">Без секции</option>
                    <option value="A">Секция A</option>
                    <option value="B">Секция B</option>
                    <option value="C">Секция C</option>
                    <option value="D">Секция D</option>
                  </select>

                  <button
                    type="button"
                    className="cad-btn-secondary"
                    style={{ fontSize: 10.5, height: 24, padding: "2px 8px", color: "#ef4444", gap: 3 }}
                    onClick={handleBulkDeletePins}
                    title="Удалить выбранные выводы"
                  >
                    <Trash2 size={11} /> Удалить ({selectedPinIds.size})
                  </button>

                  <button
                    type="button"
                    className="cad-icon-btn"
                    style={{ width: 22, height: 22, padding: 0 }}
                    onClick={() => setSelectedPinIds(new Set())}
                    title="Снять выделение"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Профессиональная таблица-сетка логических выводов схемы */}
            <div className="device-table-container" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <table className="device-table" style={{ tableLayout: "fixed", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 24, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        style={{ cursor: "pointer", accentColor: "var(--cad-accent)" }}
                        checked={selectedPinIds.size === filteredLogicalPins.length && filteredLogicalPins.length > 0}
                        onChange={handleToggleSelectAllPins}
                        title="Выбрать все выводы"
                      />
                    </th>
                    <th style={{ width: 20, textAlign: "center" }}>#</th>
                    <th style={{ width: 48, whiteSpace: "nowrap" }}>Вывод</th>
                    <th style={{ width: 88, whiteSpace: "nowrap" }}>Тип</th>
                    <th style={{ width: 30, textAlign: "center", whiteSpace: "nowrap" }} title="Секция УГО / Вентиль (A, B, C, D...)">Секц.</th>
                    <th style={{ width: 80, textAlign: "center", whiteSpace: "nowrap" }} title="Контактная площадка активного корпуса">Площадка</th>
                    <th style={{ whiteSpace: "nowrap" }} title="Назначение цепи / Описание">Описание</th>
                    <th style={{ width: 112, textAlign: "center", whiteSpace: "nowrap" }} title="Инверсия (~), тактирование (CLK), перемещение и удаление">Опции</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogicalPins.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px 10px", color: "#64748b" }}>
                        {logicalPins.length === 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <Sparkles size={22} color="var(--cad-accent)" opacity={0.6} />
                            <div style={{ fontSize: 12, color: "var(--cad-text-muted)" }}>Выводы схемы еще не добавлены</div>
                            <button
                              type="button"
                              className="cad-btn-primary"
                              style={{ fontSize: 11, padding: "4px 12px", gap: 5 }}
                              onClick={handleAddPin}
                            >
                              <Plus size={12} /> Добавить первый вывод
                            </button>
                          </div>
                        ) : (
                          "Нет выводов, соответствующих поиску."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLogicalPins.map((pin) => {
                      const typeCfg =
                        ELECTRICAL_TYPES.find((t) => t.value === pin.electricalType) ||
                        ELECTRICAL_TYPES[5];
                      const isSelected = selectedPinId === pin.id;
                      const isDupe = duplicatePinNames.has(pin.name.trim().toUpperCase());
                      const pinGlobalIdx = logicalPins.findIndex((p) => p.id === pin.id);
                      const isChecked = selectedPinIds.has(pin.id);

                      return (
                        <tr
                          key={pin.id}
                          className={isSelected ? "active-mapping-row" : ""}
                          onClick={() => {
                            setSelectedPinId(pin.id);
                            if (currentMapping && currentMapping.pinMap[pin.name]) {
                              setActivePadNum(currentMapping.pinMap[pin.name]);
                            }
                          }}
                          style={{
                            cursor: "pointer",
                            background: isChecked ? "rgba(59, 130, 246, 0.16)" : isSelected ? "rgba(59, 130, 246, 0.12)" : undefined,
                            borderLeft: isSelected ? "2px solid #3b82f6" : "2px solid transparent",
                          }}
                        >
                          <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              style={{ cursor: "pointer", accentColor: "var(--cad-accent)" }}
                              checked={isChecked}
                              onChange={() => handleTogglePinSelect(pin.id)}
                            />
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              color: isSelected ? "var(--cad-accent-hover)" : "#64748b",
                              fontFamily: "monospace",
                              fontSize: 10.5,
                              userSelect: "none",
                            }}
                          >
                            {pinGlobalIdx + 1}
                          </td>
                          <td>
                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                              <input
                                type="text"
                                value={pin.name}
                                onChange={(e) =>
                                  handleUpdatePin(pin.id, { name: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddPin();
                                  }
                                }}
                                className="cad-grid-cell-input"
                                style={{
                                  fontFamily: "monospace",
                                  fontWeight: 700,
                                  color: isDupe ? "#ef4444" : "#f1f5f9",
                                  borderColor: isDupe ? "rgba(239, 68, 68, 0.6)" : undefined,
                                }}
                                placeholder="PIN"
                              />
                              {isDupe && (
                                <span
                                  title="Имя вывода дублируется!"
                                  style={{ position: "absolute", right: 6, display: "flex", alignItems: "center", pointerEvents: "none" }}
                                >
                                  <AlertTriangle size={11} color="#ef4444" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="cad-grid-select-wrapper" style={{ padding: "1px 3px", gap: 3, width: "100%" }}>
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  backgroundColor: typeCfg.color,
                                  boxShadow: `0 0 4px ${typeCfg.color}`,
                                  flexShrink: 0,
                                }}
                              />
                              <select
                                value={pin.electricalType}
                                onChange={(e) =>
                                  handleUpdatePin(pin.id, {
                                    electricalType: e.target.value as PinElectricalType,
                                  })
                                }
                                className="cad-grid-select"
                                title={`Тип сигнала: ${typeCfg.label}`}
                                style={{ fontSize: 10, width: "100%" }}
                              >
                                {ELECTRICAL_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.shortLabel}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={pin.unit || ""}
                              onChange={(e) =>
                                handleUpdatePin(pin.id, { unit: e.target.value.toUpperCase() })
                              }
                              placeholder="—"
                              maxLength={4}
                              className="cad-grid-cell-input"
                              style={{
                                textAlign: "center",
                                fontFamily: "monospace",
                                color: pin.unit ? "var(--cad-accent-hover)" : "var(--cad-text-dim)",
                                padding: "4px 2px",
                              }}
                              title="Секция УГО: A, B, C, D для многоэлементных схем"
                            />
                          </td>
                          <td>
                            {(() => {
                              if (!currentPkgDef || !currentMapping) {
                                return (
                                  <span style={{ fontSize: 10, color: "var(--cad-text-dim)", display: "block", textAlign: "center" }}>
                                    —
                                  </span>
                                );
                              }
                              const assignedPad = currentMapping.pinMap[pin.name];
                              const hasConflict = Boolean(assignedPad && (padUsageCount[assignedPad] || []).length > 1);

                              if (assignedPad) {
                                return (
                                  <div style={{ display: "flex", justifyContent: "center" }}>
                                    <span
                                      className={`pin-pad-badge ${hasConflict ? "conflict" : "assigned"}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPinId(pin.id);
                                        setActivePadNum(assignedPad);
                                      }}
                                      title={
                                        hasConflict
                                          ? `Конфликт! Площадка #${assignedPad} назначена нескольким выводам!`
                                          : `Связан с Pad #${assignedPad} (${currentPkgDef.name}). Клик для фокуса.`
                                      }
                                    >
                                      <Box size={9} />
                                      Pad #{assignedPad}
                                    </span>
                                  </div>
                                );
                              }

                              const hasFreePads = unassignedPads.length > 0;
                              return (
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <span
                                    className="pin-pad-badge unassigned"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPinId(pin.id);
                                      if (hasFreePads) {
                                        handleUpdatePinMapping(pin.name, unassignedPads[0].padNum);
                                        setActivePadNum(unassignedPads[0].padNum);
                                      }
                                    }}
                                    title={
                                      hasFreePads
                                        ? `Вывод не привязан. Свободно площадок: ${unassignedPads.length}. Клик для привязки к #${unassignedPads[0].padNum}.`
                                        : `Вывод не привязан. В корпусе ${currentPkgDef.pads.length} площадок — все заняты!`
                                    }
                                  >
                                    <AlertTriangle size={9} />
                                    {hasFreePads ? "Не привязан" : "Нет Pad"}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={pin.description || ""}
                              onChange={(e) =>
                                handleUpdatePin(pin.id, { description: e.target.value })
                              }
                              placeholder="Назначение цепи..."
                              className="cad-grid-cell-input"
                            />
                          </td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                              <button
                                type="button"
                                className={`cad-icon-btn ${pin.isInverted ? "active" : ""}`}
                                style={{
                                  width: 17,
                                  height: 18,
                                  padding: 0,
                                  fontSize: 10.5,
                                  fontWeight: "bold",
                                  color: pin.isInverted ? "#38bdf8" : "var(--cad-text-dim)",
                                  background: pin.isInverted ? "rgba(56, 189, 248, 0.2)" : undefined,
                                  border: pin.isInverted ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdatePin(pin.id, { isInverted: !pin.isInverted });
                                }}
                                title={pin.isInverted ? "Инверсный сигнал (~ / Active-Low) включен" : "Сделать сигнал инверсным (~ / Active-Low)"}
                              >
                                ~
                              </button>
                              <button
                                type="button"
                                className={`cad-icon-btn ${pin.isClock ? "active" : ""}`}
                                style={{
                                  width: 22,
                                  height: 18,
                                  padding: 0,
                                  fontSize: 8.5,
                                  fontWeight: "bold",
                                  color: pin.isClock ? "#f59e0b" : "var(--cad-text-dim)",
                                  background: pin.isClock ? "rgba(245, 158, 11, 0.2)" : undefined,
                                  border: pin.isClock ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid transparent",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdatePin(pin.id, { isClock: !pin.isClock });
                                }}
                                title={pin.isClock ? "Тактовый сигнал (Clock) включен" : "Обозначить как тактовый сигнал (Clock)"}
                              >
                                CLK
                              </button>
                              <button
                                type="button"
                                className="cad-icon-btn"
                                style={{ width: 16, height: 18, padding: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMovePin(pin.id, "up");
                                }}
                                disabled={pinGlobalIdx === 0}
                                title="Переместить вверх"
                              >
                                <ChevronUp size={11} />
                              </button>
                              <button
                                type="button"
                                className="cad-icon-btn"
                                style={{ width: 16, height: 18, padding: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMovePin(pin.id, "down");
                                }}
                                disabled={pinGlobalIdx === logicalPins.length - 1}
                                title="Переместить вниз"
                              >
                                <ChevronDown size={11} />
                              </button>
                              <button
                                type="button"
                                className="cad-icon-btn danger"
                                style={{ width: 16, height: 18, padding: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePin(pin.id);
                                }}
                                title="Удалить вывод"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Интерактивная строка добавления вывода внизу списка */}
              {filteredLogicalPins.length > 0 && (
                <div
                  className="cad-pin-add-row"
                  onClick={handleAddPin}
                  title="Нажмите для добавления нового вывода"
                >
                  <Plus size={13} />
                  <span>Добавить вывод</span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>(или Enter в строке)</span>
                </div>
              )}
            </div>

            {/* Статусная строка внизу карточки */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 6,
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                fontSize: 10,
                color: "var(--cad-text-dim)",
                flexShrink: 0,
                gap: 8,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title="Кликните на вывод в таблице для сопоставления с площадкой корпуса">
                💡 Клик по выводу для сопоставления с площадкой
              </span>
              <span style={{ color: "var(--cad-text-muted)", flexShrink: 0, fontSize: 9.5, display: "flex", alignItems: "center", gap: 6 }}>
                <span><span className="cad-kbd">Enter</span> след. строка</span>
                <span>•</span>
                <span><span className="cad-kbd">Ins</span> добавить</span>
              </span>
            </div>
          </div>
        </div>

          {/* Правая колонка Вкладки 2: Сопоставление выводов схемы с контактными площадками (Pin-to-Pad Mapping) */}
          <div className="device-col">
            {/* Карточка: Таблица сопоставления выводов */}
            <div className="device-card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="device-card-header" style={{ flexWrap: "nowrap", gap: 6, paddingBottom: 6 }}>
                <div className="device-card-title" style={{ flexShrink: 0, gap: 5, fontSize: 10.5 }}>
                  <ArrowRightLeft size={13} color="var(--cad-accent-hover)" />
                  <span>Сопоставление</span>
                  {currentMapping && (
                    <span
                      className={`mapping-coverage-pill ${mappingCoverage.isFullyReady ? "complete" : "partial"}`}
                      style={{ padding: "1px 6px", fontSize: 9.5, textTransform: "none" }}
                      title={
                        mappingCoverage.isFullyReady
                          ? "Все выводы схемы и площадки корпуса полностью сопоставлены!"
                          : mappingCoverage.unassignedPadCount > 0
                          ? `Привязано ${mappingCoverage.mapped}/${mappingCoverage.total} выводов, но в корпусе свободно ${mappingCoverage.unassignedPadCount} площадок!`
                          : `Привязано ${mappingCoverage.mapped} из ${mappingCoverage.total} выводов`
                      }
                    >
                      {mappingCoverage.isFullyReady ? <CheckCircle2 size={9} /> : null}
                      {mappingCoverage.mapped}/{mappingCoverage.total}
                      {mappingCoverage.unassignedPadCount > 0 ? ` (${mappingCoverage.unassignedPadCount} своб.)` : ` (${mappingCoverage.percent}%)`}
                    </span>
                  )}
                </div>

                {currentPkgDef && (
                  <div className="mapping-header-actions">
                    <div
                      className={`auto-advance-badge ${isAutoAdvanceEnabled ? "active" : ""}`}
                      onClick={() => setIsAutoAdvanceEnabled(!isAutoAdvanceEnabled)}
                      title="Автоматический переход к следующему свободному выводу схемы при клике на чертеже футпринта"
                      style={{ padding: "2px 6px" }}
                    >
                      <Zap size={10} />
                      <span>Авто-шаг</span>
                    </div>
                    <div className="mapping-header-divider" />
                    <button
                      type="button"
                      className="cad-btn-secondary mapping-action-btn"
                      onClick={handleSmartAutoMap}
                      title="Умное сопоставление по совпадению имен, синонимов питания/земли и номеров выводов"
                    >
                      <Zap size={11} color="#38bdf8" /> По именам
                    </button>
                    <button
                      type="button"
                      className="cad-btn-secondary mapping-action-btn"
                      onClick={handleAutoMapSequential}
                      title="Последовательно связать выводы с площадками 1:1 по порядку"
                    >
                      1:1
                    </button>
                    <button
                      type="button"
                      className="cad-btn-secondary mapping-action-btn"
                      onClick={handleClearMapping}
                      title="Сбросить назначение всех площадок"
                    >
                      <RotateCcw size={11} /> Сброс
                    </button>
                  </div>
                )}
              </div>

              {currentPkgDef && currentMapping ? (
                <>
                  {/* Элегантная информационная полоса активного корпуса */}
                  <div className="mapping-sub-pkg-bar">
                    <div className="mapping-sub-pkg-info">
                      <Box size={13} color="#60a5fa" style={{ flexShrink: 0 }} />
                      {supportedPackages.length > 1 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                          <span style={{ fontSize: 10, color: "var(--cad-text-dim)", flexShrink: 0 }}>Корпус:</span>
                          <select
                            value={activePackageId}
                            onChange={(e) => setActivePackageId(e.target.value)}
                            className="cad-input mapping-pkg-select"
                            title="Выбрать привязанный корпус для настройки распиновки"
                          >
                            {supportedPackages.map((b) => {
                              const p = availablePackages.find((ap) => ap.id === b.packageId);
                              const r = getPackageReadiness(b);
                              const padSuffix =
                                r.unassignedPadCount > 0
                                  ? ` • ${r.unassignedPadCount} своб. pad`
                                  : r.padCount > 0
                                  ? ` • ${r.padCount} pad`
                                  : "";
                              return (
                                <option key={b.packageId} value={b.packageId}>
                                  {p?.name || b.packageId} ({r.mapped}/{r.total} выв.{padSuffix})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : (
                        <span className="mapping-sub-pkg-name" title={currentPkgDef.name}>
                          {currentPkgDef.name}
                        </span>
                      )}
                      <span className="mapping-sub-pkg-dot">•</span>
                      <span className="mapping-sub-pkg-tag">{currentPkgDef.mountType.toUpperCase()}</span>
                      <span className="mapping-sub-pkg-dot">•</span>
                      <span className="mapping-sub-pkg-tag">{currentPkgDef.pads.length} площадок</span>
                    </div>
                    {currentPkgDef.variants && currentPkgDef.variants.length > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, color: "var(--cad-text-dim)" }}>Вариант:</span>
                        <select
                          value={currentMapping?.defaultVariantId || currentPkgDef.defaultVariantId}
                          onChange={(e) => handleSelectDefaultVariant(currentPkgDef.id, e.target.value)}
                          className="cad-input"
                          style={{ fontSize: 10, padding: "1px 5px", height: 20 }}
                        >
                          {currentPkgDef.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Интерактивный предпросмотр посадочного места */}
                  <div className="mapping-preview-wrapper" style={{ height: 135 }}>
                    <FootprintPreview
                      packageDef={currentPkgDef}
                      variant={currentPkgDef.variants?.find((v) => v.id === (currentMapping.defaultVariantId || currentPkgDef.defaultVariantId))}
                      showDimensions={false}
                      interactive={true}
                      selectedPadNum={activePadNum}
                      onSelectPad={handlePadSelect}
                      padLabels={padLabels}
                      padColors={padColors}
                      unassignedPadNums={unassignedPadNums}
                      height={135}
                    />
                  </div>

                  {/* Полоска-подсказка под предпросмотром */}
                  <div className="mapping-preview-hint">
                    <Sparkles size={11} color="var(--cad-accent-hover)" />
                    <span>Клик по площадке чертежа привязывает её к выбранному выводу</span>
                    {isAutoAdvanceEnabled && (
                      <span className="auto-step-tag">⚡ Авто-шаг активен</span>
                    )}
                  </div>

                  {/* Список свободных контактных площадок корпуса */}
                  {unassignedPads.length > 0 && (
                    <div className="unassigned-pads-bar" style={{ flexShrink: 0 }}>
                      <span style={{ color: "var(--cad-text-muted)", fontSize: 10 }}>
                        Свободные площадки ({unassignedPads.length}):
                      </span>
                      {unassignedPads.map((p) => (
                        <span
                          key={p.padNum}
                          className="unassigned-pad-tag"
                          onClick={() => handlePadSelect(p.padNum)}
                          title={`Нажмите для привязки площадки #${p.padNum} к выбранному выводу`}
                        >
                          #{p.padNum}
                          {p.name ? ` (${p.name})` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Панель фильтров и поиска для сопоставления */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "2px 0",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className={`mapping-filter-tab ${mappingFilter === "all" ? "active" : ""}`}
                        onClick={() => setMappingFilter("all")}
                      >
                        Все ({logicalPins.length})
                      </button>
                      <button
                        type="button"
                        className={`mapping-filter-tab ${mappingFilter === "unmapped" ? "active" : ""}`}
                        onClick={() => setMappingFilter("unmapped")}
                      >
                        Непривязанные ({unmappedCount})
                      </button>
                      {conflictCount > 0 && (
                        <button
                          type="button"
                          className={`mapping-filter-tab ${mappingFilter === "conflicts" ? "active" : ""}`}
                          style={{ color: "#ef4444" }}
                          onClick={() => setMappingFilter("conflicts")}
                        >
                          <AlertTriangle size={10} /> Конфликты ({conflictCount})
                        </button>
                      )}
                    </div>

                    <div style={{ position: "relative", width: 130, display: "flex", alignItems: "center" }}>
                      <Search size={10} style={{ position: "absolute", left: 6, color: "var(--cad-text-dim)" }} />
                      <input
                        type="text"
                        value={mappingSearchQuery}
                        onChange={(e) => setMappingSearchQuery(e.target.value)}
                        placeholder="Поиск сигнала..."
                        className="cad-input"
                        style={{ width: "100%", padding: "2px 6px 2px 20px", fontSize: 10, height: 22 }}
                      />
                      {mappingSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMappingSearchQuery("")}
                          style={{ position: "absolute", right: 4, background: "none", border: "none", color: "var(--cad-text-dim)", cursor: "pointer", padding: 0 }}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Таблица сопоставления выводов */}
                  <div className="device-table-container">
                    <table className="device-table">
                      <thead>
                        <tr>
                          <th style={{ width: 160 }}>Вывод схемы (УГО)</th>
                          <th style={{ width: 24, textAlign: "center" }}></th>
                          <th>Площадка корпуса (Pad)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappingFilteredPins.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ textAlign: "center", padding: "28px 10px", color: "#64748b" }}>
                              {mappingFilter === "unmapped"
                                ? "🎉 Все выводы успешно привязаны к площадкам корпуса!"
                                : mappingFilter === "conflicts"
                                ? "Конфликтов сопоставления не обнаружено."
                                : "Нет выводов, соответствующих поиску."}
                            </td>
                          </tr>
                        ) : (
                          mappingFilteredPins.map((pin) => {
                          const assignedPad = currentMapping.pinMap[pin.name] || "";
                          const typeCfg =
                            ELECTRICAL_TYPES.find((t) => t.value === pin.electricalType) ||
                            ELECTRICAL_TYPES[5];
                          const isSelected = selectedPinId === pin.id;
                          const hasConflict = assignedPad && (padUsageCount[assignedPad] || []).length > 1;

                          return (
                            <tr
                              key={pin.id}
                              className={`${isSelected ? "active-mapping-row" : ""} ${hasConflict ? "conflict-mapping-row" : ""}`}
                              onClick={() => {
                                setSelectedPinId(pin.id);
                                if (assignedPad) setActivePadNum(assignedPad);
                              }}
                            >
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span
                                    className="pin-type-dot"
                                    style={{ backgroundColor: typeCfg.color }}
                                  />
                                  <span
                                    style={{
                                      fontFamily: "var(--cad-font-mono)",
                                      fontWeight: "bold",
                                      color: isSelected ? "var(--cad-accent-hover)" : "var(--cad-text-main)",
                                      fontSize: 12,
                                    }}
                                  >
                                    {pin.name}
                                  </span>
                                  {pin.unit && (
                                    <span
                                      style={{
                                        fontSize: 9.5,
                                        background: "rgba(59, 130, 246, 0.15)",
                                        color: "var(--cad-accent-hover)",
                                        padding: "0 4px",
                                        borderRadius: 3,
                                        fontWeight: 600,
                                        fontFamily: "var(--cad-font-mono)",
                                      }}
                                      title={`Секция ${pin.unit}`}
                                    >
                                      [{pin.unit}]
                                    </span>
                                  )}
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--cad-text-dim)",
                                      marginLeft: "auto",
                                    }}
                                  >
                                    {typeCfg.shortLabel}
                                  </span>
                                </div>
                              </td>

                              <td style={{ textAlign: "center", color: "var(--cad-text-dim)" }}>
                                <ArrowRight size={12} />
                              </td>

                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div className={`mapping-pad-select-wrap ${hasConflict ? "conflict" : ""}`}>
                                    <select
                                      value={assignedPad}
                                      onChange={(e) => {
                                        handleUpdatePinMapping(pin.name, e.target.value);
                                        setActivePadNum(e.target.value || null);
                                      }}
                                      className="mapping-pad-select"
                                      style={{
                                        borderColor: hasConflict
                                          ? "#ef4444"
                                          : assignedPad
                                          ? "rgba(59, 130, 246, 0.4)"
                                          : "rgba(245, 158, 11, 0.35)",
                                      }}
                                    >
                                      <option value="">— Не подключен —</option>
                                      {currentPkgDef.pads.map((pad) => {
                                        const occupiedBy = Object.entries(currentMapping.pinMap).find(
                                          ([pName, pNum]) => pNum === pad.padNum && pName !== pin.name
                                        );
                                        return (
                                          <option key={pad.padNum} value={pad.padNum}>
                                            Pad #{pad.padNum} {pad.name ? `(${pad.name})` : ""} [{pad.shape}]
                                            {occupiedBy ? ` — занят (${occupiedBy[0]})` : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <div
                                      className={`mapping-status-indicator ${
                                        hasConflict ? "conflict" : assignedPad ? "assigned" : "unassigned"
                                      }`}
                                      title={
                                        hasConflict
                                          ? "Конфликт назначения площадки!"
                                          : assignedPad
                                          ? `Подключено к Pad #${assignedPad}`
                                          : "Вывод не назначен"
                                      }
                                    />
                                    {assignedPad && (
                                      <button
                                        type="button"
                                        className="cad-icon-btn"
                                        style={{ width: 20, height: 20, padding: 0, opacity: 0.6, flexShrink: 0 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdatePinMapping(pin.name, "");
                                          setActivePadNum(null);
                                        }}
                                        title="Отвязать площадку от этого вывода"
                                      >
                                        <X size={11} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Предупреждение о конфликте, если площадка назначена нескольким выводам */}
                                  {hasConflict && (
                                    <div style={{ fontSize: 9.5, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                                      <AlertTriangle size={10} />
                                      Площадка #{assignedPad} назначена нескольким выводам: {padUsageCount[assignedPad].join(", ")}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    color: "var(--cad-text-dim)",
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <Box size={36} color="var(--cad-border)" />
                  <div style={{ fontSize: 13, color: "var(--cad-text-muted)" }}>
                    Корпус не выбран
                  </div>
                  <div style={{ fontSize: 11, maxWidth: 280 }}>
                    Нажмите кнопку «Выбрать из библиотеки...» выше для добавления посадочного места и настройки сопоставления выводов.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>

        {/* Подвал модального окна */}
        <div className="cad-modal-footer" style={{ padding: "10px 18px" }}>
          <button type="button" className="cad-btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="cad-btn-primary" onClick={handleSave}>
            <Save size={13} />
            <span>Сохранить деталь</span>
          </button>
        </div>
      </div>

      {/* Модальный диалог: Визуальный выбор корпуса из библиотеки */}
      {isPkgPickerOpen && (
        <div className="pkg-picker-overlay" onClick={() => setIsPkgPickerOpen(false)}>
          <div className="pkg-picker-box" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-picker-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Box size={16} color="var(--cad-accent-hover)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cad-text-main)" }}>
                  Библиотека посадочных мест (Footprints)
                </span>
                <span className="device-chip-count">{availablePackages.length} доступно</span>
              </div>
              <button
                type="button"
                className="cad-modal-close-btn"
                onClick={() => setIsPkgPickerOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Панель поиска и фильтров монтажа */}
            <div className="pkg-picker-searchbar">
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <Search size={12} style={{ position: "absolute", left: 8, color: "var(--cad-text-dim)" }} />
                <input
                  type="text"
                  value={pkgPickerSearch}
                  onChange={(e) => setPkgPickerSearch(e.target.value)}
                  placeholder="Поиск по названию (SOIC, DIP, 0805, QFP, TO-220...)"
                  className="cad-input"
                  style={{ width: "100%", padding: "4px 8px 4px 26px", fontSize: 11 }}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className={`pkg-picker-filter-btn ${pkgPickerMountFilter === "all" ? "active" : ""}`}
                  onClick={() => setPkgPickerMountFilter("all")}
                >
                  Все
                </button>
                <button
                  type="button"
                  className={`pkg-picker-filter-btn ${pkgPickerMountFilter === "smd" ? "active" : ""}`}
                  onClick={() => setPkgPickerMountFilter("smd")}
                >
                  SMD
                </button>
                <button
                  type="button"
                  className={`pkg-picker-filter-btn ${pkgPickerMountFilter === "tht" ? "active" : ""}`}
                  onClick={() => setPkgPickerMountFilter("tht")}
                >
                  THT
                </button>
              </div>
            </div>

            {/* Сетка карточек доступных корпусов с мини-превью */}
            <div className="pkg-picker-grid">
              {availablePackages
                .filter((pkg) => {
                  if (pkgPickerMountFilter !== "all" && pkg.mountType !== pkgPickerMountFilter) {
                    return false;
                  }
                  if (pkgPickerSearch.trim()) {
                    const q = pkgPickerSearch.trim().toLowerCase();
                    const matchName = pkg.name.toLowerCase().includes(q);
                    const matchStd = (pkg.standard || "").toLowerCase().includes(q);
                    const matchFam = (pkg.family || "").toLowerCase().includes(q);
                    if (!matchName && !matchStd && !matchFam) return false;
                  }
                  return true;
                })
                .map((pkg) => {
                  const isBound = supportedPackages.some((p) => p.packageId === pkg.id);
                  const isPadMatch = pkg.pads.length === logicalPins.length;

                  return (
                    <div
                      key={pkg.id}
                      className={`pkg-picker-card ${isBound ? "is-bound" : ""}`}
                      onClick={() => !isBound && handleAddPackageBinding(pkg.id)}
                      title={isBound ? "Этот корпус уже привязан к детали" : `Привязать корпус ${pkg.name}`}
                    >
                      <div className="pkg-picker-card-preview">
                        <FootprintPreview
                          packageDef={pkg}
                          height={90}
                          showDimensions={false}
                          interactive={false}
                          showGrid={false}
                        />
                      </div>
                      <div className="pkg-picker-card-title">{pkg.name}</div>
                      <div className="pkg-picker-card-meta">
                        <span className={`pkg-picker-badge ${pkg.mountType}`}>
                          {pkg.mountType.toUpperCase()}
                        </span>
                        <span>
                          {pkg.bodyWidth.toFixed(1)} × {pkg.bodyHeight.toFixed(1)} мм
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: isBound
                            ? "var(--cad-text-dim)"
                            : isPadMatch
                            ? "var(--cad-net-active, #10b981)"
                            : "var(--cad-text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{pkg.pads.length} площадок</span>
                        {isBound ? (
                          <span style={{ color: "#38bdf8" }}>✓ Привязан</span>
                        ) : isPadMatch ? (
                          <span>🎯 Совпадает</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Модальный диалог: Пакетный генератор выводов */}
      {isPinGenOpen && (
        <div className="pkg-picker-overlay" onClick={() => setIsPinGenOpen(false)}>
          <div className="pin-gen-box" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-picker-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ListPlus size={16} color="var(--cad-accent-hover)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cad-text-main)" }}>
                  Генератор серий и шин выводов
                </span>
              </div>
              <button
                type="button"
                className="cad-modal-close-btn"
                onClick={() => setIsPinGenOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Вкладки режима: диапазон vs список */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--cad-border)" }}>
              <button
                type="button"
                className={`pin-gen-tab-btn ${pinGenMode === "range" ? "active" : ""}`}
                onClick={() => setPinGenMode("range")}
              >
                Диапазон индексов (D0..D7, 1..16)
              </button>
              <button
                type="button"
                className={`pin-gen-tab-btn ${pinGenMode === "list" ? "active" : ""}`}
                onClick={() => setPinGenMode("list")}
              >
                Вставка списка текстом
              </button>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {pinGenMode === "range" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Префикс имени:</label>
                      <input
                        type="text"
                        value={pinGenPrefix}
                        onChange={(e) => setPinGenPrefix(e.target.value)}
                        placeholder="D, A, GPIO, PIN, или пусто"
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Начальный №:</label>
                      <input
                        type="number"
                        value={pinGenStart}
                        onChange={(e) => setPinGenStart(parseInt(e.target.value) || 0)}
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Конечный №:</label>
                      <input
                        type="number"
                        value={pinGenEnd}
                        onChange={(e) => setPinGenEnd(parseInt(e.target.value) || 0)}
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: "var(--cad-text-muted)", background: "rgba(0,0,0,0.25)", padding: "6px 10px", borderRadius: 6 }}>
                    Будет сгенерировано: <strong>{Math.abs(pinGenEnd - pinGenStart) + 1}</strong> выводов:{" "}
                    <span style={{ color: "var(--cad-accent-hover)", fontFamily: "monospace" }}>
                      {Array.from(
                        { length: Math.min(6, Math.abs(pinGenEnd - pinGenStart) + 1) },
                        (_, i) => `${pinGenPrefix}${Math.min(pinGenStart, pinGenEnd) + i}`
                      ).join(", ")}
                      {Math.abs(pinGenEnd - pinGenStart) + 1 > 6 ? "..." : ""}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Список выводов (через запятую или перевод строки):</label>
                  <textarea
                    value={pinGenList}
                    onChange={(e) => setPinGenList(e.target.value)}
                    placeholder="VCC, GND, TXD, RXD, CTS, RTS, DTR, DSR"
                    className="cad-input"
                    rows={4}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 11, resize: "vertical" }}
                  />
                </div>
              )}

              {/* Общие настройки для генерируемых выводов */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Тип сигнала по умолчанию:</label>
                  <select
                    value={pinGenType}
                    onChange={(e) => setPinGenType(e.target.value as PinElectricalType)}
                    className="cad-input"
                    style={{ width: "100%", padding: "4px 6px", fontSize: 11 }}
                  >
                    {ELECTRICAL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Секция УГО (Unit / Вентиль):</label>
                  <input
                    type="text"
                    value={pinGenUnit}
                    onChange={(e) => setPinGenUnit(e.target.value.toUpperCase())}
                    placeholder="A, B или пусто"
                    maxLength={4}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
              </div>
            </div>

            <div className="cad-modal-footer" style={{ padding: "10px 16px" }}>
              <button
                type="button"
                className="cad-btn-secondary"
                onClick={() => setIsPinGenOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="cad-btn-primary"
                onClick={handleExecutePinGen}
              >
                <Plus size={12} />
                <span>Создать выводы</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальный диалог: Массовый импорт таблицы выводов из буфера обмена */}
      {isBulkImportOpen && (
        <div className="pkg-picker-overlay" onClick={() => setIsBulkImportOpen(false)}>
          <div className="bulk-import-box" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-picker-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={16} color="var(--cad-accent-hover)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cad-text-main)" }}>
                  Массовый импорт выводов из таблицы (Datasheet / Excel / CSV)
                </span>
              </div>
              <button
                type="button"
                className="cad-modal-close-btn"
                onClick={() => setIsBulkImportOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              <div style={{ fontSize: 11, color: "var(--cad-text-muted)", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 6, padding: "8px 12px" }}>
                💡 <strong>Как использовать:</strong> скопируйте таблицу выводов из PDF-даташита, таблицы Excel или CSV и вставьте в поле ниже.
                Автоматически определяются: номер, имя вывода, тип сигнала (VCC, GND, IN, OUT, NC) и описание.
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 10.5, marginBottom: 4 }}>
                  Вставьте скопированный текст (разделители: Tab, точка с запятой, запятая или пробелы):
                </label>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder={"Пример скопированных строк:\n1\tVCC\tPower In\tПитание микросхемы 3.3В\n2\tGND\tGround\tОбщий провод\n3\tPA0\tInput\tКнопка включения\n4\tPA1\tOutput\tСветодиод статуса"}
                  className="bulk-import-textarea"
                  autoFocus
                />
              </div>

              {/* Живой предпросмотр распознанных строк */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>
                    Распознано выводов:{" "}
                    <span style={{ color: "var(--cad-accent-hover)" }}>
                      {parseBulkImportText(bulkImportText).length} шт.
                    </span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--cad-text-muted)" }}>
                      <input
                        type="radio"
                        name="bulkImportMode"
                        checked={bulkImportMode === "append"}
                        onChange={() => setBulkImportMode("append")}
                      />
                      <span>Добавить к существующим ({logicalPins.length})</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "var(--cad-text-muted)" }}>
                      <input
                        type="radio"
                        name="bulkImportMode"
                        checked={bulkImportMode === "replace"}
                        onChange={() => setBulkImportMode("replace")}
                      />
                      <span style={{ color: bulkImportMode === "replace" ? "#ef4444" : undefined }}>Заменить все текущие выводы</span>
                    </label>
                  </div>
                </div>

                <div className="device-table-container" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                  <table className="device-table">
                    <thead>
                      <tr>
                        <th style={{ width: 34, textAlign: "center" }}>#</th>
                        <th style={{ width: 100 }}>Имя вывода</th>
                        <th style={{ width: 140 }}>Тип сигнала</th>
                        <th style={{ width: 50, textAlign: "center" }}>Секция</th>
                        <th>Описание / Примечание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseBulkImportText(bulkImportText).length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: "24px 10px", color: "var(--cad-text-dim)" }}>
                            Вставьте строки в поле выше для предпросмотра
                          </td>
                        </tr>
                      ) : (
                        parseBulkImportText(bulkImportText).slice(0, 50).map((item, idx) => {
                          const typeCfg =
                            ELECTRICAL_TYPES.find((t) => t.value === item.electricalType) ||
                            ELECTRICAL_TYPES[5];
                          return (
                            <tr key={idx}>
                              <td style={{ textAlign: "center", color: "#64748b", fontFamily: "monospace", fontSize: 10 }}>
                                {idx + 1}
                              </td>
                              <td style={{ fontWeight: "bold", fontFamily: "monospace", color: "var(--cad-accent-hover)" }}>
                                {item.name}
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    fontSize: 10,
                                    background: "rgba(255,255,255,0.04)",
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      backgroundColor: typeCfg.color,
                                    }}
                                  />
                                  <span>{typeCfg.shortLabel}</span>
                                </span>
                              </td>
                              <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 10.5 }}>
                                {item.unit || "—"}
                              </td>
                              <td style={{ fontSize: 10.5, color: "var(--cad-text-muted)" }}>
                                {item.description || "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="cad-modal-footer" style={{ padding: "10px 16px" }}>
              <button
                type="button"
                className="cad-btn-secondary"
                onClick={() => setIsBulkImportOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="cad-btn-primary"
                disabled={parseBulkImportText(bulkImportText).length === 0}
                onClick={handleApplyBulkImport}
              >
                <Plus size={12} />
                <span>Импортировать ({parseBulkImportText(bulkImportText).length} выводов)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
