import type { Caja } from "./geometria";
import { NAVE, type Rect } from "./plano";
import { marcoDe, type Marco } from "./marco";
import type { Aspecto } from "@/articulos/aspectos";

// Lo que hay guardado en una zona, dibujado como es de verdad: carros CC
// (apilados o cargados), palets de cartón y armarios con cajas. Todo con
// medidas reales y los colores de las fotos de la nave, a base de cajas.

/** Un grupo de cajas del mismo color (y transparencia, para el film). */
export type Pieza = { color: string; cajas: Caja[]; opacidad?: number };

/** Colores sacados de las fotos. */
const C = {
  galvanizado: "#a9aeb3",
  galvanizadoOscuro: "#8e9399",
  tablero: "#3a2f29",
  rueda: "#5b4b40",
  barraClara: "#9fa5ab",
  barraOscura: "#878d93",
  bandejaClara: "#a6abb0",
  bandejaOscura: "#8a8f95",
  correa: "#2f6b55",
  kraft: ["#b8946a", "#a7845c", "#c4a27a", "#ad8a60"],
  planchaClara: "#dcd7ce",
  planchaOscura: "#cdc6bb",
  planchaArriba: "#ece8e1",
  madera: "#c7a26a",
  maderaOscura: "#a8844f",
  carton: "#b3916a",
  cartonOscuro: "#9f7f58",
  cartonArriba: "#c4a378",
  film: "#e6eef2",
  fleje: "#f4f4f2",
  armario: "#c8c5be",
  caja: "#f2f2ef",
  etiqueta: "#f2cf3d",
} as const;

/** Medidas reales (metros): base de un carro CC y palets. */
const CARRO = { largo: 1.35, ancho: 0.565 };
const PALET = { largo: 1.2, ancho: 0.8 };
const PALET_LARGO = { largo: 1.6, ancho: 0.8 };
const ARMARIO = { largo: 1.0, ancho: 0.45 };
const POR_PILA = 10;
const POR_ARMARIO = 16;
const HUECO = 0.12;

/** Va juntando cajas por color. */
class Piezas {
  private grupos = new Map<string, Pieza>();
  add(color: string, caja: Caja, opacidad?: number) {
    const clave = `${color}|${opacidad ?? 1}`;
    if (!this.grupos.has(clave)) this.grupos.set(clave, { color, cajas: [], opacidad });
    this.grupos.get(clave)!.cajas.push(caja);
  }
  lista() {
    return [...this.grupos.values()];
  }
}

/**
 * Dibuja en un hueco: origen (u, v) del marco y escala. Con `giro` (el fondo del
 * hueco), se dibuja dado la vuelta: lo de delante (v = 0) queda al otro lado.
 */
type Lienzo = { p: Piezas; m: Marco; u: number; v: number; s: number; giro?: number };

const caja = (l: Lienzo, u0: number, v0: number, u1: number, v1: number, alto: number, base = 0) => {
  const [a, b] = l.giro === undefined ? [v0, v1] : [l.giro - v1, l.giro - v0];
  return l.m.caja(l.u + u0 * l.s, l.v + a * l.s, l.u + u1 * l.s, l.v + b * l.s, alto * l.s, base * l.s);
};

