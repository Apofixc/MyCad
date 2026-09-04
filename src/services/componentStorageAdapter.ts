// src/services/componentStorageAdapter.ts
// Адаптер доступа к файловой системе базы данных компонентов (Tauri API + Web fallback)

import { invoke } from "@tauri-apps/api/core";
import {
  CatalogCategory,
  PackageDefinition,
  DeviceDefinition,
  ComponentLibraryPayload,
} from "../types/componentLibrary";
import { DEFAULT_LIBRARY_PAYLOAD } from "../data/defaultComponentLibrary";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORAGE_KEYS = {
  CATEGORIES: "mycad_components_categories_v1",
  PACKAGES: "mycad_components_packages_v1",
  DEVICES: "mycad_components_devices_v1",
  INITIALIZED: "mycad_components_initialized_v1",
};

export class ComponentStorageAdapter {
  /**
   * Получает путь к каталогу хранения (~/.mycad/components в Tauri или "localStorage" в Web)
   */
  public static async getStoragePath(): Promise<string> {
    if (isTauri()) {
      try {
        return await invoke<string>("get_components_dir");
      } catch (err) {
        console.warn("Ошибка вызова get_components_dir:", err);
      }
    }
    return "localStorage: ~/.mycad/components";
  }

  /**
   * Загружает всю библиотеку компонентов с диска
   */
  public static async loadLibrary(): Promise<ComponentLibraryPayload> {
    if (isTauri()) {
      try {
        // Гарантируем, что папки существуют
        await invoke<string>("init_component_storage");
        const payload = await invoke<ComponentLibraryPayload>("load_component_library");

        // Если в директориях еще нет данных (первый запуск в чистой системе)
        const hasData =
          (payload.packages && payload.packages.length > 0) ||
          (payload.devices && payload.devices.length > 0);

        if (!hasData) {
          // Инициализируем стандартными стартовыми корпусами и компонентами
          await this.seedDefaultLibraryToTauri();
          return DEFAULT_LIBRARY_PAYLOAD;
        }

        return {
          categories: payload.categories && payload.categories.length > 0 ? payload.categories : DEFAULT_LIBRARY_PAYLOAD.categories,
          packages: payload.packages || [],
          devices: payload.devices || [],
        };
      } catch (err) {
        console.warn("Ошибка загрузки библиотеки через Tauri, переключаемся на локальное хранилище:", err);
      }
    }

    // Web Fallback: localStorage
    return this.loadFromLocalStorage();
  }

  /**
   * Сохраняет девайс
   */
  public static async saveDevice(device: DeviceDefinition): Promise<void> {
    if (isTauri()) {
      await invoke("save_device", { device });
      return;
    }

    const payload = this.loadFromLocalStorage();
    const existingIdx = payload.devices.findIndex((d) => d.id === device.id);
    if (existingIdx >= 0) {
      payload.devices[existingIdx] = device;
    } else {
      payload.devices.push(device);
    }
    this.saveToLocalStorage(payload);
  }

  /**
   * Удаляет девайс
   */
  public static async deleteDevice(id: string): Promise<void> {
    if (isTauri()) {
      await invoke("delete_device", { id });
      return;
    }

    const payload = this.loadFromLocalStorage();
    payload.devices = payload.devices.filter((d) => d.id !== id);
    this.saveToLocalStorage(payload);
  }

  /**
   * Сохраняет физический корпус
   */
  public static async savePackage(pkg: PackageDefinition): Promise<void> {
    if (isTauri()) {
      await invoke("save_package", { package: pkg });
      return;
    }

    const payload = this.loadFromLocalStorage();
    const existingIdx = payload.packages.findIndex((p) => p.id === pkg.id);
    if (existingIdx >= 0) {
      payload.packages[existingIdx] = pkg;
    } else {
      payload.packages.push(pkg);
    }
    this.saveToLocalStorage(payload);
  }

  /**
   * Удаляет физический корпус
   */
  public static async deletePackage(id: string): Promise<void> {
    if (isTauri()) {
      await invoke("delete_package", { id });
      return;
    }

    const payload = this.loadFromLocalStorage();
    payload.packages = payload.packages.filter((p) => p.id !== id);
    this.saveToLocalStorage(payload);
  }

  /**
   * Сохраняет дерево категорий
   */
  public static async saveCategories(categories: CatalogCategory[]): Promise<void> {
    if (isTauri()) {
      await invoke("save_categories", { categories });
      return;
    }

    const payload = this.loadFromLocalStorage();
    payload.categories = categories;
    this.saveToLocalStorage(payload);
  }

  /**
   * Быстрый поиск девайсов через нативный бэкенд Rust
   */
  public static async searchDevices(
    query: string,
    category?: string,
    subcategory?: string,
    tag?: string
  ): Promise<DeviceDefinition[]> {
    if (isTauri()) {
      try {
        return await invoke<DeviceDefinition[]>("search_devices", {
          query,
          category: category || null,
          subcategory: subcategory || null,
          tag: tag || null,
        });
      } catch (err) {
        console.warn("Ошибка search_devices в Tauri:", err);
      }
    }
    return [];
  }

  /**
   * Получить девайс по ID из Rust
   */
  public static async getDevice(id: string): Promise<DeviceDefinition | null> {
    if (isTauri()) {
      try {
        return await invoke<DeviceDefinition | null>("get_device", { id });
      } catch (err) {
        console.warn("Ошибка get_device в Tauri:", err);
      }
    }
    return null;
  }

  /**
   * Получить корпус по ID из Rust
   */
  public static async getPackage(id: string): Promise<PackageDefinition | null> {
    if (isTauri()) {
      try {
        return await invoke<PackageDefinition | null>("get_package", { id });
      } catch (err) {
        console.warn("Ошибка get_package в Tauri:", err);
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Вспомогательные методы
  // -------------------------------------------------------------------------

  private static async seedDefaultLibraryToTauri(): Promise<void> {
    try {
      await invoke("save_categories", { categories: DEFAULT_LIBRARY_PAYLOAD.categories });
      for (const pkg of DEFAULT_LIBRARY_PAYLOAD.packages) {
        await invoke("save_package", { package: pkg });
      }
      for (const dev of DEFAULT_LIBRARY_PAYLOAD.devices) {
        await invoke("save_device", { device: dev });
      }
    } catch (err) {
      console.warn("Ошибка автозаполнения стандартных библиотек в Tauri:", err);
    }
  }

  private static loadFromLocalStorage(): ComponentLibraryPayload {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        this.saveToLocalStorage(DEFAULT_LIBRARY_PAYLOAD);
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
        return DEFAULT_LIBRARY_PAYLOAD;
      }

      const catsStr = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      const pkgsStr = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      const devsStr = localStorage.getItem(STORAGE_KEYS.DEVICES);

      return {
        categories: catsStr ? JSON.parse(catsStr) : DEFAULT_LIBRARY_PAYLOAD.categories,
        packages: pkgsStr ? JSON.parse(pkgsStr) : DEFAULT_LIBRARY_PAYLOAD.packages,
        devices: devsStr ? JSON.parse(devsStr) : DEFAULT_LIBRARY_PAYLOAD.devices,
      };
    } catch (err) {
      console.error("Ошибка чтения из localStorage, откат к стандартным:", err);
      return DEFAULT_LIBRARY_PAYLOAD;
    }
  }

  private static saveToLocalStorage(payload: ComponentLibraryPayload): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(payload.categories));
      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(payload.packages));
      localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(payload.devices));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
    } catch (err) {
      console.error("Ошибка записи в localStorage:", err);
    }
  }
}
