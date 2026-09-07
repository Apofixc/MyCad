import {
  BoardDocument,
  BoardImageLayer,
  ComponentItem,
  CrossProbingResult,
  LibraryDevice,
  PackageTemplate,
  ProjectManifest,
  RecentProject,
  RegistrationResult,
} from "../types/cad";

// Safe wrapper around window.__TAURI__
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args);
}

export const engineClient = {
  async createProject(path: string, name: string, author?: string, desc?: string): Promise<ProjectManifest> {
    return invokeTauri<ProjectManifest>("project_create", { path, name, author, desc });
  },

  async openProject(path: string): Promise<ProjectManifest> {
    return invokeTauri<ProjectManifest>("project_open", { path });
  },

  async saveProject(): Promise<void> {
    return invokeTauri<void>("project_save");
  },

  async getRecentProjects(): Promise<RecentProject[]> {
    return invokeTauri<RecentProject[]>("project_get_recents");
  },

  async removeRecentProject(path: string): Promise<void> {
    return invokeTauri<void>("project_remove_recent", { path });
  },

  async getActiveBoard(): Promise<BoardDocument | null> {
    return invokeTauri<BoardDocument | null>("board_get_active");
  },

  async addComponent(component: ComponentItem): Promise<ComponentItem> {
    return invokeTauri<ComponentItem>("board_add_component", { component });
  },

  async updateComponent(component: ComponentItem): Promise<ComponentItem> {
    return invokeTauri<ComponentItem>("board_update_component", { component });
  },

  async deleteComponent(componentId: string): Promise<void> {
    return invokeTauri<void>("board_delete_component", { componentId });
  },

  async getCrossProbing(netId: string): Promise<CrossProbingResult> {
    return invokeTauri<CrossProbingResult>("board_get_cross_probing", { netId });
  },

  async updateImageLayer(layer: BoardImageLayer): Promise<BoardImageLayer> {
    return invokeTauri<BoardImageLayer>("board_update_image_layer", { layer });
  },

  async calculateScale(p1: [number, number], p2: [number, number], realMm: number): Promise<number> {
    return invokeTauri<number>("cad_calculate_scale", { p1, p2, realMm });
  },

  async calculateLevel(p1: [number, number], p2: [number, number]): Promise<number> {
    return invokeTauri<number>("cad_calculate_level", { p1, p2 });
  },

  async calculateRegistration(
    top1: [number, number],
    top2: [number, number],
    bot1: [number, number],
    bot2: [number, number]
  ): Promise<RegistrationResult> {
    return invokeTauri<RegistrationResult>("cad_calculate_registration", { top1, top2, bot1, bot2 });
  },

  async importImage(filePath: string, side: "top" | "bottom"): Promise<BoardImageLayer> {
    return invokeTauri<BoardImageLayer>("image_import", { filePath, side });
  },

  async detectCorners(filePath: string): Promise<[[number, number], [number, number], [number, number], [number, number]]> {
    return invokeTauri<[[number, number], [number, number], [number, number], [number, number]]>("image_detect_corners", { filePath });
  },

  async searchLibrary(query: string): Promise<LibraryDevice[]> {
    return invokeTauri<LibraryDevice[]>("library_search", { query });
  },

  async getPackages(): Promise<PackageTemplate[]> {
    return invokeTauri<PackageTemplate[]>("library_get_packages");
  },
};

