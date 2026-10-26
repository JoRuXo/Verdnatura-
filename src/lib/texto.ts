/** Minúsculas y sin tildes: al buscar, «Cartón» y «carton» son lo mismo. */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** La palabra aparece al principio de alguna palabra del texto. */
const empiezaPalabra = (texto: string, palabra: string) => new RegExp(`(^|[\\s\\-/(.,·])${escapar(palabra)}`).test(texto);

/**
 * Lo bien que encaja una búsqueda con algo (0 = no encaja). Tienen que salir
 * todas las palabras buscadas, en el nombre o en lo demás; puntúa más si el
 * nombre es exactamente lo buscado, si empieza por ello o si las palabras
 * aparecen al principio de una palabra del nombre.
 */
export function puntuar(busqueda: string, nombre: string, resto: string[] = []): number {
  const q = normalizar(busqueda);
  const palabras = q.split(/\s+/).filter(Boolean);
  if (!palabras.length) return 1;
  const n = normalizar(nombre);
  const r = normalizar(resto.filter(Boolean).join(" · "));

  let puntos = 0;
  for (const p of palabras) {
    if (n.includes(p)) puntos += empiezaPalabra(n, p) ? 20 : 10;
    else if (r.includes(p)) puntos += empiezaPalabra(r, p) ? 4 : 2;
    else return 0;
  }
  if (n === q) puntos += 100;
  else if (n.startsWith(q)) puntos += 50;
  return puntos;
}
