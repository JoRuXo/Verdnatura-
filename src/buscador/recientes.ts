// Lo último que se ha abierto desde el buscador, en este dispositivo.

export type Reciente = { tipo: "articulo" | "zona"; id: string };

const CLAVE = "verdnatura-recientes";
const MAXIMO = 5;

export function leerRecientes(): Reciente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(lista) ? lista.filter((r) => r && (r.tipo === "articulo" || r.tipo === "zona") && typeof r.id === "string") : [];
  } catch {
    return [];
  }
}

export function anotarReciente(r: Reciente) {
  try {
    const lista = [r, ...leerRecientes().filter((x) => x.id !== r.id)].slice(0, MAXIMO);
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento: no pasa nada, solo no habrá recientes
  }
}
