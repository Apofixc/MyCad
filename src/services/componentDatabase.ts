// src/services/componentDatabase.ts
// Главный сервис базы данных компонентов MyCad

import {
  CatalogCategory,
  PackageDefinition,
  DeviceDefinition,
  ComponentLibraryPayload,
} from "../types/componentLibrary";
import { ComponentItem, Pin, BoardSide } from "../types/project";
import { ComponentStorageAdapter } from "./componentStorageAdapter";

// Масштабный коэффициент: сколько экранных CAD-пикселей в 1 мм
export const CAD_PIXELS_PER_MM = 10;

export class ComponentDatabaseService {
  private static instance: ComponentDatabaseService | null = null;

  private categories: CatalogCategory[] = [];
  private packages: Map<string, PackageDefinition> = new Map();
  private devices: Map<string, DeviceDefinition> = new Map();
  private isLoaded: boolean = false;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  public static getInstance(): ComponentDatabaseService {
    if (!ComponentDatabaseService.instance) {
      ComponentDatabaseService.instance = new ComponentDatabaseService();
    }
    return ComponentDatabaseService.instance;
  }

  /**
   * Подписка на изменение данных библиотеки
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb());
  }

  /**
   * Инициализация и загрузка данных с диска
   */
  public async load(): Promise<void> {
    const payload = await ComponentStorageAdapter.loadLibrary();
    this.setPayload(payload);
    this.isLoaded = true;
    this.notify();
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  private setPayload(payload: ComponentLibraryPayload): void {
    this.categories = payload.categories || [];
    this.packages.clear();
    for (const pkg of payload.packages || []) {
      this.packages.set(pkg.id, pkg);
    }
    this.devices.clear();
    for (const dev of payload.devices || []) {
      this.devices.set(dev.id, dev);
    }
  }

  // -------------------------------------------------------------------------
  // ЧТЕНИЕ И ПОИСК
  // -------------------------------------------------------------------------

  public getCategories(): CatalogCategory[] {
    return this.categories;
  }

  public getAllPackages(): PackageDefinition[] {
    return Array.from(this.packages.values());
  }

  public getPackage(id: string): PackageDefinition | undefined {
    return this.packages.get(id);
  }

  public getAllDevices(): DeviceDefinition[] {
    return Array.from(this.devices.values());
  }

  public getDevice(id: string): DeviceDefinition | undefined {
    return this.devices.get(id);
  }

  /**
   * Поиск девайсов с фильтрацией
   */
  public searchDevices(options: {
    query?: string;
    categoryId?: string;
    subcategoryId?: string;
    mountType?: "all" | "tht" | "smd";
  }): DeviceDefinition[] {
    const query = options.query?.trim().toLowerCase() || "";
    const { categoryId, subcategoryId, mountType } = options;

    return this.getAllDevices().filter((dev) => {
      // Фильтр по категории
      if (categoryId && dev.category !== categoryId) return false;
      // Фильтр по подкатегории
      if (subcategoryId && dev.subcategory !== subcategoryId) return false;

      // Фильтр по типу монтажа (через поддерживаемые корпуса)
      if (mountType && mountType !== "all") {
        const hasMatchingPackage = dev.supportedPackages.some((m) => {
          const pkg = this.packages.get(m.packageId);
          return pkg && pkg.mountType === mountType;
        });
        if (!hasMatchingPackage) return false;
      }

      // Полнотекстовый поиск
      if (query) {
        const matchesName = dev.name.toLowerCase().includes(query);
        const matchesValue = dev.parameters.value?.toLowerCase().includes(query);
        const matchesPrefix = dev.designatorPrefix.toLowerCase().includes(query);
        const matchesDesc = dev.description.toLowerCase().includes(query);
        const matchesTags = dev.tags.some((t) => t.toLowerCase().includes(query));
        const matchesPins = dev.logicalPins.some((p) =>
          p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query)
        );

        if (!matchesName && !matchesValue && !matchesPrefix && !matchesDesc && !matchesTags && !matchesPins) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Поиск корпусов с фильтрацией
   */
  public searchPackages(options: {
    query?: string;
    family?: string;
    mountType?: "all" | "tht" | "smd";
  }): PackageDefinition[] {
    const query = options.query?.trim().toLowerCase() || "";
    const { family, mountType } = options;

    return this.getAllPackages().filter((pkg) => {
      if (family && pkg.family !== family) return false;
      if (mountType && mountType !== "all" && pkg.mountType !== mountType) return false;

      if (query) {
        const matchesName = pkg.name.toLowerCase().includes(query);
        const matchesId = pkg.id.toLowerCase().includes(query);
        const matchesStandard = pkg.standard?.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesStandard) return false;
      }

      return true;
    });
  }

  // -------------------------------------------------------------------------
  // МОДИФИКАЦИЯ ДАННЫХ
  // -------------------------------------------------------------------------

  public async saveDevice(device: DeviceDefinition): Promise<void> {
    this.devices.set(device.id, device);
    await ComponentStorageAdapter.saveDevice(device);
    this.notify();
  }

  public async deleteDevice(id: string): Promise<void> {
    this.devices.delete(id);
    await ComponentStorageAdapter.deleteDevice(id);
    this.notify();
  }

  public async savePackage(pkg: PackageDefinition): Promise<void> {
    this.packages.set(pkg.id, pkg);
    await ComponentStorageAdapter.savePackage(pkg);
    this.notify();
  }

  public async deletePackage(id: string): Promise<void> {
    this.packages.delete(id);
    await ComponentStorageAdapter.deletePackage(id);
    this.notify();
  }

  public async saveCategories(categories: CatalogCategory[]): Promise<void> {
    this.categories = categories;
    await ComponentStorageAdapter.saveCategories(categories);
    this.notify();
  }

  // -------------------------------------------------------------------------
  // ИНСТАНЦИРОВАНИЕ НА ПЛАТЕ
  // -------------------------------------------------------------------------

  /**
   * Вычисляет следующий позиционный номер (R1 -> R2, DA1 -> DA2...)
   */
  public getNextRefDes(prefix: string, existingComponents: ComponentItem[]): string {
    const cleanPrefix = prefix.trim().toUpperCase() || "U";
    let maxNum = 0;

    const regex = new RegExp(`^${cleanPrefix}(\\d+)$`, "i");
    for (const comp of existingComponents) {
      const match = comp.refDes.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    return `${cleanPrefix}${maxNum + 1}`;
  }

  /**
   * Создает готовый ComponentItem для размещения на плате
   */
  public instantiateComponent(options: {
    deviceId: string;
    packageId?: string;
    variantId?: string;
    x: number;
    y: number;
    layer?: BoardSide;
    existingComponents: ComponentItem[];
  }): ComponentItem {
    const dev = this.getDevice(options.deviceId);
    if (!dev) {
      throw new Error(`Девайс ${options.deviceId} не найден в библиотеке`);
    }

    // Выбираем корпус: явно переданный или первый из поддерживаемых
    const mapping =
      options.packageId
        ? dev.supportedPackages.find((m) => m.packageId === options.packageId) || dev.supportedPackages[0]
        : dev.supportedPackages[0];

    const packageId = mapping ? mapping.packageId : "PKG_0805";
    const pkg = this.getPackage(packageId);

    // Выбираем вариант исполнения корпуса
    const defaultVariant = pkg ? (pkg.variants.find((v) => v.id === options.variantId) || pkg.variants.find((v) => v.id === pkg.defaultVariantId) || pkg.variants[0]) : undefined;
    const variantId = defaultVariant?.id || options.variantId || "default";

    // Позиционное обозначение (RefDes)
    const refDes = this.getNextRefDes(dev.designatorPrefix, options.existingComponents);

    // Расчет физических контактных площадок
    const pins: Pin[] = [];
    if (pkg && pkg.pads.length > 0) {
      // Собираем обратный маппинг: padNum -> logicalPin
      const padToLogical: Record<number, string> = {};
      if (mapping) {
        for (const [logPinId, padNum] of Object.entries(mapping.pinMap)) {
          padToLogical[padNum] = logPinId;
        }
      }

      for (const pad of pkg.pads) {
        const logicalPinId = padToLogical[pad.padNum] || pad.name || String(pad.padNum);
        const logPinDef = dev.logicalPins.find((p) => p.id === logicalPinId);

        pins.push({
          id: `p_${pad.padNum}`,
          number: pad.padNum,
          name: logPinDef?.name || pad.name || String(pad.padNum),
          x: Math.round(pad.x * CAD_PIXELS_PER_MM),
          y: Math.round(pad.y * CAD_PIXELS_PER_MM),
          padNum: pad.padNum,
          logicalPinId: logPinDef?.id,
          shape: pad.shape,
          width: Math.round(pad.width * CAD_PIXELS_PER_MM),
          height: Math.round(pad.height * CAD_PIXELS_PER_MM),
          drillDiameter: pad.drillDiameter ? Math.round(pad.drillDiameter * CAD_PIXELS_PER_MM) : undefined,
          electricalType: logPinDef?.electricalType,
        });
      }
    } else {
      // Резервный расчет 2-х пинов, если корпус не найден
      pins.push(
        { id: "p_1", number: 1, name: "1", x: -15, y: 0, width: 10, height: 10, shape: "circle" },
        { id: "p_2", number: 2, name: "2", x: 15, y: 0, width: 10, height: 10, shape: "circle" }
      );
    }

    const valueStr = dev.parameters.value || dev.name;

    return {
      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      refDes,
      value: valueStr,
      type: pkg?.family || "resistor",
      x: options.x,
      y: options.y,
      rotation: 0,
      layer: options.layer || "top",
      pins,
      deviceId: dev.id,
      packageId: pkg?.id,
      variantId,
      description: dev.description,
      category: dev.category,
      subcategory: dev.subcategory,
      packageFamily: pkg?.family,
      bodyWidth: pkg ? Math.round(pkg.bodyWidth * CAD_PIXELS_PER_MM) : 40,
      bodyHeight: pkg ? Math.round(pkg.bodyHeight * CAD_PIXELS_PER_MM) : 20,
      bodyColor: defaultVariant?.bodyColor,
      keyType: defaultVariant?.keyType,
      hasPolarityMark: defaultVariant?.hasPolarityMark,
    };
  }
}
