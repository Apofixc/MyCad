// src/components/Modals/PackageEditorModal.tsx
// Редактор физического корпуса и вариантов исполнения (Package Editor)

import React, { useState, useEffect } from "react";
import {
  PackageDefinition,
  PackagePad,
  PackageVariant,
  MountType,
  PackageFamily,
  PadShape,
  PackageKeyType,
} from "../../types/componentLibrary";
import { ComponentDatabaseService } from "../../services/componentDatabase";
import { FootprintPreview } from "../SvgRenderer/FootprintPreview";
import { X, Plus, Trash2, Save, Package as PkgIcon } from "lucide-react";

interface PackageEditorModalProps {
  isOpen: boolean;
  initialPackage?: PackageDefinition;
  onClose: () => void;
}

export const PackageEditorModal: React.FC<PackageEditorModalProps> = ({
  isOpen,
  initialPackage,
  onClose,
}) => {
  const db = ComponentDatabaseService.getInstance();

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [standard, setStandard] = useState("");
  const [family, setFamily] = useState<PackageFamily>("dip");
  const [mountType, setMountType] = useState<MountType>("tht");
  const [bodyWidth, setBodyWidth] = useState<number>(6.5);
  const [bodyHeight, setBodyHeight] = useState<number>(9.6);
  const [pitch, setPitch] = useState<number>(2.54);

  const [pads, setPads] = useState<PackagePad[]>([]);
  const [variants, setVariants] = useState<PackageVariant[]>([]);
  const [defaultVariantId, setDefaultVariantId] = useState<string>("default");

  useEffect(() => {
    if (initialPackage) {
      setId(initialPackage.id);
      setName(initialPackage.name);
      setStandard(initialPackage.standard || "");
      setFamily(initialPackage.family);
      setMountType(initialPackage.mountType);
      setBodyWidth(initialPackage.bodyWidth);
      setBodyHeight(initialPackage.bodyHeight);
      setPitch(initialPackage.pitch);
      setPads(initialPackage.pads || []);
      setVariants(initialPackage.variants || []);
      setDefaultVariantId(initialPackage.defaultVariantId || "default");
    } else {
      setId(`PKG_${Date.now()}`);
      setName("Новый корпус");
      setStandard("IPC-7351");
      setFamily("chip_2pin");
      setMountType("smd");
      setBodyWidth(2.0);
      setBodyHeight(1.25);
      setPitch(1.8);
      setPads([
        { padNum: 1, name: "1", x: 0, y: -0.9, width: 1.3, height: 0.9, shape: "rounded_rect", roundRadius: 0.15 },
        { padNum: 2, name: "2", x: 0, y: 0.9, width: 1.3, height: 0.9, shape: "rounded_rect", roundRadius: 0.15 },
      ]);
      setVariants([
        {
          id: "default",
          name: "Стандартный черный",
          bodyColor: "#1e293b",
          bodyBorderColor: "#475569",
          keyType: "none",
        },
      ]);
      setDefaultVariantId("default");
    }
  }, [initialPackage, isOpen]);

  if (!isOpen) return null;

  // Временный объект корпуса для живого предпросмотра
  const previewPkg: PackageDefinition = {
    id,
    name,
    standard,
    family,
    mountType,
    bodyWidth: Number(bodyWidth) || 1,
    bodyHeight: Number(bodyHeight) || 1,
    pitch: Number(pitch) || 1,
    pads,
    constraints: {
      courtyardWidth: (Number(bodyWidth) || 1) + 2,
      courtyardHeight: (Number(bodyHeight) || 1) + 2,
      maxHeight: 2.0,
      hasThermalPad: false,
    },
    defaultVariantId,
    variants,
  };

  const activeVariant = variants.find((v) => v.id === defaultVariantId) || variants[0];

  const handleAddPad = () => {
    const nextNum = pads.length + 1;
    const newPad: PackagePad = {
      padNum: nextNum,
      name: String(nextNum),
      x: 0,
      y: (nextNum - 1) * pitch,
      width: mountType === "smd" ? 1.5 : 1.6,
      height: mountType === "smd" ? 0.8 : 1.6,
      shape: mountType === "smd" ? "rounded_rect" : "circle",
      drillDiameter: mountType === "tht" ? 0.8 : undefined,
    };
    setPads([...pads, newPad]);
  };

  const handleRemovePad = (padNum: number) => {
    setPads(pads.filter((p) => p.padNum !== padNum));
  };

  const handleUpdatePad = (padNum: number, updates: Partial<PackagePad>) => {
    setPads(pads.map((p) => (p.padNum === padNum ? { ...p, ...updates } : p)));
  };

  const handleAddVariant = () => {
    const nextIdx = variants.length + 1;
    const newVar: PackageVariant = {
      id: `var_${nextIdx}`,
      name: `Вариант ${nextIdx}`,
      bodyColor: "#1e293b",
      bodyBorderColor: "#475569",
      keyType: "none",
    };
    setVariants([...variants, newVar]);
  };

  const handleRemoveVariant = (varId: string) => {
    if (variants.length <= 1) {
      alert("Корпус должен содержать хотя бы один вариант исполнения");
      return;
    }
    setVariants(variants.filter((v) => v.id !== varId));
    if (defaultVariantId === varId) {
      setDefaultVariantId(variants[0].id);
    }
  };

  const handleUpdateVariant = (varId: string, updates: Partial<PackageVariant>) => {
    setVariants(variants.map((v) => (v.id === varId ? { ...v, ...updates } : v)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Укажите наименование корпуса");
      return;
    }

    const pkg: PackageDefinition = {
      id: id || `PKG_${Date.now()}`,
      name: name.trim(),
      standard: standard.trim() || undefined,
      family,
      mountType,
      bodyWidth: Number(bodyWidth) || 1,
      bodyHeight: Number(bodyHeight) || 1,
      pitch: Number(pitch) || 1,
      pads,
      constraints: {
        courtyardWidth: Number(bodyWidth) + 2,
        courtyardHeight: Number(bodyHeight) + 2,
        maxHeight: 3.0,
      },
      defaultVariantId,
      variants,
    };

    await db.savePackage(pkg);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cad-modal-overlay" onClick={onClose}>
      <div
        className="cad-modal-container package-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cad-modal-header">
          <div className="header-title-group">
            <PkgIcon size={18} className="header-icon" />
            <h3>{initialPackage ? "Редактирование корпуса" : "Создание нового корпуса"}</h3>
          </div>
          <button className="cad-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="package-editor-body">
          {/* Левая сторона: форма параметров */}
          <div className="package-editor-left">
            <div className="form-section">
              <span className="section-title">Геометрия корпуса</span>
              <div className="form-grid-3">
                <div className="form-field">
                  <label>Название корпуса</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="DIP-8, 0805, TO-220..."
                  />
                </div>

                <div className="form-field">
                  <label>Семейство</label>
                  <select
                    value={family}
                    onChange={(e) => setFamily(e.target.value as PackageFamily)}
                  >
                    <option value="dip">DIP</option>
                    <option value="soic">SOIC</option>
                    <option value="chip_2pin">Chip 2-pin (0805/1206)</option>
                    <option value="axial">Axial (Осевой)</option>
                    <option value="radial">Radial (Радиальный)</option>
                    <option value="sot">SOT</option>
                    <option value="to">TO</option>
                    <option value="qfp">QFP</option>
                    <option value="connector">Разъем / Клеммник</option>
                    <option value="hardware">Служебный (TP)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Тип монтажа</label>
                  <select
                    value={mountType}
                    onChange={(e) => setMountType(e.target.value as MountType)}
                  >
                    <option value="tht">THT (Выводной)</option>
                    <option value="smd">SMD (Поверхностный)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Ширина тела (мм)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyWidth}
                    onChange={(e) => setBodyWidth(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label>Длина тела (мм)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyHeight}
                    onChange={(e) => setBodyHeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label>Шаг выводов (мм)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Варианты исполнения */}
            <div className="form-section">
              <div className="section-title-row">
                <span className="section-title">Варианты исполнения (Цвета, Ключи)</span>
                <button className="cad-btn-secondary btn-sm" onClick={handleAddVariant}>
                  <Plus size={13} />
                  <span>Добавить вариант</span>
                </button>
              </div>

              <div className="variants-editor-list">
                {variants.map((v) => (
                  <div key={v.id} className="variant-edit-row">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => handleUpdateVariant(v.id, { name: e.target.value })}
                      className="variant-name-input"
                      placeholder="Название варианта"
                    />

                    <div className="color-picker-group">
                      <label>Цвет:</label>
                      <input
                        type="color"
                        value={v.bodyColor}
                        onChange={(e) => handleUpdateVariant(v.id, { bodyColor: e.target.value })}
                      />
                    </div>

                    <div className="key-select-group">
                      <label>Ключ:</label>
                      <select
                        value={v.keyType}
                        onChange={(e) =>
                          handleUpdateVariant(v.id, { keyType: e.target.value as PackageKeyType })
                        }
                      >
                        <option value="none">Без ключа</option>
                        <option value="notch">Вырез (notch)</option>
                        <option value="dot">Точка (dot)</option>
                        <option value="chamfer">Скос (chamfer)</option>
                        <option value="stripe">Полоса полярности</option>
                      </select>
                    </div>

                    <button
                      className={`default-btn ${defaultVariantId === v.id ? "active" : ""}`}
                      onClick={() => setDefaultVariantId(v.id)}
                      title="Сделать вариантом по умолчанию"
                    >
                      {defaultVariantId === v.id ? "Основной" : "Сделать осн."}
                    </button>

                    {variants.length > 1 && (
                      <button
                        className="card-icon-btn danger"
                        onClick={() => handleRemoveVariant(v.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Контактные площадки (Pads) */}
            <div className="form-section">
              <div className="section-title-row">
                <span className="section-title">Контактные площадки ({pads.length})</span>
                <button className="cad-btn-secondary btn-sm" onClick={handleAddPad}>
                  <Plus size={13} />
                  <span>Добавить площадку</span>
                </button>
              </div>

              <div className="editor-table-scroll">
                <table className="editor-table">
                  <thead>
                    <tr>
                      <th>Pad #</th>
                      <th>Смещение X (мм)</th>
                      <th>Смещение Y (мм)</th>
                      <th>Ширина (мм)</th>
                      <th>Высота (мм)</th>
                      <th>Форма</th>
                      {mountType === "tht" && <th>Сверление (мм)</th>}
                      <th style={{ width: "35px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pads.map((pad) => (
                      <tr key={pad.padNum}>
                        <td>
                          <strong>{pad.padNum}</strong>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            value={pad.x}
                            onChange={(e) =>
                              handleUpdatePad(pad.padNum, { x: parseFloat(e.target.value) || 0 })
                            }
                            className="table-num-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            value={pad.y}
                            onChange={(e) =>
                              handleUpdatePad(pad.padNum, { y: parseFloat(e.target.value) || 0 })
                            }
                            className="table-num-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            value={pad.width}
                            onChange={(e) =>
                              handleUpdatePad(pad.padNum, {
                                width: parseFloat(e.target.value) || 0.5,
                              })
                            }
                            className="table-num-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            value={pad.height}
                            onChange={(e) =>
                              handleUpdatePad(pad.padNum, {
                                height: parseFloat(e.target.value) || 0.5,
                              })
                            }
                            className="table-num-input"
                          />
                        </td>
                        <td>
                          <select
                            value={pad.shape}
                            onChange={(e) =>
                              handleUpdatePad(pad.padNum, { shape: e.target.value as PadShape })
                            }
                            className="table-select"
                          >
                            <option value="circle">Круг</option>
                            <option value="rounded_rect">Скругл. прям.</option>
                            <option value="rect">Прямоугольник</option>
                            <option value="oval">Овал</option>
                          </select>
                        </td>
                        {mountType === "tht" && (
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              value={pad.drillDiameter || 0.8}
                              onChange={(e) =>
                                handleUpdatePad(pad.padNum, {
                                  drillDiameter: parseFloat(e.target.value) || 0.8,
                                })
                              }
                              className="table-num-input"
                            />
                          </td>
                        )}
                        <td>
                          <button
                            className="card-icon-btn danger"
                            onClick={() => handleRemovePad(pad.padNum)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Правая сторона: Живой предпросмотр */}
          <div className="package-editor-right">
            <span className="section-title">Живой предпросмотр корпуса</span>
            <FootprintPreview
              packageDef={previewPkg}
              variant={activeVariant}
              width={340}
              height={320}
              showDimensions
              showCourtyard
            />

            <div className="preview-tips">
              <span className="tip-title">Подсказка:</span>
              <span>
                Кликните по координатам в таблице, чтобы отредактировать положение контактных площадок.
                Размеры и форма моментально обновляются на чертеже.
              </span>
            </div>
          </div>
        </div>

        <div className="cad-modal-footer">
          <button className="cad-btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="cad-btn-primary" onClick={handleSave}>
            <Save size={15} />
            <span>Сохранить корпус</span>
          </button>
        </div>
      </div>
    </div>
  );
};
