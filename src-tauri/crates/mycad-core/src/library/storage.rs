//! Сервис хранения и поиска библиотеки компонентов

use super::model::{
    CatalogCategory, ComponentLibraryPayload, DeviceDefinition, PackageDefinition,
};
use super::validator::{validate_device, validate_package};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub fn sanitize_id(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect()
}

#[derive(Debug, Clone)]
pub struct LibraryService {
    base_dir: PathBuf,
    categories: Vec<CatalogCategory>,
    packages: HashMap<String, PackageDefinition>,
    devices: HashMap<String, DeviceDefinition>,
    is_loaded: bool,
}

impl LibraryService {
    pub fn new(base_dir: impl Into<PathBuf>) -> Self {
        Self {
            base_dir: base_dir.into(),
            categories: Vec::new(),
            packages: HashMap::new(),
            devices: HashMap::new(),
            is_loaded: false,
        }
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Инициализация файловой структуры каталогов
    pub fn init_storage(&self) -> Result<(), String> {
        let packages_dir = self.base_dir.join("packages");
        let devices_dir = self.base_dir.join("devices");

        fs::create_dir_all(&packages_dir)
            .map_err(|e| format!("Не удалось создать директорию packages: {e}"))?;
        fs::create_dir_all(&devices_dir)
            .map_err(|e| format!("Не удалось создать директорию devices: {e}"))?;

        let categories_path = self.base_dir.join("categories.json");
        if !categories_path.exists() {
            let _ = fs::write(&categories_path, "[]");
        }

        Ok(())
    }

    /// Полная загрузка всех файлов библиотеки с диска в память
    pub fn load_all(&mut self) -> Result<ComponentLibraryPayload, String> {
        self.init_storage()?;

        // Читаем дерево категорий
        let categories_path = self.base_dir.join("categories.json");
        self.categories = if categories_path.exists() {
            let content = fs::read_to_string(&categories_path).unwrap_or_else(|_| "[]".to_string());
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        };

        // Читаем все корпуса
        self.packages.clear();
        let packages_dir = self.base_dir.join("packages");
        if packages_dir.exists() {
            if let Ok(entries) = fs::read_dir(&packages_dir) {
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

        // Читаем все устройства
        self.devices.clear();
        let devices_dir = self.base_dir.join("devices");
        if devices_dir.exists() {
            if let Ok(entries) = fs::read_dir(&devices_dir) {
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

    // ------------------------------------------------------------------------
    // КАТЕГОРИИ
    // ------------------------------------------------------------------------

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

    // ------------------------------------------------------------------------
    // КОРПУСА (PACKAGES)
    // ------------------------------------------------------------------------

    pub fn get_package(&self, id: &str) -> Option<PackageDefinition> {
        self.packages.get(id).cloned()
    }

    pub fn list_packages(&self) -> Vec<PackageDefinition> {
        self.packages.values().cloned().collect()
    }

    pub fn save_package(&mut self, pkg: PackageDefinition) -> Result<(), String> {
        validate_package(&pkg).map_err(|e| e.to_string())?;

        let safe_id = sanitize_id(&pkg.id);
        let dir = self.base_dir.join("packages");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Не удалось создать папку packages: {e}"))?;

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
        let file_path = self.base_dir.join("packages").join(format!("{safe_id}.json"));
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Не удалось удалить корпус {}: {e}", file_path.display()))?;
        }
        self.packages.remove(id);
        Ok(())
    }

    // ------------------------------------------------------------------------
    // УСТРОЙСТВА (DEVICES)
    // ------------------------------------------------------------------------

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
                    || d.parameters.value.as_deref().unwrap_or("").to_lowercase().contains(&q)
                    || d.tags.iter().any(|t| t.to_lowercase().contains(&q))
            })
            .cloned()
            .collect()
    }

    pub fn save_device(&mut self, dev: DeviceDefinition) -> Result<(), String> {
        let lookup = |pkg_id: &str| self.packages.get(pkg_id).cloned();
        validate_device(&dev, Some(&lookup)).map_err(|e| e.to_string())?;

        let safe_id = sanitize_id(&dev.id);
        let dir = self.base_dir.join("devices");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Не удалось создать папку devices: {e}"))?;

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
        let file_path = self.base_dir.join("devices").join(format!("{safe_id}.json"));
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Не удалось удалить девайс {}: {e}", file_path.display()))?;
        }
        self.devices.remove(id);
        Ok(())
    }
}
