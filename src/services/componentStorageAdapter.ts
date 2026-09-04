// src/services/componentStorageAdapter.ts
// Адаптер доступа к библиотеке компонентов MyCad через нативный Tauri IPC

import { invoke } from "@tauri-apps/api/core";
import {
  CatalogCategory,
  PackageDefinition,
  DeviceDefinition,
  ComponentLibraryPayload,
} from "../types/componentLibrary";

export class ComponentStorageAdapter {
  /**
   * Получает путь к каталогу хранения (~/.mycad/components)
   */
  public static async getStoragePath(): Promise<string> {
    try {
      return await invoke<string>("get_components_dir");
    } catch (err) {
      console.warn("Ошибка вызова get_components_dir:", err);
      return "~/.mycad/components";
    }
  }

  /**
   * Загружает всю библиотеку компонентов с диска
   * (Rust автоматически создает стандартные категории, корпуса и устройства при первом запуске)
   */
  public static async loadLibrary(): Promise<ComponentLibraryPayload> {
    await invoke<string>("init_component_storage");
    return await invoke<ComponentLibraryPayload>("load_component_library");
  }

  /**
   * Сохраняет устройство с валидацией целостности в Rust
   */
  public static async saveDevice(device: DeviceDefinition): Promise<void> {
    await invoke("save_device", { device });
  }

  /**
   * Удаляет устройство
   */
  public static async deleteDevice(id: string): Promise<void> {
    await invoke("delete_device", { id });
  }

  /**
   * Сохраняет физический корпус с валидацией геометрии в Rust
   */
  public static async savePackage(pkg: PackageDefinition): Promise<void> {
    await invoke("save_package", { package: pkg });
  }

  /**
   * Удаляет физический корпус
   */
  public static async deletePackage(id: string): Promise<void> {
    await invoke("delete_package", { id });
  }

  /**
   * Сохраняет дерево категорий
   */
  public static async saveCategories(categories: CatalogCategory[]): Promise<void> {
    await invoke("save_categories", { categories });
  }

  /**
   * Быстрый полнотекстовый поиск устройств через нативный бэкенд Rust
   */
  public static async searchDevices(
    query: string,
    category?: string,
    subcategory?: string,
    tag?: string
  ): Promise<DeviceDefinition[]> {
    try {
      return await invoke<DeviceDefinition[]>("search_devices", {
        query,
        category: category || null,
        subcategory: subcategory || null,
        tag: tag || null,
      });
    } catch (err) {
      console.warn("Ошибка search_devices в Tauri:", err);
      return [];
    }
  }

  /**
   * Получить девайс по ID из базы Rust
   */
  public static async getDevice(id: string): Promise<DeviceDefinition | null> {
    try {
      return await invoke<DeviceDefinition | null>("get_device", { id });
    } catch (err) {
      console.warn("Ошибка get_device в Tauri:", err);
      return null;
    }
  }

  /**
   * Получить корпус по ID из базы Rust
   */
  public static async getPackage(id: string): Promise<PackageDefinition | null> {
    try {
      return await invoke<PackageDefinition | null>("get_package", { id });
    } catch (err) {
      console.warn("Ошибка get_package в Tauri:", err);
      return null;
    }
  }
}
