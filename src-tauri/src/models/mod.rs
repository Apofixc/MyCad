use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    pub id: String,
    pub name: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub format_version: u32,
    #[serde(default)]
    pub files: Vec<ProjectFileRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileRef {
    pub id: String,
    pub name: String,
    pub file_type: String, // "board" or "sch"
    pub path: String,      // "files/board_xxx.board.json"
    pub order_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardDocument {
    pub id: String,
    pub name: String,
    pub r#type: String, // "board"
    pub order_index: i32,
    pub data: BoardData,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BoardData {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub bg_top: ImageLayerGroup,
    #[serde(default)]
    pub bg_bottom: ImageLayerGroup,
    #[serde(default)]
    pub components: Vec<ComponentItem>,
    #[serde(default)]
    pub nets: Vec<NetInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImageLayerGroup {
    #[serde(default)]
    pub images: Vec<BoardImageLayer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardImageLayer {
    pub id: String,
    pub name: String,
    pub side: String, // "top" or "bottom"
    #[serde(default)]
    pub image_file: Option<String>, // relative filename in images/
    #[serde(default)]
    pub cached_url: Option<String>, // data URL or local cached path
    #[serde(default)]
    pub offset_x: f64,
    #[serde(default)]
    pub offset_y: f64,
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default = "default_true")]
    pub lock_aspect_ratio: bool,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
    #[serde(default = "default_hundred")]
    pub brightness: f64,
    #[serde(default = "default_hundred")]
    pub contrast: f64,
    #[serde(default)]
    pub invert: bool,
    #[serde(default)]
    pub grayscale: bool,
    #[serde(default = "default_blend_mode")]
    pub blend_mode: String,
    #[serde(default = "default_tint")]
    pub tint_color: String,
    #[serde(default = "default_dpi")]
    pub dpi: f64,
    #[serde(default = "default_px_per_mm")]
    pub px_per_mm: f64,
    #[serde(default)]
    pub mirrored: bool,
    #[serde(default)]
    pub flip_v: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
}

fn default_scale() -> f64 { 1.0 }
fn default_true() -> bool { true }
fn default_opacity() -> f64 { 0.85 }
fn default_hundred() -> f64 { 100.0 }
fn default_blend_mode() -> String { "normal".into() }
fn default_tint() -> String { "none".into() }
fn default_dpi() -> f64 { 600.0 }
fn default_px_per_mm() -> f64 { 23.62 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentItem {
    pub id: String,
    pub ref_des: String,           // "R1", "U2", "C5"
    pub value: Option<String>,     // "10k", "STM32F103"
    pub comp_type: String,         // "resistor", "ic", "soic8"
    pub layer: String,             // "top" or "bottom"
    pub x: f64,                    // mm on board
    pub y: f64,
    #[serde(default)]
    pub rotation: f64,             // 0, 90, 180, 270
    pub device_id: Option<String>,
    pub package_id: Option<String>,
    pub package_family: Option<String>,
    #[serde(default = "default_rect")]
    pub body_shape: String,        // "rect", "circle", "d_shape"
    #[serde(default = "default_body_dim")]
    pub body_width: f64,
    #[serde(default = "default_body_dim")]
    pub body_height: f64,
    pub body_color: Option<String>,
    #[serde(default)]
    pub has_polarity_mark: bool,
    #[serde(default)]
    pub pins: Vec<PinItem>,
}

fn default_rect() -> String { "rect".into() }
fn default_body_dim() -> f64 { 2.0 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinItem {
    pub id: String,
    pub pin_number: i32,
    pub name: Option<String>,        // "1", "VCC", "GND"
    pub rel_x: f64,                  // offset from body center in mm
    pub rel_y: f64,
    #[serde(default = "default_rect")]
    pub shape: String,               // "rect", "circle", "round_rect"
    pub width: f64,
    pub height: f64,
    pub drill_diameter: Option<f64>, // for THT / vias
    pub net_id: Option<String>,      // "GND", "VCC_3V3"
    pub electrical_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetInfo {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub pin_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub component_count: usize,
    pub last_opened: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryDevice {
    pub id: String,
    pub name: String,
    pub category_id: String,
    pub prefix: String,
    pub value: Option<String>,
    pub description: Option<String>,
    pub package_id: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageTemplate {
    pub id: String,
    pub name: String,
    pub family: String, // "DIP", "SOIC", "QFP", "BGA", "CHIP_SMD"
    pub pin_count: usize,
    pub body_width: f64,
    pub body_height: f64,
    pub pins: Vec<PinTemplate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinTemplate {
    pub number: i32,
    pub name: String,
    pub rel_x: f64,
    pub rel_y: f64,
    pub width: f64,
    pub height: f64,
    pub shape: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossProbingResult {
    pub net_id: String,
    pub net_name: String,
    pub pins: Vec<CrossProbingPin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossProbingPin {
    pub component_id: String,
    pub ref_des: String,
    pub pin_number: i32,
    pub pin_name: Option<String>,
    pub layer: String,
    pub abs_x: f64,
    pub abs_y: f64,
}
