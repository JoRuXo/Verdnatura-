import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, Text, useCursor } from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import fuenteSuelo from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import { NAVE, aEscena, aPlano, type Rect } from "./plano";
import { punto3 } from "./geometria";
import { Instancias } from "./piezas";
import { useFundido } from "./fundido";
import { estanteriaBaldas, racksPalets } from "./estanterias";
import { marcoDe, type Marco } from "./marco";
import { PiezasPuesto } from "./Puestos";
import type { Elemento } from "./elementos";

/** Separación entre flechas y velocidad del flujo (metros, metros por segundo). */
const PASO_FLECHAS = 2.4;
const VELOCIDAD_FLUJO = 1.3;
/** Tamaño mínimo de un elemento al redimensionarlo (metros). */
const MINIMO = 0.4;
const REJILLA = 0.25;

let texturaFlechasBase: THREE.CanvasTexture | null = null;

/** Un chevrón blanco apuntando a +u; se tiñe con el color de la línea. */
function texturaFlechas() {
  if (texturaFlechasBase) return texturaFlechasBase;
  const lienzo = document.createElement("canvas");
  lienzo.width = 128;
  lienzo.height = 128;
  const g = lienzo.getContext("2d");
  if (g) {
    g.strokeStyle = "#ffffff";
    g.lineWidth = 20;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(42, 20);
    g.lineTo(86, 64);
    g.lineTo(42, 108);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(lienzo);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texturaFlechasBase = t;
  return t;
}

/** Giro en Y que lleva el +u local (a lo largo, en el sentido 1) a la escena. */
const giroDe = (eje: "x" | "y", sentido: number) => (eje === "x" ? (sentido < 0 ? Math.PI : 0) : sentido < 0 ? -Math.PI / 2 : Math.PI / 2);

export type Edicion = {
  seleccionado: boolean;
  rejilla: boolean;
  onSeleccionar: (id: string) => void;
  /** Guarda una foto del mapa para poder deshacer, justo antes de cambiarlo. */
  onEmpezarCambio: () => void;
  onCambiarArea: (id: string, area: Rect) => void;
};

type Props = {
  elemento: Elemento;
  /** Es la zona en la que está la cámara. */
  activa: boolean;
  /** Hay otra zona activa: esta se queda en segundo plano. */
  atenuada: boolean;
  flujos: boolean;
  /** Color del contorno de los nombres pintados (el del suelo). */
  contorno: string;
  onElegir: (clave: string) => void;
  /** Solo en modo edición. */
  edicion: Edicion | null;
  /** Rótulo fijo encima (p. ej. la cantidad de un artículo buscado). */
  marca?: string;
};

export function ElementoMapa({ elemento, activa, atenuada, flujos, contorno, onElegir, edicion, marca }: Props) {
  const [ratonEncima, setEncima] = useState(false);
  const esObjeto = elemento.tipo === "puesto";
  // Las líneas de flujo (y lo que no guarda artículos) solo se tocan en edición
  const interactivo = !!edicion || elemento.almacen;
  const encima = ratonEncima && interactivo;
  useCursor(encima && !activa, edicion ? "move" : "pointer");

  const { color } = elemento;
  const { x0, y0, x1, y1 } = elemento.area;
  const m = useMemo(() => marcoDe(elemento.area), [elemento.area]);
  const [cx, cz] = aEscena((x0 + x1) / 2, (y0 + y1) / 2);
  const arrastre = useArrastre(elemento, edicion);

  const base = useRef<THREE.MeshBasicMaterial>(null);
  // Los objetos ya se ven por sus piezas: el suelo solo marca la selección o el ratón encima
  const opacidadBase = esObjeto
    ? edicion
      ? encima || edicion.seleccionado ? 0.25 : 0.1
      : encima || activa
        ? 0.3
        : 0
    : atenuada
      ? 0.05
      : activa
        ? 0.3
        : encima
          ? 0.42
          : elemento.tipo === "estanteria"
            ? 0.1
            : 0.22;
  useFundido(base, opacidadBase, true);

  const eventos = interactivo
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setEncima(true);
        },
        onPointerOut: () => setEncima(false),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // En edición el clic selecciona (lo hace el arrastre); fuera, entra en la zona
          if (edicion || e.delta > 6) return;
          onElegir(elemento.clave);
        },
        ...(edicion ? arrastre.manejadores("mover") : {}),
      }
    : {};

  const borde = useMemo(
    () => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => punto3(x, y, 0.04)),
    [x0, y0, x1, y1],
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.02, cz]} {...eventos}>
        <planeGeometry args={[x1 - x0, y1 - y0]} />
        <meshBasicMaterial ref={base} color={color} toneMapped={false} />
      </mesh>

      {elemento.tipo === "linea" && (
        <>
          <BordesLinea m={m} color={color} grueso={activa} atenuada={atenuada} />
          {elemento.sentido && (
            <Flechas
              m={m}
              color={color}
              sentido={elemento.sentido}
              nombre={elemento.nombre}
              flujos={flujos}
              opacidad={atenuada ? 0.2 : 0.9}
            />
          )}
        </>
      )}
      {(elemento.tipo === "area" || elemento.tipo === "estanteria") && (
        <Line points={borde} color={color} lineWidth={activa || encima ? 2.5 : 1.5} transparent opacity={atenuada ? 0.25 : 1} />
      )}
      {elemento.tipo === "estanteria" && <EstanteriaElemento elemento={elemento} opacidad={atenuada ? 0.3 : 1} />}
      {/* Con marca, su rótulo ya lleva el nombre: el fijo del objeto sobra */}
      {esObjeto && <PiezasPuesto elemento={elemento} opacidad={atenuada ? 0.35 : 1} oculta={atenuada || !!marca} />}

      {!esObjeto && (
        <NombreSuelo elemento={elemento} m={m} contorno={contorno} atenuado={atenuada} eventos={eventos} />
      )}

      {/* De lejos el nombre del suelo no se lee: al pasar por encima sale un rótulo (los objetos ya llevan el suyo) */}
      {encima && !activa && !esObjeto && (
        <Html position={[cx, 1.6, cz]} center zIndexRange={[8, 6]} style={{ pointerEvents: "none" }}>
          <div
            className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg ring-2 ring-white/70 animate-in fade-in zoom-in-95 duration-200"
            style={{ backgroundColor: color }}
          >
            {elemento.nombre}
          </div>
        </Html>
      )}

      {marca && (
        <Html position={[cx, 2.6, cz]} center zIndexRange={[9, 7]} style={{ pointerEvents: "none" }}>
          <div
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg ring-2 ring-white animate-in fade-in zoom-in-75 duration-500"
            style={{ backgroundColor: color }}
          >
            {elemento.nombre}
            <span className="rounded-full bg-white/25 px-1.5 tabular-nums">{marca}</span>
          </div>
        </Html>
      )}

      {edicion?.seleccionado && <Seleccion elemento={elemento} borde={borde} arrastre={arrastre} />}
    </group>
  );
}

