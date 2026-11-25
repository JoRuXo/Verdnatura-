import { beforeEach, describe, expect, it, vi } from "vitest";

// El cliente de Supabase no se usa en estas pruebas: se sustituye para no
// necesitar las variables de entorno.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  articuloVacio,
  cantidadEn,
  deFila,
  estadoStock,
  nuevaExistencia,
  sinUbicar,
  textoBuscable,
  tieneSinUbicar,
  total,
  type Articulo,
} from "./modelo";
import { esAspecto } from "./aspectos";

const art = (existencias: [string | null, number][], stockMinimo: number | null = null): Articulo => ({
  ...articuloVacio(),
  nombre: "Carro CC",
  stockMinimo,
  existencias: existencias.map(([elementoId, cantidad], i) => ({ id: String(i), elementoId, cantidad, nota: "", balda: 1 })),
});

describe("cantidades", () => {
  it("el total suma todas las zonas, también las sin ubicar", () => {
    const a = art([["a", 5], ["b", 3], [null, 2]]);
    expect(total(a)).toBe(10);
    expect(sinUbicar(a)).toBe(2);
    expect(tieneSinUbicar(a)).toBe(true);
    expect(tieneSinUbicar(art([["a", 1]]))).toBe(false);
  });

  it("la cantidad en una zona suma sus filas y no mira las demás", () => {
    const a = art([["a", 5], ["a", 2], ["b", 3]]);
    expect(cantidadEn(a, "a")).toBe(7);
    expect(cantidadEn(a, "b")).toBe(3);
    expect(cantidadEn(a, "c")).toBe(0);
  });
});

describe("estado del stock", () => {
  it("sin stock, con stock y bajo mínimo", () => {
    expect(estadoStock(art([]))).toBe("sin-stock");
    expect(estadoStock(art([["a", 0]]))).toBe("sin-stock");
    expect(estadoStock(art([["a", 4]]))).toBe("ok");
    expect(estadoStock(art([["a", 4]], 10))).toBe("bajo-minimo");
  });

  it("justo en el mínimo no es bajo mínimo", () => {
    expect(estadoStock(art([["a", 10]], 10))).toBe("ok");
  });

  it("bajo mínimo manda sobre sin stock cuando hay mínimo", () => {
    expect(estadoStock(art([], 5))).toBe("bajo-minimo");
    expect(estadoStock(art([], 0))).toBe("sin-stock");
  });
});

describe("artículos nuevos", () => {
  it("empieza vacío y, si se crea en una zona, ya está colocado en ella con 0", () => {
    expect(articuloVacio().existencias).toEqual([]);
    const a = articuloVacio("zona-1");
    expect(a.existencias).toHaveLength(1);
    expect(a.existencias[0]).toMatchObject({ elementoId: "zona-1", cantidad: 0 });
  });

  it("cada uno lleva un id distinto", () => {
    expect(articuloVacio().id).not.toBe(articuloVacio().id);
    expect(nuevaExistencia(null).id).not.toBe(nuevaExistencia(null).id);
  });

  it("una existencia nueva va a la balda de abajo si no se dice otra", () => {
    expect(nuevaExistencia("z").balda).toBe(1);
    expect(nuevaExistencia("z", 2).balda).toBe(2);
    expect(articuloVacio("z").existencias[0].balda).toBe(1);
  });
});

describe("desde la base de datos", () => {
  const fila = (extra: Record<string, unknown> = {}) =>
    ({
      id: "a1",
      nombre: "Palet",
      categoria: "Cartón",
      descripcion: "",
      unidad: "palets",
      caracteristicas: [{ nombre: "Medidas", valor: "1,2×0,8" }, { nombre: 5, valor: null }, "basura", null],
      fotos: null,
      stock_minimo: 3,
      aspecto: "palet-film",
      existencias: [
        { id: "x", elemento_id: "z1", cantidad: 2, nota: "", balda: 1 },
        { id: "y", elemento_id: null, cantidad: 9, nota: "", balda: 1 },
        { id: "w", elemento_id: "z2", cantidad: 2, nota: "", balda: 1 },
      ],
      ...extra,
    }) as unknown as Parameters<typeof deFila>[0];

  it("lee las características válidas y descarta la basura", () => {
    const a = deFila(fila());
    expect(a.caracteristicas).toEqual([
      { nombre: "Medidas", valor: "1,2×0,8" },
      { nombre: "5", valor: "" },
    ]);
  });

  it("tolera fotos nulas, características que no son lista y aspecto desconocido", () => {
    const a = deFila(fila({ caracteristicas: {}, aspecto: "inventado" }));
    expect(a.fotos).toEqual([]);
    expect(a.caracteristicas).toEqual([]);
    expect(a.aspecto).toBeNull();
    expect(deFila(fila()).aspecto).toBe("palet-film");
  });

  it("ordena las existencias de más a menos y, a igualdad, por id", () => {
    expect(deFila(fila()).existencias.map((e) => e.id)).toEqual(["y", "w", "x"]);
  });

  it("lee la balda y, si la base de datos aún no la tiene, pone la de abajo", () => {
    const conBalda = deFila(fila({ existencias: [{ id: "x", elemento_id: "z1", cantidad: 1, nota: "", balda: 2 }] }));
    expect(conBalda.existencias[0].balda).toBe(2);
    const sinBalda = deFila(fila({ existencias: [{ id: "x", elemento_id: "z1", cantidad: 1, nota: "" }] }));
    expect(sinBalda.existencias[0].balda).toBe(1);
  });

  it("esAspecto solo acepta los dibujos que existen", () => {
    expect(esAspecto("carro-barras")).toBe(true);
    expect(esAspecto("otro")).toBe(false);
    expect(esAspecto(null)).toBe(false);
    expect(esAspecto(3)).toBe(false);
  });
});

describe("texto en el que se busca", () => {
  const a: Articulo = {
    ...art([["z1", 1], [null, 1]]),
    categoria: "Cartón",
    caracteristicas: [{ nombre: "Medidas", valor: "1,2×0,8" }],
  };
  beforeEach(() => undefined);
  it("incluye categoría, características y el nombre de la zona; «sin ubicar» si no tiene", () => {
    const t = textoBuscable(a, (id) => (id === "z1" ? "Muelle 3" : undefined));
    expect(t).toContain("Cartón");
    expect(t).toContain("Medidas");
    expect(t).toContain("1,2×0,8");
    expect(t).toContain("Muelle 3");
    expect(t).toContain("sin ubicar");
  });
});
