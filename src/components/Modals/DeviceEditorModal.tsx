// src/components/Modals/DeviceEditorModal.tsx
// Модальное окно создания и редактирования радиокомпонента (Device / Component)
// Управление логическими выводами схемы, спецификацией BOM, электрическими параметрами и сопоставлением Pin-to-Pad Mapping

import React, { useState, useEffect } from "react";
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
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  ExternalLink,
  Tag,
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
  { value: "power_in", label: "Power In (Питание VCC)", shortLabel: "Питание", color: "#ef4444" },
  { value: "ground", label: "Ground (Земля GND)", shortLabel: "Земля", color: "#10b981" },
  { value: "input", label: "Input (Вход)", shortLabel: "Вход", color: "#38bdf8" },
  { value: "output", label: "Output (Выход)", shortLabel: "Выход", color: "#c084fc" },
  { value: "bidirectional", label: "Bidirectional (Двунаправл.)", shortLabel: "Двунапр.", color: "#fbbf24" },
  { value: "passive", label: "Passive (Пассивный)", shortLabel: "Пассив.", color: "#94a3b8" },
  { value: "open_collector", label: "Open Collector (Откр. колл.)", shortLabel: "Откр. колл.", color: "#f97316" },
  { value: "power_out", label: "Power Out (Выход питания)", shortLabel: "Вых. пит.", color: "#f43f5e" },
  { value: "no_connect", label: "No Connect (Не подключен)", shortLabel: "NC", color: "#64748b" },
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
  const [category, setCategory] = useState<string>("ICs");
  const [subcategory, setSubcategory] = useState<string>("Microcontrollers");
  const [designatorPrefix, setDesignatorPrefix] = useState<string>("U");
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

  // Поддерживаемые корпуса и маппинг
  const [supportedPackages, setSupportedPackages] = useState<PackageMapping[]>([]);
  const [activePackageId, setActivePackageId] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    if (initialDevice) {
      setId(initialDevice.id);
      setName(initialDevice.name);
      setCategory(initialDevice.category || "ICs");
      setSubcategory(initialDevice.subcategory || "");
      setDesignatorPrefix(initialDevice.designatorPrefix || "U");
      setDescription(initialDevice.description || "");
      setDatasheet(initialDevice.datasheet || "");
      setManufacturer(initialDevice.manufacturer || "");
      setMpn(initialDevice.mpn || "");
      setTags(initialDevice.tags || []);
      setTagInput("");

      // Электропараметры
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
      setCategory("ICs");
      setSubcategory("General");
      setDesignatorPrefix("U");
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

      setLogicalPins([
        { id: "pin_1", name: "VCC", electricalType: "power_in", description: "Напряжение питания" },
        { id: "pin_2", name: "GND", electricalType: "ground", description: "Общий провод" },
        { id: "pin_3", name: "IN", electricalType: "input", description: "Входной сигнал" },
        { id: "pin_4", name: "OUT", electricalType: "output", description: "Выходной сигнал" },
      ]);
      const firstPkg = availablePackages[0];
      if (firstPkg) {
        setSupportedPackages([
          {
            packageId: firstPkg.id,
            defaultVariantId: firstPkg.defaultVariantId,
            pinMap: {
              VCC: firstPkg.pads[0]?.padNum || "1",
              GND: firstPkg.pads[1]?.padNum || "2",
              IN: firstPkg.pads[2]?.padNum || "3",
              OUT: firstPkg.pads[3]?.padNum || "4",
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

  if (!isOpen) return null;

  const currentPkgDef = availablePackages.find((p) => p.id === activePackageId);
  const currentMapping = supportedPackages.find((m) => m.packageId === activePackageId);

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

  // Управление выводами
  const handleAddPin = () => {
    const nextNum = logicalPins.length + 1;
    setLogicalPins([
      ...logicalPins,
      {
        id: `pin_${Date.now()}_${nextNum}`,
        name: `PIN${nextNum}`,
        electricalType: "passive",
      },
    ]);
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
    }
  };

  const handleRemovePin = (pinId: string) => {
    setLogicalPins(logicalPins.filter((p) => p.id !== pinId));
  };

  const handleUpdatePin = (pinId: string, updates: Partial<LogicalPin>) => {
    setLogicalPins(
      logicalPins.map((p) => (p.id === pinId ? { ...p, ...updates } : p))
    );
  };

  // Привязка корпусов и маппинг
  const handleAddPackageBinding = (pkgId: string) => {
    if (supportedPackages.some((p) => p.packageId === pkgId)) {
      setActivePackageId(pkgId);
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
  };

  const handleRemovePackageBinding = (pkgId: string) => {
    const remaining = supportedPackages.filter((p) => p.packageId !== pkgId);
    setSupportedPackages(remaining);
    if (activePackageId === pkgId) {
      setActivePackageId(remaining[0]?.packageId || "");
    }
  };

  const handleUpdatePinMapping = (logicalPinName: string, padNum: string) => {
    if (!activePackageId) return;
    setSupportedPackages(
      supportedPackages.map((item) => {
        if (item.packageId !== activePackageId) return item;
        return {
          ...item,
          pinMap: {
            ...item.pinMap,
            [logicalPinName]: padNum,
          },
        };
      })
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
      datasheet: datasheet.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      mpn: mpn.trim() || undefined,
      tags: tags.filter((t) => t.trim().length > 0),
      parameters: {
        value: paramValue.trim() || undefined,
        tolerance: tolerance.trim() || undefined,
        voltageRating: voltageRating.trim() || undefined,
        powerRating: powerRating.trim() || undefined,
        maxCurrent: maxCurrent.trim() || undefined,
        operatingTemp: operatingTemp.trim() || undefined,
        custom: Object.keys(customRecord).length > 0 ? customRecord : undefined,
      },
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
                {paramValue && (
                  <span style={{ fontSize: "11px", color: "var(--cad-net-active, #10b981)", fontWeight: 500 }}>
                    • {paramValue}
                  </span>
                )}
                {mpn && (
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

        {/* Тело модального окна: двухколоночная CAD-сетка */}
        <div className="device-editor-grid">
          {/* Левая колонка: Параметры радиодетали и таблица логических выводов схемы */}
          <div className="device-col">
            {/* Карточка 1: Переключаемые вкладки «Основные & BOM» и «Электропараметры» */}
            <div className="device-card" style={{ flexShrink: 0 }}>
              <div className="device-card-header">
                <div className="device-tab-group">
                  <button
                    type="button"
                    className={`device-tab-btn ${activeSubTab === "info" ? "active" : ""}`}
                    onClick={() => setActiveSubTab("info")}
                  >
                    <Info size={12} />
                    <span>Основные & BOM</span>
                  </button>
                  <button
                    type="button"
                    className={`device-tab-btn ${activeSubTab === "specs" ? "active" : ""}`}
                    onClick={() => setActiveSubTab("specs")}
                  >
                    <Zap size={12} />
                    <span>Электропараметры</span>
                    {filledSpecsCount > 0 && (
                      <span className="device-chip-count" style={{ marginLeft: 3 }}>
                        {filledSpecsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {activeSubTab === "info" ? (
                /* Вкладка 1: Основные метаданные и закупка (BOM) */
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
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Категория:</label>
                      <input
                        type="text"
                        list="cad-category-datalist"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Выберите или введите..."
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                      <datalist id="cad-category-datalist">
                        <option value="Пассивные компоненты" />
                        <option value="Полупроводники (Дискретные)" />
                        <option value="Интегральные микросхемы (IC)" />
                        <option value="Микроконтроллеры, DSP и ПЛИС" />
                        <option value="Источники и управление питанием" />
                        <option value="Разъемы и соединители" />
                        <option value="Коммутация и электромеханика" />
                        <option value="Оптоэлектроника и индикация" />
                        <option value="Датчики и сенсоры" />
                        <option value="Кварцы и тактирование" />
                        <option value="Акустика и звук" />
                        <option value="ВЧ, СВЧ и беспроводная связь" />
                        <option value="Трансформаторы и моточные узлы" />
                        <option value="ЭМС и фильтрация помех (EMI/RFI)" />
                        <option value="Модули и мезонины" />
                        <option value="Служебные, крепеж и механика" />
                      </datalist>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10 }}>Подкатегория:</label>
                      <input
                        type="text"
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        placeholder="Резисторы, ОУ, LDO, MCU..."
                        className="cad-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                      />
                    </div>
                  </div>

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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                  </div>

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

            {/* Карточка 2: Логические выводы схемы (Logical Pins) */}
            <div className="device-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="device-card-header">
                <div className="device-card-title">
                  <Sparkles size={13} />
                  <span>Выводы схемы (Pins)</span>
                  <span className="device-chip-count">{logicalPins.length} шт.</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="cad-btn-secondary"
                    style={{ fontSize: 10, padding: "2px 7px", height: 24 }}
                    onClick={handleAddPowerPins}
                    title="Быстро добавить VCC и GND"
                  >
                    + PWR
                  </button>
                  <button
                    type="button"
                    className="cad-btn-secondary"
                    style={{ fontSize: 10, padding: "2px 8px", height: 24 }}
                    onClick={handleAddPin}
                  >
                    <Plus size={11} /> Добавить
                  </button>
                </div>
              </div>

              {/* Таблица логических выводов схемы с поддержкой Unit (секции) и описания */}
              <div className="device-table-container">
                <table className="device-table">
                  <thead>
                    <tr>
                      <th style={{ width: 24, textAlign: "center" }}>#</th>
                      <th style={{ width: 95 }}>Имя вывода</th>
                      <th style={{ width: 140 }}>Тип сигнала</th>
                      <th style={{ width: 55, textAlign: "center" }} title="Секция УГО / Вентиль (A, B, C, D...)">Секция</th>
                      <th>Назначение / Описание</th>
                      <th style={{ width: 28, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logicalPins.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "24px 10px", color: "#64748b" }}>
                          Выводы не добавлены. Нажмите «+ Добавить» для создания логического вывода.
                        </td>
                      </tr>
                    ) : (
                      logicalPins.map((pin, idx) => {
                        const typeCfg =
                          ELECTRICAL_TYPES.find((t) => t.value === pin.electricalType) ||
                          ELECTRICAL_TYPES[5];

                        return (
                          <tr key={pin.id}>
                            <td
                              style={{
                                textAlign: "center",
                                color: "#64748b",
                                fontFamily: "monospace",
                                fontSize: 11,
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td>
                              <input
                                type="text"
                                value={pin.name}
                                onChange={(e) =>
                                  handleUpdatePin(pin.id, { name: e.target.value })
                                }
                                className="cad-input"
                                style={{
                                  padding: "3px 6px",
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  fontWeight: "bold",
                                  width: "100%",
                                }}
                                placeholder="PIN"
                              />
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span
                                  className="pin-type-dot"
                                  style={{ backgroundColor: typeCfg.color }}
                                />
                                <select
                                  value={pin.electricalType}
                                  onChange={(e) =>
                                    handleUpdatePin(pin.id, {
                                      electricalType: e.target.value as PinElectricalType,
                                    })
                                  }
                                  className="cad-input"
                                  style={{
                                    flex: 1,
                                    padding: "2px 4px",
                                    fontSize: 10.5,
                                    height: 24,
                                  }}
                                >
                                  {ELECTRICAL_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
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
                                placeholder="A, B"
                                maxLength={4}
                                className="cad-input"
                                style={{
                                  padding: "3px 4px",
                                  fontSize: 11,
                                  textAlign: "center",
                                  fontFamily: "monospace",
                                  width: "100%",
                                }}
                                title="Секция УГО: A, B, C, D для многоэлементных схем"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={pin.description || ""}
                                onChange={(e) =>
                                  handleUpdatePin(pin.id, { description: e.target.value })
                                }
                                placeholder="Назначение пина"
                                className="cad-input"
                                style={{
                                  padding: "3px 6px",
                                  fontSize: 10.5,
                                  width: "100%",
                                }}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className="cad-icon-btn danger"
                                style={{ width: 22, height: 22, padding: 0 }}
                                onClick={() => handleRemovePin(pin.id)}
                                title="Удалить вывод"
                              >
                                <Trash2 size={12} />
                              </button>
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

          {/* Правая колонка: Привязанные корпуса и таблица сопоставления Pin-to-Pad */}
          <div className="device-col">
            {/* Карточка 1: Посадочные места (Footprints) */}
            <div className="device-card" style={{ flexShrink: 0 }}>
              <div className="device-card-header">
                <div className="device-card-title">
                  <Box size={13} />
                  <span>Привязанные корпуса</span>
                  <span className="device-chip-count">{supportedPackages.length}</span>
                </div>
                {onCreateNewPackage && (
                  <button
                    type="button"
                    className="cad-btn-secondary"
                    style={{ fontSize: 10, padding: "2px 8px", height: 24 }}
                    onClick={onCreateNewPackage}
                  >
                    <Plus size={11} /> Создать корпус
                  </button>
                )}
              </div>

              {/* Список привязанных корпусов в виде стильных CAD-чипов */}
              <div className="device-pkg-chips-wrap">
                {supportedPackages.map((binding) => {
                  const pkg = availablePackages.find((p) => p.id === binding.packageId);
                  const isSelected = activePackageId === binding.packageId;

                  return (
                    <div
                      key={binding.packageId}
                      className={`device-pkg-chip ${isSelected ? "active" : ""}`}
                      onClick={() => setActivePackageId(binding.packageId)}
                      title={`Нажмите для настройки сопоставления выводов для ${pkg?.name || binding.packageId}`}
                    >
                      <Box size={13} color={isSelected ? "var(--cad-accent-hover)" : "var(--cad-text-dim)"} />
                      <span>{pkg?.name || binding.packageId}</span>
                      {pkg && (
                        <span style={{ fontSize: 10, color: "var(--cad-text-dim)" }}>
                          ({pkg.pads.length}п.)
                        </span>
                      )}
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
                  );
                })}
              </div>

              {/* Селектор привязки существующего корпуса */}
              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <select
                  className="cad-input"
                  style={{ flex: 1, fontSize: 11, padding: "5px 8px" }}
                  defaultValue=""
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPackageBinding(e.target.value);
                    }
                  }}
                >
                  <option value="" disabled>
                    + Привязать корпус из библиотеки...
                  </option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.mountType.toUpperCase()}, {pkg.pads.length} площадок)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Карточка 2: Таблица сопоставления выводов (Pin-to-Pad Mapping) */}
            <div className="device-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="device-card-header">
                <div className="device-card-title">
                  <ArrowRight size={13} />
                  <span>Сопоставление выводов</span>
                  {currentPkgDef && (
                    <span style={{ fontSize: 10, color: "var(--cad-text-dim)", fontWeight: 400, textTransform: "none" }}>
                      ({currentPkgDef.name})
                    </span>
                  )}
                </div>
                {currentPkgDef && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="cad-btn-secondary"
                      style={{ fontSize: 10, padding: "2px 7px", height: 24, gap: 4 }}
                      onClick={handleAutoMapSequential}
                      title="Автоматически связать выводы с площадками 1:1 по порядку"
                    >
                      <Zap size={11} color="var(--cad-top-layer, #f59e0b)" /> Авто 1:1
                    </button>
                    <button
                      type="button"
                      className="cad-btn-secondary"
                      style={{ fontSize: 10, padding: "2px 7px", height: 24, gap: 4 }}
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
                  {/* Компактный предпросмотр посадочного места */}
                  <div
                    style={{
                      height: 125,
                      borderRadius: 6,
                      border: "1px solid var(--cad-border)",
                      overflow: "hidden",
                      background: "var(--cad-bg-deep)",
                      flexShrink: 0,
                    }}
                  >
                    <FootprintPreview
                      packageDef={currentPkgDef}
                      showDimensions={false}
                      interactive={false}
                      height={125}
                    />
                  </div>

                  {/* Таблица маппинга выводов */}
                  <div className="device-table-container">
                    <table className="device-table">
                      <thead>
                        <tr>
                          <th style={{ width: 155 }}>Вывод схемы (УГО)</th>
                          <th style={{ width: 24, textAlign: "center" }}></th>
                          <th>Площадка корпуса (Pad)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logicalPins.map((pin) => {
                          const assignedPad = currentMapping.pinMap[pin.name] || "";
                          const typeCfg =
                            ELECTRICAL_TYPES.find((t) => t.value === pin.electricalType) ||
                            ELECTRICAL_TYPES[5];

                          return (
                            <tr key={pin.id}>
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
                                      color: "var(--cad-text-main)",
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
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <select
                                    value={assignedPad}
                                    onChange={(e) =>
                                      handleUpdatePinMapping(pin.name, e.target.value)
                                    }
                                    className="cad-input"
                                    style={{
                                      width: "100%",
                                      padding: "3px 6px",
                                      fontSize: 11,
                                      height: 24,
                                      borderColor: assignedPad ? "var(--cad-border)" : "rgba(245, 158, 11, 0.4)",
                                    }}
                                  >
                                    <option value="">— Не подключен —</option>
                                    {currentPkgDef.pads.map((pad) => (
                                      <option key={pad.padNum} value={pad.padNum}>
                                        Pad #{pad.padNum} {pad.name ? `(${pad.name})` : ""} [{pad.shape}]
                                      </option>
                                    ))}
                                  </select>
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      backgroundColor: assignedPad ? "var(--cad-net-active, #10b981)" : "#f59e0b",
                                      flexShrink: 0,
                                    }}
                                    title={assignedPad ? "Вывод подключен" : "Вывод не назначен"}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
                    Привяжите посадочное место из библиотеки выше для сопоставления сигналов схемы с физическими контактными площадками.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Подвал */}
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
    </div>
  );
};