/** Pseudoaleatorio estable (el mismo dibujo cada vez). */
const azar = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Base de un carro CC: ruedas, bastidor galvanizado, tablero oscuro y cantoneras. */
function baseCarro(l: Lienzo, z: number, ruedasArriba = false) {
  const { largo: L, ancho: W } = CARRO;
  const zr = ruedasArriba ? z + 0.07 : z;
  const zb = ruedasArriba ? z : z + 0.12;
  for (const [u, v] of [[0.05, 0.04], [L - 0.15, 0.04], [0.05, W - 0.1], [L - 0.15, W - 0.1]] as const) {
    l.p.add(C.rueda, caja(l, u, v, u + 0.1, v + 0.06, 0.12, zr));
  }
  l.p.add(C.galvanizado, caja(l, 0, 0, L, 0.035, 0.05, zb));
  l.p.add(C.galvanizado, caja(l, 0, W - 0.035, L, W, 0.05, zb));
  l.p.add(C.galvanizado, caja(l, 0, 0, 0.035, W, 0.05, zb));
  l.p.add(C.galvanizado, caja(l, L - 0.035, 0, L, W, 0.05, zb));
  l.p.add(C.tablero, caja(l, 0.03, 0.03, L - 0.03, W - 0.03, 0.02, zb + 0.03));
  for (const [u, v] of [[0, 0], [L - 0.06, 0], [0, W - 0.06], [L - 0.06, W - 0.06]] as const) {
    l.p.add(C.galvanizadoOscuro, caja(l, u, v, u + 0.06, v + 0.06, 0.08, zb));
  }
}

/** Los cuatro postes de un carro, hasta la altura dada. */
function postes(l: Lienzo, alto: number) {
  const { largo: L, ancho: W } = CARRO;
  for (const [u, v] of [[0.01, 0.01], [L - 0.045, 0.01], [0.01, W - 0.045], [L - 0.045, W - 0.045]] as const) {
    l.p.add(C.galvanizado, caja(l, u, v, u + 0.035, v + 0.035, alto - 0.17, 0.17));
  }
}

/** Pila de bases de carro vacías (hasta 10), como se guardan en la nave. */
function carrosApilados(l: Lienzo, n: number) {
  for (let i = 0; i < n; i++) baseCarro(l, i * 0.205);
  return n * 0.205 + 0.02;
}

/** Carro con las barras tumbadas abajo y otra base del revés arriba. */
function carroBarras(l: Lienzo) {
  baseCarro(l, 0);
  postes(l, 1.85);
  for (let i = 0; i < 6; i++) {
    l.p.add(i % 2 ? C.barraOscura : C.barraClara, caja(l, -0.08, 0.03, CARRO.largo + 0.08, CARRO.ancho - 0.03, 0.08, 0.17 + i * 0.085));
  }
  baseCarro(l, 1.78, true);
  return 2.0;
}

/** Carro lleno de bandejas apiladas, con su correa verde. */
function carroBandejas(l: Lienzo) {
  baseCarro(l, 0);
  postes(l, 1.95);
  const capas = 34;
  for (let i = 0; i < capas; i++) {
    l.p.add(i % 2 ? C.bandejaOscura : C.bandejaClara, caja(l, 0.05, 0.04, CARRO.largo - 0.05, CARRO.ancho - 0.04, 0.045, 0.17 + i * 0.047));
  }
  const zc = 1.0;
  l.p.add(C.correa, caja(l, 0.03, 0.02, CARRO.largo - 0.03, 0.035, 0.05, zc));
  l.p.add(C.correa, caja(l, 0.03, CARRO.ancho - 0.035, CARRO.largo - 0.03, CARRO.ancho - 0.02, 0.05, zc));
  return 1.95;
}

/** Carro con cartón usado apilado de cualquier manera (sobresale un poco). */
function carroCarton(l: Lienzo, semilla: number) {
  baseCarro(l, 0);
  postes(l, 2.0);
  for (let i = 0; i < 28; i++) {
    const du = (azar(semilla + i) - 0.5) * 0.1;
    const dv = (azar(semilla + i * 7) - 0.5) * 0.08;
    l.p.add(C.kraft[i % C.kraft.length], caja(l, -0.05 + du, -0.08 + dv, CARRO.largo + 0.05 + du, CARRO.ancho + 0.08 + dv, 0.058, 0.17 + i * 0.06));
  }
  return 2.0;
}

