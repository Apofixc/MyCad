// src/components/Modals/DeviceEditorModal.tsx
// Универсальный редактор радиокомпонента (Device)

import React, { useState, useEffect } from "react";
import {
  DeviceDefinition,
  LogicalPin,
  PinElectricalType,
  PackageMapping,
} from "../../types/componentLibrary";
import { ComponentDatabaseService } from "../../services/componentDatabase";
import { X, Plus, Trash2, Save, Cpu } from "lucide-react";

interface DeviceEditorModalProps {
  isOpen: boolean;
  initialDevice?: DeviceDefinition;
  onClose: () => void;
}

export const DeviceEditorModal: React.FC<DeviceEditorModalProps> = ({
  isOpen,
  initialDevice,
  onClose,
}) => {
  const db = ComponentDatabaseService.getInstance();
  const allPackages = db.getAllPackages();
  const categories = db.getCategories();

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("ics");
  const [subcategory, setSubcategory] = useState("opamps");
  const [designatorPrefix, setDesignatorPrefix] = useState("DA");
  const [description, setDescription] = useState("");
  const [datasheet, setDatasheet] = useState("");
  const [value, setValue] = useState("");
  const [voltageRating, setVoltageRating] = useState("");
  const [powerRating, setPowerRating] = useState("");
  const [tolerance, setTolerance] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [logicalPins, setLogicalPins] = useState<LogicalPin[]>([]);
  const [supportedPackages, setSupportedPackages] = useState<PackageMapping[]>([]);
  const [activePackageId, setActivePackageId] = useState<string>("");

  useEffect(() => {
    if (initialDevice) {
      setId(initialDevice.id);
      setName(initialDevice.name);
      setCategory(initialDevice.category);
      setSubcategory(initialDevice.subcategory);
      setDesignatorPrefix(initialDevice.designatorPrefix);
      setDescription(initialDevice.description || "");
      setDatasheet(initialDevice.datasheet || "");
      setValue(initialDevice.parameters.value || "");
      setVoltageRating(initialDevice.parameters.voltageRating || "");
      setPowerRating(initialDevice.parameters.powerRating || "");
      setTolerance(initialDevice.parameters.tolerance || "");
      setTagsInput(initialDevice.tags?.join(", ") || "");
      setLogicalPins(initialDevice.logicalPins || []);
      setSupportedPackages(initialDevice.supportedPackages || []);
      if (initialDevice.supportedPackages?.length > 0) {
        setActivePackageId(initialDevice.supportedPackages[0].packageId);
      }
    } else {
      const newId = `DEV_${Date.now()}`;
      setId(newId);
      setName("Новый компонент");
      setCategory("ics");
      setSubcategory("opamps");
      setDesignatorPrefix("DA");
      setDescription("");
      setDatasheet("");
      setValue("");
      setVoltageRating("");
      setPowerRating("");
      setTolerance("");
      setTagsInput("");
      setLogicalPins([
        { id: "1", name: "IN", electricalType: "input" },
        { id: "2", name: "OUT", electricalType: "output" },
      ]);
      const defaultPkg = allPackages[0]?.id || "PKG_DIP_8";
      setSupportedPackages([
        {
          packageId: defaultPkg,
          pinMap: { "1": 1, "2": 2 },
        },
      ]);
      setActivePackageId(defaultPkg);
    }
  }, [initialDevice, isOpen, allPackages]);

  if (!isOpen) return null;

  const currentMapping = supportedPackages.find((m) => m.packageId === activePackageId);
  const currentPkg = allPackages.find((p) => p.id === activePackageId);

  const handleAddPin = () => {
    const nextNum = logicalPins.length + 1;
    const newPin: LogicalPin = {
      id: `p${nextNum}`,
      name: `PIN${nextNum}`,
      electricalType: "passive",
    };
    setLogicalPins([...logicalPins, newPin]);
  };

  const handleRemovePin = (pinId: string) => {
    setLogicalPins(logicalPins.filter((p) => p.id !== pinId));
    // Очищаем из маппинга
    setSupportedPackages(
      supportedPackages.map((m) => {
        const nextMap = { ...m.pinMap };
        delete nextMap[pinId];
        return { ...m, pinMap: nextMap };
      })
    );
  };

  const handleUpdatePin = (pinId: string, updates: Partial<LogicalPin>) => {
    setLogicalPins(logicalPins.map((p) => (p.id === pinId ? { ...p, ...updates } : p)));
  };

  const handleSetPinMapping = (logicalPinId: string, padNum: number) => {
    if (!activePackageId) return;
    setSupportedPackages(
      supportedPackages.map((m) => {
        if (m.packageId === activePackageId) {
          return {
            ...m,
            pinMap: {
              ...m.pinMap,
              [logicalPinId]: padNum,
            },
          };
        }
        return m;
      })
    );
  };

  const handleAddSupportedPackage = (pkgId: string) => {
    if (supportedPackages.some((m) => m.packageId === pkgId)) return;
    const autoMap: Record<string, number> = {};
    logicalPins.forEach((p, idx) => {
      autoMap[p.id] = idx + 1;
    });
    setSupportedPackages([...supportedPackages, { packageId: pkgId, pinMap: autoMap }]);
    setActivePackageId(pkgId);
  };

  const handleRemoveSupportedPackage = (pkgId: string) => {
    const filtered = supportedPackages.filter((m) => m.packageId !== pkgId);
    setSupportedPackages(filtered);
    if (activePackageId === pkgId && filtered.length > 0) {
      setActivePackageId(filtered[0].packageId);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Укажите наименование компонента");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const device: DeviceDefinition = {
      id: id || `DEV_${Date.now()}`,
      name: name.trim(),
      category,
      subcategory,
      designatorPrefix: designatorPrefix.trim().toUpperCase() || "U",
      description: description.trim(),
      datasheet: datasheet.trim() || undefined,
      tags,
      parameters: {
        value: value.trim() || undefined,
        voltageRating: voltageRating.trim() || undefined,
        powerRating: powerRating.trim() || undefined,
        tolerance: tolerance.trim() || undefined,
      },
      logicalPins,
      supportedPackages,
    };

    await db.saveDevice(device);
    onClose();
  };

  const currentCategoryObj = categories.find((c) => c.id === category);

  if (!isOpen) return null;

  return (
    <div className="cad-modal-overlay" onClick={onClose}>
      <div
        className="cad-modal-container device-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cad-modal-header">
          <div className="header-title-group">
            <Cpu size={18} className="header-icon" />
            <h3>{initialDevice ? "Редактирование компонента" : "Создание нового компонента"}</h3>
          </div>
          <button className="cad-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="device-editor-body">
          {/* Секция 1: Основные параметры */}
          <div className="form-section">
            <span className="section-title">Основные свойства</span>
            <div className="form-grid-3">
              <div className="form-field">
                <label>Наименование</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="например, TL072CN или Резистор 10к"
                />
              </div>

              <div className="form-field">
                <label>Позиционное обозначение (RefDes)</label>
                <input
                  type="text"
                  value={designatorPrefix}
                  onChange={(e) => setDesignatorPrefix(e.target.value)}
                  placeholder="R, C, DA, DD, VT..."
                />
              </div>

              <div className="form-field">
                <label>Номинал (Value)</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="10k, 100nF, TL072..."
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label>Категория</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Подкатегория</label>
                <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                  {currentCategoryObj?.subcategories?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  )) || <option value="general">Общие</option>}
                </select>
              </div>

              <div className="form-field">
                <label>Теги для поиска (через запятую)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="оу, усилитель, 0805..."
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label>Напряжение</label>
                <input
                  type="text"
                  value={voltageRating}
                  onChange={(e) => setVoltageRating(e.target.value)}
                  placeholder="50V, ±18V..."
                />
              </div>
              <div className="form-field">
                <label>Мощность</label>
                <input
                  type="text"
                  value={powerRating}
                  onChange={(e) => setPowerRating(e.target.value)}
                  placeholder="0.25W, 1W..."
                />
              </div>
              <div className="form-field">
                <label>Допуск</label>
                <input
                  type="text"
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value)}
                  placeholder="1%, 5%..."
                />
              </div>
            </div>

            <div className="form-field full-width">
              <label>Описание и схемотехнические заметки</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Назначение, схема включения..."
                rows={2}
              />
            </div>
          </div>

          {/* Секция 2: Таблица логических выводов */}
          <div className="form-section">
            <div className="section-title-row">
              <span className="section-title">Логические выводы (Сигналы)</span>
              <button className="cad-btn-secondary btn-sm" onClick={handleAddPin}>
                <Plus size={13} />
                <span>Добавить вывод</span>
              </button>
            </div>

            <div className="editor-table-scroll">
              <table className="editor-table">
                <thead>
                  <tr>
                    <th>ID вывода</th>
                    <th>Название (Сигнал)</th>
                    <th>Электрический тип</th>
                    <th>Секция (Unit)</th>
                    <th>Описание</th>
                    <th style={{ width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {logicalPins.map((pin) => (
                    <tr key={pin.id}>
                      <td>
                        <input
                          type="text"
                          value={pin.id}
                          onChange={(e) => handleUpdatePin(pin.id, { id: e.target.value })}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={pin.name}
                          onChange={(e) => handleUpdatePin(pin.id, { name: e.target.value })}
                          className="table-input font-bold"
                        />
                      </td>
                      <td>
                        <select
                          value={pin.electricalType}
                          onChange={(e) =>
                            handleUpdatePin(pin.id, {
                              electricalType: e.target.value as PinElectricalType,
                            })
                          }
                          className="table-select"
                        >
                          <option value="passive">passive (пассивный)</option>
                          <option value="input">input (вход)</option>
                          <option value="output">output (выход)</option>
                          <option value="bidirectional">bidirectional (двунаправленный)</option>
                          <option value="power_in">power_in (питание +)</option>
                          <option value="ground">ground (земля/общий)</option>
                          <option value="open_collector">open_collector</option>
                          <option value="no_connect">no_connect (NC)</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={pin.unit || ""}
                          onChange={(e) => handleUpdatePin(pin.id, { unit: e.target.value })}
                          placeholder="A, B, Power"
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={pin.description || ""}
                          onChange={(e) => handleUpdatePin(pin.id, { description: e.target.value })}
                          placeholder="Назначение вывода"
                          className="table-input"
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="card-icon-btn danger"
                          onClick={() => handleRemovePin(pin.id)}
                          title="Удалить вывод"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Секция 3: Привязка к физическому корпусу (Pin-to-Pad Mapping) */}
          <div className="form-section">
            <span className="section-title">Привязка к физическим корпусам (Pin-to-Pad Mapping)</span>

            {/* Вкладки поддерживаемых корпусов */}
            <div className="package-mapping-bar">
              <div className="pkg-tabs-row">
                {supportedPackages.map((m) => {
                  const pkgObj = allPackages.find((p) => p.id === m.packageId);
                  const isCur = m.packageId === activePackageId;
                  return (
                    <div key={m.packageId} className={`pkg-tab-chip ${isCur ? "active" : ""}`}>
                      <span onClick={() => setActivePackageId(m.packageId)}>
                        {pkgObj?.name || m.packageId}
                      </span>
                      {supportedPackages.length > 1 && (
                        <button
                          className="chip-del-btn"
                          onClick={() => handleRemoveSupportedPackage(m.packageId)}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Выпадающий список добавления корпуса */}
              <div className="add-pkg-row">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddSupportedPackage(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    + Привязать еще корпус...
                  </option>
                  {allPackages
                    .filter((p) => !supportedPackages.some((m) => m.packageId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.mountType.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Таблица маппинга пинов на площадки текущего корпуса */}
            {currentPkg && currentMapping && (
              <div className="mapping-table-wrapper">
                <table className="editor-table">
                  <thead>
                    <tr>
                      <th>Логический сигнал</th>
                      <th>Электрический тип</th>
                      <th>Физическая площадка (Pad) на корпусе {currentPkg.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logicalPins.map((pin) => {
                      const assignedPadNum = currentMapping.pinMap[pin.id] || 1;
                      return (
                        <tr key={pin.id}>
                          <td>
                            <strong>{pin.name}</strong> ({pin.id})
                          </td>
                          <td>
                            <span className="type-badge-sm">{pin.electricalType}</span>
                          </td>
                          <td>
                            <select
                              value={assignedPadNum}
                              onChange={(e) =>
                                handleSetPinMapping(pin.id, parseInt(e.target.value, 10))
                              }
                              className="table-select pad-select"
                            >
                              {currentPkg.pads.map((pad) => (
                                <option key={pad.padNum} value={pad.padNum}>
                                  Площадка {pad.padNum} {pad.name ? `(${pad.name})` : ""}
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
            )}
          </div>
        </div>

        {/* Подвал с кнопками сохранения */}
        <div className="cad-modal-footer">
          <button className="cad-btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="cad-btn-primary" onClick={handleSave}>
            <Save size={15} />
            <span>Сохранить компонент</span>
          </button>
        </div>
      </div>
    </div>
  );
};
