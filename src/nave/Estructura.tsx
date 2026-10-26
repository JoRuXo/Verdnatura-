import { useMemo, type ReactNode } from "react";
import { Html, Line } from "@react-three/drei";
import { cn } from "@/lib/utils";
import {
  ALTURA_CORTE,
  ANCHO_PUERTA_MUELLE,
  CONTORNOS,
  FILA_PILARES_Y,
  FRANJAS,
  GROSOR_PARED,
  MUEBLE,
  MUELLES,
  NAVE,
  NIVELADOR,
  OFICINA,
  PILARES_X,
  PILASTRAS_FACHADA_X,
  PUERTA_P,
  PUERTAS_IZQUIERDA,
  SALA_AZUL,
  VANOS,
  aEscena,
} from "./plano";
import { cajaPlano, punto3, tramos, type Caja } from "./geometria";
import { Instancias } from "./piezas";
import type { Paleta } from "./paleta";

const G = GROSOR_PARED;
const H = ALTURA_CORTE;

type EtiquetaProps = {
  x: number;
  y: number;
  altura?: number;
  children: ReactNode;
  tono?: "normal" | "suave" | "aviso";
  oculta?: boolean;
};

/** Rótulo fijo en pantalla anclado a un punto del plano. Queda por debajo de los botones (z-10). */
export function Etiqueta({ x, y, altura = 0.6, children, tono = "normal", oculta = false }: EtiquetaProps) {
  return (
    <Html position={punto3(x, y, altura)} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div
        className={cn(
          "whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-sm select-none transition-opacity duration-500",
          oculta ? "opacity-0" : "opacity-100",
          tono === "normal" && "bg-card/90 text-foreground ring-1 ring-border",
          tono === "suave" && "text-muted-foreground",
          tono === "aviso" && "bg-amber-50/90 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:ring-amber-800",
        )}
      >
        {children}
      </div>
    </Html>
  );
}

const linea = (puntos: [number, number][], altura = 0.03) => puntos.map(([x, y]) => punto3(x, y, altura));

type Props = {
  paleta: Paleta;
  referencias: boolean;
  /** Dentro de una zona: paredes casi transparentes y rótulos apagados para que nada tape. */
  modoZona: boolean;
};

