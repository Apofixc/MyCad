// src/stores/libraryStore.ts
// Реактивное Zustand-хранилище библиотеки компонентов и посадочных мест

import { create } from "zustand";
import {
  CatalogCategory,
  ComponentLibraryPayload,
  DeviceDefinition,
  PackageDefinition,
} from "../types/componentLibrary";
import { libraryApi } from "../api/libraryApi";
import { reportError } from "../utils/errorHandler";

interface LibraryState {
  categories: CatalogCategory[];
  packages: PackageDefinition[];
  devices: DeviceDefinition[];
  selectedPackageId: string | null;
  selectedDeviceId: string | null;
  isLoading: boolean;
  error: string | null;

  // Действия
  loadAll: () => Promise<ComponentLibraryPayload | null>;
  selectPackage: (id: string | null) => void;
  selectDevice: (id: string | null) => void;
  getPackage: (id: string) => PackageDefinition | undefined;
  getDevice: (id: string) => DeviceDefinition | undefined;
  savePackage: (pkg: PackageDefinition) => Promise<boolean>;
  deletePackage: (id: string) => Promise<boolean>;
  saveDevice: (dev: DeviceDefinition) => Promise<boolean>;
  deleteDevice: (id: string) => Promise<boolean>;
  exportLibrary: () => Promise<string | null>;
  importLibrary: (jsonStr: string) => Promise<number>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  categories: [],
  packages: [],
  devices: [],
  selectedPackageId: null,
  selectedDeviceId: null,
  isLoading: false,
  error: null,

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const payload = await libraryApi.loadAll();
      set({
        categories: payload.categories,
        packages: payload.packages,
        devices: payload.devices,
        isLoading: false,
      });
      return payload;
    } catch (e: any) {
      console.error("Ошибка загрузки библиотеки:", e);
      set({ error: String(e), isLoading: false });
      return null;
    }
  },

  selectPackage: (id: string | null) => set({ selectedPackageId: id }),
  selectDevice: (id: string | null) => set({ selectedDeviceId: id }),

  getPackage: (id: string) => {
    return get().packages.find((p) => p.id === id);
  },

  getDevice: (id: string) => {
    return get().devices.find((d) => d.id === id);
  },

  savePackage: async (pkg: PackageDefinition) => {
    set({ isLoading: true, error: null });
    try {
      await libraryApi.savePackage(pkg);
      // Обновляем локальный список
      const existing = get().packages;
      const index = existing.findIndex((p) => p.id === pkg.id);
      let updated: PackageDefinition[];
      if (index >= 0) {
        updated = [...existing];
        updated[index] = pkg;
      } else {
        updated = [...existing, pkg];
      }
      set({ packages: updated, selectedPackageId: pkg.id, isLoading: false });
      return true;
    } catch (e: any) {
      reportError(e, "Ошибка сохранения посадочного места");
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  deletePackage: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await libraryApi.deletePackage(id);
      const updated = get().packages.filter((p) => p.id !== id);
      set({
        packages: updated,
        selectedPackageId: get().selectedPackageId === id ? null : get().selectedPackageId,
        isLoading: false,
      });
      return true;
    } catch (e: any) {
      console.error("Ошибка удаления посадочного места:", e);
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  saveDevice: async (dev: DeviceDefinition) => {
    set({ isLoading: true, error: null });
    try {
      await libraryApi.saveDevice(dev);
      const existing = get().devices;
      const index = existing.findIndex((d) => d.id === dev.id);
      let updated: DeviceDefinition[];
      if (index >= 0) {
        updated = [...existing];
        updated[index] = dev;
      } else {
        updated = [...existing, dev];
      }
      set({ devices: updated, selectedDeviceId: dev.id, isLoading: false });
      return true;
    } catch (e: any) {
      reportError(e, "Ошибка сохранения радиодетали");
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  deleteDevice: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await libraryApi.deleteDevice(id);
      const updated = get().devices.filter((d) => d.id !== id);
      set({
        devices: updated,
        selectedDeviceId: get().selectedDeviceId === id ? null : get().selectedDeviceId,
        isLoading: false,
      });
      return true;
    } catch (e: any) {
      console.error("Ошибка удаления радиодетали:", e);
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  exportLibrary: async () => {
    try {
      return await libraryApi.exportJson();
    } catch (e: any) {
      console.error("Ошибка экспорта библиотеки:", e);
      return null;
    }
  },

  importLibrary: async (jsonStr: string) => {
    set({ isLoading: true, error: null });
    try {
      const count = await libraryApi.importJson(jsonStr);
      await get().loadAll();
      return count;
    } catch (e: any) {
      console.error("Ошибка импорта библиотеки:", e);
      set({ error: String(e), isLoading: false });
      return 0;
    }
  },
}));
