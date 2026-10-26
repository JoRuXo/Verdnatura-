// Geometría de la nave sacada de los vectores del PDF "NAVE HOLLAND vacía".
// El plano no trae cotas: la escala es provisional (1:300, 1 pt = 0,1058 m),
// deducida de los muelles (uno cada ~4 m). Cuando haya una medida real,
// basta con reescalar estos números.
//
// Coordenadas del plano en metros:
//   x → de la pared izquierda (0) a la pared de los muelles (110)
//   y → de la pared de abajo (0) al borde superior del plano (33,7)

export type Punto = [number, number];
export type Rect = { x0: number; y0: number; x1: number; y1: number };

export const NAVE = { ancho: 110, fondo: 33.71 };

/** Altura a la que se "corta" la maqueta para poder ver el interior desde arriba. */
export const ALTURA_CORTE = 3.2;
export const GROSOR_PARED = 0.35;

/** Pasa un punto del plano (x, y) a la escena 3D (x, z), centrada en la nave. */
export const aEscena = (x: number, y: number): Punto => [x - NAVE.ancho / 2, NAVE.fondo / 2 - y];

/** Fila central de pilares (línea de vanos A–K). */
export const FILA_PILARES_Y = 19.63;
export const PILARES_X = [6.71, 17.02, 27.33, 37.62, 47.93, 58.24, 68.54, 78.85, 89.15, 99.6];

/** Pilastras embebidas en la pared de abajo. */
export const PILASTRAS_FACHADA_X = [
  3.33, 6.68, 11.83, 16.98, 22.13, 27.28, 32.44, 37.59, 42.75, 47.89, 53.04, 58.2, 63.35, 68.51,
  73.66, 78.81, 83.96, 89.11, 94.27, 99.42, 104.57,
];

/** Referencias del plano anotado: letras = vanos entre pilares, números = franjas. */
export const VANOS = "ABCDEFGHIJK".split("").map((letra, i) => {
  const cortes = [0, ...PILARES_X, NAVE.ancho];
  return { letra, x0: cortes[i], x1: cortes[i + 1] };
});
export const FRANJAS = [
  { numero: 1, y0: 26.74, y1: NAVE.fondo },
  { numero: 2, y0: FILA_PILARES_Y, y1: 26.74 },
  { numero: 3, y0: 9.85, y1: FILA_PILARES_Y },
  { numero: 4, y0: 0, y1: 9.85 },
];

/** Referencia de un rectángulo en el plano anotado: vanos y franjas que toca, p. ej. "J–K · 3–4". */
export const referenciaDe = (r: Rect) => {
  const vanos = VANOS.filter((v) => v.x1 > r.x0 + 0.01 && v.x0 < r.x1 - 0.01).map((v) => v.letra);
  const franjas = FRANJAS.filter((f) => f.y1 > r.y0 + 0.01 && f.y0 < r.y1 - 0.01)
    .map((f) => f.numero)
    .sort((a, b) => a - b);
  const rango = (xs: (string | number)[]) => (xs.length > 1 ? `${xs[0]}–${xs[xs.length - 1]}` : `${xs[0] ?? ""}`);
  return `${rango(vanos)} · ${rango(franjas)}`;
};

/**
 * Límite con las otras empresas de la nave (línea roja discontinua), de la pared
 * izquierda a la pared de los muelles. Lo que queda por encima no es de Verdnatura.
 */
export const LIMITE: Punto[] = [
  [0, 9.78],
  [56.11, 9.78],
  [56.11, 32.42],
  [89.18, 32.42],
  [89.18, 27.53],
  [NAVE.ancho, 27.53],
];

/** Superficie de Verdnatura dentro de la nave: de la pared de abajo hasta el límite. */
export const AREA_PROPIA: Punto[] = [[0, 0], [NAVE.ancho, 0], ...[...LIMITE].reverse()];

/** Hasta dónde llega la superficie propia (y) a la altura x. */
export const alturaPropia = (x: number) => {
  for (let i = 1; i < LIMITE.length; i++) {
    const [xa, ya] = LIMITE[i - 1];
    const [xb, yb] = LIMITE[i];
    if (ya === yb && x >= xa && x <= xb) return ya;
  }
  return 0;
};

/** Desde dónde empieza la superficie propia (x) a una altura y. */
export const inicioPropio = (y: number) => (y > LIMITE[0][1] ? LIMITE[1][0] : 0);

/** Hasta dónde llega la superficie propia (x) a una altura y. */
export const finPropio = (y: number) => (y > LIMITE[LIMITE.length - 1][1] ? LIMITE[3][0] : NAVE.ancho);

/**
 * Muelles de carga de Verdnatura en la pared derecha, de arriba abajo: centro en y.
 * M1 y M2 son de la empresa de al lado y no se dibujan; se mantiene la numeración
 * del plano anotado.
 */
export const MUELLES = [25.55, 21.61, 13.71, 9.76, 5.8, 1.86].map((y, i) => ({
  nombre: `M${i + 3}`,
  y,
}));
export const ANCHO_PUERTA_MUELLE = 3;
/** Plataforma niveladora dentro de la nave, delante de cada muelle. */
export const NIVELADOR = { x0: 107.97, largo: 2.02, ancho: 1.8 };

/** Puerta P, al lado del bloque de oficina. */
export const PUERTA_P = { y: 17.68, ancho: 3.5 };

/** Bloque de oficina con la escalera a la planta de arriba. */
export const OFICINA: Rect = { x0: 99.58, y0: 15.74, x1: 109.74, y1: 19.61 };
/** Oficina pequeña montada al lado del bloque. */
export const OFICINA_PEQUENA: Rect = { x0: 94.16, y0: 16.27, x1: 98.33, y1: 19.86 };

/** Cámara frigorífica, con puerta corredera en su lado derecho. */
export const CAMARA_FRIGORIFICA: Rect & { puerta: { y0: number; y1: number } } = {
  x0: 56.11,
  y0: 19.78,
  x1: 78.97,
  y1: 32.42,
  puerta: { y0: 21.11, y1: 23.73 },
};

/** Puertas en la pared izquierda (tramo en y). */
export const PUERTAS_IZQUIERDA = [
  { nombre: "Puerta 1", y0: 8.73, y1: 10.0 },
  { nombre: "Puerta 2", y0: 0.69, y1: 4.18 },
];
