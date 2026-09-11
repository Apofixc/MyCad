// src-tauri/src/library/model.rs
// Доменные модели устройств (Device / Component), логических выводов и каталога

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use crate::cad::footprint::PackageDefinition;

/// Электрический тип логического вывода на схеме
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PinElectricalType {
    Input,
    Output,
    Bidirectional,
    #[serde(alias = "power")]
    PowerIn,
    PowerOut,
    Ground,
    Passive,
    OpenCollector,
    #[serde(alias = "not_connected")]
    NoConnect,
}

fn default_pin_electrical_type() -> PinElectricalType {
    PinElectricalType::Passive
}

/// Логический вывод схемного символа компонента
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogicalPin {
    pub id: String,
    pub name: String,
    #[serde(default = "default_pin_electrical_type", alias = "pinType")]
    pub electrical_type: PinElectricalType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Привязка логических выводов схемы к физическим контактным площадкам посадочного места
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageMapping {
    pub package_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_variant_id: Option<String>,
    /// Таблица соответствия: Имя логического пина (напр. "VCC", "GND", "BASE") -> Номер физической площадки ("1", "8", "EP")
    #[serde(default, alias = "pinMapping")]
    pub pin_map: BTreeMap<String, String>,
}

/// Электрические и номинальные параметры радиодетали
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

/// Радиокомпонент / Устройство (Device / Component)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDefinition {
    pub id: String,
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub subcategory: String,
    pub designator_prefix: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub datasheet: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manufacturer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mpn: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub parameters: ElectricalParameters,
    #[serde(default, alias = "pins")]
    pub logical_pins: Vec<LogicalPin>,
    #[serde(default)]
    pub supported_packages: Vec<PackageMapping>,
}

/// Размещенный экземпляр компонента на плате
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacedComponent {
    pub id: String,
    pub ref_des: String, // "R1", "C2", "U5"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
    pub package_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selected_variant_id: Option<String>,
    pub x: f64,
    pub y: f64,
    pub rotation: f64,
    pub layer: String, // "top" | "bottom"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(default)]
    pub mirrored: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub package_def: Option<crate::cad::footprint::PackageDefinition>,
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
