// src/components/Modals/ComponentLibraryModal.tsx
// Центральный браузер и менеджер библиотеки компонентов и посадочных мест MyCad

import React, { useState, useEffect, useMemo } from "react";
import {
  PackageDefinition,
  DeviceDefinition,
} from "../../types/componentLibrary";
import { useLibraryStore } from "../../stores/libraryStore";
import { FootprintPreview } from "../SvgRenderer/FootprintPreview";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Layers,
  Cpu,
  Box,
  Check,
  X,
  Tag,
  Folder,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
  Plug,
  Crosshair,
  Grid,
  Activity,
  CircleDot,
} from "lucide-react";

interface ComponentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPackageEditor: (pkg?: PackageDefinition | null) => void;
  onOpenDeviceEditor: (dev?: DeviceDefinition | null) => void;
  onPlaceOnBoard?: (device: DeviceDefinition, packageDef: PackageDefinition) => void;
}

// Семейства корпусов для иерархического дерева
const PACKAGE_FAMILIES = [
  { id: "soic", name: "SOIC / SOP", match: (p: PackageDefinition) => p.family === "soic" || p.name.includes("SOIC") || p.name.includes("SOP") },
  { id: "dip", name: "DIP / SIP", match: (p: PackageDefinition) => p.family === "dip" || p.name.includes("DIP") || p.name.includes("SIP") },
  { id: "radial", name: "Radial (Выводные)", match: (p: PackageDefinition) => p.family === "radial" || p.name.includes("Radial") || p.name.includes("HC-49") },
  { id: "axial", name: "Axial (Осевые)", match: (p: PackageDefinition) => p.family === "axial" || p.name.includes("Axial") || p.name.includes("DO-") },
  { id: "chip_2pin", name: "Chip 2-Pin (0402..1206)", match: (p: PackageDefinition) => p.family === "chip_2pin" || /0402|0603|0805|1206|2010|2512/.test(p.name) },
  { id: "connector", name: "Разъемы и клеммники", match: (p: PackageDefinition) => p.family === "connector" || p.name.includes("USB") || p.name.includes("Conn") || p.name.includes("Header") || p.name.includes("Клемм") },
  { id: "switch", name: "Кнопки и реле", match: (p: PackageDefinition) => p.family === "switch" || p.name.includes("SW") || p.name.includes("Relay") || p.name.includes("Кнопка") || p.name.includes("Реле") },
  { id: "qfp", name: "QFP / QFN / BGA", match: (p: PackageDefinition) => p.family === "qfp" || p.name.includes("QFP") || p.name.includes("QFN") || p.name.includes("BGA") },
  { id: "to", name: "TO / SOT (Транзисторы)", match: (p: PackageDefinition) => p.family === "to" || p.family === "smd_discrete" || p.name.includes("TO-") || p.name.includes("SOT-") || p.name.includes("SOD-") },
  { id: "other", name: "Прочие корпуса", match: (p: PackageDefinition) => p.family === "other" || (!["soic","dip","radial","axial","chip_2pin","connector","switch","qfp","to"].includes(p.family || "")) },
];

// Фильтры по количеству контактов
const PIN_FILTERS = [
  { id: "2", label: "2 вывода", match: (p: PackageDefinition) => p.pads.length === 2 },
  { id: "3-4", label: "3–4 вывода", match: (p: PackageDefinition) => p.pads.length >= 3 && p.pads.length <= 4 },
  { id: "5-8", label: "5–8 выводов", match: (p: PackageDefinition) => p.pads.length >= 5 && p.pads.length <= 8 },
  { id: "9-16", label: "9–16 выводов", match: (p: PackageDefinition) => p.pads.length >= 9 && p.pads.length <= 16 },
  { id: "17+", label: "17+ выводов", match: (p: PackageDefinition) => p.pads.length >= 17 },
];

