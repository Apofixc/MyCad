import { create } from "zustand";
import { ToolMode } from "../types/cad";

interface UiStore {
  activeTool: ToolMode;
  cursorMm: { x: number; y: number };
  viewportZoom: number; // in %
  viewportPan: { x: number; y: number };
  gridStepMm: number;
  showGrid: boolean;

  // Layer visibility & overlay settings
  showTopLayer: boolean;
  showBottomLayer: boolean;
  showComponentsTop: boolean;
  showComponentsBottom: boolean;
  showNets: boolean;

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
    preprocess: boolean;
    packageEditor: boolean;
    library: boolean;
    confirmClose: boolean;
  };

  // Actions
  setActiveTool: (tool: ToolMode) => void;
  setCursorMm: (pos: { x: number; y: number }) => void;
  setViewportZoom: (zoom: number) => void;
  setViewportPan: (pan: { x: number; y: number }) => void;
  setGridStepMm: (step: number) => void;
  toggleGrid: () => void;

  setShowTopLayer: (val: boolean) => void;
  setShowBottomLayer: (val: boolean) => void;
  setShowComponentsTop: (val: boolean) => void;
  setShowComponentsBottom: (val: boolean) => void;

  setCurtainPosition: (pos: number) => void;
  toggleCurtainOrientation: () => void;
  setLoupeMagnification: (mag: number) => void;
  toggleLoupe: () => void;

  setLeftSidebarWidth: (width: number) => void;
  toggleLeftSidebar: () => void;
  setRightSidebarWidth: (width: number) => void;
  toggleRightSidebar: () => void;

  openModal: (modal: keyof UiStore["modals"]) => void;
  closeModal: (modal: keyof UiStore["modals"]) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeTool: "select",
  cursorMm: { x: 0, y: 0 },
  viewportZoom: 100,
  viewportPan: { x: 0, y: 0 },
  gridStepMm: 1.0,
  showGrid: true,

  showTopLayer: true,
  showBottomLayer: true,
  showComponentsTop: true,
  showComponentsBottom: true,
  showNets: true,

  curtainPosition: 0.5,
  curtainVertical: true,

  loupeActive: false,
  loupeMagnification: 4,

  leftSidebarWidth: 240,
  leftSidebarCollapsed: false,
  rightSidebarWidth: 280,
  rightSidebarCollapsed: false,

  modals: {
    newProject: false,
    preprocess: false,
    packageEditor: false,
    library: false,
    confirmClose: false,
  },

  setActiveTool: (tool) => set({ activeTool: tool }),
  setCursorMm: (pos) => set({ cursorMm: pos }),
  setViewportZoom: (zoom) => set({ viewportZoom: Math.max(10, Math.min(2000, zoom)) }),
  setViewportPan: (pan) => set({ viewportPan: pan }),
  setGridStepMm: (step) => set({ gridStepMm: step }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  setShowTopLayer: (val) => set({ showTopLayer: val }),
  setShowBottomLayer: (val) => set({ showBottomLayer: val }),
  setShowComponentsTop: (val) => set({ showComponentsTop: val }),
  setShowComponentsBottom: (val) => set({ showComponentsBottom: val }),

  setCurtainPosition: (pos) => set({ curtainPosition: Math.max(0.02, Math.min(0.98, pos)) }),
  toggleCurtainOrientation: () => set((state) => ({ curtainVertical: !state.curtainVertical })),
  setLoupeMagnification: (mag) => set({ loupeMagnification: mag }),
  toggleLoupe: () => set((state) => ({ loupeActive: !state.loupeActive })),

  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: Math.max(160, Math.min(500, width)) }),
  toggleLeftSidebar: () => set((state) => ({ leftSidebarCollapsed: !state.leftSidebarCollapsed })),
  setRightSidebarWidth: (width) => set({ rightSidebarWidth: Math.max(200, Math.min(600, width)) }),
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
