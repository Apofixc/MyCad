import React from "react";
import {
  Image as ImageIcon,
  Move,
  Compass,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Ruler,
  Layers,
  Zap,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  X,
  Upload,
  Copy,
  Download,
  Link,
  Unlink,
  Crop,
  Trash2,
  Cpu,
  Edit2,
  Tag,
  Sliders,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  CheckSquare,
  AlignLeft,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { BoardImageLayer } from "../../types/cad";
import { ElectricalParameters } from "../../types/componentLibrary";
import { engineClient, resolveImageUrl } from "../../api/engineClient";
import { notifySuccess, notifyWarning, reportError } from "../../utils/errorHandler";

export const InspectorSidebar: React.FC = () => {
  const {
    board,
    schematic,
    activeFileType,
    selectedImageId,
    selectedComponentId,
    selectedComponentIds,
    selectImage,
    selectComponent,
    clearSelectedComponents,
    batchSetComponentsVisibility,
    batchSetComponentsLocked,
    batchDeleteComponents,
    updateImageLayer,
    deleteImageLayer,
    updateComponent,
    deleteComponent,
  } = useProjectStore();

  const {
    activeWorkLayer,
    rightSidebarWidth,
    setRightSidebarWidth,
    setActiveTool,
    setPendingPreprocess,
    openModal,
    setEditingPackage,
    setEditingDevice,
  } = useUiStore();

  const { devices, packages } = useLibraryStore();

  // Resize handler for right sidebar
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(260, Math.min(600, startWidth - (moveEvent.clientX - startX)));
      setRightSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Состояние раскрытия расширенных секций свойств компонента
  const [showSpecs, setShowSpecs] = React.useState(true);
  const [showBom, setShowBom] = React.useState(false);
  const [showCustom, setShowCustom] = React.useState(false);
  const [showPadsList, setShowPadsList] = React.useState(false);
  const [newCustomKey, setNewCustomKey] = React.useState("");
  const [newCustomVal, setNewCustomVal] = React.useState("");

  // Schematic Document Inspector
  if (activeFileType === "schematic") {
    return (
      <aside className="cad-inspector-panel" style={{ width: `${rightSidebarWidth}px` }}>
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            zIndex: 10,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid var(--cad-border)",
            background: "var(--cad-bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <Cpu size={15} color="#38bdf8" />
            <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Схема: {schematic?.name || "Лист схемы"}
            </span>
          </div>
        </div>

        <div
          className="cad-sidebar-content"
          style={{
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <div className="cad-card-group">
            <div className="cad-card-header">
              <FileText size={13} />
              <span>Параметры листа схемы</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px" }}>
              <div>
                <label style={{ display: "block", fontSize: "10px", color: "var(--cad-text-muted)", marginBottom: "3px" }}>Название документа</label>
                <div className="cad-field-wrap">
                  <input type="text" className="cad-modern-input" value={schematic?.name || ""} readOnly />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "5px" }}>
                  <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Формат листа</span>
                  <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>A4 (ГОСТ 2.104)</span>
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "5px" }}>
                  <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Ориентация</span>
                  <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>Альбомная</span>
                </div>
              </div>
            </div>
          </div>

          <div className="cad-card-group">
            <div className="cad-card-header">
              <Zap size={13} color="#eab308" />
              <span>Содержимое схемы</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "5px" }}>
                <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Компонентов</span>
                <span style={{ fontWeight: 600, color: "#38bdf8" }}>{schematic?.data?.components?.length || 0} шт.</span>
              </div>
              <div style={{ background: "rgba(0,0,0,0.2)", padding: "6px 8px", borderRadius: "5px" }}>
                <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Электроцепей (Nets)</span>
                <span style={{ fontWeight: 600, color: "#34d399" }}>{schematic?.data?.nets?.length || 0} шт.</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{ width: "100%", justifyContent: "center", padding: "8px", fontSize: "11.5px", gap: "6px" }}
              onClick={() => openModal("componentLibrary")}
            >
              <Plus size={13} />
              <span>Добавить компонент из библиотеки</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Multi-component selection inspector
  const selectedComps = (board?.data?.components || []).filter((c) =>
    selectedComponentIds.includes(c.id)
  );

  if (selectedComps.length > 1) {
    const allLocked = selectedComps.every((c) => c.locked);
    const allHidden = selectedComps.every((c) => c.visible === false);
    const topCount = selectedComps.filter((c) => c.layer !== "bottom").length;
    const botCount = selectedComps.length - topCount;

    const handleBatchFlipSide = async (targetSide: "top" | "bottom") => {
      for (const c of selectedComps) {
        await updateComponent({
          ...c,
          layer: targetSide,
          side: targetSide,
          mirrored: targetSide === "bottom",
        });
      }
      notifySuccess(`Выбранные ${selectedComps.length} компонентов перенесены на слой ${targetSide === "top" ? "Top (Лицевая)" : "Bottom (Оборотная)"}`);
    };

    const handleBatchRotate = async (deltaDeg: number) => {
      for (const c of selectedComps) {
        const cur = c.rotationDeg ?? c.rotation ?? 0;
        const next = ((cur + deltaDeg) % 360 + 360) % 360;
        await updateComponent({ ...c, rotation: next, rotationDeg: Math.round(next * 10) / 10 });
      }
    };

    const handleBatchSetRotation = async (targetDeg: number) => {
      for (const c of selectedComps) {
        await updateComponent({ ...c, rotation: targetDeg, rotationDeg: targetDeg });
      }
    };

    const handleBatchAlign = async (type: "left" | "center-x" | "right" | "top" | "center-y" | "bottom" | "distribute-x" | "distribute-y") => {
      if (selectedComps.length < 2) return;
      const xs = selectedComps.map((c) => c.xMm ?? c.x ?? 0);
      const ys = selectedComps.map((c) => c.yMm ?? c.y ?? 0);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;

      if (type === "left") {
        for (const c of selectedComps) await updateComponent({ ...c, x: minX, xMm: minX });
        notifySuccess("Компоненты выровнены по левому краю");
      } else if (type === "center-x") {
        for (const c of selectedComps) await updateComponent({ ...c, x: avgX, xMm: avgX });
        notifySuccess("Компоненты выровнены по горизонтальному центру");
      } else if (type === "right") {
        for (const c of selectedComps) await updateComponent({ ...c, x: maxX, xMm: maxX });
        notifySuccess("Компоненты выровнены по правому краю");
      } else if (type === "top") {
        for (const c of selectedComps) await updateComponent({ ...c, y: minY, yMm: minY });
        notifySuccess("Компоненты выровнены по верхнему краю");
      } else if (type === "center-y") {
        for (const c of selectedComps) await updateComponent({ ...c, y: avgY, yMm: avgY });
        notifySuccess("Компоненты выровнены по вертикальному центру");
      } else if (type === "bottom") {
        for (const c of selectedComps) await updateComponent({ ...c, y: maxY, yMm: maxY });
        notifySuccess("Компоненты выровнены по нижнему краю");
      } else if (type === "distribute-x") {
        const sorted = [...selectedComps].sort((a, b) => (a.xMm ?? a.x ?? 0) - (b.xMm ?? b.x ?? 0));
        const span = maxX - minX;
        const step = span / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
          const newX = minX + i * step;
          await updateComponent({ ...sorted[i], x: newX, xMm: newX });
        }
        notifySuccess("Компоненты равномерно распределены по горизонтали");
      } else if (type === "distribute-y") {
        const sorted = [...selectedComps].sort((a, b) => (a.yMm ?? a.y ?? 0) - (b.yMm ?? b.y ?? 0));
        const span = maxY - minY;
        const step = span / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
          const newY = minY + i * step;
          await updateComponent({ ...sorted[i], y: newY, yMm: newY });
        }
        notifySuccess("Компоненты равномерно распределены по вертикали");
      }
    };

    return (
      <aside className="cad-inspector-panel" style={{ width: `${rightSidebarWidth}px` }}>
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            zIndex: 10,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid var(--cad-border)",
            background: "var(--cad-bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <CheckSquare size={16} color="#38bdf8" />
            <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#f8fafc" }}>
              Выбрано: {selectedComps.length} комп.
            </span>
          </div>
          <button className="cad-tool-btn" onClick={clearSelectedComponents} title="Снять выделение со всех" style={{ width: 24, height: 24 }}>
            <X size={13} />
          </button>
        </div>

        <div className="cad-sidebar-content" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "9px", overflowY: "auto", flex: 1 }}>
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Cpu size={13} />
              <span>Список выбранных элементов</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "100px", overflowY: "auto" }}>
              {selectedComps.map((c) => (
                <span
                  key={c.id}
                  className="cad-badge-dim"
                  style={{
                    cursor: "pointer",
                    background: "rgba(56, 189, 248, 0.12)",
                    color: "#7dd3fc",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                  }}
                  onClick={() => selectComponent(c.id, false)}
                  title={`Перейти к компоненту ${c.refDes}`}
                >
                  {c.refDes} {c.value ? `(${c.value})` : ""}
                </span>
              ))}
            </div>
          </div>

          <div className="cad-card-group" style={{ padding: "8px 10px" }}>
            <div className="cad-card-header" style={{ marginBottom: "6px" }}>
              <Layers size={13} />
              <span>Слой размещения группы</span>
            </div>
            <div className="cad-side-toggle-group">
              <button
                type="button"
                className={`cad-side-btn ${topCount === selectedComps.length ? "active" : ""}`}
                onClick={() => handleBatchFlipSide("top")}
              >
                Все на Top ({topCount})
              </button>
              <button
                type="button"
                className={`cad-side-btn ${botCount === selectedComps.length ? "active" : ""}`}
                onClick={() => handleBatchFlipSide("bottom")}
              >
                Все на Bottom ({botCount})
              </button>
            </div>
          </div>

          <div className="cad-card-group">
            <div className="cad-card-header">
              <Move size={13} />
              <span>Групповой поворот</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }} onClick={() => handleBatchRotate(-90)}>
                <RotateCcw size={12} style={{ marginRight: "3px" }} /> -90°
              </button>
              <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }} onClick={() => handleBatchRotate(90)}>
                <RotateCw size={12} style={{ marginRight: "3px" }} /> +90°
              </button>
              <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }} onClick={() => handleBatchRotate(180)}>
                180°
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
              {[0, 45, 90, 180].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "10px", padding: "4px 2px", justifyContent: "center" }}
                  onClick={() => handleBatchSetRotation(deg)}
                >
                  ={deg}°
                </button>
              ))}
            </div>
          </div>

          <div className="cad-card-group">
            <div className="cad-card-header">
              <AlignLeft size={13} />
              <span>Выравнивание и распределение</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("left")} title="По левому краю">
                  ⬅ Влево
                </button>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("center-x")} title="По центру X">
                  ⬌ Центр X
                </button>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("right")} title="По правому краю">
                  Вправо ➡
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("top")} title="По верхнему краю">
                  ⬆ Вверх
                </button>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("center-y")} title="По центру Y">
                  ⬍ Центр Y
                </button>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("bottom")} title="По нижнему краю">
                  Вниз ⬇
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "2px" }}>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10.5px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("distribute-x")} title="Равный шаг по горизонтали">
                  Шаг ⬌ (X)
                </button>
                <button type="button" className="cad-btn cad-btn-secondary" style={{ fontSize: "10.5px", padding: "4px", justifyContent: "center" }} onClick={() => handleBatchAlign("distribute-y")} title="Равный шаг по вертикали">
                  Шаг ⬍ (Y)
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "6px", justifyContent: "center" }}
                onClick={() => batchSetComponentsLocked(selectedComponentIds, !allLocked)}
              >
                {allLocked ? <Unlock size={12} style={{ marginRight: 4 }} /> : <Lock size={12} style={{ marginRight: 4 }} />}
                <span>{allLocked ? "Разблокир. все" : "Заблокир. все"}</span>
              </button>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "6px", justifyContent: "center" }}
                onClick={() => batchSetComponentsVisibility(selectedComponentIds, allHidden)}
              >
                {allHidden ? <Eye size={12} style={{ marginRight: 4 }} /> : <EyeOff size={12} style={{ marginRight: 4 }} />}
                <span>{allHidden ? "Показать все" : "Скрыть все"}</span>
              </button>
            </div>

            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "7px 10px",
                fontSize: "11.5px",
                color: "#f87171",
                borderColor: "rgba(239, 68, 68, 0.25)",
              }}
              onClick={() => {
                if (window.confirm(`Удалить выбранные ${selectedComps.length} компонентов с платы?`)) {
                  batchDeleteComponents(selectedComponentIds);
                }
              }}
            >
              <Trash2 size={13} style={{ marginRight: "4px" }} />
              <span>Удалить выбранные ({selectedComps.length})</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Component selection inspector
  const comp = board?.data?.components?.find((c) => c.id === selectedComponentId);
  if (comp) {
    const isCompTop = comp.layer !== "bottom";
    const pkg = comp.packageDef;
    const variants = pkg?.variants || [];
    const activeVariant = variants.find((v) => v.id === comp.selectedVariantId) || variants[0];
    const linkedDevice =
      devices.find((d) => d.id === comp.deviceId) ||
      devices.find(
        (d) =>
          d.supportedPackages.some((p) => p.packageId === comp.packageId) &&
          (d.name === comp.name || d.parameters?.value === comp.value)
      );

    const isBaseComponent = linkedDevice ? Boolean(linkedDevice.isBase) : !comp.deviceId;
    const isDuplicateRefDes = Boolean(
      comp.refDes.trim() &&
      (board?.data?.components || []).some(
        (c) => c.id !== comp.id && c.refDes.trim().toLowerCase() === comp.refDes.trim().toLowerCase()
      )
    );

    const params: ElectricalParameters = comp.parameters || {
      value: comp.value || "",
      tolerance: linkedDevice?.parameters?.tolerance || "",
      voltageRating: linkedDevice?.parameters?.voltageRating || "",
      powerRating: linkedDevice?.parameters?.powerRating || "",
      maxCurrent: linkedDevice?.parameters?.maxCurrent || "",
      operatingTemp: linkedDevice?.parameters?.operatingTemp || "",
      custom: { ...(linkedDevice?.parameters?.custom || {}) },
    };

    const handleUpdateParam = (field: keyof ElectricalParameters, val: string) => {
      const currentParams = comp.parameters ? { ...comp.parameters } : { ...(linkedDevice?.parameters || {}) };
      const updated: ElectricalParameters = {
        ...currentParams,
        [field]: val,
      };
      updateComponent({
        ...comp,
        parameters: updated,
        ...(field === "value" ? { value: val } : {}),
      });
    };

    const handleUpdateBomField = (field: "manufacturer" | "mpn" | "description", val: string) => {
      updateComponent({
        ...comp,
        [field]: val,
      });
    };

    const handleUpdateNote = (val: string) => {
      updateComponent({
        ...comp,
        note: val,
      });
    };

    const handleUpdateCustomAttr = (key: string, val: string) => {
      const currentParams = comp.parameters ? { ...comp.parameters } : { ...(linkedDevice?.parameters || {}) };
      const currentCustom = { ...(currentParams.custom || {}) };
      currentCustom[key] = val;
      updateComponent({
        ...comp,
        parameters: {
          ...currentParams,
          custom: currentCustom,
        },
      });
    };

    const handleDeleteCustomAttr = (key: string) => {
      const currentParams = comp.parameters ? { ...comp.parameters } : { ...(linkedDevice?.parameters || {}) };
      const currentCustom = { ...(currentParams.custom || {}) };
      delete currentCustom[key];
      updateComponent({
        ...comp,
        parameters: {
          ...currentParams,
          custom: currentCustom,
        },
      });
    };

    const handleAddCustomAttr = () => {
      if (!newCustomKey.trim()) return;
      handleUpdateCustomAttr(newCustomKey.trim(), newCustomVal.trim());
      setNewCustomKey("");
      setNewCustomVal("");
    };

    const filledSpecsCount = [
      params.tolerance,
      params.voltageRating,
      params.powerRating,
      params.maxCurrent,
      params.operatingTemp,
    ].filter(Boolean).length;

    const customEntries = Object.entries(params.custom || {});

    return (
      <aside className="cad-inspector-panel" style={{ width: `${rightSidebarWidth}px` }}>
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            zIndex: 10,
          }}
        />

        {/* Заголовок в едином CAD стиле */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid var(--cad-border)",
            gap: "8px",
            background: "var(--cad-bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
            <Cpu size={15} color={linkedDevice?.isBase ? "#38bdf8" : "#34d399"} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Компонент: {comp.refDes}
            </span>
            <span
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                background: linkedDevice?.isBase ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.18)",
                color: linkedDevice?.isBase ? "#93c5fd" : "#34d399",
                border: `1px solid ${linkedDevice?.isBase ? "rgba(59, 130, 246, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                padding: "1px 5px",
                borderRadius: "3px",
                flexShrink: 0,
              }}
            >
              {linkedDevice?.isBase ? "Базовый (Generic)" : "Конкретный (BOM)"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
            <button
              className={`cad-tool-btn ${comp.locked ? "active" : ""}`}
              style={{ width: "26px", height: "26px" }}
              onClick={() => updateComponent({ ...comp, locked: !comp.locked })}
              title={comp.locked ? "Разблокировать компонент" : "Заблокировать от перемещения"}
            >
              {comp.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} />}
            </button>
            <button
              className="cad-tool-btn"
              style={{ width: "26px", height: "26px" }}
              onClick={() => updateComponent({ ...comp, visible: comp.visible === false ? true : false })}
              title={comp.visible === false ? "Показать компонент на холсте" : "Скрыть компонент на холсте"}
            >
              {comp.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        {/* Тело инспектора с единой структурой карточек */}
        <div
          className="cad-sidebar-content"
          style={{
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "9px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* Card: Основные параметры компонента */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Cpu size={13} />
              <span>Параметры компонента</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Позиционное обозначение (RefDes) */}
              <div>
                <label style={{ display: "block", fontSize: "10.5px", fontWeight: 500, color: "var(--cad-text-muted)", marginBottom: "4px" }}>
                  Позиционное обозначение
                </label>
                <div className="cad-field-wrap" style={{ borderColor: isDuplicateRefDes ? "#ef4444" : undefined }}>
                  <span className="cad-field-prefix" style={{ color: isDuplicateRefDes ? "#ef4444" : undefined }}>ID</span>
                  <input
                    type="text"
                    className="cad-modern-input"
                    value={comp.refDes}
                    onChange={(e) => updateComponent({ ...comp, refDes: e.target.value })}
                  />
                  {isDuplicateRefDes && (
                    <span title="Обозначение уже занято другим компонентом!" style={{ display: "inline-flex", alignItems: "center", marginRight: "6px", flexShrink: 0 }}>
                      <AlertTriangle size={14} color="#ef4444" />
                    </span>
                  )}
                </div>
                {isDuplicateRefDes && (
                  <div style={{ fontSize: "10px", color: "#f87171", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>⚠️ Внимание: позиционное обозначение уже занято на плате</span>
                  </div>
                )}
              </div>

              {/* Отображение надписей маркировки на плате */}
              <div style={{ display: "flex", gap: "10px", padding: "6px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10.5px", color: "var(--cad-text-muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={comp.showRefDes !== false}
                    onChange={(e) => updateComponent({ ...comp, showRefDes: e.target.checked })}
                  />
                  <span>Шелкография ID</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10.5px", color: "var(--cad-text-muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={comp.showValue !== false}
                    onChange={(e) => updateComponent({ ...comp, showValue: e.target.checked })}
                  />
                  <span>Шелкография номинала</span>
                </label>
              </div>

              {/* Номинал / Значение */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--cad-text-muted)" }}>
                    {isBaseComponent ? "Номинал (Value)" : "Модель изделия"}
                  </label>
                  {isBaseComponent ? (
                    <span style={{ fontSize: "9.5px", color: "#60a5fa", fontWeight: 600 }}>
                      [Параметрический]
                    </span>
                  ) : (
                    <span style={{ fontSize: "9.5px", color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                      <Lock size={10} /> Из каталога
                    </span>
                  )}
                </div>
                <div className="cad-field-wrap">
                  <span className="cad-field-prefix">VAL</span>
                  {isBaseComponent ? (
                    <input
                      type="text"
                      className="cad-modern-input"
                      value={comp.value || params.value || ""}
                      placeholder="например, 10k, 0.1uF"
                      onChange={(e) => handleUpdateParam("value", e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      className="cad-modern-input"
                      value={comp.value || linkedDevice?.parameters?.value || linkedDevice?.name || ""}
                      readOnly
                      disabled
                      style={{ opacity: 0.85, cursor: "not-allowed", background: "rgba(0,0,0,0.25)" }}
                    />
                  )}
                </div>
                <div style={{ fontSize: "10px", color: "var(--cad-text-dim)", marginTop: "3px" }}>
                  {isBaseComponent
                    ? "Параметр задается индивидуально для этого компонента на плате"
                    : "Фиксированная радиодеталь. Модель определяется каталогом библиотеки"}
                </div>
              </div>

              {/* Корпус (Footprint) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--cad-text-muted)" }}>
                    Корпус (Footprint)
                  </label>
                  {linkedDevice?.supportedPackages && linkedDevice.supportedPackages.length > 1 && (
                    <span style={{ fontSize: "9.5px", color: "var(--cad-text-dim)" }}>
                      {linkedDevice.supportedPackages.length} варианта
                    </span>
                  )}
                </div>

                {linkedDevice?.supportedPackages && linkedDevice.supportedPackages.length > 1 ? (
                  <select
                    className="cad-modern-select"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "11px",
                      background: "var(--cad-bg-deep)",
                      border: "1px solid var(--cad-border)",
                      borderRadius: "6px",
                      color: "var(--cad-text-main)",
                    }}
                    value={comp.packageId}
                    onChange={(e) => {
                      const newPkgId = e.target.value;
                      const newPkg = packages.find((p) => p.id === newPkgId);
                      updateComponent({
                        ...comp,
                        packageId: newPkgId,
                        package: newPkg?.name || newPkgId,
                        packageDef: newPkg,
                        selectedVariantId: newPkg?.variants?.[0]?.id,
                      });
                    }}
                  >
                    {linkedDevice.supportedPackages.map((sp) => {
                      const p = packages.find((pkg) => pkg.id === sp.packageId);
                      return (
                        <option key={sp.packageId} value={sp.packageId}>
                          {p ? p.name : sp.packageId}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div
                    style={{
                      background: "var(--cad-bg-deep)",
                      border: "1px solid var(--cad-border)",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      fontSize: "11.5px",
                      color: "var(--cad-accent-hover, #60a5fa)",
                      fontWeight: 600,
                    }}
                  >
                    {pkg?.name || comp.packageId}
                  </div>
                )}

                {pkg && (
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center", marginTop: "6px" }}>
                    <span className="cad-badge-dim">Выводов: {pkg.pads.length}</span>
                    <span className="cad-badge-dim">{pkg.mountType.toUpperCase()}</span>
                    <span className="cad-badge-dim">{pkg.bodyWidth}×{pkg.bodyHeight} мм</span>
                    {pkg.pitch ? <span className="cad-badge-dim">Шаг: {pkg.pitch} мм</span> : null}
                  </div>
                )}
              </div>

              {/* Привязка к каталогу (Device definition) */}
              {linkedDevice && (
                <div>
                  <label style={{ display: "block", fontSize: "10.5px", fontWeight: 500, color: "var(--cad-text-muted)", marginBottom: "4px" }}>
                    Компонент библиотеки
                  </label>
                  <div
                    style={{
                      background: "var(--cad-bg-deep)",
                      border: "1px solid var(--cad-border)",
                      borderRadius: "6px",
                      padding: "6px 9px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          background: linkedDevice.isBase ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.15)",
                          color: linkedDevice.isBase ? "#60a5fa" : "#10b981",
                          border: `1px solid ${linkedDevice.isBase ? "rgba(59, 130, 246, 0.4)" : "rgba(16, 185, 129, 0.3)"}`,
                          padding: "1px 5px",
                          borderRadius: "3px",
                          flexShrink: 0,
                        }}
                      >
                        {linkedDevice.isBase ? "Базовый" : "BOM деталь"}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--cad-text-main)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={linkedDevice.name}
                      >
                        {linkedDevice.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="cad-tool-btn"
                      style={{ width: "22px", height: "22px", flexShrink: 0 }}
                      onClick={() => {
                        setEditingDevice(linkedDevice);
                        openModal("deviceEditor");
                      }}
                      title="Открыть компонент в редакторе"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>

                  {/* Для конкретных покупных деталей показываем артикул и производителя */}
                  {!linkedDevice.isBase && (linkedDevice.mpn || linkedDevice.manufacturer) && (
                    <div style={{ display: "flex", gap: "8px", fontSize: "10px", color: "var(--cad-text-dim)", marginTop: "3px", paddingLeft: "2px" }}>
                      {linkedDevice.manufacturer && <span>{linkedDevice.manufacturer}</span>}
                      {linkedDevice.mpn && <span style={{ fontFamily: "var(--cad-font-mono)", color: "var(--cad-accent-hover)" }}>MPN: {linkedDevice.mpn}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card: Электропараметры и спецификация */}
          <div className="cad-card-group" style={{ padding: "8px 10px" }}>
            <div
              className="cad-card-header"
              style={{
                marginBottom: showSpecs ? "8px" : 0,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                userSelect: "none",
              }}
              onClick={() => setShowSpecs(!showSpecs)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Zap size={13} color="#eab308" />
                <span>{isBaseComponent ? "Электропараметры позиции" : "Паспортные электропараметры"}</span>
                {!isBaseComponent ? (
                  <span
                    style={{
                      fontSize: "9px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      padding: "1px 5px",
                      borderRadius: "10px",
                      fontWeight: 700,
                    }}
                  >
                    Каталог
                  </span>
                ) : (
                  filledSpecsCount > 0 && (
                    <span
                      style={{
                        fontSize: "9px",
                        background: "rgba(234, 179, 8, 0.15)",
                        color: "#facc15",
                        padding: "1px 5px",
                        borderRadius: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {filledSpecsCount}
                    </span>
                  )
                )}
              </div>
              <div style={{ color: "var(--cad-text-muted)" }}>
                {showSpecs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </div>

            {showSpecs && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {!isBaseComponent ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "11px" }}>
                    <div style={{ padding: "6px 8px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 5, fontSize: "10px", color: "#6ee7b7", lineHeight: 1.35 }}>
                      🔒 Характеристики зафиксированы заводской спецификацией <strong>{linkedDevice?.name}</strong> в библиотеке.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 2 }}>
                      <div style={{ background: "rgba(0,0,0,0.2)", padding: "5px 7px", borderRadius: 4 }}>
                        <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Допуск</span>
                        <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>{linkedDevice?.parameters?.tolerance || "По стандарту"}</span>
                      </div>
                      <div style={{ background: "rgba(0,0,0,0.2)", padding: "5px 7px", borderRadius: 4 }}>
                        <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Напряжение</span>
                        <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>{linkedDevice?.parameters?.voltageRating || "—"}</span>
                      </div>
                      <div style={{ background: "rgba(0,0,0,0.2)", padding: "5px 7px", borderRadius: 4 }}>
                        <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Мощность</span>
                        <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>{linkedDevice?.parameters?.powerRating || "—"}</span>
                      </div>
                      <div style={{ background: "rgba(0,0,0,0.2)", padding: "5px 7px", borderRadius: 4 }}>
                        <span style={{ fontSize: "9.5px", color: "var(--cad-text-muted)", display: "block" }}>Макс. ток</span>
                        <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>{linkedDevice?.parameters?.maxCurrent || "—"}</span>
                      </div>
                    </div>
                    {linkedDevice?.parameters?.operatingTemp && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 7px", background: "rgba(0,0,0,0.2)", borderRadius: 4 }}>
                        <span style={{ fontSize: "10px", color: "var(--cad-text-muted)" }}>Температура / ТКС:</span>
                        <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>{linkedDevice.parameters.operatingTemp}</span>
                      </div>
                    )}
                    {Object.entries(linkedDevice?.parameters?.custom || {}).map(([ck, cv]) => (
                      <div key={ck} style={{ display: "flex", justifyContent: "space-between", padding: "4px 7px", background: "rgba(0,0,0,0.2)", borderRadius: 4 }}>
                        <span style={{ fontSize: "10px", color: "var(--cad-text-muted)" }}>{ck}:</span>
                        <span style={{ fontWeight: 600, color: "var(--cad-text-main)" }}>{cv}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Допуск (Tolerance) */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)" }}>
                          Допуск (Tolerance)
                        </label>
                        <div style={{ display: "flex", gap: "3px" }}>
                          {["0.1%", "0.5%", "1%", "5%", "10%"].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleUpdateParam("tolerance", t)}
                              style={{
                                fontSize: "9px",
                                padding: "1px 4px",
                                borderRadius: "3px",
                                border: params.tolerance === t ? "1px solid #60a5fa" : "1px solid var(--cad-border)",
                                background: params.tolerance === t ? "rgba(59, 130, 246, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                color: params.tolerance === t ? "#93c5fd" : "var(--cad-text-dim)",
                                cursor: "pointer",
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="cad-field-wrap">
                        <span className="cad-field-prefix">TOL</span>
                        <input
                          type="text"
                          className="cad-modern-input"
                          value={params.tolerance || ""}
                          placeholder="например, 1%, 5%, 0.1%"
                          onChange={(e) => handleUpdateParam("tolerance", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Номинальное напряжение (Voltage Rating) */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)" }}>
                          Ном. напряжение
                        </label>
                        <div style={{ display: "flex", gap: "3px" }}>
                          {["16V", "25V", "50V", "100V", "250V"].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => handleUpdateParam("voltageRating", v)}
                              style={{
                                fontSize: "9px",
                                padding: "1px 4px",
                                borderRadius: "3px",
                                border: params.voltageRating === v ? "1px solid #f59e0b" : "1px solid var(--cad-border)",
                                background: params.voltageRating === v ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                color: params.voltageRating === v ? "#fcd34d" : "var(--cad-text-dim)",
                                cursor: "pointer",
                              }}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="cad-field-wrap">
                        <span className="cad-field-prefix">VOLT</span>
                        <input
                          type="text"
                          className="cad-modern-input"
                          value={params.voltageRating || ""}
                          placeholder="например, 16V, 50V, 250V"
                          onChange={(e) => handleUpdateParam("voltageRating", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Рассеиваемая мощность (Power Rating) */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)" }}>
                          Мощность
                        </label>
                        <div style={{ display: "flex", gap: "3px" }}>
                          {["0.063W", "0.125W", "0.25W", "0.5W", "1W"].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleUpdateParam("powerRating", p)}
                              style={{
                                fontSize: "9px",
                                padding: "1px 4px",
                                borderRadius: "3px",
                                border: params.powerRating === p ? "1px solid #a855f7" : "1px solid var(--cad-border)",
                                background: params.powerRating === p ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                color: params.powerRating === p ? "#d8b4fe" : "var(--cad-text-dim)",
                                cursor: "pointer",
                              }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="cad-field-wrap">
                        <span className="cad-field-prefix">PWR</span>
                        <input
                          type="text"
                          className="cad-modern-input"
                          value={params.powerRating || ""}
                          placeholder="например, 0.125W, 0.25W, 1W"
                          onChange={(e) => handleUpdateParam("powerRating", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Максимальный рабочий ток (Max Current) */}
                    <div>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)", marginBottom: "3px" }}>
                        Максимальный ток
                      </label>
                      <div className="cad-field-wrap">
                        <span className="cad-field-prefix">CURR</span>
                        <input
                          type="text"
                          className="cad-modern-input"
                          value={params.maxCurrent || ""}
                          placeholder="например, 100mA, 1A, 5A"
                          onChange={(e) => handleUpdateParam("maxCurrent", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Температура / ТКС / Диэлектрик */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <label style={{ fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)" }}>
                          Диэлектрик / ТКС / Температура
                        </label>
                        <div style={{ display: "flex", gap: "3px" }}>
                          {["X7R", "NP0", "-40..+125°C"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleUpdateParam("operatingTemp", c)}
                              style={{
                                fontSize: "9px",
                                padding: "1px 4px",
                                borderRadius: "3px",
                                border: params.operatingTemp === c ? "1px solid #10b981" : "1px solid var(--cad-border)",
                                background: params.operatingTemp === c ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                color: params.operatingTemp === c ? "#6ee7b7" : "var(--cad-text-dim)",
                                cursor: "pointer",
                              }}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="cad-field-wrap">
                        <span className="cad-field-prefix">TEMP</span>
                        <input
                          type="text"
                          className="cad-modern-input"
                          value={params.operatingTemp || ""}
                          placeholder="например, X7R, NP0, -40..+125°C"
                          onChange={(e) => handleUpdateParam("operatingTemp", e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Card: Спецификация изделия (BOM) */}
          <div className="cad-card-group" style={{ padding: "8px 10px" }}>
            <div
              className="cad-card-header"
              style={{
                marginBottom: showBom ? "8px" : 0,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                userSelect: "none",
              }}
              onClick={() => setShowBom(!showBom)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Tag size={13} color="#10b981" />
                <span>{isBaseComponent ? "Параметры спецификации (BOM)" : "Спецификация изделия (BOM)"}</span>
                {!isBaseComponent ? (
                  <span
                    style={{
                      fontSize: "9px",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      padding: "1px 5px",
                      borderRadius: "10px",
                      fontWeight: 700,
                    }}
                  >
                    В спецификации
                  </span>
                ) : (
                  (comp.manufacturer || comp.mpn) && (
                    <span
                      style={{
                        fontSize: "9px",
                        background: "rgba(59, 130, 246, 0.15)",
                        color: "#93c5fd",
                        padding: "1px 5px",
                        borderRadius: "10px",
                        fontWeight: 700,
                      }}
                    >
                      Назначен MPN
                    </span>
                  )
                )}
              </div>
              <div style={{ color: "var(--cad-text-muted)" }}>
                {showBom ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </div>

            {showBom && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {isBaseComponent ? (
                  <>
                    <div style={{ padding: "6px 8px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 5, fontSize: "10px", color: "#93c5fd", lineHeight: 1.35 }}>
                      💡 <strong>Базовый шаблон для схемы.</strong> Вы можете назначить артикул производителя (MPN), либо привязать компонент к готовой детали из каталога.
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)", marginBottom: "3px" }}>
                        Производитель (опционально)
                      </label>
                      <input
                        type="text"
                        className="cad-modern-input"
                        value={comp.manufacturer || ""}
                        placeholder="например, Yageo, Murata"
                        onChange={(e) => handleUpdateBomField("manufacturer", e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)", marginBottom: "3px" }}>
                        Артикул / Part Number (MPN)
                      </label>
                      <input
                        type="text"
                        className="cad-modern-input"
                        style={{ fontFamily: "var(--cad-font-mono)" }}
                        value={comp.mpn || ""}
                        placeholder="например, RC0805FR-0710KL"
                        onChange={(e) => handleUpdateBomField("mpn", e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "10px", fontWeight: 500, color: "var(--cad-text-muted)", marginBottom: "3px" }}>
                        Описание компонента
                      </label>
                      <input
                        type="text"
                        className="cad-modern-input"
                        value={comp.description || ""}
                        placeholder="например, Резистор 10кОм 1% 0805"
                        onChange={(e) => handleUpdateBomField("description", e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="cad-btn-secondary"
                      style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center", gap: 5, marginTop: 3 }}
                      onClick={() => openModal("componentLibrary")}
                    >
                      <Link size={12} />
                      <span>Привязать к конкретной детали из библиотеки...</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "11px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--cad-text-muted)" }}>Производитель:</span>
                        <span style={{ color: "var(--cad-text-main)", fontWeight: 600 }}>
                          {linkedDevice?.manufacturer || comp.manufacturer || "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--cad-text-muted)" }}>Артикул (MPN):</span>
                        <span style={{ color: "var(--cad-accent-hover)", fontFamily: "var(--cad-font-mono)", fontWeight: 700 }}>
                          {linkedDevice?.mpn || comp.mpn || "—"}
                        </span>
                      </div>
                      {linkedDevice?.datasheet && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "var(--cad-text-muted)" }}>Документация:</span>
                          <a
                            href={linkedDevice.datasheet}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--cad-accent-hover)", textDecoration: "none", fontSize: "10.5px", fontWeight: 600 }}
                          >
                            Datasheet (PDF) ↗
                          </a>
                        </div>
                      )}
                      {(linkedDevice?.description || comp.description) && (
                        <div style={{ marginTop: 2, fontSize: "10.5px", color: "var(--cad-text-dim)", lineHeight: 1.35, background: "rgba(0,0,0,0.2)", padding: "5px 7px", borderRadius: 4 }}>
                          {linkedDevice?.description || comp.description}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="cad-btn-secondary"
                      style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center", gap: 5, marginTop: 4 }}
                      onClick={() => openModal("componentLibrary")}
                    >
                      <RotateCw size={12} />
                      <span>Заменить деталь из библиотеки...</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Card: Примечание к компоненту (Note) */}
          <div className="cad-card-group" style={{ padding: "8px 10px" }}>
            <div className="cad-card-header" style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <FileText size={13} color="#a78bfa" />
              <span>Примечание к компоненту</span>
            </div>
            <textarea
              className="cad-modern-input"
              rows={2}
              style={{
                width: "100%",
                resize: "vertical",
                fontSize: "11px",
                lineHeight: 1.4,
                padding: "6px 8px",
                fontFamily: "inherit",
              }}
              placeholder="Монтажные заметки (например, подбор при наладке, термоинтерфейс)..."
              value={comp.note || ""}
              onChange={(e) => handleUpdateNote(e.target.value)}
            />
          </div>

          {/* Card: Дополнительные параметры (только для базовых шаблонов) */}
          {isBaseComponent && (
            <div className="cad-card-group" style={{ padding: "8px 10px" }}>
              <div
                className="cad-card-header"
                style={{
                  marginBottom: showCustom ? "8px" : 0,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  userSelect: "none",
                }}
                onClick={() => setShowCustom(!showCustom)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sliders size={13} color="#8b5cf6" />
                  <span>Дополнительные параметры</span>
                  {customEntries.length > 0 && (
                    <span
                      style={{
                        fontSize: "9px",
                        background: "rgba(139, 92, 246, 0.15)",
                        color: "#c4b5fd",
                        padding: "1px 5px",
                        borderRadius: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {customEntries.length}
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--cad-text-muted)" }}>
                  {showCustom ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {showCustom && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {/* Список уже созданных атрибутов */}
                  {customEntries.map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.2fr 24px",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--cad-text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          padding: "3px 4px",
                          background: "rgba(255, 255, 255, 0.03)",
                          borderRadius: "3px",
                        }}
                        title={k}
                      >
                        {k}
                      </span>
                      <input
                        type="text"
                        className="cad-modern-input"
                        style={{ fontSize: "10.5px", padding: "3px 6px" }}
                        value={v}
                        onChange={(e) => handleUpdateCustomAttr(k, e.target.value)}
                      />
                      <button
                        type="button"
                        className="cad-tool-btn"
                        style={{ width: "22px", height: "22px", color: "var(--cad-danger, #ef4444)" }}
                        onClick={() => handleDeleteCustomAttr(k)}
                        title={`Удалить свойство "${k}"`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  {/* Строка быстрого добавления нового атрибута */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 24px", gap: 4, alignItems: "center", marginTop: "3px" }}>
                    <input
                      type="text"
                      className="cad-modern-input"
                      style={{ fontSize: "10.5px", padding: "4px 6px" }}
                      placeholder="Параметр..."
                      value={newCustomKey}
                      onChange={(e) => setNewCustomKey(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCustomAttr()}
                    />
                    <input
                      type="text"
                      className="cad-modern-input"
                      style={{ fontSize: "10.5px", padding: "4px 6px" }}
                      placeholder="Значение..."
                      value={newCustomVal}
                      onChange={(e) => setNewCustomVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCustomAttr()}
                    />
                    <button
                      type="button"
                      className="cad-tool-btn"
                      style={{ width: "22px", height: "22px", color: "var(--cad-accent-hover, #60a5fa)" }}
                      onClick={handleAddCustomAttr}
                      title="Добавить параметр"
                      disabled={!newCustomKey.trim()}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card: Слой размещения (Сегментированный переключатель) */}
          <div className="cad-card-group" style={{ padding: "8px 10px" }}>
            <div className="cad-card-header" style={{ marginBottom: "6px" }}>
              <Layers size={13} />
              <span>Слой размещения</span>
            </div>

            <div className="cad-side-toggle-group">
              <button
                type="button"
                className={`cad-side-btn ${isCompTop ? "active" : ""}`}
                onClick={() => updateComponent({ ...comp, layer: "top", side: "top", mirrored: false })}
              >
                Top (Лицевая)
              </button>
              <button
                type="button"
                className={`cad-side-btn ${!isCompTop ? "active" : ""}`}
                onClick={() => updateComponent({ ...comp, layer: "bottom", side: "bottom", mirrored: true })}
              >
                Bottom (Оборотная)
              </button>
            </div>
          </div>

          {/* Card: Положение и угол поворота */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Move size={13} />
              <span>Положение и угол</span>
            </div>

            {/* Координаты X / Y */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">X</span>
                <input
                  type="number"
                  step="0.5"
                  className="cad-modern-input"
                  value={comp.xMm ?? comp.x ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    updateComponent({ ...comp, x: val, xMm: val });
                  }}
                />
                <span className="cad-field-suffix">мм</span>
              </div>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">Y</span>
                <input
                  type="number"
                  step="0.5"
                  className="cad-modern-input"
                  value={comp.yMm ?? comp.y ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    updateComponent({ ...comp, y: val, yMm: val });
                  }}
                />
                <span className="cad-field-suffix">мм</span>
              </div>
            </div>

            {/* Заголовок угла и точный ввод */}
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--cad-text-muted)" }}>Угол поворота:</span>
                <span className="cad-badge-dim">{comp.rotationDeg ?? comp.rotation ?? 0}°</span>
              </div>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">∠</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="360"
                  className="cad-modern-input"
                  value={comp.rotationDeg ?? comp.rotation ?? 0}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value) || 0;
                    const normalized = ((raw % 360) + 360) % 360;
                    updateComponent({ ...comp, rotation: normalized, rotationDeg: Math.round(normalized * 10) / 10 });
                  }}
                />
                <span className="cad-field-suffix">°</span>
              </div>
            </div>

            {/* Быстрые угловые пресеты */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginBottom: "6px" }}>
              {[0, 45, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`cad-btn cad-btn-secondary ${Math.round(comp.rotationDeg ?? comp.rotation ?? 0) === deg ? "active" : ""}`}
                  style={{ fontSize: "10px", padding: "4px 2px", justifyContent: "center" }}
                  onClick={() => updateComponent({ ...comp, rotation: deg, rotationDeg: deg })}
                >
                  {deg}°
                </button>
              ))}
            </div>

            {/* Быстрые кнопки поворота */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => {
                  const cur = comp.rotationDeg ?? comp.rotation ?? 0;
                  const next = (cur - 90 + 360) % 360;
                  updateComponent({ ...comp, rotation: next, rotationDeg: next });
                }}
                title="Повернуть на 90° против часовой стрелки"
              >
                <RotateCcw size={12} style={{ marginRight: "3px" }} />
                <span>-90°</span>
              </button>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => {
                  const cur = comp.rotationDeg ?? comp.rotation ?? 0;
                  const next = (cur + 90) % 360;
                  updateComponent({ ...comp, rotation: next, rotationDeg: next });
                }}
                title="Повернуть на 90° по часовой стрелке"
              >
                <RotateCw size={12} style={{ marginRight: "3px" }} />
                <span>+90°</span>
              </button>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => {
                  const cur = comp.rotationDeg ?? comp.rotation ?? 0;
                  const next = (cur + 180) % 360;
                  updateComponent({ ...comp, rotation: next, rotationDeg: next });
                }}
                title="Повернуть на 180°"
              >
                <span>180°</span>
              </button>
            </div>
          </div>

          {/* Card: Вариант шелкографии корпуса */}
          {variants.length > 0 && (
            <div className="cad-card-group">
              <div className="cad-card-header">
                <Compass size={13} />
                <span>Вариант шелкографии корпуса</span>
              </div>
              <div className="cad-field-wrap">
                <select
                  className="cad-modern-input"
                  style={{ cursor: "pointer", background: "transparent" }}
                  value={comp.selectedVariantId || variants[0]?.id}
                  onChange={(e) =>
                    updateComponent({
                      ...comp,
                      selectedVariantId: e.target.value,
                    })
                  }
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id} style={{ background: "var(--cad-bg-panel)", color: "var(--cad-text-main)" }}>
                      {v.name} ({v.keyType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Card: Выводы и контактные площадки */}
          {pkg && pkg.pads && pkg.pads.length > 0 && (
            <div className="cad-card-group" style={{ padding: "8px 10px" }}>
              <div
                className="cad-card-header"
                style={{
                  marginBottom: showPadsList ? "8px" : 0,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  userSelect: "none",
                }}
                onClick={() => setShowPadsList(!showPadsList)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={13} color="#38bdf8" />
                  <span>Контактные площадки</span>
                  <span className="cad-badge-dim">{pkg.pads.length} шт.</span>
                </div>
                <div style={{ color: "var(--cad-text-muted)" }}>
                  {showPadsList ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {showPadsList && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                  <table style={{ width: "100%", fontSize: "10.5px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--cad-text-muted)", borderBottom: "1px solid var(--cad-border)", textAlign: "left" }}>
                        <th style={{ padding: "3px 4px" }}>№</th>
                        <th style={{ padding: "3px 4px" }}>Сигнал</th>
                        <th style={{ padding: "3px 4px" }}>Тип</th>
                        <th style={{ padding: "3px 4px", textAlign: "right" }}>X, Y (мм)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pkg.pads.map((pad) => {
                        const mapping = linkedDevice?.supportedPackages?.find((sp) => sp.packageId === comp.packageId);
                        let mappedPinName = pad.name || "";
                        if (mapping) {
                          const entry = Object.entries(mapping.pinMap).find(([_, padNum]) => padNum === pad.padNum);
                          if (entry) mappedPinName = entry[0];
                        }
                        const isTht = Boolean(pad.drillDiameter && pad.drillDiameter > 0);
                        return (
                          <tr key={pad.padNum} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                            <td style={{ padding: "3px 4px", fontWeight: 700, color: "var(--cad-accent-hover)" }}>
                              {pad.padNum}
                            </td>
                            <td style={{ padding: "3px 4px", color: mappedPinName ? "var(--cad-text-main)" : "var(--cad-text-dim)" }}>
                              {mappedPinName || "—"}
                            </td>
                            <td style={{ padding: "3px 4px" }}>
                              <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: isTht ? "rgba(217, 119, 6, 0.2)" : "rgba(59, 130, 246, 0.2)", color: isTht ? "#fbbf24" : "#93c5fd" }}>
                                {isTht ? "THT" : "SMD"}
                              </span>
                            </td>
                            <td style={{ padding: "3px 4px", textAlign: "right", fontFamily: "var(--cad-font-mono)", fontSize: "9.5px", color: "var(--cad-text-muted)" }}>
                              {pad.x.toFixed(1)}, {pad.y.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Быстрые действия */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingTop: "8px" }}>
            {pkg && (
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ width: "100%", justifyContent: "center", padding: "7px 10px", fontSize: "11.5px" }}
                onClick={() => {
                  setEditingPackage(pkg);
                  openModal("packageEditor");
                }}
              >
                <Edit2 size={13} style={{ marginRight: "4px" }} />
                <span>Открыть корпус в CAD-редакторе</span>
              </button>
            )}

            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "7px 10px",
                fontSize: "11.5px",
                color: "#f87171",
                borderColor: "rgba(239, 68, 68, 0.25)",
              }}
              onClick={() => deleteComponent(comp.id)}
            >
              <Trash2 size={13} style={{ marginRight: "4px" }} />
              <span>Удалить компонент с платы</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // If the active layer is not underlay, do not display image inspector
  if (activeWorkLayer?.type !== "underlay") {
    return null;
  }

  // Strictly single image selection
  const imgLayer =
    board?.data?.bgTop?.images?.find((i) => i.id === selectedImageId) ||
    board?.data?.bgBottom?.images?.find((i) => i.id === selectedImageId);

  if (!imgLayer) {
    return null;
  }

  const isTop = (imgLayer.side || "top").toLowerCase() === "top";
  const naturalW = imgLayer.width || 2000;
  const naturalH = imgLayer.height || 1500;
  const currentScale = imgLayer.scale || 1.0;
  const curW = Math.round(naturalW * currentScale);
  const curH = Math.round(naturalH * currentScale);

  const currentPxPerMm = imgLayer.pxPerMm || 23.62;
  const currentDpi = imgLayer.dpi || Math.round(currentPxPerMm * 25.4);
  const widthMm = (curW / currentPxPerMm).toFixed(1);
  const heightMm = (curH / currentPxPerMm).toFixed(1);

  // Handlers
  const handleUpdate = (updates: Partial<BoardImageLayer>) => {
    updateImageLayer({ ...imgLayer, ...updates });
  };

  // Switch Side (Top ↔ Bottom)
  const handleSwitchSide = async (targetSide: "top" | "bottom") => {
    if (targetSide === imgLayer.side) return;
    const shouldMirror = targetSide === "bottom";
    await handleUpdate({
      side: targetSide,
      mirrored: shouldMirror,
    });
    notifySuccess(`Скан перемещен на сторону ${targetSide === "top" ? "Top (Лицевая)" : "Bottom (Обратная)"}`);
  };

  // Replace file directly (fast swap keeping coordinates, scale, and filters)
  const handleReplaceFile = async () => {
    try {
      let selectedPath: string | null = null;
      let selectedFile: File | null = null;

      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const sel = await open({
          multiple: false,
          filters: [
            {
              name: "Изображения",
              extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"],
            },
          ],
        });
        if (!sel) return;
        selectedPath = Array.isArray(sel) ? sel[0] : typeof sel === "string" ? sel : null;
      } else {
        // Browser file picker fallback
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*,.png,.jpg,.jpeg,.tif,.tiff,.webp,.bmp";
          input.onchange = () => resolve(input.files?.[0] || null);
          input.click();
        });
        if (!file) return;
        selectedFile = file;
      }

      if (selectedPath) {
        const imported = await engineClient.importImage(selectedPath, imgLayer.side);
        await handleUpdate({
          name: imported.name || imgLayer.name,
          imageFile: imported.imageFile,
          cachedUrl: imported.cachedUrl,
          width: imported.width,
          height: imported.height,
        });
        notifySuccess("Файл изображения успешно заменен с сохранением калибровки");
      } else if (selectedFile) {
        const url = URL.createObjectURL(selectedFile);
        const img = new Image();
        img.onload = async () => {
          await handleUpdate({
            name: selectedFile!.name,
            cachedUrl: url,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          notifySuccess("Файл изображения успешно заменен");
        };
        img.src = url;
      }
    } catch (err: any) {
      reportError(err, "Ошибка замены файла изображения");
    }
  };


  // Duplicate image
  const handleDuplicate = async () => {
    try {
      const cloned: BoardImageLayer = {
        ...imgLayer,
        id: `img_${imgLayer.side}_${Date.now()}`,
        name: `${imgLayer.name} (копия)`,
        offsetX: (imgLayer.offsetX || 0) + 15,
        offsetY: (imgLayer.offsetY || 0) + 15,
      };
      await updateImageLayer(cloned);
      selectImage(cloned.id);
      notifySuccess(`Создана копия слоя: "${cloned.name}"`);
    } catch (err: any) {
      reportError(err, "Ошибка дублирования слоя");
    }
  };

  // Export image
  const handleExportImage = () => {
    if (!imgLayer.cachedUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Apply current filters
      let filterStr = "";
      if (imgLayer.brightness !== undefined && imgLayer.brightness !== 100) filterStr += `brightness(${imgLayer.brightness}%) `;
      if (imgLayer.contrast !== undefined && imgLayer.contrast !== 100) filterStr += `contrast(${imgLayer.contrast}%) `;
      if (imgLayer.invert) filterStr += "invert(100%) ";
      if (imgLayer.grayscale) filterStr += "grayscale(100%) ";

      if (imgLayer.tintColor === "green") filterStr += "sepia(100%) hue-rotate(85deg) saturate(220%) ";
      else if (imgLayer.tintColor === "blue") filterStr += "sepia(100%) hue-rotate(180deg) saturate(220%) ";
      else if (imgLayer.tintColor === "red") filterStr += "sepia(100%) hue-rotate(320deg) saturate(250%) ";
      else if (imgLayer.tintColor === "amber") filterStr += "sepia(100%) hue-rotate(30deg) saturate(300%) ";

      if (filterStr) ctx.filter = filterStr.trim();

      ctx.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.download = `${imgLayer.name || "scan"}_export.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      notifySuccess("Изображение экспортировано в PNG");
    };
    resolveImageUrl(imgLayer.cachedUrl).then((url) => {
      img.src = url;
    });
  };

  // Reset all transforms
  const handleResetTransforms = () => {
    handleUpdate({
      scale: 1.0,
      rotation: 0,
      mirrored: !isTop,
      flipV: false,
      opacity: 0.85,
      brightness: 100,
      contrast: 100,
      invert: false,
      grayscale: false,
      blendMode: "normal",
      tintColor: "none",
    });
    notifySuccess("Трансформации и фильтры сброшены");
  };

  return (
    <aside className="cad-inspector-panel" style={{ width: `${rightSidebarWidth}px` }}>
      {/* Resizer bar */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "4px",
          height: "100%",
          cursor: "col-resize",
          background: "transparent",
          zIndex: 10,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--cad-border)",
          gap: "8px",
          background: "var(--cad-bg-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
          <ImageIcon
            size={15}
            color={isTop ? "#60a5fa" : "#94a3b8"}
            style={{ flexShrink: 0 }}
          />
          <input
            type="text"
            className="cad-editable-name-input"
            value={imgLayer.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            title="Кликните для переименования изображения"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
          <button
            className={`cad-tool-btn ${imgLayer.locked ? "active" : ""}`}
            style={{ width: "26px", height: "26px" }}
            onClick={() => handleUpdate({ locked: !imgLayer.locked })}
            title={imgLayer.locked ? "Разблокировать слой" : "Заблокировать от перемещения"}
          >
            {imgLayer.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} />}
          </button>
          <button
            className="cad-tool-btn"
            style={{ width: "26px", height: "26px" }}
            onClick={() => handleUpdate({ visible: !imgLayer.visible })}
            title={imgLayer.visible ? "Скрыть слой" : "Показать слой"}
          >
            {imgLayer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        </div>
      </div>

      <div
        className="cad-sidebar-content"
        style={{
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "9px",
          overflowY: "auto",
        }}
      >
        {/* Side Switcher (Top ↔ Bottom) */}
        <div className="cad-card-group" style={{ padding: "8px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#94a3b8" }}>Сторона платы:</span>
            <span className="cad-badge-dim">{naturalW} × {naturalH} px</span>
          </div>

          <div className="cad-side-toggle-group">
            <button
              type="button"
              className={`cad-side-btn ${isTop ? "active" : ""}`}
              onClick={() => handleSwitchSide("top")}
            >
              Лицевая (Top)
            </button>
            <button
              type="button"
              className={`cad-side-btn ${!isTop ? "active" : ""}`}
              onClick={() => handleSwitchSide("bottom")}
            >
              Обратная (Bottom)
            </button>
          </div>
        </div>

        {/* Lock warning */}
        {imgLayer.locked && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "6px",
              padding: "7px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fbbf24",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Lock size={13} color="#f59e0b" />
              <span>Слой заблокирован</span>
            </div>
            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                background: "rgba(245, 158, 11, 0.2)",
                borderColor: "rgba(245, 158, 11, 0.4)",
                color: "#fef3c7",
              }}
              onClick={() => handleUpdate({ locked: false })}
            >
              Разблокировать
            </button>
          </div>
        )}

        <div style={{ opacity: imgLayer.locked ? 0.5 : 1, pointerEvents: imgLayer.locked ? "none" : "auto", display: "flex", flexDirection: "column", gap: "9px" }}>
          {/* Card: Геометрия и позиция */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Move size={13} />
              <span>Геометрия и позиция</span>
            </div>

            {/* Position X / Y */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">X</span>
                <input
                  type="number"
                  step="0.5"
                  className="cad-modern-input"
                  value={imgLayer.offsetX !== undefined ? Math.round(imgLayer.offsetX * 10) / 10 : 0}
                  onChange={(e) => handleUpdate({ offsetX: parseFloat(e.target.value) || 0 })}
                />
                <span className="cad-field-suffix">мм</span>
              </div>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">Y</span>
                <input
                  type="number"
                  step="0.5"
                  className="cad-modern-input"
                  value={imgLayer.offsetY !== undefined ? Math.round(imgLayer.offsetY * 10) / 10 : 0}
                  onChange={(e) => handleUpdate({ offsetY: parseFloat(e.target.value) || 0 })}
                />
                <span className="cad-field-suffix">мм</span>
              </div>
            </div>

            {/* Dimensions W and H with Aspect Lock */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <div className="cad-field-wrap" style={{ flex: 1, minWidth: 0 }}>
                <span className="cad-field-prefix">W</span>
                <input
                  type="number"
                  className="cad-modern-input"
                  value={curW}
                  onChange={(e) => {
                    const newW = Math.max(10, parseInt(e.target.value, 10) || 10);
                    const newScale = newW / naturalW;
                    handleUpdate({ scale: Math.round(newScale * 1000) / 1000 });
                  }}
                />
                <span className="cad-field-suffix">px</span>
              </div>

              <button
                type="button"
                className={`cad-aspect-btn ${imgLayer.lockAspectRatio !== false ? "active" : ""}`}
                onClick={() => handleUpdate({ lockAspectRatio: imgLayer.lockAspectRatio === false })}
                title={imgLayer.lockAspectRatio !== false ? "Пропорции зафиксированы" : "Пропорции свободны"}
              >
                {imgLayer.lockAspectRatio !== false ? <Link size={12} /> : <Unlink size={12} />}
              </button>

              <div className="cad-field-wrap" style={{ flex: 1, minWidth: 0 }}>
                <span className="cad-field-prefix">H</span>
                <input
                  type="number"
                  className="cad-modern-input"
                  value={curH}
                  onChange={(e) => {
                    const newH = Math.max(10, parseInt(e.target.value, 10) || 10);
                    const newScale = newH / naturalH;
                    handleUpdate({ scale: Math.round(newScale * 1000) / 1000 });
                  }}
                />
                <span className="cad-field-suffix">px</span>
              </div>
            </div>

            {/* Scale Slider */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Масштаб:</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#60a5fa", fontFamily: "JetBrains Mono" }}>
                {Math.round(currentScale * 100)}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="range"
                min="0.05"
                max="5.0"
                step="0.01"
                className="cad-modern-slider"
                value={currentScale}
                onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) || 1.0 })}
              />
              <button
                type="button"
                className="cad-badge-dim"
                style={{ cursor: "pointer", padding: "3px 8px" }}
                onClick={() => handleUpdate({ scale: 1.0 })}
                title="Сбросить масштаб в 100% (1.0x)"
              >
                1:1
              </button>
            </div>
          </div>

          {/* Card: Поворот и юстировка */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Compass size={13} />
              <span>Поворот и юстировка</span>
            </div>

            {/* Fine angle bar */}
            <div className="cad-fine-angle-bar" style={{ marginBottom: "6px" }}>
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) - 1) * 10) / 10 })}
                title="Повернуть на -1.0°"
              >
                -1°
              </button>
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) - 0.1) * 10) / 10 })}
                title="Точная подгонка на -0.1°"
              >
                -0.1°
              </button>
              <input
                type="number"
                step="0.1"
                className="cad-angle-input"
                value={Math.round((imgLayer.rotation || 0) * 10) / 10}
                onChange={(e) => handleUpdate({ rotation: parseFloat(e.target.value) || 0 })}
              />
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) + 0.1) * 10) / 10 })}
                title="Точная подгонка на +0.1°"
              >
                +0.1°
              </button>
              <button
                type="button"
                className="cad-step-btn"
                onClick={() => handleUpdate({ rotation: Math.round(((imgLayer.rotation || 0) + 1) * 10) / 10 })}
                title="Повернуть на +1.0°"
              >
                +1°
              </button>
            </div>

            {/* Quick 90 deg and 0 deg buttons */}
            <div className="cad-btn-grid-2" style={{ marginBottom: "6px" }}>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ rotation: ((imgLayer.rotation || 0) + 90) % 360 })}
                title="Повернуть на +90° по часовой стрелке"
              >
                <RotateCw size={12} style={{ marginRight: "4px" }} />
                <span>+90°</span>
              </button>
              <button
                type="button"
                className="cad-btn cad-btn-secondary"
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ rotation: 0 })}
                title="Сбросить угол в 0°"
              >
                <RotateCcw size={12} style={{ marginRight: "4px" }} />
                <span>0° Сброс</span>
              </button>
            </div>

            {/* Mirror X / Y */}
            <div className="cad-btn-grid-2">
              <button
                type="button"
                className={`cad-btn cad-btn-secondary ${imgLayer.mirrored ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ mirrored: !imgLayer.mirrored })}
                title="Отзеркалить по горизонтали (Flip X)"
              >
                <FlipHorizontal size={12} style={{ marginRight: "4px" }} />
                <span>Зеркало X</span>
              </button>
              <button
                type="button"
                className={`cad-btn cad-btn-secondary ${imgLayer.flipV ? "active" : ""}`}
                style={{ fontSize: "11px", padding: "5px", justifyContent: "center" }}
                onClick={() => handleUpdate({ flipV: !imgLayer.flipV })}
                title="Отзеркалить по вертикали (Flip Y)"
              >
                <FlipVertical size={12} style={{ marginRight: "4px" }} />
                <span>Зеркало Y</span>
              </button>
            </div>
          </div>

          {/* Card: Калибровка масштаба */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Ruler size={13} />
              <span>Калибровка (CAD-масштаб)</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">DPI</span>
                <input
                  type="number"
                  className="cad-modern-input"
                  value={Math.round(currentDpi)}
                  onChange={(e) => {
                    const dpiVal = parseInt(e.target.value, 10) || 600;
                    handleUpdate({
                      dpi: dpiVal,
                      pxPerMm: Math.round((dpiVal / 25.4) * 100) / 100,
                    });
                  }}
                />
              </div>
              <div className="cad-field-wrap">
                <span className="cad-field-prefix">PX/ММ</span>
                <input
                  type="number"
                  step="0.01"
                  className="cad-modern-input"
                  value={Math.round(currentPxPerMm * 100) / 100}
                  onChange={(e) => {
                    const pxVal = parseFloat(e.target.value) || 23.62;
                    handleUpdate({
                      pxPerMm: pxVal,
                      dpi: Math.round(pxVal * 25.4),
                    });
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>Физический размер:</span>
              <span className="cad-badge-dim" style={{ color: "#60a5fa" }}>{widthMm} × {heightMm} мм</span>
            </div>

            <button
              type="button"
              className="cad-btn cad-btn-secondary"
              style={{ width: "100%", fontSize: "11px", padding: "6px", justifyContent: "center" }}
              onClick={() => setActiveTool("calibrate")}
              title="Кликните 2 точки известного расстояния на холсте"
            >
              <Ruler size={13} style={{ marginRight: "6px", color: "#60a5fa" }} />
              <span>Калибровать по 2 точкам</span>
            </button>
          </div>

          {/* Card: Отображение и смешивание */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Layers size={13} />
              <span>Отображение и смешивание</span>
            </div>

            {/* Blend Mode */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}>Режим смешивания:</div>
              <select
                className="cad-prop-select"
                value={imgLayer.blendMode || "normal"}
                onChange={(e) => handleUpdate({ blendMode: e.target.value })}
              >
                <option value="normal">Normal (Обычный)</option>
                <option value="multiply">Multiply (Умножение — просвет белого фона)</option>
                <option value="difference">Difference (Разница — подсветка несовпадений)</option>
                <option value="screen">Screen (Осветление)</option>
                <option value="overlay">Overlay (Перекрытие)</option>
                <option value="darken">Darken (Затемнение)</option>
                <option value="lighten">Lighten (Замена светлым)</option>
              </select>
            </div>

            {/* PCB Mask Tint */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}>Тонировка маски (PCB Tint):</div>
              <div className="cad-tint-chips">
                {[
                  { id: "none", label: "Оригинал" },
                  { id: "green", label: "Зеленая" },
                  { id: "blue", label: "Синяя" },
                  { id: "red", label: "Красная" },
                  { id: "amber", label: "Медь" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`cad-tint-pill ${(imgLayer.tintColor || "none") === t.id ? "active" : ""}`}
                    onClick={() => handleUpdate({ tintColor: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
                <span>Прозрачность:</span>
                <strong style={{ color: "#f8fafc", fontFamily: "JetBrains Mono" }}>{Math.round((imgLayer.opacity ?? 0.85) * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                className="cad-modern-slider"
                value={imgLayer.opacity ?? 0.85}
                onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
              />
            </div>

            {/* Brightness */}
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
                <span>Яркость:</span>
                <strong style={{ color: "#f8fafc", fontFamily: "JetBrains Mono" }}>{Math.round(imgLayer.brightness ?? 100)}%</strong>
              </div>
              <input
                type="range"
                min="30"
                max="200"
                step="5"
                className="cad-modern-slider"
                value={imgLayer.brightness ?? 100}
                onChange={(e) => handleUpdate({ brightness: parseFloat(e.target.value) })}
              />
            </div>

            {/* Contrast */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#94a3b8" }}>
                <span>Контраст:</span>
                <strong style={{ color: "#f8fafc", fontFamily: "JetBrains Mono" }}>{Math.round(imgLayer.contrast ?? 100)}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                className="cad-modern-slider"
                value={imgLayer.contrast ?? 100}
                onChange={(e) => handleUpdate({ contrast: parseFloat(e.target.value) })}
              />
            </div>

            {/* Modern Toggle Switches for Invert & Grayscale */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
              <label className="cad-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(imgLayer.invert)}
                  onChange={(e) => handleUpdate({ invert: e.target.checked })}
                />
                <span className="cad-switch-track" />
                <span>Инверсия</span>
              </label>

              <label className="cad-toggle-switch">
                <input
                  type="checkbox"
                  checked={Boolean(imgLayer.grayscale)}
                  onChange={(e) => handleUpdate({ grayscale: e.target.checked })}
                />
                <span className="cad-switch-track" />
                <span>Ч/Б режим</span>
              </label>
            </div>
          </div>

          {/* Card: Быстрые действия */}
          <div className="cad-card-group">
            <div className="cad-card-header">
              <Zap size={13} />
              <span>Быстрые действия</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div className="cad-btn-grid-2">
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={handleReplaceFile}
                  title="Заменить файл изображения с сохранением координат, масштаба и фильтров"
                >
                  <Upload size={12} style={{ flexShrink: 0, marginRight: "4px", color: "#60a5fa" }} />
                  <span>Заменить...</span>
                </button>

                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={() => {
                    setPendingPreprocess({
                      filePath: imgLayer.cachedUrl,
                      name: imgLayer.name,
                      side: (imgLayer.side as "top" | "bottom") || "top",
                      replaceLayerId: imgLayer.id,
                    });
                  }}
                  title="Открыть окно кадрирования, поворота и выравнивания горизонта"
                >
                  <Crop size={12} style={{ flexShrink: 0, marginRight: "4px", color: "#60a5fa" }} />
                  <span>Кадрировать...</span>
                </button>
              </div>

              <div className="cad-btn-grid-2">
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={handleDuplicate}
                  title="Создать копию изображения на холсте"
                >
                  <Copy size={12} style={{ flexShrink: 0, marginRight: "4px" }} />
                  <span>Дублировать</span>
                </button>

                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center" }}
                  onClick={handleExportImage}
                  title="Экспортировать скан с фильтрами в PNG"
                >
                  <Download size={12} style={{ flexShrink: 0, marginRight: "4px" }} />
                  <span>Экспорт...</span>
                </button>
              </div>

              <div className="cad-btn-grid-2">
                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center", color: "var(--cad-text-dim)" }}
                  onClick={handleResetTransforms}
                  title="Сбросить масштаб в 1.0x, угол в 0° и вернуть фильтры к значениям по умолчанию"
                >
                  <RotateCcw size={12} style={{ flexShrink: 0, marginRight: "4px" }} />
                  <span>Сброс</span>
                </button>

                <button
                  type="button"
                  className="cad-btn cad-btn-secondary"
                  style={{ fontSize: "11px", padding: "6px 8px", justifyContent: "center", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.25)" }}
                  onClick={() => {
                    deleteImageLayer(imgLayer.id);
                    selectImage(null);
                  }}
                  title="Удалить данный скан из проекта"
                >
                  <Trash2 size={12} style={{ flexShrink: 0, marginRight: "4px" }} />
                  <span>Удалить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
