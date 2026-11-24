import { describe, expect, it } from "vitest";
import { deFila, describir, nombreAutor, type Cambio } from "./modelo";

const cambio = (c: Partial<Cambio>): Cambio => ({
  id: 1,
  fecha: new Date("2026-10-27T10:00:00Z"),
  autor: "Ana",
  tipo: "stock",
  accion: "cambio",
  articuloId: "a",
  articuloNombre: "Carro CC",
  unidad: "carros",
  elementoId: "z",
  elementoNombre: "Muelle 3",
  antes: 5,
  despues: 8,
  detalle: "",
  ...c,
});

describe("describir un cambio", () => {
  it("cambio de cantidad: antes → después y la diferencia con su signo", () => {
    const d = describir(cambio({}));
    expect(d.texto).toBe("Carro CC en Muelle 3");
    expect(d.detalle).toBe("5 → 8 carros");
    expect(d.diferencia).toBe(3);
    expect(describir(cambio({ antes: 8, despues: 5 })).diferencia).toBe(-3);
  });

  it("alta y baja de una cantidad en una zona", () => {
    const alta = describir(cambio({ accion: "alta", antes: null, despues: 4 }));
    expect(alta.texto).toBe("Carro CC: puesto en Muelle 3");
    expect(alta.detalle).toBe("4 carros");
    const baja = describir(cambio({ accion: "baja", antes: 4, despues: null }));
    expect(baja.texto).toBe("Carro CC: quitado de Muelle 3");
    expect(baja.detalle).toBe("tenía 4 carros");
  });

  it("traslado sin cambio de cantidad no marca diferencia", () => {
    const d = describir(cambio({ accion: "traslado", antes: 4, despues: 4, detalle: "desde Frío" }));
    expect(d.diferencia).toBeNull();
    expect(d.detalle).toBe("desde Frío · 4 carros");
    expect(describir(cambio({ accion: "traslado", antes: 4, despues: 6 })).diferencia).toBe(2);
  });

  it("los cambios de artículos y del mapa no llevan diferencia", () => {
    expect(describir(cambio({ tipo: "articulo", accion: "alta" })).texto).toBe("Artículo nuevo: Carro CC");
    expect(describir(cambio({ tipo: "articulo", accion: "baja", antes: 12 })).detalle).toBe("tenía 12 carros en total");
    expect(describir(cambio({ tipo: "articulo", accion: "baja", antes: null })).detalle).toBe("");
    expect(describir(cambio({ tipo: "articulo", accion: "cambio", detalle: "foto" })).texto).toBe("Ficha de Carro CC cambiada");
    expect(describir(cambio({ tipo: "mapa", accion: "alta" })).texto).toBe("Mapa: añadido «Muelle 3»");
    expect(describir(cambio({ tipo: "mapa", accion: "baja" })).texto).toBe("Mapa: borrado «Muelle 3»");
    expect(describir(cambio({ tipo: "mapa", accion: "cambio" })).diferencia).toBeNull();
  });
});

describe("fila del historial", () => {
  it("convierte la fecha y los nombres de columna", () => {
    const c = deFila({
      id: 9,
      fecha: "2026-10-27T10:00:00Z",
      autor: "Ana",
      tipo: "stock",
      accion: "alta",
      articulo_id: "a",
      articulo_nombre: "X",
      unidad: "u",
      elemento_id: null,
      elemento_nombre: "",
      cantidad_antes: null,
      cantidad_despues: 3,
      detalle: "",
    } as Parameters<typeof deFila>[0]);
    expect(c.fecha).toBeInstanceOf(Date);
    expect(c.fecha.toISOString()).toBe("2026-10-27T10:00:00.000Z");
    expect(c.antes).toBeNull();
    expect(c.despues).toBe(3);
  });

  it("sin autor se enseña «Sin nombre»", () => {
    expect(nombreAutor("")).toBe("Sin nombre");
    expect(nombreAutor("Ana")).toBe("Ana");
  });
});
