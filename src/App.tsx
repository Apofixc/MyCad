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
import {
  ImagePreprocessModal,
  ImagePreprocessResult,
  BypassImageData,
} from "./components/Modals/ImagePreprocessModal";
import { BatchImageImportModal } from "./components/Modals/BatchImageImportModal";
import {
  createLayerImageItem,
  createLayerImageItemFromFile,
} from "./utils/imageLoader";

export const App: React.FC = () => {
  const { manifest, saveProject, activeFileType, board, schematic, updateImageLayer, selectImage } = useProjectStore();
  const {
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    toggleLeftSidebar,
    openModal,
    setActiveTool,
    toggleGrid,
    pendingPreprocess,
    setPendingPreprocess,
    pendingBatchImport,
    setPendingBatchImport,
    viewportPan,
    viewportZoom,
  } = useUiStore();

  const handlePreprocessApply = async (result: ImagePreprocessResult) => {
    if (!pendingPreprocess) return;
    const finalSrc = result.filePath || result.dataUrl || "";
    const side = pendingPreprocess.side || "top";
    const baseX = pendingPreprocess.customPos
      ? pendingPreprocess.customPos.x
      : Math.round((-viewportPan.x + 200) / (viewportZoom / 100) / 10);
    const baseY = pendingPreprocess.customPos
      ? pendingPreprocess.customPos.y
      : Math.round((-viewportPan.y + 150) / (viewportZoom / 100) / 10);

    const newItem = createLayerImageItem(
      finalSrc,
      pendingPreprocess.name,
      result.width,
      result.height,
      {
        isTop: side === "top",
        defaultX: baseX,
        defaultY: baseY,
      }
    );

    if (pendingPreprocess.replaceImageId) {
      newItem.id = pendingPreprocess.replaceImageId;
    }

    await updateImageLayer(newItem);
    selectImage(newItem.id);
    setPendingPreprocess(null);
  };

  const handlePreprocessBypass = async (bypassData?: BypassImageData) => {
    if (!pendingPreprocess) return;
    const side = pendingPreprocess.side || "top";
    const baseX = pendingPreprocess.customPos
      ? pendingPreprocess.customPos.x
      : Math.round((-viewportPan.x + 200) / (viewportZoom / 100) / 10);
    const baseY = pendingPreprocess.customPos
      ? pendingPreprocess.customPos.y
      : Math.round((-viewportPan.y + 150) / (viewportZoom / 100) / 10);

    if (bypassData && bypassData.width > 0 && bypassData.height > 0) {
      const newItem = createLayerImageItem(
        bypassData.src || pendingPreprocess.filePath || pendingPreprocess.dataUrl,
        pendingPreprocess.name,
        bypassData.width,
        bypassData.height,
        {
          isTop: side === "top",
          defaultX: baseX,
          defaultY: baseY,
        }
      );
      if (pendingPreprocess.replaceImageId) {
        newItem.id = pendingPreprocess.replaceImageId;
      }
      await updateImageLayer(newItem);
      selectImage(newItem.id);
      setPendingPreprocess(null);
      return;
    }

    if (pendingPreprocess.file) {
      const newItem = await createLayerImageItemFromFile(pendingPreprocess.file, {
        isTop: side === "top",
        defaultX: baseX,
        defaultY: baseY,
      });
      if (pendingPreprocess.replaceImageId) {
        newItem.id = pendingPreprocess.replaceImageId;
      }
      await updateImageLayer(newItem);
      selectImage(newItem.id);
    }
    setPendingPreprocess(null);
  };

  const handleConfirmBatchImport = async (preserveOriginal: boolean) => {
    if (!pendingBatchImport) return;
    const { files, customPos, side } = pendingBatchImport;
    setPendingBatchImport(null);
    const baseX = customPos
      ? customPos.x
      : Math.round((-viewportPan.x + 200) / (viewportZoom / 100) / 10);
    const baseY = customPos
      ? customPos.y
      : Math.round((-viewportPan.y + 150) / (viewportZoom / 100) / 10);

    let lastId: string | null = null;
    for (let i = 0; i < files.length; i++) {
      const item = await createLayerImageItemFromFile(files[i], {
        isTop: side === "top",
        defaultX: baseX + i * 20,
        defaultY: baseY + i * 20,
        index: i,
        preserveOriginal,
      });
      await updateImageLayer(item);
      lastId = item.id;
    }
    if (lastId) {
      selectImage(lastId);
    }
  };

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
          toggleGrid();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveProject, openModal, toggleLeftSidebar, setActiveTool, toggleGrid]);

  return (
    <div className="cad-app-container">
      {!manifest ? (
        <StartScreen />
      ) : (
        <>
          <TopBar />
          <div className="cad-main-workspace">
            {!leftSidebarCollapsed && <ProjectTree />}
            {activeFileType === "board" && board ? (
              <BoardCanvas />
            ) : activeFileType === "schematic" && schematic ? (
              <SchematicCanvas />
            ) : (
              <EmptyWorkspace />
            )}
            {!rightSidebarCollapsed && activeFileType === "board" && <InspectorSidebar />}
          </div>
          <StatusBar />
        </>
      )}

      {/* Modals */}
      <NewProjectModal />
      <NewDocumentModal />

      {pendingPreprocess && (
        <ImagePreprocessModal
          isOpen={Boolean(pendingPreprocess)}
          imageSrc={pendingPreprocess.filePath || pendingPreprocess.dataUrl}
          fileName={pendingPreprocess.name}
          onClose={() => setPendingPreprocess(null)}
          onApply={handlePreprocessApply}
          onBypass={handlePreprocessBypass}
        />
      )}

      {pendingBatchImport && (
        <BatchImageImportModal
          isOpen={Boolean(pendingBatchImport)}
          files={pendingBatchImport.files}
          onConfirm={handleConfirmBatchImport}
          onCancel={() => setPendingBatchImport(null)}
        />
      )}
    </div>
  );
};

export default App;
