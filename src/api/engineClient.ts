import {
  BoardDocument,
  BoardImageLayer,
  ProjectFullState,
  ProjectManifest,
  RecentProject,
  RegistrationResult,
  SchematicDocument,
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
  async createProject(path: string, name: string, author?: string, desc?: string): Promise<ProjectFullState> {
    return invokeTauri<ProjectFullState>("project_create", { path, name, author, desc });
  },

  async openProject(path: string): Promise<ProjectFullState> {
    return invokeTauri<ProjectFullState>("project_open", { path });
  },

  async getProjectState(): Promise<ProjectFullState | null> {
    return invokeTauri<ProjectFullState | null>("project_get_state");
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

  async getActiveSchematic(): Promise<SchematicDocument | null> {
    return invokeTauri<SchematicDocument | null>("schematic_get_active");
  },

  async addProjectFile(fileType: "board" | "schematic", name?: string): Promise<ProjectFullState> {
    return invokeTauri<ProjectFullState>("project_add_file", { fileType, name });
  },

  async removeProjectFile(fileId: string): Promise<ProjectFullState> {
    return invokeTauri<ProjectFullState>("project_remove_file", { fileId });
  },

  async renameProjectFile(fileId: string, newName: string): Promise<ProjectFullState> {
    return invokeTauri<ProjectFullState>("project_rename_file", { fileId, newName });
  },

  async setActiveFile(fileId: string): Promise<ProjectFullState> {
    return invokeTauri<ProjectFullState>("project_set_active_file", { fileId });
  },

  async updateImageLayer(layer: BoardImageLayer): Promise<BoardImageLayer> {
    return invokeTauri<BoardImageLayer>("board_update_image_layer", { layer });
  },

  async updateImageLayers(layers: BoardImageLayer[]): Promise<BoardImageLayer[]> {
    try {
      return await invokeTauri<BoardImageLayer[]>("board_update_image_layers", { layers });
    } catch {
      return await Promise.all(layers.map((l) => invokeTauri<BoardImageLayer>("board_update_image_layer", { layer: l })));
    }
  },

  async deleteImageLayer(layerId: string): Promise<void> {
    return invokeTauri<void>("board_delete_image_layer", { layerId });
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

  async readImageBytes(filePath: string): Promise<number[]> {
    return invokeTauri<number[]>("image_read_bytes", { filePath });
  },
};

/**
 * Resolves an image path or URL into a webview-loadable URL (asset:// or blob:).
 */
export async function resolveImageUrl(urlOrPath: string): Promise<string> {
  if (!urlOrPath) return "";
  if (
    urlOrPath.startsWith("data:") ||
    urlOrPath.startsWith("blob:") ||
    urlOrPath.startsWith("http://") ||
    urlOrPath.startsWith("https://")
  ) {
    return urlOrPath;
  }

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(urlOrPath);
    } catch (e) {
      console.warn("convertFileSrc failed:", e);
    }
  }

  return urlOrPath;
}


