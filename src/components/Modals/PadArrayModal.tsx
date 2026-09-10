// src/components/Modals/PadArrayModal.tsx
// Модальный диалог генератора массивов контактных площадок (Linear, Dual, Quad, Matrix, Polar)

import React, { useState } from "react";
import {
  PackagePad,
  PadShape,
} from "../../types/componentLibrary";
import {
  generateLinearPadArray,
  generateDualPadArray,
  generateQuadPadArray,
  generateMatrixPadArray,
  generatePolarPadArray,
} from "../../utils/footprintGenerator";
import { X, Layers, Check, Grid, Sparkles, Sliders } from "lucide-react";

interface PadArrayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPads: (newPads: PackagePad[]) => void;
}

type ArrayType = "linear" | "dual" | "quad" | "matrix" | "polar";

export const PadArrayModal: React.FC<PadArrayModalProps> = ({
  isOpen,
  onClose,
  onApplyPads,
}) => {
  const [arrayType, setArrayType] = useState<ArrayType>("dual");

  // Общие параметры площадки
  const [shape, setShape] = useState<PadShape>("rounded_rect");
  const [padWidth, setPadWidth] = useState<number>(1.6);
  const [padHeight, setPadHeight] = useState<number>(0.6);
  const [drillDiameter, setDrillDiameter] = useState<number>(0);

  // Линейный
  const [linearCount, setLinearCount] = useState<number>(8);
  const [linearPitch, setLinearPitch] = useState<number>(2.54);
  const [linearDir, setLinearDir] = useState<"horizontal" | "vertical">("vertical");

  // Двухрядный (DIP / SOIC)
  const [dualTotalPins, setDualTotalPins] = useState<number>(8);
  const [dualPitch, setDualPitch] = useState<number>(1.27);
  const [dualRowDist, setDualRowDist] = useState<number>(5.4);

  // Четырехсторонний (QFP / QFN)
  const [quadPinsPerSide, setQuadPinsPerSide] = useState<number>(8);
  const [quadPitch, setQuadPitch] = useState<number>(0.5);
  const [quadDist, setQuadDist] = useState<number>(7.0);
  const [quadWithThermal, setQuadWithThermal] = useState<boolean>(true);
  const [quadThermalSize, setQuadThermalSize] = useState<number>(4.0);

  // Матрица (BGA)
  const [matrixRows, setMatrixRows] = useState<number>(8);
  const [matrixCols, setMatrixCols] = useState<number>(8);
  const [matrixPitch, setMatrixPitch] = useState<number>(0.8);
  const [matrixPadDia, setMatrixPadDia] = useState<number>(0.4);

  // Круговой (Polar)
  const [polarCount, setPolarCount] = useState<number>(8);
  const [polarRadius, setPolarRadius] = useState<number>(5.0);
  const [polarStartAngle, setPolarStartAngle] = useState<number>(0);

  if (!isOpen) return null;

  // Быстрые пресеты площадок
  const applyPreset = (preset: "smd_soic" | "smd_qfp" | "smd_bga" | "tht_dip") => {
    switch (preset) {
      case "smd_soic":
        setShape("rounded_rect");
        setPadWidth(1.6);
        setPadHeight(0.6);
        setDrillDiameter(0);
        break;
      case "smd_qfp":
        setShape("rounded_rect");
        setPadWidth(1.5);
        setPadHeight(0.35);
        setDrillDiameter(0);
        break;
      case "smd_bga":
        setShape("circle");
        setPadWidth(0.4);
        setPadHeight(0.4);
        setDrillDiameter(0);
        setMatrixPadDia(0.4);
        break;
      case "tht_dip":
        setShape("circle");
        setPadWidth(1.6);
        setPadHeight(1.6);
        setDrillDiameter(0.8);
        break;
    }
  };

  // Расчёт итогового количества площадок и примерных габаритов
  let totalPads = 0;
  let estW = 0;
  let estH = 0;

  switch (arrayType) {
    case "linear":
      totalPads = linearCount;
      if (linearDir === "vertical") {
        estW = padWidth;
        estH = (linearCount - 1) * linearPitch + padHeight;
      } else {
        estW = (linearCount - 1) * linearPitch + padWidth;
        estH = padHeight;
      }
      break;
    case "dual":
      totalPads = dualTotalPins;
      estW = dualRowDist + padWidth;
      estH = (dualTotalPins / 2 - 1) * dualPitch + padHeight;
      break;
    case "quad":
      totalPads = quadPinsPerSide * 4 + (quadWithThermal ? 1 : 0);
      estW = quadDist + padWidth;
      estH = quadDist + padWidth;
      break;
    case "matrix":
      totalPads = matrixRows * matrixCols;
      estW = (matrixCols - 1) * matrixPitch + matrixPadDia;
      estH = (matrixRows - 1) * matrixPitch + matrixPadDia;
      break;
    case "polar":
      totalPads = polarCount;
      estW = polarRadius * 2 + padWidth;
      estH = polarRadius * 2 + padHeight;
      break;
  }

  const handleGenerate = () => {
    let generated: PackagePad[] = [];
    const tpl = {
      width: padWidth,
      height: padHeight,
      shape,
      drillDiameter: drillDiameter > 0 ? drillDiameter : undefined,
    };

    switch (arrayType) {
      case "linear":
        generated = generateLinearPadArray(linearCount, linearPitch, linearDir, 1, tpl);
        break;
      case "dual":
        generated = generateDualPadArray(dualTotalPins, dualPitch, dualRowDist, tpl);
        break;
      case "quad":
        generated = generateQuadPadArray(
          quadPinsPerSide,
          quadPitch,
          quadDist,
          tpl,
          quadWithThermal,
          quadThermalSize
        );
        break;
      case "matrix":
        generated = generateMatrixPadArray(matrixRows, matrixCols, matrixPitch, matrixPadDia);
        break;
      case "polar":
        generated = generatePolarPadArray(polarCount, polarRadius, polarStartAngle, tpl);
        break;
    }

    onApplyPads(generated);
    onClose();
  };

  return (
    <div className="cad-modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="cad-modal-box modal-array-generator"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Шапка модального окна */}
        <div className="cad-modal-header" style={{ padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="cad-modal-icon-badge" style={{ width: 34, height: 34, borderRadius: 8 }}>
              <Layers size={18} color="var(--cad-accent-hover)" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--cad-text-main)" }}>
                Мастер массива площадок
              </div>
              <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "1px" }}>
                Автоматическая генерация рядов, матриц и окружностей
              </div>
            </div>
          </div>
          <button className="cad-modal-close-btn" onClick={onClose} title="Закрыть (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Тело модального окна */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {/* Сегментированный переключатель типа массива */}
          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>Тип размещения массива:</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 4,
                background: "var(--cad-bg-surface)",
                padding: 3,
                borderRadius: 8,
                border: "1px solid var(--cad-border)",
              }}
            >
              {[
                { id: "linear", label: "Рядный" },
                { id: "dual", label: "2-рядный (DIP)" },
                { id: "quad", label: "4-рядный (QFP)" },
                { id: "matrix", label: "Матрица (BGA)" },
                { id: "polar", label: "Круговой" },
              ].map((t) => {
                const isActive = arrayType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    style={{
                      padding: "6px 2px",
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: 6,
                      background: isActive ? "var(--cad-bg-card)" : "transparent",
                      color: isActive ? "var(--cad-accent-hover)" : "var(--cad-text-muted)",
                      border: isActive ? "1px solid var(--cad-accent)" : "1px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setArrayType(t.id as ArrayType)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Карточка 1: Параметры контактной площадки */}
          <div className="form-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--cad-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Sparkles size={13} color="var(--cad-accent-hover)" />
                <span>Форма и размеры площадки</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className="pkg-preset-btn"
                  onClick={() => applyPreset("smd_soic")}
                  title="SOIC / SOP: 1.6×0.6 мм"
                >
                  SOIC
                </button>
                <button
                  type="button"
                  className="pkg-preset-btn"
                  onClick={() => applyPreset("smd_qfp")}
                  title="QFP / QFN: 1.5×0.35 мм"
                >
                  QFP
                </button>
                <button
                  type="button"
                  className="pkg-preset-btn"
                  onClick={() => applyPreset("smd_bga")}
                  title="BGA Ball: ⌀0.4 мм"
                >
                  BGA
                </button>
                <button
                  type="button"
                  className="pkg-preset-btn"
                  onClick={() => applyPreset("tht_dip")}
                  title="THT Pin: ⌀1.6 (отв. 0.8) мм"
                >
                  THT
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Форма площадки:</label>
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value as PadShape)}
                  className="cad-input"
                  style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                >
                  <option value="rounded_rect">Скруглённый прямоуг.</option>
                  <option value="rect">Прямоугольник</option>
                  <option value="circle">Круг</option>
                  <option value="oval">Овал</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Сверление (Drill ⌀ для THT):</label>
                <input
                  type="number"
                  step="0.05"
                  value={drillDiameter}
                  onChange={(e) => setDrillDiameter(parseFloat(e.target.value) || 0)}
                  className="cad-input"
                  style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  placeholder="0 — SMD"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Ширина W (мм):</label>
                <input
                  type="number"
                  step="0.05"
                  value={padWidth}
                  onChange={(e) => setPadWidth(parseFloat(e.target.value) || 0.1)}
                  className="cad-input"
                  style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Высота H (мм):</label>
                <input
                  type="number"
                  step="0.05"
                  value={padHeight}
                  onChange={(e) => setPadHeight(parseFloat(e.target.value) || 0.1)}
                  className="cad-input"
                  style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                />
              </div>
            </div>
          </div>

          {/* Карточка 2: Специфическая геометрия выбранного типа */}
          <div className="form-section">
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--cad-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Sliders size={13} color="var(--cad-accent-hover)" />
              <span>Геометрия массива</span>
            </div>

            {arrayType === "linear" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Кол-во выводов:</label>
                  <input
                    type="number"
                    value={linearCount}
                    onChange={(e) => setLinearCount(parseInt(e.target.value, 10) || 1)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Шаг (Pitch, мм):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={linearPitch}
                    onChange={(e) => setLinearPitch(parseFloat(e.target.value) || 1.0)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Направление:</label>
                  <select
                    value={linearDir}
                    onChange={(e) => setLinearDir(e.target.value as any)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  >
                    <option value="vertical">Вертикально</option>
                    <option value="horizontal">Горизонтально</option>
                  </select>
                </div>
              </div>
            )}

            {arrayType === "dual" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Всего выводов:</label>
                  <input
                    type="number"
                    step="2"
                    value={dualTotalPins}
                    onChange={(e) => setDualTotalPins(parseInt(e.target.value, 10) || 2)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Шаг выводов (мм):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={dualPitch}
                    onChange={(e) => setDualPitch(parseFloat(e.target.value) || 1.27)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Между рядами (мм):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dualRowDist}
                    onChange={(e) => setDualRowDist(parseFloat(e.target.value) || 5.0)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
              </div>
            )}

            {arrayType === "quad" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Выводов на сторону:</label>
                    <input
                      type="number"
                      value={quadPinsPerSide}
                      onChange={(e) => setQuadPinsPerSide(parseInt(e.target.value, 10) || 1)}
                      className="cad-input"
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Шаг выводов (мм):</label>
                    <input
                      type="number"
                      step="0.05"
                      value={quadPitch}
                      onChange={(e) => setQuadPitch(parseFloat(e.target.value) || 0.5)}
                      className="cad-input"
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Дистанция рядов (мм):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={quadDist}
                      onChange={(e) => setQuadDist(parseFloat(e.target.value) || 7.0)}
                      className="cad-input"
                      style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: "var(--cad-bg-surface)", borderRadius: 6, border: "1px solid var(--cad-border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--cad-text-main)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={quadWithThermal}
                      onChange={(e) => setQuadWithThermal(e.target.checked)}
                    />
                    Термопад в центре (Exposed Pad)
                  </label>
                  {quadWithThermal && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                      <span style={{ fontSize: 11, color: "var(--cad-text-muted)" }}>Размер:</span>
                      <input
                        type="number"
                        step="0.2"
                        value={quadThermalSize}
                        onChange={(e) => setQuadThermalSize(parseFloat(e.target.value) || 1.0)}
                        className="cad-input"
                        style={{ width: 70, padding: "3px 6px", fontSize: 11 }}
                      />
                      <span style={{ fontSize: 11, color: "var(--cad-text-muted)" }}>мм</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* МАТРИЦА (BGA) - Сетка 2x2: нет обрезки и переполнения */}
            {arrayType === "matrix" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Строк (Rows):</label>
                  <input
                    type="number"
                    value={matrixRows}
                    onChange={(e) => setMatrixRows(parseInt(e.target.value, 10) || 1)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Колонок (Cols):</label>
                  <input
                    type="number"
                    value={matrixCols}
                    onChange={(e) => setMatrixCols(parseInt(e.target.value, 10) || 1)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Шаг выводов (Pitch, мм):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={matrixPitch}
                    onChange={(e) => setMatrixPitch(parseFloat(e.target.value) || 0.8)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Диаметр шарика ⌀ (мм):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={matrixPadDia}
                    onChange={(e) => setMatrixPadDia(parseFloat(e.target.value) || 0.4)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
              </div>
            )}

            {arrayType === "polar" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Кол-во выводов:</label>
                  <input
                    type="number"
                    value={polarCount}
                    onChange={(e) => setPolarCount(parseInt(e.target.value, 10) || 3)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Радиус (мм):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={polarRadius}
                    onChange={(e) => setPolarRadius(parseFloat(e.target.value) || 5.0)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Угол старта (°):</label>
                  <input
                    type="number"
                    value={polarStartAngle}
                    onChange={(e) => setPolarStartAngle(parseFloat(e.target.value) || 0)}
                    className="cad-input"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Информационная полоска сводки генерации */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "var(--cad-bg-surface)",
              borderRadius: 6,
              border: "1px solid var(--cad-border)",
              fontSize: 11,
              color: "var(--cad-text-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Grid size={13} color="var(--cad-accent-hover)" />
              <span>Итого площадок к генерации:</span>
              <strong style={{ color: "var(--cad-accent-hover)" }}>{totalPads} шт.</strong>
            </div>
            <div>
              <span>Ориентир. габарит: </span>
              <strong style={{ color: "var(--cad-text-main)" }}>
                {estW.toFixed(2)} × {estH.toFixed(2)} мм
              </strong>
            </div>
          </div>
        </div>

        {/* Подвал */}
        <div className="cad-modal-footer" style={{ padding: "10px 18px" }}>
          <button className="cad-btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="cad-btn-primary" onClick={handleGenerate}>
            <Check size={14} />
            <span>Сгенерировать на холст</span>
          </button>
        </div>
      </div>
    </div>
  );
};
