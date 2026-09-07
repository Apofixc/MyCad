import { create } from "zustand";
import {
  BoardDocument,
  BoardImageLayer,
  ProjectManifest,
  SchematicDocument,
} from "../types/cad";
import { engineClient } from "../api/engineClient";

interface ProjectStore {
  manifest: ProjectManifest | null;
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
  loadActiveDocument: () => Promise<void>;

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
  activeFileId: null,
  activeFileType: null,
  board: null,
  schematic: null,
  selectedImageId: null,
  isDirty: false,
  isLoading: false,
  error: null,

  createProject: async (path, name, author, desc) => {
    set({ isLoading: true, error: null });
    try {
      const manifest = await engineClient.createProject(path, name, author, desc);
      // Новый проект создается пустым
      set({
        manifest,
        activeFileId: null,
        activeFileType: null,
        board: null,
        schematic: null,
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
      const firstFile = manifest.files[0];

      if (firstFile) {
        set({
          manifest,
          activeFileId: firstFile.id,
          activeFileType: firstFile.fileType,
          selectedImageId: null,
          isDirty: false,
          isLoading: false,
        });
        await get().loadActiveDocument();
      } else {
        set({
          manifest,
          activeFileId: null,
          activeFileType: null,
          board: null,
          schematic: null,
          selectedImageId: null,
          isDirty: false,
          isLoading: false,
        });
      }
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
      activeFileId: null,
      activeFileType: null,
      board: null,
      schematic: null,
      selectedImageId: null,
      isDirty: false,
      error: null,
    });
  },

  loadActiveDocument: async () => {
    const { manifest, activeFileId } = get();
    if (!manifest || !activeFileId) {
      set({ board: null, schematic: null, activeFileType: null });
      return;
    }

    const fileRef = manifest.files.find((f) => f.id === activeFileId);
    if (!fileRef) {
      set({ board: null, schematic: null, activeFileType: null });
      return;
    }

    if (fileRef.fileType === "board") {
      try {
        const board = await engineClient.getActiveBoard();
        set({ board, schematic: null, activeFileType: "board" });
      } catch (e) {
        console.error("Ошибка загрузки платы", e);
      }
    } else if (fileRef.fileType === "schematic") {
      try {
        const schematic = await engineClient.getActiveSchematic();
        set({ schematic, board: null, activeFileType: "schematic", selectedImageId: null });
      } catch (e) {
        console.error("Ошибка загрузки схемы", e);
      }
    }
  },

  addBoard: async (name?: string) => {
    set({ isLoading: true });
    try {
      const manifest = await engineClient.addProjectFile("board", name);
      // Последний добавленный файл
      const added = manifest.files[manifest.files.length - 1];
      set({
        manifest,
        activeFileId: added ? added.id : null,
        activeFileType: "board",
        isDirty: true,
        isLoading: false,
      });
      await get().loadActiveDocument();
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка добавления схемы платы", isLoading: false });
      throw e;
    }
  },

  addSchematic: async (name?: string) => {
    set({ isLoading: true });
    try {
      const manifest = await engineClient.addProjectFile("schematic", name);
      const added = manifest.files[manifest.files.length - 1];
      set({
        manifest,
        activeFileId: added ? added.id : null,
        activeFileType: "schematic",
        isDirty: true,
        isLoading: false,
      });
      await get().loadActiveDocument();
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка добавления принципиальной схемы", isLoading: false });
      throw e;
    }
  },

  removeFile: async (fileId: string) => {
    set({ isLoading: true });
    try {
      const manifest = await engineClient.removeProjectFile(fileId);
      const { activeFileId } = get();
      let nextActiveId = activeFileId;
      if (activeFileId === fileId) {
        nextActiveId = manifest.files[0]?.id || null;
      }

      set({
        manifest,
        activeFileId: nextActiveId,
        isDirty: true,
        isLoading: false,
      });

      if (nextActiveId) {
        await engineClient.setActiveFile(nextActiveId);
        await get().loadActiveDocument();
      } else {
        set({ board: null, schematic: null, activeFileType: null });
      }
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка удаления файла", isLoading: false });
      throw e;
    }
  },

  renameFile: async (fileId: string, newName: string) => {
    try {
      const manifest = await engineClient.renameProjectFile(fileId, newName);
      set({ manifest, isDirty: true });
      const { board, schematic } = get();
      if (board && board.id === fileId) {
        set({ board: { ...board, name: newName, data: { ...board.data, name: newName } } });
      }
      if (schematic && schematic.id === fileId) {
        set({ schematic: { ...schematic, name: newName, data: { ...schematic.data, name: newName } } });
      }
    } catch (e: any) {
      set({ error: e?.toString() || "Ошибка переименования", isLoading: false });
      throw e;
    }
  },

  setActiveFile: async (fileId: string) => {
    const { manifest } = get();
    if (!manifest) return;
    const target = manifest.files.find((f) => f.id === fileId);
    if (!target) return;

    try {
      await engineClient.setActiveFile(fileId);
      set({ activeFileId: fileId, activeFileType: target.fileType });
      await get().loadActiveDocument();
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
