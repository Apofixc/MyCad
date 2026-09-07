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
pub struct ProjectFullState {
    pub manifest: ProjectManifest,
    pub boards: Vec<BoardDocument>,
    pub schematics: Vec<SchematicDocument>,
    pub active_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileRef {
    pub id: String,
    pub name: String,
    pub file_type: String, // "board"
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicDocument {
    pub id: String,
    pub name: String,
    pub r#type: String, // "schematic"
    pub order_index: i32,
    pub data: SchematicData,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SchematicData {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub components: Vec<serde_json::Value>,
    #[serde(default)]
    pub nets: Vec<serde_json::Value>,
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
pub struct RecentProject {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub last_opened: String,
    pub created_at: String,
}
