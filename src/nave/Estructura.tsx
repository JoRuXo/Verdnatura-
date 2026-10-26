import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { cn } from "@/lib/utils";
import {
  ALTURA_CORTE,
  ANCHO_PUERTA_MUELLE,
  AREA_PROPIA,
  CAMARA_FRIGORIFICA,
  FILA_PILARES_Y,
  FRANJAS,
  GROSOR_PARED,
  LIMITE,
  MUELLES,
  NAVE,
  NIVELADOR,
  OFICINA,
  OFICINA_PEQUENA,
  PILARES_X,
  PILASTRAS_FACHADA_X,
  PUERTA_P,
  PUERTAS_IZQUIERDA,
  VANOS,
  aEscena,
  alturaPropia,
  finPropio,
  inicioPropio,
} from "./plano";
import { cajaPlano, punto3, tramos, type Caja } from "./geometria";
import { Instancias } from "./piezas";
import type { Paleta } from "./paleta";

const G = GROSOR_PARED;
const H = ALTURA_CORTE;
const COLOR_LIMITE = "#ef4444";

type EtiquetaProps = {
  x: number;
  y: number;
  altura?: number;
  children: ReactNode;
  tono?: "normal" | "suave";
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
        )}
      >
        {children}
      </div>
    </Html>
  );
}

const linea = (puntos: [number, number][], altura = 0.03) => puntos.map(([x, y]) => punto3(x, y, altura));

