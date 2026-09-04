pub mod import;
pub mod library;
pub mod model;

pub use import::{import_reference_project, ImportError};
pub use model::*;

#[cfg(test)]
mod tests {
    use super::*;

    const BOARD_META: &str = r#"{"dimensions": {"widthPx": 1000.0, "heightPx": 800.0, "boardRect": {"x": 0.0, "y": 0.0, "width": 1000.0, "height": 800.0}}}"#;
    const FOOTPRINTS: &str = r#"{"FP1": {"id": "FP1", "name": "SOIC8", "category": "ic", "mountType": "smd", "shape": "soic", "width": 4.0, "height": 5.0, "pinCount": 2, "pins": []}}"#;
    const PRESETS: &str = r#"{"PRE1": {"id": "PRE1", "name": "Pres", "category": "ic", "footprint": "FP1", "designatorPrefix": "U", "value": "10k", "pinCount": 2, "pins": {}}}"#;
    const COMPONENTS: &str = r#"[{"id": "C1", "designator": "U1", "footprint": "FP1", "x": 10.0, "y": 10.0, "width": 4.0, "height": 5.0, "value": "10k"}]"#;
    const NETS: &str = r#"{"NET_GND": {"id": "NET_GND", "name": "GND", "type": "ground", "voltage": 0.0, "nodes": [{"compId": "C1", "pin": "1"}]}}"#;

    fn sample_project() -> Project {
        import_reference_project(
            BOARD_META,
            FOOTPRINTS,
            PRESETS,
            COMPONENTS,
            NETS,
            "pcb_board.png",
        )
        .expect("import failed")
    }

    #[test]
    fn imports_sample_counts() {
        let p = sample_project();
        assert_eq!(p.footprints.len(), 1);
        assert_eq!(p.presets.len(), 1);
        assert_eq!(p.modules.len(), 1);
        let m = &p.modules[0];
        assert_eq!(m.components.len(), 1);
        assert_eq!(m.nets.len(), 1);
        assert_eq!(m.width_px, 1000.0);
        assert_eq!(m.height_px, 800.0);
    }

    #[test]
    fn net_nodes_reference_existing_components_and_pins_are_strings() {
        let p = sample_project();
        let m = &p.modules[0];
        let comp_ids: std::collections::BTreeSet<&str> =
            m.components.iter().map(|c| c.id.as_str()).collect();
        let mut dangling = std::collections::BTreeSet::new();
        for net in m.nets.values() {
            assert!(!net.nodes.is_empty(), "цепь {} без узлов", net.id);
            for node in &net.nodes {
                if !comp_ids.contains(node.comp_id.as_str()) {
                    dangling.insert(node.comp_id.clone());
                }
                assert!(!node.pin.is_empty());
            }
        }
        assert!(dangling.is_empty());
    }

    #[test]
    fn components_reference_existing_footprints() {
        let p = sample_project();
        for c in &p.modules[0].components {
            assert!(
                p.footprints.contains_key(&c.footprint),
                "компонент {} ссылается на несуществующий корпус {}",
                c.id,
                c.footprint
            );
        }
    }

    #[test]
    fn ground_net_typed_and_gnd_present() {
        let p = sample_project();
        let net = p.modules[0].nets.get("NET_GND").expect("NET_GND");
        assert_eq!(net.net_type, NetType::Ground);
        assert_eq!(net.voltage, Some(0.0));
    }

    #[test]
    fn project_roundtrips_via_json() {
        let p = sample_project();
        let json = serde_json::to_string(&p).unwrap();
        let p2: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(
            p2.modules[0].components.len(),
            p.modules[0].components.len()
        );
        assert_eq!(p2.footprints.len(), p.footprints.len());
    }

    #[test]
    fn library_models_validation_and_storage() {
        use crate::library::*;
        use std::collections::BTreeMap;

        let pkg = PackageDefinition {
            id: "PKG_SOIC_8".to_string(),
            name: "SOIC-8".to_string(),
            standard: Some("IPC-7351".to_string()),
            family: PackageFamily::Soic,
            mount_type: MountType::Smd,
            body_width: 3.9,
            body_height: 4.9,
            pitch: 1.27,
            pads: vec![
                PackagePad {
                    pad_num: 1,
                    name: Some("1".to_string()),
                    x: -2.7,
                    y: -1.905,
                    width: 1.5,
                    height: 0.6,
                    shape: PadShape::Rect,
                    drill_diameter: None,
                    round_radius: None,
                },
                PackagePad {
                    pad_num: 2,
                    name: Some("2".to_string()),
                    x: -2.7,
                    y: -0.635,
                    width: 1.5,
                    height: 0.6,
                    shape: PadShape::Rect,
                    drill_diameter: None,
                    round_radius: None,
                },
            ],
            constraints: PackageConstraints {
                courtyard_width: 6.0,
                courtyard_height: 5.5,
                max_height: 1.75,
                has_thermal_pad: None,
                thermal_pad_num: None,
                thermal_resistance_junction_case: None,
                thermal_resistance_junction_air: None,
            },
            default_variant_id: "standard".to_string(),
            variants: vec![PackageVariant {
                id: "standard".to_string(),
                name: "Стандартный".to_string(),
                body_color: "#181f2c".to_string(),
                body_border_color: None,
                key_type: PackageKeyType::Dot,
                key_color: None,
                has_polarity_mark: None,
                polarity_color: None,
                silkscreen_color: None,
                orientation: None,
            }],
            model3d: None,
        };

        assert!(validate_package(&pkg).is_ok());

        let mut pin_map = BTreeMap::new();
        pin_map.insert("1".to_string(), 1);
        pin_map.insert("2".to_string(), 2);

        let dev = DeviceDefinition {
            id: "DEV_DUAL_OPAMP".to_string(),
            name: "LM358".to_string(),
            category: "ics".to_string(),
            subcategory: "opamps".to_string(),
            designator_prefix: "DA".to_string(),
            description: "Сдвоенный ОУ".to_string(),
            datasheet: None,
            tags: vec!["opamp".to_string(), "analog".to_string()],
            parameters: ElectricalParameters::default(),
            logical_pins: vec![
                LogicalPin {
                    id: "1".to_string(),
                    name: "OUT1".to_string(),
                    electrical_type: PinElectricalType::Output,
                    unit: Some("Unit A".to_string()),
                    description: None,
                },
                LogicalPin {
                    id: "2".to_string(),
                    name: "IN1-".to_string(),
                    electrical_type: PinElectricalType::Input,
                    unit: Some("Unit A".to_string()),
                    description: None,
                },
            ],
            supported_packages: vec![PackageMapping {
                package_id: "PKG_SOIC_8".to_string(),
                default_variant_id: None,
                pin_map,
            }],
        };

        let lookup = |id: &str| if id == "PKG_SOIC_8" { Some(pkg.clone()) } else { None };
        assert!(validate_device(&dev, Some(&lookup)).is_ok());

        // Проверка поиска и фильтрации
        let temp_dir = std::env::temp_dir().join(format!("mycad_test_lib_{}", std::process::id()));
        let mut svc = LibraryService::new(&temp_dir);
        svc.init_storage().unwrap();
        svc.save_package(pkg.clone()).unwrap();
        svc.save_device(dev.clone()).unwrap();

        assert_eq!(svc.list_packages().len(), 1);
        assert_eq!(svc.list_devices().len(), 1);
        assert_eq!(svc.search_devices("lm358", None, None, None).len(), 1);
        assert_eq!(svc.search_devices("unknown", None, None, None).len(), 0);

        // Очистка временной директории
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
