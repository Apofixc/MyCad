import type { Editor } from "./editor";
import { mstEdges, pinPositions } from "./geometry";
import type { Component, Footprint, Module } from "./types";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const MIN_ZOOM = 0.005;
const MAX_ZOOM = 5.0;

const LAYER_COLORS: Record<string, string> = {
  top: "#38bdf8",
  bottom: "#f472b6",
};

/** Canvas2D-вьюпорт: фото-подложка, сетка, контур платы, компоненты, pan/zoom,
 *  выделение и перетаскивание компонентов в режиме редактирования. */
export class BoardViewport {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera = { x: 0, y: 0, zoom: 0.1 };
  private module: Module | null = null;
  private editor: Editor | null = null;
  private footprints: Record<string, Footprint> = {};
  private bgImage: HTMLImageElement | null = null;
  private needsRender = true;

  private panning = false;
  private draggingComp: Component | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragMoved = false;
  private lastMouse = { x: 0, y: 0 };
  private spaceDown = false;

  showGrid = false;
  gridSize = 50;
  snapToGrid = false;
  bgOpacity = 0.85;

  onCursorMove: ((wx: number, wy: number) => void) | null = null;
  onZoomChange: ((zoom: number) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas2D недоступен");
    this.ctx = ctx;
    this.bindEvents();
    this.resize();
    const loop = () => {
      if (this.needsRender) {
        this.needsRender = false;
        this.render();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setModule(module: Module, editor: Editor, footprints: Record<string, Footprint>): void {
    this.module = module;
    this.editor = editor;
    this.footprints = footprints;
    const photo = module.images[0];
    if (photo) {
      const img = new Image();
      img.onload = () => this.invalidate();
      img.src = "/" + photo.path;
      this.bgImage = img;
    }
    this.fitToScreen();
  }

  invalidate(): void {
    this.needsRender = true;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = parent.clientWidth * dpr;
    this.canvas.height = parent.clientHeight * dpr;
    this.canvas.style.width = `${parent.clientWidth}px`;
    this.canvas.style.height = `${parent.clientHeight}px`;
    this.invalidate();
  }

  fitToScreen(): void {
    if (!this.module) return;
    const dpr = window.devicePixelRatio || 1;
    const vw = this.canvas.width / dpr;
    const vh = this.canvas.height / dpr;
    const margin = 0.95;
    const zoom = Math.min(vw / this.module.width_px, vh / this.module.height_px) * margin;
    this.camera.zoom = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
    this.camera.x = (vw - this.module.width_px * this.camera.zoom) / 2;
    this.camera.y = (vh - this.module.height_px * this.camera.zoom) / 2;
    this.onZoomChange?.(this.camera.zoom);
    this.invalidate();
  }

  panToComponent(c: Component): void {
    const dpr = window.devicePixelRatio || 1;
    const vw = this.canvas.width / dpr;
    const vh = this.canvas.height / dpr;
    const cx = c.x + c.width / 2;
    const cy = c.y + c.height / 2;
    this.camera.x = vw / 2 - cx * this.camera.zoom;
    this.camera.y = vh / 2 - cy * this.camera.zoom;
    this.invalidate();
  }

  setSpaceDown(down: boolean): void {
    this.spaceDown = down;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.camera.x) / this.camera.zoom,
      y: (sy - this.camera.y) / this.camera.zoom,
    };
  }

  /** Поиск верхнего компонента под точкой (с учётом поворота). */
  hitTest(wx: number, wy: number): Component | null {
    if (!this.module) return null;
    const comps = this.module.components;
    for (let i = comps.length - 1; i >= 0; i--) {
      const c = comps[i];
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      const rad = (-c.rotation * Math.PI) / 180;
      const dx = wx - cx;
      const dy = wy - cy;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (Math.abs(lx) <= c.width / 2 && Math.abs(ly) <= c.height / 2) return c;
    }
    return null;
  }

  /** Поиск ближайшего пина в радиусе захвата (для прозвонки). */
  hitTestPin(wx: number, wy: number): { compId: string; pin: string } | null {
    if (!this.module) return null;
    const grabRadius = 24 / this.camera.zoom;
    let best: { compId: string; pin: string } | null = null;
    let bestDist = grabRadius * grabRadius;
    for (const c of this.module.components) {
      const fp = this.footprints[c.footprint];
      for (const p of pinPositions(c, fp)) {
        const dx = p.x - wx;
        const dy = p.y - wy;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = { compId: c.id, pin: p.num };
        }
      }
    }
    return best;
  }

  private snap(v: number): number {
    return this.snapToGrid ? Math.round(v / this.gridSize) * this.gridSize : v;
  }

  private bindEvents(): void {
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("mousedown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const w = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;

      const editor = this.editor;
      if (editor?.probeMode && editor.activeNet && !this.spaceDown) {
        const pin = this.hitTestPin(w.x, w.y);
        if (pin) {
          editor.togglePinInActiveNet(pin.compId, pin.pin);
          return;
        }
        this.panning = true;
        return;
      }
      if (editor && !this.spaceDown) {
        const hit = this.hitTest(w.x, w.y);
        if (hit) {
          editor.select(hit.id);
          if (editor.mode === "edit" && !hit.locked) {
            this.draggingComp = hit;
            this.dragOffset = { x: w.x - hit.x, y: w.y - hit.y };
            return;
          }
          this.panning = true;
          return;
        }
        editor.select(null);
      }
      this.panning = true;
    });