/** Volumen cortado a la altura de la maqueta: cuerpo más tapa oscura. */
const volumen = (r: { x0: number; y0: number; x1: number; y1: number }) => ({
  cuerpo: cajaPlano(r.x0, r.y0, r.x1, r.y1, H),
  tapa: cajaPlano(r.x0, r.y0, r.x1, r.y1, 0.04, H),
});

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

  // Solo se dibuja la parte de Verdnatura: el suelo sigue el contorno del límite
  const suelo = useMemo(() => {
    const forma = new THREE.Shape(
      AREA_PROPIA.map(([x, y]) => new THREE.Vector2(x - NAVE.ancho / 2, y - NAVE.fondo / 2)),
    );
    return new THREE.ShapeGeometry(forma);
  }, []);

  const paredes = useMemo(() => {
    const c: Caja[] = [];
    const finIzquierda = LIMITE[0][1];
    const finMuelles = LIMITE[LIMITE.length - 1][1];
    // Pared izquierda (solo nuestro tramo), con sus puertas
    const puertas = PUERTAS_IZQUIERDA.map((p) => [p.y0, p.y1] as [number, number]);
    for (const [a, b] of tramos(0, finIzquierda, puertas)) c.push(cajaPlano(-G, a, 0, b, H));
    // Pared de abajo
    c.push(cajaPlano(-G, -G, NAVE.ancho + G, 0, H));
    // Pared de muelles (solo nuestro tramo), con un hueco por muelle y la puerta P
    const huecos: [number, number][] = [
      ...MUELLES.map((m) => [m.y - ANCHO_PUERTA_MUELLE / 2, m.y + ANCHO_PUERTA_MUELLE / 2] as [number, number]),
      [PUERTA_P.y - PUERTA_P.ancho / 2, PUERTA_P.y + PUERTA_P.ancho / 2],
    ];
    for (const [a, b] of tramos(0, finMuelles, huecos)) c.push(cajaPlano(NAVE.ancho, a, NAVE.ancho + G, b, H));
    return c;
  }, []);

  // Tapa oscura sobre todo lo cortado: es lo que da el aspecto de maqueta seccionada.
  const cortes = useMemo(
    () => paredes.map((c): Caja => ({ p: [c.p[0], H + 0.02, c.p[2]], s: [c.s[0] + 0.01, 0.04, c.s[2] + 0.01] })),
    [paredes],
  );

  const pilares = useMemo(
    () => [
      ...PILARES_X.filter((x) => alturaPropia(x) > FILA_PILARES_Y).map((x) =>
        cajaPlano(x - 0.3, FILA_PILARES_Y - 0.3, x + 0.3, FILA_PILARES_Y + 0.3, H),
      ),
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

  const camara = useMemo(() => {
    const { x0, y0, x1, y1, puerta } = CAMARA_FRIGORIFICA;
    const e = 0.08;
    const c: Caja[] = [
      cajaPlano(x0 - e, y0, x0 + e, y1, 3),
      cajaPlano(x0, y0 - e, x1, y0 + e, 3),
      cajaPlano(x0, y1 - e, x1, y1 + e, 3),
    ];
    for (const [a, b] of tramos(y0, y1, [[puerta.y0, puerta.y1]])) c.push(cajaPlano(x1 - e, a, x1 + e, b, 3));
    return c;
  }, []);

  const oficinas = useMemo(() => {
    const grande = volumen(OFICINA);
    const pequena = volumen(OFICINA_PEQUENA);
    return { cuerpos: [grande.cuerpo, pequena.cuerpo], tapas: [grande.tapa, pequena.tapa] };
  }, []);

  const centro = (r: { x0: number; y0: number; x1: number; y1: number }) => ({
    x: (r.x0 + r.x1) / 2,
    y: (r.y0 + r.y1) / 2,
  });
  const cCamara = centro(CAMARA_FRIGORIFICA);
  const [camaraX, camaraZ] = aEscena(cCamara.x, cCamara.y);
  const patio = 400;

  return (
    <group>
      {/* Exterior y suelo propio */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[NAVE.ancho + patio * 2, NAVE.fondo + patio * 2]} />
        <meshStandardMaterial color={paleta.patio} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} geometry={suelo} receiveShadow raycast={() => null}>
        <meshStandardMaterial color={paleta.suelo} roughness={0.95} />
      </mesh>

      <Instancias cajas={paredes} color={paleta.pared} opacidad={opPared} />
      <Instancias cajas={cortes} color={paleta.corte} sombras={false} opacidad={opPared} />
      <Instancias cajas={pilares} color={paleta.pilar} opacidad={opPilar} />

      {/* Límite con las otras empresas */}
      <Line points={linea(LIMITE, 0.04)} color={COLOR_LIMITE} lineWidth={2.5} dashed dashSize={1.2} gapSize={0.7} />

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

      {/* Oficinas: el bloque con escalera y la pequeña de al lado */}
      <Instancias cajas={oficinas.cuerpos} color={paleta.oficina} opacidad={opPared} />
      <Instancias cajas={oficinas.tapas} color={paleta.corte} sombras={false} opacidad={opPared} />
      <Etiqueta x={centro(OFICINA).x} y={centro(OFICINA).y} altura={H + 0.6} oculta={sinRotulos}>
        Oficina · escalera
      </Etiqueta>
      <Etiqueta x={centro(OFICINA_PEQUENA).x} y={OFICINA_PEQUENA.y0 - 1.2} oculta={sinRotulos}>
        Oficina
      </Etiqueta>

      {/* Cámara frigorífica: paredes translúcidas para ver dentro */}
      <mesh rotation-x={-Math.PI / 2} position={[camaraX, 0.012, camaraZ]} raycast={() => null}>
        <planeGeometry args={[CAMARA_FRIGORIFICA.x1 - CAMARA_FRIGORIFICA.x0, CAMARA_FRIGORIFICA.y1 - CAMARA_FRIGORIFICA.y0]} />
        <meshBasicMaterial color={paleta.camara} transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <Instancias cajas={camara} color={paleta.camara} opacidad={modoZona ? 0.12 : 0.3} />
      <Etiqueta x={cCamara.x} y={cCamara.y} oculta={sinRotulos}>
        Cámara frigorífica
      </Etiqueta>

      {/* Cuadrícula de referencia del plano anotado, recortada a la parte propia */}
      {referencias && (
        <group>
          {PILARES_X.map((x) => (
            <Line key={`v${x}`} points={linea([[x, 0], [x, alturaPropia(x)]], 0.015)} color={paleta.lineas} lineWidth={1} />
          ))}
          {FRANJAS.slice(1).map((f) => (
            <Line
              key={`f${f.numero}`}
              points={linea([[inicioPropio(f.y1), f.y1], [finPropio(f.y1), f.y1]], 0.015)}
              color={paleta.lineas}
              lineWidth={1}
            />
          ))}
          {VANOS.map((v) => (
            <Etiqueta key={v.letra} x={(v.x0 + v.x1) / 2} y={-3} altura={0} tono="suave">
              <span className="text-sm">{v.letra}</span>
            </Etiqueta>
          ))}
          {FRANJAS.map((f) => {
            const y = (f.y0 + Math.min(f.y1, LIMITE[2][1])) / 2;
            return (
              <Etiqueta key={f.numero} x={inicioPropio(y) - 3} y={y} altura={0} tono="suave">
                <span className="text-sm">{f.numero}</span>
              </Etiqueta>
            );
          })}
        </group>
      )}
    </group>
  );
}
