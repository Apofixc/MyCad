use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use crate::models::RecentProject;

pub struct GlobalDb {
    conn: Connection,
}

impl GlobalDb {
    pub fn init() -> Result<Self, String> {
        let db_path = get_global_db_path()?;
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&db_path).map_err(|e| format!("Не удалось открыть global.db: {}", e))?;
        
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        let _ = conn.pragma_update(None, "foreign_keys", "ON");

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS recent_projects (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 file_path TEXT NOT NULL UNIQUE,
                 last_opened DATETIME NOT NULL,
                 created_at DATETIME NOT NULL
             );

             CREATE TABLE IF NOT EXISTS settings (
                 key TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );"
        ).map_err(|e| format!("Ошибка создания таблиц global.db: {}", e))?;

        Ok(Self { conn })
    }

    pub fn add_recent_project(&mut self, proj: &RecentProject) -> Result<(), String> {
        self.conn.execute(
            "INSERT INTO recent_projects (id, name, file_path, last_opened, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(file_path) DO UPDATE SET
                 name = excluded.name,
                 last_opened = excluded.last_opened",
            params![
                proj.id,
                proj.name,
                proj.file_path,
                proj.last_opened,
                proj.created_at
            ],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_recent_projects(&self) -> Result<Vec<RecentProject>, String> {
        let mut stmt = self.conn
            .prepare("SELECT id, name, file_path, last_opened, created_at FROM recent_projects ORDER BY last_opened DESC LIMIT 20")
            .map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            Ok(RecentProject {
                id: row.get(0)?,
                name: row.get(1)?,
                file_path: row.get(2)?,
                last_opened: row.get(3)?,
                created_at: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                list.push(item);
            }
        }
        Ok(list)
    }

    pub fn remove_recent_project(&mut self, path: &str) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM recent_projects WHERE file_path = ?1",
            params![path],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn get_global_db_path() -> Result<PathBuf, String> {
    let base = dirs::home_dir().ok_or("Не удалось определить домашнюю директорию")?;
    Ok(base.join(".mycad").join("global.db"))
}
