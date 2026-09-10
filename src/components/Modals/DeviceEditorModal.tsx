// src/components/Modals/DeviceEditorModal.tsx
// Модальное окно создания и редактирования радиокомпонента (Device / Component)
// Управление логическими выводами схемы, привязка корпусов и сопоставление Pin-to-Pad Mapping

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
  const [id, setId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<string>("ICs");
  const [subcategory, setSubcategory] = useState<string>("Microcontrollers");
  const [designatorPrefix, setDesignatorPrefix] = useState<string>("U");
  const [description, setDescription] = useState<string>("");
  const [datasheet, setDatasheet] = useState<string>("");
  const [paramValue, setParamValue] = useState<string>("");

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
      setParamValue(initialDevice.parameters?.value || "");
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
      setParamValue("");
      setLogicalPins([
        { id: "pin_1", name: "VCC", electricalType: "power_in" },
        { id: "pin_2", name: "GND", electricalType: "ground" },
        { id: "pin_3", name: "IN", electricalType: "input" },
        { id: "pin_4", name: "OUT", electricalType: "output" },
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
      });
    }
    if (!hasGND) {
      newItems.push({
        id: `pin_${Date.now()}_gnd`,
        name: "GND",
        electricalType: "ground",
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

  const handleAddPackageBinding = (pkgId: string) => {
    if (supportedPackages.some((p) => p.packageId === pkgId)) {
      setActivePackageId(pkgId);
      return;
    }
    const pkg = availablePackages.find((p) => p.id === pkgId);
    if (!pkg) return;

    // Автоматическое начальное сопоставление по порядку
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

    const dev: DeviceDefinition = {
      id: id || `dev_${Date.now()}`,
      name: name.trim(),
      category: category.trim() || "ICs",
      subcategory: subcategory.trim() || "",
      designatorPrefix: designatorPrefix.trim() || "U",
      description: description.trim(),
      datasheet: datasheet.trim() || undefined,
      tags: [],
      parameters: {
        value: paramValue.trim() || undefined,
      },
      logicalPins,
      supportedPackages,
    };

    onSave(dev);
    onClose();
  };

  return (
    <div className="cad-modal-backdrop" style={{ zIndex: 1050 }} onClick={onClose}>
      <div
        className="device-editor-box"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка модального окна */}
        <div className="cad-modal-header" style={{ padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="cad-modal-icon-badge" style={{ width: 34, height: 34, borderRadius: 8 }}>
              <Cpu size={18} color="var(--cad-accent-hover)" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--cad-text-main)", display: "flex", alignItems: "center", gap: 8 }}>
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
                  <span style={{ fontSize: "11px", color: "var(--cad-text-muted)", fontWeight: 400 }}>
                    • {paramValue}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Связка логических выводов схемы (Pins) с посадочными местами (Footprints & Pin Mapping)
              </div>
            </div>
          </div>
          <button className="cad-modal-close-btn" onClick={onClose} title="Закрыть (Esc)">
            <X size={15} />
          </button>
        </div>

        {/* Тело модального окна: строгая двухколоночная CAD-сетка */}
        <div className="device-editor-grid">
          {/* Левая колонка: Основные метаданные и таблица выводов УГО */}
          <div className="device-col">
            {/* Карточка 1: Параметры компонента */}
            <div className="device-card" style={{ flexShrink: 0 }}>
              <div className="device-card-header">
                <div className="device-card-title">
                  <Info size={13} />
                  <span>Параметры компонента</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Название (Part Name):</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="напр. NE555, STM32F103"
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
                    placeholder="U, R, C"
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
                    placeholder="Например: Резисторы, ОУ, LDO..."
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Номинал (Value):</label>
                  <input
                    type="text"
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                    placeholder="10k, 0.1uF, 3.3V"
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Описание / Даташит:</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Краткое описание радиодетали"
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
              </div>
            </div>

            <div className="device-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="device-card-header">
                <div className="device-card-title">
                  <Sparkles size={13} />
                  <span>Выводы схемы</span>
                  <span className="device-chip-count">{logicalPins.length} шт.</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="cad-btn-secondary"
                    style={{ fontSize: 10, padding: "2px 7px", height: 24 }}
                    onClick={handleAddPowerPins}
                    title="Добавить VCC и GND"
                  >
                    + PWR
                  </button>
                  <button
                    className="cad-btn-secondary"
                    style={{ fontSize: 10, padding: "2px 8px", height: 24 }}
                    onClick={handleAddPin}
                  >
                    <Plus size={11} /> Добавить
                  </button>
                </div>
              </div>

              {/* Таблица логических выводов с вертикальной прокруткой */}
              <div className="device-table-container">
                <table className="device-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28, textAlign: "center" }}>#</th>
                      <th style={{ width: 110 }}>Имя вывода</th>
                      <th>Тип сигнала</th>
                      <th style={{ width: 32, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logicalPins.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "24px 10px", color: "#64748b" }}>
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
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                                    padding: "3px 6px",
                                    fontSize: 11,
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
                            <td style={{ textAlign: "center" }}>
                              <button
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
                      className="cad-btn-secondary"
                      style={{ fontSize: 10, padding: "2px 7px", height: 24, gap: 4 }}
                      onClick={handleAutoMapSequential}
                      title="Автоматически связать выводы с площадками 1:1 по порядку"
                    >
                      <Zap size={11} color="var(--cad-top-layer, #f59e0b)" /> Авто 1:1
                    </button>
                    <button
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
                          <th style={{ width: 140 }}>Вывод схемы (УГО)</th>
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
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
          <button className="cad-btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="cad-btn-primary" onClick={handleSave}>
            <Save size={13} />
            <span>Сохранить деталь</span>
          </button>
        </div>
      </div>
    </div>
  );
};
