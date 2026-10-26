import type { Rect } from "./plano";

// Distribución real de la nave, sacada del croquis a mano del 26/10/2026.
// Medidas estimadas a ojo y alineadas con los muelles: se corrigen aquí.
// Más adelante pasarán a una tabla de Supabase.

export type Categoria =
  | "plantas"
  | "frio"
  | "cc"
  | "boxes"
  | "tumba"
  | "entrada"
  | "vacios"
  | "carton"
  | "cubos"
  | "estanteria";

/** Nombre y color de cada tipo de zona, en el orden en que salen en el menú. */
export const CATEGORIAS: Record<Categoria, { nombre: string; color: string }> = {
  entrada: { nombre: "Entrada de producto", color: "#14b8a6" },
  vacios: { nombre: "Vuelta de vacíos", color: "#475569" },
  tumba: { nombre: "Tumba", color: "#a855f7" },
  cc: { nombre: "CC tumbados", color: "#f97316" },
  boxes: { nombre: "Boxes", color: "#eab308" },
  frio: { nombre: "Frío", color: "#0ea5e9" },
  plantas: { nombre: "Plantas", color: "#22c55e" },
  cubos: { nombre: "Cubos", color: "#ec4899" },
  carton: { nombre: "Cartón", color: "#b45309" },
  estanteria: { nombre: "Estanterías", color: "#78716c" },
};

export type TipoZona = "linea" | "area" | "estanteria";

export type Zona = {
  id: string;
  nombre: string;
  categoria: Categoria;
  tipo: TipoZona;
  /** Superficie en coordenadas del plano (metros). Las líneas van a lo largo de x. */
  area: Rect;
  /** Sentido del producto en las líneas que lo tienen. */
  sentido?: "muelles" | "puertas";
  /** Muelle al que llega la línea, deducido del croquis. */
  muelle?: string;
  descripcion: string;
  /** Modelo de estantería que se dibuja dentro. */
  estanteria?: "carton" | "pared";
};

const tumba = (n: number, x0: number, x1: number, y0: number): Zona => ({
  id: `tumba-${n}`,
  nombre: `Tumba ${n}`,
  categoria: "tumba",
  tipo: "linea",
  area: { x0, x1, y0, y1: y0 + 1.2 },
  descripcion: "Flores que hay que tumbar: aquí esperan a pasar por el proceso de tumbado.",
});

const entrada = (n: number, y0: number): Zona => ({
  id: `entrada-${n}`,
  nombre: `Entrada ${n}`,
  categoria: "entrada",
  tipo: "linea",
  area: { x0: 2, x1: 55.4, y0, y1: y0 + 1.25 },
  sentido: "muelles",
  descripcion: "Línea por la que entra el producto desde las puertas, camino de los muelles.",
});

// Líneas de la parte de los muelles: empiezan tras el escalón y acaban antes de los niveladores
const MUELLE_X0 = 90.5;
const MUELLE_X1 = 107.6;