// ===================== MOCK IMPLEMENTATION FOR BROWSER PREVIEWS =====================
let mockManifest: ProjectManifest | null = null;
let mockBoard: BoardDocument | null = null;
let mockRecents: RecentProject[] = [
  {
    id: "rec_1",
    name: "Board_PCB_Rev2.mycad",
    filePath: "C:/Projects/Board_PCB_Rev2.mycad",
    lastOpened: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "rec_2",
    name: "Power_Module_48V.mycad",
    filePath: "C:/Projects/Power_Module.mycad",
    lastOpened: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

let mockSchematic: SchematicDocument | null = null;
let mockActiveFileId: string | null = null;

function initCleanBoard(id: string, name: string): BoardDocument {
  return {
    id,
    name,
    type: "board",
    orderIndex: 0,
    data: {
      id,
      name,
      bgTop: { images: [] },
      bgBottom: { images: [] },
    },
  };
}

function initCleanSchematic(id: string, name: string): SchematicDocument {
  return {
    id,
    name,
    type: "schematic",
    orderIndex: 0,
    data: {
      id,
      name,
      components: [],
      nets: [],
    },
  };
}

function getMockFullState(): ProjectFullState {
  return {
    manifest: mockManifest!,
    boards: mockBoard ? [mockBoard] : [],
    schematics: mockSchematic ? [mockSchematic] : [],
    activeFileId: mockActiveFileId,
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
        files: [],
      };
      mockBoard = null;
      mockSchematic = null;
      mockActiveFileId = null;
      return getMockFullState() as unknown as T;
    }

    case "project_open": {
      const fileName = args.path.split("/").pop()?.replace(".mycad", "") || "Imported_Board";
      const boardId = "board_opened";
      mockManifest = {
        id: `proj_opened`,
        name: fileName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formatVersion: 1,
        files: [
          {
            id: boardId,
            name: `${fileName}.board`,
            fileType: "board",
            path: `files/${boardId}.board.json`,
            orderIndex: 0,
          },
        ],
      };
      mockActiveFileId = boardId;
      mockBoard = initCleanBoard(boardId, `${fileName}.board`);
      mockSchematic = null;
      return getMockFullState() as unknown as T;
    }

    case "project_get_state": {
      if (!mockManifest) return null as unknown as T;
      return getMockFullState() as unknown as T;
    }

    case "project_add_file": {
      if (!mockManifest) throw new Error("Нет открытого проекта");
      const { fileType, name } = args;
      const id = `${fileType}_${Date.now()}`;
      const defaultName = fileType === "board" ? "Печатная плата" : "Принципиальная схема";
      const finalName = name?.trim() || defaultName;

      mockManifest.files.push({
        id,
        name: finalName,
        fileType,
        path: `files/${id}.${fileType}.json`,
        orderIndex: mockManifest.files.length,
      });
      mockActiveFileId = id;

      if (fileType === "board") {
        mockBoard = initCleanBoard(id, finalName);
      } else {
        mockSchematic = initCleanSchematic(id, finalName);
      }

      return getMockFullState() as unknown as T;
    }

    case "project_remove_file": {
      if (!mockManifest) throw new Error("Нет открытого проекта");
      const { fileId } = args;
      mockManifest.files = mockManifest.files.filter((f) => f.id !== fileId);
      if (mockBoard?.id === fileId) mockBoard = null;
      if (mockSchematic?.id === fileId) mockSchematic = null;
      if (mockActiveFileId === fileId) {
        mockActiveFileId = mockManifest.files[0]?.id || null;
      }
      return getMockFullState() as unknown as T;
    }

    case "project_rename_file": {
      if (!mockManifest) throw new Error("Нет открытого проекта");
      const { fileId, newName } = args;
      const f = mockManifest.files.find((x) => x.id === fileId);
      if (f) f.name = newName;
      if (mockBoard && mockBoard.id === fileId) mockBoard.name = newName;
      if (mockSchematic && mockSchematic.id === fileId) mockSchematic.name = newName;
      return getMockFullState() as unknown as T;
    }

    case "project_set_active_file": {
      mockActiveFileId = args.fileId;
      return getMockFullState() as unknown as T;
    }

    case "board_delete_image_layer": {
      if (mockBoard) {
        mockBoard.data.bgTop.images = mockBoard.data.bgTop.images.filter((img) => img.id !== args.layerId);
        mockBoard.data.bgBottom.images = mockBoard.data.bgBottom.images.filter((img) => img.id !== args.layerId);
      }
      return undefined as unknown as T;
    }

    case "schematic_get_active":
      return mockSchematic as unknown as T;

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

    case "board_update_image_layers": {
      if (mockBoard) {
        const layers: BoardImageLayer[] = args.layers;
        for (const layer of layers) {
          const target = layer.side === "top" ? mockBoard.data.bgTop.images : mockBoard.data.bgBottom.images;
          const idx = target.findIndex((img) => img.id === layer.id);
          if (idx >= 0) target[idx] = layer;
          else target.push(layer);
        }
      }
      return args.layers as T;
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

    case "image_read_bytes": {
      return [] as unknown as T;
    }

    case "detect_board_corners": {
      return {
        topLeft: { x: 50, y: 50 },
        topRight: { x: 1870, y: 50 },
        bottomRight: { x: 1870, y: 1030 },
        bottomLeft: { x: 50, y: 1030 },
      } as unknown as T;
    }

    case "process_board_image": {
      return {
        dataUrl: args.request?.source || "",
        filePath: undefined,
        width: 1920,
        height: 1080,
      } as unknown as T;
    }

    case "read_image_file": {
      const name = args.path.split(/[/\\]/).pop() || "image";
      return {
        name,
        mime: "image/png",
        filePath: args.path,
        width: 1920,
        height: 1080,
      } as unknown as T;
    }

    default:
      throw new Error(`[MockIPC] Unknown command: ${cmd}`);
  }
}