export function Estructura({ paleta, referencias, modoZona }: Props) {
  const opPared = modoZona ? 0.12 : 1;
  const opPilar = modoZona ? 0.35 : 1;
  const sinRotulos = modoZona;
  const paredes = useMemo(() => {
    const c: Caja[] = [];
    // Pared izquierda, con sus dos puertas
    const puertas = PUERTAS_IZQUIERDA.map((p) => [p.y0, p.y1] as [number, number]);
    for (const [a, b] of tramos(0, NAVE.fondo, puertas)) c.push(cajaPlano(-G, a, 0, b, H));
    // Pared de abajo
    c.push(cajaPlano(-G, -G, NAVE.ancho + G, 0, H));
    // Pared de muelles, con un hueco por muelle y la puerta P
    const huecos: [number, number][] = [
      ...MUELLES.map((m) => [m.y - ANCHO_PUERTA_MUELLE / 2, m.y + ANCHO_PUERTA_MUELLE / 2] as [number, number]),
      [PUERTA_P.y - PUERTA_P.ancho / 2, PUERTA_P.y + PUERTA_P.ancho / 2],
    ];
    for (const [a, b] of tramos(0, NAVE.fondo, huecos)) c.push(cajaPlano(NAVE.ancho, a, NAVE.ancho + G, b, H));
    return c;
  }, []);

  // Tapa oscura sobre todo lo cortado: es lo que da el aspecto de maqueta seccionada.
  const cortes = useMemo(
    () => paredes.map((c): Caja => ({ p: [c.p[0], H + 0.02, c.p[2]], s: [c.s[0] + 0.01, 0.04, c.s[2] + 0.01] })),
    [paredes],
  );

  const pilares = useMemo(
    () => [
      ...PILARES_X.map((x) => cajaPlano(x - 0.3, FILA_PILARES_Y - 0.3, x + 0.3, FILA_PILARES_Y + 0.3, H)),
      ...PILASTRAS_FACHADA_X.map((x) => cajaPlano(x - 0.25, 0, x + 0.25, 0.45, H)),
    ],
    [],
  );

  const muelles = useMemo(() => {
    const niveladores: Caja[] = [];
    const bordes: Caja[] = [];
    const abrigos: Caja[] = [];
    const xa = NAVE.ancho + G;
    for (const m of MUELLES) {
      const { x0, largo, ancho } = NIVELADOR;
      niveladores.push(cajaPlano(x0, m.y - ancho / 2, x0 + largo, m.y + ancho / 2, 0.06));
      bordes.push(cajaPlano(x0, m.y - ancho / 2, x0 + 0.14, m.y + ancho / 2, 0.075));
      // Abrigo de muelle por fuera: dos laterales y el travesaño de arriba
      const a = ANCHO_PUERTA_MUELLE / 2 + 0.25;
      abrigos.push(cajaPlano(xa, m.y - a, xa + 0.7, m.y - a + 0.3, H));
      abrigos.push(cajaPlano(xa, m.y + a - 0.3, xa + 0.7, m.y + a, H));
      abrigos.push(cajaPlano(xa, m.y - a, xa + 0.7, m.y + a, 0.6, H - 0.6));
    }
    return { niveladores, bordes, abrigos };
  }, []);

  const sala = useMemo(() => {
    const { x0, y0, x1, y1, puerta } = SALA_AZUL;
    const e = 0.08;
    const c: Caja[] = [
      cajaPlano(x0 - e, y0, x0 + e, y1, 3),
      cajaPlano(x0, y0 - e, x1, y0 + e, 3),
      cajaPlano(x0, y1 - e, x1, y1 + e, 3),
    ];
    for (const [a, b] of tramos(y0, y1, [[puerta.y0, puerta.y1]])) c.push(cajaPlano(x1 - e, a, x1 + e, b, 3));
    return c;
  }, []);

  const oficina = useMemo(
    () => ({
      cuerpo: [cajaPlano(OFICINA.x0, OFICINA.y0, OFICINA.x1, OFICINA.y1, H)],
      tapa: [cajaPlano(OFICINA.x0, OFICINA.y0, OFICINA.x1, OFICINA.y1, 0.04, H)],
      mueble: [cajaPlano(MUEBLE.x0, MUEBLE.y0, MUEBLE.x1, MUEBLE.y1, 1.1)],
    }),
    [],
  );

  const [salaX, salaZ] = aEscena((SALA_AZUL.x0 + SALA_AZUL.x1) / 2, (SALA_AZUL.y0 + SALA_AZUL.y1) / 2);
  const patio = 400;

  return (
    <group>
      {/* Exterior y suelo de la nave */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[NAVE.ancho + patio * 2, NAVE.fondo + patio * 2]} />
        <meshStandardMaterial color={paleta.patio} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[NAVE.ancho, NAVE.fondo]} />
        <meshStandardMaterial color={paleta.suelo} roughness={0.95} />
      </mesh>

      <Instancias cajas={paredes} color={paleta.pared} opacidad={opPared} />
      <Instancias cajas={cortes} color={paleta.corte} sombras={false} opacidad={opPared} />
      <Instancias cajas={pilares} color={paleta.pilar} opacidad={opPilar} />

      {/* Muelles */}
      <Instancias cajas={muelles.niveladores} color={paleta.nivelador} />
      <Instancias cajas={muelles.bordes} color="#facc15" sombras={false} />
      <Instancias cajas={muelles.abrigos} color={paleta.abrigo} opacidad={opPared} />
      {MUELLES.map((m) => (
        <group key={m.nombre}>
          <Line points={linea([[NAVE.ancho + 1.1, m.y - 1.97], [NAVE.ancho + 14, m.y - 1.97]], 0.01)} color={paleta.marcaPatio} lineWidth={1.5} />
          <Etiqueta x={NAVE.ancho + 4.5} y={m.y} oculta={sinRotulos}>{m.nombre}</Etiqueta>
        </group>
      ))}
      <Etiqueta x={NAVE.ancho + 4.5} y={PUERTA_P.y} oculta={sinRotulos}>P</Etiqueta>

      {/* Bloque de oficina con escalera y el mueble de al lado */}
      <Instancias cajas={oficina.cuerpo} color={paleta.oficina} opacidad={opPared} />
      <Instancias cajas={oficina.tapa} color={paleta.corte} sombras={false} opacidad={opPared} />
      <Etiqueta x={(OFICINA.x0 + OFICINA.x1) / 2} y={(OFICINA.y0 + OFICINA.y1) / 2} altura={H + 0.6} oculta={sinRotulos}>
        Oficina · escalera
      </Etiqueta>
      <Instancias cajas={oficina.mueble} color={paleta.mueble} />
      <Etiqueta x={(MUEBLE.x0 + MUEBLE.x1) / 2} y={MUEBLE.y0 - 1.2} tono="aviso" oculta={sinRotulos}>
        Mueble (?)
      </Etiqueta>

      {/* Sala dibujada en azul: paredes de cristal */}
      <mesh rotation-x={-Math.PI / 2} position={[salaX, 0.012, salaZ]} raycast={() => null}>
        <planeGeometry args={[SALA_AZUL.x1 - SALA_AZUL.x0, SALA_AZUL.y1 - SALA_AZUL.y0]} />
        <meshBasicMaterial color={paleta.cristal} transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <Instancias cajas={sala} color={paleta.cristal} opacidad={modoZona ? 0.12 : 0.3} />
      <Etiqueta x={(SALA_AZUL.x0 + SALA_AZUL.x1) / 2} y={(SALA_AZUL.y0 + SALA_AZUL.y1) / 2} tono="aviso" oculta={sinRotulos}>
        Sala azul (?)
      </Etiqueta>

      {/* Contornos del plano por confirmar */}
      {CONTORNOS.map((c) => (
        <Line key={c.nombre} points={linea(c.puntos)} color={c.color} lineWidth={2} dashed dashSize={1.2} gapSize={0.7} />
      ))}

      {/* Borde superior del plano: la nave sigue por ahí */}
      <Line points={linea([[0, NAVE.fondo], [NAVE.ancho, NAVE.fondo]], 0.02)} color={paleta.pared} lineWidth={1.5} dashed dashSize={2} gapSize={1.2} />
      <Etiqueta x={NAVE.ancho / 2} y={NAVE.fondo + 2} tono="aviso" oculta={sinRotulos}>
        La nave sigue (?)
      </Etiqueta>

      {/* Cuadrícula de referencia del plano anotado */}
      {referencias && (
        <group>
          {PILARES_X.map((x) => (
            <Line key={`v${x}`} points={linea([[x, 0], [x, NAVE.fondo]], 0.015)} color={paleta.lineas} lineWidth={1} />
          ))}
          {FRANJAS.slice(1).map((f) => (
            <Line key={`f${f.numero}`} points={linea([[0, f.y1], [NAVE.ancho, f.y1]], 0.015)} color={paleta.lineas} lineWidth={1} />
          ))}
          {VANOS.map((v) => (
            <Etiqueta key={v.letra} x={(v.x0 + v.x1) / 2} y={-3} altura={0} tono="suave">
              <span className="text-sm">{v.letra}</span>
            </Etiqueta>
          ))}
          {FRANJAS.map((f) => (
            <Etiqueta key={f.numero} x={-3} y={(f.y0 + f.y1) / 2} altura={0} tono="suave">
              <span className="text-sm">{f.numero}</span>
            </Etiqueta>
          ))}
        </group>
      )}
    </group>
  );
}
