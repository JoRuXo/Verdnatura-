import inicial from "./mapa-inicial.json";
import { FRANJAS, NAVE, VANOS, type Rect } from "./plano";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// Elementos del mapa: zonas (líneas, áreas, estanterías) y objetos (PC, cargadores...).
// Viven en la tabla `elementos_mapa` de Supabase y se editan desde el propio mapa.

export type TipoElemento = "linea" | "area" | "estanteria" | "puesto";

export type Elemento = {
  /** uuid de Supabase (en los datos de serie, la clave). */
  id: string;
  /** Identificador legible para la dirección: /zona/<clave>. */
  clave: string;
  nombre: string;
  tipo: TipoElemento;
  /** Agrupa en el menú: "Frío", "Tumba", "Puestos"... Lo escribe el usuario. */
  categoria: string;
  color: string;
  /** Superficie en coordenadas del plano (metros). */
  area: Rect;
  /** Líneas: 1 = hacia +x/+y (muelles / fondo), -1 = al revés, null = sin flecha. */
  sentido: 1 | -1 | null;
  muelle: string | null;
  /** Estanterías: "carton" | "pared". Objetos: "pc" | "cargador" | "carro-bobinas" | "carros-cc". */
  modelo: string | null;
  descripcion: string;
  orden: number;
};

export const TIPOS: Record<TipoElemento, string> = {
  linea: "Línea",
  area: "Zona",
  estanteria: "Estantería",
  puesto: "Objeto",
};

export const MODELOS: Record<"estanteria" | "puesto", { valor: string; nombre: string }[]> = {
  estanteria: [
    { valor: "carton", nombre: "Rack de palets" },
    { valor: "pared", nombre: "Estantería de baldas" },
  ],
  puesto: [
    { valor: "carros-cc", nombre: "Carros CC" },
    { valor: "cargador", nombre: "Cargador" },
    { valor: "pc", nombre: "PC" },
    { valor: "carro-bobinas", nombre: "Carro de bobinas" },
  ],
};

/** Categorías y colores de serie; se pueden escribir otras nuevas. */
export const CATEGORIAS_DE_SERIE: { nombre: string; color: string }[] = [
  { nombre: "Entrada de producto", color: "#14b8a6" },
  { nombre: "Vuelta de vacíos", color: "#475569" },
  { nombre: "Tumba", color: "#a855f7" },
  { nombre: "CC tumbados", color: "#f97316" },
  { nombre: "Boxes", color: "#eab308" },
  { nombre: "Frío", color: "#0ea5e9" },
  { nombre: "Plantas", color: "#22c55e" },
  { nombre: "Cubos", color: "#ec4899" },
  { nombre: "Cartón", color: "#b45309" },
  { nombre: "Estanterías", color: "#78716c" },
  { nombre: "Carros", color: "#2563eb" },
  { nombre: "Puestos", color: "#475569" },
];

export const COLORES = [
  "#14b8a6", "#0ea5e9", "#2563eb", "#a855f7", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#b45309", "#78716c", "#475569",
];

export const esNavegable = (e: Elemento) => e.tipo !== "puesto";

/** Las líneas y estanterías van a lo largo de su lado más largo. */
export const orientacion = (r: Rect): "x" | "y" => (r.x1 - r.x0 >= r.y1 - r.y0 ? "x" : "y");

export const textoSentido = (e: Elemento) => {
  if (!e.sentido) return null;
  if (orientacion(e.area) === "x") return e.sentido > 0 ? "Hacia los muelles" : "Hacia las puertas";
  return e.sentido > 0 ? "Hacia el fondo" : "Hacia la pared larga";
};

/** Referencia en el plano anotado: vanos y franjas que toca, p. ej. "J–K · 3–4". */
export const referenciaDe = (r: Rect) => {
  const vanos = VANOS.filter((v) => v.x1 > r.x0 + 0.01 && v.x0 < r.x1 - 0.01).map((v) => v.letra);
  const franjas = FRANJAS.filter((f) => f.y1 > r.y0 + 0.01 && f.y0 < r.y1 - 0.01)
    .map((f) => f.numero)
    .sort((a, b) => a - b);
  const rango = (xs: (string | number)[]) => (xs.length > 1 ? `${xs[0]}–${xs[xs.length - 1]}` : `${xs[0] ?? ""}`);
  return `${rango(vanos)} · ${rango(franjas)}`;
};

type FilaInicial = (typeof inicial)[number];

