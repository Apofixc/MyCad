use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::collections::HashSet;
use chrono::Utc;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::models::{
    BoardData, BoardDocument, ProjectFileRef, ProjectManifest, SchematicData, SchematicDocument,
};

pub struct ProjectSession {
    pub file_path: PathBuf,
    pub manifest: ProjectManifest,
    pub boards: Vec<BoardDocument>,
    pub schematics: Vec<SchematicDocument>,
    pub active_file_id: Option<String>,
    pub temp_image_dir: PathBuf,
}

impl ProjectSession {
    pub fn new(
        file_path: PathBuf,
        manifest: ProjectManifest,
        boards: Vec<BoardDocument>,
        schematics: Vec<SchematicDocument>,
        active_file_id: Option<String>,
        temp_image_dir: PathBuf,
    ) -> Self {
        Self {
            file_path,
            manifest,
            boards,
            schematics,
            active_file_id,
            temp_image_dir,
        }
    }

    pub fn add_board(&mut self, name: Option<&str>) -> (BoardDocument, ProjectFileRef) {
        let board_id = format!("board_{}", Uuid::new_v4().simple());
        let count = self.boards.len() + 1;
        let final_name = match name {
            Some(n) if !n.trim().is_empty() => n.trim().to_string(),
            _ => {
                if count == 1 {
                    "Печатная плата".to_string()
                } else {
                    format!("Печатная плата {}", count)
                }
            }
        };

        let file_ref = ProjectFileRef {
            id: board_id.clone(),
            name: final_name.clone(),
            file_type: "board".to_string(),
            path: format!("files/{}.board.json", board_id),
            order_index: self.manifest.files.len() as i32,
        };

        let board = BoardDocument {
            id: board_id.clone(),
            name: final_name.clone(),
            r#type: "board".to_string(),
            order_index: file_ref.order_index,
            data: BoardData {
                id: board_id.clone(),
                name: final_name,
                ..Default::default()
            },
        };

        self.manifest.files.push(file_ref.clone());
        self.manifest.updated_at = Utc::now().to_rfc3339();
        self.boards.push(board.clone());
        self.active_file_id = Some(board_id);

        (board, file_ref)
    }

    pub fn add_schematic(&mut self, name: Option<&str>) -> (SchematicDocument, ProjectFileRef) {
        let sch_id = format!("sch_{}", Uuid::new_v4().simple());
        let count = self.schematics.len() + 1;
        let final_name = match name {
            Some(n) if !n.trim().is_empty() => n.trim().to_string(),
            _ => {
                if count == 1 {
                    "Принципиальная схема".to_string()
                } else {
                    format!("Принципиальная схема {}", count)
                }
            }
        };

        let file_ref = ProjectFileRef {
            id: sch_id.clone(),
            name: final_name.clone(),
            file_type: "schematic".to_string(),
            path: format!("files/{}.schematic.json", sch_id),
            order_index: self.manifest.files.len() as i32,
        };

        let sch = SchematicDocument {
            id: sch_id.clone(),
            name: final_name.clone(),
            r#type: "schematic".to_string(),
            order_index: file_ref.order_index,
            data: SchematicData {
                id: sch_id.clone(),
                name: final_name,
                ..Default::default()
            },
        };

        self.manifest.files.push(file_ref.clone());
        self.manifest.updated_at = Utc::now().to_rfc3339();
        self.schematics.push(sch.clone());
        self.active_file_id = Some(sch_id);

        (sch, file_ref)
    }

    pub fn remove_file(&mut self, file_id: &str) -> Result<(), String> {
        let exists = self.manifest.files.iter().any(|f| f.id == file_id);
        if !exists {
            return Err(format!("Файл с id {} не найден в проекте", file_id));
        }

        self.manifest.files.retain(|f| f.id != file_id);
        self.boards.retain(|b| b.id != file_id);
        self.schematics.retain(|s| s.id != file_id);
        self.manifest.updated_at = Utc::now().to_rfc3339();

        if self.active_file_id.as_deref() == Some(file_id) {
            self.active_file_id = self.manifest.files.first().map(|f| f.id.clone());
        }

        Ok(())
    }

