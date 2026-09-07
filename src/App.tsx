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

export const App: React.FC = () => {
  const { manifest, saveProject, activeFileType, board, schematic } = useProjectStore();
  const {
    leftSidebarCollapsed,
    rightSidebarCollapsed,
    toggleLeftSidebar,
    openModal,
    setActiveTool,
    toggleGrid,
  } = useUiStore();

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
      <ImagePreprocessModal />
    </div>
  );
};

export default App;
