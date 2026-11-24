import { describe, expect, it } from "vitest";
import {
  agruparPorCategoria,
  almacenDeSerie,
  aFila,
  deFila,
  duplicar,
  ELEMENTOS_DE_SERIE,
  nuevoElemento,
  orientacion,
  referenciaDe,
  textoSentido,
  type Elemento,
} from "./elementos";
import { NAVE } from "./plano";

describe("qué guarda artículos de serie", () => {
  it("las líneas, los PC y los cargadores no; el resto sí", () => {
    expect(almacenDeSerie("linea", null)).toBe(false);
    expect(almacenDeSerie("puesto", "pc")).toBe(false);
    expect(almacenDeSerie("puesto", "cargador")).toBe(false);
    expect(almacenDeSerie("puesto", "carros-cc")).toBe(true);
    expect(almacenDeSerie("area", null)).toBe(true);
    expect(almacenDeSerie("estanteria", "carton")).toBe(true);
  });
});

describe("mapa de serie", () => {
  it("tiene elementos con claves e ids únicos", () => {
    expect(ELEMENTOS_DE_SERIE.length).toBeGreaterThan(0);
    const claves = new Set(ELEMENTOS_DE_SERIE.map((e) => e.clave));
    expect(claves.size).toBe(ELEMENTOS_DE_SERIE.length);
    expect(new Set(ELEMENTOS_DE_SERIE.map((e) => e.id)).size).toBe(ELEMENTOS_DE_SERIE.length);
  });

  it("todos caben dentro de la nave y tienen área positiva", () => {
    for (const e of ELEMENTOS_DE_SERIE) {
      const { x0, y0, x1, y1 } = e.area;
      expect(x1, e.clave).toBeGreaterThan(x0);
      expect(y1, e.clave).toBeGreaterThan(y0);
      expect(x0, e.clave).toBeGreaterThanOrEqual(-0.01);
      expect(y0, e.clave).toBeGreaterThanOrEqual(-0.01);
      expect(x1, e.clave).toBeLessThanOrEqual(NAVE.ancho + 0.01);
      expect(y1, e.clave).toBeLessThanOrEqual(NAVE.fondo + 0.01);
    }
  });

  it("solo usa tipos y sentidos válidos", () => {
    for (const e of ELEMENTOS_DE_SERIE) {
      expect(["linea", "area", "estanteria", "puesto"]).toContain(e.tipo);
      expect([1, -1, null]).toContain(e.sentido);
    }
  });
});

describe("orientación y referencias", () => {
  it("va a lo largo del lado más largo", () => {
    expect(orientacion({ x0: 0, y0: 0, x1: 10, y1: 2 })).toBe("x");
    expect(orientacion({ x0: 0, y0: 0, x1: 2, y1: 10 })).toBe("y");
    expect(orientacion({ x0: 0, y0: 0, x1: 5, y1: 5 })).toBe("x");
  });

  it("el texto del sentido depende de la orientación", () => {
    const base = { area: { x0: 0, y0: 0, x1: 10, y1: 1 } } as Elemento;
    expect(textoSentido({ ...base, sentido: 1 })).toBe("Hacia los muelles");
    expect(textoSentido({ ...base, sentido: -1 })).toBe("Hacia las puertas");
    expect(textoSentido({ ...base, sentido: null })).toBeNull();
    const alto = { area: { x0: 0, y0: 0, x1: 1, y1: 10 } } as Elemento;
    expect(textoSentido({ ...alto, sentido: 1 })).toBe("Hacia el fondo");
    expect(textoSentido({ ...alto, sentido: -1 })).toBe("Hacia la pared larga");
  });

  it("la referencia da los vanos y las franjas que toca", () => {
    expect(referenciaDe({ x0: 1, y0: 20, x1: 5, y1: 25 })).toBe("A · 2");
    expect(referenciaDe({ x0: 1, y0: 20, x1: 20, y1: 30 })).toBe("A–C · 1–2");
  });
});

