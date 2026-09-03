import type { Component, Module, Net } from "./types";

export type Mode = "view" | "edit";

const HISTORY_LIMIT = 100;

/** Состояние редактирования: выделение, режим, история undo/redo. */
export class Editor {
  mode: Mode = "view";
  selectedId: string | null = null;
  activeNetId: string | null = null;
  probeMode = false;

  private history: string[] = [];
  private historyIndex = -1;

  onChange: (() => void) | null = null;
  onSelectionChange: (() => void) | null = null;
  onNetsChange: (() => void) | null = null;

  constructor(public module: Module) {
    this.resetHistory();
  }

  resetHistory(): void {
    this.history = [this.snapshot()];
    this.historyIndex = 0;
  }

  private snapshot(): string {
    return JSON.stringify({ components: this.module.components, nets: this.module.nets });
  }

  get selected(): Component | null {
    if (!this.selectedId) return null;
    return this.module.components.find((c) => c.id === this.selectedId) ?? null;
  }

  get activeNet(): Net | null {
    if (!this.activeNetId) return null;
    return this.module.nets[this.activeNetId] ?? null;
  }

  setActiveNet(id: string | null): void {
    this.activeNetId = id;
    this.onNetsChange?.();
    this.onChange?.();
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.onSelectionChange?.();
    this.onChange?.();
  }

  /** Фиксирует текущее состояние компонентов в истории. */
  commit(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const snapshot = this.snapshot();
    if (snapshot === this.history[this.historyIndex]) return;
    this.history.push(snapshot);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.onChange?.();
  }

  undo(): void {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.restoreSnapshot();
  }

  redo(): void {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.restoreSnapshot();
  }

  private restoreSnapshot(): void {
    const snap = JSON.parse(this.history[this.historyIndex]);
    this.module.components = snap.components;
    this.module.nets = snap.nets;
    if (this.selectedId && !this.selected) this.selectedId = null;
    if (this.activeNetId && !this.activeNet) this.activeNetId = null;
    this.onSelectionChange?.();
    this.onNetsChange?.();
    this.onChange?.();
  }

  moveSelected(dx: number, dy: number): void {
    const c = this.selected;
    if (!c || c.locked || this.mode !== "edit") return;
    c.x += dx;
    c.y += dy;
    this.commit();
  }

  rotateSelected(deltaDeg: number): void {
    const c = this.selected;
    if (!c || c.locked || this.mode !== "edit") return;
    c.rotation = ((c.rotation + deltaDeg) % 360 + 360) % 360;
    this.commit();
  }

  toggleLockSelected(): void {
    const c = this.selected;
    if (!c || this.mode !== "edit") return;
    c.locked = !c.locked;
    this.commit();
  }

  toggleLayerSelected(): void {
    const c = this.selected;
    if (!c || c.locked || this.mode !== "edit") return;
    c.layer = c.layer === "top" ? "bottom" : "top";
    this.commit();
  }

  deleteSelected(): void {
    const c = this.selected;
    if (!c || c.locked || this.mode !== "edit") return;
    this.module.components = this.module.components.filter((x) => x.id !== c.id);
    this.selectedId = null;
    this.onSelectionChange?.();
    this.commit();
  }

  duplicateSelected(): void {
    const c = this.selected;
    if (!c || this.mode !== "edit") return;
    const copy: Component = JSON.parse(JSON.stringify(c));
    copy.id = this.generateId(c.designator);
    copy.designator = copy.id;
    copy.x += 60;
    copy.y += 60;
    copy.locked = false;
    this.module.components.push(copy);
    this.selectedId = copy.id;
    this.onSelectionChange?.();
    this.commit();
  }

  /** Прозвонка: переключает принадлежность пина активной цепи. */
  togglePinInActiveNet(compId: string, pin: string): void {
    const net = this.activeNet;
    if (!net) return;
    const idx = net.nodes.findIndex((n) => n.comp_id === compId && n.pin === pin);
    if (idx >= 0) {
      net.nodes.splice(idx, 1);
    } else {
      // пин может принадлежать только одной цепи
      for (const other of Object.values(this.module.nets)) {
        other.nodes = other.nodes.filter((n) => !(n.comp_id === compId && n.pin === pin));
      }
      net.nodes.push({ comp_id: compId, pin, desc: "" });
    }
    this.onNetsChange?.();
    this.commit();
  }

  /** Цепь, содержащая данный пин, если есть. */
  netOfPin(compId: string, pin: string): Net | null {
    for (const net of Object.values(this.module.nets)) {
      if (net.nodes.some((n) => n.comp_id === compId && n.pin === pin)) return net;
    }
    return null;
  }

  createNet(name: string): Net {
    let id = `NET_${name.toUpperCase().replace(/[^A-Z0-9А-Я]+/gi, "_")}`;
    while (this.module.nets[id]) id += "_";
    const colors = ["#f97316", "#a78bfa", "#22d3ee", "#facc15", "#fb7185", "#4ade80"];
    const net: Net = {
      id,
      name,
      label: "",
      type: "signal",
      color: colors[Object.keys(this.module.nets).length % colors.length],
      voltage: null,
      description: "",
      nodes: [],
      verified: false,
    };
    this.module.nets[id] = net;
    this.activeNetId = id;
    this.onNetsChange?.();
    this.commit();
    return net;
  }

  deleteNet(id: string): void {
    if (!this.module.nets[id]) return;
    delete this.module.nets[id];
    if (this.activeNetId === id) this.activeNetId = null;
    this.onNetsChange?.();
    this.commit();
  }

  private generateId(base: string): string {
    const prefix = base.replace(/\d+$/, "") || "U";
    let n = 1;
    const ids = new Set(this.module.components.map((c) => c.id));
    while (ids.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }
}
