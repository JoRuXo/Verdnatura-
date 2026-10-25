import { useEffect, useMemo, useState } from "react";
import { Boxes, Download, FileSpreadsheet, Package, Printer, Search, Store, Tags } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SIN_CATEGORIA, categoriaArticulo, colorCategoria } from "@/lib/categorias";
import { normalizarTexto, textoSeguro } from "@/lib/format";

const TODOS = "__todos__";

type Articulo = {
  id: string;
  nombre: string;
  categoria: string | null;
  cajas: number;
  unidades_por_caja: number;
  stock_minimo: number;
};

type Agrupado = {
  nombre: string;
  cajas: number;
  unidades: number;
  stock_minimo: number;
  palets: number;
};

type GrupoStock = {
  id: string;
  titulo: string;
  articulos: Agrupado[];
  cajas: number;
  unidades: number;
  palets: number;
};

function numero(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function badgeEstado(a: Agrupado) {
  const vacio = a.cajas === 0;
  const bajo  = !vacio && a.cajas < a.stock_minimo;
  if (vacio) return <span className="rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">Sin stock</span>;
  if (bajo)  return <span className="rounded-md bg-warning/15  px-2 py-1 text-xs font-semibold text-warning">Bajo</span>;
  return         <span className="rounded-md bg-success/15  px-2 py-1 text-xs font-semibold text-success">OK</span>;
}

// ── Exportar Excel (CSV con BOM — Excel lo abre directamente) ──────────────
function exportarExcel(grupos: GrupoStock[], resumen: { cajas: number; unidades: number; palets: number; bajos: number }) {
  const BOM = "﻿";
  const fecha = new Date().toLocaleDateString("es-ES");
  const lineas: string[] = [];

  // Título y fecha
  lineas.push(`"INVENTARIO STOCK TOTAL","Fecha: ${fecha}"`);
  lineas.push(`"Total cajas","${resumen.cajas}","Total unidades","${resumen.unidades}","Palets","${resumen.palets}","Bajo mínimo","${resumen.bajos}"`);
  lineas.push("");

  // Cabecera
  lineas.push(`"Categoría","Artículo","Palets","Cajas","Unidades","Stock mínimo","Estado"`);

  grupos.forEach((g) => {
    g.articulos.forEach((a) => {
      const estado = a.cajas === 0 ? "Sin stock" : a.cajas < a.stock_minimo ? "Bajo" : "OK";
      const cel = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      lineas.push([cel(g.titulo), cel(a.nombre), a.palets, a.cajas, a.unidades, a.stock_minimo, cel(estado)].join(","));
    });
    // Subtotal por categoría
    lineas.push([`"— Subtotal ${g.titulo}"`, `""`, g.palets, g.cajas, g.unidades, `""`, `""`].join(","));
    lineas.push("");
  });

  const blob = new Blob([BOM + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = `inventario-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast({ title: "Excel descargado ✓", description: "Abre el archivo .csv con Excel" });
}

// ── Exportar PDF (ventana de impresión del navegador) ─────────────────────
function exportarPDF(grupos: GrupoStock[], resumen: { cajas: number; unidades: number; palets: number; bajos: number }) {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const filas = grupos.map((g) => {
    const filasArticulos = g.articulos.map((a) => {
      const estado = a.cajas === 0 ? "Sin stock" : a.cajas < a.stock_minimo ? "Bajo" : "OK";
      const color  = a.cajas === 0 ? "#fee2e2" : a.cajas < a.stock_minimo ? "#fef9c3" : "#dcfce7";
      return `
        <tr>
          <td>${a.nombre}</td>
          <td class="num">${a.palets}</td>
          <td class="num">${a.cajas}</td>
          <td class="num">${a.unidades}</td>
          <td class="num">${a.stock_minimo}</td>
          <td class="num" style="background:${color};font-weight:600">${estado}</td>
        </tr>`;
    }).join("");

    return `
      <tr class="grupo-header">
        <td><strong>${g.titulo}</strong> — ${g.articulos.length} artículos</td>
        <td class="num">${g.palets}</td>
        <td class="num">${g.cajas}</td>
        <td class="num">${g.unidades}</td>
        <td class="num">—</td>
        <td class="num">—</td>
      </tr>
      ${filasArticulos}`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Inventario Stock Total — ${fecha}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #555; margin-bottom: 16px; }
    .resumen { display: flex; gap: 24px; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; background: #f9fafb; }
    .resumen div { text-align: center; }
    .resumen .num { font-size: 22px; font-weight: 700; }
    .resumen .lbl { font-size: 10px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #1e293b; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
    th.num, td.num { text-align: right; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
    tr.grupo-header td { background: #f1f5f9; font-weight: 600; border-top: 2px solid #cbd5e1; }
    tr:hover td { background: #f8fafc; }
    @page { size: A4 landscape; margin: 15mm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>📦 Inventario — Stock Total</h1>
  <div class="meta">Generado el ${fecha} · Verdnatura</div>
  <div class="resumen">
    <div><div class="num">${resumen.cajas}</div><div class="lbl">Total cajas</div></div>
    <div><div class="num">${resumen.unidades}</div><div class="lbl">Total unidades</div></div>
    <div><div class="num">${resumen.palets}</div><div class="lbl">Palets</div></div>
    <div><div class="num" style="color:${resumen.bajos > 0 ? '#dc2626' : '#16a34a'}">${resumen.bajos}</div><div class="lbl">Bajo mínimo</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Artículo</th>
        <th class="num">Palets</th>
        <th class="num">Cajas</th>
        <th class="num">Unidades</th>
        <th class="num">Mínimo</th>
        <th class="num">Estado</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
</body>
</html>`;

  const ventana = window.open("", "_blank", "width=1100,height=800");
  if (!ventana) { toast({ title: "Permite ventanas emergentes en el navegador", variant: "destructive" }); return; }
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => { ventana.print(); }, 500);
}

// ── Componente principal ───────────────────────────────────────────────────
const StockTotal = () => {
  const [items, setItems] = useState<Articulo[]>([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(TODOS);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("articulos")
        .select("id, nombre, categoria, cajas, unidades_por_caja, stock_minimo")
        .order("categoria", { ascending: true })
        .order("nombre", { ascending: true });
      if (error) { toast({ title: "Error al cargar", description: error.message, variant: "destructive" }); return; }
      setItems((data ?? []) as Articulo[]);
    };
    load();
  }, []);

  const categorias = useMemo(
    () => Array.from(new Set(items.map(categoriaArticulo))).sort((a, b) => {
      if (a === SIN_CATEGORIA) return 1;
      if (b === SIN_CATEGORIA) return -1;
      return a.localeCompare(b);
    }),
    [items],
  );

  const grupos = useMemo(() => {
    const filtro = normalizarTexto(filtroTexto);
    const porGrupo = new Map<string, Map<string, Agrupado>>();

    items.forEach((a) => {
      const categoria = categoriaArticulo(a);
      if (filtroCategoria !== TODOS && categoria !== filtroCategoria) return;
      const textoBusqueda = normalizarTexto(`${a.nombre ?? ""} ${categoria}`);
      if (filtro && !textoBusqueda.includes(filtro)) return;

      if (!porGrupo.has(categoria)) porGrupo.set(categoria, new Map());
      const grupo = porGrupo.get(categoria)!;
      const key   = normalizarTexto(a.nombre);
      const prev  = grupo.get(key) ?? { nombre: textoSeguro(a.nombre, "Sin nombre"), cajas: 0, unidades: 0, stock_minimo: numero(a.stock_minimo), palets: 0 };

      const cajas = numero(a.cajas);
      prev.cajas        += cajas;
      prev.unidades     += cajas * numero(a.unidades_por_caja);
      prev.stock_minimo  = Math.max(prev.stock_minimo, numero(a.stock_minimo));
      prev.palets       += 1;
      grupo.set(key, prev);
    });

    return categorias
      .filter((c) => porGrupo.has(c))
      .map((c): GrupoStock => {
        const articulos = Array.from(porGrupo.get(c)!.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        return {
          id: `categoria-${normalizarTexto(c)}`,
          titulo: c,
          articulos,
          cajas: articulos.reduce((s, a) => s + a.cajas, 0),
          unidades: articulos.reduce((s, a) => s + a.unidades, 0),
          palets: articulos.reduce((s, a) => s + a.palets, 0),
        };
      });
  }, [items, categorias, filtroTexto, filtroCategoria]);

  const resumen = useMemo(() => {
    let cajas = 0, unidades = 0, palets = 0, bajos = 0;
    grupos.forEach((g) => { cajas += g.cajas; unidades += g.unidades; palets += g.palets; bajos += g.articulos.filter((a) => a.cajas < a.stock_minimo).length; });
    return { cajas, unidades, palets, bajos };
  }, [grupos]);

  const defaultOpen = useMemo(() => grupos.slice(0, 6).map((g) => g.id), [grupos]);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Stock total</h1>
          <p className="mt-1 text-muted-foreground">Agrupado por categoría de artículo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar artículo o categoría…" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas las categorías</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: colorCategoria(c === SIN_CATEGORIA ? null : c) }} />
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Botón exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportarExcel(grupos, resumen)} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                Descargar Excel (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportarPDF(grupos, resumen)} className="gap-2 cursor-pointer">
                <Printer className="h-4 w-4 text-red-600" />
                Imprimir / Guardar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Total de cajas</CardDescription><Boxes className="h-5 w-5 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-3xl font-bold text-foreground">{resumen.cajas}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Total de unidades</CardDescription><Package className="h-5 w-5 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-3xl font-bold text-foreground">{resumen.unidades}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Palets filtrados</CardDescription><Store className="h-5 w-5 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-3xl font-bold text-foreground">{resumen.palets}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>Artículos bajo mínimo</CardDescription><Tags className="h-5 w-5 text-muted-foreground" /></CardHeader>
          <CardContent><div className={resumen.bajos > 0 ? "text-3xl font-bold text-warning" : "text-3xl font-bold text-foreground"}>{resumen.bajos}</div></CardContent>
        </Card>
      </div>

      {/* Grupos */}
      {grupos.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No hay artículos para mostrar.</CardContent></Card>
      ) : (
        <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
          {grupos.map((g) => (
            <AccordionItem key={g.id} value={g.id} className="rounded-lg border bg-card px-4 shadow-sm">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full flex-wrap items-center justify-between gap-3 pr-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: colorCategoria(g.titulo === SIN_CATEGORIA ? null : g.titulo) }} />
                    <CardTitle className="text-xl">{g.titulo}</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span><span className="font-semibold text-foreground">{g.articulos.length}</span> artículos</span>
                    <span><span className="font-semibold text-foreground">{g.palets}</span> palets</span>
                    <span><span className="font-semibold text-foreground">{g.cajas}</span> cajas</span>
                    <span><span className="font-semibold text-foreground">{g.unidades}</span> unidades</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artículo</TableHead>
                        <TableHead className="text-right">Palets</TableHead>
                        <TableHead className="text-right">Cajas</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="text-right">Stock mínimo</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.articulos.map((a) => (
                        <TableRow key={`${g.id}-${a.nombre}`}>
                          <TableCell className="min-w-[220px] font-medium">{textoSeguro(a.nombre, "Sin nombre")}</TableCell>
                          <TableCell className="text-right">{a.palets}</TableCell>
                          <TableCell className="text-right font-semibold">{a.cajas}</TableCell>
                          <TableCell className="text-right font-semibold">{a.unidades}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{a.stock_minimo}</TableCell>
                          <TableCell className="text-right">{badgeEstado(a)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default StockTotal;
