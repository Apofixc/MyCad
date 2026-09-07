use std::path::Path;
use std::sync::Mutex;
use tauri::State;

use crate::cad::math::{self, RegistrationResult};
use crate::db::global::GlobalDb;
use crate::image::pipeline;
use crate::models::{
    BoardDocument, BoardImageLayer, ProjectFullState, RecentProject, SchematicDocument,
};
use crate::project::archive::{self, ProjectSession};

pub struct AppState {
    pub session: Mutex<Option<ProjectSession>>,
    pub global_db: Mutex<GlobalDb>,
}

fn build_full_state(session: &ProjectSession) -> ProjectFullState {
    let mut boards = session.boards.clone();
    for board in &mut boards {
        for img in board.data.bg_top.images.iter_mut().chain(board.data.bg_bottom.images.iter_mut()) {
            if let Some(ref rel_file) = img.image_file {
                let local_path = session.temp_image_dir.join("images").join(rel_file);
                if local_path.exists() {
                    img.cached_url = Some(local_path.to_string_lossy().to_string());
                }
            }
        }
    }

    ProjectFullState {
        manifest: session.manifest.clone(),
        boards,
        schematics: session.schematics.clone(),
        active_file_id: session.active_file_id.clone(),
    }
}

#[tauri::command]
pub fn project_create(
    state: State<AppState>,
    path: String,
    name: String,
    author: Option<String>,
    desc: Option<String>,
) -> Result<ProjectFullState, String> {
    let p = Path::new(&path);
    let session = archive::create_default_project(p, &name, author.as_deref(), desc.as_deref())?;
    let manifest = session.manifest.clone();

    // Register in recent projects
    let recent = RecentProject {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        file_path: path,
        last_opened: chrono::Utc::now().to_rfc3339(),
        created_at: manifest.created_at.clone(),
    };
    if let Ok(mut gdb) = state.global_db.lock() {
        if let Err(e) = gdb.add_recent_project(&recent) {
            eprintln!("[WARN] Failed to add recent project: {}", e);
        }
    }

    let full_state = build_full_state(&session);
    *state.session.lock().map_err(|e| e.to_string())? = Some(session);
    Ok(full_state)
}

#[tauri::command]
pub fn project_open(state: State<AppState>, path: String) -> Result<ProjectFullState, String> {
    let p = Path::new(&path);
    let session = archive::open_project_archive(p)?;
    let manifest = session.manifest.clone();

    let recent = RecentProject {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        file_path: path,
        last_opened: chrono::Utc::now().to_rfc3339(),
        created_at: manifest.created_at.clone(),
    };
    if let Ok(mut gdb) = state.global_db.lock() {
        if let Err(e) = gdb.add_recent_project(&recent) {
            eprintln!("[WARN] Failed to add recent project: {}", e);
        }
    }

    let full_state = build_full_state(&session);
    *state.session.lock().map_err(|e| e.to_string())? = Some(session);
    Ok(full_state)
}

#[tauri::command]
pub fn project_get_state(state: State<AppState>) -> Result<Option<ProjectFullState>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    Ok(guard.as_ref().map(build_full_state))
}

#[tauri::command]
pub fn project_save(state: State<AppState>) -> Result<(), String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or("Нет открытого проекта для сохранения")?;
    archive::save_project_archive(session)?;

    let recent = RecentProject {
        id: session.manifest.id.clone(),
        name: session.manifest.name.clone(),
        file_path: session.file_path.to_string_lossy().to_string(),
        last_opened: chrono::Utc::now().to_rfc3339(),
        created_at: session.manifest.created_at.clone(),
    };
    if let Ok(mut gdb) = state.global_db.lock() {
        if let Err(e) = gdb.add_recent_project(&recent) {
            eprintln!("[WARN] Failed to update recent project on save: {}", e);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn project_get_recents(state: State<AppState>) -> Result<Vec<RecentProject>, String> {
    let gdb = state.global_db.lock().map_err(|e| e.to_string())?;
    gdb.get_recent_projects()
}

#[tauri::command]
pub fn project_remove_recent(state: State<AppState>, path: String) -> Result<(), String> {
    let mut gdb = state.global_db.lock().map_err(|e| e.to_string())?;
    gdb.remove_recent_project(&path)
}

#[tauri::command]
pub fn project_add_file(
    state: State<AppState>,
    file_type: String,
    name: Option<String>,
) -> Result<ProjectFullState, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет открытого проекта")?;

    match file_type.as_str() {
        "board" => {
            session.add_board(name.as_deref());
        }
        "schematic" => {
            session.add_schematic(name.as_deref());
        }
        _ => return Err(format!("Неизвестный тип файла: {}", file_type)),
    }

    Ok(build_full_state(session))
}

#[tauri::command]
pub fn project_remove_file(state: State<AppState>, file_id: String) -> Result<ProjectFullState, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет открытого проекта")?;
    session.remove_file(&file_id)?;
    Ok(build_full_state(session))
}

