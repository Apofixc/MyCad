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
  selectedImageIds: string[];
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

  selectImage: (id: string | null, isMulti?: boolean) => void;
  toggleSelectImage: (id: string) => void;
  selectAllImages: (ids: string[]) => void;
  clearSelectedImages: () => void;
  updateImageLayer: (layer: BoardImageLayer) => Promise<void>;
  updateImageLayers: (layers: BoardImageLayer[]) => Promise<void>;
  batchSetVisibility: (layerIds: string[], visible: boolean) => Promise<void>;
  batchSetLocked: (layerIds: string[], locked: boolean) => Promise<void>;
  batchDeleteLayers: (layerIds: string[]) => Promise<void>;
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
  selectedImageIds: [],
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

  selectImage: (id, isMulti = false) => {
    if (!id) {
      set({ selectedImageId: null, selectedImageIds: [] });
      return;
    }
    if (isMulti) {
      const { selectedImageIds } = get();
      const exists = selectedImageIds.includes(id);
      const next = exists ? selectedImageIds.filter((i) => i !== id) : [...selectedImageIds, id];
      set({
        selectedImageIds: next,
        selectedImageId: next.length > 0 ? next[next.length - 1] : null,
      });
    } else {
      set({ selectedImageId: id, selectedImageIds: [id] });
    }
  },

  toggleSelectImage: (id) => {
    const { selectedImageIds } = get();
    const exists = selectedImageIds.includes(id);
    const next = exists ? selectedImageIds.filter((i) => i !== id) : [...selectedImageIds, id];
    set({
      selectedImageIds: next,
      selectedImageId: next.length > 0 ? next[next.length - 1] : null,
    });
  },

  selectAllImages: (ids) => {
    set({
      selectedImageIds: ids,
      selectedImageId: ids[0] || null,
    });
  },

  clearSelectedImages: () => {
    set({
      selectedImageIds: [],
      selectedImageId: null,
    });
  },

  updateImageLayer: async (layer) => {
    await get().updateImageLayers([layer]);
  },

  updateImageLayers: async (layers) => {
    if (!layers || layers.length === 0) return;
    try {
      const savedLayers = await engineClient.updateImageLayers(layers);
      const savedMap = new Map(savedLayers.map((l) => [l.id, l]));
      const { boards, board, schematics, schematic } = get();
      const targetBoardId = board?.id || boards[0]?.id;

      const updateGroupForSide = (images: BoardImageLayer[], targetSide: "top" | "bottom") => {
        const next = [...images];
        for (let i = 0; i < next.length; i++) {
          const updated = savedMap.get(next[i].id);
          if (updated) {
            next[i] = updated;
          }
        }
        // Filter to keep only layers that match targetSide
        const filtered = next.filter((img) => {
          const updated = savedMap.get(img.id);
          const currentSide = (updated?.side || img.side || "top").toLowerCase();
          return currentSide === targetSide;
        });
        // Add new saved layers that belong strictly to targetSide
        for (const saved of savedLayers) {
          const sSide = (saved.side || "top").toLowerCase();
          if (sSide === targetSide && !filtered.some((img) => img.id === saved.id)) {
            filtered.push(saved);
          }
        }
        return filtered;
      };

      const updatedBoards = boards.map((b) => {
        const currentTopImages = b.data?.bgTop?.images || [];
        const currentBotImages = b.data?.bgBottom?.images || [];
        const hasTop = currentTopImages.some((img) => savedMap.has(img.id));
        const hasBot = currentBotImages.some((img) => savedMap.has(img.id));
        const hasTarget = savedLayers.some((s) => s.side === "top" || s.side === "bottom") && b.id === targetBoardId;

        if (hasTop || hasBot || hasTarget) {
          return {
            ...b,
            data: {
              ...b.data,
              bgTop: { images: updateGroupForSide(currentTopImages, "top") },
              bgBottom: { images: updateGroupForSide(currentBotImages, "bottom") },
            },
          };
        }
        return b;
      });

      const updateSchematicGroup = (images: BoardImageLayer[]) => {
        const next = [...images];
        for (let i = 0; i < next.length; i++) {
          const updated = savedMap.get(next[i].id);
          if (updated) {
            next[i] = updated;
          }
        }
        return next;
      };

      const updatedSchematics = schematics.map((s) => {
        const currentImages = s.data?.bg?.images || [];
        const hasSchematicImg = currentImages.some((img) => savedMap.has(img.id));
        if (hasSchematicImg) {
          return {
            ...s,
            data: {
              ...s.data,
              bg: { images: updateSchematicGroup(currentImages) },
            },
          };
        }
        return s;
      });

      const updatedActiveBoard =
        updatedBoards.find((b) => b.id === targetBoardId) || board || updatedBoards[0] || null;
      const updatedActiveSchematic =
        updatedSchematics.find((s) => s.id === schematic?.id) || schematic || null;

      set({
        boards: updatedBoards,
        schematics: updatedSchematics,
        board: updatedActiveBoard,
        schematic: updatedActiveSchematic,
        isDirty: true,
      });
    } catch (e: any) {
      set({ error: e?.toString() });
    }
  },

  batchSetVisibility: async (layerIds, visible) => {
    const { board, schematic } = get();
    const allImages: BoardImageLayer[] = [
      ...(board?.data?.bgTop?.images || []),
      ...(board?.data?.bgBottom?.images || []),
      ...(schematic?.data?.bg?.images || []),
    ];
    const toUpdate = allImages
      .filter((img) => layerIds.includes(img.id) && img.visible !== visible)
      .map((img) => ({ ...img, visible }));
    if (toUpdate.length > 0) {
      await get().updateImageLayers(toUpdate);
    }
  },

  batchSetLocked: async (layerIds, locked) => {
    const { board, schematic } = get();
    const allImages: BoardImageLayer[] = [
      ...(board?.data?.bgTop?.images || []),
      ...(board?.data?.bgBottom?.images || []),
      ...(schematic?.data?.bg?.images || []),
    ];
    const toUpdate = allImages
      .filter((img) => layerIds.includes(img.id) && img.locked !== locked)
      .map((img) => ({ ...img, locked }));
    if (toUpdate.length > 0) {
      await get().updateImageLayers(toUpdate);
    }
  },

  batchDeleteLayers: async (layerIds) => {
    for (const id of layerIds) {
      try {
        await engineClient.deleteImageLayer(id);
      } catch (e) {
        console.error("Error deleting image layer", id, e);
      }
    }
    const { boards, board, schematics, schematic, selectedImageId, selectedImageIds } = get();
    const updatedBoards = boards.map((b) => ({
      ...b,
      data: {
        ...b.data,
        bgTop: {
          images: (b.data?.bgTop?.images || []).filter((img) => !layerIds.includes(img.id)),
        },
        bgBottom: {
          images: (b.data?.bgBottom?.images || []).filter((img) => !layerIds.includes(img.id)),
        },
      },
    }));
    const updatedSchematics = schematics.map((s) => ({
      ...s,
      data: {
        ...s.data,
        bg: s.data?.bg ? {
          images: (s.data.bg.images || []).filter((img) => !layerIds.includes(img.id)),
        } : undefined,
      },
    }));

    set({
      boards: updatedBoards,
      schematics: updatedSchematics,
      board: updatedBoards.find((b) => b.id === board?.id) || null,
      schematic: updatedSchematics.find((s) => s.id === schematic?.id) || null,
      selectedImageIds: selectedImageIds.filter((id) => !layerIds.includes(id)),
      selectedImageId: layerIds.includes(selectedImageId || "") ? null : selectedImageId,
      isDirty: true,
    });
  },

  deleteImageLayer: async (layerId: string) => {
    await get().batchDeleteLayers([layerId]);
  },
}));
