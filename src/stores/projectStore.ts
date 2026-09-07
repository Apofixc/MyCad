import { create } from "zustand";
import {
  BoardDocument,
  BoardImageLayer,
  ComponentItem,
  CrossProbingPin,
  ProjectManifest,
} from "../types/cad";
import { engineClient } from "../api/engineClient";

interface ProjectStore {
  manifest: ProjectManifest | null;
  board: BoardDocument | null;
  selectedComponentId: string | null;
  selectedPinId: string | null;
  selectedImageId: string | null;
  activeNetId: string | null;
  crossProbingPins: CrossProbingPin[];
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  createProject: (path: string, name: string, author?: string, desc?: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  saveProject: () => Promise<void>;
  closeProject: () => void;
  loadActiveBoard: () => Promise<void>;

  selectComponent: (id: string | null) => void;
  selectImage: (id: string | null) => void;
  selectNet: (netId: string | null) => Promise<void>;

  addComponent: (comp: ComponentItem) => Promise<void>;
  updateComponent: (comp: ComponentItem) => Promise<void>;
  deleteComponent: (id: string) => Promise<void>;
  updateImageLayer: (layer: BoardImageLayer) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  manifest: null,
  board: null,
  selectedComponentId: null,
  selectedPinId: null,
  selectedImageId: null,
  activeNetId: null,
  crossProbingPins: [],
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
        selectedComponentId: null,
        selectedImageId: null,
        activeNetId: null,
        crossProbingPins: [],
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
        selectedComponentId: null,
        selectedImageId: null,
        activeNetId: null,
        crossProbingPins: [],
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
      selectedComponentId: null,
      selectedImageId: null,
      activeNetId: null,
      crossProbingPins: [],
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

  selectComponent: (id) => {
    const { board } = get();
    set({ selectedComponentId: id, selectedImageId: null });

    // If component has a first pin with a net, or clear
    if (id && board) {
      const comp = board.data.components.find((c) => c.id === id);
      const firstNetPin = comp?.pins.find((p) => p.netId);
      if (firstNetPin?.netId) {
        get().selectNet(firstNetPin.netId);
      }
    }
  },

  selectImage: (id) => {
    set({ selectedImageId: id, selectedComponentId: null });
  },

  selectNet: async (netId) => {
    if (!netId) {
      set({ activeNetId: null, crossProbingPins: [] });
      return;
    }
    set({ activeNetId: netId });
    try {
      const res = await engineClient.getCrossProbing(netId);
      set({ crossProbingPins: res.pins });
    } catch (e) {
      console.error("Ошибка Cross-Probing:", e);
    }
  },

  addComponent: async (comp) => {
    try {
      const saved = await engineClient.addComponent(comp);
      const { board } = get();
      if (board) {
        set({
          board: {
            ...board,
            data: {
              ...board.data,
              components: [...board.data.components, saved],
            },
          },
          selectedComponentId: saved.id,
          isDirty: true,
        });
      }
    } catch (e: any) {
      set({ error: e?.toString() });
    }
  },

  updateComponent: async (comp) => {
    try {
      const saved = await engineClient.updateComponent(comp);
      const { board } = get();
      if (board) {
        set({
          board: {
            ...board,
            data: {
              ...board.data,
              components: board.data.components.map((c) => (c.id === saved.id ? saved : c)),
            },
          },
          isDirty: true,
        });
      }
    } catch (e: any) {
      set({ error: e?.toString() });
    }
  },

  deleteComponent: async (id) => {
    try {
      await engineClient.deleteComponent(id);
      const { board, selectedComponentId } = get();
      if (board) {
        set({
          board: {
            ...board,
            data: {
              ...board.data,
              components: board.data.components.filter((c) => c.id !== id),
            },
          },
          selectedComponentId: selectedComponentId === id ? null : selectedComponentId,
          isDirty: true,
        });
      }
    } catch (e: any) {
      set({ error: e?.toString() });
    }
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
}));