export const ZONAS: Zona[] = [
  // Parte larga: entradas y vuelta de vacíos
  entrada(1, 1.2),
  entrada(2, 4.2),
  entrada(3, 6.9),
  {
    id: "vuelta-vacios",
    nombre: "Vuelta de vacíos",
    categoria: "vacios",
    tipo: "linea",
    area: { x0: 2, x1: 55.4, y0: 8.4, y1: 9.5 },
    sentido: "puertas",
    descripcion: "Los carros CC vacíos vuelven por aquí hacia las puertas.",
  },

  // Parte central
  tumba(1, 64.5, 86, 16.0),
  tumba(2, 64.5, 86, 17.4),
  tumba(3, 60.5, 88.5, 6.6),
  tumba(4, 60.5, 88.5, 8.0),
  {
    id: "cubos",
    nombre: "Cubos",
    categoria: "cubos",
    tipo: "area",
    area: { x0: 56.6, x1: 62, y0: 11.5, y1: 16 },
    descripcion: "Zona de cubos.",
  },
  {
    id: "estanteria",
    nombre: "Estantería",
    categoria: "estanteria",
    tipo: "estanteria",
    area: { x0: 60.8, x1: 63.5, y0: 0.5, y1: 1.1 },
    estanteria: "pared",
    descripcion: "Estantería pegada a la pared larga, junto al carro de bobinas.",
  },

  // Parte de los muelles
  {
    id: "cc-tumbados",
    nombre: "CC tumbados",
    categoria: "cc",
    tipo: "linea",
    area: { x0: MUELLE_X0, x1: MUELLE_X1, y0: 12.4, y1: 13.7 },
    sentido: "muelles",
    muelle: "M5",
    descripcion: "Carros CC con las flores ya tumbadas, camino del muelle para expedirlas.",
  },
  {
    id: "boxes",
    nombre: "Boxes",
    categoria: "boxes",
    tipo: "linea",
    area: { x0: MUELLE_X0, x1: MUELLE_X1, y0: 13.9, y1: 15.2 },
    descripcion: "Boxes, al lado de la oficina y de los CC tumbados.",
  },
  {
    id: "frio-1",
    nombre: "Frío 1",
    categoria: "frio",
    tipo: "linea",
    area: { x0: MUELLE_X0, x1: MUELLE_X1, y0: 9.1, y1: 10.4 },
    sentido: "muelles",
    muelle: "M6",
    descripcion: "Línea de frío hacia el muelle.",
  },
  {
    id: "frio-2",
    nombre: "Frío 2",
    categoria: "frio",
    tipo: "linea",
    area: { x0: MUELLE_X0, x1: MUELLE_X1, y0: 5.9, y1: 7.2 },
    sentido: "muelles",
    muelle: "M7",
    descripcion: "Línea de frío hacia el muelle.",
  },
  {
    id: "plantas-2",
    nombre: "Plantas 2",
    categoria: "plantas",
    tipo: "linea",
    area: { x0: MUELLE_X0, x1: MUELLE_X1, y0: 4.4, y1: 5.7 },
    sentido: "muelles",
    muelle: "M7",
    descripcion: "Línea de plantas hacia el muelle.",
  },
  {
    id: "plantas-1",
    nombre: "Plantas 1",
    categoria: "plantas",
    tipo: "linea",
    area: { x0: MUELLE_X0, x1: MUELLE_X1, y0: 1.2, y1: 2.5 },
    sentido: "muelles",
    muelle: "M8",
    descripcion: "Línea de plantas, pegada a la pared larga, hacia el muelle.",
  },
  {
    id: "carton",
    nombre: "Cartón",
    categoria: "carton",
    tipo: "estanteria",
    area: { x0: 92.5, x1: 100.6, y0: 25.0, y1: 27.3 },
    estanteria: "carton",
    descripcion: "Estanterías de cartón, en la esquina del fondo junto al muelle M3.",
  },
];

export type Puesto = {
  id: string;
  nombre: string;
  tipo: "pc" | "cargador" | "carro-bobinas";
  area: Rect;
};

/** Elementos que se ven en el mapa pero en los que no se entra. */
export const PUESTOS: Puesto[] = [
  { id: "charger", nombre: "Charger", tipo: "cargador", area: { x0: 89.5, x1: 91.8, y0: 25.3, y1: 27.2 } },
  { id: "carro-bobinas", nombre: "Carro de bobinas", tipo: "carro-bobinas", area: { x0: 63.8, x1: 65.1, y0: 0.5, y1: 1.3 } },
  { id: "pc-1", nombre: "PC", tipo: "pc", area: { x0: 53.6, x1: 54.6, y0: 0.5, y1: 1.1 } },
  { id: "pc-2", nombre: "PC", tipo: "pc", area: { x0: 36.4, x1: 37.4, y0: 0.5, y1: 1.1 } },
];

export const buscarZona = (id: string | undefined) => ZONAS.find((z) => z.id === id);

/** Zonas agrupadas por tipo, en el orden de `CATEGORIAS`, para el menú. */
export const zonasPorCategoria = () =>
  (Object.keys(CATEGORIAS) as Categoria[])
    .map((c) => ({ categoria: c, ...CATEGORIAS[c], zonas: ZONAS.filter((z) => z.categoria === c) }))
    .filter((g) => g.zonas.length > 0);

export const colorDe = (z: Zona) => CATEGORIAS[z.categoria].color;
