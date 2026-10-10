"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Icon from "./Icon";

export type ToastKind = "success" | "error" | "info";

type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  show: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const kindStyles: Record<ToastKind, { wrapper: string; icon: "check" | "close" | "bell" }> = {
  success: { wrapper: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", icon: "check" },
  error: { wrapper: "border-red-400/30 bg-red-400/10 text-red-300", icon: "close" },
  info: { wrapper: "border-amber-400/30 bg-amber-400/10 text-amber-300", icon: "bell" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = kindStyles[toast.kind];
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold shadow-[0_0_25px_rgb(0_0_0/0.5)] backdrop-blur-xl ${style.wrapper}`}
            >
              <Icon name={style.icon} className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-5">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
