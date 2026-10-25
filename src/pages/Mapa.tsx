import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { abreviaturaArticulo, colorCategoria } from "@/lib/categorias";
import { calcularFifoIds } from "@/lib/fifo";
import { normalizarTexto } from "@/lib/format";
import { logMovimiento } from "@/lib/historial";

type Estanteria = { id: string; nombre: string; pasillo: number | null; posicion: number | null };
type Articulo = { id: string; nombre: string; categoria: string | null; stock_minimo: number; fecha: string | null };
type Ubicacion = { id: string; estanteria_id: string; nivel: string; posicion: number };
type Palet = { id: string; ubicacion_id: string; slot: number; articulo_id: string | null; cantidad: number };
type HuecoAgg = { ubicacion: Ubicacion; palets: Palet[]; totalCantidad: number; articuloIds: string[] };

type QuickEdit = {
  h: HuecoAgg;
  estNombre: string;
  cantidades: Map<string, number>; // paletId → cantidad
};

function splitLabel(label: string): { line1: string; line2: string } {
  if (!label) return { line1: "", line2: "" };
  if (/^\d+$/.test(label.trim())) return { line1: label, line2: "" };
  const match = label.match(/^(.+?)\s+(\d+)\s*$/);
  if (match) return { line1: match[1], line2: match[2] };
  return { line1: label, line2: "" };
}

