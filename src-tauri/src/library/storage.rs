// src-tauri/src/library/storage.rs
// Сервис постоянного хранения и управления библиотекой компонентов и посадочных мест

use crate::cad::footprint::{DrillShape, GraphicItem, PackageDefinition, PadShape};
use crate::library::model::{CatalogCategory, ComponentLibraryPayload, DeviceDefinition};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_LIBRARY_JSON: &str = include_str!("default_library.json");

#[derive(Debug, Clone)]
pub struct LibraryService {
    base_dir: PathBuf,
    categories: Vec<CatalogCategory>,
    packages: BTreeMap<String, PackageDefinition>,
    devices: BTreeMap<String, DeviceDefinition>,
    is_loaded: bool,
}

fn sanitize_id(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn validate_package(pkg: &PackageDefinition) -> Result<(), String> {
    if pkg.id.trim().is_empty() {
        return Err("ID посадочного места не может быть пустым".to_string());
    }
    if pkg.name.trim().is_empty() {
        return Err("Название посадочного места не может быть пустым".to_string());
    }
    if !pkg.body_width.is_finite()
        || !pkg.body_height.is_finite()
        || pkg.body_width <= 0.0
        || pkg.body_height <= 0.0
    {
        return Err("Габариты корпуса (ширина и высота) должны быть больше 0".to_string());
    }
    let mut pad_numbers = HashSet::new();
    for pad in &pkg.pads {
        if pad.pad_num.trim().is_empty() {
            return Err("Номер контактной площадки не может быть пустым".to_string());
        }
        if !pad_numbers.insert(&pad.pad_num) {
            return Err(format!("Номер площадки #{} повторяется", pad.pad_num));
        }
        if !pad.width.is_finite()
            || !pad.height.is_finite()
            || pad.width <= 0.0
            || pad.height <= 0.0
        {
            return Err(format!(
                "Размеры площадки #{} должны быть больше 0",
                pad.pad_num
            ));
        }
        if !pad.x.is_finite() || !pad.y.is_finite() || !pad.rotation.is_finite() {
            return Err(format!("Некорректное положение площадки #{}", pad.pad_num));
        }
        if pad
            .drill_diameter
            .is_some_and(|d| !d.is_finite() || d < 0.0)
            || pad.round_radius.is_some_and(|r| !r.is_finite() || r < 0.0)
            || (pad.drill_shape == Some(DrillShape::Slot)
                && !pad.slot_length.is_some_and(|length| {
                    length.is_finite() && length >= pad.drill_diameter.unwrap_or(0.0)
                }))
        {
            return Err(format!(
                "Некорректное отверстие или скругление площадки #{}",
                pad.pad_num
            ));
        }
        if pad.shape == PadShape::CustomPolygon
            && !pad.polygon_points.as_ref().is_some_and(|points| {
                points.len() >= 3 && points.iter().flatten().all(|value| value.is_finite())
            })
        {
            return Err(format!("Некорректный полигон площадки #{}", pad.pad_num));
        }
    }
    validate_graphics(&pkg.graphics)?;
    let mut variant_ids = HashSet::new();
    for variant in &pkg.variants {
        validate_graphics(&variant.graphics)?;
        if variant.id.trim().is_empty() || !variant_ids.insert(&variant.id) {
            return Err("ID вариантов корпуса должны быть непустыми и уникальными".into());
        }
    }
    if !pkg.default_variant_id.is_empty() && !variant_ids.contains(&pkg.default_variant_id) {
        return Err("Вариант корпуса по умолчанию не найден".into());
    }
    Ok(())
}

fn validate_graphics(graphics: &[GraphicItem]) -> Result<(), String> {
    let finite = |values: &[f64]| values.iter().all(|value| value.is_finite());
    for graphic in graphics {
        let valid = match graphic {
            GraphicItem::Line {
                x1,
                y1,
                x2,
                y2,
                stroke_width,
                ..
            } => finite(&[*x1, *y1, *x2, *y2, *stroke_width]) && *stroke_width > 0.0,
            GraphicItem::Arc {
                cx,
                cy,
                radius,
                start_angle,
                end_angle,
                stroke_width,
                ..
            } => {
                finite(&[*cx, *cy, *radius, *start_angle, *end_angle, *stroke_width])
                    && *radius > 0.0
                    && *stroke_width > 0.0
            }
            GraphicItem::Circle {
                cx,
                cy,
                radius,
                stroke_width,
                ..
            } => {
                finite(&[*cx, *cy, *radius, *stroke_width]) && *radius > 0.0 && *stroke_width > 0.0
            }
            GraphicItem::DShape {
                cx,
                cy,
                diameter,
                cut_depth,
                cut_orientation,
                stroke_width,
                ..
            } => {
                finite(&[*cx, *cy, *diameter, *cut_depth, *stroke_width])
                    && *diameter > 0.0
                    && *cut_depth >= 0.0
                    && *cut_depth < *diameter
                    && *stroke_width > 0.0
                    && matches!(
                        cut_orientation.as_str(),
                        "top" | "bottom" | "left" | "right"
                    )
            }
            GraphicItem::Capsule {
                cx,
                cy,
                width,
                height,
                rotation,
                stroke_width,
                ..
            } => {
                finite(&[*cx, *cy, *width, *height, *rotation, *stroke_width])
                    && *width > 0.0
                    && *height > 0.0
                    && *stroke_width > 0.0
            }
            GraphicItem::Rect {
                x,
                y,
                width,
                height,
                round_radius,
                rotation,
                stroke_width,
                ..
            } => {
                finite(&[
                    *x,
                    *y,
                    *width,
                    *height,
                    *round_radius,
                    *rotation,
                    *stroke_width,
                ]) && *width > 0.0
                    && *height > 0.0
                    && *round_radius >= 0.0
                    && *stroke_width > 0.0
            }
            GraphicItem::Polygon {
                points,
                stroke_width,
                ..
            } => {
                points.len() >= 3
                    && points.iter().flatten().all(|value| value.is_finite())
                    && stroke_width.is_finite()
                    && *stroke_width > 0.0
            }
            GraphicItem::Text {
                x,
                y,
                font_size,
                rotation,
                stroke_width,
                ..
            } => {
                finite(&[*x, *y, *font_size, *rotation, *stroke_width])
                    && *font_size > 0.0
                    && *stroke_width > 0.0
            }
        };
        if !valid {
            return Err("Некорректная геометрия контура корпуса".into());
        }
    }
    Ok(())
}

pub fn validate_device(
    dev: &DeviceDefinition,
    package_lookup: Option<&dyn Fn(&str) -> Option<PackageDefinition>>,
) -> Result<(), String> {
    if dev.id.trim().is_empty() {
        return Err("ID радиокомпонента не может быть пустым".to_string());
    }
    if dev.name.trim().is_empty() {
        return Err("Название радиокомпонента не может быть пустым".to_string());
    }
    if dev.category.trim().is_empty() {
        return Err("Категория радиокомпонента не может быть пустой".to_string());
    }
    if dev.designator_prefix.trim().is_empty() {
        return Err(
            "Префикс позиционного обозначения (напр. R, C, U) не может быть пустым".to_string(),
        );
    }

    let mut pin_ids = HashSet::new();
    for pin in &dev.logical_pins {
        if pin.id.trim().is_empty() || !pin_ids.insert(&pin.id) || pin.name.trim().is_empty() {
            return Err("У выводов должны быть имена и уникальные непустые ID".into());
        }
    }
    if let Some(lookup) = package_lookup {
        let mut package_ids = HashSet::new();
        for pkg_map in &dev.supported_packages {
            if !package_ids.insert(&pkg_map.package_id) {
                return Err("Корпус указан несколько раз".into());
            }
            let pkg = lookup(&pkg_map.package_id).ok_or_else(|| {
                format!(
                    "Связанное посадочное место '{}' не найдено в библиотеке",
                    pkg_map.package_id
                )
            })?;
            if let Some(variant_id) = &pkg_map.default_variant_id {
                if !variant_id.is_empty() && !pkg.variants.iter().any(|v| v.id == *variant_id) {
                    return Err(format!(
                        "Вариант '{variant_id}' не найден в корпусе '{}'",
                        pkg.name
                    ));
                }
            }
            let pads: HashSet<_> = pkg.pads.iter().map(|p| &p.pad_num).collect();
            let mut pad_owners = BTreeMap::new();
            for (key, pad) in pkg_map.pin_map.iter().chain(
                pkg_map
                    .multi_pin_map
                    .iter()
                    .flat_map(|(key, pads)| pads.iter().map(move |pad| (key, pad))),
            ) {
                let owner = dev
                    .logical_pins
                    .iter()
                    .find(|pin| pin.id == *key)
                    .or_else(|| dev.logical_pins.iter().find(|pin| pin.name == *key))
                    .map(|pin| pin.id.as_str())
                    .unwrap_or(key.as_str());
                if let Some(previous) = pad_owners.insert(pad, owner) {
                    if previous != owner {
                        return Err(format!("Площадка '{pad}' назначена нескольким выводам"));
                    }
                }
            }
            for (pin, pad) in &pkg_map.pin_map {
                if pin.trim().is_empty() || !pads.contains(pad) {
                    return Err(format!(
                        "Некорректная связь вывода '{pin}' с площадкой '{pad}'"
                    ));
                }
            }
            for (pin, mapped_pads) in &pkg_map.multi_pin_map {
                if pin.trim().is_empty() || mapped_pads.iter().any(|pad| !pads.contains(pad)) {
                    return Err(format!("Некорректная связь вывода '{pin}' с площадками"));
                }
            }
        }
    }
    Ok(())
}

impl LibraryService {
    pub fn new(base_dir: &Path) -> Self {
        Self {
            base_dir: base_dir.to_path_buf(),
            categories: Vec::new(),
            packages: BTreeMap::new(),
            devices: BTreeMap::new(),
            is_loaded: false,
        }
    }

    pub fn default_dir() -> PathBuf {
        dirs::data_local_dir()
            .or_else(dirs::data_dir)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("MyCad")
            .join("library")
    }

    pub fn init_storage(&self) -> Result<(), String> {
        fs::create_dir_all(&self.base_dir).map_err(|e| {
            format!(
                "Не удалось создать директорию библиотеки {}: {e}",
                self.base_dir.display()
            )
        })?;
        fs::create_dir_all(self.base_dir.join("packages"))
            .map_err(|e| format!("Не удалось создать директорию packages: {e}"))?;
        fs::create_dir_all(self.base_dir.join("devices"))
            .map_err(|e| format!("Не удалось создать директорию devices: {e}"))?;
        Ok(())
    }

    pub fn load_all(&mut self) -> Result<ComponentLibraryPayload, String> {
        self.init_storage()?;
        self.packages.clear();
        self.devices.clear();

        // 1. Загрузка категорий
        let cat_path = self.base_dir.join("categories.json");
        if cat_path.exists() {
            if let Ok(text) = fs::read_to_string(&cat_path) {
                if let Ok(cats) = serde_json::from_str::<Vec<CatalogCategory>>(&text) {
                    self.categories = cats;
                }
            }
        }

        // 2. Загрузка пакетов из диска
        let pkg_dir = self.base_dir.join("packages");
        if pkg_dir.exists() {
            if let Ok(entries) = fs::read_dir(&pkg_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                        if let Ok(text) = fs::read_to_string(&path) {
                            if let Ok(pkg) = serde_json::from_str::<PackageDefinition>(&text) {
                                self.packages.insert(pkg.id.clone(), pkg);
                            }
                        }
                    }
                }
            }
        }

        // 3. Загрузка устройств из диска
        let dev_dir = self.base_dir.join("devices");
        if dev_dir.exists() {
            if let Ok(entries) = fs::read_dir(&dev_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                        if let Ok(text) = fs::read_to_string(&path) {
                            if let Ok(dev) = serde_json::from_str::<DeviceDefinition>(&text) {
                                self.devices.insert(dev.id.clone(), dev);
                            }
                        }
                    }
                }
            }
        }

        // 4. Первоначальное наполнение из встроенной библиотеки, если хранилище новое
        match serde_json::from_str::<ComponentLibraryPayload>(DEFAULT_LIBRARY_JSON) {
            Ok(default_payload) => {
                if self.categories.is_empty() {
                    self.categories = default_payload.categories;
                    let _ = self.save_categories(self.categories.clone());
                }

                for pkg in default_payload.packages {
                    if !self.packages.contains_key(&pkg.id) {
                        let _ = self.save_package(pkg);
                    }
                }

                for dev in default_payload.devices {
                    if !self.devices.contains_key(&dev.id) {
                        let _ = self.save_device(dev);
                    }
                }
            }
            Err(e) => {
                eprintln!(
                    "MyCad: Ошибка десериализации встроенной библиотеки DEFAULT_LIBRARY_JSON: {e}"
                );
            }
        }

        self.is_loaded = true;
        Ok(self.payload())
    }

    pub fn payload(&self) -> ComponentLibraryPayload {
        ComponentLibraryPayload {
            categories: self.categories.clone(),
            packages: self.packages.values().cloned().collect(),
            devices: self.devices.values().cloned().collect(),
        }
    }

    pub fn get_categories(&self) -> Vec<CatalogCategory> {
        self.categories.clone()
    }

    pub fn save_categories(&mut self, categories: Vec<CatalogCategory>) -> Result<(), String> {
        self.init_storage()?;
        let path = self.base_dir.join("categories.json");
        let text = serde_json::to_string_pretty(&categories)
            .map_err(|e| format!("Ошибка сериализации категорий: {e}"))?;
        fs::write(&path, text)
            .map_err(|e| format!("Не удалось сохранить {}: {e}", path.display()))?;
        self.categories = categories;
        Ok(())
    }

    pub fn get_package(&self, id: &str) -> Option<PackageDefinition> {
        self.packages.get(id).cloned()
    }

    pub fn list_packages(&self) -> Vec<PackageDefinition> {
        self.packages.values().cloned().collect()
    }

    pub fn save_package(&mut self, pkg: PackageDefinition) -> Result<(), String> {
        validate_package(&pkg)?;

        let safe_id = sanitize_id(&pkg.id);
        let dir = self.base_dir.join("packages");
        fs::create_dir_all(&dir).map_err(|e| format!("Не удалось создать папку packages: {e}"))?;

        let file_path = dir.join(format!("{safe_id}.json"));
        let text = serde_json::to_string_pretty(&pkg)
            .map_err(|e| format!("Ошибка сериализации корпуса: {e}"))?;
        fs::write(&file_path, text)
            .map_err(|e| format!("Не удалось сохранить {}: {e}", file_path.display()))?;

        self.packages.insert(pkg.id.clone(), pkg);
        Ok(())
    }

    pub fn delete_package(&mut self, id: &str) -> Result<(), String> {
        let safe_id = sanitize_id(id);
        let file_path = self
            .base_dir
            .join("packages")
            .join(format!("{safe_id}.json"));
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Не удалось удалить корпус {}: {e}", file_path.display()))?;
        }
        self.packages.remove(id);
        Ok(())
    }

    pub fn get_device(&self, id: &str) -> Option<DeviceDefinition> {
        self.devices.get(id).cloned()
    }

    pub fn list_devices(&self) -> Vec<DeviceDefinition> {
        self.devices.values().cloned().collect()
    }

    pub fn search_devices(
        &self,
        query: &str,
        category: Option<&str>,
        subcategory: Option<&str>,
        tag: Option<&str>,
    ) -> Vec<DeviceDefinition> {
        let q = query.trim().to_lowercase();
        self.devices
            .values()
            .filter(|d| {
                if let Some(cat) = category {
                    if !cat.is_empty() && d.category != cat {
                        return false;
                    }
                }
                if let Some(sub) = subcategory {
                    if !sub.is_empty() && d.subcategory != sub {
                        return false;
                    }
                }
                if let Some(t) = tag {
                    if !t.is_empty() && !d.tags.iter().any(|item| item.eq_ignore_ascii_case(t)) {
                        return false;
                    }
                }
                if q.is_empty() {
                    return true;
                }
                d.name.to_lowercase().contains(&q)
                    || d.id.to_lowercase().contains(&q)
                    || d.designator_prefix.to_lowercase().contains(&q)
                    || d.description.to_lowercase().contains(&q)
                    || d.parameters
                        .value
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase()
                        .contains(&q)
                    || d.tags.iter().any(|t| t.to_lowercase().contains(&q))
            })
            .cloned()
            .collect()
    }

    pub fn save_device(&mut self, dev: DeviceDefinition) -> Result<(), String> {
        let lookup = |pkg_id: &str| self.packages.get(pkg_id).cloned();
        validate_device(&dev, Some(&lookup))?;

        let safe_id = sanitize_id(&dev.id);
        let dir = self.base_dir.join("devices");
        fs::create_dir_all(&dir).map_err(|e| format!("Не удалось создать папку devices: {e}"))?;

        let file_path = dir.join(format!("{safe_id}.json"));
        let text = serde_json::to_string_pretty(&dev)
            .map_err(|e| format!("Ошибка сериализации устройства: {e}"))?;
        fs::write(&file_path, text)
            .map_err(|e| format!("Не удалось сохранить {}: {e}", file_path.display()))?;

        self.devices.insert(dev.id.clone(), dev);
        Ok(())
    }

    pub fn delete_device(&mut self, id: &str) -> Result<(), String> {
        let safe_id = sanitize_id(id);
        let file_path = self
            .base_dir
            .join("devices")
            .join(format!("{safe_id}.json"));
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Не удалось удалить девайс {}: {e}", file_path.display()))?;
        }
        self.devices.remove(id);
        Ok(())
    }

    pub fn export_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(&self.payload())
            .map_err(|e| format!("Ошибка экспорта библиотеки: {e}"))
    }

    pub fn import_json(&mut self, json_str: &str) -> Result<usize, String> {
        let payload: ComponentLibraryPayload = serde_json::from_str(json_str)
            .map_err(|e| format!("Некорректный формат JSON библиотеки: {e}"))?;
        let mut count = 0;
        for pkg in payload.packages {
            if self.save_package(pkg).is_ok() {
                count += 1;
            }
        }
        for dev in payload.devices {
            if self.save_device(dev).is_ok() {
                count += 1;
            }
        }
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_library_load() {
        let res = serde_json::from_str::<ComponentLibraryPayload>(DEFAULT_LIBRARY_JSON);
        match res {
            Ok(p) => {
                println!(
                    "Loaded {} packages, {} devices",
                    p.packages.len(),
                    p.devices.len()
                );
            }
            Err(e) => {
                panic!("Failed to load DEFAULT_LIBRARY_JSON: {e}");
            }
        }
    }
}