const normalizar = (f: FilaInicial | Tables<"elementos_mapa">, id: string, orden: number): Elemento => ({
  id,
  clave: f.clave,
  nombre: f.nombre,
  tipo: f.tipo as TipoElemento,
  categoria: f.categoria,
  color: f.color,
  area: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 },
  sentido: f.sentido === 1 || f.sentido === -1 ? f.sentido : null,
  muelle: f.muelle,
  modelo: f.modelo,
  descripcion: f.descripcion,
  orden,
});

/** El mapa de serie (croquis del 26/10/2026), por si no se puede leer Supabase. */
export const ELEMENTOS_DE_SERIE: Elemento[] = inicial.map((f, i) => normalizar(f, f.clave, i));

export const deFila = (f: Tables<"elementos_mapa">): Elemento => normalizar(f, f.id, f.orden);

export const aFila = (e: Elemento, orden: number): TablesInsert<"elementos_mapa"> => ({
  id: e.id,
  clave: e.clave,
  nombre: e.nombre,
  tipo: e.tipo,
  categoria: e.categoria,
  color: e.color,
  x0: e.area.x0,
  y0: e.area.y0,
  x1: e.area.x1,
  y1: e.area.y1,
  sentido: e.sentido,
  muelle: e.muelle,
  modelo: e.modelo,
  descripcion: e.descripcion,
  orden,
});

/** Grupos para el menú "Zonas", en el orden de las categorías de serie y luego las nuevas. */
export const agruparPorCategoria = (elementos: Elemento[]) => {
  const orden = CATEGORIAS_DE_SERIE.map((c) => c.nombre);
  const grupos = new Map<string, Elemento[]>();
  for (const e of elementos.filter(esNavegable)) grupos.set(e.categoria, [...(grupos.get(e.categoria) ?? []), e]);
  return [...grupos.entries()]
    .sort(([a], [b]) => {
      const ia = orden.indexOf(a);
      const ib = orden.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    })
    .map(([categoria, zonas]) => ({ categoria, color: zonas[0].color, zonas }));
};

const sufijo = () => Math.random().toString(36).slice(2, 6);
const aClave = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Tamaño de serie de cada cosa nueva (ancho en x, fondo en y), en metros. */
const TAMANOS: Record<string, [number, number]> = {
  linea: [15, 1.25],
  area: [5, 5],
  carton: [8.1, 2.3],
  pared: [2.7, 0.6],
  "carros-cc": [3.2, 1.5],
  cargador: [1.5, 2.2],
  pc: [1.0, 0.6],
  "carro-bobinas": [1.3, 0.8],
};

/** Crea un elemento nuevo centrado en (x, y) del plano. */
export function nuevoElemento(tipo: TipoElemento, modelo: string | null, x: number, y: number): Elemento {
  const nombreBase =
    modelo && tipo !== "linea" && tipo !== "area"
      ? (MODELOS[tipo as "estanteria" | "puesto"]?.find((m) => m.valor === modelo)?.nombre ?? TIPOS[tipo])
      : tipo === "linea"
        ? "Línea nueva"
        : "Zona nueva";
  const [ancho, fondo] = TAMANOS[modelo ?? tipo] ?? [4, 4];
  // Esquina en la rejilla de 25 cm, dentro de la nave
  const enRejilla = (v: number) => Math.round(v * 4) / 4;
  const cx = enRejilla(Math.min(Math.max(x, ancho / 2), NAVE.ancho - ancho / 2) - ancho / 2) + ancho / 2;
  const cy = enRejilla(Math.min(Math.max(y, fondo / 2), NAVE.fondo - fondo / 2) - fondo / 2) + fondo / 2;
  const categoria =
    tipo === "puesto" ? (modelo === "carros-cc" ? "Carros" : "Puestos") : tipo === "estanteria" ? "Estanterías" : "Sin categoría";
  const color = CATEGORIAS_DE_SERIE.find((c) => c.nombre === categoria)?.color ?? "#64748b";
  return {
    id: crypto.randomUUID(),
    clave: `${aClave(nombreBase)}-${sufijo()}`,
    nombre: nombreBase,
    tipo,
    categoria,
    color,
    area: { x0: cx - ancho / 2, y0: cy - fondo / 2, x1: cx + ancho / 2, y1: cy + fondo / 2 },
    sentido: tipo === "linea" ? 1 : null,
    muelle: null,
    modelo,
    descripcion: "",
    orden: 9999,
  };
}

/** Copia desplazada un poco para que se vea que es otra. */
export const duplicar = (e: Elemento): Elemento => ({
  ...e,
  id: crypto.randomUUID(),
  clave: `${aClave(e.nombre) || "elemento"}-${sufijo()}`,
  nombre: `${e.nombre} (copia)`,
  area: { x0: e.area.x0 + 1, y0: e.area.y0 - 1, x1: e.area.x1 + 1, y1: e.area.y1 - 1 },
});