    window.addEventListener("mouseup", () => {
      if (this.draggingComp && this.dragMoved) this.editor?.commit();
      this.draggingComp = null;
      this.panning = false;
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const w = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.onCursorMove?.(w.x, w.y);

      if (this.draggingComp) {
        this.draggingComp.x = this.snap(w.x - this.dragOffset.x);
        this.draggingComp.y = this.snap(w.y - this.dragOffset.y);
        this.dragMoved = true;
        this.invalidate();
        return;
      }
      if (this.panning) {
        this.camera.x += e.clientX - this.lastMouse.x;
        this.camera.y += e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.invalidate();
      }
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newZoom = Math.min(Math.max(this.camera.zoom * factor, MIN_ZOOM), MAX_ZOOM);
        // zoom к курсору: точка мира под курсором остаётся на месте
        const wx = (mx - this.camera.x) / this.camera.zoom;
        const wy = (my - this.camera.y) / this.camera.zoom;
        this.camera.zoom = newZoom;
        this.camera.x = mx - wx * newZoom;
        this.camera.y = my - wy * newZoom;
        this.onZoomChange?.(newZoom);
        this.invalidate();
      },
      { passive: false },
    );
  }

  private render(): void {
    const { ctx, canvas, camera } = this;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (!this.module) return;
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    if (this.bgImage?.complete && this.bgImage.naturalWidth > 0) {
      ctx.globalAlpha = this.bgOpacity;
      ctx.drawImage(this.bgImage, 0, 0, this.module.width_px, this.module.height_px);
      ctx.globalAlpha = 1;
    }

    if (this.showGrid) this.renderGrid();
    this.renderBoardOutline();
    this.renderComponents();
    this.renderActiveNet();
    ctx.restore();
  }

  private renderGrid(): void {
    const { ctx, module } = this;
    if (!module) return;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.beginPath();
    for (let x = 0; x <= module.width_px; x += this.gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, module.height_px);
    }
    for (let y = 0; y <= module.height_px; y += this.gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(module.width_px, y);
    }
    ctx.stroke();
  }

  private renderBoardOutline(): void {
    const { ctx, module } = this;
    if (!module) return;
    const r = module.board_rect;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3 / this.camera.zoom;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
  }

  private renderComponents(): void {
    const { ctx, module, camera } = this;
    if (!module) return;
    const selectedId = this.editor?.selectedId ?? null;

    for (const c of module.components) {
      ctx.save();
      ctx.translate(c.x + c.width / 2, c.y + c.height / 2);
      ctx.rotate((c.rotation * Math.PI) / 180);
      const color = LAYER_COLORS[c.layer] ?? "#38bdf8";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / camera.zoom;
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(-c.width / 2, -c.height / 2, c.width, c.height);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
      ctx.globalAlpha = 1;

      if (c.id === selectedId) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 4 / camera.zoom;
        ctx.setLineDash([12 / camera.zoom, 8 / camera.zoom]);
        const pad = 14;
        ctx.strokeRect(
          -c.width / 2 - pad,
          -c.height / 2 - pad,
          c.width + pad * 2,
          c.height + pad * 2,
        );
        ctx.setLineDash([]);
        if (c.locked) {
          ctx.fillStyle = "#f59e0b";
          ctx.font = `${Math.max(c.height * 0.3, 40)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("🔒", 0, 0);
        }
      }
      ctx.restore();

      this.renderPins(c);

      if (c.show_designator && camera.zoom > 0.03) {
        const fontPx = Math.min(Math.max(c.height * 0.35, 24), 90);
        ctx.fillStyle = c.id === selectedId ? "#fbbf24" : "#e2e8f0";
        ctx.font = `${fontPx}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(c.designator, c.x + c.width / 2, c.y - 10);
      }
    }
  }

  /** Пины компонента: видны при достаточном зуме, у выбранного компонента и в прозвонке. */
  private renderPins(c: Component): void {
    const { ctx, camera, editor } = this;
    const probing = editor?.probeMode ?? false;
    const isSelected = c.id === editor?.selectedId;
    if (!probing && !isSelected && camera.zoom < 0.18) return;
    const fp = this.footprints[c.footprint];
    const pins = pinPositions(c, fp);
    if (pins.length === 0) return;

    const r = Math.max(8, 5 / camera.zoom);
    for (const p of pins) {
      const net = editor?.netOfPin(c.id, p.num) ?? null;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = net ? net.color : "rgba(226, 232, 240, 0.85)";
      ctx.fill();
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();
      if (camera.zoom > 0.4 || (isSelected && camera.zoom > 0.2)) {
        ctx.fillStyle = "#0f172a";
        ctx.font = `${r * 1.1}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.num, p.x, p.y);
        ctx.textBaseline = "alphabetic";
      }
    }
  }

  /** Подсветка активной цепи: пины + ratlines по минимальному остовному дереву. */
  private renderActiveNet(): void {
    const { ctx, camera, editor, module } = this;
    const net = editor?.activeNet;
    if (!net || !module) return;

    const points: Array<{ x: number; y: number }> = [];
    for (const node of net.nodes) {
      const c = module.components.find((x) => x.id === node.comp_id);
      if (!c) continue;
      const fp = this.footprints[c.footprint];
      const pin = pinPositions(c, fp).find((p) => p.num === node.pin);
      if (pin) points.push({ x: pin.x, y: pin.y });
      else points.push({ x: c.x + c.width / 2, y: c.y + c.height / 2 });
    }

    ctx.strokeStyle = net.color || "#f97316";
    ctx.lineWidth = 3 / camera.zoom;
    ctx.setLineDash([16 / camera.zoom, 10 / camera.zoom]);
    ctx.beginPath();
    for (const [a, b] of mstEdges(points)) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const r = Math.max(12, 8 / camera.zoom);
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = net.color || "#f97316";
      ctx.lineWidth = 4 / camera.zoom;
      ctx.stroke();
    }
  }
}
