"use client";

import * as Toast from "@radix-ui/react-toast";
import { useToastStore } from "@/store/toastStore";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          open={!toast.dismissed}
          onOpenChange={(open) => !open && dismiss(toast.id)}
          className="glass rounded-xl p-4 flex items-start gap-3 shadow-2xl border border-white/10 data-[state=open]:animate-slide-in data-[state=closed]:animate-fade-up w-80"
          duration={toast.duration ?? 4000}
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === "success" && <CheckCircle className="w-5 h-5 text-accent-secondary" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 text-brand-danger" />}
            {toast.type === "info" && <Info className="w-5 h-5 text-accent-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            {toast.title && (
              <Toast.Title className="font-semibold text-sm text-text-primary mb-0.5">
                {toast.title}
              </Toast.Title>
            )}
            <Toast.Description className="text-sm text-text-secondary leading-relaxed">
              {toast.message}
            </Toast.Description>
          </div>
          <Toast.Close asChild>
            <button className="flex-shrink-0 btn-ghost p-1">
              <X className="w-4 h-4" />
            </button>
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-[9999] outline-none" />
    </Toast.Provider>
  );
}