const SUELO = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const puntoEnSuelo = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
  const p = new THREE.Vector3();
  return e.ray.intersectPlane(SUELO, p) ? aPlano(p.x, p.z) : null;
};
const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** "mover", una esquina (0–3) o un lado (4 = x0, 5 = x1, 6 = y0, 7 = y1). */
type Modo = "mover" | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Capturable = { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };

/**
 * Arrastrar el elemento entero, una esquina (0 = x0,y0 · 1 = x1,y0 · 2 = x1,y1 ·
 * 3 = x0,y1) o un lado (cambia solo una medida) sobre el suelo, con la cámara
 * quieta mientras tanto.
 */
function useArrastre(elemento: Elemento, edicion: Edicion | null) {
  const controles = useThree((s) => s.controls) as CameraControlsImpl | null;
  const estado = useRef<{ modo: Modo; inicio: [number, number]; area: Rect; movido: boolean } | null>(null);
  const ajustar = (v: number) => (edicion?.rejilla ? Math.round(v / REJILLA) * REJILLA : Math.round(v * 100) / 100);

  const terminar = (e: ThreeEvent<PointerEvent>) => {
    if (!estado.current) return;
    estado.current = null;
    if (controles) controles.enabled = true;
    try {
      (e.target as unknown as Capturable).releasePointerCapture(e.pointerId);
    } catch {
      // ya estaba liberado
    }
  };

  const manejadores = (modo: Modo) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (!edicion || e.button !== 0) return;
      e.stopPropagation();
      edicion.onSeleccionar(elemento.id);
      const p = puntoEnSuelo(e);
      if (!p) return;
      estado.current = { modo, inicio: p, area: elemento.area, movido: false };
      if (controles) controles.enabled = false;
      (e.target as unknown as Capturable).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const s = estado.current;
      if (!s || !edicion) return;
      e.stopPropagation();
      const p = puntoEnSuelo(e);
      if (!p) return;
      if (!s.movido) {
        // La foto para deshacer se toma solo si de verdad se mueve algo
        edicion.onEmpezarCambio();
        s.movido = true;
      }
      const a = s.area;
      let area: Rect;
      if (s.modo === "mover") {
        const ancho = a.x1 - a.x0;
        const fondo = a.y1 - a.y0;
        const nx = limitar(ajustar(a.x0 + p[0] - s.inicio[0]), 0, NAVE.ancho - ancho);
        const ny = limitar(ajustar(a.y0 + p[1] - s.inicio[1]), 0, NAVE.fondo - fondo);
        area = { x0: nx, y0: ny, x1: nx + ancho, y1: ny + fondo };
      } else {
        const px = limitar(ajustar(p[0]), 0, NAVE.ancho);
        const py = limitar(ajustar(p[1]), 0, NAVE.fondo);
        let { x0, y0, x1, y1 } = a;
        const mueveX0 = s.modo === 0 || s.modo === 3 || s.modo === 4;
        const mueveX1 = s.modo === 1 || s.modo === 2 || s.modo === 5;
        const mueveY0 = s.modo === 0 || s.modo === 1 || s.modo === 6;
        const mueveY1 = s.modo === 2 || s.modo === 3 || s.modo === 7;
        if (mueveX0) x0 = Math.min(px, x1 - MINIMO);
        if (mueveX1) x1 = Math.max(px, x0 + MINIMO);
        if (mueveY0) y0 = Math.min(py, y1 - MINIMO);
        if (mueveY1) y1 = Math.max(py, y0 + MINIMO);
        area = { x0, y0, x1, y1 };
      }
      edicion.onCambiarArea(elemento.id, area);
    },
    onPointerUp: terminar,
    onPointerCancel: terminar,
  });

  // Si el componente desaparece a mitad de arrastre, la cámara vuelve a funcionar
  useEffect(
    () => () => {
      if (estado.current && controles) controles.enabled = true;
    },
    [controles],
  );

  return { manejadores };
}

