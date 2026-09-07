pub mod cad;
pub mod commands;
pub mod db;
pub mod image;
pub mod models;
pub mod project;

use std::sync::Mutex;
use commands::AppState;
use db::global::GlobalDb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let global_db = GlobalDb::init().expect("Не удалось инициализировать global.db");

    let app_state = AppState {
        session: Mutex::new(None),
        global_db: Mutex::new(global_db),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::project_create,
            commands::project_open,
            commands::project_get_state,
            commands::project_save,
            commands::project_get_recents,
            commands::project_remove_recent,
            commands::project_add_file,
            commands::project_remove_file,
            commands::project_rename_file,
            commands::project_set_active_file,
            commands::board_get_active,
            commands::schematic_get_active,
            commands::board_update_image_layer,
            commands::board_delete_image_layer,
            commands::cad_calculate_scale,
            commands::cad_calculate_level,
            commands::cad_calculate_registration,
            commands::image_import,
            commands::image_detect_corners,
            commands::image_warp_perspective,
        ])
        .run(tauri::generate_context!())
        .expect("Ошибка запуска приложения Tauri");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_initialization() {
        let global_res = GlobalDb::init();
        assert!(global_res.is_ok(), "GlobalDb init failed: {:?}", global_res.err());
    }
}