const Mapa = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [estanterias, setEstanterias] = useState<Estanteria[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [palets, setPalets] = useState<Palet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("__all__");
  const [busqueda, setBusqueda] = useState(searchParams.get("busqueda") ?? "");
  const [quickEdit, setQuickEdit] = useState<QuickEdit | null>(null);
  const [savingQuick, setSavingQuick] = useState(false);

  const load = async () => {
    setLoading(true);
    const [e, a, u, p] = await Promise.all([
      supabase.from("estanterias").select("id,nombre,pasillo,posicion"),
      supabase.from("articulos").select("id,nombre,categoria,stock_minimo,fecha"),
      supabase.from("ubicaciones").select("id,estanteria_id,nivel,posicion"),
      supabase.from("palets").select("id,ubicacion_id,slot,articulo_id,cantidad"),
    ]);
    if (e.error || a.error || u.error || p.error) {
      toast({ title: "Error cargando el mapa", variant: "destructive" });
    } else {
      setEstanterias(e.data ?? []);
      setArticulos(a.data ?? []);
      setUbicaciones(u.data ?? []);
      setPalets(p.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const articulosMap = useMemo(() => new Map(articulos.map((a) => [a.id, a])), [articulos]);
  const fifoIds = useMemo(() => calcularFifoIds(articulos), [articulos]);

  const estanteriasMap = useMemo(() => {
    const m = new Map<string, Estanteria>();
    estanterias.forEach((e) => { if (e.pasillo && e.posicion) m.set(`${e.pasillo}-${e.posicion}`, e); });
    return m;
  }, [estanterias]);

  // La cuadrícula se dibuja a partir de las estanterías que existan (sin tamaño fijo)
  const { pasillos, posiciones } = useMemo(() => {
    const enMapa = estanterias.filter((e) => e.pasillo && e.posicion);
    const pasillos = Array.from(new Set(enMapa.map((e) => e.pasillo as number))).sort((a, b) => a - b);
    const maxPos = enMapa.reduce((m, e) => Math.max(m, e.posicion as number), 0);
    return { pasillos, posiciones: Array.from({ length: maxPos }, (_, i) => i + 1) };
  }, [estanterias]);

  const huecosPorEstanteria = useMemo(() => {
    const paletsPorUbic = new Map<string, Palet[]>();
    palets.forEach((p) => {
      const arr = paletsPorUbic.get(p.ubicacion_id) ?? [];
      arr.push(p);
      paletsPorUbic.set(p.ubicacion_id, arr);
    });
    const m = new Map<string, HuecoAgg[]>();
    ubicaciones.forEach((u) => {
      const ps = paletsPorUbic.get(u.id) ?? [];
      const conArt = ps.filter((p) => p.articulo_id);
      const agg: HuecoAgg = {
        ubicacion: u, palets: ps,
        totalCantidad: conArt.reduce((s, p) => s + (p.cantidad ?? 0), 0),
        articuloIds: conArt.map((p) => p.articulo_id as string),
      };
      const arr = m.get(u.estanteria_id) ?? [];
      arr.push(agg);
      m.set(u.estanteria_id, arr);
    });
    return m;
  }, [ubicaciones, palets]);

  const categorias = useMemo(() => {
    const s = new Set<string>();
    articulos.forEach((a) => a.categoria && s.add(a.categoria));
    return Array.from(s).sort();
  }, [articulos]);

  const articuloIdsBuscados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return null;
    return new Set(articulos.filter((a) => normalizarTexto(a.nombre).includes(q)).map((a) => a.id));
  }, [busqueda, articulos]);

  const stats = useMemo(() => {
    const total = estanterias.filter((e) => e.pasillo && e.posicion).length;
    let ocupados = 0, bajos = 0;
    huecosPorEstanteria.forEach((huecos) => {
      huecos.forEach((h) => {
        if (h.palets.some((p) => p.articulo_id)) ocupados++;
        h.palets.forEach((p) => {
          if (!p.articulo_id) return;
          const art = articulosMap.get(p.articulo_id);
          if (art && p.cantidad < art.stock_minimo) bajos++;
        });
      });
    });
    return { total, ocupados, bajos };
  }, [estanterias, huecosPorEstanteria, articulosMap]);

  // ── Edición rápida desde el mapa ─────────────────────────────────────────
  const openQuickEdit = (e: React.MouseEvent, h: HuecoAgg, estNombre: string) => {
    e.stopPropagation();
    const palsConArt = h.palets.filter((p) => p.articulo_id);
    if (palsConArt.length === 0) return;
    const cantidades = new Map(palsConArt.map((p) => [p.id, p.cantidad]));
    setQuickEdit({ h, estNombre, cantidades });
  };

  const saveQuickEdit = async () => {
    if (!quickEdit) return;
    setSavingQuick(true);
    const palsConArt = quickEdit.h.palets.filter((p) => p.articulo_id);
    let ok = true;

    for (const p of palsConArt) {
      const nuevaCantidad = quickEdit.cantidades.get(p.id) ?? p.cantidad;
      if (nuevaCantidad === p.cantidad) continue;
      const { error } = await supabase.from("palets").update({ cantidad: nuevaCantidad }).eq("id", p.id);
      if (error) { ok = false; break; }
      const art = articulosMap.get(p.articulo_id as string);
      await logMovimiento({
        tipo: "editar_cantidad",
        descripcion: `Cantidad editada desde el mapa`,
        articulo_id: p.articulo_id,
        articulo_nombre: art?.nombre ?? null,
        cantidad_antes: p.cantidad,
        cantidad_despues: nuevaCantidad,
        ubicacion_origen: `${quickEdit.estNombre} · ${quickEdit.h.ubicacion.nivel} pos ${quickEdit.h.ubicacion.posicion} · P${p.slot}`,
      });
    }

    setSavingQuick(false);
    if (ok) {
      toast({ title: "Cantidades actualizadas ✓" });
      setQuickEdit(null);
      load();
    } else {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  // ── Colores ───────────────────────────────────────────────────────────────
  const colorHueco = (h: HuecoAgg | undefined) => {
    if (!h) return "bg-muted/40 border-border";
    const palsConArt = h.palets.filter((p) => p.articulo_id);
    if (palsConArt.length === 0) return "bg-muted/40 border-border";
    let estado: "ok" | "bajo" | "cero" = "ok";
    for (const p of palsConArt) {
      const art = articulosMap.get(p.articulo_id as string);
      if (!art) continue;
      if (p.cantidad === 0) { estado = "cero"; break; }
      if (p.cantidad < art.stock_minimo) estado = estado === "ok" ? "bajo" : estado;
    }
    if (estado === "cero") return "bg-destructive/70 border-destructive";
    const esFifo = palsConArt.some((p) => fifoIds.has(p.articulo_id as string));
    if (esFifo) return "bg-warning border-warning ring-2 ring-warning/60";
    if (estado === "bajo") return "bg-warning/70 border-warning";
    return "bg-success/70 border-success";
  };

  const huecoMatchFiltro = (h: HuecoAgg | undefined) => {
    if (!h || h.articuloIds.length === 0) return true;
    if (filtroCategoria !== "__all__" && !h.articuloIds.some((id) => articulosMap.get(id)?.categoria === filtroCategoria)) return false;
    if (articuloIdsBuscados && !h.articuloIds.some((id) => articuloIdsBuscados.has(id))) return false;
    return true;
  };

  const huecoResaltado = (h: HuecoAgg | undefined) => {
    if (!h || h.articuloIds.length === 0) return false;
    if (articuloIdsBuscados && h.articuloIds.some((id) => articuloIdsBuscados.has(id))) return true;
    if (filtroCategoria !== "__all__") return h.articuloIds.some((id) => articulosMap.get(id)?.categoria === filtroCategoria);
    return false;
  };

  // ── Render estantería ─────────────────────────────────────────────────────
  const renderEstanteria = (est: Estanteria | undefined) => {
    if (!est) {
      return (
        <div className="flex h-[96px] items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-[10px] text-muted-foreground/50">—</div>
      );
    }

    const huecos = huecosPorEstanteria.get(est.id) ?? [];
    const findH = (nivel: string, pos: number) => huecos.find((h) => h.ubicacion.nivel === nivel && h.ubicacion.posicion === pos);
    const filaArriba = [1, 2, 3].map((p) => findH("arriba", p));
    const filaAbajo  = [1, 2, 3].map((p) => findH("abajo", p));
    const algunMatch     = huecos.some((h) => huecoMatchFiltro(h));
    const algunResaltado = huecos.some((h) => huecoResaltado(h));

    return (
      <button
        onClick={() => navigate(`/estanterias/${est.id}`)}
        className={cn(
          "group flex w-full flex-col gap-1.5 rounded-lg border p-2 text-left transition-all hover:border-primary hover:shadow-lg",
          algunResaltado ? "border-primary ring-2 ring-primary/40 shadow-md" : "border-border shadow-sm",
          !algunMatch && (filtroCategoria !== "__all__" || articuloIdsBuscados) && "opacity-25 grayscale",
        )}
      >
        <div className="text-[10px] font-bold tracking-wide text-muted-foreground">{est.nombre}</div>
        <div className="space-y-1">
          {[filaArriba, filaAbajo].map((fila, fi) => (
            <div key={fi} className="grid grid-cols-3 gap-1">
              {fila.map((h, j) => {
                const resaltado = huecoResaltado(h);
                const palsConArt = (h?.palets ?? []).filter((p) => p.articulo_id);
                const etiquetas = Array.from(new Set(
                  palsConArt.slice().sort((a, b) => a.slot - b.slot)
                    .map((p) => abreviaturaArticulo(articulosMap.get(p.articulo_id as string)))
                    .filter(Boolean),
                ));
                const primeraCategoria = palsConArt.length > 0 ? articulosMap.get(palsConArt[0].articulo_id as string)?.categoria : null;
                const stripeColor = palsConArt.length > 0 ? colorCategoria(primeraCategoria) : null;
                const label = etiquetas[0] ?? "";
                const { line1, line2 } = splitLabel(label);
                const extras = etiquetas.length > 1 ? `+${etiquetas.length - 1}` : null;

                return (
                  <Tooltip key={j} delayDuration={100}>
                    <TooltipTrigger asChild>
                      <div
                        onClick={palsConArt.length > 0 ? (e) => openQuickEdit(e, h!, est.nombre) : undefined}
                        className={cn(
                          "relative flex h-12 flex-col overflow-hidden rounded border transition-all",
                          colorHueco(h),
                          resaltado && "ring-2 ring-primary",
                          palsConArt.length > 0 && "cursor-pointer hover:brightness-95",
                        )}
                      >
                        {stripeColor && <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: stripeColor }} />}
                        {/* Icono editar al hover */}
                        {palsConArt.length > 0 && (
                          <div className="absolute right-0.5 top-1 opacity-0 group-hover:opacity-60 transition-opacity">
                            <Pencil className="h-2.5 w-2.5 text-foreground" />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col items-center justify-center px-0.5 text-center leading-none">
                          {palsConArt.length > 0 && (
                            <>
                              <span className="w-full truncate text-[9px] font-extrabold text-foreground">
                                {line1}{extras ? ` ${extras}` : ""}
                              </span>
                              {line2 && <span className="text-[10px] font-black tabular-nums text-foreground/90">{line2}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      {palsConArt.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="font-semibold text-muted-foreground">
                            {h?.ubicacion.nivel} · pos {h?.ubicacion.posicion} · {palsConArt.length}/4 palets
                            <span className="ml-1 text-primary">(clic para editar cantidades)</span>
                          </div>
                          {palsConArt.slice().sort((a, b) => a.slot - b.slot).map((p) => {
                            const art = articulosMap.get(p.articulo_id as string);
                            const isFifo = fifoIds.has(p.articulo_id as string);
                            return (
                              <div key={p.id} className="border-t border-border/50 pt-1 first:border-0 first:pt-0">
                                <div className="flex items-center gap-1">
                                  {isFifo && <span className="rounded bg-warning px-1 text-[9px] font-bold text-warning-foreground">FIFO</span>}
                                  <span className="font-semibold">P{p.slot}: {art?.nombre ?? "—"}</span>
                                </div>
                                {art?.categoria && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: colorCategoria(art.categoria) }} />
                                    {art.categoria}
                                  </div>
                                )}
                                <div>{p.cantidad} cajas{art ? ` · mín ${art.stock_minimo}` : ""}</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Hueco vacío ({h?.ubicacion.nivel} · pos {h?.ubicacion.posicion})</div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </button>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Cabecera */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mapa del almacén</h1>
            <p className="mt-1 text-muted-foreground">
              {pasillos.length} pasillos · {stats.total} estanterías · {stats.ocupados} huecos ocupados ·{" "}
              <span className={stats.bajos > 0 ? "font-semibold text-warning" : ""}>{stats.bajos} con stock bajo</span>
            </p>
          </div>
          <Button onClick={() => navigate("/estanterias")} variant="outline">
            <Plus />
            Nueva estantería
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex-1 min-w-[180px]">
              <Input placeholder="Buscar artículo en el almacén..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las categorías</SelectItem>
                {categorias.map((s) => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorCategoria(s) }} />
                      {s}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-success bg-success/70" /> OK</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-warning bg-warning/70" /> Bajo</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-destructive bg-destructive/70" /> Sin stock</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-warning bg-warning ring-2 ring-warning/60" /> FIFO</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-border bg-muted/40" /> Vacío</span>
            </div>
          </CardContent>
          {categorias.length > 0 && (
            <CardContent className="flex flex-wrap gap-2 border-t pt-3 pb-3">
              <span className="text-[11px] font-semibold text-muted-foreground self-center">Franja de color:</span>
              {categorias.map((s) => (
                <span key={s} className="flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorCategoria(s) }} />{s}
                </span>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Mapa */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : pasillos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-lg font-semibold text-foreground">El almacén está vacío</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Crea tu primera estantería indicando su pasillo y su posición, y aparecerá aquí en el mapa.
              </p>
              <Button onClick={() => navigate("/estanterias")}>
                <Plus />
                Crear estantería
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto py-5">
              <div className="space-y-2" style={{ minWidth: 90 + posiciones.length * 160 }}>
                <div className="grid gap-2 px-1 text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: `90px repeat(${posiciones.length}, minmax(0, 1fr))` }}>
                  <div />
                  {posiciones.map((p) => <div key={p} className="text-center">Estantería {p}</div>)}
                </div>
                {pasillos.map((p) => (
                  <div key={p} className="grid items-center gap-2" style={{ gridTemplateColumns: `90px repeat(${posiciones.length}, minmax(0, 1fr))` }}>
                    <div className="text-sm font-bold text-foreground">Pasillo {p}</div>
                    {posiciones.map((pos) => <div key={pos}>{renderEstanteria(estanteriasMap.get(`${p}-${pos}`))}</div>)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog edición rápida */}
        <Dialog open={!!quickEdit} onOpenChange={(o) => !o && setQuickEdit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Editar cantidades — {quickEdit?.estNombre} · {quickEdit?.h.ubicacion.nivel} pos {quickEdit?.h.ubicacion.posicion}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {quickEdit?.h.palets
                .filter((p) => p.articulo_id)
                .sort((a, b) => a.slot - b.slot)
                .map((p) => {
                  const art = articulosMap.get(p.articulo_id as string);
                  const isFifo = fifoIds.has(p.articulo_id as string);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-muted-foreground">P{p.slot}</span>
                          {isFifo && <span className="rounded bg-warning px-1 text-[9px] font-bold text-warning-foreground">FIFO</span>}
                          <span className="truncate text-sm font-medium">{art?.nombre ?? "—"}</span>
                        </div>
                        {art?.categoria && <div className="text-xs text-muted-foreground">{art.categoria}</div>}
                      </div>
                      <div className="w-24">
                        <Label className="text-xs text-muted-foreground">Cajas</Label>
                        <Input
                          type="number"
                          min={0}
                          value={quickEdit.cantidades.get(p.id) ?? p.cantidad}
                          onChange={(e) => {
                            const nuevas = new Map(quickEdit.cantidades);
                            nuevas.set(p.id, Number(e.target.value));
                            setQuickEdit({ ...quickEdit, cantidades: nuevas });
                          }}
                          className="h-8 text-right"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickEdit(null)}>Cancelar</Button>
              <Button onClick={saveQuickEdit} disabled={savingQuick}>
                {savingQuick ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Mapa;
