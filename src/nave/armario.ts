import type { Caja, Vec3 } from "./geometria";
import { aEscena, NAVE, type Rect } from "./plano";
import { marcoDe } from "./marco";
import type { Articulo, Existencia } from "@/articulos/modelo";

// Armario de baldas con cajas de cartón (el de Informática): cada artículo es
// una o varias cajas en su balda, con una etiqueta amarilla delante, como en
// la nave. Todo en el marco local del elemento (u a lo largo, v a lo ancho).

/** Cuántas baldas tiene el armario (1 = la de abajo). */
export const BALDAS_ARMARIO = 2;

/** Medidas del armario (metros): altura de cada balda y grosor de las tablas. */
const SUELO = 0.08;
const ENTRE_BALDAS = 0.5;
const TABLA = 0.025;
const LATERAL = 0.03;
const ALTO = SUELO + BALDAS_ARMARIO * ENTRE_BALDAS + TABLA;
/** Hueco libre encima de cada balda. */
const HUECO_BALDA = ENTRE_BALDAS - TABLA;
const SEPARACION = 0.04;

const COLORES = {
  cuerpo: "#cfccc4",
  balda: "#e9e7e2",
  kraft: ["#b8946a", "#a7845c", "#c4a27a", "#ad8a60"],
  etiqueta: "#f4e04d",
} as const;

/** Lo que hay en una balda: un artículo y cuántas cajas. */
export type CajaArmario = { id: string; nombre: string; balda: number; cantidad: number };

export type EtiquetaArmario = {
  id: string;
  texto: string;
  /** Centro de la etiqueta en la escena, ya un pelo por delante de la caja. */
  p: Vec3;
  /** Giro alrededor del eje vertical para que mire hacia fuera del armario. */
  giro: number;
  ancho: number;
  alto: number;
};

export type PiezasArmario = {
  cuerpo: Caja[];
  baldas: Caja[];
  /** Cajas de cartón agrupadas por color. */
  cajas: { color: string; cajas: Caja[] }[];
  etiquetas: EtiquetaArmario[];
  altura: number;
};

