//! Доменная модель MyCad.
//!
//! Проект — изделие из нескольких модулей (плат/узлов). У каждого модуля свои
//! изображения, компоненты и цепи; межплатные связи через разъёмы образуют
//! сквозной netlist изделия.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub type ModuleId = String;
pub type ComponentId = String;
pub type FootprintId = String;
pub type NetId = String;
pub type ImageId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub version: u32,
    pub modules: Vec<Module>,
    /// Общая библиотека корпусов проекта.
    pub footprints: BTreeMap<FootprintId, Footprint>,
    /// Пресеты компонентов (микросхемы и т.п.).
    pub presets: BTreeMap<String, ComponentPreset>,
    /// Межплатные связи через разъёмы.
    pub inter_module_links: Vec<InterModuleLink>,
}

impl Project {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            version: 1,
            modules: Vec::new(),
            footprints: BTreeMap::new(),
            presets: BTreeMap::new(),
            inter_module_links: Vec::new(),
        }
    }

    pub fn module(&self, id: &str) -> Option<&Module> {
        self.modules.iter().find(|m| m.id == id)
    }
}

/// Модуль — одна плата/узел изделия (основная плата, считыватель, клавиатура…).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Module {
    pub id: ModuleId,
    pub name: String,
    /// Размеры рабочего поля в пикселях основного изображения.
    pub width_px: f64,
    pub height_px: f64,
    /// Контур платы в координатах поля.
    pub board_rect: Rect,
    /// Изображения модуля (Top/Bottom/фрагменты). Компонент может быть
    /// размечен на любом изображении; сторона — атрибут компонента.
    pub images: Vec<BoardImage>,
    pub components: Vec<Component>,
    pub nets: BTreeMap<NetId, Net>,
    pub calibration: Option<Calibration>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardImage {
    pub id: ImageId,
    /// Путь к файлу изображения (относительно проекта).
    pub path: String,
    pub kind: ImageKind,
    pub width_px: f64,
    pub height_px: f64,
    /// Трансформация изображения в координаты модуля.
    pub offset_x: f64,
    pub offset_y: f64,
    pub mirrored: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ImageKind {
    Top,
    Bottom,
    Fragment,
}

/// Калибровка «пиксели → мм».
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calibration {
    pub px_per_mm: f64,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Layer {
    #[default]
    Top,
    Bottom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Component {
    pub id: ComponentId,
    pub designator: String,
    pub value: String,
    pub footprint: FootprintId,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default)]
    pub layer: Layer,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub show_designator: bool,
    #[serde(default)]
    pub show_value: bool,
    #[serde(default)]
    pub notes: String,
    /// Пользовательские имена пинов (номер → имя), поверх footprint.
    #[serde(default)]
    pub custom_pins: BTreeMap<String, String>,
    /// Пресет, из которого создан компонент (если есть).
    #[serde(default)]
    pub preset: Option<String>,
    /// Переопределение числа пинов (для CONN-HEADER и т.п.).
    #[serde(default)]
    pub pin_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Footprint {
    pub id: FootprintId,
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub subcategory: String,
    pub mount_type: MountType,
    /// Идентификатор процедурной отрисовки корпуса (shape из прототипа).
    pub shape: String,
    pub width: f64,
    pub height: f64,
    pub pin_count: u32,
    pub pins: Vec<FootprintPin>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MountType {
    Tht,
    Smd,
    Virtual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FootprintPin {
    pub num: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub shape: String,
    /// Позиция пина в долях габарита корпуса (0..1).
    pub x_ratio: f64,
    pub y_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentPreset {
    pub name: String,
    pub footprint: FootprintId,
    #[serde(default)]
    pub designator_prefix: String,
    #[serde(default)]
    pub value: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub subcategory: String,
    #[serde(default)]
    pub notes: String,
    /// Распиновка: номер пина → имя сигнала.
    #[serde(default)]
    pub pins: BTreeMap<String, String>,
}

/// Тип цепи. Несколько доменов питания и раздельные земли — разные цепи.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NetType {
    Ground,
    Power,
    Signal,
    Bus,
    Analog,
    Io,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Net {
    pub id: NetId,
    pub name: String,
    #[serde(default)]
    pub label: String,
    #[serde(rename = "type")]
    pub net_type: NetType,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub voltage: Option<f64>,
    #[serde(default)]
    pub description: String,
    pub nodes: Vec<NetNode>,
    /// Подтверждена ли цепь прозвонкой.
    #[serde(default)]
    pub verified: bool,
}

/// Узел цепи: вывод компонента. Цепь заканчивается на выводах компонента —
/// проход «сквозь» радиокомпонент образует новую цепь.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetNode {
    pub comp_id: ComponentId,
    pub pin: String,
    #[serde(default)]
    pub desc: String,
}

/// Межплатная связь: пин разъёма одного модуля ↔ пин разъёма другого.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterModuleLink {
    pub from: ModulePinRef,
    pub to: ModulePinRef,
    #[serde(default)]
    pub verified: bool,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModulePinRef {
    pub module_id: ModuleId,
    pub comp_id: ComponentId,
    pub pin: String,
}
