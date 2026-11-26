import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  alturaArmario,
  alturaBalda,
  BALDAS_DE_SERIE,
  baldaValida,
  cajasPorBalda,
  disposicionArmario,
  formaArmario,
  numeroBaldas,
  piezasArmario,
  SEPARACION,
  tramoUtil,
  type CajaArmario,
} from "./armario";
import { aPlano, type Rect } from "./plano";
import { articuloVacio, type Articulo } from "@/articulos/modelo";
import type { Caja } from "./geometria";

/** La del mapa: pegada a la pared larga (y = 0), con la boca hacia dentro de la nave. */
const PARED: Rect = { x0: 60.8, y0: 0.5, x1: 63.5, y1: 1.1 };
/** La misma, en mitad de la nave y girada (a lo largo de y). */
const GIRADA: Rect = { x0: 40, y0: 10, x1: 40.6, y1: 12.7 };

const INFORMATICA: CajaArmario[] = [
  { id: "pc", nombre: "Ordenador i3", balda: 2, cantidad: 1, posicion: null },
  { id: "cabezal", nombre: "Cabezal impresora Zebra", balda: 2, cantidad: 1, posicion: null },
  { id: "soporte", nombre: "Soporte mini PC", balda: 2, cantidad: 1, posicion: null },
  { id: "ribbons", nombre: "Ribbons", balda: 2, cantidad: 1, posicion: null },
  { id: "pistolas", nombre: "Pistola escáner", balda: 2, cantidad: 2, posicion: null },
  { id: "cables", nombre: "Cables de internet", balda: 1, cantidad: 1, posicion: null },
  { id: "zebra", nombre: "Impresora Zebra ZT111", balda: 1, cantidad: 1, posicion: null },
];

const huella = (c: Caja) => {
  const [x0, y0] = aPlano(c.p[0] - c.s[0] / 2, c.p[2] + c.s[2] / 2);
  const [x1, y1] = aPlano(c.p[0] + c.s[0] / 2, c.p[2] - c.s[2] / 2);
  return { x0, y0, x1, y1, z0: c.p[1] - c.s[1] / 2, z1: c.p[1] + c.s[1] / 2 };
};
const todasLasCajas = (area: Rect, contenido = INFORMATICA) => piezasArmario(area, contenido).cajas.flatMap((g) => g.cajas);

