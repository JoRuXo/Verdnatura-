import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { comprimirImagen } from "./imagen";
import { BUCKET_FOTOS, deFila, firmarFotos, type Articulo, type Existencia } from "./modelo";

export const CLAVE_ARTICULOS = ["articulos"] as const;

/** Los enlaces de las fotos se piden antes de pintar; si falla, se ven los artículos sin foto. */
const conFotos = async (lista: Articulo[]) => {
  await firmarFotos(lista.flatMap((a) => a.fotos)).catch((e) => console.warn("No se han podido pedir las fotos", e));
  return lista;
};

const leerArticulos = async () => {
  const { data, error } = await supabase.from("articulos").select("*, existencias(*)").order("nombre");
  if (error) throw error;
  return conFotos(data.map(deFila));
};

/** Todos los artículos con sus existencias, por nombre. */
export function useArticulos() {
  return useQuery({ queryKey: CLAVE_ARTICULOS, queryFn: leerArticulos, staleTime: 15_000 });
}

/** Lo que hay ahora mismo en la base de datos de un artículo (null si ya no existe). */
export async function leerArticulo(id: string) {
  const { data, error } = await supabase.from("articulos").select("*, existencias(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? (await conFotos([deFila(data)]))[0] : null;
}

/** Alguien ha cambiado lo mismo mientras se editaba: no se guarda nada. */
export class ConflictoError extends Error {
  readonly detalles: string[];
  constructor(detalles: string[]) {
    super("Otra persona ha cambiado este artículo mientras lo editabas");
    this.detalles = detalles;
  }
}

const filaArticulo = (a: Articulo) => ({
  nombre: a.nombre.trim(),
  categoria: a.categoria.trim(),
  descripcion: a.descripcion,
  unidad: a.unidad.trim() || "unidades",
  caracteristicas: a.caracteristicas.filter((c) => c.nombre.trim() || c.valor.trim()),
  fotos: a.fotos,
  stock_minimo: a.stockMinimo,
  aspecto: a.aspecto,
});

type CampoArticulo = keyof ReturnType<typeof filaArticulo>;

const NOMBRE_CAMPO: Record<CampoArticulo, string> = {
  nombre: "el nombre",
  categoria: "la categoría",
  descripcion: "la descripción",
  unidad: "en qué se cuenta",
  caracteristicas: "las características",
  fotos: "las fotos",
  stock_minimo: "el stock mínimo",
  aspecto: "cómo se ve en el mapa",
};

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const mismaExistencia = (a: Existencia, b: Existencia) =>
  a.elementoId === b.elementoId && a.cantidad === b.cantidad && a.nota === b.nota;

/**
 * Guarda solo lo que se ha cambiado en la ficha respecto a como estaba al abrirla
 * (`antes`; null si es nuevo). Si mientras tanto otra persona ha cambiado eso
 * mismo, no guarda nada y lanza ConflictoError; lo que haya cambiado en otras
 * cosas se respeta.
 */
export async function guardarArticulo(a: Articulo, antes: Articulo | null, nombreZona: (id: string | null) => string) {
  const nuevo = filaArticulo(a);

  if (!antes) {
    const { error } = await supabase.from("articulos").insert({ id: a.id, ...nuevo });
    if (error) throw error;
    if (a.existencias.length) {
      const { error: e } = await supabase.from("existencias").insert(
        a.existencias.map((x) => ({ id: x.id, articulo_id: a.id, elemento_id: x.elementoId, cantidad: x.cantidad, nota: x.nota })),
      );
      if (e) throw e;
    }
    return;
  }

  const ahora = await leerArticulo(a.id);
  if (!ahora) throw new ConflictoError(["Otra persona ha borrado este artículo."]);

  const previo = filaArticulo(antes);
  const enBase = filaArticulo(ahora);
  const conflictos: string[] = [];
  const cambios: TablesUpdate<"articulos"> = {};
  for (const campo of Object.keys(nuevo) as CampoArticulo[]) {
    if (igual(nuevo[campo], previo[campo])) continue;
    if (!igual(enBase[campo], previo[campo]) && !igual(enBase[campo], nuevo[campo])) {
      conflictos.push(`Ha cambiado ${NOMBRE_CAMPO[campo]}.`);
    }
    (cambios as Record<string, unknown>)[campo] = nuevo[campo];
  }

  const previas = new Map(antes.existencias.map((e) => [e.id, e]));
  const actuales = new Map(ahora.existencias.map((e) => [e.id, e]));
  const nuevas: Existencia[] = [];
  const cambiadas: Existencia[] = [];
  for (const x of a.existencias) {
    const p = previas.get(x.id);
    if (!p) {
      const otra = ahora.existencias.find((e) => e.elementoId === x.elementoId && !previas.has(e.id));
      if (otra) conflictos.push(`Ya lo han puesto en ${nombreZona(x.elementoId)} (${otra.cantidad}).`);
      nuevas.push(x);
      continue;
    }
    if (mismaExistencia(x, p)) continue;
    const b = actuales.get(x.id);
    if (!b) conflictos.push(`Han quitado la fila de ${nombreZona(p.elementoId)}.`);
    else if (!mismaExistencia(b, p) && !mismaExistencia(b, x)) {
      conflictos.push(`En ${nombreZona(b.elementoId)} ahora hay ${b.cantidad} (tenías ${p.cantidad}).`);
    }
    cambiadas.push(x);
  }
  const quitadas = antes.existencias.filter((e) => !a.existencias.some((n) => n.id === e.id)).map((e) => e.id);

  if (conflictos.length) throw new ConflictoError(conflictos);

  if (Object.keys(cambios).length) {
    const { error } = await supabase.from("articulos").update(cambios).eq("id", a.id);
    if (error) throw error;
  }
  if (quitadas.length) {
    const { error } = await supabase.from("existencias").delete().in("id", quitadas);
    if (error) throw error;
  }
  for (const x of cambiadas) {
    const { error } = await supabase
      .from("existencias")
      .update({ elemento_id: x.elementoId, cantidad: x.cantidad, nota: x.nota })
      .eq("id", x.id);
    if (error) throw error;
  }
  if (nuevas.length) {
    const { error } = await supabase.from("existencias").insert(
      nuevas.map((x) => ({ id: x.id, articulo_id: a.id, elemento_id: x.elementoId, cantidad: x.cantidad, nota: x.nota })),
    );
    if (error) throw error;
  }

  if ("fotos" in cambios) {
    const fotosQuitadas = antes.fotos.filter((f) => !a.fotos.includes(f));
    if (fotosQuitadas.length) await borrarFotos(fotosQuitadas);
  }
}

/** Borra el artículo (sus existencias se van con él) y sus fotos. */
export async function borrarArticulo(a: Articulo) {
  const { error } = await supabase.from("articulos").delete().eq("id", a.id);
  if (error) throw error;
  if (a.fotos.length) await borrarFotos(a.fotos);
}

/** Suma o resta en la base de datos (botones + / −): dos personas a la vez no se pisan. */
export async function ajustarExistencia(id: string, delta: number) {
  const { data, error } = await supabase.rpc("ajustar_existencia", { p_id: id, p_delta: delta });
  if (error) throw error;
  return data;
}

/**
 * Pone una cantidad exacta, pero solo si sigue habiendo la que se veía.
 * Devuelve null si alguien la ha cambiado entretanto.
 */
export async function fijarExistencia(id: string, esperada: number, nueva: number) {
  const { data, error } = await supabase
    .from("existencias")
    .update({ cantidad: Math.max(0, Math.round(nueva)) })
    .eq("id", id)
    .eq("cantidad", esperada)
    .select("cantidad");
  if (error) throw error;
  return data.length ? data[0].cantidad : null;
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
  await firmarFotos([ruta]);
  return ruta;
}

/** Borrar fotos es limpieza: si falla, no debe impedir guardar. */
export async function borrarFotos(rutas: string[]) {
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove(rutas);
  if (error) console.warn("No se han podido borrar fotos antiguas", error.message);
}