describe("crear y duplicar", () => {
  it("un elemento nuevo queda dentro de la nave aunque se pida fuera", () => {
    for (const [x, y] of [[-50, -50], [500, 500], [55, 16]] as const) {
      const e = nuevoElemento("area", null, x, y);
      expect(e.area.x0).toBeGreaterThanOrEqual(0);
      expect(e.area.y0).toBeGreaterThanOrEqual(0);
      expect(e.area.x1).toBeLessThanOrEqual(NAVE.ancho + 1e-9);
      expect(e.area.y1).toBeLessThanOrEqual(NAVE.fondo + 1e-9);
    }
  });

  it("un elemento nuevo cae en la rejilla de 25 cm", () => {
    const e = nuevoElemento("area", null, 30.13, 12.07);
    expect((e.area.x0 * 4) % 1).toBeCloseTo(0, 9);
    expect((e.area.y0 * 4) % 1).toBeCloseTo(0, 9);
  });

  it("cada elemento nuevo tiene id y clave distintos", () => {
    const a = nuevoElemento("linea", null, 10, 10);
    const b = nuevoElemento("linea", null, 10, 10);
    expect(a.id).not.toBe(b.id);
    expect(a.clave).not.toBe(b.clave);
    expect(a.clave).toMatch(/^[a-z0-9-]+$/);
  });

  it("el nombre y el guardado de serie dependen del modelo", () => {
    const pc = nuevoElemento("puesto", "pc", 20, 10);
    expect(pc.nombre).toBe("PC");
    expect(pc.almacen).toBe(false);
    const carros = nuevoElemento("puesto", "carros-cc", 20, 10);
    expect(carros.categoria).toBe("Carros");
    expect(carros.almacen).toBe(true);
    expect(nuevoElemento("linea", null, 20, 10).sentido).toBe(1);
  });

  it("duplicar da otro id y clave y desplaza la copia sin cambiar su tamaño", () => {
    const o = nuevoElemento("area", null, 30, 12);
    const d = duplicar(o);
    expect(d.id).not.toBe(o.id);
    expect(d.clave).not.toBe(o.clave);
    expect(d.nombre).toBe(`${o.nombre} (copia)`);
    expect(d.area.x1 - d.area.x0).toBeCloseTo(o.area.x1 - o.area.x0, 9);
    expect(d.area.x0).not.toBe(o.area.x0);
  });
});

describe("ida y vuelta con la base de datos", () => {
  it("aFila → deFila conserva el elemento", () => {
    const e = { ...nuevoElemento("estanteria", "carton", 40, 10), sentido: null, descripcion: "Rack", mostrarNombre: false, almacen: false };
    const fila = aFila(e, 7);
    expect(fila.orden).toBe(7);
    const v = deFila({ ...fila, id: e.id, orden: 7 } as Parameters<typeof deFila>[0]);
    expect(v).toEqual({ ...e, orden: 7 });
  });

  it("una fila antigua sin los campos nuevos usa los valores de serie", () => {
    const e = nuevoElemento("puesto", "cargador", 40, 10);
    const fila = { ...aFila(e, 0), id: e.id, orden: 0 } as Record<string, unknown>;
    delete fila.almacen;
    delete fila.mostrar_nombre;
    const v = deFila(fila as Parameters<typeof deFila>[0]);
    expect(v.almacen).toBe(false); // cargador
    expect(v.mostrarNombre).toBe(false); // cargador: sin nombre
  });
});

describe("agrupar por categoría", () => {
  const el = (categoria: string, color = "#000") => ({ categoria, color }) as Elemento;
  it("va en el orden de serie y las nuevas al final por orden alfabético", () => {
    const grupos = agruparPorCategoria([el("Zeta"), el("Frío"), el("Alfa"), el("Entrada de producto")]);
    expect(grupos.map((g) => g.categoria)).toEqual(["Entrada de producto", "Frío", "Alfa", "Zeta"]);
  });
  it("junta los elementos de la misma categoría", () => {
    const grupos = agruparPorCategoria([el("Frío"), el("Tumba"), el("Frío")]);
    expect(grupos.find((g) => g.categoria === "Frío")?.zonas).toHaveLength(2);
  });
});
