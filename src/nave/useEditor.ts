import { useCallback, useMemo, useRef, useState } from "react";
import type { Rect } from "./plano";
import type { Elemento } from "./elementos";
import { diferencias } from "./useMapa";

const MAX_HISTORIAL = 50;

/**
 * Estado del modo edición: un borrador de los elementos que se cambia libremente,
 * con historial para deshacer. Lo guardado no se toca hasta pulsar "Guardar".
 * Los cambios se miden contra `base` (el mapa al empezar a editar), no contra lo
 * último guardado: si otra persona cambia el mapa mientras tanto, al guardar no
 * se deshace lo suyo.
 */
export function useEditor(guardados: Elemento[]) {
  const [activo, setActivo] = useState(false);
  const [base, setBase] = useState<Elemento[]>([]);
  const [borrador, setBorrador] = useState<Elemento[]>([]);
  const [historial, setHistorial] = useState<Elemento[][]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [rejilla, setRejilla] = useState(true);

  // Refs para leer el valor actual dentro de callbacks estables (arrastres)
  const borradorRef = useRef(borrador);
  borradorRef.current = borrador;
  const historialRef = useRef(historial);
  historialRef.current = historial;

  const entrar = useCallback(() => {
    setBase(guardados);
    setBorrador(guardados);
    setHistorial([]);
    setSeleccion(null);
    setActivo(true);
  }, [guardados]);

  const salir = useCallback(() => {
    setActivo(false);
    setSeleccion(null);
    setHistorial([]);
  }, []);

  /** Foto del borrador actual para poder deshacer el cambio que viene. */
  const registrar = useCallback(() => {
    setHistorial((h) => [...h.slice(-(MAX_HISTORIAL - 1)), borradorRef.current]);
  }, []);

  const cambiar = useCallback(
    (id: string, cambios: Partial<Elemento>, conHistorial = true) => {
      if (conHistorial) registrar();
      setBorrador((b) => b.map((e) => (e.id === id ? { ...e, ...cambios } : e)));
    },
    [registrar],
  );

  const cambiarArea = useCallback((id: string, area: Rect) => {
    setBorrador((b) => b.map((e) => (e.id === id ? { ...e, area } : e)));
  }, []);

  const anadir = useCallback(
    (e: Elemento) => {
      registrar();
      setBorrador((b) => [...b, e]);
      setSeleccion(e.id);
    },
    [registrar],
  );

  const borrar = useCallback(
    (id: string) => {
      registrar();
      setBorrador((b) => b.filter((e) => e.id !== id));
      setSeleccion((s) => (s === id ? null : s));
    },
    [registrar],
  );

  const deshacer = useCallback(() => {
    const h = historialRef.current;
    if (!h.length) return;
    const anterior = h[h.length - 1];
    setBorrador(anterior);
    setHistorial(h.slice(0, -1));
    setSeleccion((s) => (s && anterior.some((e) => e.id === s) ? s : null));
  }, []);

  /** Vuelve a lo guardado (tras descartar o tras guardar con éxito). */
  const restablecer = useCallback((elementos: Elemento[]) => {
    setBase(elementos);
    setBorrador(elementos);
    setHistorial([]);
    setSeleccion((s) => (s && elementos.some((e) => e.id === s) ? s : null));
  }, []);

  const pendientes = useMemo(
    () => (activo ? diferencias(base, borrador).total : 0),
    [activo, base, borrador],
  );

  return {
    activo,
    base,
    borrador,
    seleccion,
    seleccionado: borrador.find((e) => e.id === seleccion) ?? null,
    rejilla,
    puedeDeshacer: historial.length > 0,
    pendientes,
    entrar,
    salir,
    registrar,
    cambiar,
    cambiarArea,
    anadir,
    borrar,
    deshacer,
    restablecer,
    seleccionar: setSeleccion,
    setRejilla,
  };
}

export type Editor = ReturnType<typeof useEditor>;
