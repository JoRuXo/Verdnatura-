import type { Caja, Vec3 } from "./geometria";
import { aEscena, NAVE, type Rect } from "./plano";
import { marcoDe } from "./marco";
import type { Articulo, Existencia } from "@/articulos/modelo";

// Armario de baldas con cajas de cartón (el de Informática): cada artículo es
// una o varias cajas en su balda, con una etiqueta amarilla delante, como en
// la nave. Cada caja va donde se ha puesto a lo largo de su balda; la vista de
// frente de la app y el 3D salen de la misma cuenta (`disposicionArmario`), así
// que se ven igual.

/** Baldas de un armario si no se ha dicho otra cosa (1 = la de abajo). */
export const BALDAS_DE_SERIE = 2;
export const MAX_BALDAS = 8;

/** Medidas del armario (metros): altura de cada balda y grosor de las tablas. */
const SUELO = 0.08;
const ENTRE_BALDAS = 0.5;
const TABLA = 0.025;
const LATERAL = 0.03;
/** Hueco libre encima de cada balda. */
const HUECO_BALDA = ENTRE_BALDAS - TABLA;
/** Separación entre cajas y holgura con los laterales. */
export const SEPARACION = 0.04;
const HOLGURA = 0.02;

const COLORES = {
  cuerpo: "#cfccc4",
  balda: "#e9e7e2",
  kraft: ["#b8946a", "#a7845c", "#c4a27a", "#ad8a60"],
  etiqueta: "#f4e04d",
} as const;

/** Lo que hay en una balda: una existencia (un artículo en esta zona) y cuántas cajas. */
export type CajaArmario = {
  id: string;
  nombre: string;
  balda: number;
  cantidad: number;
  /** Sitio a lo largo de la balda (0 = a la izquierda, 1 = a la derecha, vista de frente); null = se coloca sola. */
  posicion: number | null;
};

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

/** Cuántas baldas tiene un armario (las de serie si no se ha dicho). */
export const numeroBaldas = (baldas: number | null | undefined) =>
  Math.min(MAX_BALDAS, Math.max(1, Math.round(baldas ?? BALDAS_DE_SERIE) || BALDAS_DE_SERIE));

/** Altura de la base de una balda, desde el suelo. */
export const alturaBalda = (balda: number) => SUELO + (balda - 1) * ENTRE_BALDAS + TABLA;

/** Altura del mueble entero con sus baldas. */
export const alturaArmario = (baldas: number) => SUELO + baldas * ENTRE_BALDAS + TABLA;

/** Nombre de una balda para la gente: arriba, abajo o su número (desde abajo). */
export const nombreBalda = (balda: number, baldas: number) =>
  baldas === 1 ? "La balda" : balda === baldas ? "Arriba" : balda === 1 ? "Abajo" : `Balda ${balda}`;

/** Una balda dentro de las que tiene el armario. */
export const baldaValida = (balda: number, baldas = BALDAS_DE_SERIE) => Math.min(baldas, Math.max(1, Math.round(balda) || 1));

/** Medidas del armario y hacia dónde mira. */
export function formaArmario(area: Rect) {
  const m = marcoDe(area);
  // La boca del armario mira hacia dentro de la nave, no a la pared
  const [xf, yf] = m.aPlano(m.largo / 2, -0.6);
  const bocaEnFondo = yf < 0.3 || yf > NAVE.fondo - 0.3 || xf < 0.3 || xf > NAVE.ancho - 0.3;
  // v medida desde la boca: 0 = delante
  const vReal = (v: number) => (bocaEnFondo ? m.ancho - v : v);
  // Hacia fuera de la boca, en la escena
  const [xa, ya] = m.aPlano(m.largo / 2, vReal(m.ancho / 2));
  const [xb, yb] = m.aPlano(m.largo / 2, vReal(-1));
  const [ea, za] = aEscena(xa, ya);
  const [eb, zb] = aEscena(xb, yb);
  const fuera = [eb - ea, zb - za];
  // A lo largo (u creciente), en la escena
  const [x0, y0] = m.aPlano(0, 0);
  const [x1, y1] = m.aPlano(1, 0);
  const [e0, z0] = aEscena(x0, y0);
  const [e1, z1] = aEscena(x1, y1);
  // Quien mira de frente tiene la derecha en (fuera.z, −fuera.x)
  const uHaciaLaDerecha = (e1 - e0) * fuera[1] - (z1 - z0) * fuera[0] > 0;
  return { m, vReal, giro: Math.atan2(fuera[0], fuera[1]), uHaciaLaDerecha, largo: m.largo, ancho: m.ancho };
}

