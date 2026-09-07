import { useErrorStore, ErrorAction } from "../stores/errorStore";

let isInitialized = false;

/**
 * Инициализация глобального перехвата необработанных ошибок
 */
export function initGlobalErrorHandling(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    if (!event.error && !event.message) return;
    const details = event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`;
    useErrorStore.getState().showError({
      message: event.message || "Непредвиденная ошибка скрипта",
      details,
      suggestion: "Перезагрузите страницу или повторите последнее действие.",
    });
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    let message = "Сбой асинхронной операции (Promise)";
    let details: string | undefined;

    if (event.reason instanceof Error) {
      message = event.reason.message || message;
      details = event.reason.stack;
    } else if (event.reason) {
      try {
        details = JSON.stringify(event.reason, null, 2);
      } catch {
        details = String(event.reason);
      }
    }

    useErrorStore.getState().showError({
      message,
      details,
      suggestion: "Проверьте правильность переданных данных или повторите попытку.",
    });
  });
}

/**
 * Отображение ошибки с пояснением, полным текстом и предлагаемым действием
 */
export function showError(
  err: unknown,
  suggestion?: string,
  action?: ErrorAction
): void {
  let message = "";
  let details: string | undefined;

  if (err instanceof Error) {
    message = err.message || "Ошибка выполнения";
    details = err.stack;
  } else if (typeof err === "string") {
    message = err;
    if (err.includes("\n") || err.length > 80) {
      details = err;
    }
  } else if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    message = (obj.message as string) || (obj.error as string) || "Системное исключение";
    try {
      details = JSON.stringify(err, null, 2);
    } catch {
      details = String(err);
    }
  } else {
    message = String(err || "Произошла непредвиденная ошибка");
  }

  useErrorStore.getState().showError({
    message,
    details,
    suggestion,
    action,
  });
}

/**
 * Функция логирования/вывода ошибки для совместимости
 */
export function reportError(
  err: unknown,
  context?: string,
  _options?: { source?: string; toast?: boolean; duration?: number }
): void {
  let message = "";
  let details: string | undefined;

  if (err instanceof Error) {
    message = err.message;
    details = err.stack;
  } else if (typeof err === "string") {
    message = err;
    if (err.includes("\n") || err.length > 80) {
      details = err;
    }
  } else if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    message = (obj.message as string) || (obj.error as string) || "Ошибка выполнения";
    try {
      details = JSON.stringify(err, null, 2);
    } catch {
      details = String(err);
    }
  } else {
    message = String(err || "Произошла ошибка");
  }

  const fullMessage = context ? `${context}: ${message}` : message;

  // Предлагаем понятное действие в зависимости от контекста
  let suggestion = "Попробуйте повторить операцию.";
  if (context?.toLowerCase().includes("сохран")) {
    suggestion = "Проверьте права доступа к файлу и наличие свободного места на диске.";
  } else if (context?.toLowerCase().includes("открыт") || context?.toLowerCase().includes("проект")) {
    suggestion = "Убедитесь, что файл существует, не поврежден и путь к нему доступен.";
  } else if (context?.toLowerCase().includes("импорт") || context?.toLowerCase().includes("изображен")) {
    suggestion = "Проверьте формат файла (поддерживаются PNG, JPG, BMP) и его целостность.";
  }

  useErrorStore.getState().showError({
    message: fullMessage,
    details,
    suggestion,
  });
}

/**
 * Заглушка уведомления об успехе
 */
export function notifySuccess(_message: string): void {
  // Ничего лишнего
}
