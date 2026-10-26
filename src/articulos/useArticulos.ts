import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprimirImagen } from "./imagen";
import { BUCKET_FOTOS, deFila, type Articulo } from "./modelo";

export const CLAVE_ARTICULOS = ["articulos"] as const;

/** Todos los artículos con sus existencias, por nombre. */
export function useArticulos() {
  return useQuery({
    queryKey: CLAVE_ARTICULOS,
    queryFn: async () => {
      const { data, error } = await supabase.from("articulos").select("*, existencias(*)").order("nombre");
      if (error) throw error;
      return data.map(deFila);
    },
    staleTime: 15_000,
  });
}

/**
 * Guarda el artículo y deja sus existencias exactamente como en `a`
 * (borra las que se han quitado). Borra del almacén las fotos que ya no usa.
 */
export async function guardarArticulo(a: Articulo, antes: Articulo | null) {
  const { error } = await supabase.from("articulos").upsert({
    id: a.id,
    nombre: a.nombre.trim(),
    categoria: a.categoria.trim(),
    descripcion: a.descripcion,
    unidad: a.unidad.trim() || "unidades",
    caracteristicas: a.caracteristicas.filter((c) => c.nombre.trim() || c.valor.trim()),
    fotos: a.fotos,
  });
  if (error) throw error;

  const quitadas = (antes?.existencias ?? []).filter((e) => !a.existencias.some((n) => n.id === e.id)).map((e) => e.id);
  if (quitadas.length) {
    const { error: e } = await supabase.from("existencias").delete().in("id", quitadas);
    if (e) throw e;
  }
  if (a.existencias.length) {
    const { error: e } = await supabase.from("existencias").upsert(
      a.existencias.map((x) => ({
        id: x.id,
        articulo_id: a.id,
        elemento_id: x.elementoId,
        cantidad: Math.max(0, Math.round(x.cantidad) || 0),
        nota: x.nota,
      })),
    );
    if (e) throw e;
  }

  const fotosQuitadas = (antes?.fotos ?? []).filter((f) => !a.fotos.includes(f));
  if (fotosQuitadas.length) await borrarFotos(fotosQuitadas);
}

/** Borra el artículo (sus existencias se van con él) y sus fotos. */
export async function borrarArticulo(a: Articulo) {
  const { error } = await supabase.from("articulos").delete().eq("id", a.id);
  if (error) throw error;
  if (a.fotos.length) await borrarFotos(a.fotos);
}

/** Comprime y sube una foto a la carpeta del artículo. Devuelve su ruta. */
export async function subirFoto(articuloId: string, archivo: File) {
  const datos = await comprimirImagen(archivo);
  const extension = datos.type === "image/png" ? "png" : datos.type === "image/webp" ? "webp" : "jpg";
  const ruta = `${articuloId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, datos, {
    contentType: datos.type || "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return ruta;
}

/** Borrar fotos es limpieza: si falla, no debe impedir guardar. */
export async function borrarFotos(rutas: string[]) {
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove(rutas);
  if (error) console.warn("No se han podido borrar fotos antiguas", error.message);
}
