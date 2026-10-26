import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deFila, type TipoCambio } from "./modelo";

export const CLAVE_HISTORIAL = ["historial"] as const;

export type FiltrosHistorial = {
  articuloId?: string | null;
  elementoId?: string | null;
  autor?: string | null;
  tipo?: TipoCambio | null;
  texto?: string;
};

const POR_PAGINA = 60;

/** Historial más reciente primero, por páginas («Ver más»). */
export function useHistorial(filtros: FiltrosHistorial, porPagina = POR_PAGINA) {
  return useInfiniteQuery({
    queryKey: [...CLAVE_HISTORIAL, filtros, porPagina],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("historial")
        .select("*")
        .order("fecha", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + porPagina - 1);
      if (filtros.articuloId) q = q.eq("articulo_id", filtros.articuloId);
      if (filtros.elementoId) q = q.eq("elemento_id", filtros.elementoId);
      if (filtros.autor != null) q = q.eq("autor", filtros.autor);
      if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
      const texto = filtros.texto?.trim().replace(/[,()*%]/g, " ");
      if (texto) {
        const patron = `*${texto}*`;
        q = q.or(`articulo_nombre.ilike.${patron},elemento_nombre.ilike.${patron},detalle.ilike.${patron},autor.ilike.${patron}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data.map(deFila);
    },
    getNextPageParam: (ultima, paginas) => (ultima.length < porPagina ? undefined : paginas.length * porPagina),
    staleTime: 10_000,
  });
}

/** Nombres de quien ha hecho cambios, para el filtro de personas. */
export function useAutores() {
  return useQuery({
    queryKey: [...CLAVE_HISTORIAL, "autores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("historial").select("autor").order("fecha", { ascending: false }).limit(1000);
      if (error) throw error;
      return [...new Set(data.map((f) => f.autor))].sort((a, b) => a.localeCompare(b, "es"));
    },
    staleTime: 60_000,
  });
}
