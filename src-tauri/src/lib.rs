use mycad_core::{import_reference_project, Project};

const BOARD_META: &str = include_str!("../../reference/boardMeta.json");
const FOOTPRINTS: &str = include_str!("../../reference/footprints.json");
const PRESETS: &str = include_str!("../../reference/presets.json");
const COMPONENTS: &str = include_str!("../../reference/components.json");
const NETS: &str = include_str!("../../reference/nets.json");

/// Загружает референс-проект «Пиррс 1000 Люкс» из встроенных данных прототипа.
#[tauri::command]
fn load_reference_project() -> Result<Project, String> {
    import_reference_project(
        BOARD_META,
        FOOTPRINTS,
        PRESETS,
        COMPONENTS,
        NETS,
        "backup_20260830_124935/pcb_board.png",
    )
    .map_err(|e| e.to_string())
}

/// Сохраняет проект в файл (JSON, формат .mycad.json).
#[tauri::command]
fn save_project(path: String, project: Project) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("не удалось записать {path}: {e}"))
}

/// Загружает проект из файла.
#[tauri::command]
fn load_project(path: String) -> Result<Project, String> {
    let json =
        std::fs::read_to_string(&path).map_err(|e| format!("не удалось прочитать {path}: {e}"))?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_reference_project,
            save_project,
            load_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
