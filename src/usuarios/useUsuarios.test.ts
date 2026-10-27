import { describe, expect, it } from "vitest";
import { generarContrasena } from "./useUsuarios";

describe("contraseña provisional", () => {
  it("es fácil de dictar: cuatro letras, cuatro cifras y cuatro letras", () => {
    for (let i = 0; i < 50; i++) expect(generarContrasena()).toMatch(/^[a-z]{4}-[2-9]{4}-[a-z]{4}$/);
  });

  it("no usa letras que se confunden con cifras", () => {
    for (let i = 0; i < 50; i++) expect(generarContrasena()).not.toMatch(/[ilo01]/);
  });

  it("sale distinta cada vez", () => {
    expect(new Set(Array.from({ length: 20 }, generarContrasena)).size).toBe(20);
  });
});
