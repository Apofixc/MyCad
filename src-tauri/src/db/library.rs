use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use crate::models::{LibraryDevice, PackageTemplate};

pub struct LibraryDb {
    conn: Connection,
}

impl LibraryDb {
    pub fn init() -> Result<Self, String> {
        let db_path = get_library_db_path()?;
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&db_path).map_err(|e| format!("Не удалось открыть library.db: {}", e))?;

        let _ = conn.pragma_update(None, "journal_mode", "WAL");
        let _ = conn.pragma_update(None, "foreign_keys", "ON");

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS categories (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 parent_id TEXT
             );

             CREATE TABLE IF NOT EXISTS packages (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 family TEXT NOT NULL,
                 pin_count INTEGER NOT NULL,
                 body_width REAL NOT NULL,
                 body_height REAL NOT NULL,
                 json_data TEXT NOT NULL
             );

             CREATE TABLE IF NOT EXISTS devices (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 category_id TEXT NOT NULL,
                 prefix TEXT NOT NULL,
                 value TEXT,
                 description TEXT,
                 package_id TEXT NOT NULL,
                 tags TEXT
             );

             CREATE VIRTUAL TABLE IF NOT EXISTS devices_fts USING fts5(
                 id UNINDEXED,
                 name,
                 value,
                 description,
                 tags,
                 prefix
             );"
        ).map_err(|e| format!("Ошибка инициализации схем library.db: {}", e))?;

        let mut db = Self { conn };
        db.seed_defaults_if_empty()?;
        Ok(db)
    }

    pub fn search(&self, query: &str) -> Result<Vec<LibraryDevice>, String> {
        let trimmed = query.trim();
        let sql = if trimmed.is_empty() {
            "SELECT id, name, category_id, prefix, value, description, package_id, tags FROM devices LIMIT 100".to_string()
        } else {
            // Match with FTS5 prefix wildcard
            let fts_query = format!("{}*", trimmed.replace('"', "\"\""));
            format!(
                "SELECT d.id, d.name, d.category_id, d.prefix, d.value, d.description, d.package_id, d.tags
                 FROM devices_fts f
                 JOIN devices d ON d.id = f.id
                 WHERE devices_fts MATCH '{}'
                 ORDER BY rank LIMIT 100",
                fts_query
            )
        };

        let mut stmt = self.conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            let tags_str: Option<String> = row.get(7)?;
            let tags = tags_str
                .map(|s| s.split(',').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect())
                .unwrap_or_default();

            Ok(LibraryDevice {
                id: row.get(0)?,
                name: row.get(1)?,
                category_id: row.get(2)?,
                prefix: row.get(3)?,
                value: row.get(4)?,
                description: row.get(5)?,
                package_id: row.get(6)?,
                tags,
            })
        }).map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn get_packages(&self) -> Result<Vec<PackageTemplate>, String> {
        let mut stmt = self.conn
            .prepare("SELECT id, name, family, pin_count, body_width, body_height, json_data FROM packages ORDER BY name")
            .map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |row| {
            let json_data: String = row.get(6)?;
            let tpl: Result<PackageTemplate, _> = serde_json::from_str(&json_data);
            if let Ok(pkg) = tpl {
                Ok(pkg)
            } else {
                let pin_count: i64 = row.get(3)?;
                Ok(PackageTemplate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    family: row.get(2)?,
                    pin_count: pin_count as usize,
                    body_width: row.get(4)?,
                    body_height: row.get(5)?,
                    pins: vec![],
                })
            }
        }).map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    fn seed_defaults_if_empty(&mut self) -> Result<(), String> {
        let count: i64 = self.conn
            .query_row("SELECT COUNT(*) FROM devices", [], |r| r.get(0))
            .unwrap_or(0);

        if count > 0 {
            return Ok(());
        }

        // Seed core categories
        let categories = [
            ("cat_res", "Резисторы"),
            ("cat_cap", "Конденсаторы"),
            ("cat_ind", "Индуктивности / Дроссели"),
            ("cat_diode", "Диоды и стабилитроны"),
            ("cat_trans", "Транзисторы и MOSFET"),
            ("cat_ic", "Микросхемы и логика"),
            ("cat_mcu", "Микроконтроллеры"),
            ("cat_pwr", "Питание (LDO / DC-DC)"),
            ("cat_conn", "Разъемы и коннекторы"),
        ];

        for (id, name) in categories {
            let _ = self.conn.execute(
                "INSERT OR IGNORE INTO categories (id, name) VALUES (?1, ?2)",
                params![id, name],
            );
        }

        // Seed standard packages
        let packages = [
            ("pkg_0402", "0402 (1005 Metric)", "CHIP_SMD", 2, 1.0, 0.5),
            ("pkg_0603", "0603 (1608 Metric)", "CHIP_SMD", 2, 1.6, 0.8),
            ("pkg_0805", "0805 (2012 Metric)", "CHIP_SMD", 2, 2.0, 1.25),
            ("pkg_1206", "1206 (3216 Metric)", "CHIP_SMD", 2, 3.2, 1.6),
            ("pkg_sot23", "SOT-23-3", "SOT", 3, 2.9, 1.3),
            ("pkg_sot223", "SOT-223", "SOT", 4, 6.5, 3.5),
            ("pkg_soic8", "SOIC-8 (150mil)", "SOIC", 8, 4.9, 3.9),
            ("pkg_soic16", "SOIC-16", "SOIC", 16, 9.9, 3.9),
            ("pkg_tqfp48", "TQFP-48 (7x7mm)", "QFP", 48, 7.0, 7.0),
            ("pkg_lqfp64", "LQFP-64 (10x10mm)", "QFP", 64, 10.0, 10.0),
            ("pkg_dip8", "DIP-8", "DIP", 8, 9.6, 6.4),
            ("pkg_dip16", "DIP-16", "DIP", 16, 19.3, 6.4),
            ("pkg_usb_c", "USB Type-C 16-pin", "CONN", 16, 8.94, 7.35),
        ];

        for (id, name, family, pin_count, w, h) in packages {
            let pkg_obj = PackageTemplate {
                id: id.to_string(),
                name: name.to_string(),
                family: family.to_string(),
                pin_count: pin_count as usize,
                body_width: w,
                body_height: h,
                pins: vec![],
            };
            let json = serde_json::to_string(&pkg_obj).unwrap_or_default();
            let _ = self.conn.execute(
                "INSERT OR IGNORE INTO packages (id, name, family, pin_count, body_width, body_height, json_data)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![id, name, family, pin_count, w, h, json],
            );
        }

        // Seed popular devices
        let devices = [
            ("dev_r0805_10k", "R 10k 0805", "cat_res", "R", "10k", "SMD резистор 1% 10 кОм", "pkg_0805", "resistor,smd,passive,10k"),
            ("dev_r0805_1k", "R 1k 0805", "cat_res", "R", "1k", "SMD резистор 1% 1 кОм", "pkg_0805", "resistor,smd,passive,1k"),
            ("dev_r0603_100", "R 100R 0603", "cat_res", "R", "100R", "SMD резистор 1% 100 Ом", "pkg_0603", "resistor,smd,passive,100"),
            ("dev_c0805_100n", "C 100nF 0805", "cat_cap", "C", "100nF", "Керамический конденсатор X7R 50V", "pkg_0805", "capacitor,smd,x7r,100n,decoupling"),
            ("dev_c0805_10u", "C 10uF 0805", "cat_cap", "C", "10uF", "Керамический конденсатор X5R 16V", "pkg_0805", "capacitor,smd,filter,10u"),
            ("dev_c0603_1u", "C 1uF 0603", "cat_cap", "C", "1uF", "Керамический конденсатор X7R 25V", "pkg_0603", "capacitor,smd,1u"),
            ("dev_diode_1n4148", "1N4148W", "cat_diode", "VD", "1N4148", "Быстродействующий импульсный диод", "pkg_0805", "diode,switching,fast"),
            ("dev_led_0805_green", "LED 0805 Green", "cat_diode", "HL", "Green", "Светодиод зеленый SMD", "pkg_0805", "led,green,indicator"),
            ("dev_mosfet_2n7002", "2N7002", "cat_trans", "VT", "60V 115mA", "N-Channel MOSFET", "pkg_sot23", "transistor,mosfet,n-channel"),
            ("dev_reg_ams1117_3v3", "AMS1117-3.3", "cat_pwr", "DA", "3.3V 1A", "Линейный стабилизатор LDO 3.3V", "pkg_sot223", "regulator,ldo,power,3v3"),
            ("dev_reg_ams1117_5v0", "AMS1117-5.0", "cat_pwr", "DA", "5.0V 1A", "Линейный стабилизатор LDO 5.0V", "pkg_sot223", "regulator,ldo,power,5v"),
            ("dev_ne555", "NE555DR", "cat_ic", "DA", "Timer", "Прецизионный таймер", "pkg_soic8", "timer,analog,clock"),
            ("dev_stm32f103c8t6", "STM32F103C8T6", "cat_mcu", "DD", "ARM Cortex-M3", "Микроконтроллер 72MHz 64KB Flash", "pkg_tqfp48", "mcu,stm32,cortex,arm,48pin"),
            ("dev_esp32_wroom", "ESP32-WROOM-32", "cat_mcu", "DD", "Wi-Fi+BT", "Беспроводной модуль", "pkg_qfp48", "mcu,esp32,wifi,bluetooth"),
            ("dev_ch340c", "CH340C", "cat_ic", "DA", "USB-UART", "Преобразователь интерфейса USB в UART", "pkg_soic16", "usb,uart,bridge,interface"),
            ("dev_usb_c_16p", "TYPE-C-16P", "cat_conn", "XS", "USB-C", "Разъем USB Type-C 16-pin SMD", "pkg_usb_c", "connector,usb,type-c"),
        ];

        for (id, name, cat, prefix, val, desc, pkg, tags) in devices {
            let _ = self.conn.execute(
                "INSERT OR IGNORE INTO devices (id, name, category_id, prefix, value, description, package_id, tags)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![id, name, cat, prefix, val, desc, pkg, tags],
            );
            let _ = self.conn.execute(
                "INSERT INTO devices_fts (id, name, value, description, tags, prefix)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, name, val, desc, tags, prefix],
            );
        }

        Ok(())
    }
}

fn get_library_db_path() -> Result<PathBuf, String> {
    let base = dirs::home_dir().ok_or("Не удалось определить домашнюю директорию")?;
    Ok(base.join(".mycad").join("library.db"))
}
