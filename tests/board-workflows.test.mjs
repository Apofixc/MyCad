import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { createServer } from "vite";

let server;
let projectStore;
let libraryStore;
let errors;
let engineClient;
let libraryApi;
let DeviceEditorModal;
let PackageEditorModal;
const renderers = [];
const originalWindow = globalThis.window;

before(async () => {
  globalThis.window = new EventTarget();
  server = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: "custom",
  });
  ({ useProjectStore: projectStore } = await server.ssrLoadModule("/src/stores/projectStore.ts"));
  ({ useLibraryStore: libraryStore } = await server.ssrLoadModule("/src/stores/libraryStore.ts"));
  ({ useErrorStore: errors } = await server.ssrLoadModule("/src/stores/errorStore.ts"));
  ({ engineClient } = await server.ssrLoadModule("/src/api/engineClient.ts"));
  ({ libraryApi } = await server.ssrLoadModule("/src/api/libraryApi.ts"));
  ({ DeviceEditorModal } = await server.ssrLoadModule("/src/components/Modals/DeviceEditorModal.tsx"));
  ({ PackageEditorModal } = await server.ssrLoadModule("/src/components/Modals/PackageEditorModal.tsx"));
});

beforeEach(() => {
  errors.getState().clearError();
  libraryStore.setState({ packages: [], devices: [], error: null });
});

after(async () => {
  act(() => renderers.forEach((renderer) => renderer.unmount()));
  await server?.close();
  globalThis.window = originalWindow;
});

function board(id, images = []) {
  return {
    id, name: id, type: "board", orderIndex: 0,
    data: { id, name: id, bgTop: { images }, bgBottom: { images: [] }, components: [] },
  };
}

function setBoards(boards, activeId) {
  projectStore.setState({
    boards, board: boards.find((b) => b.id === activeId), activeFileId: activeId,
    activeFileType: "board", schematics: [], schematic: null, isDirty: false,
  });
}

function mount(Component, props) {
  let renderer;
  act(() => { renderer = create(React.createElement(Component, props)); });
  renderers.push(renderer);
  return renderer;
}

function saveButton(renderer) {
  return renderer.root.findAllByType("button").find((button) =>
    button.findAllByType("svg").some((svg) => svg.props.className?.includes("lucide-save")));
}

test("updating an inactive board image moves it between sides without duplicating it", async () => {
  const image = { id: "scan", name: "Scan", side: "top" };
  setBoards([board("A", [image]), board("B")], "B");
  engineClient.updateImageLayers = async (layers, fileId) => {
    assert.equal(fileId, "B");
    return layers;
  };
  assert.equal(await projectStore.getState().updateImageLayer({ ...image, side: "bottom" }), true);
  const state = projectStore.getState();
  assert.equal(state.boards[0].data.bgTop.images.length, 0);
  assert.equal(state.boards[0].data.bgBottom.images[0].id, "scan");
  assert.equal(state.boards[1].data.bgBottom.images.length, 0);
  assert.equal(state.board.id, "B");
});

test("switching documents during an image save preserves the active document", async () => {
  setBoards([board("A"), board("B")], "A");
  let finish;
  engineClient.updateImageLayers = (layers) => new Promise((resolve) => {
    finish = () => resolve(layers);
  });
  const pending = projectStore.getState().updateImageLayer({ id: "new", side: "top" });
  projectStore.setState({ activeFileId: "B", board: projectStore.getState().boards[1] });
  finish();
  await pending;
  assert.equal(projectStore.getState().board.id, "B");
  assert.equal(projectStore.getState().boards[0].data.bgTop.images[0].id, "new");
  assert.equal(projectStore.getState().boards[1].data.bgTop.images.length, 0);
});

test("failed image writes and deletes keep local data intact", async () => {
  const image = { id: "scan", side: "top" };
  setBoards([board("A", [image])], "A");
  engineClient.updateImageLayers = async () => { throw new Error("disk full"); };
  engineClient.deleteImageLayer = async () => { throw new Error("disk full"); };
  assert.equal(await projectStore.getState().updateImageLayer({ ...image, side: "bottom" }), false);
  await projectStore.getState().batchDeleteLayers(["scan"]);
  assert.deepEqual(projectStore.getState().board.data.bgTop.images, [image]);
  assert.equal(projectStore.getState().isDirty, false);
});

