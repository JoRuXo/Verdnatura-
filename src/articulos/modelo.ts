import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

// Catálogo de artículos: lo que tenemos, con sus fotos, sus características
// libres y cuántos hay en cada zona del mapa.

export const BUCKET_FOTOS = "fotos-articulos";

export type Caracteristica = { nombre: string; valor: string };

export type Existencia = {
  id: string;
  /** Elemento del mapa donde está; null = sin ubicar (p. ej. si se borró la zona). */
  elementoId: string | null;
  cantidad: number;
  nota: string;
};

export type Articulo = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  /** En qué se cuenta: carros, cajas, rollos... */
  unidad: string;
  caracteristicas: Caracteristica[];
  /** Rutas en el bucket de fotos; la primera es la principal. */
  fotos: string[];
  /** Por debajo de este total, el artículo sale con aviso. */
  stockMinimo: number | null;
  existencias: Existencia[];
};

/** Unidades de serie; se puede escribir cualquier otra. */
export const UNIDADES = ["unidades", "carros", "cajas", "rollos", "bobinas", "palets", "paquetes", "cubos"];

/** Nombres de característica que se sugieren al escribir. */
export const CARACTERISTICAS_SUGERIDAS = [
  "Medidas",
  "Material",
  "Color",
  "Proveedor",
  "Código",
  "Peso",
  "Unidades por caja",
  "Unidades por palet",
];

export const total = (a: Articulo) => a.existencias.reduce((s, e) => s + e.cantidad, 0);

/** Cantidad apuntada sin zona (la zona se borró o aún no se ha colocado). */
export const sinUbicar = (a: Articulo) => a.existencias.filter((e) => !e.elementoId).reduce((s, e) => s + e.cantidad, 0);
export const tieneSinUbicar = (a: Articulo) => a.existencias.some((e) => !e.elementoId);

/** Cantidad del artículo en una zona del mapa. */
export const cantidadEn = (a: Articulo, elementoId: string) =>
  a.existencias.filter((e) => e.elementoId === elementoId).reduce((s, e) => s + e.cantidad, 0);

export type Estado = "ok" | "bajo-minimo" | "sin-stock";

export const estadoStock = (a: Articulo): Estado => {
  const t = total(a);
  if (a.stockMinimo != null && t < a.stockMinimo) return "bajo-minimo";
  return t === 0 ? "sin-stock" : "ok";
};

export const ESTADOS: Record<Estado, { nombre: string; clase: string }> = {
  ok: { nombre: "Con stock", clase: "bg-correcto-suave text-correcto-texto" },
  "bajo-minimo": { nombre: "Bajo mínimo", clase: "bg-peligro-suave text-peligro-texto" },
  "sin-stock": { nombre: "Sin stock", clase: "bg-muted text-muted-foreground" },
};

export const urlFoto = (ruta: string) => supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;

const comoCaracteristicas = (j: Json): Caracteristica[] =>
  Array.isArray(j)
    ? j
        .filter((c): c is { nombre: string; valor: string } => !!c && typeof c === "object" && !Array.isArray(c) && "nombre" in c)
        .map((c) => ({ nombre: String(c.nombre ?? ""), valor: String(c.valor ?? "") }))
    : [];

type FilaConExistencias = Tables<"articulos"> & { existencias: Tables<"existencias">[] };

export const deFila = (f: FilaConExistencias): Articulo => ({
  id: f.id,
  nombre: f.nombre,
  categoria: f.categoria,
  descripcion: f.descripcion,
  unidad: f.unidad,
  caracteristicas: comoCaracteristicas(f.caracteristicas),
  fotos: f.fotos ?? [],
  stockMinimo: f.stock_minimo,
  existencias: (f.existencias ?? [])
    .map((e) => ({ id: e.id, elementoId: e.elemento_id, cantidad: e.cantidad, nota: e.nota }))
    .sort((a, b) => b.cantidad - a.cantidad || a.id.localeCompare(b.id)),
});

export const nuevaExistencia = (elementoId: string | null): Existencia => ({
  id: crypto.randomUUID(),
  elementoId,
  cantidad: 0,
  nota: "",
});

export const articuloVacio = (elementoId?: string | null): Articulo => ({
  id: crypto.randomUUID(),
  nombre: "",
  categoria: "",
  descripcion: "",
  unidad: "unidades",
  caracteristicas: [],
  fotos: [],
  stockMinimo: null,
  existencias: elementoId ? [nuevaExistencia(elementoId)] : [],
});

/** Texto en el que se busca un artículo (además de su nombre). */
export const textoBuscable = (a: Articulo, nombreZona: (id: string) => string | undefined) => [
  a.categoria,
  a.descripcion,
  a.unidad,
  ...a.caracteristicas.flatMap((c) => [c.nombre, c.valor]),
  ...a.existencias.map((e) => (e.elementoId ? nombreZona(e.elementoId) ?? "" : "sin ubicar")),
];
