import ExcelJS from "exceljs";
import { ETIQUETA_ESTADO, SIN_CATEGORIA, categoriaZona, fechaLarga, tinte, type Informe } from "./informe";
import type { Estado } from "@/articulos/modelo";

// Excel del stock: una hoja de resumen con los números clave y los avisos,
// otra con cada artículo (foto, total, estado, dónde está) y otra por zonas,
// con cada zona en su color del mapa. Listo para imprimir en A4.

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

const C = {
  verde: "FF166534",
  verdeOscuro: "FF14532D",
  verdeSuave: "FFBBF7D0",
  cebra: "FFF6FBF7",
  borde: "FFE2E8F0",
  gris: "FF64748B",
  fondoTarjeta: "FFF8FAFC",
  texto: "FF0F172A",
  azul: "FF0369A1",
  rojo: "FFB91C1C",
  ambar: "FFB45309",
  ambarFondo: "FFFEF3C7",
};

const COLOR_ESTADO: Record<Estado, { texto: string; fondo: string }> = {
  ok: { texto: "FF15803D", fondo: "FFDCFCE7" },
  "bajo-minimo": { texto: "FFB91C1C", fondo: "FFFEE2E2" },
  "sin-stock": { texto: "FF475569", fondo: "FFF1F5F9" },
};

const FUENTE = "Calibri";
const relleno = (color: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: color } });
const linea = (color = C.borde, style: ExcelJS.BorderStyle = "thin"): Partial<ExcelJS.Border> => ({ style, color: { argb: color } });

/** Banda verde de título que ocupa las `columnas` primeras columnas (filas 1 y 2). */
function cabecera(ws: ExcelJS.Worksheet, columnas: number, titulo: string, informe: Informe) {
  ws.mergeCells(1, 1, 1, columnas);
  ws.mergeCells(2, 1, 2, columnas);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { name: FUENTE, size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  t.alignment = { vertical: "middle", indent: 1 };
  const s = ws.getCell(2, 1);
  s.value = `Verdnatura · Nave Holland  ·  ${fechaLarga(informe.fecha)}${informe.autor ? `  ·  por ${informe.autor}` : ""}`;
  s.font = { name: FUENTE, size: 10, color: { argb: C.verdeSuave } };
  s.alignment = { vertical: "top", indent: 1 };
  for (let c = 1; c <= columnas; c++) {
    ws.getCell(1, c).fill = relleno(C.verde);
    ws.getCell(2, c).fill = relleno(C.verde);
  }
  ws.getRow(1).height = 36;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 10;
}

function preparar(ws: ExcelJS.Worksheet, horizontal: boolean) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: horizontal ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.25 },
  };
  ws.headerFooter.oddFooter = "&L&8Verdnatura · Stock del almacén&R&8Página &P de &N";
  ws.properties.defaultRowHeight = 18;
}

/** Fila de cabecera de tabla: verde con letras blancas. Por defecto, la primera columna a la izquierda y el resto centradas. */
function filaCabecera(ws: ExcelJS.Worksheet, fila: number, textos: string[], centrada: (i: number) => boolean = (i) => i > 0) {
  const r = ws.getRow(fila);
  textos.forEach((texto, i) => {
    const celda = r.getCell(i + 1);
    celda.value = texto;
    celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = relleno(C.verdeOscuro);
    celda.alignment = { vertical: "middle", horizontal: centrada(i) ? "center" : "left", indent: centrada(i) ? 0 : 1, wrapText: true };
    celda.border = { bottom: linea(C.verdeOscuro) };
  });
  r.height = 24;
}

/** Fila de datos con cebra suave y raya fina debajo. */
function estiloFila(r: ExcelJS.Row, columnas: number, par: boolean, primeraColumna = 1) {
  for (let c = primeraColumna; c < primeraColumna + columnas; c++) {
    const celda = r.getCell(c);
    celda.font = { name: FUENTE, size: 10, color: { argb: C.texto }, ...celda.font };
    celda.alignment = { vertical: "middle", wrapText: true, ...celda.alignment };
    celda.border = { bottom: linea() };
    if (par) celda.fill = relleno(C.cebra);
  }
}

