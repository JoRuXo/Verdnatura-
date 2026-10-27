// Cómo se dibuja un artículo en el mapa 3D, en la zona donde está guardado.
// La cantidad apuntada decide cuántos se dibujan (lo que quepa en la zona).

export type Aspecto =
  | "carros-apilados"
  | "carro-barras"
  | "carro-bandejas"
  | "carro-carton"
  | "palet-planchas"
  | "palet-film"
  | "cajas-etiquetas";

export const ASPECTOS: Record<Aspecto, { nombre: string; texto: string }> = {
  "carros-apilados": { nombre: "Carros CC apilados", texto: "Pilas de bases de carro, hasta 10 por pila." },
  "carro-barras": { nombre: "Carro CC con barras", texto: "Un carro con las barras tumbadas por cada uno." },
  "carro-bandejas": { nombre: "Carro CC con bandejas", texto: "Un carro lleno de bandejas por cada uno." },
  "carro-carton": { nombre: "Carro CC con cartón", texto: "Un carro con cartón apilado por cada uno." },
  "palet-planchas": { nombre: "Palet de planchas de cartón", texto: "Un palet por cada uno; si no caben, de dos en dos." },
  "palet-film": { nombre: "Palet con film y flejes", texto: "Un palet envuelto por cada uno; si no caben, de dos en dos." },
  "cajas-etiquetas": { nombre: "Armario con cajas", texto: "Cajas en un armario metálico: 12 dentro y 4 encima. En una estantería, el armario ocupa su lugar." },
};

export const esAspecto = (v: unknown): v is Aspecto => typeof v === "string" && v in ASPECTOS;
