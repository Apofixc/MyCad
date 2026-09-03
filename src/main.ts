import { Editor } from "./editor";
import { loadReferenceProject } from "./loader";
import { ComponentListPanel, InspectorPanel, NetsPanel } from "./panels";
import { openProject, saveProject } from "./storage";
import type { Project } from "./types";
import { BoardViewport } from "./viewport";

async function init(): Promise<void> {
  const canvas = document.getElementById("boardCanvas") as HTMLCanvasElement;
  const status = document.getElementById("status")!;
  const coords = document.getElementById("coords")!;
  const zoomLevel = document.getElementById("zoomLevel")!;
  const compCount = document.getElementById("compCount")!;
  const projectName = document.getElementById("projectName")!;
  const modeLabel = document.getElementById("modeLabel")!;
  const btnMode = document.getElementById("btnMode") as HTMLButtonElement;

  const viewport = new BoardViewport(canvas);
  viewport.onCursorMove = (x, y) => {
    coords.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
  };
  viewport.onZoomChange = (zoom) => {
    zoomLevel.textContent = `zoom: ${(zoom * 100).toFixed(1)}%`;
  };

  let project: Project;
  try {
    project = await loadReferenceProject();
  } catch (e) {
    status.textContent = `Ошибка загрузки проекта: ${e}`;
    return;
  }

  let editor = new Editor(project.modules[0]);
  let listPanel: ComponentListPanel;
  let netsPanel: NetsPanel;
  let inspector: InspectorPanel;

  const applyProject = (p: Project): void => {
    project = p;
    editor = new Editor(p.modules[0]);
    wireEditor();
    projectName.textContent = `MyCad — ${p.name}`;
    updateCounts();
    viewport.setModule(p.modules[0], editor, p.footprints);
    status.textContent = `Модуль: ${p.modules[0].name}`;
    listPanel.render();
    netsPanel.render();
    inspector.render();
  };

  const updateCounts = (): void => {
    const m = editor.module;
    compCount.textContent = `Компонентов: ${m.components.length}, цепей: ${Object.keys(m.nets).length}`;
  };

  const wireEditor = (): void => {
    editor.onChange = () => {
      viewport.invalidate();
      listPanel?.render();
      updateCounts();
    };
    editor.onSelectionChange = () => {
      inspector?.render();
      listPanel?.render();
      listPanel?.scrollToSelected();
    };
    editor.onNetsChange = () => {
      netsPanel?.render();
      updateCounts();
      viewport.invalidate();
    };
  };

  listPanel = new ComponentListPanel(editor, viewport);
  netsPanel = new NetsPanel(editor, viewport);
  inspector = new InspectorPanel(editor, viewport);
  wireEditor();
  projectName.textContent = `MyCad — ${project.name}`;
  updateCounts();
  viewport.setModule(project.modules[0], editor, project.footprints);
  status.textContent = `Модуль: ${project.modules[0].name}`;

  const setMode = (mode: "view" | "edit"): void => {
    editor.mode = mode;
    btnMode.textContent = mode === "edit" ? "Редактирование" : "Просмотр";
    btnMode.classList.toggle("active", mode === "edit");
    modeLabel.textContent = `Режим: ${mode === "edit" ? "редактирование" : "просмотр"}`;
  };

  btnMode.addEventListener("click", () => setMode(editor.mode === "edit" ? "view" : "edit"));

  document.getElementById("btnFit")!.addEventListener("click", () => viewport.fitToScreen());
  const btnGrid = document.getElementById("btnGrid")!;
  btnGrid.addEventListener("click", () => {
    viewport.showGrid = !viewport.showGrid;
    btnGrid.classList.toggle("active", viewport.showGrid);
    viewport.invalidate();
  });
  const btnSnap = document.getElementById("btnSnap")!;
  btnSnap.addEventListener("click", () => {
    viewport.snapToGrid = !viewport.snapToGrid;
    btnSnap.classList.toggle("active", viewport.snapToGrid);
  });
  const btnProbe = document.getElementById("btnProbe")!;
  btnProbe.addEventListener("click", () => {
    editor.probeMode = !editor.probeMode;
    btnProbe.classList.toggle("active", editor.probeMode);
    if (editor.probeMode && !editor.activeNetId) {
      status.textContent = "Прозвонка: выберите цепь во вкладке «Цепи»";
    }
    viewport.invalidate();
  });

  const tabComponents = document.getElementById("tabComponents")!;
  const tabNets = document.getElementById("tabNets")!;
  const componentsTab = document.getElementById("componentsTab")!;
  const netsTab = document.getElementById("netsTab")!;
  const showTab = (nets: boolean): void => {
    componentsTab.hidden = nets;
    netsTab.hidden = !nets;
    tabComponents.classList.toggle("active", !nets);
    tabNets.classList.toggle("active", nets);
  };
  tabComponents.addEventListener("click", () => showTab(false));
  tabNets.addEventListener("click", () => showTab(true));

  const bgOpacity = document.getElementById("bgOpacity") as HTMLInputElement;
  bgOpacity.addEventListener("input", () => {
    viewport.bgOpacity = Number(bgOpacity.value) / 100;
    viewport.invalidate();
  });
  document.getElementById("btnUndo")!.addEventListener("click", () => editor.undo());
  document.getElementById("btnRedo")!.addEventListener("click", () => editor.redo());

  document.getElementById("btnSave")?.addEventListener("click", async () => {
    try {
      const saved = await saveProject(project as any);
      if (saved) status.textContent = `Сохранено: ${saved.path}`;
    } catch (e) {
      status.textContent = `Ошибка сохранения: ${e}`;
    }
  });
  document.getElementById("btnOpen")?.addEventListener("click", async () => {
    try {
      const res = await openProject();
      if (res) applyProject(res.project as any);
    } catch (e) {
      status.textContent = `Ошибка открытия: ${e}`;
    }
  });

  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

    if (e.code === "Escape") {
      editor.select(null);
      e.preventDefault();
    } else if (e.code === "Space") {
      viewport.setSpaceDown(true);
      e.preventDefault();
    } else if (e.code === "KeyF") {
      viewport.fitToScreen();
      e.preventDefault();
    } else if (e.code === "KeyG") {
      btnGrid.dispatchEvent(new Event("click"));
      e.preventDefault();
    } else if (e.code === "KeyZ" && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) editor.redo();
      else editor.undo();
      e.preventDefault();
    } else if (editor.mode === "edit") {
      if (e.code === "KeyL") {
        editor.toggleLockSelected();
      } else if (e.code === "KeyR") {
        editor.rotateSelected(e.shiftKey ? -45 : 45);
      } else if (e.code === "KeyP") {
        editor.toggleLayerSelected();
      } else if (e.code === "Delete" || e.code === "Backspace") {
        editor.deleteSelected();
      } else if (e.code === "KeyD" && (e.ctrlKey || e.metaKey)) {
        editor.duplicateSelected();
        e.preventDefault();
      } else if (e.code.startsWith("Arrow")) {
        const step = e.shiftKey ? 50 : 10;
        const dx = e.code === "ArrowLeft" ? -step : e.code === "ArrowRight" ? step : 0;
        const dy = e.code === "ArrowUp" ? -step : e.code === "ArrowDown" ? step : 0;
        editor.moveSelected(dx, dy);
        e.preventDefault();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") viewport.setSpaceDown(false);
  });
}

init();