/** Contorno de selección y tiradores de las cuatro esquinas. */
function Seleccion({
  elemento,
  borde,
  arrastre,
}: {
  elemento: Elemento;
  borde: [number, number, number][];
  arrastre: ReturnType<typeof useArrastre>;
}) {
  const { x0, y0, x1, y1 } = elemento.area;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // Esquinas: cambian largo y ancho a la vez. Lados: solo una medida (alargar una línea sin estrecharla).
  const tiradores: { x: number; y: number; modo: Modo; cursor: string; lado: boolean }[] = [
    { x: x0, y: y0, modo: 0, cursor: "nesw-resize", lado: false },
    { x: x1, y: y0, modo: 1, cursor: "nwse-resize", lado: false },
    { x: x1, y: y1, modo: 2, cursor: "nesw-resize", lado: false },
    { x: x0, y: y1, modo: 3, cursor: "nwse-resize", lado: false },
    { x: x0, y: cy, modo: 4, cursor: "ew-resize", lado: true },
    { x: x1, y: cy, modo: 5, cursor: "ew-resize", lado: true },
    { x: cx, y: y0, modo: 6, cursor: "ns-resize", lado: true },
    { x: cx, y: y1, modo: 7, cursor: "ns-resize", lado: true },
  ];
  return (
    <group>
      <Line points={borde.map(([x, , z]) => [x, 0.07, z] as [number, number, number])} color="#ffffff" lineWidth={5} />
      <Line points={borde.map(([x, , z]) => [x, 0.08, z] as [number, number, number])} color="#0f172a" lineWidth={2} dashed dashSize={0.5} gapSize={0.3} />
      {tiradores.map((t) => (
        <Tirador key={String(t.modo)} x={t.x} y={t.y} cursor={t.cursor} lado={t.lado} manejadores={arrastre.manejadores(t.modo)} />
      ))}
    </group>
  );
}

function Tirador({
  x,
  y,
  cursor,
  lado,
  manejadores,
}: {
  x: number;
  y: number;
  cursor: string;
  lado: boolean;
  manejadores: ReturnType<ReturnType<typeof useArrastre>["manejadores"]>;
}) {
  const [encima, setEncima] = useState(false);
  useCursor(encima, cursor);
  const t = lado ? 0.42 : 0.55;
  return (
    <mesh
      position={punto3(x, y, 0.2)}
      onPointerOver={(e) => {
        e.stopPropagation();
        setEncima(true);
      }}
      onPointerOut={() => setEncima(false)}
      {...manejadores}
    >
      {lado ? <cylinderGeometry args={[t / 2, t / 2, 0.3, 16]} /> : <boxGeometry args={[t, 0.3, t]} />}
      <meshBasicMaterial color={encima ? "#2563eb" : "#ffffff"} toneMapped={false} />
    </mesh>
  );
}

function BordesLinea({ m, color, grueso, atenuada }: { m: Marco; color: string; grueso: boolean; atenuada: boolean }) {
  const lados = useMemo(
    () =>
      [0, m.ancho].map((v) => [m.aPlano(0, v), m.aPlano(m.largo, v)].map(([x, y]) => punto3(x, y, 0.04))),
    [m],
  );
  return (
    <>
      {lados.map((puntos, i) => (
        <Line key={i} points={puntos} color={color} lineWidth={grueso ? 2.5 : 1.5} transparent opacity={atenuada ? 0.25 : 1} />
      ))}
    </>
  );
}

