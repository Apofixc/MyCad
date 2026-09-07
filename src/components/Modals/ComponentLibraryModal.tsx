import React, { useEffect, useState } from "react";
import { X, Database, Search, Cpu, Plus } from "lucide-react";
import { useUiStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { engineClient } from "../../api/engineClient";
import { ComponentItem, LibraryDevice } from "../../types/cad";

export const ComponentLibraryModal: React.FC = () => {
  const { modals, closeModal, cursorMm } = useUiStore();
  const { addComponent, board } = useProjectStore();

  const [query, setQuery] = useState("");
  const [devices, setDevices] = useState<LibraryDevice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modals.library) {
      handleSearch("");
    }
  }, [modals.library]);

  const handleSearch = async (q: string) => {
    setQuery(q);
    setLoading(true);
    try {
      const list = await engineClient.searchLibrary(q);
      setDevices(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!modals.library) return null;

  const handlePlace = (dev: LibraryDevice) => {
    if (!board) return;
    const count = board.data.components.length + 1;

    const newComp: ComponentItem = {
      id: `comp_${dev.prefix.toLowerCase()}_${Date.now()}`,
      refDes: `${dev.prefix}${count}`,
      value: dev.value,
      compType: dev.packageId,
      layer: "top",
      x: cursorMm.x || 40,
      y: cursorMm.y || 30,
      rotation: 0,
      deviceId: dev.id,
      packageId: dev.packageId,
      bodyShape: "rect",
      bodyWidth: 2.0,
      bodyHeight: 1.25,
      pins: [
        { id: "p1", pinNumber: 1, name: "1", relX: -0.9, relY: 0, shape: "rect", width: 0.8, height: 1.0 },
        { id: "p2", pinNumber: 2, name: "2", relX: 0.9, relY: 0, shape: "rect", width: 0.8, height: 1.0 },
      ],
    };

    addComponent(newComp);
    closeModal("library");
  };

  return (
    <div className="cad-modal-backdrop" onClick={() => closeModal("library")}>
      <div className="cad-modal-box" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
        <div className="cad-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Database size={18} color="#10b981" />
            <span>Глобальная база радиодеталей (SQLite FTS5)</span>
          </div>
          <button
            style={{ background: "transparent", border: "none", color: "var(--cad-text-dim)", cursor: "pointer" }}
            onClick={() => closeModal("library")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="cad-modal-body">
          {/* Search Bar */}
          <div style={{ position: "relative" }}>
            <Search size={14} color="var(--cad-text-dim)" style={{ position: "absolute", left: "10px", top: "10px" }} />
            <input
              type="text"
              placeholder="Полнотекстовый поиск FTS5 (например: STM32, AMS1117, 10k, 0805)..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                background: "var(--cad-bg-deep)",
                border: "1px solid var(--cad-border)",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "13px",
              }}
            />
          </div>

          {/* Devices Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "350px", overflowY: "auto" }}>
            {devices.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center", color: "var(--cad-text-dim)" }}>
                {loading ? "Поиск в SQLite FTS5..." : "Компоненты не найдены"}
              </div>
            ) : (
              devices.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "12px",
                    background: "var(--cad-bg-panel)",
                    border: "1px solid var(--cad-border)",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Cpu size={14} color="#60a5fa" />
                        <span style={{ fontWeight: 600, fontSize: "13px", color: "#fff" }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: "10px", fontFamily: "var(--cad-font-mono)", color: "#34d399", background: "rgba(16,185,129,0.1)", padding: "1px 5px", borderRadius: "3px" }}>
                        {d.prefix}
                      </span>
                    </div>

                    {d.description && (
                      <div style={{ fontSize: "11px", color: "var(--cad-text-muted)", marginTop: "4px" }}>
                        {d.description}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: "10px", color: "var(--cad-text-dim)", fontFamily: "var(--cad-font-mono)" }}>
                      Корпус: {d.packageId}
                    </span>
                    <button
                      className="cad-btn cad-btn-primary"
                      style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => handlePlace(d)}
                    >
                      <Plus size={12} /> Разместить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="cad-modal-footer">
          <button type="button" className="cad-btn cad-btn-secondary" onClick={() => closeModal("library")}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
