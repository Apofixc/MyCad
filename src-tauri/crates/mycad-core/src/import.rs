//! Импорт референс-данных прототипа Boardview
//! (JSON, извлечённый из components_db.js / nets_db.js скриптом tools/extract_reference.mjs).

use crate::model::*;
use serde::Deserialize;
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("ошибка разбора JSON: {0}")]
    Json(#[from] serde_json::Error),
}

/// Номер пина в референсе бывает числом и строкой — нормализуем в строку.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum PinNum {
    Num(i64),
    Str(String),
}

impl PinNum {
    fn into_string(self) -> String {
        match self {
            PinNum::Num(n) => n.to_string(),
            PinNum::Str(s) => s,
        }
    }
}

#[derive(Debug, Deserialize)]
struct RawBoardMeta {
    dimensions: RawDimensions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDimensions {
    width_px: f64,
    height_px: f64,
    board_rect: Rect,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawFootprint {
    id: String,
    name: String,
    category: String,
    #[serde(default)]
    subcategory: String,
    mount_type: String,
    shape: String,
    width: f64,
    height: f64,
    pin_count: u32,
    #[serde(default)]
    pins: Vec<RawFootprintPin>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawFootprintPin {
    num: PinNum,
    #[serde(default)]
    name: String,
    #[serde(default)]
    shape: String,
    x_ratio: f64,
    y_ratio: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawComponent {
    id: String,
    designator: String,
    #[serde(default)]
    value: String,
    footprint: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    #[serde(default)]
    rotation: f64,
    #[serde(default = "default_layer")]
    layer: String,
    #[serde(default)]
    locked: bool,
    #[serde(default)]
    show_designator: Option<bool>,
    #[serde(default)]
    show_value: Option<bool>,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    custom_pins: BTreeMap<String, String>,
    #[serde(default)]
    preset: Option<String>,
    #[serde(default)]
    pin_count: Option<u32>,
}

fn default_layer() -> String {
    "top".to_string()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPreset {
    name: String,
    /// В референсе встречаются оба варианта поля: `footprint` и `footprintId`.
    #[serde(default)]
    footprint: Option<String>,
    #[serde(default)]
    footprint_id: Option<String>,
    #[serde(default)]
    designator_prefix: String,
    #[serde(default)]
    value: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    subcategory: String,
    #[serde(default)]
    notes: String,
    /// Альтернативное поле описания в части пресетов.
    #[serde(default)]
    description: String,
    #[serde(default)]
    pins: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct RawNet {
    id: String,
    name: String,
    #[serde(default)]
    label: String,
    #[serde(rename = "type")]
    net_type: String,
    #[serde(default)]
    color: String,
    #[serde(default)]
    voltage: Option<f64>,
    #[serde(default)]
    description: String,
    #[serde(default)]
    nodes: Vec<RawNetNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawNetNode {
    comp_id: String,
    pin: PinNum,
    #[serde(default)]
    desc: String,
}

fn parse_mount_type(s: &str) -> MountType {
    match s {
        "smd" => MountType::Smd,
        "tht" => MountType::Tht,
        _ => MountType::Virtual,
    }
}

fn parse_net_type(s: &str) -> NetType {
    match s {
        "ground" => NetType::Ground,
        "power" => NetType::Power,
        "bus" => NetType::Bus,
        "analog" => NetType::Analog,
        "io" => NetType::Io,
        _ => NetType::Signal,
    }
}

/// Собирает проект из референс-JSON прототипа: один модуль «Основная плата»
/// с фото-подложкой, компонентами и цепями платы «Пиррс 1000 Люкс».
pub fn import_reference_project(
    board_meta_json: &str,
    footprints_json: &str,
    presets_json: &str,
    components_json: &str,
    nets_json: &str,
    board_image_path: &str,
) -> Result<Project, ImportError> {
    let meta: RawBoardMeta = serde_json::from_str(board_meta_json)?;
    let raw_footprints: BTreeMap<String, RawFootprint> = serde_json::from_str(footprints_json)?;
    let raw_presets: BTreeMap<String, RawPreset> = serde_json::from_str(presets_json)?;
    let raw_components: Vec<RawComponent> = serde_json::from_str(components_json)?;
    let raw_nets: BTreeMap<String, RawNet> = serde_json::from_str(nets_json)?;

    let footprints: BTreeMap<FootprintId, Footprint> = raw_footprints
        .into_values()
        .map(|f| {
            let fp = Footprint {
                id: f.id.clone(),
                name: f.name,
                category: f.category,
                subcategory: f.subcategory,
                mount_type: parse_mount_type(&f.mount_type),
                shape: f.shape,
                width: f.width,
                height: f.height,
                pin_count: f.pin_count,
                pins: f
                    .pins
                    .into_iter()
                    .map(|p| FootprintPin {
                        num: p.num.into_string(),
                        name: p.name,
                        shape: p.shape,
                        x_ratio: p.x_ratio,
                        y_ratio: p.y_ratio,
                    })
                    .collect(),
            };
            (f.id, fp)
        })
        .collect();

    let presets: BTreeMap<String, ComponentPreset> = raw_presets
        .into_iter()
        .map(|(key, p)| {
            (
                key,
                ComponentPreset {
                    name: p.name,
                    footprint: p.footprint.or(p.footprint_id).unwrap_or_default(),
                    designator_prefix: p.designator_prefix,
                    value: p.value,
                    category: p.category,
                    subcategory: p.subcategory,
                    notes: if p.notes.is_empty() {
                        p.description
                    } else {
                        p.notes
                    },
                    pins: p.pins,
                },
            )
        })
        .collect();

    let components: Vec<Component> = raw_components
        .into_iter()
        .map(|c| Component {
            id: c.id,
            designator: c.designator,
            value: c.value,
            footprint: c.footprint,
            x: c.x,
            y: c.y,
            width: c.width,
            height: c.height,
            rotation: c.rotation,
            layer: if c.layer == "bottom" {
                Layer::Bottom
            } else {
                Layer::Top
            },
            locked: c.locked,
            show_designator: c.show_designator.unwrap_or(true),
            show_value: c.show_value.unwrap_or(false),
            notes: c.notes,
            custom_pins: c.custom_pins,
            preset: c.preset,
            pin_count: c.pin_count,
        })
        .collect();

    let nets: BTreeMap<NetId, Net> = raw_nets
        .into_values()
        .map(|n| {
            let net = Net {
                id: n.id.clone(),
                name: n.name,
                label: n.label,
                net_type: parse_net_type(&n.net_type),
                color: n.color,
                voltage: n.voltage,
                description: n.description,
                nodes: n
                    .nodes
                    .into_iter()
                    .map(|node| NetNode {
                        comp_id: node.comp_id,
                        pin: node.pin.into_string(),
                        desc: node.desc,
                    })
                    .collect(),
                verified: false,
            };
            (n.id, net)
        })
        .collect();

    let module = Module {
        id: "main".to_string(),
        name: "Основная плата".to_string(),
        width_px: meta.dimensions.width_px,
        height_px: meta.dimensions.height_px,
        board_rect: meta.dimensions.board_rect,
        images: vec![BoardImage {
            id: "top-photo".to_string(),
            path: board_image_path.to_string(),
            kind: ImageKind::Top,
            width_px: meta.dimensions.width_px,
            height_px: meta.dimensions.height_px,
            offset_x: 0.0,
            offset_y: 0.0,
            mirrored: false,
        }],
        components,
        nets,
        calibration: None,
    };

    let mut project = Project::new("Пиррс 1000 Люкс");
    project.footprints = footprints;
    project.presets = presets;
    project.modules.push(module);
    Ok(project)
}