function celdaEstado(celda: ExcelJS.Cell, estado: Estado) {
  celda.value = ETIQUETA_ESTADO[estado];
  celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: COLOR_ESTADO[estado].texto } };
  celda.fill = relleno(COLOR_ESTADO[estado].fondo);
  celda.alignment = { vertical: "middle", horizontal: "center" };
}

function titulo(ws: ExcelJS.Worksheet, fila: number, texto: string, columnas: number) {
  ws.mergeCells(fila, 1, fila, columnas);
  const celda = ws.getCell(fila, 1);
  celda.value = texto;
  celda.font = { name: FUENTE, size: 13, bold: true, color: { argb: C.verdeOscuro } };
  celda.alignment = { vertical: "bottom" };
  for (let c = 1; c <= columnas; c++) ws.getCell(fila, c).border = { bottom: linea(C.verde, "medium") };
  ws.getRow(fila).height = 26;
}

function hojaResumen(wb: ExcelJS.Workbook, informe: Informe) {
  const ws = wb.addWorksheet("Resumen", { properties: { tabColor: { argb: C.verde } }, views: [{ showGridLines: false }] });
  preparar(ws, false);
  ws.columns = [{ width: 30 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 17 }];
  cabecera(ws, 5, "Stock del almacén", informe);

  const { resumen: r } = informe;
  const tarjetas = [
    { etiqueta: "ARTÍCULOS", valor: r.articulos, pie: "en el catálogo", color: C.verde },
    { etiqueta: "CON STOCK", valor: r.conStock, pie: `de ${r.articulos}`, color: C.verde },
    { etiqueta: "ZONAS OCUPADAS", valor: r.zonasOcupadas, pie: "con algo dentro", color: C.azul },
    { etiqueta: "BAJO MÍNIMO", valor: r.bajoMinimo, pie: r.bajoMinimo ? "hay que reponer" : "todo en orden", color: r.bajoMinimo ? C.rojo : C.verde },
    { etiqueta: "SIN UBICAR", valor: r.sinUbicar, pie: r.sinUbicar ? "colocar en el mapa" : "todo colocado", color: r.sinUbicar ? C.ambar : C.verde },
  ];
  tarjetas.forEach((t, i) => {
    const col = i + 1;
    const [a, b, c] = [ws.getCell(5, col), ws.getCell(6, col), ws.getCell(7, col)];
    a.value = t.etiqueta;
    a.font = { name: FUENTE, size: 8, bold: true, color: { argb: C.gris } };
    b.value = t.valor;
    b.font = { name: FUENTE, size: 24, bold: true, color: { argb: t.color } };
    b.numFmt = "#,##0";
    c.value = t.pie;
    c.font = { name: FUENTE, size: 9, color: { argb: C.gris } };
    for (const celda of [a, b, c]) {
      celda.fill = relleno(C.fondoTarjeta);
      celda.alignment = { vertical: "middle", horizontal: "center" };
      celda.border = { left: linea("FFFFFFFF", "medium"), right: linea("FFFFFFFF", "medium") };
    }
    a.border = { ...a.border, top: linea(t.color, "thick") };
  });
  ws.getRow(5).height = 22;
  ws.getRow(6).height = 36;
  ws.getRow(7).height = 20;

  let fila = 9;
  titulo(ws, fila, "Por categoría", 5);
  fila += 1;
  filaCabecera(ws, fila, ["Categoría", "Artículos", "Con stock", "Bajo mínimo", "Sin ubicar"]);
  informe.categorias.forEach((c, i) => {
    const r = ws.getRow(++fila);
    r.values = [c.categoria, c.articulos, c.conStock, c.bajoMinimo, c.sinUbicar];
    estiloFila(r, 5, i % 2 === 1);
    r.getCell(1).font = { name: FUENTE, size: 10, bold: true, color: { argb: C.texto } };
    r.getCell(1).alignment = { vertical: "middle", indent: 1 };
    for (let col = 2; col <= 5; col++) r.getCell(col).alignment = { vertical: "middle", horizontal: "center" };
    if (c.bajoMinimo) r.getCell(4).font = { name: FUENTE, size: 10, bold: true, color: { argb: C.rojo } };
    if (c.sinUbicar) r.getCell(5).font = { name: FUENTE, size: 10, bold: true, color: { argb: C.ambar } };
    r.height = 20;
  });
  if (!informe.categorias.length) ws.getCell(++fila, 1).value = "No hay artículos en el catálogo.";

  fila += 2;
  titulo(ws, fila, "Avisos", 5);
  const bajos = informe.articulos.filter((f) => f.estado === "bajo-minimo");
  const sinUbicar = informe.articulos.filter((f) => f.sinUbicar > 0);
  if (!bajos.length && !sinUbicar.length) {
    const celda = ws.getCell(++fila, 1);
    ws.mergeCells(fila, 1, fila, 5);
    celda.value = "✓  Todo en orden: ningún artículo está por debajo de su mínimo y todo está colocado en el mapa.";
    celda.font = { name: FUENTE, size: 10, color: { argb: "FF15803D" } };
    celda.fill = relleno("FFF0FDF4");
    celda.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(fila).height = 24;
  }
  if (bajos.length) {
    fila += 1;
    filaCabecera(ws, fila, ["Por debajo del mínimo", "Categoría", "Hay", "Mínimo", "Faltan"]);
    bajos.forEach((f, i) => {
      const r = ws.getRow(++fila);
      r.values = [f.articulo.nombre, f.articulo.categoria || SIN_CATEGORIA, f.total, f.articulo.stockMinimo, (f.articulo.stockMinimo ?? 0) - f.total];
      estiloFila(r, 5, i % 2 === 1);
      r.getCell(1).alignment = { vertical: "middle", indent: 1 };
      for (let col = 2; col <= 5; col++) r.getCell(col).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(5).font = { name: FUENTE, size: 10, bold: true, color: { argb: C.rojo } };
    });
  }
  if (sinUbicar.length) {
    fila += bajos.length ? 2 : 1;
    filaCabecera(ws, fila, ["Con cantidades sin ubicar", "Categoría", "Sin ubicar", "Unidad", ""]);
    sinUbicar.forEach((f, i) => {
      const r = ws.getRow(++fila);
      r.values = [f.articulo.nombre, f.articulo.categoria || SIN_CATEGORIA, f.sinUbicar, f.articulo.unidad, ""];
      estiloFila(r, 5, i % 2 === 1);
      r.getCell(1).alignment = { vertical: "middle", indent: 1 };
      for (let col = 2; col <= 4; col++) r.getCell(col).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(3).font = { name: FUENTE, size: 10, bold: true, color: { argb: C.ambar } };
    });
  }
}