// Категории компонентов с подкатегориями
const DEVICE_TREE_CATEGORIES = [
  {
    id: "semiconductors",
    name: "Полупроводники",
    icon: Zap,
    color: "#f59e0b",
    matchCategory: (cat: string) => cat === "Полупроводники",
    subcategories: [
      { id: "leds", name: "Светодиоды и индикаторы", match: (d: DeviceDefinition) => d.id.includes("LED") || d.name.toLowerCase().includes("светодиод") },
      { id: "diodes", name: "Диоды и выпрямители", match: (d: DeviceDefinition) => d.id.includes("DIODE") || d.id.includes("1N") || d.name.toLowerCase().includes("диод") },
      { id: "transistors", name: "Транзисторы и ключи", match: (d: DeviceDefinition) => d.name.toLowerCase().includes("транзистор") || d.id.includes("FET") },
    ],
  },
  {
    id: "passives",
    name: "Пассивные компоненты",
    icon: Layers,
    color: "#06b6d4",
    matchCategory: (cat: string) => cat === "Пассивные компоненты",
    subcategories: [
      { id: "resistors", name: "Резисторы и триммеры", match: (d: DeviceDefinition) => d.id.includes("POT") || d.id.includes("TRIMMER") || d.name.toLowerCase().includes("резистор") || d.name.toLowerCase().includes("потенциометр") },
      { id: "crystals", name: "Кварцевые резонаторы", match: (d: DeviceDefinition) => d.id.includes("CRYSTAL") || d.name.toLowerCase().includes("кварц") },
      { id: "buzzers", name: "Пьезозуммеры и звук", match: (d: DeviceDefinition) => d.id.includes("BUZZER") || d.name.toLowerCase().includes("зуммер") },
      { id: "capacitors", name: "Конденсаторы MLCC", match: (d: DeviceDefinition) => d.name.toLowerCase().includes("конденсатор") || d.id.includes("CAP") },
    ],
  },
  {
    id: "ics",
    name: "Интегральные микросхемы (IC)",
    icon: Cpu,
    color: "#a855f7",
    matchCategory: (cat: string) => cat === "Интегральные микросхемы (IC)" || cat === "Интегральные микросхемы" || cat === "Микроконтроллеры и ИМС",
    subcategories: [
      { id: "mcu", name: "Микроконтроллеры и модули", match: (d: DeviceDefinition) => d.id.includes("ESP") || d.id.includes("MCU") || d.name.toLowerCase().includes("модуль") },
      { id: "logic", name: "Логика и усилители", match: (d: DeviceDefinition) => d.name.toLowerCase().includes("логика") || d.id.includes("74") },
    ],
  },
  {
    id: "connectors",
    name: "Разъемы и коммутация",
    icon: Plug,
    color: "#10b981",
    matchCategory: (cat: string) => cat === "Разъемы и коммутация" || cat === "Электромеханика",
    subcategories: [
      { id: "buttons", name: "Тактовые кнопки", match: (d: DeviceDefinition) => d.id.includes("BUTTON") || d.id.includes("SW") || d.name.toLowerCase().includes("кнопка") },
      { id: "relays", name: "Силовые реле", match: (d: DeviceDefinition) => d.id.includes("RELAY") || d.name.toLowerCase().includes("реле") },
      { id: "terminals", name: "Клеммы и разъемы", match: (d: DeviceDefinition) => d.name.toLowerCase().includes("разъем") || d.name.toLowerCase().includes("клемм") },
    ],
  },
  {
    id: "hardware",
    name: "Служебные, датчики и питание",
    icon: Crosshair,
    color: "#ec4899",
    matchCategory: (cat: string) => cat === "Служебные, механика и датчики" || cat === "Датчики и измерительные модули" || cat === "Источники питания",
    subcategories: [
      { id: "sensors", name: "Датчики температуры и др.", match: (d: DeviceDefinition) => d.id.includes("SENSOR") || d.id.includes("DHT") || d.name.toLowerCase().includes("датчик") },
      { id: "power", name: "Держатели батарей и питание", match: (d: DeviceDefinition) => d.id.includes("BATTERY") || d.name.toLowerCase().includes("батарейк") || d.name.toLowerCase().includes("питани") },
    ],
  },
];

