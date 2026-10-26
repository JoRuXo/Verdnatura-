import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ELEMENTOS_DE_SERIE } from "@/nave/elementos";
import type { Articulo } from "@/articulos/modelo";
import { prepararInforme, tinte } from "./informe";
import { crearExcel } from "./excel";
import { crearPdf } from "./pdf";

const articulo = (a: Partial<Articulo> & Pick<Articulo, "id" | "nombre">): Articulo => ({
  categoria: "",
  descripcion: "",
  unidad: "unidades",
  caracteristicas: [],
  fotos: [],
  stockMinimo: null,
  existencias: [],
  ...a,
});

const ARTICULOS: Articulo[] = [
  articulo({
    id: "carro",
    nombre: "Carro CC",
    categoria: "Carros",
    unidad: "carros",
    descripcion: "Carro danés de Container Centralen, con baldas.",
    fotos: ["carros/carro-cc.png"],
    stockMinimo: 40,
    existencias: [
      { id: "e1", elementoId: "cc-tumbados", cantidad: 18, nota: "" },
      { id: "e2", elementoId: "carton", cantidad: 12, nota: "Apilados junto a la pared" },
    ],
  }),
  articulo({
    id: "film",
    nombre: "Film estirable 23 µ",
    categoria: "Embalaje",
    unidad: "rollos",
    caracteristicas: [
      { nombre: "Medidas", valor: "500 mm × 1500 m" },
      { nombre: "Proveedor", valor: "Plásticos Levante" },
    ],
    existencias: [
      { id: "e3", elementoId: "estanteria", cantidad: 24, nota: "" },
      { id: "e4", elementoId: null, cantidad: 6, nota: "" },
    ],
  }),
  articulo({ id: "cubo", nombre: "Cubo 30 L — “negro”", categoria: "", unidad: "cubos", existencias: [] }),
];

describe("informe de stock", () => {
  const informe = prepararInforme(ARTICULOS, ELEMENTOS_DE_SERIE, "Alberto", new Date(2026, 9, 27, 10, 32));

  it("cuenta totales, mínimos y lo que está sin ubicar", () => {
    expect(informe.resumen).toEqual({ articulos: 3, conStock: 2, zonasOcupadas: 3, bajoMinimo: 1, sinUbicar: 1 });
    const carro = informe.articulos.find((f) => f.articulo.id === "carro")!;
    expect(carro.total).toBe(30);
    expect(carro.estado).toBe("bajo-minimo");
    expect(carro.zonas.map((z) => z.cantidad)).toEqual([18, 12]);
    expect(informe.articulos.find((f) => f.articulo.id === "film")!.sinUbicar).toBe(6);
  });

  it("ordena por categoría (las vacías al final) y deja «Sin ubicar» para el final de las zonas", () => {
    expect(informe.articulos.map((f) => f.articulo.id)).toEqual(["carro", "film", "cubo"]);
    expect(informe.zonas.at(-1)!.zona).toBeNull();
  });

  it("aclara los colores de zona para los fondos", () => {
    expect(tinte("#000000", 0.5)).toBe("#808080");
    expect(tinte("no-es-color")).toBe("#f1f5f9");
  });

  it("genera un Excel con sus tres hojas", async () => {
    const datos = await crearExcel(informe);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(datos);
    expect(wb.worksheets.map((h) => h.name)).toEqual(["Resumen", "Por artículo", "Por zona"]);
    const hoja = wb.getWorksheet("Por artículo")!;
    expect(hoja.getCell("A4").value).toBe("Artículo");
    expect(hoja.getCell("A5").value).toBe("Carro CC");
    expect(hoja.getCell("C5").value).toBe(30);
  });

  it("genera un PDF", () => {
    const datos = new Uint8Array(crearPdf(informe));
    expect(new TextDecoder().decode(datos.slice(0, 5))).toBe("%PDF-");
  });

  // Con EJEMPLOS_EXPORTAR=<carpeta> guarda los ficheros para mirarlos a ojo
  it.runIf(!!process.env.EJEMPLOS_EXPORTAR)("guarda ejemplos para revisarlos", async () => {
    const carpeta = process.env.EJEMPLOS_EXPORTAR!;
    const foto = process.env.FOTO_EJEMPLO ? readFileSync(process.env.FOTO_EJEMPLO, "utf8") : null;
    const fotos = new Map(foto ? [["carro", foto]] : []);
    writeFileSync(join(carpeta, "ejemplo.xlsx"), Buffer.from(await crearExcel(informe, fotos)));
    writeFileSync(join(carpeta, "ejemplo.pdf"), Buffer.from(crearPdf(informe, fotos)));
  });
});