function hojaArticulos(wb: ExcelJS.Workbook, informe: Informe, fotos: Map<string, string>) {
  const ws = wb.addWorksheet("Por artículo", { properties: { tabColor: { argb: "FF22C55E" } } });
  preparar(ws, true);
  const conFotos = fotos.size > 0;
  const columnas = [
    ...(conFotos ? [{ titulo: "Foto", ancho: 10 }] : []),
    { titulo: "Artículo", ancho: 30 },
    { titulo: "Categoría", ancho: 16 },
    { titulo: "Total", ancho: 9 },
    { titulo: "Unidad", ancho: 11 },
    { titulo: "Mínimo", ancho: 9 },
    { titulo: "Estado", ancho: 13 },
    { titulo: "Dónde está", ancho: 30 },
    { titulo: "Características", ancho: 34 },
    { titulo: "Descripción", ancho: 40 },
  ];
  ws.columns = columnas.map((c) => ({ width: c.ancho }));
  const n = columnas.length;
  const col = (titulo: string) => columnas.findIndex((c) => c.titulo === titulo) + 1;
  cabecera(ws, n, "Stock por artículo", informe);
  const CENTRADAS = ["Foto", "Total", "Unidad", "Mínimo", "Estado"];
  filaCabecera(ws, 4, columnas.map((c) => c.titulo), (i) => CENTRADAS.includes(columnas[i].titulo));
  ws.views = [{ state: "frozen", ySplit: 4, xSplit: col("Artículo"), showGridLines: false }];
  ws.autoFilter = { from: { row: 4, column: col("Artículo") }, to: { row: 4, column: n } };
  ws.pageSetup.printTitlesRow = "4:4";

  informe.articulos.forEach((f, i) => {
    const filaN = 5 + i;
    const r = ws.getRow(filaN);
    const a = f.articulo;
    r.getCell(col("Artículo")).value = a.nombre;
    r.getCell(col("Categoría")).value = a.categoria || SIN_CATEGORIA;
    r.getCell(col("Total")).value = f.total;
    r.getCell(col("Unidad")).value = a.unidad;
    r.getCell(col("Mínimo")).value = a.stockMinimo ?? "—";

    const donde: ExcelJS.RichText[] = [];
    f.zonas.forEach((z, j) => {
      if (j) donde.push({ text: "\n" });
      donde.push({ text: `${z.zona.nombre}  `, font: { name: FUENTE, size: 10 } }, { text: String(z.cantidad), font: { name: FUENTE, size: 10, bold: true } });
    });
    if (f.sinUbicar) {
      if (donde.length) donde.push({ text: "\n" });
      donde.push({ text: `Sin ubicar  ${f.sinUbicar}`, font: { name: FUENTE, size: 10, bold: true, color: { argb: C.ambar } } });
    }
    r.getCell(col("Dónde está")).value = donde.length ? { richText: donde } : "—";

    const caracteristicas: ExcelJS.RichText[] = [];
    a.caracteristicas.forEach((c, j) => {
      if (j) caracteristicas.push({ text: "\n" });
      caracteristicas.push(
        { text: c.nombre ? `${c.nombre}: ` : "", font: { name: FUENTE, size: 10, color: { argb: C.gris } } },
        { text: c.valor, font: { name: FUENTE, size: 10 } },
      );
    });
    r.getCell(col("Características")).value = caracteristicas.length ? { richText: caracteristicas } : "";
    r.getCell(col("Descripción")).value = a.descripcion;

    estiloFila(r, n, i % 2 === 1);
    r.getCell(col("Artículo")).font = { name: FUENTE, size: 11, bold: true, color: { argb: C.texto } };
    r.getCell(col("Artículo")).alignment = { vertical: "middle", wrapText: true, indent: 1 };
    r.getCell(col("Categoría")).font = { name: FUENTE, size: 10, color: { argb: C.gris } };
    const totalCelda = r.getCell(col("Total"));
    totalCelda.font = { name: FUENTE, size: 12, bold: true, color: { argb: C.texto } };
    totalCelda.numFmt = "#,##0";
    for (const t of ["Total", "Unidad", "Mínimo"]) r.getCell(col(t)).alignment = { vertical: "middle", horizontal: "center" };
    celdaEstado(r.getCell(col("Estado")), f.estado);

    const lineas = Math.max(f.zonas.length + (f.sinUbicar ? 1 : 0), a.caracteristicas.length, Math.ceil(a.descripcion.length / 45), 1);
    r.height = Math.max(conFotos ? 54 : 22, lineas * 14 + 8);

    const foto = fotos.get(a.id);
    if (foto) {
      const imagen = wb.addImage({ base64: foto.replace(/^data:image\/\w+;base64,/, ""), extension: "jpeg" });
      ws.addImage(imagen, { tl: { col: 0.1, row: filaN - 1 + 0.06 }, ext: { width: 64, height: 64 }, editAs: "oneCell" });
    }
  });

  const pie = ws.getCell(5 + informe.articulos.length + 1, col("Artículo"));
  pie.value = `${informe.articulos.length} artículos`;
  pie.font = { name: FUENTE, size: 9, italic: true, color: { argb: C.gris } };
}