test("new schematic backgrounds do not leak onto boards", async () => {
  setBoards([board("A")], null);
  const schematic = { id: "S", data: { bg: { images: [] } } };
  projectStore.setState({
    schematics: [schematic], schematic, activeFileId: "S", activeFileType: "schematic",
  });
  engineClient.updateImageLayers = async (layers) => layers;
  await projectStore.getState().updateImageLayer({ id: "scan-s", side: "top" });
  assert.equal(projectStore.getState().schematic.data.bg.images[0].id, "scan-s");
  assert.equal(projectStore.getState().boards[0].data.bgTop.images.length, 0);
  assert.equal(projectStore.getState().board, null);
});

test("failed component placement and library saves report failure without updating local state", async () => {
  setBoards([board("A")], "A");
  engineClient.boardAddComponent = async () => { throw new Error("cannot save"); };
  libraryApi.savePackage = async () => { throw new Error("cannot save package"); };
  libraryApi.saveDevice = async () => { throw new Error("cannot save device"); };
  assert.equal(await projectStore.getState().addComponent({ id: "R1" }), false);
  assert.equal(await libraryStore.getState().savePackage({ id: "pkg" }), false);
  assert.deepEqual(libraryStore.getState().packages, []);
  assert.match(errors.getState().currentError.message, /cannot save package/);
  assert.equal(await libraryStore.getState().saveDevice({ id: "dev" }), false);
  assert.deepEqual(libraryStore.getState().devices, []);
  assert.match(errors.getState().currentError.message, /cannot save device/);
});

test("creating a package while editing a device preserves the unsaved device draft", async () => {
  const saved = [];
  let closed = 0;
  const props = {
    isOpen: true, initialDevice: null, availablePackages: [],
    onSave: async (device) => { saved.push(device); return false; },
    onClose: () => { closed++; },
  };
  const renderer = mount(DeviceEditorModal, props);
  const name = renderer.root.findByProps({ placeholder: "напр. NE555, STM32F103, 1N4148" });
  act(() => name.props.onChange({ target: { value: "Unsaved amplifier" } }));
  const pkg = { id: "new-package", name: "Custom", pads: [], variants: [], mountType: "smd" };
  act(() => renderer.update(React.createElement(DeviceEditorModal, { ...props, availablePackages: [pkg] })));
  await act(async () => { await saveButton(renderer).props.onClick(); });
  assert.equal(saved[0].name, "Unsaved amplifier");
  assert.equal(closed, 0);
});

test("package editor waits for persistence, retains metadata, and allows retry after failure", async () => {
  let finish;
  let saved;
  let closed = 0;
  const renderer = mount(PackageEditorModal, {
    isOpen: true,
    initialPackage: {
      id: "pkg", name: "Custom", family: "discrete", mountType: "smd",
      bodyWidth: 4, bodyHeight: 2, pads: [], graphics: [], variants: [],
      model3d: { filePath: "part.step", offset: [1, 2, 3], rotation: [10, 20, 30], scale: [2, 2, 2] },
    },
    onClose: () => { closed++; },
    onSave: (pkg) => {
      saved = pkg;
      return new Promise((resolve) => { finish = resolve; });
    },
  });
  let pending;
  act(() => { pending = saveButton(renderer).props.onClick(); });
  assert.equal(saveButton(renderer).props.disabled, true);
  assert.equal(closed, 0);
  assert.equal(saved.family, "discrete");
  assert.deepEqual(saved.model3d.offset, [1, 2, 3]);
  assert.deepEqual(saved.model3d.rotation, [10, 20, 30]);
  assert.deepEqual(saved.model3d.scale, [2, 2, 2]);
  await act(async () => { finish(false); await pending; });
  assert.equal(closed, 0);
  assert.equal(saveButton(renderer).props.disabled, false);
  act(() => { pending = saveButton(renderer).props.onClick(); });
  await act(async () => { finish(true); await pending; });
  assert.equal(closed, 1);
});
