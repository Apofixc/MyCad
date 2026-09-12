import React from "react";
import { GraphicItem } from "../../types/componentLibrary";

type NumericKey<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export function PointProperties({ points, onChange }: {
  points: [number, number][];
  onChange: (points: [number, number][]) => void;
}) {
  return <div style={{ display: "grid", gap: 6 }}>
    <span className="form-label">Вершины X, Y (мм)</span>
    {points.map(([x, y], index) => <div key={index} style={{ display: "flex", gap: 4 }}>
      {[x, y].map((value, axis) => <input key={axis} className="cad-input" type="number" step="0.1"
        aria-label={`Вершина ${index + 1}: ${axis === 0 ? "X" : "Y"}`} value={value}
        style={{ width: "40%" }} onChange={(event) => {
          if (!Number.isFinite(event.target.valueAsNumber)) return;
          onChange(points.map((point, i) => i === index
            ? axis === 0 ? [event.target.valueAsNumber, point[1]] : [point[0], event.target.valueAsNumber]
            : point));
        }} />)}
      <button className="cad-icon-btn" title="Удалить вершину" disabled={points.length <= 3}
        onClick={() => onChange(points.filter((_, i) => i !== index))}>×</button>
    </div>)}
    <button className="cad-btn-secondary" onClick={() => {
      const first = points[0], last = points[points.length - 1];
      if (first && last) onChange([...points, [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2]]);
    }}>Добавить вершину</button>
  </div>;
}

export function ExtraGraphicProperties({ item, onChange }: {
  item: GraphicItem;
  onChange: (item: GraphicItem) => void;
}) {
  const numbers = <T extends GraphicItem,>(graphic: T,
    fields: { key: NumericKey<T>; label: string; min?: number }[]) =>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {fields.map(({ key, label, min }) => <label key={String(key)} className="form-label">
        {label}
        <input className="cad-input" style={{ width: "100%" }} type="number" step="0.1" min={min}
          value={Number(graphic[key])} onChange={(event) => {
            const value = event.target.valueAsNumber;
            if (Number.isFinite(value) && (min === undefined || value >= min)) onChange({ ...graphic, [key]: value });
          }} />
      </label>)}
    </div>;

  switch (item.kind) {
    case "arc": return numbers(item, [
      { key: "cx", label: "Центр X (мм)" }, { key: "cy", label: "Центр Y (мм)" },
      { key: "radius", label: "Радиус (мм)", min: 0.001 },
      { key: "startAngle", label: "Начало (°)" }, { key: "endAngle", label: "Конец (°)" },
    ]);
    case "capsule": return numbers(item, [
      { key: "cx", label: "Центр X (мм)" }, { key: "cy", label: "Центр Y (мм)" },
      { key: "width", label: "Ширина (мм)", min: 0.001 }, { key: "height", label: "Высота (мм)", min: 0.001 },
      { key: "rotation", label: "Поворот (°)" },
    ]);
    case "text": return <>
      <label className="form-label">Текст<input className="cad-input" value={item.text}
        onChange={(event) => onChange({ ...item, text: event.target.value })} /></label>
      {numbers(item, [
        { key: "x", label: "X (мм)" }, { key: "y", label: "Y (мм)" },
        { key: "fontSize", label: "Размер (мм)", min: 0.001 }, { key: "rotation", label: "Поворот (°)" },
      ])}
      <label className="form-label">Выравнивание<select className="cad-input" value={item.align}
        onChange={(event) => onChange({ ...item, align: event.target.value as "left" | "center" | "right" })}>
        <option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option>
      </select></label>
    </>;
    case "polygon": return <>
      <PointProperties points={item.points} onChange={(points) => onChange({ ...item, points })} />
      <label><input type="checkbox" checked={!!item.filled}
        onChange={(event) => onChange({ ...item, filled: event.target.checked })} /> Заливка контура</label>
    </>;
    case "rect": return numbers(item, [{ key: "rotation", label: "Поворот (°)" }, { key: "roundRadius", label: "Скругление (мм)", min: 0 }]);
    case "d_shape": return numbers(item, [{ key: "cutDepth", label: "Глубина среза (мм)", min: 0 }]);
    default: return null;
  }
}
