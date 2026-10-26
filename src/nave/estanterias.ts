import type { Rect } from "./plano";
import { cajaPlano, type Caja } from "./geometria";

// Piezas de las estanterías, a partir de la superficie de la zona (metros).

export type PiezasEstanteria = {
  montantes: Caja[];
  largueros: Caja[];
  palets: Caja[];
  cargas: Caja[];
  colores: { montante: string; larguero: string; palet: string; carga: string };
};

/**
 * Rack de palets: vanos de 2,7 m a lo largo de x, dos filas espalda con espalda
 * a lo ancho y dos alturas de carga. Para el cartón, cargas planas apiladas.
 */
export function racksCarton(area: Rect): PiezasEstanteria {
  const VANO = 2.7;
  const FONDO = 1.1;
  const ALTO = 3.0;
  const NIVELES = [0, 1.5];
  const piezas: PiezasEstanteria = {
    montantes: [],
    largueros: [],
    palets: [],
    cargas: [],
    colores: { montante: "#1d4ed8", larguero: "#f97316", palet: "#b7895a", carga: "#c9a27a" },
  };
  const vanos = Math.max(1, Math.floor((area.x1 - area.x0 + 0.05) / VANO));
  const inicio = (area.x0 + area.x1) / 2 - (vanos * VANO) / 2;
  const filas = [area.y0 + 0.05, area.y0 + 0.05 + FONDO + 0.05];

  filas.forEach((fy, f) => {
    for (let v = 0; v <= vanos; v++) {
      const x = inicio + v * VANO;
      piezas.montantes.push(cajaPlano(x - 0.05, fy, x + 0.05, fy + 0.1, ALTO));
      piezas.montantes.push(cajaPlano(x - 0.05, fy + FONDO - 0.1, x + 0.05, fy + FONDO, ALTO));
    }
    for (let v = 0; v < vanos; v++) {
      const xa = inicio + v * VANO;
      NIVELES.forEach((nivel, n) => {
        if (nivel > 0) {
          piezas.largueros.push(cajaPlano(xa, fy, xa + VANO, fy + 0.06, 0.12, nivel));
          piezas.largueros.push(cajaPlano(xa, fy + FONDO - 0.06, xa + VANO, fy + FONDO, 0.12, nivel));
        }
        for (let p = 0; p < 3; p++) {
          // Patrón fijo de huecos vacíos para que no parezca todo lleno
          if ((v * 7 + p * 3 + n * 5 + f * 2) % 7 === 0) continue;
          const px = xa + 0.1 + p * 0.85;
          const base = nivel + (nivel > 0 ? 0.12 : 0);
          piezas.palets.push(cajaPlano(px, fy - 0.03, px + 0.8, fy + FONDO + 0.03, 0.14, base));
          const alto = 0.55 + ((v + p + n) % 3) * 0.15;
          piezas.cargas.push(cajaPlano(px + 0.02, fy + 0.02, px + 0.78, fy + FONDO - 0.02, alto, base + 0.14));
        }
      });
    }
  });
  return piezas;
}

/** Estantería baja de baldas pegada a la pared, con cajas sueltas. */
export function estanteriaPared(area: Rect): PiezasEstanteria {
  const ALTO = 2.0;
  const BALDAS = [0.1, 0.6, 1.1, 1.6];
  const piezas: PiezasEstanteria = {
    montantes: [],
    largueros: [],
    palets: [],
    cargas: [],
    colores: { montante: "#64748b", larguero: "#94a3b8", palet: "#94a3b8", carga: "#d8c4a0" },
  };
  const { x0, x1, y0, y1 } = area;
  for (const x of [x0, (x0 + x1) / 2, x1]) {
    piezas.montantes.push(cajaPlano(x - 0.03, y0, x + 0.03, y0 + 0.06, ALTO));
    piezas.montantes.push(cajaPlano(x - 0.03, y1 - 0.06, x + 0.03, y1, ALTO));
  }
  BALDAS.forEach((b, n) => {
    piezas.largueros.push(cajaPlano(x0, y0, x1, y1, 0.03, b));
    // Cajas en cada balda, con algún hueco
    for (let i = 0; i < 4; i++) {
      if ((i + n * 3) % 5 === 0) continue;
      const cx = x0 + 0.1 + i * ((x1 - x0 - 0.2) / 4);
      const alto = 0.2 + ((i + n) % 3) * 0.08;
      piezas.cargas.push(cajaPlano(cx, y0 + 0.08, cx + (x1 - x0 - 0.4) / 4, y1 - 0.08, alto, b + 0.03));
    }
  });
  return piezas;
}
