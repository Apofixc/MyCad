use mycad_lib::cad::footprint::PackageDefinition;
use mycad_lib::library::model::DeviceDefinition;
use mycad_lib::library::storage::{validate_device, validate_package, LibraryService};
use serde_json::json;
use std::fs;
use uuid::Uuid;

fn package() -> PackageDefinition {
    serde_json::from_value(json!({
        "id": "custom", "name": "Custom", "mountType": "mixed",
        "bodyWidth": 4, "bodyHeight": 2,
        "pads": [
            {"padNum": "A1", "x": 0, "y": 0, "width": 2, "height": 1, "rotation": 45,
             "shape": "custom_polygon", "polygonPoints": [[-1,-0.5], [1,-0.5], [0,0.5]],
             "drillDiameter": 0.4, "drillShape": "slot", "slotLength": 1.2, "plated": false},
            {"padNum": "EP", "x": 3, "y": 0, "width": 1, "height": 1, "shape": "circle"}
        ],
        "graphics": [
            {"id": "arc", "kind": "arc", "cx": 0, "cy": 0, "radius": 2, "startAngle": 350,
             "endAngle": 10, "strokeWidth": 0.1, "layer": "top_silk"},
            {"id": "poly", "kind": "polygon", "points": [[0,0],[4,0],[3,2]],
             "strokeWidth": 0.1, "layer": "top_fab", "filled": true},
            {"id": "text", "kind": "text", "x": 0, "y": 0, "text": "Pin 1",
             "fontSize": 0.5, "rotation": 90, "strokeWidth": 0.1, "layer": "top_silk"}
        ],
        "variants": [], "defaultVariantId": "",
        "constraints": {"courtyardWidth": 5, "courtyardHeight": 3, "maxHeight": 2}
    }))
    .unwrap()
}

#[test]
fn arbitrary_geometry_and_multi_pad_mapping_survive_library_roundtrip() {
    let dir = std::env::temp_dir().join(format!("mycad-footprint-{}", Uuid::new_v4()));
    let mut service = LibraryService::new(&dir);
    let pkg = package();
    service.save_package(pkg.clone()).unwrap();
    let device: DeviceDefinition = serde_json::from_value(json!({
        "id": "part", "name": "Part", "category": "Test", "designatorPrefix": "U",
        "logicalPins": [{"id": "ground", "name": "GND", "electricalType": "ground"}],
        "supportedPackages": [{"packageId": pkg.id, "pinMap": {"ground": "A1"},
            "multiPinMap": {"ground": ["A1", "EP"]}}]
    }))
    .unwrap();
    service.save_device(device.clone()).unwrap();
    let mut reopened = LibraryService::new(&dir);
    reopened.load_all().unwrap();
    assert_eq!(reopened.get_package(&pkg.id).unwrap(), pkg);
    assert_eq!(reopened.get_device(&device.id).unwrap(), device);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn invalid_polygon_slot_and_variant_graphics_are_rejected() {
    let mut pkg = package();
    validate_package(&pkg).unwrap();
    pkg.pads[0].polygon_points = Some(vec![[0.0, 0.0]]);
    assert!(validate_package(&pkg).is_err());
    pkg = package();
    pkg.pads[0].slot_length = Some(0.1);
    assert!(validate_package(&pkg).is_err());
    let mut data = serde_json::to_value(package()).unwrap();
    data["graphics"][0]["radius"] = json!(-1);
    assert!(validate_package(&serde_json::from_value(data).unwrap()).is_err());
}

#[test]
fn different_logical_ids_cannot_share_a_pad_even_through_multi_mapping() {
    let pkg = package();
    let mut device: DeviceDefinition = serde_json::from_value(json!({
        "id": "part", "name": "Part", "category": "Test", "designatorPrefix": "U",
        "logicalPins": [
            {"id": "one", "name": "GND", "electricalType": "ground"},
            {"id": "two", "name": "GND", "electricalType": "ground"}
        ],
        "supportedPackages": [{"packageId": pkg.id, "pinMap": {"one": "A1", "two": "EP"},
            "multiPinMap": {"two": ["A1", "EP"]}}]
    }))
    .unwrap();
    let lookup = |_: &str| Some(pkg.clone());
    assert!(validate_device(&device, Some(&lookup)).is_err());
    device.supported_packages[0].multi_pin_map.clear();
    validate_device(&device, Some(&lookup)).unwrap();
}
