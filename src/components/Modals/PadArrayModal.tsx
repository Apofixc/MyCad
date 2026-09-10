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
import { X, Layers, Check } from "lucide-react";

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
    <div className="cad-modal-overlay editor-overlay">
      <div className="cad-modal-container" style={{ width: 540, maxWidth: "95vw" }}>
        <div className="cad-modal-header">
          <div className="modal-title-with-icon">
            <Layers size={18} className="title-icon" />
            <span>Мастер массива контактных площадок</span>
          </div>
          <button className="cad-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="cad-modal-content" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Выбор типа массива */}
          <div className="form-group">
            <label className="form-label">Тип размещения массива:</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {[
                { id: "linear", label: "Рядный" },
                { id: "dual", label: "2-рядный (DIP)" },
                { id: "quad", label: "4-рядный (QFP)" },
                { id: "matrix", label: "Матрица (BGA)" },
                { id: "polar", label: "Круговой" },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`cad-btn-secondary ${arrayType === t.id ? "active-filter-tab" : ""}`}
                  style={{
                    padding: "6px 4px",
                    fontSize: 11,
                    background: arrayType === t.id ? "#2563eb" : "#1e293b",
                    color: "#ffffff",
                    borderColor: arrayType === t.id ? "#60a5fa" : "#334155",
                  }}
                  onClick={() => setArrayType(t.id as ArrayType)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Параметры площадки */}
          <div className="form-section">
            <span className="section-title">Форма и размеры площадки (мм)</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Форма:</label>
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value as PadShape)}
                  className="cad-input"
                >
                  <option value="rounded_rect">Скругленный прямоуг.</option>
                  <option value="rect">Прямоугольник</option>
                  <option value="circle">Круг</option>
                  <option value="oval">Овал</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ширина W:</label>
                <input
                  type="number"
                  step="0.05"
                  value={padWidth}
                  onChange={(e) => setPadWidth(parseFloat(e.target.value) || 0.1)}
                  className="cad-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Высота H:</label>
                <input
                  type="number"
                  step="0.05"
                  value={padHeight}
                  onChange={(e) => setPadHeight(parseFloat(e.target.value) || 0.1)}
                  className="cad-input"
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 6 }}>
              <label className="form-label">Сверловка (0 для SMD, &gt;0 для THT):</label>
              <input
                type="number"
                step="0.05"
                value={drillDiameter}
                onChange={(e) => setDrillDiameter(parseFloat(e.target.value) || 0)}
                className="cad-input"
                placeholder="0 = поверхностный монтаж SMD"
              />
            </div>
          </div>

          {/* Специфические настройки выбранного типа */}
          <div className="form-section">
            <span className="section-title">Геометрия массива</span>
            {arrayType === "linear" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Кол-во выводов:</label>
                  <input
                    type="number"
                    value={linearCount}
                    onChange={(e) => setLinearCount(parseInt(e.target.value, 10) || 1)}
                    className="cad-input"
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
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Направление:</label>
                  <select
                    value={linearDir}
                    onChange={(e) => setLinearDir(e.target.value as any)}
                    className="cad-input"
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
                  />
                </div>
              </div>
            )}

            {arrayType === "quad" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Выводов на сторону:</label>
                    <input
                      type="number"
                      value={quadPinsPerSide}
                      onChange={(e) => setQuadPinsPerSide(parseInt(e.target.value, 10) || 1)}
                      className="cad-input"
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
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Дистанция рядов:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={quadDist}
                      onChange={(e) => setQuadDist(parseFloat(e.target.value) || 7.0)}
                      className="cad-input"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#cbd5e1" }}>
                    <input
                      type="checkbox"
                      checked={quadWithThermal}
                      onChange={(e) => setQuadWithThermal(e.target.checked)}
                    />
                    Термопад в центре (Exposed Pad)
                  </label>
                  {quadWithThermal && (
                    <input
                      type="number"
                      step="0.2"
                      value={quadThermalSize}
                      onChange={(e) => setQuadThermalSize(parseFloat(e.target.value) || 1.0)}
                      className="cad-input"
                      style={{ width: 80 }}
                    />
                  )}
                </div>
              </div>
            )}

            {arrayType === "matrix" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                <div className="form-group">
                  <label className="form-label">Строк (Rows):</label>
                  <input
                    type="number"
                    value={matrixRows}
                    onChange={(e) => setMatrixRows(parseInt(e.target.value, 10) || 1)}
                    className="cad-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Колонок (Cols):</label>
                  <input
                    type="number"
                    value={matrixCols}
                    onChange={(e) => setMatrixCols(parseInt(e.target.value, 10) || 1)}
                    className="cad-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Шаг (мм):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={matrixPitch}
                    onChange={(e) => setMatrixPitch(parseFloat(e.target.value) || 0.8)}
                    className="cad-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Диаметр ⌀:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={matrixPadDia}
                    onChange={(e) => setMatrixPadDia(parseFloat(e.target.value) || 0.4)}
                    className="cad-input"
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
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Угол старта (°):</label>
                  <input
                    type="number"
                    value={polarStartAngle}
                    onChange={(e) => setPolarStartAngle(parseFloat(e.target.value) || 0)}
                    className="cad-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="cad-modal-footer">
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
