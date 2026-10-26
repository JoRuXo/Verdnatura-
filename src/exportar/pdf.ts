import { jsPDF } from "jspdf";
import { autoTable, type CellHookData, type RowInput } from "jspdf-autotable";
import { ETIQUETA_ESTADO, SIN_CATEGORIA, categoriaZona, fechaLarga, tinte, type Informe } from "./informe";
import type { Estado } from "@/articulos/modelo";

// PDF del stock: el mismo contenido que el Excel (resumen, por artículo con
// foto y por zona con su color), en A4 apaisado.

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const VERDE = rgb("#166534");
const VERDE_OSCURO = rgb("#14532d");
const VERDE_SUAVE = rgb("#bbf7d0");
const CEBRA = rgb("#f6fbf7");
const TEXTO = rgb("#0f172a");
const GRIS = rgb("#64748b");
const BORDE = rgb("#e2e8f0");
const ROJO = rgb("#b91c1c");
const AMBAR = rgb("#b45309");
const AZUL = rgb("#0369a1");

const COLOR_ESTADO: Record<Estado, { texto: RGB; fondo: RGB }> = {
  ok: { texto: rgb("#15803d"), fondo: rgb("#dcfce7") },
  "bajo-minimo": { texto: rgb("#b91c1c"), fondo: rgb("#fee2e2") },
  "sin-stock": { texto: rgb("#475569"), fondo: rgb("#f1f5f9") },
};

/** Caracteres de fuera del juego latino que sí tienen un equivalente claro. */
const SUSTITUTOS: Record<number, string> = {
  0x2018: "'",
  0x2019: "'",
  0x201c: '"',
  0x201d: '"',
  0x2013: "-",
  0x2014: "-",
  0x2026: "...",
  0x2192: "->",
};

/**
 * Las fuentes de serie del PDF solo tienen los caracteres latinos básicos
 * (tildes, eñes, «», · sí): lo demás se cambia por algo equivalente.
 */
const limpio = (s: string) =>
  Array.from(s, (ch) => {
    const codigo = ch.codePointAt(0) ?? 0;
    return codigo <= 0xff ? ch : SUSTITUTOS[codigo] ?? "?";
  }).join("");

const MARGEN = 12;

function cabecera(doc: jsPDF, informe: Informe, titulo: string) {
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, ancho, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(titulo, MARGEN, 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...VERDE_SUAVE);
  doc.text("Verdnatura · Nave Holland", MARGEN, 17.5);
  doc.text(limpio(`${fechaLarga(informe.fecha)}${informe.autor ? ` · por ${informe.autor}` : ""}`), ancho - MARGEN, 17.5, { align: "right" });
}

function tituloSeccion(doc: jsPDF, texto: string, y: number) {
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...VERDE_OSCURO);
  doc.text(texto, MARGEN, y);
  doc.setDrawColor(...VERDE);
  doc.setLineWidth(0.5);
  doc.line(MARGEN, y + 1.8, ancho - MARGEN, y + 1.8);
}

