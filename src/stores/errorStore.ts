import { create } from "zustand";

export interface ErrorAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface CurrentError {
  title?: string;
  message: string;
  details?: string; // Полный текст ошибки / стек / сырой ответ
  suggestion?: string; // Что сделать
  action?: ErrorAction; // Предлагаемое действие
}

interface ErrorStore {
  currentError: CurrentError | null;
  showError: (error: CurrentError | string, action?: ErrorAction) => void;
  clearError: () => void;
}

export const useErrorStore = create<ErrorStore>((set) => ({
  currentError: null,

  showError: (error, action) => {
    if (typeof error === "string") {
      set({
        currentError: {
          message: error,
          action,
        },
      });
    } else {
      set({
        currentError: {
          ...error,
          action: action || error.action,
        },
      });
    }
  },

  clearError: () => set({ currentError: null }),
}));
