import { useSyncExternalStore } from "react";

// Instalar la web como una app (icono en la pantalla de inicio, sin barra del
// navegador). Chrome y Edge avisan con «beforeinstallprompt»; en iPhone no hay
// aviso y se hace desde el botón Compartir de Safari.

type AvisoInstalacion = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let aviso: AvisoInstalacion | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    aviso = null;
    avisar();
  });
}

export const yaInstalada = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const esIPhone = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstalacion() {
  const disponible = useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    },
    () => aviso !== null,
  );
  return {
    /** Se puede ofrecer instalar (Chrome/Edge, o instrucciones en iPhone). */
    puede: !yaInstalada() && (disponible || esIPhone()),
    /** Abre el aviso del navegador; en iPhone devuelve false (hay que explicar los pasos). */
    instalar: async () => {
      if (!aviso) return false;
      await aviso.prompt();
      await aviso.userChoice;
      aviso = null;
      avisar();
      return true;
    },
  };
}
