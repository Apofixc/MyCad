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
} from "lucide-react";

interface ComponentLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPackageEditor: (pkg?: PackageDefinition | null) => void;
  onOpenDeviceEditor: (dev?: DeviceDefinition | null) => void;
  onPlaceOnBoard?: (device: DeviceDefinition, packageDef: PackageDefinition) => void;
}

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

  // Если компонентов 0, но корпусов много — сразу показываем корпуса
  const [activeTab, setActiveTab] = useState<"devices" | "packages">("packages");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMount, setSelectedMount] = useState<string>("all");

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

  // Фильтрация радиокомпонентов
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (selectedCategory !== "all" && d.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q)) ||
        (d.parameters?.value && d.parameters.value.toLowerCase().includes(q))
      );
    });
  }, [devices, selectedCategory, searchQuery]);

  // Фильтрация корпусов
  const filteredPackages = useMemo(() => {
    return packages.filter((p) => {
      if (selectedMount !== "all" && p.mountType !== selectedMount) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.standard && p.standard.toLowerCase().includes(q))
      );
    });
  }, [packages, selectedMount, searchQuery]);

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

  return (
    <div className="cad-modal-overlay">
      <div
        className="cad-modal-container component-library-modal"
        style={{
          width: "95vw",
          height: "90vh",
          maxWidth: 1600,
          background: "#0d121f",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          border: "1px solid #1e293b",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85)",
          overflow: "hidden",
        }}
      >
        {/* Шапка модального окна */}
        <div
          className="cad-modal-header"
          style={{
            background: "#0a0e1a",
            borderBottom: "1px solid #1e293b",
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #2563eb, #38bdf8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.4)",
                }}
              >
                <Cpu size={18} color="#ffffff" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: "0.2px" }}>
                Библиотека компонентов и посадочных мест
              </span>
            </div>

            {/* Переключатель вкладок: Радиодетали / Корпуса */}
            <div
              style={{
                display: "flex",
                background: "#141c2e",
                borderRadius: 8,
                padding: 3,
                border: "1px solid #27354f",
              }}
            >
              <button
                onClick={() => setActiveTab("devices")}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: activeTab === "devices" ? 700 : 500,
                  background: activeTab === "devices" ? "#2563eb" : "transparent",
                  color: activeTab === "devices" ? "#ffffff" : "#94a3b8",
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
                onClick={() => setActiveTab("packages")}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: activeTab === "packages" ? 700 : 500,
                  background: activeTab === "packages" ? "#2563eb" : "transparent",
                  color: activeTab === "packages" ? "#ffffff" : "#94a3b8",
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
            <button className="cad-btn-secondary btn-sm" onClick={handleExport} title="Экспорт библиотеки в JSON">
              <Download size={13} />
              <span>Экспорт</span>
            </button>
            <button className="cad-btn-secondary btn-sm" onClick={handleImport} title="Импорт библиотеки из JSON">
              <Upload size={13} />
              <span>Импорт</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                padding: 6,
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Панель поиска, фильтрации и действий */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 18px",
            background: "#0a0f1c",
            borderBottom: "1px solid #1e293b",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Поиск */}
          <div style={{ position: "relative", width: 360 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "devices"
                  ? "Поиск компонента, номинала, MPN..."
                  : "Поиск корпуса (SOIC, TO-92, QFP, 0805)..."
              }
              style={{
                width: "100%",
                padding: "7px 30px 7px 30px",
                fontSize: 12,
                background: "#141c2e",
                border: "1px solid #283750",
                borderRadius: 6,
                color: "#f8fafc",
                outline: "none",
                boxSizing: "border-box",
              }}
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
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Фильтр по типам монтажа (для корпусов) */}
          {activeTab === "packages" && (
            <div style={{ display: "flex", gap: 4, background: "#141c2e", padding: 2, borderRadius: 6, border: "1px solid #283750" }}>
              {[
                { id: "all", label: "Все" },
                { id: "smd", label: "SMD" },
                { id: "tht", label: "THT" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMount(m.id)}
                  style={{
                    padding: "3px 10px",
                    fontSize: 11,
                    borderRadius: 4,
                    border: "none",
                    background: selectedMount === m.id ? "#38bdf8" : "transparent",
                    color: selectedMount === m.id ? "#0f172a" : "#94a3b8",
                    fontWeight: selectedMount === m.id ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

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
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", background: "#080c16" }}>
          {/* Левая панель категорий */}
          <div
            style={{
              width: 220,
              background: "#0a0e1a",
              borderRight: "1px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              padding: "12px 8px",
              gap: 4,
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", padding: "4px 8px", textTransform: "uppercase" }}>
              {activeTab === "devices" ? "Категории" : "Тип монтажа"}
            </span>

            {activeTab === "devices" ? (
              <>
                <button
                  onClick={() => setSelectedCategory("all")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 6,
                    background: selectedCategory === "all" ? "#1e293b" : "transparent",
                    color: selectedCategory === "all" ? "#38bdf8" : "#94a3b8",
                    border: "none",
                    fontSize: 12,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Folder size={14} />
                  <span>Все компоненты ({devices.length})</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: selectedCategory === cat.name ? "#1e293b" : "transparent",
                      color: selectedCategory === cat.name ? "#38bdf8" : "#94a3b8",
                      border: "none",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Tag size={13} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cat.name}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  { id: "all", label: `Все корпуса (${packages.length})` },
                  { id: "smd", label: `SMD (${packages.filter((p) => p.mountType === "smd").length})` },
                  { id: "tht", label: `THT (${packages.filter((p) => p.mountType === "tht").length})` },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMount(m.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 6,
                      background: selectedMount === m.id ? "#1e293b" : "transparent",
                      color: selectedMount === m.id ? "#38bdf8" : "#94a3b8",
                      border: "none",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Box size={14} />
                    <span>{m.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Центральный список элементов */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: "auto",
              padding: 14,
              background: "#080c16",
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
                          background: isSelected ? "#141f36" : "#0d1322",
                          border: isSelected ? "1.5px solid #38bdf8" : "1px solid #1e293b",
                          boxShadow: isSelected ? "0 0 12px rgba(56, 189, 248, 0.2)" : "none",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", color: "#f8fafc", fontSize: 13 }}>{dev.name}</span>
                          <span style={{ fontSize: 10, background: "#1e293b", color: "#38bdf8", padding: "2px 6px", borderRadius: 4 }}>
                            {dev.designatorPrefix}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{dev.category}</span>
                        {dev.description && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {dev.description}
                          </span>
                        )}
                        {dev.parameters?.value && (
                          <span style={{ fontSize: 11, color: "#10b981", fontWeight: "bold" }}>
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
                    color: "#64748b",
                    gap: 12,
                    padding: 40,
                  }}
                >
                  <Layers size={48} style={{ color: "#283750" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
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
                        background: isSelected ? "#141f36" : "#0d1322",
                        border: isSelected ? "1.5px solid #38bdf8" : "1px solid #1e293b",
                        boxShadow: isSelected ? "0 0 12px rgba(56, 189, 248, 0.2)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "bold", color: "#f8fafc", fontSize: 13 }}>{pkg.name}</span>
                        <span
                          style={{
                            fontSize: 10,
                            background: pkg.mountType === "smd" ? "#1e3a5f" : "#3b2a1a",
                            color: pkg.mountType === "smd" ? "#38bdf8" : "#f59e0b",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          {pkg.mountType.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94a3b8" }}>
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
                  color: "#64748b",
                  gap: 12,
                  padding: 40,
                }}
              >
                <Box size={48} style={{ color: "#283750" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
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

          {/* Правая панель предпросмотра и действий */}
          <div
            style={{
              width: 380,
              background: "#0c1220",
              borderLeft: "1px solid #1e293b",
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
                  <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>
                    {activePackage.mountType.toUpperCase()}
                  </span>
                </div>

                <div
                  style={{
                    height: 240,
                    background: "#070a12",
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    overflow: "hidden",
                  }}
                >
                  <FootprintPreview packageDef={activePackage} height={240} interactive={false} />
                </div>

                <div className="form-section" style={{ background: "#090d18", border: "1px solid #1e293b" }}>
                  <span className="section-title">{activePackage.name}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                    <span style={{ color: "#94a3b8" }}>Монтаж:</span>
                    <span style={{ color: "#f8fafc", fontWeight: "bold" }}>
                      {activePackage.mountType.toUpperCase()}
                    </span>
                    <span style={{ color: "#94a3b8" }}>Контактов:</span>
                    <span style={{ color: "#f8fafc", fontWeight: "bold" }}>{activePackage.pads.length} шт.</span>
                    <span style={{ color: "#94a3b8" }}>Габариты:</span>
                    <span style={{ color: "#f8fafc" }}>
                      {activePackage.bodyWidth} × {activePackage.bodyHeight} мм
                    </span>
                    <span style={{ color: "#94a3b8" }}>Шаг (Pitch):</span>
                    <span style={{ color: "#f8fafc" }}>
                      {activePackage.pitch ? `${activePackage.pitch} мм` : "—"}
                    </span>
                  </div>
                </div>

                {activeTab === "devices" && activeDevice && (
                  <div className="form-section" style={{ background: "#090d18", border: "1px solid #1e293b" }}>
                    <span className="section-title">Параметры компонента</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#94a3b8" }}>Позиционное обозначение:</span>
                        <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{activeDevice.designatorPrefix}</span>
                      </div>
                      {activeDevice.parameters?.value && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#94a3b8" }}>Номинал:</span>
                          <span style={{ color: "#10b981", fontWeight: "bold" }}>{activeDevice.parameters.value}</span>
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
                  color: "#64748b",
                  gap: 12,
                  textAlign: "center",
                  padding: 20,
                }}
              >
                <Sliders size={36} style={{ color: "#1e293b" }} />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Выберите элемент для просмотра</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
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
