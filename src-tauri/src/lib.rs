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
            commands::board_update_image_layers,
            commands::board_delete_image_layer,
            commands::cad_calculate_scale,
            commands::cad_calculate_level,
            commands::cad_calculate_registration,
            commands::image_import,
            commands::image_import_batch,
            commands::image_detect_corners,
            commands::image_process,
            commands::image_process_and_save,
            commands::image_read_bytes,
            commands::image_prepare_display,
            commands::image_convert_tiff_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("Ошибка запуска приложения Tauri");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::RecentProject;

    #[test]
    fn test_db_initialization_and_recents() {
        let global_res = GlobalDb::init();
        assert!(global_res.is_ok(), "GlobalDb init failed: {:?}", global_res.err());

        let mut gdb = global_res.unwrap();
        let recents = gdb.get_recent_projects();
        assert!(recents.is_ok(), "get_recent_projects failed: {:?}", recents.err());

        let test_proj = RecentProject {
            id: "test_rec_id".into(),
            name: "Test Project".into(),
            file_path: "C:/fake/test_project.mycad".into(),
            last_opened: chrono::Utc::now().to_rfc3339(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        let add_res = gdb.add_recent_project(&test_proj);
        assert!(add_res.is_ok(), "add_recent_project failed: {:?}", add_res.err());

        let list_after_add = gdb.get_recent_projects().unwrap();
        assert!(list_after_add.iter().any(|p| p.file_path == test_proj.file_path));

        let rem_res = gdb.remove_recent_project(&test_proj.file_path);
        assert!(rem_res.is_ok(), "remove_recent_project failed: {:?}", rem_res.err());
    }

    #[test]
    fn test_tiff_and_webp_support() {
        use ::image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
        // Create an in-memory test image
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_pixel(10, 10, Rgba([255, 0, 128, 255]));
        let dyn_img = DynamicImage::ImageRgba8(img);

        // Encode as TIFF
        let mut tiff_bytes = Vec::new();
        dyn_img.write_to(&mut std::io::Cursor::new(&mut tiff_bytes), ImageFormat::Tiff)
            .expect("Should encode TIFF");

        // Decode TIFF
        let decoded = ::image::load_from_memory(&tiff_bytes).expect("Should decode TIFF");
        assert_eq!(decoded.width(), 10);
        assert_eq!(decoded.height(), 10);

        // Test saving TIFF decoded image to PNG preview
        let temp_png = std::env::temp_dir().join("test_tiff_preview.png");
        crate::image::pipeline::save_image_to_file(&decoded, &temp_png, "image/png", 90)
            .expect("Should save preview PNG");
        assert!(temp_png.exists());
        let _ = std::fs::remove_file(&temp_png);
    }
}