const tamanoNombre = (m: Marco) => Math.min(0.85, m.ancho * 0.68);
const largoNombre = (m: Marco, nombre: string) => tamanoNombre(m) * 0.6 * nombre.length;

type FlechasProps = { m: Marco; color: string; sentido: 1 | -1; nombre: string; flujos: boolean; opacidad: number };

/** Chevrones que avanzan a lo largo de la línea en el sentido del producto. */
function Flechas({ m, color, sentido, nombre, flujos, opacidad }: FlechasProps) {
  // El nombre va al principio de la línea (según el sentido); las flechas, en el resto
  const hueco = 0.6 + largoNombre(m, nombre) + 0.8;
  const desde = sentido > 0 ? hueco : 0.4;
  const hasta = sentido > 0 ? m.largo - 0.4 : m.largo - hueco;
  const largo = Math.max(hasta - desde, PASO_FLECHAS);
  const [px, py] = m.aPlano((desde + hasta) / 2, m.ancho / 2);
  const [cx, cz] = aEscena(px, py);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFundido(material, opacidad, true);

  const textura = useMemo(() => {
    const t = texturaFlechas().clone();
    t.repeat.set(largo / PASO_FLECHAS, 1);
    t.needsUpdate = true;
    return t;
  }, [largo]);
  useEffect(() => () => textura.dispose(), [textura]);

  useFrame((estado, delta) => {
    if (!flujos) return;
    // Mover la textura hacia -u hace que las flechas avancen hacia +u
    textura.offset.x = (textura.offset.x - (delta * VELOCIDAD_FLUJO) / PASO_FLECHAS) % 1;
    estado.invalidate();
  });

  return (
    <group position={[cx, 0.035, cz]} rotation-y={giroDe(m.eje, sentido)}>
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[largo, m.ancho * 0.7]} />
        <meshBasicMaterial ref={material} map={textura} color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

type NombreProps = {
  elemento: Elemento;
  m: Marco;
  contorno: string;
  atenuado: boolean;
  eventos: object;
};

/** Nombre pintado en el suelo, a lo largo del elemento, como una marca real del almacén. */
function NombreSuelo({ elemento, m, contorno, atenuado, eventos }: NombreProps) {
  const tamano = tamanoNombre(m);
  let u = m.largo / 2;
  let v = m.ancho / 2;
  let ancla: "left" | "right" | "center" = "center";
  if (elemento.tipo === "linea" && elemento.sentido) {
    u = elemento.sentido > 0 ? 0.6 : m.largo - 0.6;
    ancla = elemento.sentido > 0 ? "left" : "right";
  } else if (elemento.tipo === "estanteria") {
    // Delante de la estantería, por el lado que quede dentro de la nave
    u = 0;
    ancla = "left";
    const [, yDelante] = m.aPlano(0, -0.6);
    const [xDelante] = m.aPlano(0, -0.6);
    const fuera = yDelante < 0.3 || xDelante > NAVE.ancho - 0.3 || xDelante < 0.3;
    v = fuera ? m.ancho + 0.6 : -0.6;
  }
  const [px, py] = m.aPlano(u, v);
  const [nx, nz] = aEscena(px, py);
  return (
    <Suspense fallback={null}>
      <Text
        font={fuenteSuelo}
        fontSize={elemento.tipo === "estanteria" ? 0.7 : tamano}
        color={elemento.color}
        anchorX={ancla}
        anchorY="middle"
        rotation={m.eje === "x" ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, Math.PI / 2]}
        position={[nx, 0.05, nz]}
        outlineWidth={tamano * 0.07}
        outlineColor={contorno}
        fillOpacity={atenuado ? 0.3 : 1}
        outlineOpacity={atenuado ? 0.3 : 1}
        {...eventos}
      >
        {elemento.nombre}
      </Text>
    </Suspense>
  );
}

function EstanteriaElemento({ elemento, opacidad }: { elemento: Elemento; opacidad: number }) {
  const piezas = useMemo(
    () => (elemento.modelo === "pared" ? estanteriaBaldas(elemento.area) : racksPalets(elemento.area)),
    [elemento.modelo, elemento.area],
  );
  return (
    <group>
      <Instancias cajas={piezas.montantes} color={piezas.colores.montante} opacidad={opacidad} />
      <Instancias cajas={piezas.largueros} color={piezas.colores.larguero} opacidad={opacidad} />
      {piezas.palets.length > 0 && <Instancias cajas={piezas.palets} color={piezas.colores.palet} opacidad={opacidad} />}
      <Instancias cajas={piezas.cargas} color={piezas.colores.carga} opacidad={opacidad} />
    </group>
  );
}
