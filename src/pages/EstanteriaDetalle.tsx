import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronsUpDown, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { abreviaturaArticulo } from "@/lib/categorias";
import { calcularFifoIds } from "@/lib/fifo";
import { formatFechaAlmacen, textoSeguro } from "@/lib/format";
import { logMovimiento } from "@/lib/historial";

type Articulo = {
  id: string;
  nombre: string;
  categoria: string | null;
  stock_minimo: number;
  fecha: string | null;
  lote: string | null;
  proveedor: string | null;
  unidades_por_caja: number;
  descripcion: string | null;
  cajas: number;
};
type Ubicacion = { id: string; nivel: "arriba" | "abajo"; posicion: number };
type Palet = { id: string; ubicacion_id: string; slot: number; articulo_id: string | null; cantidad: number };
type Estanteria = { id: string; nombre: string; descripcion: string | null };

// ─── tipos para drag & drop ───────────────────────────────────────────────────
type DragSource = { paletId: string; ubicacionId: string; slot: number };
type DropTarget = { ubicacionId: string; slot: number };

const SIN_ARTICULO = "__none__";
const MAX_PALETS = 4;

const EstanteriaDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const [estanteria, setEstanteria] = useState<Estanteria | null>(null);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [palets, setPalets] = useState<Palet[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [editing, setEditing] = useState<{ ubicacion: Ubicacion; slot: number; palet: Palet | null } | null>(null);
  const [articuloId, setArticuloId] = useState<string>(SIN_ARTICULO);
  const [cantidad, setCantidad] = useState(0);
  const [comboOpen, setComboOpen] = useState(false);

  // ─── estado drag & drop ───────────────────────────────────────────────────
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOver, setDragOver] = useState<DropTarget | null>(null);
  const [moving, setMoving] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data: est }, { data: ubic }, { data: arts }] = await Promise.all([
      supabase.from("estanterias").select("*").eq("id", id).maybeSingle(),
      supabase.from("ubicaciones").select("*").eq("estanteria_id", id),
      supabase.from("articulos")
        .select("id, nombre, categoria, stock_minimo, fecha, lote, proveedor, unidades_por_caja, descripcion, cajas")
        .order("nombre"),
    ]);
    setEstanteria(est);
    const ubics = (ubic ?? []) as Ubicacion[];
    setUbicaciones(ubics);
    setArticulos((arts ?? []) as Articulo[]);
    if (ubics.length) {
      const { data: pls } = await supabase.from("palets").select("*").in("ubicacion_id", ubics.map((u) => u.id));
      setPalets((pls ?? []) as Palet[]);
    } else {
      setPalets([]);
    }
  };

  useEffect(() => { load(); }, [id]);

  const articuloById = (aid: string | null) => articulos.find((a) => a.id === aid);
  const paletDe = (uid: string, slot: number) => palets.find((p) => p.ubicacion_id === uid && p.slot === slot) ?? null;
  const fifoIds = useMemo(() => calcularFifoIds(articulos), [articulos]);

  const colorPalet = (p: Palet | null) => {
    if (!p || !p.articulo_id) return "border-dashed border-border bg-muted/20 text-muted-foreground";
    const art = articuloById(p.articulo_id);
    const min = art?.stock_minimo ?? 0;
    if (p.cantidad <= 0) return "border-destructive/50 bg-destructive/10";
    if (fifoIds.has(p.articulo_id)) return "border-warning bg-warning/30 ring-1 ring-warning";
    if (min > 0 && p.cantidad < min) return "border-warning/60 bg-warning/10";
    return "border-success/50 bg-success/10";
  };

  // ─── drag & drop handlers ─────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, palet: Palet) => {
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ paletId: palet.id, ubicacionId: palet.ubicacion_id, slot: palet.slot });
  };

  const handleDragOver = (e: React.DragEvent, ubicacionId: string, slot: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver({ ubicacionId, slot });
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setDragOver(null);
  };

  const handleDrop = async (e: React.DragEvent, destUbicId: string, destSlot: number) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragSource) return;

    const { paletId, ubicacionId: srcUbicId, slot: srcSlot } = dragSource;
    setDragSource(null);

    // Mismo sitio, no hacer nada
    if (srcUbicId === destUbicId && srcSlot === destSlot) return;

    const destPalet = paletDe(destUbicId, destSlot);
    setMoving(true);

    try {
      if (destPalet) {
        // INTERCAMBIO: mover el palet origen a slot temporal (99) para evitar conflictos
        const { error: e1 } = await supabase.from("palets").update({ slot: 99 }).eq("id", paletId);
        if (e1) throw e1;
        // Mover el palet destino a la posición origen
        const { error: e2 } = await supabase.from("palets")
          .update({ ubicacion_id: srcUbicId, slot: srcSlot })
          .eq("id", destPalet.id);
        if (e2) throw e2;
        // Mover el palet origen a la posición destino
        const { error: e3 } = await supabase.from("palets")
          .update({ ubicacion_id: destUbicId, slot: destSlot })
          .eq("id", paletId);
        if (e3) throw e3;
        toast({ title: "Palets intercambiados ✓" });
      } else {
        // MOVER a hueco vacío
        const { error } = await supabase.from("palets")
          .update({ ubicacion_id: destUbicId, slot: destSlot })
          .eq("id", paletId);
        if (error) throw error;
        const artMov = palets.find(p => p.id === paletId);
        const artMovNombre = artMov?.articulo_id ? articulos.find(a => a.id === artMov.articulo_id)?.nombre ?? null : null;
        const ubSrc = ubicaciones.find(u => u.id === srcUbicId);
        const ubDst = ubicaciones.find(u => u.id === destUbicId);
        await logMovimiento({
          tipo: "mover",
          descripcion: `Palet movido en ${estanteria?.nombre ?? "estantería"}`,
          articulo_id: artMov?.articulo_id ?? null,
          articulo_nombre: artMovNombre,
          ubicacion_origen: `${estanteria?.nombre} · ${ubSrc?.nivel} pos ${ubSrc?.posicion} · P${srcSlot}`,
          ubicacion_destino: `${estanteria?.nombre} · ${ubDst?.nivel} pos ${ubDst?.posicion} · P${destSlot}`,
        });
        toast({ title: "Palet movido ✓" });
      }
      await load();
    } catch (err: any) {
      toast({ title: "Error al mover el palet", description: err?.message, variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  // ─── edición clásica (click) ──────────────────────────────────────────────

  const openEdit = (u: Ubicacion, slot: number) => {
    const p = paletDe(u.id, slot);
    setEditing({ ubicacion: u, slot, palet: p });
    setArticuloId(p?.articulo_id ?? SIN_ARTICULO);
    setCantidad(p?.cantidad ?? 0);
    setComboOpen(false);
  };

  const save = async () => {
    if (!editing) return;
    const { ubicacion, slot, palet } = editing;
    const vaciar = articuloId === SIN_ARTICULO;
    if (vaciar) {
      if (palet) {
        const { error } = await supabase.from("palets").delete().eq("id", palet.id);
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
        const artVac = palet.articulo_id ? articuloById(palet.articulo_id) : null;
        await logMovimiento({
          tipo: "vaciar",
          descripcion: `Palet vaciado en ${estanteria?.nombre ?? "estantería"}`,
          articulo_id: palet.articulo_id,
          articulo_nombre: artVac?.nombre ?? null,
          cantidad_antes: palet.cantidad,
          ubicacion_origen: `${estanteria?.nombre} · ${ubicacion.nivel} pos ${ubicacion.posicion} · P${slot}`,
        });
      }
    } else {
      const payload = { ubicacion_id: ubicacion.id, slot, articulo_id: articuloId, cantidad: Number(cantidad) || 0 };
      const { error } = palet
        ? await supabase.from("palets").update(payload).eq("id", palet.id)
        : await supabase.from("palets").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      const art = articuloById(articuloId);
      await logMovimiento({
        tipo: palet ? "editar_cantidad" : "crear",
        descripcion: palet
          ? `Cantidad editada en ${estanteria?.nombre ?? "estantería"}`
          : `Palet asignado en ${estanteria?.nombre ?? "estantería"}`,
        articulo_id: articuloId,
        articulo_nombre: art?.nombre ?? null,
        cantidad_antes: palet?.cantidad ?? null,
        cantidad_despues: Number(cantidad) || 0,
        ubicacion_destino: `${estanteria?.nombre} · ${ubicacion.nivel} pos ${ubicacion.posicion} · P${slot}`,
      });
    }
    toast({ title: "Palet guardado" });
    setTimeout(() => setEditing(null), 0);
    load();
  };

  const removePalet = async () => {
    if (!editing?.palet) return;
    const art = editing.palet.articulo_id ? articuloById(editing.palet.articulo_id) : null;
    const { error } = await supabase.from("palets").delete().eq("id", editing.palet.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await logMovimiento({
      tipo: "eliminar",
      descripcion: `Palet eliminado en ${estanteria?.nombre ?? "estantería"}`,
      articulo_id: editing.palet.articulo_id,
      articulo_nombre: art?.nombre ?? null,
      cantidad_antes: editing.palet.cantidad,
      ubicacion_origen: `${estanteria?.nombre} · ${editing.ubicacion.nivel} pos ${editing.ubicacion.posicion} · P${editing.slot}`,
    });
    toast({ title: "Palet eliminado" });
    setTimeout(() => setEditing(null), 0);
    load();
  };

  // ─── render hueco ─────────────────────────────────────────────────────────

  const renderHueco = (u: Ubicacion | undefined, key: number) => {
    if (!u) return <div key={key} className="aspect-[3/4] rounded-lg border-2 border-dashed border-border bg-muted/30" />;

    const slots = [4, 3, 2, 1];
    return (
      <div key={u.id} className="flex aspect-[3/4] flex-col gap-1 rounded-lg border-2 border-border bg-card p-1.5">
        <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {u.nivel} · Pos {u.posicion}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {slots.map((slot) => {
            const p = paletDe(u.id, slot);
            const art = p?.articulo_id ? articuloById(p.articulo_id) : null;
            const isDragging = dragSource?.paletId === p?.id;
            const isDropTarget =
              dragSource &&
              dragOver?.ubicacionId === u.id &&
              dragOver?.slot === slot &&
              !(dragSource.ubicacionId === u.id && dragSource.slot === slot);

            return (
              <div
                key={slot}
                // ── zona de drop (siempre activa si hay drag en curso) ──
                onDragOver={dragSource ? (e) => handleDragOver(e, u.id, slot) : undefined}
                onDrop={dragSource ? (e) => handleDrop(e, u.id, slot) : undefined}
                onDragLeave={() => setDragOver(null)}
                className={cn(
                  "flex flex-1 rounded border-2 transition-all",
                  isDropTarget
                    ? "border-primary bg-primary/10 ring-2 ring-primary/50 scale-[1.02]"
                    : "border-transparent",
                )}
              >
                <button
                  // ── draggable solo si tiene palet con artículo ──
                  draggable={!!p?.articulo_id}
                  onDragStart={p ? (e) => handleDragStart(e, p) : undefined}
                  onDragEnd={handleDragEnd}
                  onClick={() => !dragSource && openEdit(u, slot)}
                  disabled={moving}
                  className={cn(
                    "flex flex-1 items-center justify-between rounded border-2 px-2 py-1 text-left transition-all",
                    colorPalet(p),
                    isDragging ? "opacity-40 scale-95" : "hover:scale-[1.01] hover:shadow-sm",
                    p?.articulo_id ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                  )}
                >
                  {art ? (
                    <>
                      {/* Grip icon para indicar que es arrastrable */}
                      <GripVertical className="mr-1 h-3 w-3 flex-shrink-0 text-muted-foreground/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground">
                            {abreviaturaArticulo(art)}
                          </span>
                          {p?.articulo_id && fifoIds.has(p.articulo_id) && (
                            <span className="rounded bg-warning px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning-foreground">
                              FIFO
                            </span>
                          )}
                          <div className="truncate text-xs font-semibold text-foreground">{textoSeguro(art.nombre, "Sin nombre")}</div>
                        </div>
                        {art.categoria && (
                          <div className="truncate text-[10px] text-muted-foreground">{art.categoria}</div>
                        )}
                      </div>
                      <div className="ml-2 text-right">
                        <div className="text-base font-bold leading-none text-foreground">{p?.cantidad ?? 0}</div>
                        <div className="text-[9px] text-muted-foreground">cajas</div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full text-center text-[10px]">Palet {slot} · vacío</div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRow = (nivel: "arriba" | "abajo") => {
    const huecos = [1, 2, 3].map((p) => ubicaciones.find((u) => u.nivel === nivel && u.posicion === p));
    return (
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {huecos.map((u, i) => renderHueco(u, i))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/estanterias" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{estanteria?.nombre ?? "Estantería"}</h1>
        {estanteria?.descripcion && <p className="mt-1 text-muted-foreground">{estanteria.descripcion}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          Cada hueco admite hasta {MAX_PALETS} palets remontados · Haz clic para editar · <span className="font-medium">Arrastra para mover o intercambiar palets</span>
        </p>
      </div>

      {/* Indicador visual mientras se está moviendo */}
      {moving && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm text-primary font-medium">
          Moviendo palet…
        </div>
      )}

      {/* Indicador de drag activo */}
      {dragSource && (
        <div className="rounded-md border border-dashed border-primary/60 bg-primary/5 px-4 py-2 text-sm text-primary">
          Arrastrando palet — suéltalo en cualquier hueco para moverlo o intercambiarlo
        </div>
      )}

      <Card className="space-y-3 p-4 sm:p-6">
        <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arriba</div>
        {renderRow("arriba")}
        <div className="my-2 border-t" />
        <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Abajo</div>
        {renderRow("abajo")}
      </Card>

      {/* Dialog de edición clásica */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setTimeout(() => setEditing(null), 0); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Palet {editing?.slot} — {editing?.ubicacion.nivel} · Pos {editing?.ubicacion.posicion}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Artículo</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {articuloId === SIN_ARTICULO
                        ? "— Vaciar palet —"
                        : (() => {
                            const a = articuloById(articuloId);
                            if (!a) return "Seleccionar artículo";
                            const extras = [
                              a.lote ? `Lote ${a.lote}` : null,
                              a.fecha ? formatFechaAlmacen(a.fecha) : null,
                              a.proveedor ?? null,
                            ].filter(Boolean).join(" · ");
                            return `${a.nombre}${a.categoria ? ` · ${a.categoria}` : ""}${extras ? ` — ${extras}` : ""}`;
                          })()}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar artículo..." />
                    <CommandList className="max-h-64 overflow-y-auto">
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="vaciar"
                          onSelect={() => { setArticuloId(SIN_ARTICULO); setComboOpen(false); }}
                          className="text-muted-foreground"
                        >
                          <Check className={cn("mr-2 h-4 w-4", articuloId === SIN_ARTICULO ? "opacity-100" : "opacity-0")} />
                          — Vaciar palet —
                        </CommandItem>
                        {articulos.map((a) => {
                          const extras = [
                            a.lote ? `Lote ${a.lote}` : null,
                            a.fecha ? formatFechaAlmacen(a.fecha) : null,
                            a.proveedor ?? null,
                          ].filter(Boolean).join(" · ");
                          const label = `${a.nombre}${a.categoria ? ` · ${a.categoria}` : ""}`;
                          const searchValue = `${label} ${extras}`.toLowerCase();
                          return (
                            <CommandItem
                              key={a.id}
                              value={searchValue}
                              onSelect={() => { setArticuloId(a.id); setCantidad(a.cajas ?? 0); setComboOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", articuloId === a.id ? "opacity-100" : "opacity-0")} />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{label}</div>
                                {extras && <div className="text-xs text-muted-foreground truncate">{extras}</div>}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {articulos.length === 0 && (
                <p className="text-xs text-muted-foreground">Aún no hay artículos. Créalos en la sección Artículos.</p>
              )}
            </div>
            {articuloId !== SIN_ARTICULO && (() => {
              const art = articuloById(articuloId);
              if (!art) return null;
              const fechaFmt = formatFechaAlmacen(art.fecha);
              const totalUds = (Number(cantidad) || 0) * (art.unidades_por_caja || 0);
              return (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                        {abreviaturaArticulo(art)}
                      </span>
                      {fifoIds.has(art.id) && (
                        <span className="rounded bg-warning px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                          FIFO
                        </span>
                      )}
                      <span className="text-sm font-semibold text-foreground">{textoSeguro(art.nombre, "Sin nombre")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div>
                        <div className="text-muted-foreground">Categoría</div>
                        <div className="font-medium text-foreground">{art.categoria ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Fecha</div>
                        <div className={cn("font-medium text-foreground", fifoIds.has(art.id) && "text-warning-foreground bg-warning/40 inline-block px-1 rounded")}>
                          {fechaFmt ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Lote</div>
                        <div className="font-medium text-foreground">{art.lote ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Proveedor</div>
                        <div className="font-medium text-foreground">{art.proveedor ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Unidades / caja</div>
                        <div className="font-medium text-foreground">{art.unidades_por_caja || 0}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Stock mínimo</div>
                        <div className="font-medium text-foreground">{art.stock_minimo || 0}</div>
                      </div>
                    </div>
                    {art.descripcion && (
                      <div className="text-xs">
                        <div className="text-muted-foreground">Descripción</div>
                        <div className="font-medium text-foreground whitespace-pre-wrap">{art.descripcion}</div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qty">Cantidad (cajas)</Label>
                    <Input
                      id="qty"
                      type="number"
                      min={0}
                      value={cantidad}
                      onChange={(e) => setCantidad(Number(e.target.value))}
                    />
                    {art.unidades_por_caja > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{totalUds}</span> unidades ({cantidad} cajas × {art.unidades_por_caja} uds/caja)
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing?.palet && (
                <Button variant="ghost" onClick={removePalet} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar palet
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstanteriaDetalle;
