import { create } from "zustand";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  title?: string;
  message: string;
  duration?: number;
  dismissed: boolean;
}

interface ToastStore {
  toasts: ToastItem[];
  toast: (item: Omit<ToastItem, "id" | "dismissed">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  toast: (item) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { ...item, id, dismissed: false }],
    }));
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, dismissed: true } : t)),
    }));
    // Clean up after animation
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 500);
  },
}));

// Convenience helpers
export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().toast({ type: "success", message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().toast({ type: "error", message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().toast({ type: "info", message, title }),
};