#[tauri::command]
pub fn project_rename_file(state: State<AppState>, file_id: String, new_name: String) -> Result<ProjectFullState, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет открытого проекта")?;
    session.rename_file(&file_id, &new_name)?;
    Ok(build_full_state(session))
}

#[tauri::command]
pub fn project_set_active_file(state: State<AppState>, file_id: String) -> Result<ProjectFullState, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет открытого проекта")?;
    session.set_active_file(&file_id)?;
    Ok(build_full_state(session))
}

#[tauri::command]
pub fn board_delete_image_layer(state: State<AppState>, layer_id: String) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет активного проекта")?;

    for board in &mut session.boards {
        board.data.bg_top.images.retain(|img| img.id != layer_id);
        board.data.bg_bottom.images.retain(|img| img.id != layer_id);
    }
    Ok(())
}

#[tauri::command]
pub fn board_get_active(state: State<AppState>) -> Result<Option<BoardDocument>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = guard.as_ref() {
        let board_opt = if let Some(ref aid) = session.active_file_id {
            session.boards.iter().find(|b| b.id == *aid)
        } else {
            None
        }.or_else(|| session.boards.first());

        if let Some(board) = board_opt {
            let mut b = board.clone();
            // Resolve cached image URLs if present
            for img in b.data.bg_top.images.iter_mut().chain(b.data.bg_bottom.images.iter_mut()) {
                if let Some(ref rel_file) = img.image_file {
                    let local_path = session.temp_image_dir.join("images").join(rel_file);
                    if local_path.exists() {
                        img.cached_url = Some(local_path.to_string_lossy().to_string());
                    }
                }
            }
            return Ok(Some(b));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn schematic_get_active(state: State<AppState>) -> Result<Option<SchematicDocument>, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(session) = guard.as_ref() {
        let sch_opt = if let Some(ref aid) = session.active_file_id {
            session.schematics.iter().find(|s| s.id == *aid)
        } else {
            None
        }.or_else(|| session.schematics.first());

        if let Some(sch) = sch_opt {
            return Ok(Some(sch.clone()));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn board_update_image_layer(state: State<AppState>, layer: BoardImageLayer) -> Result<BoardImageLayer, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет активного проекта")?;

    let active_id = session.active_file_id.clone();
    let board = if let Some(ref aid) = active_id {
        if let Some(pos) = session.boards.iter().position(|b| b.id == *aid) {
            session.boards.get_mut(pos)
        } else {
            session.boards.first_mut()
        }
    } else {
        session.boards.first_mut()
    }.ok_or("В проекте нет схемы платы для добавления или редактирования слоя")?;

    let group = if layer.side == "top" {
        &mut board.data.bg_top.images
    } else {
        &mut board.data.bg_bottom.images
    };

    if let Some(existing) = group.iter_mut().find(|img| img.id == layer.id) {
        *existing = layer.clone();
    } else {
        group.push(layer.clone());
    }

    Ok(layer)
}

#[tauri::command]
pub fn board_update_image_layers(state: State<AppState>, layers: Vec<BoardImageLayer>) -> Result<Vec<BoardImageLayer>, String> {
    let mut guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_mut().ok_or("Нет активного проекта")?;

    let active_id = session.active_file_id.clone();
    let board = if let Some(ref aid) = active_id {
        if let Some(pos) = session.boards.iter().position(|b| b.id == *aid) {
            session.boards.get_mut(pos)
        } else {
            session.boards.first_mut()
        }
    } else {
        session.boards.first_mut()
    }.ok_or("В проекте нет схемы платы для добавления или редактирования слоя")?;

    for layer in &layers {
        let group = if layer.side == "top" {
            &mut board.data.bg_top.images
        } else {
            &mut board.data.bg_bottom.images
        };

        if let Some(existing) = group.iter_mut().find(|img| img.id == layer.id) {
            *existing = layer.clone();
        } else {
            group.push(layer.clone());
        }
    }

    Ok(layers)
}

#[tauri::command]
pub fn cad_calculate_scale(p1: (f64, f64), p2: (f64, f64), real_mm: f64) -> Result<f64, String> {
    math::calculate_scale_px_per_mm(p1, p2, real_mm)
}

#[tauri::command]
pub fn cad_calculate_level(p1: (f64, f64), p2: (f64, f64)) -> f64 {
    math::calculate_level_angle_deg(p1, p2)
}

#[tauri::command]
pub fn cad_calculate_registration(
    top1: (f64, f64),
    top2: (f64, f64),
    bot1: (f64, f64),
    bot2: (f64, f64),
) -> Result<RegistrationResult, String> {
    math::calculate_affine_registration(top1, top2, bot1, bot2)
}

#[tauri::command]
pub fn image_import(state: State<AppState>, file_path: String, side: String) -> Result<BoardImageLayer, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or("Нет активного проекта для импорта фото")?;

    let img = image::open(&file_path).map_err(|e| format!("Не удалось открыть изображение: {}", e))?;
    let w = img.width();
    let h = img.height();

    let (filename, dest_path) = pipeline::save_image_to_session_cache(&img, &session.temp_image_dir, &side)?;

    let name = Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("{}_scan", side));

    let layer = BoardImageLayer {
        id: format!("img_{}_{}", side, uuid::Uuid::new_v4().simple()),
        name,
        side,
        image_file: Some(filename),
        cached_url: Some(dest_path.to_string_lossy().to_string()),
        offset_x: 0.0,
        offset_y: 0.0,
        scale: 1.0,
        lock_aspect_ratio: true,
        rotation: 0.0,
        opacity: 0.85,
        brightness: 100.0,
        contrast: 100.0,
        invert: false,
        grayscale: false,
        blend_mode: "normal".into(),
        tint_color: "none".into(),
        dpi: 600.0,
        px_per_mm: 23.62,
        mirrored: false,
        flip_v: false,
        locked: false,
        visible: true,
        width: w,
        height: h,
    };

    Ok(layer)
}

#[tauri::command]
pub fn image_detect_corners(file_path: String) -> Result<[(f64, f64); 4], String> {
    let img = image::open(&file_path).map_err(|e| e.to_string())?;
    Ok(pipeline::detect_board_corners(&img))
}

#[tauri::command]
pub fn image_warp_perspective(
    state: State<AppState>,
    file_path: String,
    corners: [(f64, f64); 4],
    target_w: u32,
    target_h: u32,
    side: String,
) -> Result<BoardImageLayer, String> {
    let guard = state.session.lock().map_err(|e| e.to_string())?;
    let session = guard.as_ref().ok_or("Нет активного проекта")?;

    let img = image::open(&file_path).map_err(|e| e.to_string())?;
    let warped = pipeline::warp_perspective(&img, &corners, target_w, target_h)?;

    let (filename, dest_path) = pipeline::save_image_to_session_cache(&warped, &session.temp_image_dir, &format!("{}_warped", side))?;

    Ok(BoardImageLayer {
        id: format!("img_{}_{}", side, uuid::Uuid::new_v4().simple()),
        name: format!("{}_warped.png", side),
        side,
        image_file: Some(filename),
        cached_url: Some(dest_path.to_string_lossy().to_string()),
        offset_x: 0.0,
        offset_y: 0.0,
        scale: 1.0,
        lock_aspect_ratio: true,
        rotation: 0.0,
        opacity: 0.85,
        brightness: 100.0,
        contrast: 100.0,
        invert: false,
        grayscale: false,
        blend_mode: "normal".into(),
        tint_color: "none".into(),
        dpi: 600.0,
        px_per_mm: 23.62,
        mirrored: false,
        flip_v: false,
        locked: false,
        visible: true,
        width: target_w,
        height: target_h,
    })
}

#[tauri::command]
pub fn image_read_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Не удалось прочитать файл {}: {}", file_path, e))
}

