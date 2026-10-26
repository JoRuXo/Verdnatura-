import type { Elemento } from "@/nave/elementos";
import { estadoStock, total, type Articulo, type Estado } from "@/articulos/modelo";

// Los datos del informe de stock, ya ordenados y contados. Lo usan igual el
// Excel y el PDF, así los dos dicen exactamente lo mismo.

export type ZonaInforme = { id: string; nombre: string; categoria: string; color: string };

export type FilaArticulo = {
  articulo: Articulo;
  total: number;
  estado: Estado;
  /** Dónde está, de más a menos. */
  zonas: { zona: ZonaInforme; cantidad: number }[];
  sinUbicar: number;
};

export type GrupoZona = {
  /** null = «Sin ubicar» (cantidades cuya zona se borró). */
  zona: ZonaInforme | null;
  filas: { articulo: Articulo; cantidad: number; nota: string }[];
};

export type ResumenCategoria = { categoria: string; articulos: number; conStock: number; bajoMinimo: number; sinUbicar: number };

export type Informe = {
  fecha: Date;
  autor: string;
  articulos: FilaArticulo[];
  zonas: GrupoZona[];
  categorias: ResumenCategoria[];
  resumen: { articulos: number; conStock: number; zonasOcupadas: number; bajoMinimo: number; sinUbicar: number };
};

export const SIN_CATEGORIA = "Sin categoría";

const porNombre = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

/** Las categorías vacías van al final. */
const porCategoria = (a: string, b: string) => (!a ? 1 : 0) - (!b ? 1 : 0) || porNombre(a, b);

export function prepararInforme(articulos: Articulo[], elementos: Elemento[], autor: string, fecha = new Date()): Informe {
  const zonaDe = new Map<string, ZonaInforme>(
    elementos.map((e) => [e.id, { id: e.id, nombre: e.nombre, categoria: e.categoria, color: e.color }]),
  );

  const filas: FilaArticulo[] = [...articulos]
    .sort((a, b) => porCategoria(a.categoria, b.categoria) || porNombre(a.nombre, b.nombre))
    .map((a) => {
      const zonas = a.existencias
        .filter((e) => e.elementoId && zonaDe.has(e.elementoId))
        .map((e) => ({ zona: zonaDe.get(e.elementoId!)!, cantidad: e.cantidad }))
        .sort((x, y) => y.cantidad - x.cantidad || porNombre(x.zona.nombre, y.zona.nombre));
      // Las de una zona que ya no está en el mapa también cuentan como sin ubicar
      const sinUbicar = a.existencias
        .filter((e) => !e.elementoId || !zonaDe.has(e.elementoId))
        .reduce((s, e) => s + e.cantidad, 0);
      return { articulo: a, total: total(a), estado: estadoStock(a), zonas, sinUbicar };
    });

  const grupos = new Map<string | null, GrupoZona>();
  for (const f of filas) {
    for (const e of f.articulo.existencias) {
      const zona = e.elementoId ? zonaDe.get(e.elementoId) ?? null : null;
      const clave = zona?.id ?? null;
      if (!grupos.has(clave)) grupos.set(clave, { zona, filas: [] });
      grupos.get(clave)!.filas.push({ articulo: f.articulo, cantidad: e.cantidad, nota: e.nota });
    }
  }
  const ordenMapa = new Map(elementos.map((e, i) => [e.id, i]));
  const zonas = [...grupos.values()]
    .map((g) => ({ ...g, filas: g.filas.sort((x, y) => porNombre(x.articulo.nombre, y.articulo.nombre)) }))
    .sort((x, y) => {
      if (!x.zona || !y.zona) return (x.zona ? 0 : 1) - (y.zona ? 0 : 1);
      return porCategoria(x.zona.categoria, y.zona.categoria) || (ordenMapa.get(x.zona.id)! - ordenMapa.get(y.zona.id)!);
    });

  const categorias = new Map<string, ResumenCategoria>();
  for (const f of filas) {
    const nombre = f.articulo.categoria || SIN_CATEGORIA;
    const c = categorias.get(nombre) ?? { categoria: nombre, articulos: 0, conStock: 0, bajoMinimo: 0, sinUbicar: 0 };
    c.articulos++;
    if (f.total > 0) c.conStock++;
    if (f.estado === "bajo-minimo") c.bajoMinimo++;
    if (f.sinUbicar > 0) c.sinUbicar++;
    categorias.set(nombre, c);
  }

  return {
    fecha,
    autor,
    articulos: filas,
    zonas,
    categorias: [...categorias.values()],
    resumen: {
      articulos: filas.length,
      conStock: filas.filter((f) => f.total > 0).length,
      zonasOcupadas: zonas.filter((g) => g.zona && g.filas.some((x) => x.cantidad > 0)).length,
      bajoMinimo: filas.filter((f) => f.estado === "bajo-minimo").length,
      sinUbicar: filas.filter((f) => f.sinUbicar > 0).length,
    },
  };
}

/** Categoría de una zona para ponerla junto a su nombre (nada si repite el nombre). */
export const categoriaZona = (z: ZonaInforme) => (z.categoria.trim().toLowerCase() === z.nombre.trim().toLowerCase() ? "" : z.categoria);

/** «lunes, 27 de octubre de 2026 a las 10:32» */
export const fechaLarga = (d: Date) =>
  `${d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} a las ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

/** Nombre del fichero: «Stock Verdnatura 2026-10-27 1032» */
export const nombreFichero = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `Stock Verdnatura ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
};

export const ETIQUETA_ESTADO: Record<Estado, string> = { ok: "Con stock", "bajo-minimo": "Bajo mínimo", "sin-stock": "Sin stock" };

/** Un color de zona (#rrggbb) mezclado con blanco: fondo suave para su cabecera. */
export function tinte(hex: string, blanco = 0.85) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#f1f5f9";
  const n = parseInt(m[1], 16);
  const canal = (c: number) => Math.round(c + (255 - c) * blanco).toString(16).padStart(2, "0");
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}