    pub fn rename_file(&mut self, file_id: &str, new_name: &str) -> Result<(), String> {
        let trimmed = new_name.trim();
        if trimmed.is_empty() {
            return Err("Имя файла не может быть пустым".to_string());
        }

        let mut found = false;
        for file in &mut self.manifest.files {
            if file.id == file_id {
                file.name = trimmed.to_string();
                found = true;
                break;
            }
        }

        if !found {
            return Err(format!("Файл с id {} не найден", file_id));
        }

        for board in &mut self.boards {
            if board.id == file_id {
                board.name = trimmed.to_string();
                board.data.name = trimmed.to_string();
            }
        }

        for sch in &mut self.schematics {
            if sch.id == file_id {
                sch.name = trimmed.to_string();
                sch.data.name = trimmed.to_string();
            }
        }

        self.manifest.updated_at = Utc::now().to_rfc3339();
        Ok(())
    }

    pub fn set_active_file(&mut self, file_id: &str) -> Result<(), String> {
        if self.manifest.files.iter().any(|f| f.id == file_id) {
            self.active_file_id = Some(file_id.to_string());
            Ok(())
        } else {
            Err(format!("Файл с id {} не найден в проекте", file_id))
        }
    }
}

pub fn create_default_project(path: &Path, name: &str, author: Option<&str>, desc: Option<&str>) -> Result<ProjectSession, String> {
    let proj_id = format!("proj_{}", Uuid::new_v4().simple());
    let now = Utc::now().to_rfc3339();

    // Новый проект создается абсолютно пустым, без автоматических файлов плат или схем
    let manifest = ProjectManifest {
        id: proj_id.clone(),
        name: name.to_string(),
        author: author.map(|s| s.to_string()),
        description: desc.map(|s| s.to_string()),
        created_at: now.clone(),
        updated_at: now,
        format_version: 1,
        files: vec![],
    };

    let session_dir = get_session_cache_dir(&proj_id)?;
    fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;

    let session = ProjectSession::new(path.to_path_buf(), manifest, vec![], vec![], None, session_dir);
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

    // Read boards, schematics and extract images
    let mut boards = Vec::new();
    let mut schematics = Vec::new();
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
        } else if entry_name.starts_with("files/") && entry_name.ends_with(".schematic.json") {
            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
            if let Ok(sch) = serde_json::from_str::<SchematicDocument>(&content) {
                schematics.push(sch);
            }
        } else if entry_name.starts_with("images/") && !entry.is_dir() {
            let out_file_path = session_dir.join(&entry_name);
            if let Some(parent) = out_file_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(out_file) = File::create(&out_file_path) {
                let mut writer = BufWriter::new(out_file);
                let _ = std::io::copy(&mut entry, &mut writer);
            }
        }
    }

    let active_file_id = manifest.files.first().map(|f| f.id.clone());

    Ok(ProjectSession::new(path.to_path_buf(), manifest, boards, schematics, active_file_id, session_dir))
}

