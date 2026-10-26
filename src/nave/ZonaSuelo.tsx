import { useMemo, useState } from "react";
import { Html, Line, useCursor } from "@react-three/drei";
import { cn } from "@/lib/utils";
import { aEscena } from "./plano";
import { cajaPlano, punto3, type Caja } from "./geometria";
import { Instancias } from "./piezas";
import type { Zona } from "./zonas";

type Props = {
  zona: Zona;
  activa: boolean;
  onElegir: (id: string) => void;
};

export function ZonaSuelo({ zona, activa, onElegir }: Props) {
  const [encima, setEncima] = useState(false);
  useCursor(encima && !activa);

  const { x0, y0, x1, y1 } = zona.area;
  const [cx, cz] = aEscena((x0 + x1) / 2, (y0 + y1) / 2);
  const borde = useMemo(
    () => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => punto3(x, y, 0.04)),
    [x0, y0, x1, y1],
  );

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[cx, 0.02, cz]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setEncima(true);
        }}
        onPointerOut={() => setEncima(false)}
        onClick={(e) => {
          // Un arrastre para mover el mapa no cuenta como clic
          if (e.delta > 6) return;
          e.stopPropagation();
          onElegir(zona.id);
        }}
      >
        <planeGeometry args={[x1 - x0, y1 - y0]} />
        <meshBasicMaterial
          color={zona.color}
          transparent
          opacity={activa ? 0.12 : encima ? 0.36 : 0.2}
          depthWrite={false}
        />
      </mesh>
      <Line points={borde} color={zona.color} lineWidth={activa || encima ? 3 : 2} />

      {zona.ejemplo && <EstanteriasEjemplo zona={zona} />}

      {!activa && (
        <Html position={[cx, 4.2, cz]} center zIndexRange={[8, 6]}>
          <button
            type="button"
            onClick={() => onElegir(zona.id)}
            onPointerEnter={() => setEncima(true)}
            onPointerLeave={() => setEncima(false)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg ring-2 ring-white/70 transition-transform duration-200",
              encima ? "scale-110" : "scale-100",
            )}
            style={{ backgroundColor: zona.color }}
          >
            {zona.nombre}
          </button>
        </Html>
      )}
    </group>
  );
}

// Medidas típicas de estantería de palets (metros).
const VANO = 2.7;
const FONDO = 1.1;
const NIVELES = [0, 1.45];
const ALTO = 3.0;

/** Estanterías de muestra: dos filas de racks con palets cargados. Solo decorativas. */
function EstanteriasEjemplo({ zona }: { zona: Zona }) {
  const piezas = useMemo(() => {
    const montantes: Caja[] = [];
    const largueros: Caja[] = [];
    const palets: Caja[] = [];
    const cargas: Caja[] = [];
    const { x0, x1, y0, y1 } = zona.area;
    const vanos = Math.floor((x1 - x0 - 1.4) / VANO);
    const inicio = (x0 + x1) / 2 - (vanos * VANO) / 2;
    const filas = [y0 + 0.9, y1 - 0.9 - FONDO];

    filas.forEach((fy, f) => {
      for (let v = 0; v <= vanos; v++) {
        const x = inicio + v * VANO;
        montantes.push(cajaPlano(x - 0.05, fy, x + 0.05, fy + 0.1, ALTO));
        montantes.push(cajaPlano(x - 0.05, fy + FONDO - 0.1, x + 0.05, fy + FONDO, ALTO));
      }
      for (let v = 0; v < vanos; v++) {
        const xa = inicio + v * VANO;
        NIVELES.forEach((nivel, n) => {
          if (nivel > 0) {
            largueros.push(cajaPlano(xa, fy, xa + VANO, fy + 0.06, 0.12, nivel));
            largueros.push(cajaPlano(xa, fy + FONDO - 0.06, xa + VANO, fy + FONDO, 0.12, nivel));
          }
          for (let p = 0; p < 3; p++) {
            // Patrón fijo de huecos vacíos para que no parezca todo lleno
            if ((v * 7 + p * 3 + n * 5 + f * 2) % 6 === 0) continue;
            const px = xa + 0.1 + p * 0.85;
            const base = nivel + (nivel > 0 ? 0.12 : 0);
            palets.push(cajaPlano(px, fy - 0.05, px + 0.8, fy + FONDO + 0.05, 0.14, base));
            const alto = 0.75 + ((v + p + n) % 3) * 0.12;
            cargas.push(cajaPlano(px + 0.04, fy + 0.02, px + 0.76, fy + FONDO - 0.02, alto, base + 0.14));
          }
        });
      }
    });
    return { montantes, largueros, palets, cargas };
  }, [zona]);

  return (
    <group>
      <Instancias cajas={piezas.montantes} color="#1d4ed8" />
      <Instancias cajas={piezas.largueros} color="#f97316" />
      <Instancias cajas={piezas.palets} color="#b7895a" />
      <Instancias cajas={piezas.cargas} color="#d8c4a0" />
    </group>
  );
}
