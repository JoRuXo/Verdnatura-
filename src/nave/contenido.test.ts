import { describe, expect, it } from "vitest";
import { piezasCarrosDeAdorno, piezasContenido, type Pieza } from "./contenido";
import { ASPECTOS, type Aspecto } from "@/articulos/aspectos";
import { aPlano, NAVE, type Rect } from "./plano";

const cajasDe = (piezas: Pieza[]) => piezas.flatMap((p) => p.cajas);

/** Esquinas en el plano de una caja de la escena. */
const huella = (c: { p: [number, number, number]; s: [number, number, number] }) => {
  const [x0, y0] = aPlano(c.p[0] - c.s[0] / 2, c.p[2] + c.s[2] / 2);
  const [x1, y1] = aPlano(c.p[0] + c.s[0] / 2, c.p[2] - c.s[2] / 2);
  return { x0, y0, x1, y1 };
};

const ZONA: Rect = { x0: 20, y0: 10, x1: 30, y1: 14 };
const ASPECTOS_TODOS = Object.keys(ASPECTOS) as Aspecto[];

describe("piezas de lo que hay en una zona", () => {
  it("sin nada apuntado no dibuja nada", () => {
    expect(piezasContenido(ZONA, [])).toEqual({ piezas: [], altura: 0, conMueble: false });
    for (const a of ASPECTOS_TODOS) expect(piezasContenido(ZONA, [{ aspecto: a, cantidad: 0 }]).piezas).toEqual([]);
  });

  it.each(ASPECTOS_TODOS)("%s: dibuja cajas con altura y tamaños válidos", (aspecto) => {
    const r = piezasContenido(ZONA, [{ aspecto, cantidad: 3 }]);
    expect(r.piezas.length).toBeGreaterThan(0);
    expect(r.altura).toBeGreaterThan(0);
    for (const c of cajasDe(r.piezas)) {
      expect(c.s.every((n) => n > 0 && Number.isFinite(n))).toBe(true);
      expect(c.p.every(Number.isFinite)).toBe(true);
    }
  });

  // El cartón de los carros sobresale de la base hasta ~12 cm, a propósito.
  const SALIENTE = 0.15;
  it.each(ASPECTOS_TODOS)("%s: todo cae dentro de la zona, con zona de cualquier orientación", (aspecto) => {
    for (const zona of [ZONA, { x0: 20, y0: 5, x1: 24, y1: 15 }]) {
      const r = piezasContenido(zona, [{ aspecto, cantidad: 40 }]);
      for (const c of cajasDe(r.piezas)) {
        const h = huella(c);
        expect(h.x0).toBeGreaterThanOrEqual(zona.x0 - SALIENTE);
        expect(h.x1).toBeLessThanOrEqual(zona.x1 + SALIENTE);
        expect(h.y0).toBeGreaterThanOrEqual(zona.y0 - SALIENTE);
        expect(h.y1).toBeLessThanOrEqual(zona.y1 + SALIENTE);
      }
    }
  });

  it("dibuja más cosas con más cantidad, hasta que no cabe más", () => {
    const n = (cantidad: number) => cajasDe(piezasContenido(ZONA, [{ aspecto: "carro-bandejas", cantidad }]).piezas).length;
    expect(n(2)).toBeGreaterThan(n(1));
    expect(n(500)).toBe(n(200)); // lo que cabe, no más
  });

  it("el dibujo es siempre el mismo para los mismos datos", () => {
    const a = piezasContenido(ZONA, [{ aspecto: "palet-film", cantidad: 4 }]);
    const b = piezasContenido(ZONA, [{ aspecto: "palet-film", cantidad: 4 }]);
    expect(a).toEqual(b);
  });

  it("una zona más pequeña que la cosa la dibuja a escala menor, sin salirse", () => {
    const pequena = { x0: 20, y0: 10, x1: 20.9, y1: 10.6 };
    const r = piezasContenido(pequena, [{ aspecto: "carros-apilados", cantidad: 10 }]);
    expect(r.piezas.length).toBeGreaterThan(0);
    for (const c of cajasDe(r.piezas)) {
      const h = huella(c);
      expect(h.x0).toBeGreaterThanOrEqual(pequena.x0 - 0.05);
      expect(h.x1).toBeLessThanOrEqual(pequena.x1 + 0.05);
    }
  });

  it("solo hay armario («conMueble») si todo lo que hay es armario", () => {
    expect(piezasContenido(ZONA, [{ aspecto: "cajas-etiquetas", cantidad: 5 }]).conMueble).toBe(true);
    expect(
      piezasContenido(ZONA, [{ aspecto: "cajas-etiquetas", cantidad: 5 }, { aspecto: "palet-film", cantidad: 1 }]).conMueble,
    ).toBe(false);
    expect(piezasContenido(ZONA, [{ aspecto: "palet-film", cantidad: 1 }]).conMueble).toBe(false);
  });

  it("los palets que no caben en el suelo van encima: más altura que uno solo", () => {
    const estrecha = { x0: 20, y0: 10, x1: 21.4, y1: 11 };
    const uno = piezasContenido(estrecha, [{ aspecto: "palet-planchas", cantidad: 1 }]);
    const tres = piezasContenido(estrecha, [{ aspecto: "palet-planchas", cantidad: 3 }]);
    expect(tres.altura).toBeGreaterThan(uno.altura);
  });
});

describe("carros de adorno", () => {
  it("rellenan la zona con carros vacíos sin salirse", () => {
    const piezas = piezasCarrosDeAdorno(ZONA);
    expect(cajasDe(piezas).length).toBeGreaterThan(0);
    for (const c of cajasDe(piezas)) {
      const h = huella(c);
      expect(h.x0).toBeGreaterThanOrEqual(ZONA.x0 - 0.05);
      expect(h.x1).toBeLessThanOrEqual(ZONA.x1 + 0.05);
    }
  });
  it("caben en la nave", () => {
    expect(NAVE.ancho).toBeGreaterThan(ZONA.x1);
  });
});