/** Tamaño de las cajas de una existencia y cuánto ocupan a lo largo de la balda. */
export function medidasCaja(id: string, cantidad: number, largo: number, ancho: number) {
  const r = semilla(id);
  const anchoCaja = Math.min(0.32 + r * 0.16, Math.max(0.1, largo - 2 * LATERAL - 2 * HOLGURA));
  const fondo = Math.min(0.34 + ((r * 7) % 1) * 0.1, Math.max(0.1, ancho - LATERAL - 0.06));
  const alto = 0.17 + ((r * 13) % 1) * 0.06;
  // Las de un mismo artículo se apilan si caben (dos pistolas, una encima de otra)
  const porPila = Math.max(1, Math.floor((HUECO_BALDA - 0.02) / alto));
  const pilas = Math.max(1, Math.ceil(Math.max(1, cantidad) / porPila));
  return { r, ancho: anchoCaja, fondo, alto, porPila, pilas, huella: pilas * anchoCaja + (pilas - 1) * SEPARACION };
}

/** Desde dónde hasta dónde se pueden poner cajas a lo largo (vista de frente, metros desde la izquierda). */
export const tramoUtil = (largo: number) => ({ desde: LATERAL + HOLGURA, hasta: largo - LATERAL - HOLGURA });

/** Recorrido de una caja: lo que puede moverse de un lateral al otro. */
const recorrido = (largo: number, huella: number) => {
  const { desde, hasta } = tramoUtil(largo);
  return Math.max(0, hasta - desde - huella);
};

/** Dónde empieza una caja (metros desde la izquierda) a partir de su posición guardada. */
export const inicioDesdePosicion = (posicion: number, huella: number, largo: number) =>
  tramoUtil(largo).desde + Math.min(1, Math.max(0, posicion)) * recorrido(largo, huella);

/** La posición que se guarda para que una caja empiece en `inicio` (metros desde la izquierda). */
export const posicionDesdeInicio = (inicio: number, huella: number, largo: number) => {
  const r = recorrido(largo, huella);
  return r > 0 ? Math.min(1, Math.max(0, (inicio - tramoUtil(largo).desde) / r)) : 0;
};

export type CajaColocada = CajaArmario & {
  balda: number;
  medidas: ReturnType<typeof medidasCaja>;
  /** Metros desde la izquierda (vista de frente) donde empieza y acaba. */
  desde: number;
  hasta: number;
  /** false = no cabe en su balda: no se dibuja en el 3D. */
  cabe: boolean;
};

/**
 * Dónde va cada caja, balda a balda, vista de frente:
 *  1. Las que tienen sitio elegido van ahí, de izquierda a derecha; si una pisa
 *     a la anterior se corre a la derecha, y si se salen por la derecha se
 *     corren todas hacia la izquierda lo justo.
 *  2. Las que no tienen sitio se meten, por nombre, en el primer hueco donde quepan.
 * Lo que no cabe se marca (`cabe: false`).
 */
export function disposicionArmario(largo: number, ancho: number, contenido: CajaArmario[], baldas = BALDAS_DE_SERIE): CajaColocada[] {
  const { desde: inicio, hasta: fin } = tramoUtil(largo);
  const resultado: CajaColocada[] = [];

  for (let b = 1; b <= baldas; b++) {
    const aqui = contenido
      .filter((c) => c.cantidad > 0 && baldaValida(c.balda, baldas) === b)
      .map((c) => ({ ...c, balda: b, medidas: medidasCaja(c.id, c.cantidad, largo, ancho) }));

    // 1. Las de sitio elegido
    const fijas = aqui
      .filter((c) => c.posicion != null)
      .map((c) => ({ c, deseado: inicioDesdePosicion(c.posicion!, c.medidas.huella, largo) }))
      .sort((x, y) => x.deseado - y.deseado || x.c.id.localeCompare(y.c.id));
    const sitios = fijas.map(() => 0);
    let cursor = inicio;
    fijas.forEach((f, i) => {
      sitios[i] = Math.max(f.deseado, cursor);
      cursor = sitios[i] + f.c.medidas.huella + SEPARACION;
    });
    let limite = fin;
    for (let i = fijas.length - 1; i >= 0; i--) {
      sitios[i] = Math.min(sitios[i], limite - fijas[i].c.medidas.huella);
      limite = sitios[i] - SEPARACION;
    }
    // No caben todas: de izquierda a derecha, y las que se salgan, fuera
    const todasCaben = !fijas.length || sitios[0] >= inicio - 1e-9;
    if (!todasCaben) {
      cursor = inicio;
      fijas.forEach((f, i) => {
        sitios[i] = cursor;
        cursor += f.c.medidas.huella + SEPARACION;
      });
    }
    const ocupado: { desde: number; hasta: number }[] = [];
    fijas.forEach((f, i) => {
      const hasta = sitios[i] + f.c.medidas.huella;
      const cabe = hasta <= fin + 1e-9;
      resultado.push({ ...f.c, desde: sitios[i], hasta, cabe });
      if (cabe) ocupado.push({ desde: sitios[i], hasta });
    });

    // 2. Las que se colocan solas, en los huecos
    const solas = aqui.filter((c) => c.posicion == null).sort((x, y) => x.nombre.localeCompare(y.nombre) || x.id.localeCompare(y.id));
    for (const c of solas) {
      ocupado.sort((x, y) => x.desde - y.desde);
      let candidato = inicio;
      for (const o of ocupado) {
        if (candidato + c.medidas.huella + SEPARACION <= o.desde + 1e-9) break;
        candidato = Math.max(candidato, o.hasta + SEPARACION);
      }
      const hasta = candidato + c.medidas.huella;
      const cabe = hasta <= fin + 1e-9;
      resultado.push({ ...c, desde: candidato, hasta, cabe });
      if (cabe) ocupado.push({ desde: candidato, hasta });
    }
  }
  return resultado;
}

