import { create } from "zustand";
import { ToolMode, ActiveWorkLayer, BoardImageLayer } from "../types/cad";
import { PackageDefinition, DeviceDefinition, PlacedComponent } from "../types/componentLibrary";
import { useProjectStore } from "./projectStore";

interface UiStore {
  activeTool: ToolMode;
  activeWorkLayer: ActiveWorkLayer;
  setActiveWorkLayer: (layer: ActiveWorkLayer) => void;
  cursorMm: { x: number; y: number };
  viewportZoom: number; // in %
  viewportPan: { x: number; y: number };
  focusImageLayer: (imgLayer: BoardImageLayer) => void;
  focusComponent: (comp: PlacedComponent) => void;
  fitAllImages: (images?: BoardImageLayer[]) => void;
  gridStepMm: number;
  showGrid: boolean;

  // Layer visibility & overlay settings
  showTopLayer: boolean;
  showBottomLayer: boolean;
  showTopComponents: boolean;
  showBottomComponents: boolean;
  showSchematicBg: boolean;
  showSchematicWorking: boolean;
  showTopCopper: boolean;
  showBottomCopper: boolean;
  showVias: boolean;

  // Curtain tool state
  curtainPosition: number; // 0.0 .. 1.0 (relative to canvas width/height)
  curtainVertical: boolean;

  // Magnifier tool state
  loupeActive: boolean;
  loupeMagnification: number; // 2, 4, 8, 16

  // Layout state
  leftSidebarWidth: number;
  leftSidebarCollapsed: boolean;
  rightSidebarWidth: number;
  rightSidebarCollapsed: boolean;

  // Modals state
  modals: {
    newProject: boolean;
    newDocument: boolean;
    preprocess: boolean;
    batchImport: boolean;
    confirmClose: boolean;
    componentLibrary: boolean;
    packageEditor: boolean;
    deviceEditor: boolean;
  };
  editingPackage: PackageDefinition | null;
  editingDevice: DeviceDefinition | null;
  setEditingPackage: (pkg: PackageDefinition | null) => void;
  setEditingDevice: (dev: DeviceDefinition | null) => void;
  preprocessSide: "top" | "bottom";

  pendingPreprocess: {
    file?: File;
    filePath?: string;
    dataUrl?: string;
    name?: string;
    side: "top" | "bottom";
    replaceLayerId?: string;
  } | null;

  pendingBatchImport: {
    files: File[];
    filePaths?: string[];
    side: "top" | "bottom";
  } | null;

  // Actions
  setActiveTool: (tool: ToolMode) => void;
  setCursorMm: (pos: { x: number; y: number }) => void;
  setViewportZoom: (zoom: number) => void;
  setViewportPan: (pan: { x: number; y: number }) => void;
  setViewportZoomAndPan: (zoom: number, pan: { x: number; y: number }) => void;
  setGridStepMm: (step: number) => void;
  toggleGrid: () => void;

  setShowTopLayer: (val: boolean) => void;
  setShowBottomLayer: (val: boolean) => void;
  setShowTopComponents: (val: boolean) => void;
  setShowBottomComponents: (val: boolean) => void;
  setShowSchematicBg: (val: boolean) => void;
  setShowSchematicWorking: (val: boolean) => void;
  setShowTopCopper: (val: boolean) => void;
  setShowBottomCopper: (val: boolean) => void;
  setShowVias: (val: boolean) => void;
  toggleAllCopper: (val?: boolean) => void;
  toggleAllComponents: (val?: boolean) => void;

  setCurtainPosition: (pos: number) => void;
  toggleCurtainOrientation: () => void;
  setLoupeMagnification: (mag: number) => void;
  toggleLoupe: () => void;

  setLeftSidebarWidth: (width: number) => void;
  toggleLeftSidebar: () => void;
  setRightSidebarWidth: (width: number) => void;
  toggleRightSidebar: () => void;

