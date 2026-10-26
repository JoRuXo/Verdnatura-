import { aEscena } from "./plano";

export type Vec3 = [number, number, number];
/** Caja en la escena: centro y tamaño. */
export type Caja = { p: Vec3; s: Vec3 };

/** Caja a partir de un rectángulo del plano (metros) y una altura desde `base`. */
export const cajaPlano = (x0: number, y0: number, x1: number, y1: number, alto: number, base = 0): Caja => {
  const [cx, cz] = aEscena((x0 + x1) / 2, (y0 + y1) / 2);
  return { p: [cx, base + alto / 2, cz], s: [Math.abs(x1 - x0), alto, Math.abs(y1 - y0)] };
};

/** Punto del plano a la escena, a una altura dada. */
export const punto3 = (x: number, y: number, altura = 0): Vec3 => {
  const [ex, ez] = aEscena(x, y);
  return [ex, altura, ez];
};

/** Tramos de [inicio, fin] que quedan al quitar los huecos (puertas, muelles...). */
export const tramos = (inicio: number, fin: number, huecos: [number, number][]) => {
  const res: [number, number][] = [];
  let cursor = inicio;
  for (const [a, b] of [...huecos].sort((h1, h2) => h1[0] - h2[0])) {
    if (a > cursor) res.push([cursor, Math.min(a, fin)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < fin) res.push([cursor, fin]);
  return res;
};
