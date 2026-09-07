import { useErrorStore, AppError, ErrorLevel, ErrorSource } from "../stores/errorStore";

let isGlobalHandlingInitialized = false;

/**
 * Инициализация глобальных перехватчиков window.onerror и window.onunhandledrejection.
 * Защищает от скрытых сбоев и предотвращает "белый экран".
 */
export function initGlobalErrorHandling(): void {
  if (isGlobalHandlingInitialized || typeof window === "undefined") {
    return;
  }
  isGlobalHandlingInitialized = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    // Игнорируем ошибки загрузки ресурсов (скриптов/стилей), если нет ошибки в event.error
    if (!event.error && !event.message) return;

    const message = event.message || "Глобальная ошибка скрипта";
    const details = event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`;

    useErrorStore.getState().addError(
      {
        message,
        details,
      },
      {
        level: "error",
        source: "unhandled",
        toast: true,
      }
    );
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    let reasonMessage = "Необработанное отклонение Promise";
    let details: string | undefined;

    if (event.reason instanceof Error) {
      reasonMessage = event.reason.message || reasonMessage;
      details = event.reason.stack;
    } else if (typeof event.reason === "string") {
      reasonMessage = event.reason;
    } else if (event.reason) {
      try {
        details = JSON.stringify(event.reason, null, 2);
      } catch {
        details = String(event.reason);
      }
    }

    useErrorStore.getState().addError(
      {
        message: reasonMessage,
        details,
      },
      {
        level: "error",
        source: "unhandled",
        toast: true,
      }
    );
  });
}

/**
 * Централизованная отправка ошибки в систему логирования и уведомлений.
 */
export function reportError(
  err: unknown,
  context?: string,
  options?: {
    level?: ErrorLevel;
    source?: ErrorSource;
    toast?: boolean;
    duration?: number;
  }
): string {
  const store = useErrorStore.getState();
  let message = "";
  let details: string | undefined;

  if (err instanceof Error) {
    message = err.message;
    details = err.stack;
  } else if (typeof err === "string") {
    message = err;
  } else if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    message = (obj.message as string) || (obj.error as string) || "Ошибка выполнения операции";
    try {
      details = JSON.stringify(err, null, 2);
    } catch {
      details = String(err);
    }
  } else {
    message = String(err || "Произошла неизвестная ошибка");
  }

  if (context) {
    message = `${context}: ${message}`;
  }

  return store.addError(
    { message, details },
    {
      level: options?.level ?? "error",
      source: options?.source ?? "user",
      toast: options?.toast ?? true,
      duration: options?.duration,
    }
  );
}

/**
 * Всплывающее информационное уведомление об успехе.
 */
export function notifySuccess(message: string, details?: string, duration = 3500): string {
  return useErrorStore.getState().addError(
    { message, details },
    {
      level: "success",
      source: "user",
      toast: true,
      duration,
    }
  );
}

/**
 * Всплывающее предупреждение.
 */
export function notifyWarning(message: string, details?: string, duration = 4500): string {
  return useErrorStore.getState().addError(
    { message, details },
    {
      level: "warning",
      source: "user",
      toast: true,
      duration,
    }
  );
}

/**
 * Информационное уведомление.
 */
export function notifyInfo(message: string, details?: string, duration = 4000): string {
  return useErrorStore.getState().addError(
    { message, details },
    {
      level: "info",
      source: "user",
      toast: true,
      duration,
    }
  );
}

/**
 * Безопасное выполнение асинхронного блока кода с автоматическим логированием ошибок.
 */
export async function withErrorHandler<T>(
  action: () => Promise<T>,
  fallbackMessage = "Операция завершилась с ошибкой",
  options?: {
    source?: ErrorSource;
    rethrow?: boolean;
    level?: ErrorLevel;
  }
): Promise<T | null> {
  try {
    return await action();
  } catch (err) {
    reportError(err, fallbackMessage, {
      source: options?.source,
      level: options?.level,
    });
    if (options?.rethrow) {
      throw err;
    }
    return null;
  }
}

/**
 * Формирование форматированного диагностического отчета обо всех ошибках сессии.
 */
export function generateDiagnosticReport(errors: AppError[]): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const now = new Date().toISOString();
  const title = `=== MyCad Frontend Diagnostic Report ===\nGenerated at: ${now}\nUser Agent: ${ua}\nTotal logged events: ${errors.length}\n`;

  if (errors.length === 0) {
    return `${title}\nNo errors recorded in this session.`;
  }

  const items = errors.map((e, index) => {
    const time = new Date(e.timestamp).toLocaleTimeString();
    let text = `[${index + 1}] [${time}] [${e.level.toUpperCase()}] [Source: ${e.source}]\nMessage: ${e.message}`;
    if (e.details) {
      text += `\nDetails / Stack:\n${e.details}`;
    }
    return text;
  });

  return `${title}\n` + items.join("\n\n----------------------------------------\n\n");
}
