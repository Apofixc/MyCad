import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/Common/ErrorBoundary";
import { initGlobalErrorHandling } from "./utils/errorHandler";
import "./index.css";

if (import.meta.env.DEV) {
  import("./stores/projectStore").then((m) => {
    (window as any).__projectStore = m.useProjectStore;
  });
  import("./stores/uiStore").then((m) => {
    (window as any).__uiStore = m.useUiStore;
  });
  import("./utils/alignmentMath").then((m) => {
    (window as any).__alignmentMath = m;
  });
}

initGlobalErrorHandling();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackTitle="Критический сбой приложения MyCad"
      fallbackMessage="Произошла критическая ошибка в основном цикле приложения. Вы можете попробовать восстановить состояние или перезапустить MyCad."
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

