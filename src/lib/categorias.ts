export type ArticuloBasico = { nombre: string; categoria: string | null };

export const SIN_CATEGORIA = "Sin categoría";

/** Categoría del artículo tal como la escribió el usuario, o "Sin categoría". */
export function categoriaArticulo(art: ArticuloBasico | null | undefined): string {
  const c = (art?.categoria ?? "").trim();
  return c || SIN_CATEGORIA;
}

// Paleta para la franja de color del mapa (una por categoría, estable por nombre)
const PALETA = ["#3b82f6", "#22c55e", "#a855f7", "#f97316", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#84cc16"];

export function colorCategoria(categoria: string | null | undefined): string {
  const c = (categoria ?? "").trim().toLowerCase();
  if (!c) return "#94a3b8";
  let hash = 0;
  for (let i = 0; i < c.length; i++) hash = (hash * 31 + c.charCodeAt(i)) >>> 0;
  return PALETA[hash % PALETA.length];
}

/**
 * Texto corto para mostrar el artículo dentro de un hueco del mapa.
 * "Etiqueta film 120"   → "Etiq. 120"
 * "Cinta adhesiva"      → "Cinta ad"
 * "Film"                → "Film"
 */
export function abreviaturaArticulo(art: ArticuloBasico | null | undefined): string {
  if (!art) return "";
  const nombre = String(art.nombre ?? "").trim();
  if (nombre.length <= 8) return nombre;

  const numero = nombre.match(/(\d[\d.,x×/-]*)\s*$/)?.[1];
  const primera = nombre.split(/\s+/)[0] ?? "";
  if (numero) {
    const base = primera.length > 5 ? `${primera.slice(0, 4)}.` : primera;
    return `${base} ${numero}`;
  }
  return nombre.slice(0, 8);
}
