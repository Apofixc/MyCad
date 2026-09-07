import { create } from "zustand";

export type ErrorLevel = "error" | "warning" | "info" | "success";
export type ErrorSource = "tauri" | "render" | "canvas" | "network" | "user" | "unhandled";

export interface AppError {
  id: string;
  level: ErrorLevel;
  source: ErrorSource;
  message: string;
  details?: string;
  timestamp: number;
  toast?: boolean;
  duration?: number; // ms, defaults to 5000 (0 for sticky)
}

interface AddErrorOptions {
  level?: ErrorLevel;
  source?: ErrorSource;
  details?: string;
  toast?: boolean;
  duration?: number;
}

interface ErrorStore {
  errors: AppError[];
  activeToasts: AppError[];
  isLogModalOpen: boolean;

  addError: (error: unknown, options?: AddErrorOptions) => string;
  dismissToast: (id: string) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  openLogModal: () => void;
  closeLogModal: () => void;
}

const MAX_HISTORY_LENGTH = 100;

function formatErrorMessage(err: unknown): { message: string; details?: string } {
  if (!err) {
    return { message: "Неизвестная ошибка" };
  }

  if (typeof err === "string") {
    return { message: err };
  }

  if (err instanceof Error) {
    return {
      message: err.message || "Ошибка выполнения",
      details: err.stack,
    };
  }

  if (typeof err === "object") {
    try {
      const stringified = JSON.stringify(err, null, 2);
      const msg = (err as Record<string, unknown>).message || (err as Record<string, unknown>).error;
      return {
        message: typeof msg === "string" ? msg : "Системное исключение",
        details: stringified !== "{}" ? stringified : String(err),
      };
    } catch {
      return { message: String(err) };
    }
  }

  return { message: String(err) };
}

export const useErrorStore = create<ErrorStore>((set) => ({
  errors: [],
  activeToasts: [],
  isLogModalOpen: false,

  addError: (error, options = {}) => {
    const { message, details: parsedDetails } = formatErrorMessage(error);
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const level: ErrorLevel = options.level ?? "error";
    const source: ErrorSource = options.source ?? "user";
    const showToast = options.toast !== false;
    const duration = options.duration ?? (level === "error" ? 6000 : level === "warning" ? 5000 : 4000);
    const details = options.details || parsedDetails;

    const newError: AppError = {
      id,
      level,
      source,
      message,
      details,
      timestamp: Date.now(),
      toast: showToast,
      duration,
    };

    set((state) => {
      const updatedHistory = [newError, ...state.errors].slice(0, MAX_HISTORY_LENGTH);
      const updatedToasts = showToast ? [...state.activeToasts, newError] : state.activeToasts;
      return {
        errors: updatedHistory,
        activeToasts: updatedToasts,
      };
    });

    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      activeToasts: state.activeToasts.filter((t) => t.id !== id),
    }));
  },

  removeError: (id) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
      activeToasts: state.activeToasts.filter((t) => t.id !== id),
    }));
  },

  clearErrors: () => {
    set({ errors: [], activeToasts: [] });
  },

  openLogModal: () => set({ isLogModalOpen: true }),
  closeLogModal: () => set({ isLogModalOpen: false }),
}));
