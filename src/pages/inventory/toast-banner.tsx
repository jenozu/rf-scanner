import type { ToastState } from "./types";

/** The short message shown at the top of the counting screens. */
export function ToastBanner({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  const tone =
    toast.type === "success" ? "bg-green-500 text-white" : toast.type === "error" ? "bg-red-500 text-white" : "bg-blue-500 text-white";
  return (
    <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg ${tone}`}>
      {toast.message}
    </div>
  );
}
