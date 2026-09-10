// src/components/Modals/DeviceEditorModal.tsx
// Модальное окно создания и редактирования радиокомпонента (Device / Component)
// Управление логическими выводами, привязка корпусов и сопоставление Pin-to-Pad Mapping

import React, { useState, useEffect } from "react";
import {
  DeviceDefinition,
  PackageDefinition,
  LogicalPin,
  PinElectricalType,
  PackageMapping,
} from "../../types/componentLibrary";
import { X, Save, Plus, Trash2, Cpu, Link, Box } from "lucide-react";
import { FootprintPreview } from "../SvgRenderer/FootprintPreview";

interface DeviceEditorModalProps {
  isOpen: boolean;
  initialDevice?: DeviceDefinition | null;
  availablePackages: PackageDefinition[];
  onClose: () => void;
  onSave: (device: DeviceDefinition) => void;
  onCreateNewPackage?: () => void;
}

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
      setActivePackageId(initialDevice.supportedPackages?.[0]?.packageId || availablePackages[0]?.id || "");
    } else {
      const newId = `dev_${Date.now()}`;
      setId(newId);
      setName("Новый компонент");
      setCategory("ICs");
      setSubcategory("Microcontrollers");
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
              VCC: "8",
              GND: "4",
              IN: "1",
              OUT: "2",
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

  const handleRemovePin = (pinId: string) => {
    setLogicalPins(logicalPins.filter((p) => p.id !== pinId));
  };

  const handleUpdatePin = (pinId: string, updates: Partial<LogicalPin>) => {
    setLogicalPins(logicalPins.map((p) => (p.id === pinId ? { ...p, ...updates } : p)));
  };

  const handleAddPackageBinding = (pkgId: string) => {
    if (supportedPackages.some((p) => p.packageId === pkgId)) return;
    const pkg = availablePackages.find((p) => p.id === pkgId);
    if (!pkg) return;

    // Автоматический начальный маппинг по порядку
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
    setSupportedPackages(supportedPackages.filter((p) => p.packageId !== pkgId));
    if (activePackageId === pkgId) {
      setActivePackageId(supportedPackages.find((p) => p.packageId !== pkgId)?.packageId || "");
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

  const handleSave = () => {
    if (!name.trim()) {
      alert("Укажите название радиодетали");
      return;
    }

    const dev: DeviceDefinition = {
      id: id || `dev_${Date.now()}`,
      name: name.trim(),
      category,
      subcategory,
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
    <div className="cad-modal-overlay editor-overlay">
      <div className="cad-modal-container" style={{ width: 1050, height: "88vh", maxWidth: "96vw" }}>
        {/* Шапка */}
        <div className="cad-modal-header">
          <div className="modal-title-with-icon">
            <Cpu size={18} className="title-icon" />
            <span>Редактор радиокомпонента (Device)</span>
          </div>
          <button className="cad-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Тело модального окна */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, padding: 18, gap: 16, overflow: "hidden" }}>
          {/* Левая колонка: метаданные и логические выводы схемы */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            <div className="form-section">
              <span className="section-title">Основная информация</span>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Название (Part Name):</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="напр. NE555, STM32F103, 10k"
                    className="cad-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Префикс УГО:</label>
                  <input
                    type="text"
                    value={designatorPrefix}
                    onChange={(e) => setDesignatorPrefix(e.target.value)}
                    placeholder="R, C, U, D"
                    className="cad-input"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Категория:</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="cad-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Номинал (Value):</label>
                  <input
                    type="text"
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                    placeholder="напр. 10k, 0.1uF"
                    className="cad-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Описание / Даташит:</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое назначение микросхемы"
                  className="cad-input"
                />
              </div>
            </div>

            {/* Раздел: Логические выводы схемы (Symbol Pins) */}
            <div className="form-section" style={{ flex: 1, minHeight: 200 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="section-title">
                  Логические выводы схемы ({logicalPins.length} шт.)
                </span>
                <button
                  className="cad-btn-secondary"
                  style={{ fontSize: 11, padding: "3px 8px" }}
                  onClick={handleAddPin}
                >
                  <Plus size={12} /> Добавить пин
                </button>
              </div>

              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {logicalPins.map((pin) => (
                  <div
                    key={pin.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#0c101d",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #1e293b",
                    }}
                  >
                    <input
                      type="text"
                      value={pin.name}
                      onChange={(e) => handleUpdatePin(pin.id, { name: e.target.value })}
                      className="cad-input"
                      style={{ width: 90, fontWeight: "bold" }}
                      placeholder="Имя"
                    />

                    <select
                      value={pin.electricalType}
                      onChange={(e) =>
                        handleUpdatePin(pin.id, { electricalType: e.target.value as PinElectricalType })
                      }
                      className="cad-input"
                      style={{ flex: 1, fontSize: 11 }}
                    >
                      <option value="power_in">Power In (Питание)</option>
                      <option value="ground">Ground (Земля)</option>
                      <option value="input">Input (Вход)</option>
                      <option value="output">Output (Выход)</option>
                      <option value="bidirectional">Bidirectional (Двунаправл.)</option>
                      <option value="passive">Passive (Пассивный)</option>
                      <option value="open_collector">Open Collector (Откр. колл.)</option>
                    </select>

                    <button
                      className="cad-icon-btn danger"
                      onClick={() => handleRemovePin(pin.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Правая колонка: Привязанные корпуса и таблица сопоставления Pin-to-Pad Mapping */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            <div className="form-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="section-title">Привязанные корпуса (Footprints)</span>
                {onCreateNewPackage && (
                  <button
                    className="cad-btn-secondary"
                    style={{ fontSize: 11, padding: "3px 8px" }}
                    onClick={onCreateNewPackage}
                  >
                    <Plus size={12} /> Создать новый корпус
                  </button>
                )}
              </div>

              {/* Селектор добавления существующего корпуса */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <select
                  className="cad-input"
                  id="addPackageSelect"
                  style={{ flex: 1, fontSize: 12 }}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPackageBinding(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="" disabled>
                    + Привязать корпус из библиотеки...
                  </option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.mountType.toUpperCase()}, {pkg.pads.length} выв.)
                    </option>
                  ))}
                </select>
              </div>

              {/* Список привязанных корпусов */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {supportedPackages.map((binding) => {
                  const pkg = availablePackages.find((p) => p.id === binding.packageId);
                  const isSelected = activePackageId === binding.packageId;

                  return (
                    <div
                      key={binding.packageId}
                      onClick={() => setActivePackageId(binding.packageId)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 10px",
                        borderRadius: 6,
                        background: isSelected ? "#2563eb" : "#1e293b",
                        color: "#ffffff",
                        border: isSelected ? "1px solid #60a5fa" : "1px solid #334155",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <Box size={13} />
                      <span>{pkg?.name || binding.packageId}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePackageBinding(binding.packageId);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#cbd5e1",
                          cursor: "pointer",
                          display: "flex",
                          padding: 0,
                          marginLeft: 4,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Таблица маппинга (Pin-to-Pad Mapping) */}
            {currentPkgDef && currentMapping && (
              <div className="form-section" style={{ flex: 1 }}>
                <span className="section-title">
                  Таблица сопоставления выводов (Pin-to-Pad Mapping для {currentPkgDef.name})
                </span>

                {/* Предпросмотр корпуса */}
                <div style={{ height: 160, margin: "6px 0" }}>
                  <FootprintPreview
                    packageDef={currentPkgDef}
                    showDimensions={false}
                    interactive={false}
                    height={160}
                  />
                </div>

                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid #1e293b" }}>
                        <th style={{ padding: "4px 8px" }}>Сигнал схемы</th>
                        <th style={{ padding: "4px 8px" }}>Тип</th>
                        <th style={{ padding: "4px 8px" }}>Площадка корпуса (Pad)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logicalPins.map((pin) => {
                        const assignedPad = currentMapping.pinMap[pin.name] || "";

                        return (
                          <tr key={pin.id} style={{ borderBottom: "1px solid #141c2e" }}>
                            <td style={{ padding: "4px 8px", fontWeight: "bold", color: "#38bdf8" }}>
                              {pin.name}
                            </td>
                            <td style={{ padding: "4px 8px", fontSize: 11, color: "#94a3b8" }}>
                              {pin.electricalType}
                            </td>
                            <td style={{ padding: "4px 8px" }}>
                              <select
                                value={assignedPad}
                                onChange={(e) => handleUpdatePinMapping(pin.name, e.target.value)}
                                className="cad-input"
                                style={{ padding: "2px 6px", fontSize: 11 }}
                              >
                                <option value="">— Не подключен —</option>
                                {currentPkgDef.pads.map((pad) => (
                                  <option key={pad.padNum} value={pad.padNum}>
                                    Pad #{pad.padNum} {pad.name ? `(${pad.name})` : ""}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Подвал */}
        <div className="cad-modal-footer">
          <button className="cad-btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="cad-btn-primary" onClick={handleSave}>
            <Save size={14} />
            <span>Сохранить деталь</span>
          </button>
        </div>
      </div>
    </div>
  );
};
