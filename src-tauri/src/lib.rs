use mycad_core::library::{
    CatalogCategory, ComponentLibraryPayload, DeviceDefinition, LibraryService, PackageDefinition,
};
use serde_json::{json, Value};
use std::io::{Cursor, Read, Seek, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub struct LibraryState(pub Mutex<LibraryService>);

/// Возвращает канонический путь к каталогу компонентов пользователя: ~/.mycad/components
fn get_components_base_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".mycad").join("components")
}

#[tauri::command]
fn get_components_dir(state: tauri::State<'_, LibraryState>) -> Result<String, String> {
    let lib = state.0.lock().map_err(|e| e.to_string())?;
    Ok(lib.base_dir().to_string_lossy().to_string())
}

#[tauri::command]
fn init_component_storage(state: tauri::State<'_, LibraryState>) -> Result<String, String> {
    let lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.init_storage()?;
    Ok(lib.base_dir().to_string_lossy().to_string())
}

#[tauri::command]
fn load_component_library(
    state: tauri::State<'_, LibraryState>,
) -> Result<ComponentLibraryPayload, String> {
    let mut lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.load_all()
}

#[tauri::command]
fn save_device(
    state: tauri::State<'_, LibraryState>,
    device: DeviceDefinition,
) -> Result<(), String> {
    let mut lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.save_device(device)
}

#[tauri::command]
fn delete_device(state: tauri::State<'_, LibraryState>, id: String) -> Result<(), String> {
    let mut lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.delete_device(&id)
}

#[tauri::command]
fn save_package(
    state: tauri::State<'_, LibraryState>,
    package: PackageDefinition,
) -> Result<(), String> {
    let mut lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.save_package(package)
}

#[tauri::command]
fn delete_package(state: tauri::State<'_, LibraryState>, id: String) -> Result<(), String> {
    let mut lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.delete_package(&id)
}

#[tauri::command]
fn save_categories(
    state: tauri::State<'_, LibraryState>,
    categories: Vec<CatalogCategory>,
) -> Result<(), String> {
    let mut lib = state.0.lock().map_err(|e| e.to_string())?;
    lib.save_categories(categories)
}

#[tauri::command]
fn search_devices(
    state: tauri::State<'_, LibraryState>,
    query: String,
    category: Option<String>,
    subcategory: Option<String>,
    tag: Option<String>,
) -> Result<Vec<DeviceDefinition>, String> {
    let lib = state.0.lock().map_err(|e| e.to_string())?;
    Ok(lib.search_devices(
        &query,
        category.as_deref(),
        subcategory.as_deref(),
        tag.as_deref(),
    ))
}

#[tauri::command]
fn get_device(
    state: tauri::State<'_, LibraryState>,
    id: String,
) -> Result<Option<DeviceDefinition>, String> {
    let lib = state.0.lock().map_err(|e| e.to_string())?;
    Ok(lib.get_device(&id))
}

#[tauri::command]
fn get_package(
    state: tauri::State<'_, LibraryState>,
    id: String,
) -> Result<Option<PackageDefinition>, String> {
    let lib = state.0.lock().map_err(|e| e.to_string())?;
    Ok(lib.get_package(&id))
}

#[tauri::command]
fn load_reference_project() -> Result<Value, String> {
    Err("Демонстрационный референс-проект обновлен до новой базы компонентов".to_string())
}

/// Сохраняет проект в контейнер .mycad (ZIP-архив) или .json файл.
#[tauri::command]
fn save_project(path: String, mut project: Value) -> Result<(), String> {
    // Гарантируем актуальную дату изменения и версию
    let now = chrono_or_system_time();
    if let Some(obj) = project.as_object_mut() {
        obj.insert("updatedAt".to_string(), json!(now));
        if !obj.contains_key("formatVersion") {
            obj.insert("formatVersion".to_string(), json!(1));
        }
    }

    // Если файл явно запрошен как .json (не .mycad), сохраняем плоским форматированным JSON
    if path.to_lowercase().ends_with(".json") && !path.to_lowercase().ends_with(".mycad.json") {
        let json_text = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
        return std::fs::write(&path, json_text)
            .map_err(|e| format!("Не удалось записать файл {path}: {e}"));
    }

    // Иначе упаковываем в профессиональный ZIP-контейнер .mycad
    let file = std::fs::File::create(&path)
        .map_err(|e| format!("Не удалось создать файл {path}: {e}"))?;
    let mut zip = ZipWriter::new(file);

    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated);

    // Извлекаем файлы из проекта для раздельного хранения внутри архива
    let files_val = project.get("files").cloned();
    let mut file_entries = Vec::new();

    if let Some(files_array) = files_val.and_then(|v| v.as_array().cloned()) {
        for (i, file_item) in files_array.into_iter().enumerate() {
            let file_id = file_item
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("file_{i}"));
            let file_name = file_item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("document");
            let file_type = file_item
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("board");

            // Имя внутри ZIP архива: files/<safe_id>_<type>.json
            let internal_path = format!("files/{file_id}_{file_type}.json");

            // Записываем внутренний файл данных документа в архив
            zip.start_file(&internal_path, options)
                .map_err(|e| format!("Ошибка создания записи в архиве {internal_path}: {e}"))?;

            let file_content = serde_json::to_string_pretty(&file_item)
                .map_err(|e| format!("Ошибка сериализации файла {file_name}: {e}"))?;
            zip.write_all(file_content.as_bytes())
                .map_err(|e| format!("Ошибка записи содержимого файла {file_name}: {e}"))?;

            file_entries.push(json!({
                "id": file_id,
                "name": file_name,
                "type": file_type,
                "path": internal_path
            }));
        }
    }

    // Создаем манифест project.json
    let mut manifest = project.clone();
    if let Some(obj) = manifest.as_object_mut() {
        obj.insert("files".to_string(), json!(file_entries));
    }

    zip.start_file("project.json", options)
        .map_err(|e| format!("Ошибка создания project.json в архиве: {e}"))?;
    let manifest_bytes = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Ошибка сериализации project.json: {e}"))?;
    zip.write_all(manifest_bytes.as_bytes())
        .map_err(|e| format!("Ошибка записи project.json: {e}"))?;

    zip.finish()
        .map_err(|e| format!("Ошибка финализации архива {path}: {e}"))?;

    Ok(())
}

