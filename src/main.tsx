import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/Common/ErrorBoundary";
import { initGlobalErrorHandling } from "./utils/errorHandler";
import "./index.css";

// Инициализация глобального перехвата необработанных ошибок и отклоненных промисов
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