/** Palet europeo de madera (patines, tacos y tablas), de largo × ancho. */
function palet(l: Lienzo, largo: number, ancho: number, z: number) {
  const ul = (largo - PALET.largo) / 2;
  for (const v of [0, ancho / 2 - 0.05, ancho - 0.1]) l.p.add(C.madera, caja(l, ul, v, ul + PALET.largo, v + 0.1, 0.022, z));
  for (const u of [0, PALET.largo / 2 - 0.05, PALET.largo - 0.1])
    for (const v of [0, ancho / 2 - 0.05, ancho - 0.1]) l.p.add(C.maderaOscura, caja(l, ul + u, v, ul + u + 0.1, v + 0.1, 0.078, z + 0.022));
  for (let i = 0; i < 5; i++) {
    const v = (i * (ancho - 0.1)) / 4;
    l.p.add(C.madera, caja(l, ul, v, ul + PALET.largo, v + 0.1, 0.022, z + 0.1));
  }
}

/** Palet con planchas de cartón protector (claras). */
function paletPlanchas(l: Lienzo, z: number) {
  palet(l, PALET.largo, PALET.ancho, z);
  const capas = 12;
  for (let i = 0; i < capas; i++) {
    const color = i === capas - 1 ? C.planchaArriba : i % 2 ? C.planchaOscura : C.planchaClara;
    l.p.add(color, caja(l, -0.02, -0.02, PALET.largo + 0.02, PALET.ancho + 0.02, 0.06, z + 0.122 + i * 0.06));
  }
  return z + 0.122 + capas * 0.06;
}

/** Palet de cartón nuevo (800 × 1600), envuelto en film y con dos flejes. */
function paletFilm(l: Lienzo, z: number) {
  const { largo: L, ancho: W } = PALET_LARGO;
  palet(l, L, W, z);
  const zc = z + 0.122;
  const alto = 0.85;
  const capas = 10;
  for (let i = 0; i < capas; i++) l.p.add(i % 2 ? C.cartonOscuro : C.carton, caja(l, 0, 0, L, W, alto / capas, zc + (i * alto) / capas));
  l.p.add(C.cartonArriba, caja(l, 0, 0, L, W, 0.01, zc + alto));
  for (const u of [L * 0.3, L * 0.7]) {
    l.p.add(C.fleje, caja(l, u, -0.006, u + 0.025, W + 0.006, 0.006, zc + alto + 0.01));
    l.p.add(C.fleje, caja(l, u, -0.008, u + 0.025, 0, alto, zc));
    l.p.add(C.fleje, caja(l, u, W, u + 0.025, W + 0.008, alto, zc));
  }
  l.p.add(C.film, caja(l, -0.015, -0.015, L + 0.015, W + 0.015, alto + 0.03, zc - 0.01), 0.3);
  return zc + alto + 0.03;
}

/**
 * Armario metálico abierto por delante (v = 0) con cajas blancas de etiquetas.
 * Sin el fondo, como el resto de la maqueta (cortada para ver dentro): así se
 * ven las cajas aunque se mire desde detrás.
 */
function armarioCajas(l: Lienzo, n: number) {
  const { largo: L, ancho: W } = ARMARIO;
  const alto = 1.05;
  l.p.add(C.armario, caja(l, 0, 0, 0.02, W, alto));
  l.p.add(C.armario, caja(l, L - 0.02, 0, L, W, alto));
  l.p.add(C.armario, caja(l, 0, 0, L, W, 0.03, alto - 0.03));
  const baldas = [0.03, 0.36, 0.69];
  for (const z of baldas) l.p.add(C.armario, caja(l, 0.02, 0, L - 0.02, W, 0.02, z));
  // 12 dentro (3 baldas × 4) y 4 encima, como en la foto; llenan el fondo
  const FONDO_CAJA = 0.37;
  const huecos: [number, number, number][] = [];
  for (const z of baldas) for (let i = 0; i < 4; i++) huecos.push([0.04 + i * 0.235, 0.04, z + 0.02]);
  for (let i = 0; i < 4; i++) huecos.push([0.03 + i * 0.235, 0.04, alto]);
  huecos.slice(0, n).forEach(([u, v, z]) => {
    const atras = v + FONDO_CAJA;
    l.p.add(C.caja, caja(l, u, v, u + 0.22, atras, 0.28, z));
    l.p.add(C.etiqueta, caja(l, u + 0.11, v - 0.004, u + 0.2, v, 0.05, z + 0.19));
    l.p.add(C.etiqueta, caja(l, u + 0.02, atras, u + 0.11, atras + 0.004, 0.05, z + 0.19));
  });
  return n > 12 ? alto + 0.28 : alto;
}