describe("armario de Informática", () => {
  it.each([["pegado a la pared", PARED], ["girado", GIRADA]] as const)("%s: todo cae dentro del armario", (_, area) => {
    const p = piezasArmario(area, INFORMATICA);
    for (const c of [...p.cuerpo, ...p.baldas, ...p.cajas.flatMap((g) => g.cajas)]) {
      const h = huella(c);
      expect(h.x0).toBeGreaterThanOrEqual(area.x0 - 1e-6);
      expect(h.x1).toBeLessThanOrEqual(area.x1 + 1e-6);
      expect(h.y0).toBeGreaterThanOrEqual(area.y0 - 1e-6);
      expect(h.y1).toBeLessThanOrEqual(area.y1 + 1e-6);
      expect(h.z1).toBeLessThanOrEqual(p.altura + 1e-6);
    }
  });

  it("dibuja una caja por cada una que hay (las pistolas son dos) y una etiqueta por artículo", () => {
    const p = piezasArmario(PARED, INFORMATICA);
    expect(p.cajas.flatMap((g) => g.cajas)).toHaveLength(8);
    expect(p.etiquetas.map((e) => e.texto).sort()).toEqual(INFORMATICA.map((c) => c.nombre).sort());
  });

  it("cada caja está apoyada en su balda y no toca la de encima", () => {
    for (const c of todasLasCajas(PARED)) {
      const h = huella(c);
      const balda = [...Array(BALDAS_DE_SERIE).keys()].map((i) => i + 1).find((b) => Math.abs(h.z0 - alturaBalda(b)) < 0.5 && h.z0 >= alturaBalda(b) - 1e-6);
      expect(balda).toBeDefined();
      if (balda! < BALDAS_DE_SERIE) expect(h.z1).toBeLessThan(alturaBalda(balda! + 1) - 0.02);
    }
  });

  it("las dos pistolas van una encima de otra", () => {
    const solo = todasLasCajas(PARED, [{ id: "pistolas", nombre: "Pistola escáner", balda: 2, cantidad: 2, posicion: null }]);
    expect(solo).toHaveLength(2);
    const [a, b] = solo.map(huella).sort((x, y) => x.z0 - y.z0);
    expect(b.z0).toBeCloseTo(a.z1, 2);
    expect(a.x0).toBeCloseTo(b.x0, 6);
  });

  it("cambiar de balda sube la caja", () => {
    const abajo = huella(todasLasCajas(PARED, [{ id: "r", nombre: "Ribbons", balda: 1, cantidad: 1, posicion: null }])[0]);
    const arriba = huella(todasLasCajas(PARED, [{ id: "r", nombre: "Ribbons", balda: 2, cantidad: 1, posicion: null }])[0]);
    expect(arriba.z0).toBeGreaterThan(abajo.z0 + 0.3);
  });

  it("las cajas de una balda no se pisan", () => {
    const cajas = todasLasCajas(PARED).map(huella).filter((h) => h.z0 > alturaBalda(2) - 0.01 && h.z0 < alturaBalda(2) + 0.01);
    const ordenadas = cajas.sort((a, b) => a.x0 - b.x0);
    ordenadas.slice(1).forEach((h, i) => expect(h.x0).toBeGreaterThanOrEqual(ordenadas[i].x1 - 1e-6));
  });

  it("la boca y las etiquetas miran hacia dentro de la nave, no a la pared", () => {
    const p = piezasArmario(PARED, INFORMATICA);
    for (const e of p.etiquetas) {
      // Girar la normal +z de la etiqueta y pasarla al plano: tiene que ir hacia +y (lejos de la pared y = 0)
      const nz = Math.cos(e.giro);
      expect(-nz).toBeGreaterThan(0.99);
      const [, y] = aPlano(e.p[0], e.p[2]);
      // Delante de las cajas: más lejos de la pared que el fondo del armario
      expect(y).toBeGreaterThan(PARED.y1 - 0.1);
    }
  });

  it("lo que no cabe a lo largo no se dibuja, y sin nada solo queda el mueble", () => {
    const muchas = [...Array(20).keys()].map((i) => ({ id: `c${i}`, nombre: `Caja ${i}`, balda: 1, cantidad: 1, posicion: null }));
    expect(todasLasCajas(PARED, muchas).length).toBeLessThan(20);
    const vacio = piezasArmario(PARED, []);
    expect(vacio.cajas).toEqual([]);
    expect(vacio.etiquetas).toEqual([]);
    expect(vacio.cuerpo.length).toBeGreaterThan(0);
  });

  it("una balda que no existe se lleva a la más cercana", () => {
    expect(baldaValida(0)).toBe(1);
    expect(baldaValida(9)).toBe(BALDAS_DE_SERIE);
    expect(baldaValida(Number.NaN)).toBe(1);
  });
});

describe("armario visto de frente", () => {
  const art = (nombre: string, existencias: [string, number, number][]): Articulo => ({
    ...articuloVacio(),
    nombre,
    existencias: existencias.map(([elementoId, cantidad, balda], i) => ({ id: `${nombre}-${i}`, elementoId, cantidad, nota: "", balda, posicion: null })),
  });

  it("reparte por baldas, la de arriba primero, y deja fuera lo de otras zonas o a 0", () => {
    const baldas = cajasPorBalda(
      [art("Ribbons", [["inf", 1, 2]]), art("Zebra", [["inf", 1, 1]]), art("Carro", [["otra", 5, 1]]), art("Vacío", [["inf", 0, 1]])],
      "inf",
    );
    expect(baldas.map((b) => b.balda)).toEqual([2, 1]);
    expect(baldas[0].cajas.map((c) => c.a.nombre)).toEqual(["Ribbons"]);
    expect(baldas[1].cajas.map((c) => c.a.nombre)).toEqual(["Zebra"]);
  });
});

