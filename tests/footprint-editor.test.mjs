import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { after, afterEach, before, test } from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { createServer } from "vite";

let server, geometry, generator, calibration, mapping, alignment, Canvas, PackageEditor, DeviceEditor, CalibrationModal;
const originals = { window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver, alert: globalThis.alert };
const renderers = [];
const alerts = [];
const pkg = {
  id: "custom", name: "Custom", mountType: "mixed", bodyWidth: 4, bodyHeight: 2, pitch: 1.27,
  pads: [
    { padNum: "A1", name: "A1", x: 0, y: 0, width: 1, height: 1, rotation: 0, shape: "circle" },
    { padNum: "B2", name: "B2", x: 3, y: 4, width: 1, height: 1, rotation: 0, shape: "rect" },
    { padNum: "EP", name: "EP", x: 2, y: 2, width: 1, height: 1, rotation: 0, shape: "rect" },
  ],
  graphics: [], variants: [], defaultVariantId: "",
  constraints: { courtyardWidth: 6, courtyardHeight: 6, maxHeight: 2 },
};
const pins = [
  { id: "p1", name: "GND", electricalType: "ground" },
  { id: "p2", name: "VCC", electricalType: "power_in" },
];

before(async () => {
  globalThis.window = new EventTarget();
  globalThis.window.confirm = () => true;
  globalThis.alert = (message) => alerts.push(message);
  globalThis.document = { activeElement: null, body: { nodeType: 1, children: [] } };
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { this.callback(); }
    disconnect() {}
  };
  server = await createServer({ configFile: false,
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } }, appType: "custom" });
  [geometry, generator, calibration, mapping, alignment] = await Promise.all([
    "/src/utils/footprintGeometry.ts", "/src/utils/footprintGenerator.ts", "/src/utils/calibration.ts",
    "/src/utils/pinMapping.ts", "/src/utils/alignmentMath.ts",
  ].map((path) => server.ssrLoadModule(path)));
  ({ InteractiveFootprintCanvas: Canvas } = await server.ssrLoadModule("/src/components/SvgRenderer/InteractiveFootprintCanvas.tsx"));
  ({ PackageEditorModal: PackageEditor } = await server.ssrLoadModule("/src/components/Modals/PackageEditorModal.tsx"));
  ({ DeviceEditorModal: DeviceEditor } = await server.ssrLoadModule("/src/components/Modals/DeviceEditorModal.tsx"));
  ({ CalibrationModal } = await server.ssrLoadModule("/src/components/Modals/CalibrationModal.tsx"));
});
afterEach(() => { act(() => renderers.splice(0).forEach((renderer) => renderer.unmount())); alerts.length = 0; });
after(async () => { await server.close(); Object.assign(globalThis, originals); });

function mount(component, props = {}) {
  const canvasNode = {
    clientWidth: 800, clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    focus() { document.activeElement = this; },
    contains(element) { return element === this; },
  };
  let renderer;
  act(() => { renderer = create(React.createElement(component, props), {
    createNodeMock: (element) => element.type === "div" && element.props.tabIndex === 0 ? canvasNode : null,
  }); });
  renderers.push(renderer);
  canvasNode.focus();
  return renderer;
}
function key(value, options = {}) {
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, { key: value, ...options });
  act(() => { window.dispatchEvent(event); });
}
function button(renderer, title) {
  return renderer.root.findAllByType("button").find((item) => (item.props.title ?? "").includes(title));
}
function saveButton(renderer) {
  return renderer.root.findAllByType("button").find((item) =>
    item.findAllByType("svg").some((svg) => svg.props.className?.includes("lucide-save")));
}

test("custom polygons preserve position through pad conversion and rotated bounds", () => {
  const polygon = { id: "outline", kind: "polygon", points: [[10, 20], [14, 20], [12, 22]], strokeWidth: 0.15, layer: "top_fab" };
  const pad = geometry.polygonToPad(polygon, "EP");
  assert.deepEqual(pad.polygonPoints.map(([x, y]) => [x + pad.x, y + pad.y]), polygon.points);
  assert.equal(geometry.getPadPath(pad), geometry.getGraphicPath(polygon));
  assert.deepEqual(geometry.getFootprintBounds([{ ...pad, rotation: 90 }], []),
    { minX: 11, maxX: 13, minY: 19, maxY: 23 });
  assert.equal(geometry.validateFootprint([pad], [polygon]), null);
  assert.match(geometry.validateFootprint([{ ...pad, polygonPoints: [[0, 0]] }], []), /три вершины/);
});

