import { normalizarTexto } from "@/lib/format";

export type FifoArticulo = {
  id: string;
  nombre: string;
  fecha: string | null;
  created_at?: string | null;
};

/**
 * Devuelve el conjunto de IDs de artículos que son los más antiguos (FIFO)
 * dentro de su grupo (mismo nombre normalizado).
 */
export function calcularFifoIds(articulos: FifoArticulo[]): Set<string> {
  const grupos = new Map<string, FifoArticulo[]>();
  for (const a of articulos) {
    if (!a.fecha) continue;
    const key = normalizarTexto(a.nombre);
    if (!key) continue;
    const arr = grupos.get(key) ?? [];
    arr.push(a);
    grupos.set(key, arr);
  }

  const result = new Set<string>();
  for (const arr of grupos.values()) {
    if (arr.length < 2) continue;
    let minFecha = arr[0].fecha as string;
    for (const a of arr) {
      if ((a.fecha as string) < minFecha) minFecha = a.fecha as string;
    }
    for (const a of arr) {
      if (a.fecha === minFecha) result.add(a.id);
    }
  }
  return result;
}