function hojaZonas(wb: ExcelJS.Workbook, informe: Informe) {
  const ws = wb.addWorksheet("Por zona", { properties: { tabColor: { argb: C.azul } }, views: [{ showGridLines: false }] });
  preparar(ws, true);
  ws.columns = [{ width: 36 }, { width: 18 }, { width: 12 }, { width: 13 }, { width: 44 }];
  cabecera(ws, 5, "Stock por zona", informe);

  let fila = 4;
  if (!informe.zonas.length) ws.getCell(fila, 1).value = "No hay nada apuntado en ninguna zona.";
  for (const g of informe.zonas) {
    const color = g.zona ? argb(g.zona.color) : C.ambar;
    const fondo = g.zona ? argb(tinte(g.zona.color)) : C.ambarFondo;

    ws.mergeCells(fila, 1, fila, 5);
    const cab = ws.getCell(fila, 1);
    const articulos = g.filas.length === 1 ? "1 artículo" : `${g.filas.length} artículos`;
    const categoria = g.zona ? categoriaZona(g.zona) : "";
    cab.value = {
      richText: [
        { text: "●  ", font: { name: FUENTE, size: 13, color: { argb: color } } },
        { text: g.zona ? g.zona.nombre : "Sin ubicar", font: { name: FUENTE, size: 12, bold: true, color: { argb: C.texto } } },
        {
          text: g.zona ? `     ${categoria ? `${categoria}  ·  ` : ""}${articulos}` : `     zona borrada del mapa  ·  ${articulos}`,
          font: { name: FUENTE, size: 10, color: { argb: C.gris } },
        },
      ],
    };
    cab.alignment = { vertical: "middle", indent: 1 };
    for (let c = 1; c <= 5; c++) ws.getCell(fila, c).fill = relleno(fondo);
    cab.border = { left: linea(color, "thick") };
    ws.getRow(fila).height = 26;

    fila += 1;
    ["Artículo", "Categoría", "Cantidad", "Unidad", "Nota"].forEach((t, i) => {
      const celda = ws.getCell(fila, i + 1);
      celda.value = t;
      celda.font = { name: FUENTE, size: 9, bold: true, color: { argb: C.gris } };
      celda.alignment = { vertical: "middle", horizontal: i === 2 || i === 3 ? "center" : "left", indent: i === 0 ? 1 : 0 };
      celda.border = { bottom: linea(C.borde) };
    });
    ws.getRow(fila).height = 18;

    g.filas.forEach((x, i) => {
      const r = ws.getRow(++fila);
      r.values = [x.articulo.nombre, x.articulo.categoria || SIN_CATEGORIA, x.cantidad, x.articulo.unidad, x.nota];
      estiloFila(r, 5, i % 2 === 1);
      r.getCell(1).font = { name: FUENTE, size: 10, bold: true, color: { argb: C.texto } };
      r.getCell(1).alignment = { vertical: "middle", indent: 1, wrapText: true };
      r.getCell(2).font = { name: FUENTE, size: 10, color: { argb: C.gris } };
      r.getCell(3).font = { name: FUENTE, size: 11, bold: true, color: { argb: C.texto } };
      r.getCell(3).numFmt = "#,##0";
      r.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
      r.getCell(4).alignment = { vertical: "middle", horizontal: "center" };
      r.height = 20;
    });
    fila += 2;
  }
}

/** Genera el Excel. `fotos`: miniaturas por id de artículo (vacío = sin fotos). */
export async function crearExcel(informe: Informe, fotos: Map<string, string> = new Map()) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Verdnatura · Stock";
  wb.created = informe.fecha;
  wb.title = "Stock del almacén";
  hojaResumen(wb, informe);
  hojaArticulos(wb, informe, fotos);
  hojaZonas(wb, informe);
  return wb.xlsx.writeBuffer();
}
