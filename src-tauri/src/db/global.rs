use rusqlite::{params, Connection};
use std::fs;
use std::path::{Path, PathBuf};
use crate::models::RecentProject;

pub struct GlobalDb {
    conn: Connection,
}

impl GlobalDb {
    pub fn init() -> Result<Self, String> {
        let db_path = get_global_db_path()?;
        Self::init_with_path(&db_path)
    }

    pub fn init_with_path(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(db_path).map_err(|e| format!("Не удалось открыть global.db: {}", e))?;
        
        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        let _ = conn.pragma_update(None, "foreign_keys", "ON");

        Self::migrate(&conn)?;

        Ok(Self { conn })
    }

    fn migrate(conn: &Connection) -> Result<(), String> {
        // Check if recent_projects table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='recent_projects'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|cnt| cnt > 0)
            .unwrap_or(false);

        if table_exists {
            let mut stmt = conn
                .prepare("PRAGMA table_info(recent_projects)")
                .map_err(|e| e.to_string())?;
            let columns = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect::<Vec<String>>();

            let has_file_path = columns.iter().any(|c| c == "file_path");
            let has_path = columns.iter().any(|c| c == "path");

            if !has_file_path {
                conn.execute_batch(
                    "CREATE TABLE recent_projects_v2 (
                         id TEXT NOT NULL,
                         name TEXT NOT NULL,
                         file_path TEXT PRIMARY KEY,
                         last_opened DATETIME NOT NULL,
                         created_at DATETIME NOT NULL
                     );"
                ).map_err(|e| format!("Ошибка создания таблицы миграции: {}", e))?;

                if has_path {
                    let _ = conn.execute(
                        "INSERT OR REPLACE INTO recent_projects_v2 (id, name, file_path, last_opened, created_at)
                         SELECT 
                             COALESCE(id, 'proj_' || hex(randomblob(8))),
                             COALESCE(name, 'Project'),
                             path,
                             COALESCE(updated_at, datetime('now')),
                             COALESCE(updated_at, datetime('now'))
                         FROM recent_projects WHERE path IS NOT NULL AND length(path) > 0",
                        [],
                    );
                }

                conn.execute_batch(
                    "DROP TABLE recent_projects;
                     ALTER TABLE recent_projects_v2 RENAME TO recent_projects;"
                ).map_err(|e| format!("Ошибка миграции recent_projects: {}", e))?;
            }
        } else {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS recent_projects (
                     id TEXT NOT NULL,
                     name TEXT NOT NULL,
                     file_path TEXT PRIMARY KEY,
                     last_opened DATETIME NOT NULL,
                     created_at DATETIME NOT NULL
                 );"
            ).map_err(|e| format!("Ошибка создания recent_projects: {}", e))?;
        }

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS settings (
                 key TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );"
        ).map_err(|e| format!("Ошибка создания settings: {}", e))?;

        Ok(())
    }

    pub fn add_recent_project(&mut self, proj: &RecentProject) -> Result<(), String> {
        self.conn.execute(
            "INSERT INTO recent_projects (id, name, file_path, last_opened, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(file_path) DO UPDATE SET
                 id = excluded.id,
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
