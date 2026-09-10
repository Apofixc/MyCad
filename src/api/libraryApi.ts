// src/api/libraryApi.ts
// Клиентский API для вызова Tauri-команд управления библиотекой компонентов и посадочных мест

import { invoke } from "@tauri-apps/api/core";
import {
  ComponentLibraryPayload,
  DeviceDefinition,
  PackageDefinition,
  PlacedComponent,
} from "../types/componentLibrary";
import { ProjectFullState } from "../types/cad";

export const libraryApi = {
  /** Загрузка всей библиотеки (категории, корпуса, девайсы) */
  async loadAll(): Promise<ComponentLibraryPayload> {
    return await invoke<ComponentLibraryPayload>("library_load_all");
  },

  /** Получить список всех посадочных мест */
  async listPackages(): Promise<PackageDefinition[]> {
    return await invoke<PackageDefinition[]>("library_list_packages");
  },

  /** Получить посадочное место по ID */
  async getPackage(id: string): Promise<PackageDefinition | null> {
    return await invoke<PackageDefinition | null>("library_get_package", { id });
  },

  /** Сохранить посадочное место */
  async savePackage(pkg: PackageDefinition): Promise<void> {
    await invoke("library_save_package", { package: pkg });
  },

  /** Удалить посадочное место */
  async deletePackage(id: string): Promise<void> {
    await invoke("library_delete_package", { id });
  },

  /** Получить список всех радиодеталей */
  async listDevices(): Promise<DeviceDefinition[]> {
    return await invoke<DeviceDefinition[]>("library_list_devices");
  },

  /** Получить радиодеталь по ID */
  async getDevice(id: string): Promise<DeviceDefinition | null> {
    return await invoke<DeviceDefinition | null>("library_get_device", { id });
  },

  /** Сохранить радиодеталь */
  async saveDevice(device: DeviceDefinition): Promise<void> {
    await invoke("library_save_device", { device });
  },

  /** Удалить радиодеталь */
  async deleteDevice(id: string): Promise<void> {
    await invoke("library_delete_device", { id });
  },

  /** Поиск радиодеталей по фильтрам */
  async searchDevices(
    query: string,
    category?: string,
    subcategory?: string,
    tag?: string
  ): Promise<DeviceDefinition[]> {
    return await invoke<DeviceDefinition[]>("library_search_devices", {
      query,
      category,
      subcategory,
      tag,
    });
  },

  /** Экспорт всей библиотеки в формат JSON */
  async exportJson(): Promise<string> {
    return await invoke<string>("library_export_json");
  },

  /** Импорт библиотеки из JSON */
  async importJson(jsonStr: string): Promise<number> {
    return await invoke<number>("library_import_json", { jsonStr });
  },

  /** Добавить размещенный компонент на плату */
  async boardAddComponent(
    boardId: string,
    component: PlacedComponent
  ): Promise<ProjectFullState> {
    return await invoke<ProjectFullState>("board_add_component", {
      boardId,
      component,
    });
  },

  /** Обновить свойства компонента на плате */
  async boardUpdateComponent(
    boardId: string,
    component: PlacedComponent
  ): Promise<ProjectFullState> {
    return await invoke<ProjectFullState>("board_update_component", {
      boardId,
      component,
    });
  },

  /** Удалить компонент с платы */
  async boardDeleteComponent(
    boardId: string,
    componentId: string
  ): Promise<ProjectFullState> {
    return await invoke<ProjectFullState>("board_delete_component", {
      boardId,
      componentId,
    });
  },
};