function tarjetas(doc: jsPDF, informe: Informe, y: number) {
  const { resumen: r } = informe;
  const lista = [
    { etiqueta: "ARTÍCULOS", valor: r.articulos, pie: "en el catálogo", color: VERDE },
    { etiqueta: "CON STOCK", valor: r.conStock, pie: `de ${r.articulos}`, color: VERDE },
    { etiqueta: "ZONAS OCUPADAS", valor: r.zonasOcupadas, pie: "con algo dentro", color: AZUL },
    { etiqueta: "BAJO MÍNIMO", valor: r.bajoMinimo, pie: r.bajoMinimo ? "hay que reponer" : "todo en orden", color: r.bajoMinimo ? ROJO : VERDE },
    { etiqueta: "SIN UBICAR", valor: r.sinUbicar, pie: r.sinUbicar ? "colocar en el mapa" : "todo colocado", color: r.sinUbicar ? AMBAR : VERDE },
  ];
  const ancho = doc.internal.pageSize.getWidth();
  const hueco = 4;
  const w = (ancho - 2 * MARGEN - hueco * (lista.length - 1)) / lista.length;
  lista.forEach((t, i) => {
    const x = MARGEN + i * (w + hueco);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, 22, 1.5, 1.5, "FD");
    doc.setFillColor(...t.color);
    doc.rect(x, y, w, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text(t.etiqueta, x + w / 2, y + 6, { align: "center" });
    doc.setFontSize(17);
    doc.setTextColor(...t.color);
    doc.text(String(t.valor), x + w / 2, y + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(t.pie, x + w / 2, y + 19, { align: "center" });
  });
  return y + 22;
}

const estilosTabla = {
  theme: "plain" as const,
  margin: { left: MARGEN, right: MARGEN, top: 28, bottom: 14 },
  styles: { font: "helvetica", fontSize: 8.5, textColor: TEXTO, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 }, valign: "middle" as const, lineColor: BORDE },
  headStyles: { fillColor: VERDE_OSCURO, textColor: [255, 255, 255] as RGB, fontStyle: "bold" as const, fontSize: 8.5 },
  alternateRowStyles: { fillColor: CEBRA },
  bodyStyles: { lineWidth: { bottom: 0.15 } },
};

