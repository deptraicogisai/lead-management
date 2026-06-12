export type ToastVariant = "success" | "error";

export type ToastInput = {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

export type ToastRecord = ToastInput & {
  id: string;
  variant: ToastVariant;
};

type ToastListener = (toast: ToastRecord) => void;

const listeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitToast(input: ToastInput) {
  const toast: ToastRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: input.title,
    message: input.message,
    variant: input.variant ?? "success",
    durationMs: input.durationMs ?? 4000,
  };

  listeners.forEach((listener) => listener(toast));
  return toast.id;
}

export const toast = {
  show(input: ToastInput) {
    return emitToast(input);
  },
  success(message: string, title = "Success") {
    return emitToast({ title, message, variant: "success" });
  },
  error(message: string, title = "Error") {
    return emitToast({ title, message, variant: "error" });
  },
};
