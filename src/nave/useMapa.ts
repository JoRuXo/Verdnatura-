import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
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

/** Lo que se cambia de una zona desde su ventana, sin entrar a editar el mapa. */
export type CambiosZona = Partial<Pick<Elemento, "nombre" | "descripcion" | "baldas">>;

const COLUMNA: Record<keyof CambiosZona, "nombre" | "descripcion" | "baldas"> = {
  nombre: "nombre",
  descripcion: "descripcion",
  baldas: "baldas",
};

/**
 * Guarda unos pocos datos de una zona, pero solo si siguen como se veían
 * (`antes`). Devuelve false si alguien los ha cambiado entretanto: no se guarda nada.
 */
export async function guardarZona(antes: Elemento, cambios: CambiosZona) {
  const campos = (Object.keys(cambios) as (keyof CambiosZona)[]).filter((c) => cambios[c] !== antes[c]);
  if (!campos.length) return true;
  const fila: TablesUpdate<"elementos_mapa"> = {};
  if (campos.includes("nombre")) fila.nombre = cambios.nombre;
  if (campos.includes("descripcion")) fila.descripcion = cambios.descripcion;
  if (campos.includes("baldas")) fila.baldas = cambios.baldas;
  let consulta = supabase.from("elementos_mapa").update(fila).eq("id", antes.id);
  for (const c of campos) {
    const valor = antes[c];
    consulta = valor == null ? consulta.is(COLUMNA[c], null) : consulta.eq(COLUMNA[c], valor);
  }
  const { data, error } = await consulta.select("id");
  if (error) throw error;
  return data.length > 0;
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
