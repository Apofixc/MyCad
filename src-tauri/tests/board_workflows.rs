use mycad_lib::library::model::{ComponentLibraryPayload, DeviceDefinition, PlacedComponent};
use mycad_lib::library::storage::{validate_device, validate_package, LibraryService};
use mycad_lib::models::BoardImageLayer;
use mycad_lib::project::archive::{
    create_default_project, open_project_archive, save_project_archive,
};
use serde_json::json;
use std::fs;
use uuid::Uuid;

fn layer(id: &str, side: &str) -> BoardImageLayer {
    serde_json::from_value(json!({"id": id, "name": id, "side": side})).unwrap()
}

fn library() -> ComponentLibraryPayload {
    serde_json::from_str(include_str!("../src/library/default_library.json")).unwrap()
}

#[test]
fn background_moves_stay_with_their_document_and_survive_archive_roundtrip() {
    let dir = std::env::temp_dir().join(format!("mycad-test-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("test.mycad");
    let mut project = create_default_project(&path, "Regression", None, None).unwrap();
    let (a, _) = project.add_board(Some("A"));
    let (b, _) = project.add_board(Some("B"));
    let (sch, _) = project.add_schematic(Some("Schematic"));
    project
        .update_image_layers(&[layer("scan-a", "top")], Some(&a.id))
        .unwrap();
    project
        .update_image_layers(&[layer("scan-b", "top")], Some(&b.id))
        .unwrap();
    project
        .update_image_layers(&[layer("scan-s", "top")], Some(&sch.id))
        .unwrap();

    let mut moved = layer("scan-a", "bottom");
    moved.scale = 1.5;
    moved.rotation = 12.0;
    moved.offset_x = 42.0;
    project.update_image_layers(&[moved], Some(&b.id)).unwrap();
    assert!(project.boards[0].data.bg_top.images.is_empty());
    assert_eq!(project.boards[0].data.bg_bottom.images.len(), 1);
    assert_eq!(project.boards[1].data.bg_top.images[0].id, "scan-b");
    assert!(project.boards[1].data.bg_bottom.images.is_empty());
    assert_eq!(project.schematics[0].data.bg.images[0].id, "scan-s");

    fs::create_dir_all(project.temp_image_dir.join("images")).unwrap();
    let image_bytes = b"image asset roundtrip";
    fs::write(project.temp_image_dir.join("images/scan.png"), image_bytes).unwrap();
    project.boards[0].data.bg_bottom.images[0].image_file = Some("scan.png".into());
    let component: PlacedComponent = serde_json::from_value(json!({
        "id": "r1", "refDes": "R1", "packageId": "resistor",
        "x": 12.5, "y": 25.0, "rotation": 90.0, "layer": "bottom",
        "name": "Resistor", "package": "0603", "visible": false,
        "showRefDes": false, "showValue": false, "refDesOffset": [1.5, -2.0],
        "mirrored": true, "locked": true, "value": "10k",
        "selectedVariantId": "black", "parameters": {"tolerance": "1%"}
    }))
    .unwrap();
    project.boards[0].data.components.push(component.clone());
    save_project_archive(&project).unwrap();
    let reopened = open_project_archive(&path).unwrap();
    let image = &reopened.boards[0].data.bg_bottom.images[0];
    assert_eq!(
        (image.scale, image.rotation, image.offset_x),
        (1.5, 12.0, 42.0)
    );
    assert_eq!(reopened.boards[0].data.components[0], component);
    let saved_component = serde_json::to_value(&reopened.boards[0].data.components[0]).unwrap();
    for field in ["visible", "showRefDes", "showValue"] {
        assert_eq!(saved_component[field], false, "{field}");
    }
    assert_eq!(saved_component["name"], "Resistor");
    assert_eq!(saved_component["package"], "0603");
    assert_eq!(saved_component["refDesOffset"], json!([1.5, -2.0]));
    assert_eq!(
        fs::read(reopened.temp_image_dir.join("images/scan.png")).unwrap(),
        image_bytes
    );
    fs::remove_dir_all(&project.temp_image_dir).unwrap();
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn invalid_image_batch_does_not_partially_modify_project() {
    let dir = std::env::temp_dir().join(format!("mycad-test-{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    let mut project = create_default_project(&dir.join("test.mycad"), "Test", None, None).unwrap();
    let (board, _) = project.add_board(None);
    let mut invalid = layer("invalid", "top");
    invalid.scale = 0.0;
    assert!(project
        .update_image_layers(&[layer("valid", "top"), invalid], Some(&board.id))
        .is_err());
    assert!(project.boards[0].data.bg_top.images.is_empty());
    assert!(project
        .update_image_layers(&[layer("new", "top")], Some("missing"))
        .is_err());
    fs::remove_dir_all(project.temp_image_dir).unwrap();
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn legacy_component_without_display_preferences_still_loads() {
    let component: PlacedComponent = serde_json::from_value(json!({
        "id": "c1", "refDes": "C1", "packageId": "capacitor",
        "x": 0.0, "y": 0.0, "rotation": 0.0, "layer": "top"
    }))
    .unwrap();
    assert_eq!(component.visible, None);
    assert_eq!(component.show_ref_des, None);
    assert_eq!(component.show_value, None);
}

#[test]
fn invalid_pad_and_variant_definitions_are_rejected() {
    let mut pkg = library()
        .packages
        .into_iter()
        .find(|p| !p.pads.is_empty())
        .unwrap();
    pkg.pads.push(pkg.pads[0].clone());
    assert!(validate_package(&pkg).is_err());
    pkg.pads.pop();
    pkg.default_variant_id = "missing".into();
    assert!(validate_package(&pkg).is_err());
    pkg.default_variant_id.clear();
    pkg.body_width = f64::NAN;
    assert!(validate_package(&pkg).is_err());
}

#[test]
fn library_saves_packages_before_mapping_devices_and_rejects_invalid_links() {
    let dir = std::env::temp_dir().join(format!("mycad-library-test-{}", Uuid::new_v4()));
    let mut service = LibraryService::new(&dir);
    let pkg = library()
        .packages
        .into_iter()
        .find(|p| !p.pads.is_empty())
        .unwrap();
    let mut device: DeviceDefinition = serde_json::from_value(json!({
        "id": "test_device", "name": "Test", "category": "Test", "designatorPrefix": "U",
        "logicalPins": [{"id": "pin1", "name": "VCC", "electricalType": "power_in"}],
        "supportedPackages": [{"packageId": pkg.id, "pinMap": {"VCC": pkg.pads[0].pad_num}}]
    }))
    .unwrap();
    assert!(service.save_device(device.clone()).is_err());
    service.save_package(pkg.clone()).unwrap();
    service.save_device(device.clone()).unwrap();
    let mut reopened = LibraryService::new(&dir);
    reopened.load_all().unwrap();
    assert_eq!(reopened.get_device(&device.id).unwrap(), device);

    device.supported_packages[0]
        .pin_map
        .insert("VCC".into(), "missing".into());
    assert!(service.save_device(device.clone()).is_err());
    assert_ne!(service.get_device(&device.id).unwrap(), device);
    device.supported_packages[0].pin_map.clear();
    device.logical_pins.push(device.logical_pins[0].clone());
    assert!(service.save_device(device).is_err());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn bundled_library_remains_valid() {
    let payload = library();
    for pkg in &payload.packages {
        validate_package(pkg).unwrap_or_else(|err| panic!("{}: {err}", pkg.id));
    }
    let lookup = |id: &str| payload.packages.iter().find(|pkg| pkg.id == id).cloned();
    for device in &payload.devices {
        validate_device(device, Some(&lookup)).unwrap_or_else(|err| panic!("{}: {err}", device.id));
    }
}
