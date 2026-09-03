pub mod import;
pub mod model;

pub use import::{import_reference_project, ImportError};
pub use model::*;

#[cfg(test)]
mod tests {
    use super::*;

    const BOARD_META: &str = include_str!("../../../../reference/boardMeta.json");
    const FOOTPRINTS: &str = include_str!("../../../../reference/footprints.json");
    const PRESETS: &str = include_str!("../../../../reference/presets.json");
    const COMPONENTS: &str = include_str!("../../../../reference/components.json");
    const NETS: &str = include_str!("../../../../reference/nets.json");

    fn reference_project() -> Project {
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
    fn imports_reference_counts() {
        let p = reference_project();
        assert_eq!(p.footprints.len(), 55);
        assert_eq!(p.presets.len(), 36);
        assert_eq!(p.modules.len(), 1);
        let m = &p.modules[0];
        assert_eq!(m.components.len(), 146);
        assert_eq!(m.nets.len(), 42);
        assert_eq!(m.width_px, 9955.0);
        assert_eq!(m.height_px, 3766.0);
    }

    #[test]
    fn net_nodes_reference_existing_components_and_pins_are_strings() {
        let p = reference_project();
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
        // Известный дефект референс-данных: NET_GND ссылается на крепёжное
        // отверстие H2, которого нет в INITIAL_COMPONENTS.
        assert_eq!(
            dangling.into_iter().collect::<Vec<_>>(),
            vec!["H2".to_string()]
        );
    }

    #[test]
    fn components_reference_existing_footprints() {
        let p = reference_project();
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
        let p = reference_project();
        let net = p.modules[0].nets.get("NET_GND").expect("NET_GND");
        assert_eq!(net.net_type, NetType::Ground);
        assert_eq!(net.voltage, Some(0.0));
    }

    #[test]
    fn project_roundtrips_via_json() {
        let p = reference_project();
        let json = serde_json::to_string(&p).unwrap();
        let p2: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(
            p2.modules[0].components.len(),
            p.modules[0].components.len()
        );
        assert_eq!(p2.footprints.len(), p.footprints.len());
    }
}
