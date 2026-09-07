import { create } from "zustand";
import {
  BoardDocument,
  BoardImageLayer,
  ProjectFullState,
  ProjectManifest,
  SchematicDocument,
} from "../types/cad";
import { engineClient } from "../api/engineClient";

interface ProjectStore {
  manifest: ProjectManifest | null;
  boards: BoardDocument[];
  schematics: SchematicDocument[];
  activeFileId: string | null;
  activeFileType: "board" | "schematic" | null;
  board: BoardDocument | null;
  schematic: SchematicDocument | null;
  selectedImageId: string | null;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  createProject: (path: string, name: string, author?: string, desc?: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  applyFullState: (state: ProjectFullState) => void;

  addBoard: (name?: string) => Promise<void>;
  addSchematic: (name?: string) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  setActiveFile: (fileId: string) => Promise<void>;

  selectImage: (id: string | null) => void;
  updateImageLayer: (layer: BoardImageLayer) => Promise<void>;
  deleteImageLayer: (layerId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  manifest: null,
  boards: [],
  schematics: [],
  activeFileId: null,
  activeFileType: null,
  board: null,
  schematic: null,
  selectedImageId: null,
  isDirty: false,
  isLoading: false,
  error: null,

  applyFullState: (state: ProjectFullState) => {
    const files = state.manifest?.files || [];
    let activeFileId = state.activeFileId;

    if (!activeFileId || !files.some((f) => f.id === activeFileId)) {
      activeFileId = files[0]?.id || null;
    }

    const activeFile = files.find((f) => f.id === activeFileId) || null;
    const activeFileType = activeFile?.fileType || null;

    const activeBoard =
      activeFileType === "board"
        ? state.boards.find((b) => b.id === activeFileId) || state.boards[0] || null
        : null;

    const activeSchematic =
      activeFileType === "schematic"
        ? state.schematics.find((s) => s.id === activeFileId) || state.schematics[0] || null
        : null;

    set({
      manifest: state.manifest,
      boards: state.boards || [],
      schematics: state.schematics || [],
      activeFileId,
      activeFileType,
      board: activeBoard,
      schematic: activeSchematic,
      isLoading: false,
    });
  },

  createProject: async (path, name, author, desc) => {
    set({ isLoading: true, error: null });
    try {
      const fullState = await engineClient.createProject(path, name, author, desc);
      get().applyFullState(fullState);
      set({ isDirty: false, selectedImageId: null });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка создания проекта", isLoading: false });
      throw e;
    }
  },

  openProject: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const fullState = await engineClient.openProject(path);
      get().applyFullState(fullState);
      set({ isDirty: false, selectedImageId: null });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка открытия проекта", isLoading: false });
      throw e;
    }
  },

  saveProject: async () => {
    set({ isLoading: true });
    try {
      await engineClient.saveProject();
      set({ isDirty: false, isLoading: false });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка сохранения", isLoading: false });
      throw e;
    }
  },

  closeProject: () => {
    set({
      manifest: null,
      boards: [],
      schematics: [],
      activeFileId: null,
      activeFileType: null,
      board: null,
      schematic: null,
      selectedImageId: null,
      isDirty: false,
      error: null,
    });
  },

  addBoard: async (name?: string) => {
    set({ isLoading: true });
    try {
      const fullState = await engineClient.addProjectFile("board", name);
      get().applyFullState(fullState);
      set({ isDirty: true });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка добавления схемы платы", isLoading: false });
      throw e;
    }
  },

  addSchematic: async (name?: string) => {
    set({ isLoading: true });
    try {
      const fullState = await engineClient.addProjectFile("schematic", name);
      get().applyFullState(fullState);
      set({ isDirty: true });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка добавления принципиальной схемы", isLoading: false });
      throw e;
    }
  },

  removeFile: async (fileId: string) => {
    set({ isLoading: true });
    try {
      const fullState = await engineClient.removeProjectFile(fileId);
      get().applyFullState(fullState);
      set({ isDirty: true });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка удаления файла", isLoading: false });
      throw e;
    }
  },

  renameFile: async (fileId: string, newName: string) => {
    try {
      const fullState = await engineClient.renameProjectFile(fileId, newName);
      get().applyFullState(fullState);
      set({ isDirty: true });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка переименования", isLoading: false });
      throw e;
    }
  },

  setActiveFile: async (fileId: string) => {
    try {
      const fullState = await engineClient.setActiveFile(fileId);
      get().applyFullState(fullState);
    } catch (e: any) {
      console.error(e);
    }
  },

  selectImage: (id) => {
    set({ selectedImageId: id });
  },

  updateImageLayer: async (layer) => {
    try {
      const saved = await engineClient.updateImageLayer(layer);
      const { boards, board } = get();

      const updateGroup = (images: BoardImageLayer[]) => {
        const idx = images.findIndex((img) => img.id === saved.id);
        if (idx >= 0) {
          const next = [...images];
          next[idx] = saved;
          return next;
        }
        return [...images, saved];
      };

      const updatedBoards = boards.map((b) => {
        const hasTop = b.data.bgTop.images.some((img) => img.id === saved.id);
        const hasBot = b.data.bgBottom.images.some((img) => img.id === saved.id);

        if (hasTop || (saved.side === "top" && b.id === board?.id)) {
          return {
            ...b,
            data: {
              ...b.data,
              bgTop: { images: updateGroup(b.data.bgTop.images) },
            },
          };
        }
        if (hasBot || (saved.side === "bottom" && b.id === board?.id)) {
          return {
            ...b,
            data: {
              ...b.data,
              bgBottom: { images: updateGroup(b.data.bgBottom.images) },
            },
          };
        }
        return b;
      });

      const updatedActiveBoard = updatedBoards.find((b) => b.id === board?.id) || board;

      set({
        boards: updatedBoards,
        board: updatedActiveBoard,
        isDirty: true,
      });
    } catch (e: any) {
      set({ error: e?.toString() });
    }
  },

  deleteImageLayer: async (layerId: string) => {
    try {
      await engineClient.deleteImageLayer(layerId);
      const { boards, board, selectedImageId } = get();

      const updatedBoards = boards.map((b) => ({
        ...b,
        data: {
          ...b.data,
          bgTop: {
            images: b.data.bgTop.images.filter((img) => img.id !== layerId),
          },
          bgBottom: {
            images: b.data.bgBottom.images.filter((img) => img.id !== layerId),
          },
        },
      }));

      const updatedActiveBoard = updatedBoards.find((b) => b.id === board?.id) || null;

      set({
        boards: updatedBoards,
        board: updatedActiveBoard,
        selectedImageId: selectedImageId === layerId ? null : selectedImageId,
        isDirty: true,
      });
    } catch (e: any) {
      set({ error: e?.toString() });
    }
  },
}));
