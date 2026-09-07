import {
  BoardDocument,
  BoardImageLayer,
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
};

// ===================== MOCK IMPLEMENTATION FOR BROWSER PREVIEWS =====================
let mockManifest: ProjectManifest | null = null;
let mockBoard: BoardDocument | null = null;
let mockRecents: RecentProject[] = [
  {
    id: "rec_1",
    name: "Board_PCB_Rev2.mycad",
    filePath: "C:/Projects/Board_PCB_Rev2.mycad",
    componentCount: 0,
    lastOpened: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "rec_2",
    name: "Power_Module_48V.mycad",
    filePath: "C:/Projects/Power_Module.mycad",
    componentCount: 0,
    lastOpened: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

function initCleanBoard(name: string): BoardDocument {
  return {
    id: "board_1",
    name: `${name}.board`,
    type: "board",
    orderIndex: 0,
    data: {
      id: "board_1",
      name: `${name}.board`,
      bgTop: { images: [] },
      bgBottom: { images: [] },
    },
  };
}

async function mockInvoke<T>(cmd: string, args?: any): Promise<T> {
  console.log(`[MockIPC] Invoking: ${cmd}`, args);
  await new Promise((r) => setTimeout(r, 60));

  switch (cmd) {
    case "project_create": {
      const id = `proj_${Date.now()}`;
      mockManifest = {
        id,
        name: args.name,
        author: args.author,
        description: args.desc,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formatVersion: 1,
        files: [
          {
            id: `board_${Date.now()}`,
            name: `${args.name}.board`,
            fileType: "board",
            path: `files/${args.name}.board.json`,
            orderIndex: 0,
          },
        ],
      };
      mockBoard = initCleanBoard(args.name);
      return mockManifest as unknown as T;
    }

    case "project_open": {
      const fileName = args.path.split("/").pop()?.replace(".mycad", "") || "Imported_Board";
      mockManifest = {
        id: `proj_opened`,
        name: fileName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formatVersion: 1,
        files: [
          {
            id: "board_opened",
            name: `${fileName}.board`,
            fileType: "board",
            path: `files/${fileName}.board.json`,
            orderIndex: 0,
          },
        ],
      };
      mockBoard = initCleanBoard(fileName);
      return mockManifest as unknown as T;
    }

    case "project_save":
      return undefined as unknown as T;

    case "project_get_recents":
      return mockRecents as unknown as T;

    case "project_remove_recent":
      mockRecents = mockRecents.filter((r) => r.filePath !== args.path);
      return undefined as unknown as T;

    case "board_get_active":
      return mockBoard as unknown as T;

    case "board_update_image_layer": {
      if (mockBoard) {
        const layer: BoardImageLayer = args.layer;
        const target = layer.side === "top" ? mockBoard.data.bgTop.images : mockBoard.data.bgBottom.images;
        const idx = target.findIndex((img) => img.id === layer.id);
        if (idx >= 0) target[idx] = layer;
        else target.push(layer);
      }
      return args.layer as T;
    }

    case "cad_calculate_scale": {
      const [x1, y1] = args.p1;
      const [x2, y2] = args.p2;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      return (dist / args.realMm) as unknown as T;
    }

    case "cad_calculate_level": {
      const [x1, y1] = args.p1;
      const [x2, y2] = args.p2;
      const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      return deg as unknown as T;
    }

    case "cad_calculate_registration": {
      return {
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        scaleFactor: 1.0,
      } as unknown as T;
    }

    case "image_import": {
      const side = args.side || "top";
      const layer: BoardImageLayer = {
        id: `img_${side}_${Date.now()}`,
        name: args.filePath.split(/[/\\]/).pop() || `${side}_layer.png`,
        side,
        cachedUrl: args.filePath,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lockAspectRatio: true,
        rotation: 0,
        opacity: 0.85,
        brightness: 100,
        contrast: 100,
        invert: false,
        grayscale: false,
        blendMode: "normal",
        tintColor: "none",
        dpi: 600,
        pxPerMm: 23.62,
        mirrored: false,
        flipV: false,
        locked: false,
        visible: true,
        width: 1920,
        height: 1080,
      };
      if (mockBoard) {
        if (side === "top") mockBoard.data.bgTop.images.push(layer);
        else mockBoard.data.bgBottom.images.push(layer);
      }
      return layer as unknown as T;
    }

    case "image_detect_corners": {
      return [
        [50, 50],
        [1870, 50],
        [1870, 1030],
        [50, 1030],
      ] as unknown as T;
    }

    default:
      throw new Error(`[MockIPC] Unknown command: ${cmd}`);
  }
}