/** Un hueco que ocupa una cosa: su huella y cómo se dibuja (devuelve su altura). */
type Hueco = { largo: number; ancho: number; dibujar: (l: Lienzo, z: number) => number };

/** Los huecos que hacen falta para una cantidad de un artículo. */
function huecosDe(aspecto: Aspecto, cantidad: number, semilla: number): Hueco[] {
  const n = Math.max(0, Math.floor(cantidad));
  const repetir = (veces: number, h: Hueco) => Array.from({ length: veces }, () => h);
  switch (aspecto) {
    case "carros-apilados": {
      const pilas = Math.ceil(n / POR_PILA);
      return Array.from({ length: pilas }, (_, i) => ({
        ...CARRO,
        dibujar: (l: Lienzo) => carrosApilados(l, Math.min(POR_PILA, n - i * POR_PILA)),
      }));
    }
    case "carro-barras":
      return repetir(n, { ...CARRO, dibujar: carroBarras });
    case "carro-bandejas":
      return repetir(n, { ...CARRO, dibujar: carroBandejas });
    case "carro-carton":
      return Array.from({ length: n }, (_, i) => ({ ...CARRO, dibujar: (l: Lienzo) => carroCarton(l, semilla + i * 31) }));
    case "palet-planchas":
      return repetir(n, { ...PALET, dibujar: paletPlanchas });
    case "palet-film":
      return repetir(n, { ...PALET_LARGO, dibujar: paletFilm });
    case "cajas-etiquetas": {
      const armarios = Math.ceil(n / POR_ARMARIO);
      return Array.from({ length: armarios }, (_, i) => ({
        ...ARMARIO,
        dibujar: (l: Lienzo) => armarioCajas(l, Math.min(POR_ARMARIO, n - i * POR_ARMARIO)),
      }));
    }
  }
}

/** Los palets se pueden poner de dos en dos si no caben en el suelo. */
const apilable = (a: Aspecto) => a === "palet-planchas" || a === "palet-film";

/** Lo que se dibuja con su propio mueble: en una estantería, ocupa el lugar de la de adorno. */
const conMueble = (a: Aspecto) => a === "cajas-etiquetas";

export type ContenidoZona = { aspecto: Aspecto; cantidad: number };

/**
 * Coloca en la superficie de una zona lo que tiene guardado: filas a lo largo
 * del lado mayor, centradas, con lo que quepa. Si una cosa no cabe ni sola, se
 * dibuja más pequeña. Devuelve las piezas y la altura de lo más alto.
 */
