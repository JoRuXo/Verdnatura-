import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aFila, deFila, ELEMENTOS_DE_SERIE, type Elemento } from "./elementos";

export const CLAVE_MAPA = ["elementos_mapa"] as const;

export type EstadoMapa = {
  elementos: Elemento[];
  /** Viene de Supabase: se puede editar y guardar. */
  guardable: boolean;
  cargando: boolean;
  error: string | null;
  /** Vuelve a leer de Supabase y devuelve lo guardado. */
  recargar: () => Promise<Elemento[] | undefined>;
};

/** Elementos del mapa guardados. Si Supabase falla, se ve el mapa de serie (sin poder guardar). */
export function useMapa(): EstadoMapa {
  const q = useQuery({
    queryKey: CLAVE_MAPA,
    queryFn: async () => {
      const { data, error } = await supabase.from("elementos_mapa").select("*").order("orden");
      if (error) throw error;
      return data.map(deFila);
    },
    staleTime: 30_000,
    retry: 1,
  });
  const recargar = async () => (await q.refetch()).data;
  if (q.data) return { elementos: q.data, guardable: true, cargando: false, error: null, recargar };
  return {
    elementos: ELEMENTOS_DE_SERIE,
    guardable: false,
    cargando: q.isLoading,
    error: q.error ? (q.error as Error).message : null,
    recargar,
  };
}

const igual = (a: Elemento, b: Elemento) => JSON.stringify(a) === JSON.stringify(b);

/** Cambios del borrador frente a lo guardado. */
export function diferencias(guardados: Elemento[], borrador: Elemento[]) {
  const porId = new Map(guardados.map((e) => [e.id, e]));
  const idsBorrador = new Set(borrador.map((e) => e.id));
  const cambiados = borrador
    .map((e, orden) => ({ ...e, orden }))
    .filter((e) => {
      const antes = porId.get(e.id);
      return !antes || !igual(antes, e);
    });
  const borrados = guardados.filter((e) => !idsBorrador.has(e.id)).map((e) => e.id);
  return { cambiados, borrados, total: cambiados.length + borrados.length };
}

/** Guarda en Supabase solo lo que ha cambiado. */
export async function guardarMapa(guardados: Elemento[], borrador: Elemento[]) {
  const { cambiados, borrados } = diferencias(guardados, borrador);
  if (borrados.length) {
    const { error } = await supabase.from("elementos_mapa").delete().in("id", borrados);
    if (error) throw error;
  }
  if (cambiados.length) {
    const { error } = await supabase.from("elementos_mapa").upsert(cambiados.map((e) => aFila(e, e.orden)));
    if (error) throw error;
  }
}
