import type { Rect } from "./plano";
import type { Caja } from "./geometria";
import { marcoDe } from "./marco";

// Piezas de las estanterías, a partir de la superficie del elemento (metros).
// Se construyen en el marco local (u a lo largo, v a lo ancho).

export type PiezasEstanteria = {
  montantes: Caja[];
  largueros: Caja[];
  palets: Caja[];
  cargas: Caja[];
  colores: { montante: string; larguero: string; palet: string; carga: string };
};

/**
 * Rack de palets: vanos de 2,7 m a lo largo y, si cabe, dos filas espalda con
 * espalda a lo ancho, con dos alturas de carga.
 */
export function racksPalets(area: Rect): PiezasEstanteria {
  const m = marcoDe(area);
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
  const vanos = Math.max(1, Math.floor((m.largo + 0.05) / VANO));
  const vano = Math.min(VANO, m.largo / vanos);
  const inicio = m.largo / 2 - (vanos * vano) / 2;
  const nFilas = Math.max(1, Math.min(2, Math.floor((m.ancho + 0.05) / (FONDO + 0.05))));
  const fondo = Math.min(FONDO, m.ancho / nFilas - 0.05);
  const filas = Array.from({ length: nFilas }, (_, f) => 0.03 + f * (fondo + 0.05));
  const porVano = Math.max(1, Math.floor(vano / 0.85));
  const anchoPalet = vano / porVano - 0.1;

  filas.forEach((fv, f) => {
    for (let k = 0; k <= vanos; k++) {
      const u = inicio + k * vano;
      piezas.montantes.push(m.caja(u - 0.05, fv, u + 0.05, fv + 0.1, ALTO));
      piezas.montantes.push(m.caja(u - 0.05, fv + fondo - 0.1, u + 0.05, fv + fondo, ALTO));
    }
    for (let k = 0; k < vanos; k++) {
      const ua = inicio + k * vano;
      NIVELES.forEach((nivel, n) => {
        if (nivel > 0) {
          piezas.largueros.push(m.caja(ua, fv, ua + vano, fv + 0.06, 0.12, nivel));
          piezas.largueros.push(m.caja(ua, fv + fondo - 0.06, ua + vano, fv + fondo, 0.12, nivel));
        }
        for (let p = 0; p < porVano; p++) {
          // Patrón fijo de huecos vacíos para que no parezca todo lleno
          if ((k * 7 + p * 3 + n * 5 + f * 2) % 7 === 0) continue;
          const pu = ua + 0.1 + p * (anchoPalet + 0.05);
          const base = nivel + (nivel > 0 ? 0.12 : 0);
          piezas.palets.push(m.caja(pu, fv - 0.03, pu + anchoPalet, fv + fondo + 0.03, 0.14, base));
          const alto = 0.55 + ((k + p + n) % 3) * 0.15;
          piezas.cargas.push(m.caja(pu + 0.02, fv + 0.02, pu + anchoPalet - 0.02, fv + fondo - 0.02, alto, base + 0.14));
        }
      });
    }
  });
  return piezas;
}

/** Estantería baja de baldas, con cajas sueltas. */
export function estanteriaBaldas(area: Rect): PiezasEstanteria {
  const m = marcoDe(area);
  const ALTO = 2.0;
  const BALDAS = [0.1, 0.6, 1.1, 1.6];
  const piezas: PiezasEstanteria = {
    montantes: [],
    largueros: [],
    palets: [],
    cargas: [],
    colores: { montante: "#64748b", larguero: "#94a3b8", palet: "#94a3b8", carga: "#d8c4a0" },
  };
  const tramos = Math.max(1, Math.round(m.largo / 1.35));
  for (let k = 0; k <= tramos; k++) {
    const u = (m.largo * k) / tramos;
    piezas.montantes.push(m.caja(u - 0.03, 0, u + 0.03, 0.06, ALTO));
    piezas.montantes.push(m.caja(u - 0.03, m.ancho - 0.06, u + 0.03, m.ancho, ALTO));
  }
  const cajasPorBalda = Math.max(1, Math.round(m.largo / 0.65));
  const paso = m.largo / cajasPorBalda;
  BALDAS.forEach((b, n) => {
    piezas.largueros.push(m.caja(0, 0, m.largo, m.ancho, 0.03, b));
    for (let i = 0; i < cajasPorBalda; i++) {
      if ((i + n * 3) % 5 === 0) continue;
      const alto = 0.2 + ((i + n) % 3) * 0.08;
      piezas.cargas.push(m.caja(i * paso + 0.06, 0.08, (i + 1) * paso - 0.06, m.ancho - 0.08, alto, b + 0.03));
    }
  });
  return piezas;
}
