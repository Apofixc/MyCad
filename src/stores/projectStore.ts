import { create } from "zustand";
import {
  BoardDocument,
  BoardImageLayer,
  ProjectManifest,
} from "../types/cad";
import { engineClient } from "../api/engineClient";

interface ProjectStore {
  manifest: ProjectManifest | null;
  board: BoardDocument | null;
  selectedImageId: string | null;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  createProject: (path: string, name: string, author?: string, desc?: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  loadActiveBoard: () => Promise<void>;

  selectImage: (id: string | null) => void;
  updateImageLayer: (layer: BoardImageLayer) => Promise<void>;
  deleteImageLayer: (layerId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  manifest: null,
  board: null,
  selectedImageId: null,
  isDirty: false,
  isLoading: false,
  error: null,

  createProject: async (path, name, author, desc) => {
    set({ isLoading: true, error: null });
    try {
      const manifest = await engineClient.createProject(path, name, author, desc);
      const board = await engineClient.getActiveBoard();
      set({
        manifest,
        board,
        selectedImageId: null,
        isDirty: false,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка создания проекта", isLoading: false });
      throw e;
    }
  },

  openProject: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const manifest = await engineClient.openProject(path);
      const board = await engineClient.getActiveBoard();
      set({
        manifest,
        board,
        selectedImageId: null,
        isDirty: false,
        isLoading: false,
      });
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
      board: null,
      selectedImageId: null,
      isDirty: false,
      error: null,
    });
  },

  loadActiveBoard: async () => {
    try {
      const board = await engineClient.getActiveBoard();
      set({ board });
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
      const { board } = get();
      if (board) {
        const updateGroup = (images: BoardImageLayer[]) => {
          const idx = images.findIndex((img) => img.id === saved.id);
          if (idx >= 0) {
            const next = [...images];
            next[idx] = saved;
            return next;
          }
          return [...images, saved];
        };

        set({
          board: {
            ...board,
            data: {
              ...board.data,
              bgTop: {
                images: saved.side === "top" ? updateGroup(board.data.bgTop.images) : board.data.bgTop.images,
              },
              bgBottom: {
                images: saved.side === "bottom" ? updateGroup(board.data.bgBottom.images) : board.data.bgBottom.images,
              },
            },
          },
          isDirty: true,
        });
      }
    } catch (e: any) {
      set({ error: e?.toString() });
    }
  },

  deleteImageLayer: async (layerId: string) => {
    const { board, selectedImageId } = get();
    if (!board) return;

    set({
      board: {
        ...board,
        data: {
          ...board.data,
          bgTop: {
            images: board.data.bgTop.images.filter((img) => img.id !== layerId),
          },
          bgBottom: {
            images: board.data.bgBottom.images.filter((img) => img.id !== layerId),
          },
        },
      },
      selectedImageId: selectedImageId === layerId ? null : selectedImageId,
      isDirty: true,
    });
  },
}));