  setPreprocessSide: (side: "top" | "bottom") => void;
  setPendingPreprocess: (item: UiStore["pendingPreprocess"]) => void;
  setPendingBatchImport: (item: UiStore["pendingBatchImport"]) => void;
  openModal: (modal: keyof UiStore["modals"]) => void;
  closeModal: (modal: keyof UiStore["modals"]) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeTool: "select",
  activeWorkLayer: { type: "underlay", side: "top" },
  setActiveWorkLayer: (layer) => {
    set({ activeWorkLayer: layer });
    if (layer.type === "components") {
      useProjectStore.setState({ selectedImageId: null, selectedImageIds: [] });
    } else if (layer.type === "underlay") {
      useProjectStore.setState({ selectedComponentId: null });
    } else {
      useProjectStore.setState({ selectedImageId: null, selectedImageIds: [], selectedComponentId: null });
    }
  },
  cursorMm: { x: 0, y: 0 },
  viewportZoom: 100,
  viewportPan: { x: 0, y: 0 },
  gridStepMm: 1.0,
  showGrid: true,

  showTopLayer: true,
  showBottomLayer: true,
  showTopComponents: true,
  showBottomComponents: true,
  showSchematicBg: true,
  showSchematicWorking: true,
  showTopCopper: true,
  showBottomCopper: true,
  showVias: true,

  curtainPosition: 0.5,
  curtainVertical: true,

  loupeActive: false,
  loupeMagnification: 4,

  leftSidebarWidth: 390,
  leftSidebarCollapsed: false,
  rightSidebarWidth: 320,
  rightSidebarCollapsed: false,

  modals: {
    newProject: false,
    newDocument: false,
    preprocess: false,
    batchImport: false,
    confirmClose: false,
    componentLibrary: false,
    packageEditor: false,
    deviceEditor: false,
  },
  editingPackage: null,
  editingDevice: null,
  setEditingPackage: (pkg) => set({ editingPackage: pkg }),
  setEditingDevice: (dev) => set({ editingDevice: dev }),
  preprocessSide: "top",
  pendingPreprocess: null,
  pendingBatchImport: null,

  setPendingPreprocess: (item) =>
    set({
      pendingPreprocess: item,
      modals: { ...useUiStore.getState().modals, preprocess: Boolean(item) },
      preprocessSide: item?.side || useUiStore.getState().preprocessSide,
    }),
  setPendingBatchImport: (item) =>
    set({
      pendingBatchImport: item,
      modals: { ...useUiStore.getState().modals, batchImport: Boolean(item) },
      preprocessSide: item?.side || useUiStore.getState().preprocessSide,
    }),

