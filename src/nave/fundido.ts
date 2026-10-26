import { useLayoutEffect, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

type ConOpacidad = THREE.Material & { opacity: number };

/**
 * Funde la opacidad de un material hasta `objetivo`, fotograma a fotograma.
 * La opacidad no va como prop del material: si no, React la fijaría de golpe.
 * Con `siempreTransparente` el material no vuelve a opaco al llegar a 1.
 */
export function useFundido(ref: RefObject<ConOpacidad>, objetivo: number, siempreTransparente = false) {
  useLayoutEffect(() => {
    if (ref.current) aplicarOpacidad(ref.current, objetivo, siempreTransparente);
    // Solo al montar: luego manda el fundido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((estado, delta) => {
    const mat = ref.current;
    if (!mat || mat.opacity === objetivo) return;
    const siguiente = THREE.MathUtils.damp(mat.opacity, objetivo, 6, delta);
    aplicarOpacidad(mat, Math.abs(siguiente - objetivo) < 0.004 ? objetivo : siguiente, siempreTransparente);
    estado.invalidate();
  });
}

function aplicarOpacidad(mat: ConOpacidad, opacidad: number, siempreTransparente: boolean) {
  mat.opacity = opacidad;
  const transparente = siempreTransparente || opacidad < 1;
  if (mat.transparent !== transparente) {
    mat.transparent = transparente;
    mat.depthWrite = !transparente;
    // Pasar de opaco a transparente cambia el shader: hay que recompilarlo
    mat.needsUpdate = true;
  }
}