pub fn save_project_archive(session: &ProjectSession) -> Result<(), String> {
    if let Some(parent) = session.file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Write to a temporary file first for atomic and safe saving
    let temp_save_path = session.file_path.with_extension("mycad.tmp");
    let file = File::create(&temp_save_path)
        .map_err(|e| format!("Не удалось создать временный файл проекта {}: {}", temp_save_path.display(), e))?;
    let buffered = BufWriter::with_capacity(256 * 1024, file);
    let mut zip = ZipWriter::new(buffered);

    // Deflated compression for JSON (fast and high compression ratio on text)
    let json_options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    // Stored (no compression) for images: PNG/JPEG/WEBP are already compressed; Deflating them wastes 10-40s of CPU for 0% gain
    let img_options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    // 1. Write project.json
    zip.start_file("project.json", json_options).map_err(|e| e.to_string())?;
    let manifest_bytes = serde_json::to_vec_pretty(&session.manifest).map_err(|e| e.to_string())?;
    zip.write_all(&manifest_bytes).map_err(|e| e.to_string())?;

    // 2. Write board files
    for board in &session.boards {
        let file_path = format!("files/{}.board.json", board.id);
        zip.start_file(&file_path, json_options).map_err(|e| e.to_string())?;
        let board_bytes = serde_json::to_vec_pretty(&board).map_err(|e| e.to_string())?;
        zip.write_all(&board_bytes).map_err(|e| e.to_string())?;
    }

    // 3. Write schematic files
    for sch in &session.schematics {
        let file_path = format!("files/{}.schematic.json", sch.id);
        zip.start_file(&file_path, json_options).map_err(|e| e.to_string())?;
        let sch_bytes = serde_json::to_vec_pretty(&sch).map_err(|e| e.to_string())?;
        zip.write_all(&sch_bytes).map_err(|e| e.to_string())?;
    }

    // 4. Collect referenced image files from boards and schematics (exclude unreferenced/preview garbage)
    let mut referenced_images = HashSet::new();
    for board in &session.boards {
        for img in board.data.bg_top.images.iter().chain(board.data.bg_bottom.images.iter()) {
            if let Some(ref rel_file) = img.image_file {
                let clean_name = Path::new(rel_file)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| rel_file.clone());
                if !clean_name.is_empty() {
                    referenced_images.insert(clean_name);
                }
            }
        }
    }
    for sch in &session.schematics {
        for img in &sch.data.bg.images {
            if let Some(ref rel_file) = img.image_file {
                let clean_name = Path::new(rel_file)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| rel_file.clone());
                if !clean_name.is_empty() {
                    referenced_images.insert(clean_name);
                }
            }
        }
    }

    // 5. Write only referenced images from temp_image_dir/images using Stored compression and streaming
    let img_dir = session.temp_image_dir.join("images");
    if img_dir.exists() {
        for file_name in &referenced_images {
            let src_path = img_dir.join(file_name);
            if src_path.is_file() {
                let zip_img_path = format!("images/{}", file_name);
                if let Ok(mut f) = File::open(&src_path) {
                    zip.start_file(&zip_img_path, img_options)
                        .map_err(|e| format!("Ошибка добавления файла в архив {}: {}", zip_img_path, e))?;
                    std::io::copy(&mut f, &mut zip)
                        .map_err(|e| format!("Ошибка потоковой записи изображения {}: {}", file_name, e))?;
                }
            }
        }

        // Clean up unreferenced/orphaned files from disk cache to reclaim disk space
        if let Ok(entries) = fs::read_dir(&img_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    let entry_name = entry.file_name().to_string_lossy().to_string();
                    if !referenced_images.contains(&entry_name) {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }

    zip.finish().map_err(|e| format!("Ошибка финализации ZIP архива: {}", e))?;

    // Atomic replace target project file
    if session.file_path.exists() {
        let backup_path = session.file_path.with_extension("mycad.bak");
        let _ = fs::remove_file(&backup_path);
        if fs::rename(&session.file_path, &backup_path).is_ok() {
            if let Err(e) = fs::rename(&temp_save_path, &session.file_path) {
                let _ = fs::rename(&backup_path, &session.file_path);
                return Err(format!("Не удалось обновить файл проекта: {}", e));
            }
            let _ = fs::remove_file(&backup_path);
        } else {
            let _ = fs::remove_file(&session.file_path);
            fs::rename(&temp_save_path, &session.file_path)
                .map_err(|e| format!("Не удалось переименовать файл проекта: {}", e))?;
        }
    } else {
        fs::rename(&temp_save_path, &session.file_path)
            .map_err(|e| format!("Не удалось переместить временный файл проекта: {}", e))?;
    }
    Ok(())
}

fn get_session_cache_dir(proj_id: &str) -> Result<PathBuf, String> {
    let base = dirs::home_dir().ok_or("Не удалось определить домашнюю директорию пользователя")?;
    Ok(base.join(".mycad").join("cache").join("sessions").join(proj_id))
}