  setPreprocessSide: (side) => set({ preprocessSide: side }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setCursorMm: (pos) => set({ cursorMm: pos }),
  setViewportZoom: (zoom) => set({ viewportZoom: Math.max(10, Math.min(2000, zoom)) }),
  setViewportPan: (pan) => set({ viewportPan: pan }),
  setViewportZoomAndPan: (zoom, pan) =>
    set({
      viewportZoom: Math.max(10, Math.min(2000, zoom)),
      viewportPan: pan,
    }),
  focusImageLayer: (imgLayer) => {
    const isTop = (imgLayer.side || "top").toLowerCase() === "top";
    const state = useUiStore.getState();
    const nextUpdates: Partial<UiStore> = {};
    if (isTop && !state.showTopLayer) {
      nextUpdates.showTopLayer = true;
    } else if (!isTop && !state.showBottomLayer) {
      nextUpdates.showBottomLayer = true;
    }

    const naturalW = imgLayer.width || 2000;
    const naturalH = imgLayer.height || 1500;
    const scale = imgLayer.scale || 1.0;
    const pxPerMm = imgLayer.pxPerMm || 23.62;
    const wMm = (naturalW * scale) / pxPerMm;
    const hMm = (naturalH * scale) / pxPerMm;
    const centerMmX = (imgLayer.offsetX || 0) + wMm / 2;
    const centerMmY = (imgLayer.offsetY || 0) + hMm / 2;

    const leftW = state.leftSidebarCollapsed ? 0 : state.leftSidebarWidth;
    const rightW = state.rightSidebarCollapsed ? 0 : state.rightSidebarWidth;
    const viewportW = Math.max(300, (typeof window !== "undefined" ? window.innerWidth : 1200) - leftW - rightW);
    const viewportH = Math.max(300, (typeof window !== "undefined" ? window.innerHeight : 800) - 80);

    const MM_TO_PX = 10;
    const fitZoomX = ((viewportW * 0.72) / (wMm * MM_TO_PX)) * 100;
    const fitZoomY = ((viewportH * 0.72) / (hMm * MM_TO_PX)) * 100;
    const newZoom = Math.max(15, Math.min(600, Math.round(Math.min(fitZoomX, fitZoomY))));
    const zoomFactor = newZoom / 100;

    const newPanX = Math.round(viewportW / 2 - centerMmX * MM_TO_PX * zoomFactor);
    const newPanY = Math.round(viewportH / 2 - centerMmY * MM_TO_PX * zoomFactor);

    nextUpdates.viewportZoom = newZoom;
    nextUpdates.viewportPan = { x: newPanX, y: newPanY };
    set(nextUpdates);
  },
  focusComponent: (comp: PlacedComponent) => {
    const isTop = (comp.layer || comp.side || "top") !== "bottom";
    const state = useUiStore.getState();
    const nextUpdates: Partial<UiStore> = {};
    if (isTop && !state.showTopComponents) {
      nextUpdates.showTopComponents = true;
    } else if (!isTop && !state.showBottomComponents) {
      nextUpdates.showBottomComponents = true;
    }

    const compX = comp.xMm ?? comp.x ?? 0;
    const compY = comp.yMm ?? comp.y ?? 0;

    const leftW = state.leftSidebarCollapsed ? 0 : state.leftSidebarWidth;
    const rightW = state.rightSidebarCollapsed ? 0 : state.rightSidebarWidth;
    const viewportW = Math.max(300, (typeof window !== "undefined" ? window.innerWidth : 1200) - leftW - rightW);
    const viewportH = Math.max(300, (typeof window !== "undefined" ? window.innerHeight : 800) - 80);

    const MM_TO_PX = 10;
    const targetZoom = Math.max(state.viewportZoom, 180);
    const zoomFactor = targetZoom / 100;

    const newPanX = Math.round(viewportW / 2 - compX * MM_TO_PX * zoomFactor);
    const newPanY = Math.round(viewportH / 2 - compY * MM_TO_PX * zoomFactor);

    nextUpdates.viewportZoom = targetZoom;
    nextUpdates.viewportPan = { x: newPanX, y: newPanY };
    set(nextUpdates);
  },
  fitAllImages: (imagesToFit) => {
    const state = useUiStore.getState();
    let targets = imagesToFit;
    if (!targets || targets.length === 0) {
      const board = useProjectStore.getState().board;
      if (board) {
        const topImgs = board.data?.bgTop?.images || [];
        const botImgs = board.data?.bgBottom?.images || [];
        const visibleImgs = [...topImgs, ...botImgs].filter((img) => img.visible !== false);
        targets = visibleImgs.length > 0 ? visibleImgs : [...topImgs, ...botImgs];
      }
    }

    if (!targets || targets.length === 0) return;

    const nextUpdates: Partial<UiStore> = {};
    if (targets.some((img) => (img.side || "top").toLowerCase() === "top") && !state.showTopLayer) {
      nextUpdates.showTopLayer = true;
    }
    if (targets.some((img) => (img.side || "top").toLowerCase() === "bottom") && !state.showBottomLayer) {
      nextUpdates.showBottomLayer = true;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const img of targets) {
      const naturalW = img.width || 2000;
      const naturalH = img.height || 1500;
      const scale = img.scale || 1.0;
      const pxPerMm = img.pxPerMm || 23.62;
      const wMm = (naturalW * scale) / pxPerMm;
      const hMm = (naturalH * scale) / pxPerMm;
      const cx = (img.offsetX || 0) + wMm / 2;
      const cy = (img.offsetY || 0) + hMm / 2;
      const hw = wMm / 2;
      const hh = hMm / 2;

      const rotRad = ((img.rotation || 0) * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rotRad));
      const sin = Math.abs(Math.sin(rotRad));
      const boundHw = hw * cos + hh * sin;
      const boundHh = hw * sin + hh * cos;

      const iMinX = cx - boundHw;
      const iMaxX = cx + boundHw;
      const iMinY = cy - boundHh;
      const iMaxY = cy + boundHh;

      if (iMinX < minX) minX = iMinX;
      if (iMaxX > maxX) maxX = iMaxX;
      if (iMinY < minY) minY = iMinY;
      if (iMaxY > maxY) maxY = iMaxY;
    }

    if (minX === Infinity || maxX === -Infinity) return;

    const totalWidthMm = Math.max(1, maxX - minX);
    const totalHeightMm = Math.max(1, maxY - minY);
    const centerMmX = (minX + maxX) / 2;
    const centerMmY = (minY + maxY) / 2;

    const leftW = state.leftSidebarCollapsed ? 0 : state.leftSidebarWidth;
    const rightW = state.rightSidebarCollapsed ? 0 : state.rightSidebarWidth;
    const viewportW = Math.max(300, (typeof window !== "undefined" ? window.innerWidth : 1200) - leftW - rightW);
    const viewportH = Math.max(300, (typeof window !== "undefined" ? window.innerHeight : 800) - 80);

    const MM_TO_PX = 10;
    const fitZoomX = ((viewportW * 0.78) / (totalWidthMm * MM_TO_PX)) * 100;
    const fitZoomY = ((viewportH * 0.78) / (totalHeightMm * MM_TO_PX)) * 100;
    const newZoom = Math.max(10, Math.min(600, Math.round(Math.min(fitZoomX, fitZoomY))));
    const zoomFactor = newZoom / 100;

    const newPanX = Math.round(viewportW / 2 - centerMmX * MM_TO_PX * zoomFactor);
    const newPanY = Math.round(viewportH / 2 - centerMmY * MM_TO_PX * zoomFactor);

    nextUpdates.viewportZoom = newZoom;
    nextUpdates.viewportPan = { x: newPanX, y: newPanY };
    set(nextUpdates);
  },
  setGridStepMm: (step) => set({ gridStepMm: step }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  setShowTopLayer: (val) => set({ showTopLayer: val }),
  setShowBottomLayer: (val) => set({ showBottomLayer: val }),
  setShowTopComponents: (val) => set({ showTopComponents: val }),
  setShowBottomComponents: (val) => set({ showBottomComponents: val }),
  setShowSchematicBg: (val) => set({ showSchematicBg: val }),
  setShowSchematicWorking: (val) => set({ showSchematicWorking: val }),
  setShowTopCopper: (val) => set({ showTopCopper: val }),
  setShowBottomCopper: (val) => set({ showBottomCopper: val }),
  setShowVias: (val) => set({ showVias: val }),
  toggleAllCopper: (val) =>
    set((state) => {
      const next = val !== undefined ? val : !(state.showTopCopper && state.showBottomCopper && state.showVias);
      return { showTopCopper: next, showBottomCopper: next, showVias: next };
    }),
  toggleAllComponents: (val) =>
    set((state) => {
      const next = val !== undefined ? val : !(state.showTopComponents && state.showBottomComponents);
      return { showTopComponents: next, showBottomComponents: next };
    }),

  setCurtainPosition: (pos) => set({ curtainPosition: Math.max(0.02, Math.min(0.98, pos)) }),
  toggleCurtainOrientation: () => set((state) => ({ curtainVertical: !state.curtainVertical })),
  setLoupeMagnification: (mag) => set({ loupeMagnification: mag }),
  toggleLoupe: () => set((state) => ({ loupeActive: !state.loupeActive })),

  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: Math.max(180, Math.min(650, width)) }),
  toggleLeftSidebar: () => set((state) => ({ leftSidebarCollapsed: !state.leftSidebarCollapsed })),
  setRightSidebarWidth: (width) => set({ rightSidebarWidth: Math.max(220, Math.min(650, width)) }),
  toggleRightSidebar: () => set((state) => ({ rightSidebarCollapsed: !state.rightSidebarCollapsed })),

  openModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: true },
    })),
  closeModal: (modal) =>
    set((state) => ({
      modals: { ...state.modals, [modal]: false },
    })),
}));
