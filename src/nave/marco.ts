import type { Rect } from "./plano";
import { cajaPlano, type Caja } from "./geometria";
import { orientacion } from "./elementos";

/**
 * Marco local de un elemento: `u` va a lo largo de su lado más largo y `v` a lo
 * ancho. Así las líneas, estanterías y objetos se construyen una sola vez y valen
 * tanto a lo largo de la nave (x) como a lo ancho (y).
 *
 *  - A lo largo de x: (u, v) → (x0 + u, y0 + v)
 *  - A lo largo de y: (u, v) → (x1 - v, y0 + u)   (giro de 90°)
 */
export type Marco = {
  eje: "x" | "y";
  largo: number;
  ancho: number;
  /** Punto del marco al plano (metros). */
  aPlano: (u: number, v: number) => [number, number];
  /** Caja del marco (u0..u1, v0..v1) con su altura, ya en la escena. */
  caja: (u0: number, v0: number, u1: number, v1: number, alto: number, base?: number) => Caja;
};

export function marcoDe(area: Rect): Marco {
  const eje = orientacion(area);
  const largo = eje === "x" ? area.x1 - area.x0 : area.y1 - area.y0;
  const ancho = eje === "x" ? area.y1 - area.y0 : area.x1 - area.x0;
  const aPlano = (u: number, v: number): [number, number] =>
    eje === "x" ? [area.x0 + u, area.y0 + v] : [area.x1 - v, area.y0 + u];
  const caja = (u0: number, v0: number, u1: number, v1: number, alto: number, base = 0) => {
    const [xa, ya] = aPlano(u0, v0);
    const [xb, yb] = aPlano(u1, v1);
    return cajaPlano(Math.min(xa, xb), Math.min(ya, yb), Math.max(xa, xb), Math.max(ya, yb), alto, base);
  };
  return { eje, largo, ancho, aPlano, caja };
}
