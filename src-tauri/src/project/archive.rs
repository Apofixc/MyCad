use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use chrono::Utc;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::models::{BoardData, BoardDocument, ProjectFileRef, ProjectManifest};

pub struct ProjectSession {
    pub file_path: PathBuf,
    pub manifest: ProjectManifest,
    pub boards: Vec<BoardDocument>,
    pub temp_image_dir: PathBuf,
}

impl ProjectSession {
    pub fn new(file_path: PathBuf, manifest: ProjectManifest, boards: Vec<BoardDocument>, temp_image_dir: PathBuf) -> Self {
        Self {
            file_path,
            manifest,
            boards,
            temp_image_dir,
        }
    }
}

pub fn create_default_project(path: &Path, name: &str, author: Option<&str>, desc: Option<&str>) -> Result<ProjectSession, String> {
    let proj_id = format!("proj_{}", Uuid::new_v4().simple());
    let board_id = format!("board_{}", Uuid::new_v4().simple());
    let now = Utc::now().to_rfc3339();

    let board_file_name = format!("{}.board.json", name.replace(' ', "_"));
    let board_rel_path = format!("files/{}", board_file_name);

    let manifest = ProjectManifest {
        id: proj_id,
        name: name.to_string(),
        author: author.map(|s| s.to_string()),
        description: desc.map(|s| s.to_string()),
        created_at: now.clone(),
        updated_at: now,
        format_version: 1,
        files: vec![ProjectFileRef {
            id: board_id.clone(),
            name: format!("{}.board", name),
            file_type: "board".to_string(),
            path: board_rel_path,
            order_index: 0,
        }],
    };

    let board = BoardDocument {
        id: board_id.clone(),
        name: format!("{}.board", name),
        r#type: "board".to_string(),
        order_index: 0,
        data: BoardData {
            id: board_id,
            name: format!("{}.board", name),
            bg_top: Default::default(),
            bg_bottom: Default::default(),
            components: vec![],
            nets: vec![],
        },
    };

    let session_dir = get_session_cache_dir(&manifest.id)?;
    fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;

    let session = ProjectSession::new(path.to_path_buf(), manifest, vec![board], session_dir);
    save_project_archive(&session)?;

    Ok(session)
}

pub fn open_project_archive(path: &Path) -> Result<ProjectSession, String> {
    let file = File::open(path).map_err(|e| format!("Не удалось открыть файл {}: {}", path.display(), e))?;
    let mut zip = ZipArchive::new(file).map_err(|e| format!("Ошибка чтения архива {}: {}", path.display(), e))?;

    // Read manifest
    let manifest: ProjectManifest = {
        let mut manifest_file = zip
            .by_name("project.json")
            .map_err(|e| format!("В проекте отсутствует project.json: {}", e))?;
        let mut manifest_str = String::new();
        manifest_file
            .read_to_string(&mut manifest_str)
            .map_err(|e| format!("Ошибка чтения project.json: {}", e))?;
        serde_json::from_str(&manifest_str)
            .map_err(|e| format!("Некорректный JSON в project.json: {}", e))?
    };

    let session_dir = get_session_cache_dir(&manifest.id)?;
    fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;

    // Read boards and extract images
    let mut boards = Vec::new();
    let zip_len = zip.len();
    for i in 0..zip_len {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();

        if entry_name.starts_with("files/") && entry_name.ends_with(".board.json") {
            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
            if let Ok(board) = serde_json::from_str::<BoardDocument>(&content) {
                boards.push(board);
            }
        } else if entry_name.starts_with("images/") && !entry.is_dir() {
            let out_file_path = session_dir.join(&entry_name);
            if let Some(parent) = out_file_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(mut out_file) = File::create(&out_file_path) {
                let mut buffer = Vec::new();
                let _ = entry.read_to_end(&mut buffer);
                let _ = out_file.write_all(&buffer);
            }
        }
    }

    Ok(ProjectSession::new(path.to_path_buf(), manifest, boards, session_dir))
}

pub fn save_project_archive(session: &ProjectSession) -> Result<(), String> {
    if let Some(parent) = session.file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let file = File::create(&session.file_path)
        .map_err(|e| format!("Не удалось создать файл проекта {}: {}", session.file_path.display(), e))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // 1. Write project.json
    zip.start_file("project.json", options).map_err(|e| e.to_string())?;
    let manifest_bytes = serde_json::to_vec_pretty(&session.manifest).map_err(|e| e.to_string())?;
    zip.write_all(&manifest_bytes).map_err(|e| e.to_string())?;

    // 2. Write board files
    for board in &session.boards {
        let file_path = format!("files/board_{}_{}.board.json", board.id, board.name.replace([' ', '/'], "_"));
        zip.start_file(&file_path, options).map_err(|e| e.to_string())?;
        let board_bytes = serde_json::to_vec_pretty(&board).map_err(|e| e.to_string())?;
        zip.write_all(&board_bytes).map_err(|e| e.to_string())?;
    }

    // 3. Write images from temp_image_dir/images if exists
    let img_dir = session.temp_image_dir.join("images");
    if img_dir.exists() {
        if let Ok(entries) = fs::read_dir(&img_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    let file_name = entry.file_name();
                    let zip_img_path = format!("images/{}", file_name.to_string_lossy());
                    if let Ok(mut f) = File::open(entry.path()) {
                        let mut buf = Vec::new();
                        if f.read_to_end(&mut buf).is_ok() {
                            let _ = zip.start_file(&zip_img_path, options);
                            let _ = zip.write_all(&buf);
                        }
                    }
                }
            }
        }
    }

    zip.finish().map_err(|e| format!("Ошибка финализации ZIP архива: {}", e))?;
    Ok(())
}

fn get_session_cache_dir(proj_id: &str) -> Result<PathBuf, String> {
    let base = dirs::home_dir().ok_or("Не удалось определить домашнюю директорию пользователя")?;
    Ok(base.join(".mycad").join("cache").join("sessions").join(proj_id))
}