/** Genera el PDF. `fotos`: miniaturas por id de artículo (vacío = sin fotos). */
export function crearPdf(informe: Informe, fotos: Map<string, string> = new Map()) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({ title: "Stock del almacén", creator: "Verdnatura · Stock" });
  const conFotos = fotos.size > 0;

  // Página 1: resumen y por artículo
  cabecera(doc, informe, "Stock del almacén");
  let y = tarjetas(doc, informe, 28) + 10;

  const bajos = informe.articulos.filter((f) => f.estado === "bajo-minimo");
  if (bajos.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...ROJO);
    const texto = limpio(`Por debajo del mínimo: ${bajos.map((f) => `${f.articulo.nombre} (${f.total} de ${f.articulo.stockMinimo})`).join(", ")}`);
    const lineas = doc.splitTextToSize(texto, doc.internal.pageSize.getWidth() - 2 * MARGEN);
    doc.text(lineas, MARGEN, y - 3);
    y += lineas.length * 4;
  }

  tituloSeccion(doc, "Stock por artículo", y);
  const cabeceraArticulos = [...(conFotos ? [""] : []), "Artículo", "Categoría", "Total", "Unidad", "Mínimo", "Estado", "Dónde está"];
  const colFoto = conFotos ? 0 : -1;
  const colEstado = cabeceraArticulos.indexOf("Estado");
  const colTotal = cabeceraArticulos.indexOf("Total");
  const cuerpo: RowInput[] = informe.articulos.map((f) => [
    ...(conFotos ? [""] : []),
    limpio(f.articulo.nombre),
    limpio(f.articulo.categoria || SIN_CATEGORIA),
    String(f.total),
    limpio(f.articulo.unidad),
    f.articulo.stockMinimo == null ? "-" : String(f.articulo.stockMinimo),
    ETIQUETA_ESTADO[f.estado],
    limpio(
      [...f.zonas.map((z) => `${z.zona.nombre}: ${z.cantidad}`), ...(f.sinUbicar ? [`Sin ubicar: ${f.sinUbicar}`] : [])].join("\n") || "-",
    ),
  ]);

  autoTable(doc, {
    ...estilosTabla,
    startY: y + 5,
    head: [cabeceraArticulos],
    body: cuerpo.length ? cuerpo : [[{ content: "No hay artículos en el catálogo.", colSpan: cabeceraArticulos.length }]],
    columnStyles: {
      ...(conFotos ? { 0: { cellWidth: 16, minCellHeight: 15 } } : {}),
      [colFoto + 1]: { fontStyle: "bold", fontSize: 9.5, cellWidth: 62 },
      [colFoto + 2]: { textColor: GRIS, cellWidth: 34 },
      [colTotal]: { halign: "center", fontStyle: "bold", fontSize: 10.5, cellWidth: 16 },
      [colFoto + 4]: { halign: "center", cellWidth: 20 },
      [colFoto + 5]: { halign: "center", cellWidth: 16 },
      [colEstado]: { halign: "center", fontStyle: "bold", cellWidth: 24 },
    },
    didParseCell: (d: CellHookData) => {
      if (d.section !== "body" || !informe.articulos.length) return;
      if (d.column.index === colEstado) {
        const estado = informe.articulos[d.row.index].estado;
        d.cell.styles.textColor = COLOR_ESTADO[estado].texto;
        d.cell.styles.fillColor = COLOR_ESTADO[estado].fondo;
      }
    },
    didDrawCell: (d: CellHookData) => {
      if (d.section !== "body" || d.column.index !== colFoto || !informe.articulos.length) return;
      const foto = fotos.get(informe.articulos[d.row.index].articulo.id);
      if (!foto) return;
      const lado = Math.min(d.cell.width, d.cell.height) - 2.4;
      doc.addImage(foto, "JPEG", d.cell.x + (d.cell.width - lado) / 2, d.cell.y + (d.cell.height - lado) / 2, lado, lado);
    },
    willDrawPage: () => cabecera(doc, informe, "Stock del almacén"),
  });

  // Por zona: cada zona con una banda de su color del mapa
  doc.addPage();
  cabecera(doc, informe, "Stock por zona");
  const filasZona: RowInput[] = [];
  const colorFila: (RGB | null)[] = [];
  for (const g of informe.zonas) {
    const color = g.zona ? rgb(g.zona.color) : AMBAR;
    const n = g.filas.length === 1 ? "1 artículo" : `${g.filas.length} artículos`;
    const categoria = g.zona ? categoriaZona(g.zona) : "";
    filasZona.push([
      {
        content: limpio(g.zona ? `${g.zona.nombre}    ${categoria ? `${categoria} · ` : ""}${n}` : `Sin ubicar    zona borrada del mapa · ${n}`),
        colSpan: 5,
        styles: { fillColor: g.zona ? rgb(tinte(g.zona.color)) : rgb("#fef3c7"), fontStyle: "bold", fontSize: 10, cellPadding: { top: 2.6, bottom: 2.6, left: 5, right: 2 } },
      },
    ]);
    colorFila.push(color);
    for (const x of g.filas) {
      filasZona.push([limpio(x.articulo.nombre), limpio(x.articulo.categoria || SIN_CATEGORIA), String(x.cantidad), limpio(x.articulo.unidad), limpio(x.nota)]);
      colorFila.push(null);
    }
  }
  autoTable(doc, {
    ...estilosTabla,
    startY: 30,
    head: [["Artículo", "Categoría", "Cantidad", "Unidad", "Nota"]],
    body: filasZona.length ? filasZona : [[{ content: "No hay nada apuntado en ninguna zona.", colSpan: 5 }]],
    alternateRowStyles: {},
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      1: { textColor: GRIS, cellWidth: 45 },
      2: { halign: "center", fontStyle: "bold", fontSize: 10, cellWidth: 22 },
      3: { halign: "center", cellWidth: 24 },
    },
    didDrawCell: (d: CellHookData) => {
      const color = d.section === "body" ? colorFila[d.row.index] : null;
      if (!color || d.column.index !== 0) return;
      doc.setFillColor(...color);
      doc.rect(d.cell.x, d.cell.y, 1.6, d.cell.height, "F");
    },
    willDrawPage: (d) => {
      if (d.pageNumber > 1) cabecera(doc, informe, "Stock por zona");
    },
  });

  // Pie con número de página en todas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const { width, height } = doc.internal.pageSize;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text("Verdnatura · Stock del almacén", MARGEN, height - 6);
    doc.text(`Página ${p} de ${total}`, width - MARGEN, height - 6, { align: "right" });
  }

  return doc.output("arraybuffer");
}
