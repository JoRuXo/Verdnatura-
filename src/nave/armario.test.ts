import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { alturaBalda, BALDAS_ARMARIO, baldaValida, cajasPorBalda, piezasArmario, type CajaArmario } from "./armario";
import { aPlano, type Rect } from "./plano";
import { articuloVacio, type Articulo } from "@/articulos/modelo";
import type { Caja } from "./geometria";

/** La del mapa: pegada a la pared larga (y = 0), con la boca hacia dentro de la nave. */
const PARED: Rect = { x0: 60.8, y0: 0.5, x1: 63.5, y1: 1.1 };
/** La misma, en mitad de la nave y girada (a lo largo de y). */
const GIRADA: Rect = { x0: 40, y0: 10, x1: 40.6, y1: 12.7 };

const INFORMATICA: CajaArmario[] = [
  { id: "pc", nombre: "Ordenador i3", balda: 2, cantidad: 1 },
  { id: "cabezal", nombre: "Cabezal impresora Zebra", balda: 2, cantidad: 1 },
  { id: "soporte", nombre: "Soporte mini PC", balda: 2, cantidad: 1 },
  { id: "ribbons", nombre: "Ribbons", balda: 2, cantidad: 1 },
  { id: "pistolas", nombre: "Pistola escáner", balda: 2, cantidad: 2 },
  { id: "cables", nombre: "Cables de internet", balda: 1, cantidad: 1 },
  { id: "zebra", nombre: "Impresora Zebra ZT111", balda: 1, cantidad: 1 },
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
      const balda = [...Array(BALDAS_ARMARIO).keys()].map((i) => i + 1).find((b) => Math.abs(h.z0 - alturaBalda(b)) < 0.5 && h.z0 >= alturaBalda(b) - 1e-6);
      expect(balda).toBeDefined();
      if (balda! < BALDAS_ARMARIO) expect(h.z1).toBeLessThan(alturaBalda(balda! + 1) - 0.02);
    }
  });

  it("las dos pistolas van una encima de otra", () => {
    const solo = todasLasCajas(PARED, [{ id: "pistolas", nombre: "Pistola escáner", balda: 2, cantidad: 2 }]);
    expect(solo).toHaveLength(2);
    const [a, b] = solo.map(huella).sort((x, y) => x.z0 - y.z0);
    expect(b.z0).toBeCloseTo(a.z1, 2);
    expect(a.x0).toBeCloseTo(b.x0, 6);
  });

  it("cambiar de balda sube la caja", () => {
    const abajo = huella(todasLasCajas(PARED, [{ id: "r", nombre: "Ribbons", balda: 1, cantidad: 1 }])[0]);
    const arriba = huella(todasLasCajas(PARED, [{ id: "r", nombre: "Ribbons", balda: 2, cantidad: 1 }])[0]);
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
    const muchas = [...Array(20).keys()].map((i) => ({ id: `c${i}`, nombre: `Caja ${i}`, balda: 1, cantidad: 1 }));
    expect(todasLasCajas(PARED, muchas).length).toBeLessThan(20);
    const vacio = piezasArmario(PARED, []);
    expect(vacio.cajas).toEqual([]);
    expect(vacio.etiquetas).toEqual([]);
    expect(vacio.cuerpo.length).toBeGreaterThan(0);
  });

  it("una balda que no existe se lleva a la más cercana", () => {
    expect(baldaValida(0)).toBe(1);
    expect(baldaValida(9)).toBe(BALDAS_ARMARIO);
    expect(baldaValida(Number.NaN)).toBe(1);
  });
});

describe("armario visto de frente", () => {
  const art = (nombre: string, existencias: [string, number, number][]): Articulo => ({
    ...articuloVacio(),
    nombre,
    existencias: existencias.map(([elementoId, cantidad, balda], i) => ({ id: `${nombre}-${i}`, elementoId, cantidad, nota: "", balda })),
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