export const ComponentLibraryModal: React.FC<ComponentLibraryModalProps> = ({
  isOpen,
  onClose,
  onOpenPackageEditor,
  onOpenDeviceEditor,
  onPlaceOnBoard,
}) => {
  const {
    packages,
    devices,
    categories,
    loadAll,
    deletePackage,
    deleteDevice,
    exportLibrary,
    importLibrary,
  } = useLibraryStore();

  const [activeTab, setActiveTab] = useState<"devices" | "packages">("packages");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Фильтры дерева компонентов
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");

  // Фильтры дерева корпусов
  const [selectedMount, setSelectedMount] = useState<string>("all");
  const [selectedPackageFamily, setSelectedPackageFamily] = useState<string>("all");
  const [selectedPinFilter, setSelectedPinFilter] = useState<string>("all");

  // Раскрытие разделов дерева
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    semiconductors: true,
    passives: true,
    ics: false,
    connectors: false,
    hardware: false,
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    mountType: true,
    families: true,
    pins: false,
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAll().then((payload) => {
        if (payload && payload.devices && payload.devices.length > 0) {
          setActiveTab("devices");
        } else {
          setActiveTab("packages");
        }
      });
    }
  }, [isOpen, loadAll]);

  // Пользовательские категории, не вошедшие в стандартный список
  const customCategories = useMemo(() => {
    const standardMatch = (cat: string) => DEVICE_TREE_CATEGORIES.some((c) => c.matchCategory(cat));
    const set = new Set<string>();
    devices.forEach((d) => {
      if (d.category && !standardMatch(d.category)) {
        set.add(d.category);
      }
    });
    return Array.from(set);
  }, [devices]);

  // Фильтрация радиокомпонентов
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (selectedCategory !== "all") {
        const catConfig = DEVICE_TREE_CATEGORIES.find((c) => c.id === selectedCategory);
        if (catConfig) {
          if (!catConfig.matchCategory(d.category)) return false;
          if (selectedSubcategory !== "all") {
            const sub = catConfig.subcategories.find((s) => s.id === selectedSubcategory);
            if (sub && !sub.match(d)) return false;
          }
        } else {
          if (d.category !== selectedCategory) return false;
        }
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.parameters?.value && d.parameters.value.toLowerCase().includes(q))
      );
    });
  }, [devices, selectedCategory, selectedSubcategory, searchQuery]);

  // Фильтрация корпусов
  const filteredPackages = useMemo(() => {
    return packages.filter((p) => {
      if (selectedMount !== "all" && p.mountType !== selectedMount) return false;
      if (selectedPackageFamily !== "all") {
        const fam = PACKAGE_FAMILIES.find((f) => f.id === selectedPackageFamily);
        if (fam && !fam.match(p)) return false;
      }
      if (selectedPinFilter !== "all") {
        const pf = PIN_FILTERS.find((f) => f.id === selectedPinFilter);
        if (pf && !pf.match(p)) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.standard && p.standard.toLowerCase().includes(q)) ||
        (p.family && p.family.toLowerCase().includes(q))
      );
    });
  }, [packages, selectedMount, selectedPackageFamily, selectedPinFilter, searchQuery]);

  // Текущие выбранные элементы
  const activeDevice = devices.find((d) => d.id === selectedDeviceId) || filteredDevices[0];
  const activePackage =
    activeTab === "devices"
      ? packages.find((p) => p.id === activeDevice?.supportedPackages?.[0]?.packageId) || packages[0]
      : packages.find((p) => p.id === selectedPackageId) || filteredPackages[0];

  if (!isOpen) return null;

  const handleExport = async () => {
    const json = await exportLibrary();
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mycad_library_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const count = await importLibrary(text);
      alert(`Успешно импортировано элементов: ${count}`);
    };
    input.click();
  };

  const handlePlaceOnBoardAction = () => {
    if (!onPlaceOnBoard) return;
    if (activeTab === "devices" && activeDevice && activePackage) {
      onPlaceOnBoard(activeDevice, activePackage);
      onClose();
    } else if (activePackage) {
      const genericDev: DeviceDefinition = {
        id: `dev_${activePackage.id}`,
        name: activePackage.name,
        category: activePackage.standard || "Корпуса",
        subcategory: "",
        designatorPrefix: activePackage.family === "discrete" ? "R" : "U",
        description: activePackage.name,
        tags: [],
        parameters: {},
        logicalPins: activePackage.pads.map((p) => ({
          id: p.padNum,
          name: p.name || p.padNum,
          electricalType: "passive",
        })),
        supportedPackages: [
          {
            packageId: activePackage.id,
            defaultVariantId: activePackage.defaultVariantId,
            pinMap: Object.fromEntries(activePackage.pads.map((p) => [p.padNum, p.padNum])),
          },
        ],
      };
      onPlaceOnBoard(genericDev, activePackage);
      onClose();
    }
  };

  const toggleCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const smdCount = packages.filter((p) => p.mountType === "smd").length;
  const thtCount = packages.filter((p) => p.mountType === "tht").length;

  return (
    <div className="cad-modal-backdrop" onClick={onClose}>
      <div
        className="cad-modal-box modal-fullscreen"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Шапка модального окна */}
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="cad-modal-icon-badge">
              <Cpu size={18} color="var(--cad-accent-hover)" />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--cad-text-main)", letterSpacing: "-0.2px" }}>
                Библиотека компонентов и посадочных мест
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Каталог стандартных и пользовательских радиоэлементов и посадочных мест
              </div>
            </div>

            {/* Переключатель вкладок: Радиодетали / Корпуса */}
            <div
              style={{
                display: "flex",
                background: "var(--cad-bg-surface, #141820)",
                borderRadius: 8,
                padding: 3,
                border: "1px solid var(--cad-border, #283344)",
                marginLeft: 12,
              }}
            >
              <button
                onClick={() => {
                  setActiveTab("devices");
                  setSelectedCategory("all");
                  setSelectedSubcategory("all");
                }}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: activeTab === "devices" ? 700 : 500,
                  background: activeTab === "devices" ? "var(--cad-accent, #3b82f6)" : "transparent",
                  color: activeTab === "devices" ? "#ffffff" : "var(--cad-text-muted, #94a3b8)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Layers size={13} />
                <span>Радиокомпоненты ({devices.length})</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("packages");
                  setSelectedMount("all");
                  setSelectedPackageFamily("all");
                  setSelectedPinFilter("all");
                }}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: activeTab === "packages" ? 700 : 500,
                  background: activeTab === "packages" ? "var(--cad-accent, #3b82f6)" : "transparent",
                  color: activeTab === "packages" ? "#ffffff" : "var(--cad-text-muted, #94a3b8)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Box size={13} />
                <span>Корпуса и посадочные места ({packages.length})</span>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="cad-modal-close-btn" onClick={onClose} title="Закрыть (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Панель поиска и быстрых действий */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            background: "var(--cad-bg-panel, #181d26)",
            borderBottom: "1px solid var(--cad-border, #283344)",
            gap: 12,
          }}
        >
          {/* Поиск */}
          <div style={{ position: "relative", width: 340 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--cad-text-dim, #64748b)",
              }}
            />
            <input
              type="text"
              className="cad-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "devices"
                  ? "Поиск по названию, номиналу, тегам..."
                  : "Поиск корпуса по имени, стандарту, семейству..."
              }
              style={{ width: "100%", paddingLeft: 30, fontSize: 12, paddingRight: 26 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--cad-text-dim, #64748b)",
                  cursor: "pointer",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Индикатор количества */}
          <div style={{ fontSize: 12, color: "var(--cad-text-muted)" }}>
            Найдено:{" "}
            <strong style={{ color: "var(--cad-text-main)" }}>
              {activeTab === "devices" ? filteredDevices.length : filteredPackages.length}
            </strong>{" "}
            из {activeTab === "devices" ? devices.length : packages.length}
          </div>

          {/* Кнопки создания */}
          <div style={{ display: "flex", gap: 8 }}>
            {activeTab === "devices" ? (
              <button
                className="cad-btn-primary"
                onClick={() => onOpenDeviceEditor(null)}
                style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} />
                <span>Создать компонент</span>
              </button>
            ) : (
              <button
                className="cad-btn-primary"
                onClick={() => onOpenPackageEditor(null)}
                style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} />
                <span>Создать корпус в CAD</span>
              </button>
            )}
          </div>
        </div>

        {/* Центральное рабочее пространство библиотеки (3 колонки) */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", background: "var(--cad-bg-deep, #0c0e12)" }}>
          {/* ================================================================ */}
          {/* Левая панель: ИЕРАРХИЧЕСКОЕ ДЕРЕВО НАВИГАЦИИ                    */}
          {/* ================================================================ */}
          <div className="lib-tree-sidebar">
            <div className="lib-tree-scroll">
              {activeTab === "devices" ? (
                <>
                  {/* Корневой узел: Все компоненты */}
                  <button
                    className={`lib-tree-node ${selectedCategory === "all" ? "active" : ""}`}
                    onClick={() => {
                      setSelectedCategory("all");
                      setSelectedSubcategory("all");
                    }}
                  >
                    <Folder size={14} color="var(--cad-accent-hover)" />
                    <span>Все компоненты</span>
                    <span className="lib-tree-badge">{devices.length}</span>
                  </button>

                  <div className="lib-tree-section">
                    <div className="lib-tree-section-header">
                      <span>Категории компонентов</span>
                    </div>

                    {DEVICE_TREE_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const catDevices = devices.filter((d) => cat.matchCategory(d.category));
                      const isCatActive = selectedCategory === cat.id && selectedSubcategory === "all";
                      const isExpanded = !!expandedCategories[cat.id];

                      return (
                        <div key={cat.id} style={{ display: "flex", flexDirection: "column" }}>
                          <button
                            className={`lib-tree-node ${isCatActive ? "active" : ""}`}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setSelectedSubcategory("all");
                            }}
                            title={cat.name}
                          >
                            <span
                              onClick={(e) => toggleCategory(cat.id, e)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 14,
                                height: 14,
                                color: "var(--cad-text-dim)",
                              }}
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                            <Icon size={14} color={cat.color} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cat.name}
                            </span>
                            <span className="lib-tree-badge">{catDevices.length}</span>
                          </button>

                          {/* Подкатегории */}
                          {isExpanded && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {cat.subcategories.map((sub) => {
                                const subDevices = catDevices.filter(sub.match);
                                const isSubActive = selectedCategory === cat.id && selectedSubcategory === sub.id;

                                return (
                                  <button
                                    key={sub.id}
                                    className={`lib-tree-subnode ${isSubActive ? "active" : ""}`}
                                    onClick={() => {
                                      setSelectedCategory(cat.id);
                                      setSelectedSubcategory(sub.id);
                                    }}
                                    title={sub.name}
                                  >
                                    <CircleDot size={9} color={isSubActive ? "var(--cad-accent-hover)" : "var(--cad-text-dim)"} />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {sub.name}
                                    </span>
                                    <span className="lib-tree-badge">{subDevices.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Пользовательские категории, если есть */}
                    {customCategories.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div className="lib-tree-section-header">
                          <span>Пользовательские</span>
                        </div>
                        {customCategories.map((catName) => {
                          const count = devices.filter((d) => d.category === catName).length;
                          const isActive = selectedCategory === catName;
                          return (
                            <button
                              key={catName}
                              className={`lib-tree-node ${isActive ? "active" : ""}`}
                              onClick={() => {
                                setSelectedCategory(catName);
                                setSelectedSubcategory("all");
                              }}
                            >
                              <Tag size={13} color="var(--cad-accent-hover)" />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {catName}
                              </span>
                              <span className="lib-tree-badge">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Корпуса: Корневой узел */}
                  <button
                    className={`lib-tree-node ${selectedMount === "all" && selectedPackageFamily === "all" && selectedPinFilter === "all" ? "active" : ""}`}
                    onClick={() => {
                      setSelectedMount("all");
                      setSelectedPackageFamily("all");
                      setSelectedPinFilter("all");
                    }}
                  >
                    <Box size={14} color="var(--cad-accent-hover)" />
                    <span>Все корпуса</span>
                    <span className="lib-tree-badge">{packages.length}</span>
                  </button>

                  {/* Раздел 1: Тип монтажа */}
                  <div className="lib-tree-section">
                    <div className="lib-tree-section-header" onClick={() => toggleSection("mountType")}>
                      <span>Тип монтажа</span>
                      {expandedSections.mountType ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                    {expandedSections.mountType && (
                      <>
                        <button
                          className={`lib-tree-node ${selectedMount === "smd" && selectedPackageFamily === "all" ? "active" : ""}`}
                          onClick={() => {
                            setSelectedMount(selectedMount === "smd" ? "all" : "smd");
                            setSelectedPackageFamily("all");
                            setSelectedPinFilter("all");
                          }}
                        >
                          <Zap size={13} color="var(--cad-accent-hover)" />
                          <span>SMD (Поверхностный)</span>
                          <span className="lib-tree-badge">{smdCount}</span>
                        </button>
                        <button
                          className={`lib-tree-node ${selectedMount === "tht" && selectedPackageFamily === "all" ? "active" : ""}`}
                          onClick={() => {
                            setSelectedMount(selectedMount === "tht" ? "all" : "tht");
                            setSelectedPackageFamily("all");
                            setSelectedPinFilter("all");
                          }}
                        >
                          <Plug size={13} color="#f59e0b" />
                          <span>THT (Выводной)</span>
                          <span className="lib-tree-badge">{thtCount}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Раздел 2: Семейства корпусов */}
                  <div className="lib-tree-section">
                    <div className="lib-tree-section-header" onClick={() => toggleSection("families")}>
                      <span>Семейства корпусов</span>
                      {expandedSections.families ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                    {expandedSections.families &&
                      PACKAGE_FAMILIES.map((fam) => {
                        const count = packages.filter(fam.match).length;
                        if (count === 0) return null;
                        const isActive = selectedPackageFamily === fam.id;

                        return (
                          <button
                            key={fam.id}
                            className={`lib-tree-node ${isActive ? "active" : ""}`}
                            onClick={() => {
                              setSelectedPackageFamily(isActive ? "all" : fam.id);
                              setSelectedMount("all");
                              setSelectedPinFilter("all");
                            }}
                            title={fam.name}
                          >
                            <Grid size={13} color={isActive ? "var(--cad-accent-hover)" : "var(--cad-text-dim)"} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {fam.name}
                            </span>
                            <span className="lib-tree-badge">{count}</span>
                          </button>
                        );
                      })}
                  </div>

                  {/* Раздел 3: Фильтр по выводам */}
                  <div className="lib-tree-section">
                    <div className="lib-tree-section-header" onClick={() => toggleSection("pins")}>
                      <span>Число выводов (Pins)</span>
                      {expandedSections.pins ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </div>
                    {expandedSections.pins &&
                      PIN_FILTERS.map((pf) => {
                        const count = packages.filter(pf.match).length;
                        const isActive = selectedPinFilter === pf.id;

                        return (
                          <button
                            key={pf.id}
                            className={`lib-tree-node ${isActive ? "active" : ""}`}
                            onClick={() => {
                              setSelectedPinFilter(isActive ? "all" : pf.id);
                              setSelectedMount("all");
                              setSelectedPackageFamily("all");
                            }}
                          >
                            <CircleDot size={11} color={isActive ? "var(--cad-accent-hover)" : "var(--cad-text-dim)"} />
                            <span>{pf.label}</span>
                            <span className="lib-tree-badge">{count}</span>
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>

            {/* ================================================================ */}
            {/* Нижний блок сайдбара: СВОДКА БАЗЫ ДАННЫХ И ДЕЙСТВИЯ            */}
            {/* ================================================================ */}
            <div className="lib-tree-stats">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
                    }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cad-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    База CAD активна
                  </span>
                </div>
              </div>

              <div className="lib-tree-stats-grid">
                <div className="lib-tree-stat-item">
                  <span className="lib-tree-stat-label">Детали:</span>
                  <span className="lib-tree-stat-value">{devices.length}</span>
                </div>
                <div className="lib-tree-stat-item">
                  <span className="lib-tree-stat-label">Корпуса:</span>
                  <span className="lib-tree-stat-value">{packages.length}</span>
                </div>
                <div className="lib-tree-stat-item">
                  <span className="lib-tree-stat-label">SMD:</span>
                  <span className="lib-tree-stat-value" style={{ color: "var(--cad-accent-hover)" }}>{smdCount}</span>
                </div>
                <div className="lib-tree-stat-item">
                  <span className="lib-tree-stat-label">THT:</span>
                  <span className="lib-tree-stat-value" style={{ color: "#f59e0b" }}>{thtCount}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="lib-tree-quick-btn"
                  onClick={handleImport}
                  title="Импортировать компоненты из JSON файла"
                >
                  <Upload size={12} />
                  <span>Импорт</span>
                </button>
                <button
                  type="button"
                  className="lib-tree-quick-btn"
                  onClick={handleExport}
                  title="Экспортировать всю библиотеку в JSON"
                >
                  <Download size={12} />
                  <span>Экспорт</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* Центральный список элементов                                     */}
          {/* ================================================================ */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: "auto",
              padding: 14,
              background: "var(--cad-bg-deep, #0c0e12)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {activeTab === "devices" ? (
              filteredDevices.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {filteredDevices.map((dev) => {
                    const isSelected = activeDevice?.id === dev.id;
                    return (
                      <div
                        key={dev.id}
                        onClick={() => setSelectedDeviceId(dev.id)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 8,
                          background: isSelected ? "var(--cad-bg-hover, #273042)" : "var(--cad-bg-panel, #181d26)",
                          border: isSelected ? "1.5px solid var(--cad-accent, #3b82f6)" : "1px solid var(--cad-border, #283344)",
                          boxShadow: isSelected ? "0 0 12px rgba(59, 130, 246, 0.2)" : "none",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", color: "var(--cad-text-main)", fontSize: 13 }}>{dev.name}</span>
                          <span style={{ fontSize: 10, background: "var(--cad-bg-surface)", color: "var(--cad-accent-hover)", padding: "2px 6px", borderRadius: 4 }}>
                            {dev.designatorPrefix}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--cad-text-muted)" }}>{dev.category}</span>
                        {dev.description && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--cad-text-dim)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {dev.description}
                          </span>
                        )}
                        {dev.parameters?.value && (
                          <span style={{ fontSize: 11, color: "var(--cad-net-active, #10b981)", fontWeight: "bold" }}>
                            Номинал: {dev.parameters.value}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--cad-text-dim)",
                    gap: 12,
                    padding: 40,
                  }}
                >
                  <Layers size={48} style={{ color: "var(--cad-border)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cad-text-muted)" }}>
                    Радиокомпоненты не найдены
                  </span>
                  <span style={{ fontSize: 12, maxWidth: 360, textAlign: "center", lineHeight: 1.4 }}>
                    В каталоге пока нет радиодеталей по заданным фильтрам. Вы можете создать компонент или перейти к просмотру корпусов.
                  </span>
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button className="cad-btn-secondary btn-sm" onClick={() => setActiveTab("packages")}>
                      Перейти к корпусам ({packages.length})
                    </button>
                    <button className="cad-btn-primary btn-sm" onClick={() => onOpenDeviceEditor(null)}>
                      Создать компонент
                    </button>
                  </div>
                </div>
              )
            ) : filteredPackages.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {filteredPackages.map((pkg) => {
                  const isSelected = activePackage?.id === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackageId(pkg.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: isSelected ? "var(--cad-bg-hover, #273042)" : "var(--cad-bg-panel, #181d26)",
                        border: isSelected ? "1.5px solid var(--cad-accent, #3b82f6)" : "1px solid var(--cad-border, #283344)",
                        boxShadow: isSelected ? "0 0 12px rgba(59, 130, 246, 0.2)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", color: "var(--cad-text-main)", fontSize: 13 }}>{pkg.name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            background: pkg.mountType === "smd" ? "rgba(59, 130, 246, 0.2)" : "rgba(245, 158, 11, 0.2)",
                            color: pkg.mountType === "smd" ? "var(--cad-accent-hover)" : "#f59e0b",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          {pkg.mountType.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--cad-text-muted)" }}>
                        <span>Выводов: {pkg.pads.length}</span>
                        <span>
                          {pkg.bodyWidth}×{pkg.bodyHeight} мм
                        </span>
                        {pkg.pitch && <span>Шаг: {pkg.pitch} мм</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--cad-text-dim)",
                  gap: 12,
                  padding: 40,
                }}
              >
                <Box size={48} style={{ color: "var(--cad-border)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cad-text-muted)" }}>
                  Корпуса не найдены
                </span>
                <span style={{ fontSize: 12, maxWidth: 360, textAlign: "center", lineHeight: 1.4 }}>
                  По заданному запросу корпуса не найдены. Вы можете начертить собственный корпус в векторном CAD-редакторе.
                </span>
                <button className="cad-btn-primary btn-sm" onClick={() => onOpenPackageEditor(null)}>
                  Создать корпус в CAD
                </button>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* Правая панель предпросмотра и действий                           */}
          {/* ================================================================ */}
          <div
            style={{
              width: 380,
              background: "var(--cad-bg-panel, #181d26)",
              borderLeft: "1px solid var(--cad-border, #283344)",
              display: "flex",
              flexDirection: "column",
              padding: 16,
              gap: 14,
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            {activePackage ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="section-title">Предпросмотр посадочного места</span>
                  <span style={{ fontSize: 11, color: "var(--cad-accent-hover)", fontWeight: 600 }}>
                    {activePackage.mountType.toUpperCase()}
                  </span>
                </div>

                <div
                  style={{
                    height: 240,
                    background: "var(--cad-bg-surface, #141820)",
                    borderRadius: 8,
                    border: "1px solid var(--cad-border, #283344)",
                    overflow: "hidden",
                  }}
                >
                  <FootprintPreview packageDef={activePackage} height={240} interactive={false} />
                </div>

                <div className="form-section" style={{ background: "var(--cad-bg-surface, #141820)", border: "1px solid var(--cad-border, #283344)" }}>
                  <span className="section-title">{activePackage.name}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                    <span style={{ color: "var(--cad-text-muted)" }}>Монтаж:</span>
                    <span style={{ color: "var(--cad-text-main)", fontWeight: "bold" }}>
                      {activePackage.mountType.toUpperCase()}
                    </span>
                    <span style={{ color: "var(--cad-text-muted)" }}>Контактов:</span>
                    <span style={{ color: "var(--cad-text-main)", fontWeight: "bold" }}>{activePackage.pads.length} шт.</span>
                    <span style={{ color: "var(--cad-text-muted)" }}>Габариты:</span>
                    <span style={{ color: "var(--cad-text-main)" }}>
                      {activePackage.bodyWidth} × {activePackage.bodyHeight} мм
                    </span>
                    <span style={{ color: "var(--cad-text-muted)" }}>Шаг (Pitch):</span>
                    <span style={{ color: "var(--cad-text-main)" }}>
                      {activePackage.pitch ? `${activePackage.pitch} мм` : "—"}
                    </span>
                  </div>
                </div>

                {activeTab === "devices" && activeDevice && (
                  <div className="form-section" style={{ background: "var(--cad-bg-surface, #141820)", border: "1px solid var(--cad-border, #283344)" }}>
                    <span className="section-title">Параметры компонента</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--cad-text-muted)" }}>Позиционное обозначение:</span>
                        <span style={{ color: "var(--cad-accent-hover)", fontWeight: "bold" }}>{activeDevice.designatorPrefix}</span>
                      </div>
                      {activeDevice.parameters?.value && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--cad-text-muted)" }}>Номинал:</span>
                          <span style={{ color: "var(--cad-net-active, #10b981)", fontWeight: "bold" }}>{activeDevice.parameters.value}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Кнопки действий */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                  {onPlaceOnBoard && (
                    <button
                      className="cad-btn-primary"
                      onClick={handlePlaceOnBoardAction}
                      style={{
                        padding: "9px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      <Check size={16} />
                      <span>Разместить на плате</span>
                    </button>
                  )}

                  <button
                    className="cad-btn-secondary"
                    onClick={() => onOpenPackageEditor(activePackage)}
                    style={{
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <Edit2 size={14} />
                    <span>Редактировать корпус в CAD</span>
                  </button>

                  {activeTab === "devices" && activeDevice && (
                    <button
                      className="cad-btn-secondary"
                      onClick={() => onOpenDeviceEditor(activeDevice)}
                      style={{
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        fontSize: 12,
                      }}
                    >
                      <Edit2 size={14} />
                      <span>Редактировать радиодеталь</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--cad-text-dim)",
                  gap: 12,
                  textAlign: "center",
                  padding: 20,
                }}
              >
                <Sliders size={36} style={{ color: "var(--cad-border)" }} />
                <span style={{ fontSize: 13, color: "var(--cad-text-muted)" }}>Выберите элемент для просмотра</span>
                <span style={{ fontSize: 11, color: "var(--cad-text-dim)" }}>
                  Кликните по компоненту или корпусу в списке слева для просмотра геометрии и характеристик.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