test("arc paths handle full turns and wraparound without degenerate SVG arcs", () => {
  const arc = { id: "arc", kind: "arc", cx: 0, cy: 0, radius: 2, startAngle: 0, endAngle: 360, strokeWidth: 0.1, layer: "top_silk" };
  const path = geometry.getArcPath(arc);
  assert.equal((path.match(/ A /g) ?? []).length, 2);
  assert.ok(path.includes("M 2 0"));
  assert.ok(!/NaN|Infinity/.test(geometry.getArcPath({ ...arc, startAngle: 350, endAngle: 10 })));
  assert.match(geometry.validateFootprint([], [{ ...arc, radius: -1 }]), /положительными/);
  assert.match(generator.getDShapePath(0, 0, 2, "right", -0.5), /A 2 2 0 0 1/);
  assert.match(generator.getDShapePath(0, 0, 2, "right", 0.5), /A 2 2 0 1 1/);
});

test("large BGA arrays and appended arrays retain unique alphanumeric pad numbers", () => {
  const pads = generator.generateMatrixPadArray(24, 24, 0.8);
  assert.equal(pads.length, 576);
  assert.equal(new Set(pads.map((p) => p.padNum)).size, 576);
  assert.equal(pads[20 * 24].padNum, "AA1");
  const result = geometry.appendUniquePads(pads, pads);
  assert.equal(new Set(result.map((p) => p.padNum)).size, 1152);
  assert.equal(result[0].padNum, "A1");
  assert.equal(geometry.validateFootprint(result, []), null);
});

test("polygon, arc and text tools finish their click sequences; Escape abandons partial outlines", () => {
  let state;
  function Harness() {
    const [graphics, setGraphics] = React.useState([]);
    const [tool, setTool] = React.useState("polygon");
    state = { graphics, tool, setTool };
    return React.createElement(Canvas, {
      pads: [], graphics, activeTool: tool, gridStep: 0.1, snapToGrid: true, newPadTemplate: {},
      onGraphicsChange: setGraphics, onPadsChange() {}, onSelectPad() {}, onSelectGraphic() {},
      onShiftOrigin() {}, onSetActiveTool: setTool,
    });
  }
  const renderer = mount(Harness);
  const click = (x, y) => act(() => renderer.root.findByProps({ tabIndex: 0 }).props.onMouseDown({
    button: 0, clientX: 400 + x * 30, clientY: 300 + y * 30,
  }));
  click(0, 0); click(2, 0);
  key("Enter");
  assert.equal(state.graphics.length, 0);
  click(2, 2); key("Enter");
  assert.deepEqual(state.graphics[0].points, [[0, 0], [2, 0], [2, 2]]);
  assert.equal(state.tool, "select");
  act(() => state.setTool("polygon"));
  click(0, 0); click(1, 0); key("Escape");
  assert.equal(state.graphics.length, 1);
  act(() => state.setTool("arc"));
  click(0, 0); click(2, 0); click(0, 2);
  assert.deepEqual([state.graphics[1].radius, state.graphics[1].startAngle, state.graphics[1].endAngle], [2, 0, 90]);
  act(() => state.setTool("text"));
  click(1, 2);
  assert.equal(state.graphics[2].kind, "text");
  assert.deepEqual([state.graphics[2].x, state.graphics[2].y], [1, 2]);
});

