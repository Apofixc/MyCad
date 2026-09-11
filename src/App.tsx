import React, { useEffect } from "react";
import { useProjectStore } from "./stores/projectStore";
import { useUiStore } from "./stores/uiStore";
import { StartScreen } from "./components/StartScreen/StartScreen";
import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
import { ProjectTree } from "./components/Sidebar/ProjectTree";
import { InspectorSidebar } from "./components/Sidebar/InspectorSidebar";
import { BoardCanvas } from "./components/Viewport/BoardCanvas";
import { SchematicCanvas } from "./components/Viewport/SchematicCanvas";
import { EmptyWorkspace } from "./components/Viewport/EmptyWorkspace";
import { NewProjectModal } from "./components/Modals/NewProjectModal";
import { NewDocumentModal } from "./components/Modals/NewDocumentModal";
import { ImagePreprocessModal } from "./components/Modals/ImagePreprocessModal";
import { BatchImageImportModal } from "./components/Modals/BatchImageImportModal";
import { ComponentLibraryModal } from "./components/Modals/ComponentLibraryModal";
import { PackageEditorModal } from "./components/Modals/PackageEditorModal";
import { DeviceEditorModal } from "./components/Modals/DeviceEditorModal";
import { useLibraryStore } from "./stores/libraryStore";
import { DeviceDefinition, PackageDefinition, PlacedComponent } from "./types/componentLibrary";
import { ErrorDialog } from "./components/Common/ErrorDialog";
import { ErrorBoundary } from "./components/Common/ErrorBoundary";

export const App: React.FC = () => {
  const { manifest, saveProject, activeFileType, board, schematic, addComponent } = useProjectStore();
  const {
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    toggleLeftSidebar,
    modals,
    openModal,
    closeModal,
    editingPackage,
    editingDevice,
    setEditingPackage,
    setEditingDevice,
    setActiveTool,
    toggleGrid,
    fitAllImages,
  } = useUiStore();
  const { packages, savePackage, saveDevice } = useLibraryStore();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when focused inside input / textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s" || e.key === "ы") {
          e.preventDefault();
          saveProject().catch(console.error);
        } else if (e.key === "n" || e.key === "т") {
          e.preventDefault();
          openModal("newProject");
        } else if (e.key === "b" || e.key === "и") {
          e.preventDefault();
          toggleLeftSidebar();
        }
        return;
      }

      // Single-key Tool switching
      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "t":
          setActiveTool("transform");
          break;
        case "c":
          setActiveTool("calibrate");
          break;
        case "l":
          setActiveTool("level");
          break;
        case "r":
          setActiveTool("register");
          break;
        case "s":
          setActiveTool("curtain");
          break;
        case "m":
          setActiveTool("measure");
          break;
        case "z":
          setActiveTool("magnifier");
          break;
        case "b":
          setActiveTool("blink");
          break;
        case "g":
        case "п":
          toggleGrid();
          break;
        case "f":
        case "а":
        case "0":
          fitAllImages();
          break;
        case "f2":
          e.preventDefault();
          openModal("componentLibrary");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveProject, openModal, toggleLeftSidebar, setActiveTool, toggleGrid, fitAllImages]);

  const handlePlaceOnBoard = async (device: DeviceDefinition, packageDef: PackageDefinition) => {
    const existing = board?.data?.components || [];
    const prefix = device.designatorPrefix || "U";
    let index = 1;
    while (existing.some((c) => c.refDes === `${prefix}${index}`)) {
      index++;
    }
    const posX = 20 + (existing.length % 5) * 15;
    const posY = 20 + Math.floor(existing.length / 5) * 15;
    const newComp: PlacedComponent = {
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      refDes: `${prefix}${index}`,
      deviceId: device.id,
      packageId: packageDef.id,
      selectedVariantId: packageDef.variants?.[0]?.id,
      value: device.isBase ? "" : (device.parameters?.value || device.name),
      name: device.name,
      package: packageDef.name,
      x: posX,
      y: posY,
      xMm: posX,
      yMm: posY,
      rotation: 0,
      rotationDeg: 0,
      layer: "top",
      side: "top",
      mirrored: false,
      locked: false,
      packageDef: packageDef,
    };
    await addComponent(newComp);
  };

  return (
    <div className="cad-app-container">
      {!manifest ? (
        <StartScreen />
      ) : (
        <>
          <TopBar />
          <div className="cad-main-workspace">
            {!leftSidebarCollapsed && <ProjectTree />}
            <ErrorBoundary
              fallbackTitle="Ошибка отображения холста"
              fallbackMessage="Произошел сбой при отрисовке рабочего пространства CAD. Данные проекта не потеряны."
            >
              {activeFileType === "board" && board ? (
                <BoardCanvas />
              ) : activeFileType === "schematic" && schematic ? (
                <SchematicCanvas />
              ) : (
                <EmptyWorkspace />
              )}
            </ErrorBoundary>
            {!rightSidebarCollapsed && activeFileType === "board" && <InspectorSidebar />}
          </div>
          <StatusBar />
        </>
      )}

      {/* Modals & Overlays */}
      <NewProjectModal />
      <NewDocumentModal />
      <ImagePreprocessModal />
      <BatchImageImportModal />

      {/* Component Library & CAD Package/Device Editors */}
      <ComponentLibraryModal
        isOpen={modals.componentLibrary}
        onClose={() => closeModal("componentLibrary")}
        onOpenPackageEditor={(pkg) => {
          setEditingPackage(pkg || null);
          openModal("packageEditor");
        }}
        onOpenDeviceEditor={(dev) => {
          setEditingDevice(dev || null);
          openModal("deviceEditor");
        }}
        onPlaceOnBoard={handlePlaceOnBoard}
      />

      <PackageEditorModal
        isOpen={modals.packageEditor}
        initialPackage={editingPackage}
        onClose={() => closeModal("packageEditor")}
        onSave={async (pkg) => {
          await savePackage(pkg);
          closeModal("packageEditor");
        }}
      />

      <DeviceEditorModal
        isOpen={modals.deviceEditor}
        initialDevice={editingDevice}
        availablePackages={packages}
        onClose={() => closeModal("deviceEditor")}
        onSave={async (dev) => {
          await saveDevice(dev);
          closeModal("deviceEditor");
        }}
        onCreateNewPackage={() => {
          setEditingPackage(null);
          openModal("packageEditor");
        }}
      />

      {/* Error & Action Dialog */}
      <ErrorDialog />
    </div>
  );
};

export default App;
