import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import { Estructura } from "./Estructura";
import { ZonaSuelo } from "./ZonaSuelo";
import { Puestos } from "./Puestos";
import { esGamaLigera } from "./dispositivo";
import { ZONAS, type Zona } from "./zonas";
import { ALTURA_CORTE, NAVE, aEscena } from "./plano";
import { PALETA_CLARA, PALETA_OSCURA } from "./paleta";

const FOV = 40;
const { ACTION } = CameraControlsImpl;
const grados = THREE.MathUtils.degToRad;

/** Vista general: toda la nave más los rótulos de fuera (muelles, letras de vanos). */
const GENERAL = { centro: [1, 0.8] as [number, number], ancho: NAVE.ancho + 22, fondo: NAVE.fondo + 10 };

/** Espacio que tapa el panel de zona: a la derecha en pantallas anchas, abajo en móvil. */
const PANEL = { ancho: 352, alto: 300, corte: 640 };

type Hueco = { aspecto: number; fraccionAncho: number; fraccionAlto: number };

/**
 * Coloca la cámara para que un rectángulo del suelo quepa en el hueco libre de la
 * pantalla (una fracción del ancho y del alto), mirándolo con una inclinación
 * (polar, desde la vertical) y una orientación (azimut) dadas.
 * Devuelve la distancia a la que queda la cámara.
 */
function encuadrar(
  c: CameraControlsImpl,
  hueco: Hueco,
  centro: [number, number],
  ancho: number,
  fondo: number,
  polar: number,
  azimut: number,
  transicion: boolean,
  margen = 1.1,
) {
  const tanV = Math.tan(grados(FOV) / 2);
  const mitadV = Math.atan(tanV * hueco.fraccionAlto);
  const mitadH = Math.atan(tanV * hueco.aspecto * hueco.fraccionAncho);
  const extH = Math.abs(ancho * Math.cos(azimut)) + Math.abs(fondo * Math.sin(azimut));
  const extF = Math.abs(ancho * Math.sin(azimut)) + Math.abs(fondo * Math.cos(azimut));
  const vertical = extF * Math.cos(polar) + ALTURA_CORTE * Math.sin(polar);
  // El borde cercano está más cerca de la cámara y la perspectiva lo agranda:
  // se retrocede media profundidad proyectada para que también quepa.
  const distancia =
    (Math.max(extH / 2 / Math.tan(mitadH), vertical / 2 / Math.tan(mitadV)) + (extF / 2) * Math.sin(polar)) * margen;
  const [x, z] = centro;
  c.setLookAt(
    x + distancia * Math.sin(polar) * Math.sin(azimut),
    distancia * Math.cos(polar),
    z + distancia * Math.sin(polar) * Math.cos(azimut),
    x,
    0,
    z,
    transicion,
  );
  return distancia;
}

type CamaraProps = { zona?: Zona; vistaKey: number };

