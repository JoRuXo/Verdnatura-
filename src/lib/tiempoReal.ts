import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Cambios en tiempo real: cuando alguien toca algo desde otro móvil u
// ordenador, Supabase avisa y se vuelven a leer los datos afectados.

/** Tabla de la base de datos → datos de la app que hay que releer. */
const RELEER: Record<string, string[]> = {
  articulos: ["articulos"],
  existencias: ["articulos"],
  elementos_mapa: ["elementos_mapa"],
  historial: ["historial"],
};

type Conexion = "conectando" | "conectado" | "sin-conexion";
let conexion: Conexion = "conectando";
const oyentes = new Set<() => void>();
const ponerConexion = (c: Conexion) => {
  conexion = c;
  oyentes.forEach((f) => f());
};

/** Si los cambios de los demás están llegando al momento. */
export function useConexionTiempoReal() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    },
    () => conexion,
  );
}

export function useTiempoReal() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pendientes = new Set<string>();
    let espera: number | undefined;
    // Una ráfaga de cambios (p. ej. guardar el mapa) se junta en una sola lectura
    const releer = (tabla: string) => {
      RELEER[tabla]?.forEach((c) => pendientes.add(c));
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        pendientes.forEach((c) => void queryClient.invalidateQueries({ queryKey: [c] }));
        pendientes.clear();
      }, 300);
    };

    let canal = supabase.channel("cambios-verdnatura");
    for (const tabla of Object.keys(RELEER)) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => releer(tabla));
    }
    canal.subscribe((estado) => {
      if (estado === "SUBSCRIBED") {
        // Al volver la conexión puede haberse perdido algún aviso: se relee todo
        if (conexion === "sin-conexion") Object.keys(RELEER).forEach(releer);
        ponerConexion("conectado");
      } else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
        ponerConexion("sin-conexion");
      }
    });

    return () => {
      window.clearTimeout(espera);
      void supabase.removeChannel(canal);
    };
  }, [queryClient]);
}