/** Arma el armario con sus cajas, cada una donde dice `disposicionArmario`. */
export function piezasArmario(area: Rect, contenido: CajaArmario[], numBaldas = BALDAS_DE_SERIE): PiezasArmario {
  const baldas = numeroBaldas(numBaldas);
  const { m, vReal, giro, uHaciaLaDerecha } = formaArmario(area);
  const { largo: L, ancho: W } = m;
  const alto = alturaArmario(baldas);
  const cajaM = (u0: number, v0: number, u1: number, v1: number, h: number, base: number) => {
    const [a, b] = [vReal(v0), vReal(v1)].sort((x, y) => x - y);
    return m.caja(u0, a, u1, b, h, base);
  };
  // De «metros desde la izquierda, vista de frente» a u
  const aU = (desde: number, anchoCaja: number) => (uHaciaLaDerecha ? desde : L - desde - anchoCaja);

  const cuerpo: Caja[] = [
    cajaM(0, 0, LATERAL, W, alto, 0),
    cajaM(L - LATERAL, 0, L, W, alto, 0),
    cajaM(0, W - LATERAL, L, W, alto, 0),
    cajaM(0, 0, L, W, TABLA, alto - TABLA),
  ];
  const tablas: Caja[] = [];
  for (let b = 1; b <= baldas; b++) tablas.push(cajaM(LATERAL, 0, L - LATERAL, W - LATERAL, TABLA, alturaBalda(b) - TABLA));

  const grupos = new Map<string, Caja[]>();
  const etiquetas: EtiquetaArmario[] = [];

  for (const c of disposicionArmario(L, W, contenido, baldas)) {
    if (!c.cabe) continue;
    const { r, ancho, fondo, alto: altoCaja, porPila, pilas } = c.medidas;
    const base = alturaBalda(c.balda);
    const adentro = (k: number) => 0.03 + ((r * 31 + k) % 1) * 0.03;
    for (let p = 0; p < pilas; p++) {
      const u = aU(c.desde + p * (ancho + SEPARACION), ancho);
      const enEsta = Math.min(porPila, c.cantidad - p * porPila);
      for (let k = 0; k < enEsta; k++) {
        const color = COLORES.kraft[Math.floor(r * 97 + p * 3 + k) % COLORES.kraft.length];
        const lista = grupos.get(color) ?? [];
        // Un poco hacia dentro y ligeramente torcidas en la pila, como de verdad
        const dv = adentro(k);
        lista.push(cajaM(u, dv, u + ancho, dv + fondo, altoCaja - 0.004, base + k * altoCaja));
        grupos.set(color, lista);
      }
    }
    // Etiqueta en la cara de delante de la caja de abajo de la primera pila
    const u = aU(c.desde, ancho);
    const [px, py] = m.aPlano(u + ancho / 2, vReal(adentro(0) - 0.004));
    const [ex, ez] = aEscena(px, py);
    etiquetas.push({
      id: c.id,
      texto: c.nombre,
      p: [ex, base + altoCaja / 2, ez],
      giro,
      ancho: Math.min(ancho * 0.8, 0.34),
      alto: Math.min(altoCaja * 0.55, 0.1),
    });
  }

  return {
    cuerpo,
    baldas: tablas,
    cajas: [...grupos.entries()].map(([color, cajas]) => ({ color, cajas })),
    etiquetas,
    altura: alto,
  };
}

export type CajaFrontal = { a: Articulo; e: Existencia; balda: number };

/** Lo que hay en el armario (con algo), con la balda ya dentro de las que tiene. */
export const cajasDelArmario = (articulos: Articulo[], zonaId: string, baldas = BALDAS_DE_SERIE): CajaFrontal[] =>
  articulos.flatMap((a) =>
    a.existencias.filter((e) => e.elementoId === zonaId && e.cantidad > 0).map((e) => ({ a, e, balda: baldaValida(e.balda, baldas) })),
  );

/** Lo que hay en el armario, balda a balda (la de arriba primero). */
export function cajasPorBalda(articulos: Articulo[], zonaId: string, baldas = BALDAS_DE_SERIE) {
  const cajas = cajasDelArmario(articulos, zonaId, baldas);
  return Array.from({ length: baldas }, (_, i) => baldas - i).map((balda) => ({
    balda,
    cajas: cajas.filter((c) => c.balda === balda).sort((x, y) => x.a.nombre.localeCompare(y.a.nombre)),
  }));
}

/** Una caja de la vista de frente, como la necesita la disposición. */
export const aCajaArmario = (c: CajaFrontal): CajaArmario => ({
  id: c.e.id,
  nombre: c.a.nombre,
  balda: c.balda,
  cantidad: c.e.cantidad,
  posicion: c.e.posicion,
});

export const COLORES_ARMARIO = COLORES;
