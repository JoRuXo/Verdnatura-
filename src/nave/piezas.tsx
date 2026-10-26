import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Caja } from "./geometria";

type InstanciasProps = {
  cajas: Caja[];
  color: string;
  sombras?: boolean;
  /** Opacidad objetivo: si cambia, se funde suavemente hasta ella. */
  opacidad?: number;
};

/** Muchas cajas iguales en una sola llamada de dibujo. No reciben clics. */
export function Instancias({ cajas, color, sombras = true, opacidad = 1 }: InstanciasProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const malla = ref.current;
    if (!malla) return;
    const m = new THREE.Matrix4();
    const giro = new THREE.Quaternion();
    cajas.forEach((c, i) => {
      m.compose(new THREE.Vector3(...c.p), giro, new THREE.Vector3(...c.s));
      malla.setMatrixAt(i, m);
    });
    malla.instanceMatrix.needsUpdate = true;
    malla.computeBoundingSphere();
  }, [cajas]);

  // La opacidad no va como prop del material: si no, React la fijaría de golpe
  // y no habría fundido. Se pone al montar y luego se anima fotograma a fotograma.
  useLayoutEffect(() => {
    if (material.current) aplicarOpacidad(material.current, opacidad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((estado, delta) => {
    const mat = material.current;
    if (!mat || mat.opacity === opacidad) return;
    const siguiente = THREE.MathUtils.damp(mat.opacity, opacidad, 6, delta);
    aplicarOpacidad(mat, Math.abs(siguiente - opacidad) < 0.004 ? opacidad : siguiente);
    estado.invalidate();
  });

  return (
    <instancedMesh
      key={cajas.length}
      ref={ref}
      args={[undefined, undefined, cajas.length]}
      castShadow={sombras && opacidad >= 1}
      receiveShadow={sombras}
      raycast={() => null}
    >
      <boxGeometry />
      <meshStandardMaterial ref={material} color={color} roughness={0.85} />
    </instancedMesh>
  );
}

function aplicarOpacidad(mat: THREE.MeshStandardMaterial, opacidad: number) {
  mat.opacity = opacidad;
  const transparente = opacidad < 1;
  if (mat.transparent !== transparente) {
    mat.transparent = transparente;
    mat.depthWrite = !transparente;
    // Pasar de opaco a transparente cambia el shader: hay que recompilarlo
    mat.needsUpdate = true;
  }
}
