import { describe, expect, it } from "vitest";
import { aEscena, aPlano, FRANJAS, NAVE, VANOS } from "./plano";
import { cajaPlano, tramos } from "./geometria";
import { marcoDe } from "./marco";

describe("plano", () => {
  it("pasar del plano a la escena y volver da el mismo punto", () => {
    for (const [x, y] of [[0, 0], [55, 16.8], [110, 33.71], [12.3, 4.5]] as const) {
      const [ex, ez] = aEscena(x, y);
      const [x2, y2] = aPlano(ex, ez);
      expect(x2).toBeCloseTo(x, 9);
      expect(y2).toBeCloseTo(y, 9);
    }
  });

  it("la escena está centrada en la nave", () => {
    expect(aEscena(NAVE.ancho / 2, NAVE.fondo / 2)).toEqual([0, 0]);
  });

  it("los vanos A–K cubren la nave entera sin huecos", () => {
    expect(VANOS).toHaveLength(11);
    expect(VANOS[0].x0).toBe(0);
    expect(VANOS[10].x1).toBe(NAVE.ancho);
    VANOS.slice(1).forEach((v, i) => expect(v.x0).toBe(VANOS[i].x1));
  });

  it("las franjas están ordenadas de arriba abajo y encajan", () => {
    expect(FRANJAS[0].y1).toBe(NAVE.fondo);
    FRANJAS.slice(1).forEach((f, i) => expect(f.y1).toBeCloseTo(FRANJAS[i].y0, 6));
  });
});

describe("geometría", () => {
  it("una caja del plano tiene el tamaño y la altura pedidos", () => {
    const c = cajaPlano(10, 5, 14, 7, 2, 1);
    expect(c.s).toEqual([4, 2, 2]);
    expect(c.p[1]).toBe(2); // base 1 + mitad de la altura
  });

  it("tramos quita los huecos", () => {
    expect(tramos(0, 10, [[2, 3], [6, 7]])).toEqual([[0, 2], [3, 6], [7, 10]]);
    expect(tramos(0, 10, [])).toEqual([[0, 10]]);
    expect(tramos(0, 10, [[0, 10]])).toEqual([]);
  });

  it("tramos no depende del orden de los huecos y junta los que se pisan", () => {
    expect(tramos(0, 10, [[6, 7], [2, 4], [3, 5]])).toEqual([[0, 2], [5, 6], [7, 10]]);
  });
});

describe("marco local", () => {
  it("a lo largo de x, u va en x y v en y", () => {
    const m = marcoDe({ x0: 10, y0: 4, x1: 20, y1: 6 });
    expect(m.eje).toBe("x");
    expect([m.largo, m.ancho]).toEqual([10, 2]);
    expect(m.aPlano(3, 1)).toEqual([13, 5]);
  });

  it("a lo largo de y, u va en y y v hacia −x", () => {
    const m = marcoDe({ x0: 10, y0: 4, x1: 12, y1: 14 });
    expect(m.eje).toBe("y");
    expect([m.largo, m.ancho]).toEqual([10, 2]);
    expect(m.aPlano(3, 1)).toEqual([11, 7]);
  });

  it("una caja del marco cae dentro del área en las dos orientaciones", () => {
    for (const area of [{ x0: 10, y0: 4, x1: 20, y1: 6 }, { x0: 10, y0: 4, x1: 12, y1: 14 }]) {
      const m = marcoDe(area);
      const c = m.caja(0, 0, m.largo, m.ancho, 1);
      const [px, , pz] = c.p;
      const [x, y] = aPlano(px, pz);
      expect(x).toBeCloseTo((area.x0 + area.x1) / 2, 6);
      expect(y).toBeCloseTo((area.y0 + area.y1) / 2, 6);
      expect([...c.s].sort()).toEqual([1, area.x1 - area.x0, area.y1 - area.y0].sort());
    }
  });
});
