import type { Rect } from "./plano";

// Zonas del almacén. Por ahora viven aquí, en código; cuando esté definido el
// flujo de trabajo pasarán a una tabla de Supabase.

export type Zona = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Color de la zona en el suelo y en su etiqueta. */
  color: string;
  /** Superficie en coordenadas del plano (metros). */
  area: Rect;
  /** Referencia en el plano anotado, p. ej. "C4–D4". */
  referencia: string;
  /** Solo para la zona de muestra: pinta estanterías de ejemplo dentro. */
  ejemplo?: boolean;
};

export const ZONAS: Zona[] = [
  {
    id: "ejemplo",
    nombre: "Zona de ejemplo",
    descripcion: "Zona de muestra para probar la navegación. Se sustituirá por las zonas reales.",
    color: "#16a34a",
    area: { x0: 18, y0: 1.2, x1: 37, y1: 8.4 },
    referencia: "C4–D4",
    ejemplo: true,
  },
];

export const buscarZona = (id: string | undefined) => ZONAS.find((z) => z.id === id);