function Camara({ zona, vistaKey }: CamaraProps) {
  const ref = useRef<CameraControlsImpl>(null);
  const size = useThree((s) => s.size);
  const aspecto = size.width / size.height;
  const invalidate = useThree((s) => s.invalidate);
  // En pantallas verticales (móvil) la nave se gira para que el lado largo quede de arriba abajo
  const vertical = aspecto < 0.9;
  const azimutBase = vertical ? -Math.PI / 2 : 0;
  const iniciada = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // Manejo tipo mapa: arrastrar mueve, clic derecho / dos dedos giran, rueda / pellizco acercan
    c.mouseButtons.left = ACTION.TRUCK;
    c.mouseButtons.middle = ACTION.DOLLY;
    c.mouseButtons.right = ACTION.ROTATE;
    c.mouseButtons.wheel = ACTION.DOLLY;
    c.touches.one = ACTION.TOUCH_TRUCK;
    c.touches.two = ACTION.TOUCH_DOLLY_ROTATE;
    c.touches.three = ACTION.TOUCH_ROTATE;
    c.dollyToCursor = true;
    c.setBoundary(
      new THREE.Box3(
        new THREE.Vector3(-NAVE.ancho / 2 - 15, -1, -NAVE.fondo / 2 - 15),
        new THREE.Vector3(NAVE.ancho / 2 + 20, 30, NAVE.fondo / 2 + 15),
      ),
    );
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;

    const pantallaEntera: Hueco = { aspecto, fraccionAncho: 1, fraccionAlto: 1 };

    if (!iniciada.current) {
      // Entrada: arranca casi cenital y alto, y baja planeando hasta su sitio
      iniciada.current = true;
      encuadrar(c, pantallaEntera, GENERAL.centro, GENERAL.ancho, GENERAL.fondo, grados(2), azimutBase, false, 2.2);
    }

    if (zona) {
      const { x0, y0, x1, y1 } = zona.area;
      // La zona se encuadra en el hueco que deja libre el panel, no en toda la pantalla
      const panelDerecha = size.width >= PANEL.corte;
      const libreAncho = panelDerecha ? size.width - PANEL.ancho : size.width;
      const libreAlto = panelDerecha ? size.height : Math.max(size.height - PANEL.alto, size.height * 0.45);
      const distancia = encuadrar(
        c,
        { aspecto, fraccionAncho: libreAncho / size.width, fraccionAlto: libreAlto / size.height },
        aEscena((x0 + x1) / 2, (y0 + y1) / 2),
        // Las líneas son estrechas: se encuadra al menos un cuadro de 8 m para ver su entorno
        Math.max(x1 - x0, 8),
        Math.max(y1 - y0, 8),
        grados(46),
        // Al entrar se respeta hacia dónde estaba mirando la persona
        c.azimuthAngle,
        true,
        1.2,
      );
      // Desplaza la imagen hacia el hueco libre (izquierda en escritorio, arriba en móvil).
      // En camera-controls la x positiva mueve la cámara a la derecha y la y positiva la
      // baja (sentido de pantalla), así que ambas empujan la imagen hacia el hueco.
      const altoVisible = 2 * distancia * Math.tan(grados(FOV) / 2);
      const anchoVisible = altoVisible * aspecto;
      c.setFocalOffset(
        panelDerecha ? ((size.width - libreAncho) / 2 / size.width) * anchoVisible : 0,
        panelDerecha ? 0 : ((size.height - libreAlto) / 2 / size.height) * altoVisible,
        0,
        true,
      );
    } else {
      encuadrar(c, pantallaEntera, GENERAL.centro, GENERAL.ancho, GENERAL.fondo, grados(38), azimutBase, true, 1.0);
      c.setFocalOffset(0, 0, 0, true);
    }
    // Con frameloop="demand" hay que pedir el primer fotograma; a partir de ahí
    // los propios controles siguen pidiendo fotogramas mientras dura la transición.
    invalidate();
    // aspecto cambia en cada redimensión; solo se re-encuadra al cambiar de orientación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona?.id, vistaKey, vertical]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.7}
      draggingSmoothTime={0.12}
      minDistance={5}
      maxDistance={260}
      minPolarAngle={0}
      maxPolarAngle={grados(72)}
    />
  );
}

export type EscenaNaveProps = {
  zona?: Zona;
  oscuro: boolean;
  referencias: boolean;
  /** Flechas de las líneas en movimiento (pide fotogramas sin parar mientras está activo). */
  flujos: boolean;
  vistaKey: number;
  onElegirZona: (id: string) => void;
};

export default function EscenaNave({ zona, oscuro, referencias, flujos, vistaKey, onElegirZona }: EscenaNaveProps) {
  const paleta = oscuro ? PALETA_OSCURA : PALETA_CLARA;
  const ligera = useMemo(esGamaLigera, []);

  return (
    <Canvas
      frameloop="demand"
      shadows={!ligera}
      dpr={ligera ? [1, 1.5] : [1, 2]}
      camera={{ fov: FOV, near: 0.5, far: 1500, position: [0, 200, 60] }}
      gl={{ antialias: true }}
      className="touch-none"
    >
      <color attach="background" args={[paleta.fondo]} />
      <fog attach="fog" args={[paleta.fondo, 260, 700]} />
      <hemisphereLight args={[oscuro ? "#b4c4d6" : "#ffffff", oscuro ? "#1a2230" : "#b8c2cc", oscuro ? 0.9 : 0.9]} />
      <directionalLight
        position={[35, 70, 45]}
        intensity={oscuro ? 1.25 : 1.6}
        castShadow={!ligera}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={10}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
      />

      <Estructura paleta={paleta} referencias={referencias} modoZona={!!zona} />
      {ZONAS.map((z) => (
        <ZonaSuelo
          key={z.id}
          zona={z}
          activa={z.id === zona?.id}
          atenuada={!!zona && z.id !== zona.id}
          flujos={flujos}
          contorno={paleta.suelo}
          onElegir={onElegirZona}
        />
      ))}
      <Puestos oculta={!!zona} opacidad={zona ? 0.35 : 1} />

      <Camara zona={zona} vistaKey={vistaKey} />
    </Canvas>
  );
}
