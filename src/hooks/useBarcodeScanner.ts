import { useEffect, useRef, useState, type RefObject } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * Runs the camera barcode scanner inside `target` while `active` is true.
 *
 * The camera is also released while the page is hidden (phone locked, app switched), so the
 * phone's "camera in use" indicator does not stay on in the background; it comes back when the
 * page is visible again.
 *
 * The latest `onDetected` is always the one called (no stale data from when the camera started),
 * and the exact handler that was added is the one removed when the scanner stops, so handlers do
 * not pile up each time the camera is opened.
 */
export function useBarcodeScanner(
  active: boolean,
  target: RefObject<HTMLElement | null>,
  onDetected: (code: string) => void,
  onError?: (error: unknown) => void
) {
  const detectedRef = useRef(onDetected);
  const errorRef = useRef(onError);
  detectedRef.current = onDetected;
  errorRef.current = onError;

  const visible = usePageVisible();
  const running = active && visible;

  useEffect(() => {
    if (!running || !target.current) return;
    let started = false;
    let cancelled = false;

    const handler = (result: { codeResult?: { code?: string | null } }) => {
      const code = result?.codeResult?.code;
      if (code) detectedRef.current(code);
    };

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: target.current,
          constraints: { facingMode: "environment" },
        },
        decoder: { readers: ["code_128_reader", "ean_reader", "upc_reader"] },
      },
      (err) => {
        if (cancelled) return;
        if (err) {
          console.error("Quagga init error:", err);
          errorRef.current?.(err);
          return;
        }
        Quagga.start();
        started = true;
      }
    );
    Quagga.onDetected(handler as any);

    return () => {
      cancelled = true;
      Quagga.offDetected(handler as any);
      if (started) Quagga.stop();
    };
  }, [running, target]);
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}