// ===================== MOCK IMPLEMENTATION FOR BROWSER PREVIEWS =====================
let mockManifest: ProjectManifest | null = null;
let mockBoard: BoardDocument | null = null;
let mockRecents: RecentProject[] = [
  {
    id: "rec_1",
    name: "Pirrs_1000_Lux.mycad",
    filePath: "C:/Projects/Pirrs_1000_Lux.mycad",
    componentCount: 146,
    lastOpened: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "rec_2",
    name: "Power_Supply_5V_2A.mycad",
    filePath: "C:/Projects/Power_Supply.mycad",
    componentCount: 42,
    lastOpened: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

function initDemoBoard(name: string): BoardDocument {
  return {
    id: "board_demo_1",
    name: `${name}.board`,
    type: "board",
    orderIndex: 0,
    data: {
      id: "board_demo_1",
      name: `${name}.board`,
      bgTop: { images: [] },
      bgBottom: { images: [] },
      nets: [
        { id: "GND", name: "GND", color: "#10b981", pinCount: 24 },
        { id: "VCC_3V3", name: "VCC_3V3", color: "#ef4444", pinCount: 8 },
        { id: "VCC_5V", name: "VCC_5V", color: "#f97316", pinCount: 6 },
        { id: "NET_I2C_SDA", name: "I2C_SDA", color: "#38bdf8", pinCount: 4 },
        { id: "NET_I2C_SCL", name: "I2C_SCL", color: "#a855f7", pinCount: 4 },
        { id: "NET_RESET", name: "NRST", color: "#eab308", pinCount: 3 },
      ],
      components: [
        {
          id: "comp_u1",
          refDes: "U1",
          value: "STM32F103C8T6",
          compType: "ic",
          layer: "top",
          x: 40.0,
          y: 35.0,
          rotation: 0,
          bodyShape: "rect",
          bodyWidth: 7.0,
          bodyHeight: 7.0,
          hasPolarityMark: true,
          pins: [
            { id: "p1", pinNumber: 1, name: "VBAT", relX: -4.0, relY: -3.0, shape: "rect", width: 1.2, height: 0.3, netId: "VCC_3V3" },
            { id: "p2", pinNumber: 2, name: "PC13", relX: -4.0, relY: -2.5, shape: "rect", width: 1.2, height: 0.3 },
            { id: "p8", pinNumber: 8, name: "VSSA", relX: -4.0, relY: 0.5, shape: "rect", width: 1.2, height: 0.3, netId: "GND" },
            { id: "p9", pinNumber: 9, name: "VDDA", relX: -4.0, relY: 1.0, shape: "rect", width: 1.2, height: 0.3, netId: "VCC_3V3" },
            { id: "p23", pinNumber: 23, name: "VSS_1", relX: 0.5, relY: 4.0, shape: "rect", width: 0.3, height: 1.2, netId: "GND" },
            { id: "p24", pinNumber: 24, name: "VDD_1", relX: 1.0, relY: 4.0, shape: "rect", width: 0.3, height: 1.2, netId: "VCC_3V3" },
            { id: "p35", pinNumber: 35, name: "VSS_2", relX: 4.0, relY: -0.5, shape: "rect", width: 1.2, height: 0.3, netId: "GND" },
            { id: "p36", pinNumber: 36, name: "VDD_2", relX: 4.0, relY: -1.0, shape: "rect", width: 1.2, height: 0.3, netId: "VCC_3V3" },
            { id: "p42", pinNumber: 42, name: "PB6_SCL", relX: 4.0, relY: 2.0, shape: "rect", width: 1.2, height: 0.3, netId: "NET_I2C_SCL" },
            { id: "p43", pinNumber: 43, name: "PB7_SDA", relX: 4.0, relY: 2.5, shape: "rect", width: 1.2, height: 0.3, netId: "NET_I2C_SDA" },
          ],
        },
        {
          id: "comp_c1",
          refDes: "C1",
          value: "100nF",
          compType: "capacitor",
          layer: "top",
          x: 32.0,
          y: 35.0,
          rotation: 90,
          bodyShape: "rect",
          bodyWidth: 2.0,
          bodyHeight: 1.25,
          pins: [
            { id: "c1_p1", pinNumber: 1, name: "1", relX: 0.0, relY: -0.9, shape: "rect", width: 1.0, height: 0.8, netId: "VCC_3V3" },
            { id: "c1_p2", pinNumber: 2, name: "2", relX: 0.0, relY: 0.9, shape: "rect", width: 1.0, height: 0.8, netId: "GND" },
          ],
        },
        {
          id: "comp_c2",
          refDes: "C2",
          value: "100nF",
          compType: "capacitor",
          layer: "top",
          x: 48.0,
          y: 35.0,
          rotation: 90,
          bodyShape: "rect",
          bodyWidth: 2.0,
          bodyHeight: 1.25,
          pins: [
            { id: "c2_p1", pinNumber: 1, name: "1", relX: 0.0, relY: -0.9, shape: "rect", width: 1.0, height: 0.8, netId: "VCC_3V3" },
            { id: "c2_p2", pinNumber: 2, name: "2", relX: 0.0, relY: 0.9, shape: "rect", width: 1.0, height: 0.8, netId: "GND" },
          ],
        },
        {
          id: "comp_r1",
          refDes: "R1",
          value: "10k",
          compType: "resistor",
          layer: "top",
          x: 40.0,
          y: 25.0,
          rotation: 0,
          bodyShape: "rect",
          bodyWidth: 2.0,
          bodyHeight: 1.25,
          pins: [
            { id: "r1_p1", pinNumber: 1, name: "1", relX: -0.9, relY: 0.0, shape: "rect", width: 0.8, height: 1.0, netId: "VCC_3V3" },
            { id: "r1_p2", pinNumber: 2, name: "2", relX: 0.9, relY: 0.0, shape: "rect", width: 0.8, height: 1.0, netId: "NET_RESET" },
          ],
        },
        {
          id: "comp_u2",
          refDes: "U2",
          value: "AMS1117-3.3",
          compType: "regulator",
          layer: "bottom",
          x: 60.0,
          y: 20.0,
          rotation: 180,
          bodyShape: "rect",
          bodyWidth: 6.5,
          bodyHeight: 3.5,
          pins: [
            { id: "u2_p1", pinNumber: 1, name: "GND", relX: -2.3, relY: 2.5, shape: "rect", width: 1.2, height: 1.8, netId: "GND" },
            { id: "u2_p2", pinNumber: 2, name: "VOUT", relX: 0.0, relY: 2.5, shape: "rect", width: 1.2, height: 1.8, netId: "VCC_3V3" },
            { id: "u2_p3", pinNumber: 3, name: "VIN", relX: 2.3, relY: 2.5, shape: "rect", width: 1.2, height: 1.8, netId: "VCC_5V" },
            { id: "u2_p4", pinNumber: 4, name: "TAB", relX: 0.0, relY: -2.5, shape: "rect", width: 3.5, height: 1.8, netId: "VCC_3V3" },
          ],
        },
      ],
    },
  };
}

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case "project_create": {
      const name = (args?.name as string) || "Project_1";
      mockManifest = {
        id: `proj_${Date.now()}`,
        name,
        author: (args?.author as string) || undefined,
        description: (args?.desc as string) || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formatVersion: 1,
        files: [{ id: "board_1", name: `${name}.board`, fileType: "board", path: `files/${name}.board.json`, orderIndex: 0 }],
      };
      mockBoard = initDemoBoard(name);
      return mockManifest as T;
    }
    case "project_open": {
      const path = (args?.path as string) || "Test.mycad";
      const name = path.split("/").pop()?.replace(".mycad", "") || "Opened_Project";
      mockManifest = {
        id: `proj_${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formatVersion: 1,
        files: [{ id: "board_1", name: `${name}.board`, fileType: "board", path: `files/${name}.board.json`, orderIndex: 0 }],
      };
      mockBoard = initDemoBoard(name);
      return mockManifest as T;
    }
    case "project_save":
      return undefined as T;
    case "project_get_recents":
      return mockRecents as T;
    case "project_remove_recent": {
      const path = args?.path as string;
      mockRecents = mockRecents.filter((r) => r.filePath !== path);
      return undefined as T;
    }
    case "board_get_active":
      return mockBoard as T;
    case "board_add_component": {
      const comp = args?.component as ComponentItem;
      if (mockBoard) mockBoard.data.components.push(comp);
      return comp as T;
    }
    case "board_update_component": {
      const comp = args?.component as ComponentItem;
      if (mockBoard) {
        const idx = mockBoard.data.components.findIndex((c) => c.id === comp.id);
        if (idx >= 0) mockBoard.data.components[idx] = comp;
      }
      return comp as T;
    }
    case "board_delete_component": {
      const id = args?.componentId as string;
      if (mockBoard) {
        mockBoard.data.components = mockBoard.data.components.filter((c) => c.id !== id);
      }
      return undefined as T;
    }
    case "board_get_cross_probing": {
      const netId = (args?.netId as string)?.trim().toUpperCase() || "";
      const pins: CrossProbingResult["pins"] = [];
      if (mockBoard) {
        for (const comp of mockBoard.data.components) {
          const rad = ((comp.rotation || 0) * Math.PI) / 180;
          for (const pin of comp.pins) {
            if (pin.netId?.toUpperCase() === netId) {
              const rx = pin.relX * Math.cos(rad) - pin.relY * Math.sin(rad);
              const ry = pin.relX * Math.sin(rad) + pin.relY * Math.cos(rad);
              pins.push({
                componentId: comp.id,
                refDes: comp.refDes,
                pinNumber: pin.pinNumber,
                pinName: pin.name,
                layer: comp.layer,
                absX: comp.x + rx,
                absY: comp.y + ry,
              });
            }
          }
        }
      }
      return { netId, netName: netId, pins } as T;
    }
    case "cad_calculate_scale": {
      const p1 = args?.p1 as [number, number];
      const p2 = args?.p2 as [number, number];
      const realMm = args?.realMm as number;
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const distPx = Math.sqrt(dx * dx + dy * dy);
      return (distPx / realMm) as T;
    }
    case "cad_calculate_level": {
      const p1 = args?.p1 as [number, number];
      const p2 = args?.p2 as [number, number];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      return ((Math.atan2(dy, dx) * 180) / Math.PI) as T;
    }
    case "cad_calculate_registration": {
      return { offsetX: 0, offsetY: 0, rotationDeg: 0, scaleFactor: 1.0 } as T;
    }
    case "library_search": {
      return [] as T;
    }
    case "library_get_packages": {
      return [] as T;
    }
    default:
      return null as T;
  }
}
