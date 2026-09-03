# MyCad

CAD-система для реверс-инжиниринга и ремонта печатных плат на базе Rust + Tauri 2.

Референсный прототип (HTML/JS/SVG) лежит в `backup_20260830_124935/` и задаёт функциональные требования.

## Структура

- `src-tauri/` — Rust backend (Tauri 2)
  - `crates/mycad-core` — доменная модель (Project, Module, Component, Footprint, Net, Pin, InterModuleLink) и импортёр референс-данных
- `src/` — фронтенд (TypeScript + Vite + Canvas2D)
- `reference/` — JSON-данные, извлечённые из прототипа (`npm run extract-reference`)
- `tools/` — служебные скрипты

## Разработка

Зависимости: Rust (stable), Node.js 20+, системные библиотеки Tauri (webkit2gtk-4.1 на Linux).

```bash
npm install
npm run tauri dev      # запуск приложения
npm run dev            # только фронтенд в браузере (с fallback-загрузкой reference/*.json)
```

## Проверки

```bash
npm run typecheck
cd src-tauri && cargo test && cargo clippy --workspace && cargo fmt --check
```
