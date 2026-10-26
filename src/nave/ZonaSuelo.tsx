import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, Text, useCursor } from "@react-three/drei";
import fuenteSuelo from "@fontsource/inter/files/inter-latin-700-normal.woff?url";
import { aEscena } from "./plano";
import { punto3 } from "./geometria";
import { Instancias } from "./piezas";
import { useFundido } from "./fundido";
import { estanteriaPared, racksCarton } from "./estanterias";
import { colorDe, type Zona } from "./zonas";

/** Separación entre flechas y velocidad del flujo (metros, metros por segundo). */
const PASO_FLECHAS = 2.4;
const VELOCIDAD_FLUJO = 1.3;

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

type Props = {
  zona: Zona;
  /** Es la zona en la que está la cámara. */
  activa: boolean;
  /** Hay otra zona activa: esta se queda en segundo plano. */
  atenuada: boolean;
  flujos: boolean;
  /** Color del contorno de los nombres pintados (el del suelo). */
  contorno: string;
  onElegir: (id: string) => void;
};

export function ZonaSuelo({ zona, activa, atenuada, flujos, contorno, onElegir }: Props) {
  const [encima, setEncima] = useState(false);
  useCursor(encima && !activa);

  const color = colorDe(zona);
  const { x0, y0, x1, y1 } = zona.area;
  const largo = x1 - x0;
  const ancho = y1 - y0;
  const [cx, cz] = aEscena((x0 + x1) / 2, (y0 + y1) / 2);

  const base = useRef<THREE.MeshBasicMaterial>(null);
  useFundido(base, atenuada ? 0.05 : activa ? 0.3 : encima ? 0.42 : zona.tipo === "estanteria" ? 0.1 : 0.22, true);

  const eventos = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setEncima(true);
    },
    onPointerOut: () => setEncima(false),
    onClick: (e: ThreeEvent<MouseEvent>) => {
      // Un arrastre para mover el mapa no cuenta como clic
      if (e.delta > 6) return;
      e.stopPropagation();
      onElegir(zona.id);
    },
  };

  const borde = useMemo(
    () => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => punto3(x, y, 0.04)),
    [x0, y0, x1, y1],
  );

  // Nombre pintado en el suelo: al principio de la línea, según el sentido del flujo
  const tamanoNombre = Math.min(0.85, ancho * 0.68);
  const largoNombre = tamanoNombre * 0.6 * zona.nombre.length;
  const nombreAlFinal = zona.sentido === "puertas";
  const nombreEn: { x: number; y: number; anclaX: "left" | "right" | "center" } =
    zona.tipo === "linea"
      ? zona.sentido
        ? { x: nombreAlFinal ? x1 - 0.6 : x0 + 0.6, y: (y0 + y1) / 2, anclaX: nombreAlFinal ? "right" : "left" }
        : { x: (x0 + x1) / 2, y: (y0 + y1) / 2, anclaX: "center" }
      : zona.tipo === "estanteria"
        ? { x: x0, y: y0 < 2 ? y1 + 0.6 : y0 - 0.6, anclaX: "left" }
        : { x: (x0 + x1) / 2, y: (y0 + y1) / 2, anclaX: "center" };
  const [nx, nz] = aEscena(nombreEn.x, nombreEn.y);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.02, cz]} {...eventos}>
        <planeGeometry args={[largo, ancho]} />
        <meshBasicMaterial ref={base} color={color} toneMapped={false} />
      </mesh>

      {zona.tipo === "linea" ? (
        <>
          <Line points={[borde[0], borde[1]]} color={color} lineWidth={activa ? 2.5 : 1.5} transparent opacity={atenuada ? 0.25 : 1} />
          <Line points={[borde[2], borde[3]]} color={color} lineWidth={activa ? 2.5 : 1.5} transparent opacity={atenuada ? 0.25 : 1} />
        </>
      ) : (
        <Line points={borde} color={color} lineWidth={activa || encima ? 2.5 : 1.5} transparent opacity={atenuada ? 0.25 : 1} />
      )}

      {zona.tipo === "linea" && zona.sentido && (
        <Flechas
          zona={zona}
          color={color}
          desde={nombreAlFinal ? x0 + 0.4 : x0 + 0.6 + largoNombre + 0.8}
          hasta={nombreAlFinal ? x1 - 0.6 - largoNombre - 0.8 : x1 - 0.4}
          flujos={flujos}
          opacidad={atenuada ? 0.2 : 0.9}
        />
      )}

      {zona.tipo === "estanteria" && <EstanteriaZona zona={zona} opacidad={atenuada ? 0.3 : 1} />}

      <Suspense fallback={null}>
        <Text
          font={fuenteSuelo}
          fontSize={tamanoNombre}
          color={color}
          anchorX={nombreEn.anclaX}
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[nx, 0.05, nz]}
          outlineWidth={tamanoNombre * 0.07}
          outlineColor={contorno}
          fillOpacity={atenuada ? 0.3 : 1}
          outlineOpacity={atenuada ? 0.3 : 1}
          {...eventos}
        >
          {zona.nombre}
        </Text>
      </Suspense>

      {/* De lejos el nombre del suelo no se lee: al pasar por encima sale un rótulo */}
      {encima && !activa && (
        <Html position={[cx, 1.6, cz]} center zIndexRange={[8, 6]} style={{ pointerEvents: "none" }}>
          <div
            className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg ring-2 ring-white/70 animate-in fade-in zoom-in-95 duration-200"
            style={{ backgroundColor: color }}
          >
            {zona.nombre}
          </div>
        </Html>
      )}
    </group>
  );
}

type FlechasProps = {
  zona: Zona;
  color: string;
  desde: number;
  hasta: number;
  flujos: boolean;
  opacidad: number;
};

/** Chevrones que avanzan a lo largo de la línea en el sentido del producto. */
function Flechas({ zona, color, desde, hasta, flujos, opacidad }: FlechasProps) {
  const largo = Math.max(hasta - desde, PASO_FLECHAS);
  const ancho = (zona.area.y1 - zona.area.y0) * 0.7;
  const [cx, cz] = aEscena((desde + hasta) / 2, (zona.area.y0 + zona.area.y1) / 2);
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
    // Hacia las puertas se gira 180°: la textura siempre apunta a +u
    <group position={[cx, 0.035, cz]} rotation-y={zona.sentido === "puertas" ? Math.PI : 0}>
      <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[largo, ancho]} />
        <meshBasicMaterial ref={material} map={textura} color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function EstanteriaZona({ zona, opacidad }: { zona: Zona; opacidad: number }) {
  const piezas = useMemo(
    () => (zona.estanteria === "pared" ? estanteriaPared(zona.area) : racksCarton(zona.area)),
    [zona],
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
