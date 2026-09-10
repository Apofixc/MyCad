// src-tauri/src/cad/footprint.rs
// Модели данных посадочных мест (Footprint / Package), контактных площадок и векторной графики

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MountType {
    Smd,
    Tht,
    Mixed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PadShape {
    Rect,
    RoundedRect,
    Circle,
    Oval,
    DShape,
    ChamferedRect,
    CustomPolygon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DrillShape {
    Round,
    Slot,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphicLayer {
    TopSilk,
    BottomSilk,
    TopFab,
    BottomFab,
    TopCourtyard,
    BottomCourtyard,
}

/// Физическая контактная площадка (Pad) на печатной плате
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackagePad {
    /// Номер или буквенно-цифровой индекс вывода ("1", "2", "A1", "EP", "MH1")
    #[serde(deserialize_with = "deserialize_pad_num")]
    pub pad_num: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub rotation: f64,
    pub shape: PadShape,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drill_diameter: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drill_shape: Option<DrillShape>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slot_length: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub round_radius: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plated: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polygon_points: Option<Vec<[f64; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chamfer_corners: Option<Vec<u8>>,
}

/// Элементы векторной графики корпуса (шелкография, сборочный чертеж, зоны отчуждения)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum GraphicItem {
    Line {
        id: String,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        stroke_width: f64,
        layer: GraphicLayer,
    },
    Arc {
        id: String,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        stroke_width: f64,
        layer: GraphicLayer,
    },
    DShape {
        id: String,
        cx: f64,
        cy: f64,
        diameter: f64,
        cut_depth: f64,
        cut_orientation: String, // "top" | "bottom" | "left" | "right"
        stroke_width: f64,
        layer: GraphicLayer,
    },
    Capsule {
        id: String,
        cx: f64,
        cy: f64,
        width: f64,
        height: f64,
        rotation: f64,
        stroke_width: f64,
        layer: GraphicLayer,
    },
    Rect {
        id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        #[serde(default)]
        round_radius: f64,
        #[serde(default)]
        rotation: f64,
        stroke_width: f64,
        layer: GraphicLayer,
        #[serde(default)]
        filled: bool,
    },
    Circle {
        id: String,
        cx: f64,
        cy: f64,
        radius: f64,
        stroke_width: f64,
        layer: GraphicLayer,
        #[serde(default)]
        filled: bool,
    },
    Polygon {
        id: String,
        points: Vec<[f64; 2]>,
        stroke_width: f64,
        layer: GraphicLayer,
        #[serde(default)]
        filled: bool,
    },
    Text {
        id: String,
        text: String,
        x: f64,
        y: f64,
        font_size: f64,
        #[serde(default)]
        rotation: f64,
        stroke_width: f64,
        layer: GraphicLayer,
        #[serde(default = "default_text_align")]
        align: String, // "center" | "left" | "right"
    },
}

fn default_text_align() -> String {
    "center".to_string()
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

/// Графический вариант исполнения корпуса
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
    pub silkscreen_color: Option<String>,
    #[serde(default)]
    pub graphics: Vec<GraphicItem>,
}

/// Технологические и тепловые ограничения
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageConstraints {
    pub courtyard_width: f64,
    pub courtyard_height: f64,
    pub max_height: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_thermal_pad: Option<bool>,
    #[serde(default, deserialize_with = "deserialize_optional_pad_num", skip_serializing_if = "Option::is_none")]
    pub thermal_pad_num: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub solder_mask_margin: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paste_mask_margin: Option<f64>,
}

/// Привязка 3D-модели
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Package3DModel {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<[f64; 3]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rotation: Option<[f64; 3]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale: Option<[f64; 3]>,
}

/// Полная спецификация физического посадочного места
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageDefinition {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub standard: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    pub mount_type: MountType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_shape: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub d_shape_cut: Option<String>,
    pub body_width: f64,
    pub body_height: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pitch: Option<f64>,
    pub pads: Vec<PackagePad>,
    #[serde(default)]
    pub graphics: Vec<GraphicItem>,
    #[serde(default)]
    pub constraints: PackageConstraints,
    #[serde(default)]
    pub default_variant_id: String,
    #[serde(default)]
    pub variants: Vec<PackageVariant>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model3d: Option<Package3DModel>,
}

pub fn deserialize_pad_num<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct PadNumVisitor;
    impl<'de> serde::de::Visitor<'de> for PadNumVisitor {
        type Value = String;
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string or an integer pad number")
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(v.to_string())
        }
        fn visit_string<E>(self, v: String) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(v)
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(v.to_string())
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(v.to_string())
        }
    }
    deserializer.deserialize_any(PadNumVisitor)
}