test("one drag is one undo step, redo restores the result, and a new edit discards redo", () => {
  const renderer = mount(PackageEditor, { isOpen: true, initialPackage: pkg, onClose() {}, onSave: async () => true });
  const canvas = () => renderer.root.findByType(Canvas).props;
  act(() => canvas().onInteractionStart());
  act(() => canvas().onPadsChange(canvas().pads.map((p) => ({ ...p, x: p.x + 1 }))));
  act(() => canvas().onPadsChange(canvas().pads.map((p) => ({ ...p, x: p.x + 2 }))));
  act(() => canvas().onInteractionEnd());
  assert.equal(canvas().pads[0].x, 3);
  act(() => canvas().onUndo());
  assert.deepEqual(canvas().pads, pkg.pads);
  act(() => canvas().onRedo());
  assert.equal(canvas().pads[0].x, 3);
  act(() => canvas().onUndo());
  act(() => canvas().onPadsChange(canvas().pads.map((p) => ({ ...p, y: p.y + 5 }))));
  act(() => canvas().onRedo());
  assert.deepEqual([canvas().pads[0].x, canvas().pads[0].y], [0, 5]);
});

test("package reference dimensions support body, pitch and arbitrary pad-center distances", () => {
  assert.equal(calibration.packageReferenceDistance(pkg, "width"), 4);
  assert.equal(calibration.packageReferenceDistance(pkg, "height"), 2);
  assert.equal(calibration.packageReferenceDistance(pkg, "pitch"), 1.27);
  assert.equal(calibration.packageReferenceDistance(pkg, "pads", "A1", "B2"), 5);
  assert.equal(calibration.packageReferenceDistance(pkg, "pads", "A1", "A1"), null);
  assert.equal(calibration.packageReferenceDistance(pkg, "pads", "A1", "missing"), null);
});

test("calibration preserves the first point for scaled, rotated and flipped images", () => {
  for (const mirrored of [false, true]) for (const flipV of [false, true]) {
    const layer = { id: "scan", side: "bottom", pxPerMm: 20, scale: 2.7, rotation: 37, offsetX: 12, offsetY: 43, mirrored, flipV };
    const first = { x: 20, y: 50 }, second = { x: 29, y: 57 };
    const a = alignment.boardMmToLayerBitmapPx(first, layer, 800, 600);
    const b = alignment.boardMmToLayerBitmapPx(second, layer, 800, 600);
    const measured = Math.hypot(a.x - b.x, a.y - b.y);
    const result = calibration.calibrateImageLayer(layer, measured, 5, {
      bitmapX: a.x, bitmapY: a.y, boardX: first.x, boardY: first.y, width: 800, height: 600,
    });
    const anchored = alignment.boardMmToLayerBitmapPx(first, result, 800, 600);
    assert.ok(Math.hypot(anchored.x - a.x, anchored.y - a.y) < 1e-8);
    assert.ok(Math.abs(measured / result.pxPerMm * result.scale - 5) < 1e-8);
    assert.equal(result.scale, 1);
    assert.equal(result.side, "bottom");
  }
  assert.throws(() => calibration.calibrateImageLayer({}, 0, 5, {}));
});

