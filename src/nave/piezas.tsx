import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { Caja } from "./geometria";
import { useFundido } from "./fundido";

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
  useFundido(material, opacidad);

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