pub fn deserialize_optional_pad_num<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct OptionalPadNumVisitor;
    impl<'de> serde::de::Visitor<'de> for OptionalPadNumVisitor {
        type Value = Option<String>;
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string, an integer or null")
        }
        fn visit_none<E>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
        fn visit_unit<E>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
        fn visit_some<D2>(self, deserializer: D2) -> Result<Self::Value, D2::Error>
        where
            D2: serde::Deserializer<'de>,
        {
            deserializer.deserialize_any(self)
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_string<E>(self, v: String) -> Result<Self::Value, E> {
            Ok(Some(v))
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
    }
    deserializer.deserialize_any(OptionalPadNumVisitor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_d_shape_package_and_polymorphic_pads() {
        let json_data = r##"{
            "id": "to-92-custom",
            "name": "TO-92 (D-Shape)",
            "mountType": "tht",
            "bodyWidth": 4.5,
            "bodyHeight": 4.8,
            "pads": [
                {
                    "padNum": 1,
                    "x": -2.54,
                    "y": 0.0,
                    "width": 1.5,
                    "height": 1.5,
                    "shape": "d_shape",
                    "drillDiameter": 0.8
                },
                {
                    "padNum": "2",
                    "x": 0.0,
                    "y": 0.0,
                    "width": 1.5,
                    "height": 1.5,
                    "shape": "circle",
                    "drillDiameter": 0.8
                },
                {
                    "padNum": "EP",
                    "x": 2.54,
                    "y": 0.0,
                    "width": 1.5,
                    "height": 1.5,
                    "shape": "rounded_rect",
                    "drillDiameter": 0.8
                }
            ],
            "graphics": [
                {
                    "kind": "d_shape",
                    "id": "d_body_1",
                    "cx": 0.0,
                    "cy": 0.0,
                    "diameter": 4.8,
                    "cutDepth": 1.2,
                    "cutOrientation": "bottom",
                    "strokeWidth": 0.2,
                    "layer": "top_silk"
                }
            ],
            "variants": [
                {
                    "id": "var_gost",
                    "name": "ГОСТ Обозначение",
                    "bodyColor": "#1e293b",
                    "keyType": "notch",
                    "graphics": []
                }
            ]
        }"##;

        let pkg: PackageDefinition = serde_json::from_str(json_data).expect("Should deserialize D-shape package");
        assert_eq!(pkg.id, "to-92-custom");
        assert_eq!(pkg.pads.len(), 3);
        assert_eq!(pkg.pads[0].pad_num, "1"); // parsed from integer 1
        assert_eq!(pkg.pads[1].pad_num, "2"); // parsed from string "2"
        assert_eq!(pkg.pads[2].pad_num, "EP"); // alphanumeric "EP"
        assert_eq!(pkg.pads[0].shape, PadShape::DShape);

        if let GraphicItem::DShape { diameter, cut_depth, .. } = &pkg.graphics[0] {
            assert_eq!(*diameter, 4.8);
            assert_eq!(*cut_depth, 1.2);
        } else {
            panic!("Expected DShape graphic item");
        }

        assert_eq!(pkg.variants.len(), 1);
        assert_eq!(pkg.variants[0].key_type, PackageKeyType::Notch);
    }
}