test("calibration modal selects a saved body size and remains editable after failed persistence", async () => {
  let applied, finish, closed = false;
  const renderer = mount(CalibrationModal, {
    isOpen: true, measuredPx: 100, currentPxPerMm: 10, packages: [pkg], initialPackageId: pkg.id,
    onClose: () => { closed = true; },
    onApply: (distance) => { applied = distance; return new Promise((resolve) => { finish = resolve; }); },
  });
  let pending;
  act(() => { pending = renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  assert.equal(applied, 4);
  assert.equal(renderer.root.findByType("fieldset").props.disabled, true);
  await act(async () => { finish(false); await pending; });
  assert.equal(closed, false);
  assert.equal(renderer.root.findByType("fieldset").props.disabled, false);
  act(() => renderer.root.findAllByType("select")[0].props.onChange({ target: { value: "" } }));
  assert.equal(renderer.root.findByType("input").props.readOnly, false);
});

test("legacy name and ID mappings normalize without losing multi-pad or undeclared pins", async () => {
  const normalized = mapping.normalizeDeviceMapping(pins, [
    { packageId: "one", pinMap: { GND: "A1", p2: "B2", SHIELD: "EP" }, multiPinMap: { GND: ["A1", "B1"] } },
  ]);
  assert.deepEqual(normalized.supportedPackages[0].multiPinMap.p1, ["A1", "B1"]);
  assert.equal(normalized.supportedPackages[0].pinMap.p2, "B2");
  assert.ok(normalized.logicalPins.some((p) => p.id === "SHIELD"));
  assert.equal(mapping.mappingError(normalized.supportedPackages[0], normalized.logicalPins, new Set(["A1", "B1", "B2", "EP"])), null);
  const library = JSON.parse(await readFile(new URL("../src-tauri/src/library/default_library.json", import.meta.url), "utf8"));
  for (const device of library.devices) {
    const packages = (device.supportedPackages ?? []).map((p) => ({ ...p, pinMap: p.pinMap ?? p.pinMapping ?? {} }));
    const converted = mapping.normalizeDeviceMapping(device.logicalPins ?? [], packages);
    for (const result of converted.supportedPackages) {
      const original = packages.find((p) => p.packageId === result.packageId);
      assert.deepEqual(new Set(mapping.mappingEntries(result).flatMap(([, pads]) => pads)),
        new Set(mapping.mappingEntries(original).flatMap(([, pads]) => pads)));
    }
  }
});

test("duplicate display names stay independent and multi-pad ownership conflicts are rejected", () => {
  const duplicateNames = [pins[0], { ...pins[1], name: "GND" }];
  let value = mapping.setMappedPads({ packageId: pkg.id, pinMap: {} }, "p1", ["A1", "EP"]);
  value = mapping.setMappedPads(value, "p2", ["B2"]);
  assert.equal(mapping.mappingError(value, duplicateNames, new Set(["A1", "B2", "EP"])), null);
  const conflict = mapping.setMappedPads(value, "p2", ["B2", "EP"]);
  assert.match(mapping.mappingError(conflict, duplicateNames, new Set(["A1", "B2", "EP"])), /нескольким/);
  assert.deepEqual(mapping.mappedPads(mapping.setMappedPads(value, "p1", []), pins[0]), []);
});

test("device rename keeps per-package assignments; deleting a pin removes primary and multi-pad links", async () => {
  let saved;
  const renderer = mount(DeviceEditor, {
    isOpen: true, availablePackages: [pkg, { ...pkg, id: "second" }], categories: [],
    initialDevice: {
      id: "device", name: "Test", category: "Test", designatorPrefix: "U", logicalPins: pins,
      supportedPackages: [
        { packageId: pkg.id, pinMap: { GND: "A1", p2: "B2" }, multiPinMap: { GND: ["A1", "EP"] } },
        { packageId: "second", pinMap: { p1: "B2" } },
      ], parameters: {}, tags: [], description: "",
    }, onClose() {}, onSave: async (value) => { saved = value; return true; },
  });
  const tab = renderer.root.findAllByType("button").find((item) =>
    item.findAllByType("span").some((span) => span.props.children === "2. Выводы схемы (Pins) & Сопоставление"));
  act(() => tab.props.onClick());
  const pinInput = () => renderer.root.findAllByType("input").find((input) => input.props.value === "GND");
  assert.ok(pinInput());
  const name = pinInput();
  act(() => name.props.onChange({ target: { value: "" } }));
  assert.equal(name.props.value, "");
  act(() => name.props.onChange({ target: { value: "GROUND" } }));
  await act(async () => { await saveButton(renderer).props.onClick(); });
  assert.equal(saved.logicalPins[0].name, "GROUND");
  assert.deepEqual(saved.supportedPackages.map((p) => p.pinMap.p1), ["A1", "B2"]);
  assert.deepEqual(saved.supportedPackages[0].multiPinMap.p1, ["A1", "EP"]);
  const remove = button(renderer, "Удалить вывод");
  assert.ok(remove);
  act(() => remove.props.onClick({ stopPropagation() {} }));
  await act(async () => { await saveButton(renderer).props.onClick(); });
  assert.ok(!saved.logicalPins.some((p) => p.id === "p1"));
  assert.ok(saved.supportedPackages.every((p) => !p.pinMap.p1 && !p.multiPinMap.p1));
});
