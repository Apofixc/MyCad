// src/components/Modals/ComponentLibraryModal.tsx
// Браузер базы данных компонентов MyCad

import React, { useState, useEffect, useMemo } from "react";
import {
  DeviceDefinition,
  PackageDefinition,
} from "../../types/componentLibrary";
import { ComponentDatabaseService } from "../../services/componentDatabase";
import { FootprintPreview } from "../SvgRenderer/FootprintPreview";
import {
  Search,
  X,
  Plus,
  Edit2,
  Trash2,
  Layers,
  Cpu,
  Zap,
  Plug,
  Crosshair,
  Sliders,
  CheckCircle2,
  Package,
  Info,
} from "lucide-react";

interface ComponentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceOnBoard: (deviceId: string, packageId: string, variantId: string) => void;
  onOpenDeviceEditor?: (device?: DeviceDefinition) => void;
  onOpenPackageEditor?: (pkg?: PackageDefinition) => void;
}

export const ComponentLibraryModal: React.FC<ComponentLibraryModalProps> = ({
  isOpen,
  onClose,
  onPlaceOnBoard,
  onOpenDeviceEditor,
  onOpenPackageEditor,
}) => {
  const db = ComponentDatabaseService.getInstance();

  const [activeTab, setActiveTab] = useState<"devices" | "packages">("devices");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [selectedMountType, setSelectedMountType] = useState<"all" | "tht" | "smd">("all");

  // Выбранные сущности
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Реактивное обновление при изменении базы
  const [, setTick] = useState(0);
  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, [db]);

  const categories = db.getCategories();

  // Фильтрованный список девайсов
  const filteredDevices = useMemo(() => {
    return db.searchDevices({
      query: searchQuery,
      categoryId: selectedCategoryId || undefined,
      subcategoryId: selectedSubcategoryId || undefined,
      mountType: selectedMountType,
    });
  }, [db, searchQuery, selectedCategoryId, selectedSubcategoryId, selectedMountType]);

  // Фильтрованный список корпусов
  const filteredPackages = useMemo(() => {
    return db.searchPackages({
      query: searchQuery,
      mountType: selectedMountType,
    });
  }, [db, searchQuery, selectedMountType]);

  // Установка начального выбора девайса
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "devices" && filteredDevices.length > 0) {
      if (!selectedDeviceId || !filteredDevices.some((d) => d.id === selectedDeviceId)) {
        setSelectedDeviceId(filteredDevices[0].id);
      }
    }
  }, [isOpen, activeTab, filteredDevices, selectedDeviceId]);

  // Установка начального выбора корпуса
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "packages" && filteredPackages.length > 0) {
      if (!selectedPackageId || !filteredPackages.some((p) => p.id === selectedPackageId)) {
        setSelectedPackageId(filteredPackages[0].id);
      }
    }
  }, [isOpen, activeTab, filteredPackages, selectedPackageId]);

  // Текущий выбранный девайс
  const selectedDevice = useMemo(() => {
    return selectedDeviceId ? db.getDevice(selectedDeviceId) : undefined;
  }, [db, selectedDeviceId]);

  // Текущий выбранный корпус (для девайса или в режиме корпусов)
  const currentPackage = useMemo(() => {
    if (activeTab === "packages") {
      return selectedPackageId ? db.getPackage(selectedPackageId) : undefined;
    }
    if (selectedDevice && selectedDevice.supportedPackages.length > 0) {
      const pkgId = selectedPackageId || selectedDevice.supportedPackages[0].packageId;
      return db.getPackage(pkgId) || db.getPackage(selectedDevice.supportedPackages[0].packageId);
    }
    return undefined;
  }, [db, activeTab, selectedPackageId, selectedDevice]);

  // Текущий выбранный вариант исполнения
  const currentVariant = useMemo(() => {
    if (!currentPackage) return undefined;
    if (selectedVariantId) {
      const v = currentPackage.variants.find((item) => item.id === selectedVariantId);
      if (v) return v;
    }
    return (
      currentPackage.variants.find((v) => v.id === currentPackage.defaultVariantId) ||
      currentPackage.variants[0]
    );
  }, [currentPackage, selectedVariantId]);

  const handlePlace = () => {
    if (!selectedDevice || !currentPackage || !currentVariant) return;
    onPlaceOnBoard(selectedDevice.id, currentPackage.id, currentVariant.id);
    onClose();
  };

  // Горячие клавиши модального окна (Esc - закрыть, Enter - разместить)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = (target?.tagName || "").toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          if (activeTab === "devices" && selectedDevice && currentPackage && currentVariant) {
            handlePlace();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, activeTab, selectedDevice, currentPackage, currentVariant]);

  const handleDeleteDevice = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить этот компонент из базы?")) {
      await db.deleteDevice(id);
    }
  };

  const handleDeletePackage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Вы уверены, что хотите удалить этот корпус из базы?")) {
      await db.deletePackage(id);
    }
  };

  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case "Zap":
        return <Zap size={15} />;
      case "Cpu":
        return <Cpu size={15} />;
      case "Layers":
        return <Layers size={15} />;
      case "Plug":
        return <Plug size={15} />;
      case "Crosshair":
        return <Crosshair size={15} />;
      default:
        return <Package size={15} />;
    }
  };

  const getElectricalTypeBadgeColor = (type: string) => {
    switch (type) {
      case "power_in":
        return "#ef4444";
      case "ground":
        return "#3b82f6";
      case "output":
      case "power_out":
        return "#10b981";
      case "input":
        return "#f59e0b";
      case "bidirectional":
        return "#a855f7";
      default:
        return "#64748b";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cad-modal-overlay" onClick={onClose}>
      <div
        className="cad-modal-container component-library-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок модального окна */}
        <div className="cad-modal-header">
          <div className="header-title-group">
            <Package size={20} className="header-icon" />
            <div>
              <h3>База данных компонентов MyCad</h3>
              <span className="header-subtitle">
                Каталог радиокомпонентов, физических корпусов и вариантов исполнения
              </span>
            </div>
          </div>
          <button className="cad-close-btn" onClick={onClose} title="Закрыть (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Главная рабочая область из 3-х колонок */}
        <div className="component-library-body">
          {/* КОЛОНКА 1: ДЕРЕВО КАТАЛОГА */}
          <div className="library-left-pane">
            {/* Переключатель вкладок Компоненты / Корпуса */}
            <div className="library-tab-switcher">
              <button
                className={`tab-btn ${activeTab === "devices" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("devices");
                  setSelectedPackageId(null);
                  setSelectedVariantId(null);
                }}
              >
                <Cpu size={14} />
                <span>Компоненты</span>
              </button>
              <button
                className={`tab-btn ${activeTab === "packages" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("packages");
                  setSelectedVariantId(null);
                }}
              >
                <Package size={14} />
                <span>Корпуса</span>
              </button>
            </div>

            {/* Иерархическое дерево категорий */}
            <div className="catalog-tree-section">
              <div
                className={`tree-category-item all-item ${!selectedCategoryId ? "active" : ""}`}
                onClick={() => {
                  setSelectedCategoryId(null);
                  setSelectedSubcategoryId(null);
                }}
              >
                <Sliders size={14} />
                <span>Все категории</span>
              </div>

              {categories.map((cat) => {
                const isSelectedCat = selectedCategoryId === cat.id;
                return (
                  <div key={cat.id} className="tree-category-group">
                    <div
                      className={`tree-category-item ${isSelectedCat && !selectedSubcategoryId ? "active" : ""}`}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedSubcategoryId(null);
                      }}
                    >
                      {getCategoryIcon(cat.icon)}
                      <span className="category-name">{cat.name}</span>
                    </div>

                    {/* Подкатегории */}
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="tree-subcategories-list">
                        {cat.subcategories.map((sub) => {
                          const isSelectedSub =
                            selectedCategoryId === cat.id && selectedSubcategoryId === sub.id;
                          return (
                            <div
                              key={sub.id}
                              className={`tree-subcategory-item ${isSelectedSub ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategoryId(cat.id);
                                setSelectedSubcategoryId(sub.id);
                              }}
                            >
                              <span className="bullet">•</span>
                              <span>{sub.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* КОЛОНКА 2: СПИСОК И ПОИСК */}
          <div className="library-middle-pane">
            {/* Поисковая панель и фильтр монтажа */}
            <div className="middle-toolbar">
              <div className="library-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder={
                    activeTab === "devices"
                      ? "Поиск по названию, номиналу, тегам, пинам..."
                      : "Поиск корпуса по названию, стандарту..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Фильтр по типу монтажа THT / SMD */}
              <div className="mount-type-filter">
                <button
                  className={`chip-btn ${selectedMountType === "all" ? "active" : ""}`}
                  onClick={() => setSelectedMountType("all")}
                >
                  Все
                </button>
                <button
                  className={`chip-btn ${selectedMountType === "tht" ? "active" : ""}`}
                  onClick={() => setSelectedMountType("tht")}
                >
                  THT
                </button>
                <button
                  className={`chip-btn ${selectedMountType === "smd" ? "active" : ""}`}
                  onClick={() => setSelectedMountType("smd")}
                >
                  SMD
                </button>
              </div>
            </div>

            {/* Кнопки добавления */}
            <div className="middle-actions-row">
              <span className="items-count">
                Найдено: {activeTab === "devices" ? filteredDevices.length : filteredPackages.length}
              </span>
              <div className="action-buttons-group">
                {activeTab === "devices" ? (
                  <button
                    className="cad-btn-secondary btn-sm"
                    onClick={() => onOpenDeviceEditor?.()}
                    title="Создать новый компонент"
                  >
                    <Plus size={14} />
                    <span>Создать деталь</span>
                  </button>
                ) : (
                  <button
                    className="cad-btn-secondary btn-sm"
                    onClick={() => onOpenPackageEditor?.()}
                    title="Создать новый корпус"
                  >
                    <Plus size={14} />
                    <span>Создать корпус</span>
                  </button>
                )}
              </div>
            </div>

            {/* Список карточек */}
            <div className="library-items-list">
              {activeTab === "devices" ? (
                filteredDevices.length > 0 ? (
                  filteredDevices.map((dev) => {
                    const isSelected = selectedDeviceId === dev.id;
                    const primaryPkgId = dev.supportedPackages[0]?.packageId;
                    const primaryPkg = primaryPkgId ? db.getPackage(primaryPkgId) : undefined;

                    return (
                      <div
                        key={dev.id}
                        className={`library-card ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedDeviceId(dev.id);
                          if (dev.supportedPackages.length > 0) {
                            setSelectedPackageId(dev.supportedPackages[0].packageId);
                            setSelectedVariantId(dev.supportedPackages[0].defaultVariantId || null);
                          }
                        }}
                        onDoubleClick={() => {
                          if (dev.supportedPackages.length > 0) {
                            const pId = dev.supportedPackages[0].packageId;
                            const vId = dev.supportedPackages[0].defaultVariantId || undefined;
                            const pkg = db.getPackage(pId);
                            if (pkg) {
                              onPlaceOnBoard(dev.id, pkg.id, vId || pkg.defaultVariantId);
                              onClose();
                            }
                          }
                        }}
                        title="Кликните для выбора, двойной клик — быстро разместить на плате"
                      >
                        <div className="card-top-row">
                          <span className="refdes-badge">{dev.designatorPrefix}</span>
                          <span className="card-title">{dev.name}</span>
                        </div>

                        <div className="card-meta-row">
                          {dev.parameters.value && (
                            <span className="val-badge">{dev.parameters.value}</span>
                          )}
                          {primaryPkg && (
                            <span className="pkg-badge">
                              {primaryPkg.name} ({primaryPkg.mountType.toUpperCase()})
                            </span>
                          )}
                          <span className="pins-badge">Пинов: {dev.logicalPins.length}</span>
                        </div>

                        {dev.description && (
                          <div className="card-desc" title={dev.description}>
                            {dev.description}
                          </div>
                        )}

                        {/* Кнопки редактирования / удаления карточки */}
                        <div className="card-hover-actions">
                          <button
                            className="card-icon-btn"
                            title="Редактировать девайс"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDeviceEditor?.(dev);
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="card-icon-btn danger"
                            title="Удалить девайс"
                            onClick={(e) => handleDeleteDevice(e, dev.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-list-placeholder">
                    <span>Компоненты не найдены</span>
                  </div>
                )
              ) : filteredPackages.length > 0 ? (
                filteredPackages.map((pkg) => {
                  const isSelected = selectedPackageId === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      className={`library-card package-card ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedPackageId(pkg.id);
                        setSelectedVariantId(pkg.defaultVariantId);
                      }}
                    >
                      <div className="card-top-row">
                        <span className="mount-badge">{pkg.mountType.toUpperCase()}</span>
                        <span className="card-title">{pkg.name}</span>
                      </div>

                      <div className="card-meta-row">
                        <span className="pkg-badge">{pkg.family}</span>
                        <span className="pins-badge">Площадок: {pkg.pads.length}</span>
                        <span className="dim-badge">
                          {pkg.bodyWidth}×{pkg.bodyHeight} мм
                        </span>
                        <span className="variant-count-badge">
                          Вариантов: {pkg.variants.length}
                        </span>
                      </div>

                      <div className="card-hover-actions">
                        <button
                          className="card-icon-btn"
                          title="Редактировать корпус"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPackageEditor?.(pkg);
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="card-icon-btn danger"
                          title="Удалить корпус"
                          onClick={(e) => handleDeletePackage(e, pkg.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-list-placeholder">
                  <span>Корпуса не найдены</span>
                </div>
              )}
            </div>
          </div>

          {/* КОЛОНКА 3: ПРЕДПРОСМОТР, ВАРИАНТЫ И ПАРАМЕТРЫ */}
          <div className="library-right-pane">
            {currentPackage ? (
              <div className="details-scroll-content">
                {/* Векторный интерактивный чертеж корпуса */}
                <div className="preview-card-wrapper">
                  <div className="preview-header">
                    <span className="section-title">Геометрия посадочного места (2D)</span>
                    <span className="pitch-info">Шаг выводов: {currentPackage.pitch} мм</span>
                  </div>

                  <FootprintPreview
                    packageDef={currentPackage}
                    variant={currentVariant}
                    deviceDef={activeTab === "devices" ? selectedDevice : undefined}
                    width="100%"
                    height={230}
                  />
                </div>

                {/* ПЕРЕКЛЮЧАТЕЛЬ ВАРИАНТОВ ИСПОЛНЕНИЯ КОРПУСА */}
                <div className="variants-selector-box">
                  <div className="section-title-row">
                    <span className="section-title">Вариант исполнения корпуса</span>
                    <span className="variant-note">Цвет, материал, наличие ключа</span>
                  </div>

                  <div className="variants-chips-list">
                    {currentPackage.variants.map((v) => {
                      const isVarSelected = (currentVariant?.id || currentPackage.defaultVariantId) === v.id;
                      return (
                        <button
                          key={v.id}
                          className={`variant-chip ${isVarSelected ? "active" : ""}`}
                          onClick={() => setSelectedVariantId(v.id)}
                        >
                          {/* Цветовой кружок */}
                          <span
                            className="color-dot"
                            style={{
                              backgroundColor: v.bodyColor || "#1e293b",
                              border: `1px solid ${v.bodyBorderColor || "#64748b"}`,
                            }}
                          />
                          <span className="variant-chip-name">{v.name}</span>
                          {isVarSelected && <CheckCircle2 size={12} className="check-icon" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ВЫБОР КОРПУСА (если у девайса несколько вариантов корпусов) */}
                {activeTab === "devices" && selectedDevice && selectedDevice.supportedPackages.length > 1 && (
                  <div className="supported-packages-box">
                    <span className="section-title">Доступные типы корпусов</span>
                    <div className="pkg-buttons-row">
                      {selectedDevice.supportedPackages.map((m) => {
                        const isPkgActive = currentPackage.id === m.packageId;
                        const pkgInfo = db.getPackage(m.packageId);
                        return (
                          <button
                            key={m.packageId}
                            className={`pkg-choice-btn ${isPkgActive ? "active" : ""}`}
                            onClick={() => {
                              setSelectedPackageId(m.packageId);
                              setSelectedVariantId(m.defaultVariantId || null);
                            }}
                          >
                            <span>{pkgInfo?.name || m.packageId}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ТАБЛИЦА ЦОКОЛЕВКИ ВЫВОДОВ (для девайса) */}
                {activeTab === "devices" && selectedDevice && (
                  <div className="pinout-section">
                    <span className="section-title">Цоколевка и назначение выводов</span>
                    <div className="pinout-table-wrapper">
                      <table className="pinout-table">
                        <thead>
                          <tr>
                            <th>Pad</th>
                            <th>Сигнал</th>
                            <th>Тип</th>
                            <th>Назначение</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPackage.pads.map((pad) => {
                            const mapping = selectedDevice.supportedPackages.find(
                              (m) => m.packageId === currentPackage.id
                            );
                            // Ищем логический пин по номеру пада
                            let logPinId: string | undefined;
                            if (mapping) {
                              for (const [lId, pNum] of Object.entries(mapping.pinMap)) {
                                if (pNum === pad.padNum) {
                                  logPinId = lId;
                                  break;
                                }
                              }
                            }
                            const logPin = logPinId
                              ? selectedDevice.logicalPins.find((p) => p.id === logPinId)
                              : undefined;

                            return (
                              <tr key={pad.padNum}>
                                <td className="pad-cell">
                                  <strong>{pad.padNum}</strong>
                                </td>
                                <td className="signal-cell">
                                  {logPin ? (
                                    <span className="signal-name">{logPin.name}</span>
                                  ) : (
                                    <span className="unconnected-pad">NC</span>
                                  )}
                                </td>
                                <td>
                                  {logPin ? (
                                    <span
                                      className="type-tag"
                                      style={{
                                        color: getElectricalTypeBadgeColor(logPin.electricalType),
                                        backgroundColor: `${getElectricalTypeBadgeColor(logPin.electricalType)}15`,
                                        borderColor: `${getElectricalTypeBadgeColor(logPin.electricalType)}40`,
                                      }}
                                    >
                                      {logPin.electricalType}
                                    </span>
                                  ) : (
                                    <span className="type-tag nc">NC</span>
                                  )}
                                </td>
                                <td className="desc-cell">{logPin?.description || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ХАРАКТЕРИСТИКИ И ПАРАМЕТРЫ */}
                {activeTab === "devices" && selectedDevice && (
                  <div className="device-params-section">
                    <span className="section-title">Электрические характеристики</span>
                    <div className="params-grid">
                      {selectedDevice.parameters.value && (
                        <div className="param-item">
                          <span className="param-label">Номинал:</span>
                          <span className="param-val">{selectedDevice.parameters.value}</span>
                        </div>
                      )}
                      {selectedDevice.parameters.tolerance && (
                        <div className="param-item">
                          <span className="param-label">Допуск:</span>
                          <span className="param-val">{selectedDevice.parameters.tolerance}</span>
                        </div>
                      )}
                      {selectedDevice.parameters.voltageRating && (
                        <div className="param-item">
                          <span className="param-label">Напряжение:</span>
                          <span className="param-val">{selectedDevice.parameters.voltageRating}</span>
                        </div>
                      )}
                      {selectedDevice.parameters.powerRating && (
                        <div className="param-item">
                          <span className="param-label">Мощность:</span>
                          <span className="param-val">{selectedDevice.parameters.powerRating}</span>
                        </div>
                      )}
                      {selectedDevice.parameters.maxCurrent && (
                        <div className="param-item">
                          <span className="param-label">Макс. ток:</span>
                          <span className="param-val">{selectedDevice.parameters.maxCurrent}</span>
                        </div>
                      )}
                      {selectedDevice.parameters.operatingTemp && (
                        <div className="param-item">
                          <span className="param-label">Температура:</span>
                          <span className="param-val">{selectedDevice.parameters.operatingTemp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ОГРАНИЧЕНИЯ КОРПУСА */}
                {currentPackage.constraints && (
                  <div className="constraints-section">
                    <span className="section-title">Механические и тепловые параметры</span>
                    <div className="params-grid">
                      <div className="param-item">
                        <span className="param-label">Courtyard:</span>
                        <span className="param-val">
                          {currentPackage.constraints.courtyardWidth} × {currentPackage.constraints.courtyardHeight} мм
                        </span>
                      </div>
                      <div className="param-item">
                        <span className="param-label">Высота макс. (Z):</span>
                        <span className="param-val">{currentPackage.constraints.maxHeight} мм</span>
                      </div>
                      <div className="param-item">
                        <span className="param-label">Термопад:</span>
                        <span className="param-val">
                          {currentPackage.constraints.hasThermalPad ? "Есть (Pad " + currentPackage.constraints.thermalPadNum + ")" : "Нет"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-details-placeholder">
                <Info size={28} />
                <span>Выберите компонент или корпус для просмотра</span>
              </div>
            )}
          </div>
        </div>

        {/* Единый подвал модального окна на всю ширину с информацией и кнопками */}
        <div className="cad-modal-footer library-bottom-footer">
          <div className="footer-status-bar">
            {activeTab === "devices" && selectedDevice ? (
              <span className="footer-status-text">
                <span className="footer-status-label">Выбран:</span>{" "}
                <strong className="footer-status-name">{selectedDevice.name}</strong>{" "}
                {selectedDevice.parameters.value && (
                  <span className="footer-status-val">({selectedDevice.parameters.value})</span>
                )}
                {currentPackage && (
                  <span className="footer-status-pkg">
                    {" "}• Корпус: <strong>{currentPackage.name}</strong>
                    {currentVariant && <span> [{currentVariant.name}]</span>}
                  </span>
                )}
              </span>
            ) : activeTab === "packages" && currentPackage ? (
              <span className="footer-status-text">
                <span className="footer-status-label">Выбран корпус:</span>{" "}
                <strong className="footer-status-name">{currentPackage.name}</strong>
                {currentVariant && <span> • Вариант: [{currentVariant.name}]</span>}
              </span>
            ) : (
              <span className="footer-hint-text">
                💡 Выберите компонент из списка для предпросмотра и размещения на плате (двойной клик или Enter)
              </span>
            )}
          </div>

          <div className="footer-actions">
            <button className="cad-btn-secondary" onClick={onClose}>
              Отмена
            </button>
            {activeTab === "devices" && (
              <button
                className="cad-btn-primary place-btn"
                disabled={!selectedDevice || !currentPackage}
                onClick={handlePlace}
                title="Разместить выбранный компонент на плате (Enter)"
              >
                <Plus size={16} />
                <span>Разместить на плате</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