export function piezasContenido(
  area: Rect,
  contenido: ContenidoZona[],
): { piezas: Pieza[]; altura: number; conMueble: boolean } {
  const m = marcoDe(area);
  const p = new Piezas();
  let altura = 0;

  // Huecos de todo lo que hay, en orden
  const huecos: { h: Hueco; aspecto: Aspecto }[] = [];
  contenido.forEach((c, i) => huecosDe(c.aspecto, c.cantidad, i * 101).forEach((h) => huecos.push({ h, aspecto: c.aspecto })));
  if (!huecos.length) return { piezas: [], altura: 0, conMueble: false };

  // Escala para que la cosa más grande quepa al menos una vez
  const s = Math.min(1, ...huecos.map(({ h }) => Math.min((m.largo - 0.1) / h.largo, (m.ancho - 0.1) / h.ancho)));

  // Reparto en filas (estantería de cajas: se llena una fila y se pasa a la siguiente)
  type Colocado = { u: number; v: number; h: Hueco; aspecto: Aspecto; encima: boolean };
  const colocados: Colocado[] = [];
  let u = 0;
  let v = 0;
  let altoFila = 0;
  let anchoUsado = 0;
  let largoUsado = 0;
  const pendientes: { h: Hueco; aspecto: Aspecto }[] = [];
  for (const x of huecos) {
    const lu = x.h.largo * s;
    const lv = x.h.ancho * s;
    if (u > 0 && u + lu > m.largo) {
      u = 0;
      v += altoFila + HUECO;
      altoFila = 0;
    }
    if (v + lv > m.ancho + 0.001) {
      pendientes.push(x);
      continue;
    }
    colocados.push({ u, v, h: x.h, aspecto: x.aspecto, encima: false });
    largoUsado = Math.max(largoUsado, u + lu);
    anchoUsado = Math.max(anchoUsado, v + lv);
    altoFila = Math.max(altoFila, lv);
    u += lu + HUECO;
  }
  // Los palets que no caben en el suelo van encima de otro palet igual
  for (const x of pendientes) {
    if (!apilable(x.aspecto)) continue;
    const base = colocados.find((c) => !c.encima && c.aspecto === x.aspecto && !colocados.some((o) => o.encima && o.u === c.u && o.v === c.v));
    if (base) colocados.push({ ...base, h: x.h, encima: true });
  }

  // Lo de delante (la boca del armario) mira hacia dentro de la nave, no a la pared
  const [xf, yf] = m.aPlano(m.largo / 2, -0.6);
  const delanteFuera = yf < 0.3 || yf > NAVE.fondo - 0.3 || xf < 0.3 || xf > NAVE.ancho - 0.3;

  // Centrado en la zona
  const du = (m.largo - largoUsado) / 2;
  const dv = (m.ancho - anchoUsado) / 2;
  const alturaDe = new Map<string, number>();
  for (const c of colocados) {
    const clave = `${c.u}|${c.v}`;
    const z = c.encima ? (alturaDe.get(clave) ?? 0) / s : 0;
    const arriba = c.h.dibujar({ p, m, u: c.u + du, v: c.v + dv, s, giro: delanteFuera ? c.h.ancho : undefined }, z);
    alturaDe.set(clave, arriba * s);
    altura = Math.max(altura, arriba * s);
  }
  return { piezas: p.lista(), altura, conMueble: contenido.every((c) => conMueble(c.aspecto)) };
}

/**
 * Adorno de un objeto «Carros CC» sin nada apuntado: carros montados y vacíos
 * (base y postes), en filas. Cuando se apunta lo que hay, se dibuja eso.
 */
export function piezasCarrosDeAdorno(area: Rect): Pieza[] {
  const m = marcoDe(area);
  const p = new Piezas();
  const s = Math.min(1, (m.largo - 0.1) / CARRO.largo, (m.ancho - 0.1) / CARRO.ancho);
  const pasoU = (CARRO.largo + HUECO) * s;
  const pasoV = (CARRO.ancho + HUECO) * s;
  const porFila = Math.max(1, Math.floor((m.largo + HUECO * s) / pasoU));
  const filas = Math.max(1, Math.floor((m.ancho + HUECO * s) / pasoV));
  const du = (m.largo - (porFila * pasoU - HUECO * s)) / 2;
  const dv = (m.ancho - (filas * pasoV - HUECO * s)) / 2;
  for (let f = 0; f < filas; f++) {
    for (let i = 0; i < porFila; i++) {
      const l: Lienzo = { p, m, u: du + i * pasoU, v: dv + f * pasoV, s };
      baseCarro(l, 0);
      postes(l, 1.9);
    }
  }
  return p.lista();
}
