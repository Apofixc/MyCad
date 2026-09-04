//! Модели библиотеки компонентов MyCad.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MountType {
    Tht,
    Smd,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PadShape {
    Circle,
    Rect,
    RoundedRect,
    Oval,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PackageKeyType {
    Notch,
    Dot,
    Chamfer,
    Stripe,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PackageFamily {
    Chip2pin,
    Axial,
    Radial,
    Dip,
    Soic,
    Sot,
    To,
    Qfp,
    Connector,
    Switch,
    Hardware,
    #[serde(untagged)]
    Other(String),
}

/// Физическая контактная площадка (Pad)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackagePad {
    pub pad_num: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub shape: PadShape,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drill_diameter: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub round_radius: Option<f64>,
}

/// Тепловые и механические ограничения корпуса
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageConstraints {
    pub courtyard_width: f64,
    pub courtyard_height: f64,
    pub max_height: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_thermal_pad: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thermal_pad_num: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thermal_resistance_junction_case: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thermal_resistance_junction_air: Option<f64>,
}

/// Вариант визуального исполнения корпуса
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageVariant {
    pub id: String,
    pub name: String,
    pub body_color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_border_color: Option<String>,
    pub key_type: PackageKeyType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_polarity_mark: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polarity_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub silkscreen_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orientation: Option<String>,
}

/// 3D представление корпуса
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Package3DModel {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<[f64; 3]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rotation: Option<[f64; 3]>,
}

/// Спецификация физического корпуса
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageDefinition {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub standard: Option<String>,
    pub family: PackageFamily,
    pub mount_type: MountType,
    pub body_width: f64,
    pub body_height: f64,
    pub pitch: f64,
    pub pads: Vec<PackagePad>,
    pub constraints: PackageConstraints,
    pub default_variant_id: String,
    #[serde(default)]
    pub variants: Vec<PackageVariant>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model3d: Option<Package3DModel>,
}

/// Электрический тип логического вывода
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PinElectricalType {
    Input,
    Output,
    Bidirectional,
    PowerIn,
    PowerOut,
    Ground,
    Passive,
    OpenCollector,
    NoConnect,
}

/// Логический вывод компонента
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogicalPin {
    pub id: String,
    pub name: String,
    pub electrical_type: PinElectricalType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Привязка логических выводов к корпусу
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageMapping {
    pub package_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_variant_id: Option<String>,
    pub pin_map: BTreeMap<String, u32>,
}

/// Электрические характеристики
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElectricalParameters {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tolerance: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voltage_rating: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub power_rating: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_current: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operating_temp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom: Option<BTreeMap<String, String>>,
}

/// Единая универсальная сущность радиодетали (Device)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDefinition {
    pub id: String,
    pub name: String,
    pub category: String,
    pub subcategory: String,
    pub designator_prefix: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub datasheet: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub parameters: ElectricalParameters,
    #[serde(default)]
    pub logical_pins: Vec<LogicalPin>,
    #[serde(default)]
    pub supported_packages: Vec<PackageMapping>,
}

/// Подкатегория каталога
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSubcategory {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Категория каталога компонентов
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogCategory {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub subcategories: Vec<CatalogSubcategory>,
}

/// Полный набор библиотеки компонентов
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentLibraryPayload {
    pub categories: Vec<CatalogCategory>,
    pub packages: Vec<PackageDefinition>,
    pub devices: Vec<DeviceDefinition>,
}
