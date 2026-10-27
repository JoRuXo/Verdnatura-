import { describe, expect, it } from "vitest";
import { normalizar, puntuar } from "./texto";

describe("buscar sin importar tildes ni mayúsculas", () => {
  it("normaliza", () => {
    expect(normalizar("  Cartón ÑANDÚ ")).toBe("carton nandu");
  });

  it("encuentra por nombre aunque falten las tildes", () => {
    expect(puntuar("carton", "Cartón")).toBeGreaterThan(0);
    expect(puntuar("CARTÓN", "carton")).toBeGreaterThan(0);
  });

  it("exige todas las palabras, en el nombre o en lo demás", () => {
    expect(puntuar("caja 60", "Caja grande", ["Medidas", "60 x 40 cm"])).toBeGreaterThan(0);
    expect(puntuar("caja 70", "Caja grande", ["Medidas", "60 x 40 cm"])).toBe(0);
  });

  it("pone delante lo que encaja mejor", () => {
    const exacto = puntuar("film", "Film");
    const empieza = puntuar("film", "Film estirable");
    const dentro = puntuar("film", "Rollo de film");
    const soloEnDatos = puntuar("film", "Rollo", ["film"]);
    expect(exacto).toBeGreaterThan(empieza);
    expect(empieza).toBeGreaterThan(dentro);
    expect(dentro).toBeGreaterThan(soloEnDatos);
  });
});