describe("cajas colocadas a mano", () => {
  const { largo, ancho } = formaArmario(PARED);
  const caja = (id: string, balda: number, posicion: number | null, cantidad = 1): CajaArmario => ({ id, nombre: id, balda, cantidad, posicion });
  const enBalda = (cajas: CajaArmario[], balda: number, n = BALDAS_DE_SERIE) =>
    disposicionArmario(largo, ancho, cajas, n)
      .filter((c) => c.balda === balda && c.cabe)
      .sort((a, b) => a.desde - b.desde);
  const sinPisarse = (cs: { desde: number; hasta: number }[]) =>
    cs.slice(1).forEach((c, i) => expect(c.desde).toBeGreaterThanOrEqual(cs[i].hasta + SEPARACION - 1e-9));

  it("una caja va donde se ha puesto: 0 a la izquierda, 1 a la derecha", () => {
    const { desde, hasta } = tramoUtil(largo);
    expect(enBalda([caja("a", 1, 0)], 1)[0].desde).toBeCloseTo(desde, 6);
    expect(enBalda([caja("a", 1, 1)], 1)[0].hasta).toBeCloseTo(hasta, 6);
    const medio = enBalda([caja("a", 1, 0.5)], 1)[0];
    expect((medio.desde + medio.hasta) / 2).toBeCloseTo((desde + hasta) / 2, 6);
  });

  it("si choca con otra, la empuja a la derecha; en el borde, se corren hacia la izquierda", () => {
    const juntas = enBalda([caja("a", 1, 0.3), caja("b", 1, 0.3)], 1);
    expect(juntas).toHaveLength(2);
    sinPisarse(juntas);
    const alFondo = enBalda([caja("a", 1, 1), caja("b", 1, 1)], 1);
    sinPisarse(alFondo);
    expect(alFondo[1].hasta).toBeLessThanOrEqual(tramoUtil(largo).hasta + 1e-9);
  });

  it("las que se colocan solas van a los huecos sin pisar las puestas a mano", () => {
    const cajas = [caja("fija", 1, 0), caja("sola1", 1, null), caja("sola2", 1, null), caja("fija2", 1, 1)];
    const todas = enBalda(cajas, 1);
    expect(todas).toHaveLength(4);
    sinPisarse(todas);
    expect(todas[0].id).toBe("fija");
    expect(todas[3].id).toBe("fija2");
  });

  it("lo que no cabe queda marcado, no montado encima", () => {
    const muchas = [...Array(12).keys()].map((i) => caja(`c${i}`, 1, i / 11));
    const todas = disposicionArmario(largo, ancho, muchas);
    expect(todas.some((c) => !c.cabe)).toBe(true);
    sinPisarse(todas.filter((c) => c.cabe).sort((a, b) => a.desde - b.desde));
  });

  it("con más baldas el mueble crece y las cajas van a la suya", () => {
    expect(numeroBaldas(null)).toBe(BALDAS_DE_SERIE);
    expect(numeroBaldas(20)).toBe(8);
    const p = piezasArmario(PARED, [caja("arriba", 4, null)], 4);
    expect(p.baldas).toHaveLength(4);
    expect(p.altura).toBeCloseTo(alturaArmario(4), 6);
    const h = huella(p.cajas.flatMap((g) => g.cajas)[0]);
    expect(h.z0).toBeCloseTo(alturaBalda(4), 6);
    expect(baldaValida(4, 3)).toBe(3);
  });

  it("vista de frente y 3D coinciden: lo de la izquierda, a la izquierda de quien mira", () => {
    for (const area of [PARED, GIRADA]) {
      const f = formaArmario(area);
      const p = piezasArmario(area, [caja("izq", 1, 0), caja("der", 1, 1)]);
      const [izq, der] = ["izq", "der"].map((id) => p.etiquetas.find((e) => e.id === id)!.p);
      // La derecha de quien mira de frente (mirando hacia dentro del armario)
      const derecha = [Math.cos(f.giro), -Math.sin(f.giro)];
      const avance = (der[0] - izq[0]) * derecha[0] + (der[2] - izq[2]) * derecha[1];
      expect(avance).toBeGreaterThan(0.5);
    }
  });
});