/** Número estable a partir de un texto (para que cada caja tenga siempre su tamaño). */
const semilla = (texto: string) => {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

/** Altura de la base de una balda, desde el suelo. */
export const alturaBalda = (balda: number) => SUELO + (balda - 1) * ENTRE_BALDAS + TABLA;

/** Una balda dentro de las que tiene el armario. */
export const baldaValida = (balda: number) => Math.min(BALDAS_ARMARIO, Math.max(1, Math.round(balda) || 1));

/**
 * Arma el armario con sus cajas. Las cajas de cada balda van de izquierda a
 * derecha, en el orden recibido; las de un mismo artículo se apilan si caben
 * (dos pistolas, una encima de otra). Lo que no cabe a lo largo no se dibuja.
 */
export function piezasArmario(area: Rect, contenido: CajaArmario[]): PiezasArmario {
  const m = marcoDe(area);
  const { largo: L, ancho: W } = m;

  // La boca del armario mira hacia dentro de la nave, no a la pared
  const [xf, yf] = m.aPlano(L / 2, -0.6);
  const bocaEnFondo = yf < 0.3 || yf > NAVE.fondo - 0.3 || xf < 0.3 || xf > NAVE.ancho - 0.3;
  // v medida desde la boca: 0 = delante
  const vReal = (v: number) => (bocaEnFondo ? W - v : v);
  const cajaM = (u0: number, v0: number, u1: number, v1: number, alto: number, base: number) => {
    const [a, b] = [vReal(v0), vReal(v1)].sort((x, y) => x - y);
    return m.caja(u0, a, u1, b, alto, base);
  };

  const cuerpo: Caja[] = [
    cajaM(0, 0, LATERAL, W, ALTO, 0),
    cajaM(L - LATERAL, 0, L, W, ALTO, 0),
    cajaM(0, W - LATERAL, L, W, ALTO, 0),
    cajaM(0, 0, L, W, TABLA, ALTO - TABLA),
  ];
  const baldas: Caja[] = [];
  for (let b = 1; b <= BALDAS_ARMARIO; b++) baldas.push(cajaM(LATERAL, 0, L - LATERAL, W - LATERAL, TABLA, alturaBalda(b) - TABLA));

  // Dirección "hacia fuera" de la boca, en la escena, para girar las etiquetas
  const [xa, ya] = m.aPlano(L / 2, vReal(W / 2));
  const [xb, yb] = m.aPlano(L / 2, vReal(-1));
  const [ea, za] = aEscena(xa, ya);
  const [eb, zb] = aEscena(xb, yb);
  const giro = Math.atan2(eb - ea, zb - za);

  const grupos = new Map<string, Caja[]>();
  const etiquetas: EtiquetaArmario[] = [];
  const fondoMax = Math.max(0.1, W - LATERAL - 0.06);
  const cursor = new Map<number, number>();

  for (const c of contenido) {
    if (c.cantidad <= 0) continue;
    const balda = baldaValida(c.balda);
    const r = semilla(c.id);
    const ancho = Math.min(0.32 + r * 0.16, L - 2 * LATERAL - 0.04);
    const fondo = Math.min(0.34 + ((r * 7) % 1) * 0.1, fondoMax);
    const alto = 0.17 + ((r * 13) % 1) * 0.06;
    const porPila = Math.max(1, Math.floor((HUECO_BALDA - 0.02) / alto));
    const pilas = Math.ceil(c.cantidad / porPila);
    const base = alturaBalda(balda);
    const adentro = (k: number) => 0.03 + ((r * 31 + k) % 1) * 0.03;
    let primera: { u: number } | null = null;

    for (let p = 0; p < pilas; p++) {
      const u = cursor.get(balda) ?? LATERAL + SEPARACION;
      if (u + ancho > L - LATERAL - 0.01) break;
      cursor.set(balda, u + ancho + SEPARACION);
      primera ??= { u };
      const enEsta = Math.min(porPila, c.cantidad - p * porPila);
      for (let k = 0; k < enEsta; k++) {
        const color = COLORES.kraft[Math.floor(r * 97 + p * 3 + k) % COLORES.kraft.length];
        const lista = grupos.get(color) ?? [];
        // Un poco hacia dentro y ligeramente torcidas en la pila, como de verdad
        const dv = adentro(k);
        lista.push(cajaM(u, dv, u + ancho, dv + fondo, alto - 0.004, base + k * alto));
        grupos.set(color, lista);
      }
    }

    if (primera) {
      // Etiqueta en la cara de delante de la caja de abajo
      const anchoEtiqueta = Math.min(ancho * 0.8, 0.34);
      const altoEtiqueta = Math.min(alto * 0.55, 0.1);
      const [px, py] = m.aPlano(primera.u + ancho / 2, vReal(adentro(0) - 0.004));
      const [ex, ez] = aEscena(px, py);
      etiquetas.push({ id: c.id, texto: c.nombre, p: [ex, base + alto / 2, ez], giro, ancho: anchoEtiqueta, alto: altoEtiqueta });
    }
  }

  return {
    cuerpo,
    baldas,
    cajas: [...grupos.entries()].map(([color, cajas]) => ({ color, cajas })),
    etiquetas,
    altura: ALTO,
  };
}

export type CajaFrontal = { a: Articulo; e: Existencia; balda: number };

/** Lo que hay en el armario, balda a balda (la de arriba primero). */
export function cajasPorBalda(articulos: Articulo[], zonaId: string) {
  const cajas: CajaFrontal[] = articulos.flatMap((a) =>
    a.existencias.filter((e) => e.elementoId === zonaId && e.cantidad > 0).map((e) => ({ a, e, balda: baldaValida(e.balda) })),
  );
  return Array.from({ length: BALDAS_ARMARIO }, (_, i) => BALDAS_ARMARIO - i).map((balda) => ({
    balda,
    cajas: cajas.filter((c) => c.balda === balda).sort((x, y) => x.a.nombre.localeCompare(y.a.nombre)),
  }));
}

export const COLORES_ARMARIO = COLORES;
