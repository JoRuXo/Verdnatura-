import { useMemo } from "react";
import { cajaPlano, type Caja } from "./geometria";
import { Instancias } from "./piezas";
import { Etiqueta } from "./Estructura";
import { PUESTOS, type Puesto } from "./zonas";

/** Piezas de cada puesto, agrupadas por color para dibujarlas en pocas llamadas. */
function piezasDe(p: Puesto): { color: string; cajas: Caja[] }[] {
  const { x0, y0, x1, y1 } = p.area;
  const cx = (x0 + x1) / 2;
  switch (p.tipo) {
    case "pc":
      // Mesa pegada a la pared y pantalla encima
      return [
        { color: "#cbd5e1", cajas: [cajaPlano(x0, y0, x1, y1, 0.04, 0.74)] },
        {
          color: "#475569",
          cajas: [
            cajaPlano(x0 + 0.04, y0 + 0.04, x0 + 0.1, y1 - 0.04, 0.74),
            cajaPlano(x1 - 0.1, y0 + 0.04, x1 - 0.04, y1 - 0.04, 0.74),
          ],
        },
        { color: "#0f172a", cajas: [cajaPlano(cx - 0.28, y0 + 0.08, cx + 0.28, y0 + 0.13, 0.36, 0.82)] },
      ];
    case "cargador":
      // Armario de carga junto a la pared del fondo, con franja de aviso y tomas en el suelo
      return [
        { color: "#334155", cajas: [cajaPlano(x0, y1 - 0.5, x1, y1, 1.5)] },
        { color: "#facc15", cajas: [cajaPlano(x0, y1 - 0.52, x1, y1 - 0.48, 0.12, 1.2)] },
        {
          color: "#64748b",
          cajas: [cajaPlano(x0 + 0.2, y0, x0 + 1.0, y1 - 0.7, 0.03), cajaPlano(x1 - 1.0, y0, x1 - 0.2, y1 - 0.7, 0.03)],
        },
      ];
    case "carro-bobinas": {
      // Carro con bobinas de film tumbadas
      const bobinas: Caja[] = [];
      const n = 3;
      const paso = (x1 - x0 - 0.1) / n;
      for (let i = 0; i < n; i++) {
        const bx = x0 + 0.05 + i * paso;
        bobinas.push(cajaPlano(bx + 0.03, y0 + 0.1, bx + paso - 0.03, y1 - 0.1, 0.32, 0.45));
      }
      return [
        { color: "#475569", cajas: [cajaPlano(x0, y0, x1, y1, 0.06, 0.4)] },
        {
          color: "#334155",
          cajas: [
            cajaPlano(x0, y0, x0 + 0.05, y0 + 0.05, 0.4),
            cajaPlano(x1 - 0.05, y0, x1, y0 + 0.05, 0.4),
            cajaPlano(x0, y1 - 0.05, x0 + 0.05, y1, 0.4),
            cajaPlano(x1 - 0.05, y1 - 0.05, x1, y1, 0.4),
          ],
        },
        { color: "#e2e8f0", cajas: bobinas },
      ];
    }
  }
}

/** Puestos que se ven en el mapa pero no son zonas (PC, cargador, carro de bobinas). */
export function Puestos({ oculta, opacidad }: { oculta: boolean; opacidad: number }) {
  const grupos = useMemo(() => {
    // Junta las piezas del mismo color de todos los puestos
    const porColor = new Map<string, Caja[]>();
    for (const p of PUESTOS) {
      for (const { color, cajas } of piezasDe(p)) porColor.set(color, [...(porColor.get(color) ?? []), ...cajas]);
    }
    return [...porColor.entries()];
  }, []);

  return (
    <group>
      {grupos.map(([color, cajas]) => (
        <Instancias key={color} cajas={cajas} color={color} opacidad={opacidad} />
      ))}
      {PUESTOS.map((p) => (
        <Etiqueta
          key={p.id}
          x={(p.area.x0 + p.area.x1) / 2}
          y={(p.area.y0 + p.area.y1) / 2}
          altura={p.tipo === "cargador" ? 2.1 : 1.5}
          oculta={oculta}
        >
          {p.nombre}
        </Etiqueta>
      ))}
    </group>
  );
}