/// Загружает проект из файла .mycad (ZIP-контейнер) или .json с автоопределением.
#[tauri::command]
fn load_project(path: String) -> Result<Value, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Не удалось прочитать файл {path}: {e}"))?;

    // Проверка магических байтов ZIP: PK\x03\x04
    if bytes.len() >= 4 && &bytes[0..4] == b"PK\x03\x04" {
        load_zip_project(Cursor::new(bytes), &path)
    } else {
        // Fallback: плоский JSON
        serde_json::from_slice(&bytes)
            .map_err(|e| format!("Ошибка парсинга JSON из {path}: {e}"))
    }
}

fn load_zip_project<R: Read + Seek>(reader: R, path: &str) -> Result<Value, String> {
    let mut archive = ZipArchive::new(reader)
        .map_err(|e| format!("Не удалось открыть ZIP-контейнер {path}: {e}"))?;

    // 1. Считываем манифест project.json во временном блоке, освобождая заем archive
    let manifest_str = {
        let mut manifest_file = archive
            .by_name("project.json")
            .map_err(|e| format!("В архиве {path} отсутствует project.json: {e}"))?;

        let mut s = String::new();
        manifest_file
            .read_to_string(&mut s)
            .map_err(|e| format!("Ошибка чтения project.json в {path}: {e}"))?;
        s
    };

    let mut project: Value = serde_json::from_str(&manifest_str)
        .map_err(|e| format!("Ошибка парсинга project.json в {path}: {e}"))?;

    // 2. Считываем связанные файлы из реестра файлов
    let files_manifest = project.get("files").and_then(|v| v.as_array()).cloned();

    if let Some(entries) = files_manifest {
        let mut full_files = Vec::new();

        for entry in entries {
            if let Some(internal_path) = entry.get("path").and_then(|p| p.as_str()) {
                let file_read_res = {
                    match archive.by_name(internal_path) {
                        Ok(mut f) => {
                            let mut content = String::new();
                            if f.read_to_string(&mut content).is_ok() {
                                serde_json::from_str::<Value>(&content).ok()
                            } else {
                                None
                            }
                        }
                        Err(_) => None,
                    }
                };

                if let Some(loaded_file) = file_read_res {
                    full_files.push(loaded_file);
                    continue;
                }
            }
            // fallback: если не прочиталось из отдельного файла, оставляем как было
            full_files.push(entry);
        }

        if let Some(obj) = project.as_object_mut() {
            obj.insert("files".to_string(), Value::Array(full_files));
        }
    }

    Ok(project)
}

#[derive(serde::Serialize)]
pub struct LoadedImageFile {
    pub name: String,
    pub mime: String,
    pub bytes: Vec<u8>,
    pub data_url: String,
}

fn bytes_to_base64(bytes: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        out.push(CHARSET[(b0 >> 2) as usize] as char);
        out.push(CHARSET[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Читает файл изображения по абсолютному пути и возвращает Data URL и метаданные
#[tauri::command]
fn read_image_file(path: String) -> Result<LoadedImageFile, String> {
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Не удалось прочитать файл {path}: {e}"))?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
    .to_string();
    let name = std::path::Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Image")
        .to_string();

    let data_url = format!("data:{mime};base64,{}", bytes_to_base64(&bytes));

    Ok(LoadedImageFile {
        name,
        mime,
        bytes: Vec::new(),
        data_url,
    })
}

fn chrono_or_system_time() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now();
    match now.duration_since(SystemTime::UNIX_EPOCH) {
        Ok(dur) => {
            let secs = dur.as_secs();
            format!("{secs}")
        }
        Err(_) => "0".to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let base_dir = get_components_base_dir();
    let library_service = LibraryService::new(base_dir);

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(LibraryState(Mutex::new(library_service)))
        .invoke_handler(tauri::generate_handler![
            load_reference_project,
            save_project,
            load_project,
            read_image_file,
            get_components_dir,
            init_component_storage,
            load_component_library,
            save_device,
            delete_device,
            save_package,
            delete_package,
            save_categories,
            search_devices,
            get_device,
            get_package
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

