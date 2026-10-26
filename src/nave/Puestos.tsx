import { useMemo } from "react";
import type { Caja } from "./geometria";
import { Instancias } from "./piezas";
import { Etiqueta } from "./Estructura";
import { marcoDe } from "./marco";
import type { Elemento } from "./elementos";

type Grupo = { color: string; cajas: Caja[] };

/**
 * Piezas de un objeto, construidas en su marco local (u a lo largo, v a lo ancho).
 * Los que van contra una pared la tienen en v = 0 (PC) o v = ancho (cargador).
 */
function piezasDe(e: Elemento): Grupo[] {
  const m = marcoDe(e.area);
  const { largo: L, ancho: W } = m;
  switch (e.modelo) {
    case "pc": {
      const c = L / 2;
      return [
        { color: "#cbd5e1", cajas: [m.caja(0, 0, L, W, 0.04, 0.74)] },
        { color: "#475569", cajas: [m.caja(0.04, 0.04, 0.1, W - 0.04, 0.74), m.caja(L - 0.1, 0.04, L - 0.04, W - 0.04, 0.74)] },
        { color: "#0f172a", cajas: [m.caja(c - 0.28, 0.08, c + 0.28, 0.13, 0.36, 0.82)] },
      ];
    }
    case "cargador": {
      // Armarios de carga contra la pared (v = ancho), con franja de aviso y tomas en el suelo
      const armarios = Math.max(1, Math.round(L / 1.1));
      const paso = L / armarios;
      const cuerpos: Caja[] = [];
      const franjas: Caja[] = [];
      const tomas: Caja[] = [];
      for (let i = 0; i < armarios; i++) {
        const u0 = i * paso + 0.08;
        const u1 = (i + 1) * paso - 0.08;
        cuerpos.push(m.caja(u0, W - Math.min(0.5, W * 0.4), u1, W, 1.5));
        franjas.push(m.caja(u0, W - Math.min(0.52, W * 0.42), u1, W - Math.min(0.48, W * 0.38), 0.12, 1.2));
        tomas.push(m.caja(u0 + 0.1, 0.05, u1 - 0.1, W - Math.min(0.7, W * 0.5), 0.03));
      }
      return [
        { color: "#334155", cajas: cuerpos },
        { color: "#facc15", cajas: franjas },
        { color: "#64748b", cajas: tomas },
      ];
    }
    case "carros-cc": {
      // Carros daneses (CC) en filas: base, cuatro postes y tres baldas
      const filas = Math.max(1, Math.floor((W + 0.05) / 1.4));
      const porFila = Math.max(1, Math.floor((L + 0.05) / 0.62));
      const bases: Caja[] = [];
      const postes: Caja[] = [];
      const baldas: Caja[] = [];
      for (let f = 0; f < filas; f++) {
        const v0 = f * 1.4 + (W - filas * 1.4) / 2 + 0.03;
        const v1 = v0 + 1.34;
        for (let i = 0; i < porFila; i++) {
          const u0 = i * 0.62 + (L - porFila * 0.62) / 2 + 0.03;
          const u1 = u0 + 0.56;
          bases.push(m.caja(u0, v0, u1, v1, 0.14, 0.06));
          for (const [pu, pv] of [[u0, v0], [u1 - 0.03, v0], [u0, v1 - 0.03], [u1 - 0.03, v1 - 0.03]] as const) {
            postes.push(m.caja(pu, pv, pu + 0.03, pv + 0.03, 1.9));
          }
          for (const h of [0.75, 1.2, 1.65]) baldas.push(m.caja(u0 + 0.02, v0 + 0.02, u1 - 0.02, v1 - 0.02, 0.02, h));
        }
      }
      return [
        { color: "#1e3a8a", cajas: bases },
        { color: "#94a3b8", cajas: postes },
        { color: "#cbd5e1", cajas: baldas },
      ];
    }
    case "carro-bobinas": {
      const n = Math.max(1, Math.round(L / 0.4));
      const paso = (L - 0.1) / n;
      const bobinas: Caja[] = [];
      for (let i = 0; i < n; i++) {
        const u = 0.05 + i * paso;
        bobinas.push(m.caja(u + 0.03, 0.1, u + paso - 0.03, W - 0.1, 0.32, 0.45));
      }
      return [
        { color: "#475569", cajas: [m.caja(0, 0, L, W, 0.06, 0.4)] },
        {
          color: "#334155",
          cajas: [m.caja(0, 0, 0.05, 0.05, 0.4), m.caja(L - 0.05, 0, L, 0.05, 0.4), m.caja(0, W - 0.05, 0.05, W, 0.4), m.caja(L - 0.05, W - 0.05, L, W, 0.4)],
        },
        { color: "#e2e8f0", cajas: bobinas },
      ];
    }
    default:
      // Objeto genérico: un bloque del color del elemento
      return [{ color: e.color, cajas: [m.caja(0, 0, L, W, 1)] }];
  }
}

type Props = { elemento: Elemento; opacidad: number; oculta: boolean };

/** Un objeto del mapa (PC, cargador, carros...): se ve y se edita, pero no se entra en él. */
export function PiezasPuesto({ elemento, opacidad, oculta }: Props) {
  const grupos = useMemo(() => piezasDe(elemento), [elemento]);
  const { x0, y0, x1, y1 } = elemento.area;
  const alto = elemento.modelo === "cargador" || elemento.modelo === "carros-cc" ? 2.3 : 1.5;
  return (
    <group>
      {grupos.map((g, i) => (
        <Instancias key={`${i}-${g.color}-${g.cajas.length}`} cajas={g.cajas} color={g.color} opacidad={opacidad} />
      ))}
      <Etiqueta x={(x0 + x1) / 2} y={(y0 + y1) / 2} altura={alto} oculta={oculta}>
        {elemento.nombre}
      </Etiqueta>
    </group>
  );
}
