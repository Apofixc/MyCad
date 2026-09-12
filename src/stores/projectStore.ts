import { create } from "zustand";
import {
  BoardDocument,
  BoardImageLayer,
  ProjectFullState,
  ProjectManifest,
  SchematicDocument,
} from "../types/cad";
import { PlacedComponent } from "../types/componentLibrary";
import { engineClient } from "../api/engineClient";
import { reportError, notifySuccess } from "../utils/errorHandler";
import { useUiStore } from "./uiStore";

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
  selectedComponentId: string | null;
  selectedComponentIds: string[];
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
  selectComponent: (id: string | null, isMulti?: boolean) => void;
  toggleSelectComponent: (id: string) => void;
  selectAllComponents: (ids: string[]) => void;
  clearSelectedComponents: () => void;
  batchSetComponentsVisibility: (ids: string[], visible: boolean) => Promise<void>;
  batchSetComponentsLocked: (ids: string[], locked: boolean) => Promise<void>;
  batchDeleteComponents: (ids: string[]) => Promise<void>;
  addComponent: (component: PlacedComponent) => Promise<boolean>;
  updateComponent: (component: PlacedComponent, boardId?: string) => Promise<boolean>;
  deleteComponent: (componentId: string) => Promise<void>;
  updateImageLayer: (layer: BoardImageLayer) => Promise<boolean>;
  updateImageLayers: (layers: BoardImageLayer[]) => Promise<boolean>;
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
  selectedComponentId: null,
  selectedComponentIds: [],
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
      notifySuccess(`Проект "${name}" успешно создан`);
    } catch (e: any) {
      reportError(e, "Ошибка создания проекта", { source: "tauri" });
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
      notifySuccess("Проект успешно открыт");
    } catch (e: any) {
      reportError(e, "Ошибка открытия проекта", { source: "tauri" });
      set({ error: e?.toString() || "Ошибка открытия проекта", isLoading: false });
      throw e;
    }
  },

  saveProject: async () => {
    set({ isLoading: true });
    try {
      await engineClient.saveProject();
      set({ isDirty: false, isLoading: false });
      notifySuccess("Проект успешно сохранен");
    } catch (e: any) {
      reportError(e, "Ошибка сохранения проекта", { source: "tauri" });
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
      selectedImageIds: [],
      selectedComponentId: null,
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
      notifySuccess(`Добавлен документ платы: ${name || "Board"}`);
    } catch (e: any) {
      reportError(e, "Ошибка добавления схемы платы", { source: "tauri" });
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
      notifySuccess(`Добавлена принципиальная схема: ${name || "Schematic"}`);
    } catch (e: any) {
      reportError(e, "Ошибка добавления принципиальной схемы", { source: "tauri" });
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
      notifySuccess("Файл удален из проекта");
    } catch (e: any) {
      reportError(e, "Ошибка удаления файла", { source: "tauri" });
      set({ error: e?.toString() || "Ошибка удаления файла", isLoading: false });
      throw e;
    }
  },

  renameFile: async (fileId: string, newName: string) => {
    try {
      const fullState = await engineClient.renameProjectFile(fileId, newName);
      get().applyFullState(fullState);
      set({ isDirty: true });
      notifySuccess("Файл переименован");
    } catch (e: any) {
      reportError(e, "Ошибка переименования файла", { source: "tauri" });
      set({ error: e?.toString() || "Ошибка переименования", isLoading: false });
      throw e;
    }
  },

  setActiveFile: async (fileId: string) => {
    try {
      const fullState = await engineClient.setActiveFile(fileId);
      get().applyFullState(fullState);
    } catch (e: any) {
      reportError(e, "Ошибка переключения активного документа", { source: "tauri" });
    }
  },

  selectImage: (id, isMulti = false) => {
    if (!id) {
      set({ selectedImageId: null, selectedImageIds: [] });
      return;
    }
    // Auto-open right inspector sidebar when an image is selected
    const uiState = useUiStore.getState();
    if (uiState.rightSidebarCollapsed) {
      useUiStore.setState({ rightSidebarCollapsed: false });
    }
    if (isMulti) {
      const { selectedImageIds } = get();
      const exists = selectedImageIds.includes(id);
      const next = exists ? selectedImageIds.filter((i) => i !== id) : [...selectedImageIds, id];
      set({
        selectedImageIds: next,
        selectedImageId: next.length > 0 ? next[next.length - 1] : null,
        selectedComponentId: null,
        selectedComponentIds: [],
      });
    } else {
      set({
        selectedImageId: id,
        selectedImageIds: [id],
        selectedComponentId: null,
        selectedComponentIds: [],
      });
    }
  },

  toggleSelectImage: (id) => {
    const { selectedImageIds } = get();
    const exists = selectedImageIds.includes(id);
    const next = exists ? selectedImageIds.filter((i) => i !== id) : [...selectedImageIds, id];
    set({
      selectedImageIds: next,
      selectedImageId: next.length > 0 ? next[next.length - 1] : null,
      selectedComponentId: null,
      selectedComponentIds: [],
    });
  },

  selectAllImages: (ids) => {
    set({
      selectedImageIds: ids,
      selectedImageId: ids[0] || null,
      selectedComponentId: null,
      selectedComponentIds: [],
    });
  },

  clearSelectedImages: () => {
    set({
      selectedImageIds: [],
      selectedImageId: null,
    });
  },

  selectComponent: (id, isMulti = false) => {
    if (!id) {
      set({ selectedComponentId: null, selectedComponentIds: [] });
      return;
    }
    const uiState = useUiStore.getState();
    if (uiState.rightSidebarCollapsed) {
      useUiStore.setState({ rightSidebarCollapsed: false });
    }
    if (isMulti) {
      const { selectedComponentIds } = get();
      const exists = selectedComponentIds.includes(id);
      const next = exists ? selectedComponentIds.filter((i) => i !== id) : [...selectedComponentIds, id];
      set({
        selectedComponentIds: next,
        selectedComponentId: next.length > 0 ? next[next.length - 1] : null,
        selectedImageId: null,
        selectedImageIds: [],
      });
    } else {
      set({
        selectedComponentId: id,
        selectedComponentIds: [id],
        selectedImageId: null,
        selectedImageIds: [],
      });
    }
  },

  toggleSelectComponent: (id) => {
    const { selectedComponentIds } = get();
    const exists = selectedComponentIds.includes(id);
    const next = exists ? selectedComponentIds.filter((i) => i !== id) : [...selectedComponentIds, id];
    set({
      selectedComponentIds: next,
      selectedComponentId: next.length > 0 ? next[next.length - 1] : null,
      selectedImageId: null,
      selectedImageIds: [],
    });
  },

  selectAllComponents: (ids) => {
    set({
      selectedComponentIds: ids,
      selectedComponentId: ids[0] || null,
      selectedImageId: null,
      selectedImageIds: [],
    });
  },

  clearSelectedComponents: () => {
    set({
      selectedComponentIds: [],
      selectedComponentId: null,
    });
  },

  batchSetComponentsVisibility: async (compIds, visible) => {
    const { board } = get();
    if (!board) return;
    const comps = board.data?.components || [];
    for (const c of comps) {
      if (compIds.includes(c.id) && c.visible !== visible) {
        await get().updateComponent({ ...c, visible });
      }
    }
  },

  batchSetComponentsLocked: async (compIds, locked) => {
    const { board } = get();
    if (!board) return;
    const comps = board.data?.components || [];
    for (const c of comps) {
      if (compIds.includes(c.id) && c.locked !== locked) {
        await get().updateComponent({ ...c, locked });
      }
    }
  },

  batchDeleteComponents: async (compIds) => {
    for (const id of compIds) {
      await get().deleteComponent(id);
    }
    set({ selectedComponentIds: [], selectedComponentId: null });
  },

  addComponent: async (component: PlacedComponent) => {
    const { board } = get();
    if (!board) return false;
    try {
      const fullState = await engineClient.boardAddComponent(board.id, component);
      get().applyFullState(fullState);
      set({ isDirty: true, selectedComponentId: component.id, selectedComponentIds: [component.id], selectedImageId: null, selectedImageIds: [] });
      notifySuccess(`Компонент "${component.refDes}" добавлен на плату`);
      return true;
    } catch (e) {
      reportError(e, "Ошибка добавления компонента на плату", { source: "tauri" });
      return false;
    }
  },

  updateComponent: async (component: PlacedComponent, boardId?: string) => {
    const targetBoardId = boardId ?? get().boards.find((b) =>
      b.data.components?.some((comp) => comp.id === component.id))?.id;
    if (!targetBoardId) return false;
    try {
      const fullState = await engineClient.boardUpdateComponent(targetBoardId, component);
      get().applyFullState(fullState);
      set({ isDirty: true });
      return true;
    } catch (e) {
      reportError(e, "Ошибка обновления компонента", { source: "tauri" });
      return false;
    }
  },

  deleteComponent: async (componentId: string) => {
    const { board, selectedComponentId } = get();
    if (!board) return;
    try {
      const fullState = await engineClient.boardDeleteComponent(board.id, componentId);
      get().applyFullState(fullState);
      set({
        isDirty: true,
        selectedComponentId: selectedComponentId === componentId ? null : selectedComponentId,
      });
      notifySuccess("Компонент удален с платы");
    } catch (e: any) {
      reportError(e, "Ошибка удаления компонента", { source: "tauri" });
    }
  },

  updateImageLayer: async (layer) => {
    return get().updateImageLayers([layer]);
  },

  updateImageLayers: async (layers) => {
    if (layers.length === 0) return true;
    const { activeFileId, boards, schematics } = get();
    const owners = new Map(layers.map((layer) => [
      layer.id,
      boards.find((b) => [...b.data.bgTop.images, ...b.data.bgBottom.images]
        .some((img) => img.id === layer.id))?.id
        ?? schematics.find((s) => s.data.bg?.images.some((img) => img.id === layer.id))?.id
        ?? activeFileId,
    ]));
    try {
      const savedLayers = await engineClient.updateImageLayers(layers, activeFileId);
      set((state) => {
        const updateGroup = (images: BoardImageLayer[], fileId: string, side?: "top" | "bottom") => {
          const updates = savedLayers.filter((img) => owners.get(img.id) === fileId);
          const byId = new Map(updates.map((img) => [img.id, img]));
          const result = images.map((img) => byId.get(img.id) ?? img)
            .filter((img) => !side || img.side === side);
          for (const img of updates) {
            if ((!side || img.side === side) && !result.some((existing) => existing.id === img.id)) {
              result.push(img);
            }
          }
          return result;
        };
        const updatedBoards = state.boards.map((b) => ({
          ...b,
          data: {
            ...b.data,
            bgTop: { images: updateGroup(b.data.bgTop.images, b.id, "top") },
            bgBottom: { images: updateGroup(b.data.bgBottom.images, b.id, "bottom") },
          },
        }));
        const updatedSchematics = state.schematics.map((s) => ({
          ...s,
          data: { ...s.data, bg: { images: updateGroup(s.data.bg?.images ?? [], s.id) } },
        }));
        return {
          boards: updatedBoards,
          schematics: updatedSchematics,
          board: updatedBoards.find((b) => b.id === state.board?.id) ?? null,
          schematic: updatedSchematics.find((s) => s.id === state.schematic?.id) ?? null,
          isDirty: true,
        };
      });
      return true;
    } catch (e) {
      reportError(e, "Ошибка обновления слоя изображения", { source: "tauri" });
      set({ error: String(e) });
      return false;
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
    const deletedIds: string[] = [];
    for (const id of layerIds) {
      try {
        await engineClient.deleteImageLayer(id);
        deletedIds.push(id);
      } catch (e) {
        reportError(e, `Ошибка удаления слоя скана ${id}`, { source: "tauri" });
      }
    }
    if (deletedIds.length === 0) return;
    layerIds = deletedIds;
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
