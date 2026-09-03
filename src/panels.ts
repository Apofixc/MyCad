import type { Editor } from "./editor";
import type { BoardViewport } from "./viewport";

/** Левая панель: список компонентов с поиском. */
export class ComponentListPanel {
  private list = document.getElementById("compList") as HTMLUListElement;
  private search = document.getElementById("compSearch") as HTMLInputElement;

  constructor(
    private editor: Editor,
    private viewport: BoardViewport,
  ) {
    this.search.addEventListener("input", () => this.render());
    this.render();
  }

  render(): void {
    const q = this.search.value.trim().toLowerCase();
    this.list.innerHTML = "";
    for (const c of this.editor.module.components) {
      if (
        q &&
        !c.designator.toLowerCase().includes(q) &&
        !c.value.toLowerCase().includes(q) &&
        !c.footprint.toLowerCase().includes(q)
      ) {
        continue;
      }
      const li = document.createElement("li");
      li.textContent = `${c.designator} — ${c.value}`;
      li.title = c.footprint;
      if (c.id === this.editor.selectedId) li.classList.add("selected");
      li.addEventListener("click", () => {
        this.editor.select(c.id);
        this.viewport.panToComponent(c);
      });
      this.list.appendChild(li);
    }
  }

  scrollToSelected(): void {
    const li = this.list.querySelector("li.selected");
    li?.scrollIntoView({ block: "nearest" });
  }
}

/** Список цепей с поиском, созданием и подсветкой активной цепи. */
export class NetsPanel {
  private list = document.getElementById("netList") as HTMLUListElement;
  private search = document.getElementById("netSearch") as HTMLInputElement;

  constructor(
    private editor: Editor,
    private viewport: BoardViewport,
  ) {
    this.search.addEventListener("input", () => this.render());
    document.getElementById("btnNewNet")!.addEventListener("click", () => {
      const name = window.prompt("Имя новой цепи:", "");
      if (!name?.trim()) return;
      this.editor.createNet(name.trim());
      this.viewport.invalidate();
    });
    this.render();
  }

  render(): void {
    const q = this.search.value.trim().toLowerCase();
    this.list.innerHTML = "";
    const nets = Object.values(this.editor.module.nets).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const n of nets) {
      if (q && !n.name.toLowerCase().includes(q) && !n.label.toLowerCase().includes(q)) continue;
      const li = document.createElement("li");
      const chip = document.createElement("span");
      chip.className = "net-chip";
      chip.style.background = n.color || "#94a3b8";
      li.appendChild(chip);
      li.appendChild(document.createTextNode(` ${n.name} (${n.nodes.length})`));
      li.title = n.label || n.description;
      if (n.id === this.editor.activeNetId) li.classList.add("selected");
      li.addEventListener("click", () => {
        this.editor.setActiveNet(n.id === this.editor.activeNetId ? null : n.id);
        this.viewport.invalidate();
      });
      this.list.appendChild(li);
    }
  }
}

/** Правая панель: инспектор свойств выбранного компонента. */
export class InspectorPanel {
  private empty = document.getElementById("inspector") as HTMLElement;
  private form = document.getElementById("inspectorForm") as HTMLElement;
  private updating = false;

  constructor(
    private editor: Editor,
    private viewport: BoardViewport,
  ) {
    this.bind("inspDesignator", (c, v) => (c.designator = v));
    this.bind("inspValue", (c, v) => (c.value = v));
    this.bindNum("inspX", (c, v) => (c.x = v));
    this.bindNum("inspY", (c, v) => (c.y = v));
    this.bindNum("inspW", (c, v) => (c.width = Math.max(v, 1)));
    this.bindNum("inspH", (c, v) => (c.height = Math.max(v, 1)));
    this.bindNum("inspRotation", (c, v) => (c.rotation = ((v % 360) + 360) % 360));
    this.bind("inspNotes", (c, v) => (c.notes = v));

    const layer = document.getElementById("inspLayer") as HTMLSelectElement;
    layer.addEventListener("change", () => {
      const c = this.editor.selected;
      if (!c || this.updating) return;
      c.layer = layer.value === "bottom" ? "bottom" : "top";
      this.editor.commit();
      this.viewport.invalidate();
    });

    const locked = document.getElementById("inspLocked") as HTMLInputElement;
    locked.addEventListener("change", () => {
      const c = this.editor.selected;
      if (!c || this.updating) return;
      c.locked = locked.checked;
      this.editor.commit();
      this.viewport.invalidate();
    });

    const showDes = document.getElementById("inspShowDesignator") as HTMLInputElement;
    showDes.addEventListener("change", () => {
      const c = this.editor.selected;
      if (!c || this.updating) return;
      c.show_designator = showDes.checked;
      this.editor.commit();
      this.viewport.invalidate();
    });

    document.getElementById("btnDuplicate")!.addEventListener("click", () => {
      this.editor.duplicateSelected();
      this.viewport.invalidate();
    });
    document.getElementById("btnDelete")!.addEventListener("click", () => {
      this.editor.deleteSelected();
      this.viewport.invalidate();
    });

    this.render();
  }

  private bind(id: string, apply: (c: NonNullable<Editor["selected"]>, v: string) => void): void {
    const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
    input.addEventListener("change", () => {
      const c = this.editor.selected;
      if (!c || this.updating) return;
      apply(c, input.value);
      this.editor.commit();
      this.viewport.invalidate();
    });
  }

  private bindNum(id: string, apply: (c: NonNullable<Editor["selected"]>, v: number) => void): void {
    this.bind(id, (c, v) => {
      const n = Number(v);
      if (!Number.isNaN(n)) apply(c, n);
    });
  }

  render(): void {
    const c = this.editor.selected;
    if (!c) {
      this.empty.hidden = false;
      this.form.hidden = true;
      return;
    }
    this.empty.hidden = true;
    this.form.hidden = false;
    this.updating = true;
    (document.getElementById("inspDesignator") as HTMLInputElement).value = c.designator;
    (document.getElementById("inspValue") as HTMLInputElement).value = c.value;
    (document.getElementById("inspFootprint") as HTMLInputElement).value = c.footprint;
    (document.getElementById("inspX") as HTMLInputElement).value = String(Math.round(c.x));
    (document.getElementById("inspY") as HTMLInputElement).value = String(Math.round(c.y));
    (document.getElementById("inspW") as HTMLInputElement).value = String(Math.round(c.width));
    (document.getElementById("inspH") as HTMLInputElement).value = String(Math.round(c.height));
    (document.getElementById("inspRotation") as HTMLInputElement).value = String(c.rotation);
    (document.getElementById("inspLayer") as HTMLSelectElement).value = c.layer;
    (document.getElementById("inspLocked") as HTMLInputElement).checked = c.locked;
    (document.getElementById("inspShowDesignator") as HTMLInputElement).checked =
      c.show_designator;
    (document.getElementById("inspNotes") as HTMLTextAreaElement).value = c.notes;
    this.updating = false;
  }
}
