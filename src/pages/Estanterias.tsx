import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { abreviaturaArticulo } from "@/lib/categorias";
import { calcularFifoIds } from "@/lib/fifo";

type Estanteria = {
  id: string;
  nombre: string;
  descripcion: string | null;
  pasillo: number | null;
  posicion: number | null;
};

type Articulo = {
  id: string;
  nombre: string;
  categoria: string | null;
  stock_minimo: number;
  fecha: string | null;
};

type Ubicacion = {
  id: string;
  estanteria_id: string;
  nivel: "arriba" | "abajo";
  posicion: number;
};

type Palet = {
  id: string;
  ubicacion_id: string;
  slot: number;
  articulo_id: string | null;
  cantidad: number;
};

const Estanterias = () => {
  const [items, setItems] = useState<Estanteria[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [palets, setPalets] = useState<Palet[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pasillo, setPasillo] = useState<string>("");
  const [posicion, setPosicion] = useState<string>("");

  const load = async () => {
    const [{ data: ests, error: e1 }, { data: ubics }, { data: pls }, { data: arts }] = await Promise.all([
      supabase
        .from("estanterias")
        .select("*")
        .order("pasillo", { nullsFirst: false })
        .order("posicion", { nullsFirst: false })
        .order("nombre"),
      supabase.from("ubicaciones").select("id, estanteria_id, nivel, posicion"),
      supabase.from("palets").select("id, ubicacion_id, slot, articulo_id, cantidad"),
      supabase.from("articulos").select("id, nombre, categoria, stock_minimo, fecha"),
    ]);
    if (e1) toast({ title: "Error", description: e1.message, variant: "destructive" });
    else setItems(ests ?? []);
    setUbicaciones((ubics ?? []) as Ubicacion[]);
    setPalets((pls ?? []) as Palet[]);
    setArticulos((arts ?? []) as Articulo[]);
  };

  useEffect(() => {
    load();
  }, []);

  const fifoIds = useMemo(() => calcularFifoIds(articulos), [articulos]);
  const articuloById = (aid: string | null) => (aid ? articulos.find((a) => a.id === aid) : undefined);

  const create = async () => {
    if (!nombre.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      return;
    }
    const p = pasillo ? Number(pasillo) : null;
    const pos = posicion ? Number(posicion) : null;
    if ((p && p < 1) || (pos && pos < 1)) {
      toast({ title: "Pasillo y posición deben ser 1 o más", variant: "destructive" });
      return;
    }
    const { error } = await supabase.rpc("crear_estanteria_con_ubicaciones", {
      p_nombre: nombre.trim(),
      p_descripcion: descripcion.trim() || null,
      p_pasillo: p,
      p_posicion: pos,
    });
    if (error) {
      toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Estantería creada con 6 huecos" });
    setOpen(false);
    setNombre("");
    setDescripcion("");
    setPasillo("");
    setPosicion("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar la estantería y todos sus huecos?")) return;
    const { error } = await supabase.from("estanterias").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Estantería eliminada" });
      load();
    }
  };

  const colorPalet = (p: Palet | null) => {
    if (!p || !p.articulo_id) return "border-dashed border-border bg-muted/20";
    const art = articuloById(p.articulo_id);
    const min = art?.stock_minimo ?? 0;
    if (p.cantidad <= 0) return "border-destructive/50 bg-destructive/20";
    if (fifoIds.has(p.articulo_id)) return "border-warning bg-warning/40 ring-1 ring-warning";
    if (min > 0 && p.cantidad < min) return "border-warning/60 bg-warning/15";
    return "border-success/50 bg-success/15";
  };

  const MiniEstanteria = ({ estanteriaId }: { estanteriaId: string }) => {
    const ubics = ubicaciones.filter((u) => u.estanteria_id === estanteriaId);
    const paletDe = (uid: string, slot: number) =>
      palets.find((p) => p.ubicacion_id === uid && p.slot === slot) ?? null;

    const renderHueco = (u: Ubicacion | undefined, key: number) => {
      if (!u)
        return <div key={key} className="aspect-[3/4] rounded border border-dashed border-border bg-muted/20" />;
      const slots = [4, 3, 2, 1];
      return (
        <div key={u.id} className="flex aspect-[3/4] flex-col gap-0.5 rounded border border-border bg-card p-0.5">
          {slots.map((slot) => {
            const p = paletDe(u.id, slot);
            const art = p?.articulo_id ? articuloById(p.articulo_id) : null;
            return (
              <div
                key={slot}
                className={cn(
                  "flex flex-1 items-center justify-center rounded border px-0.5 overflow-hidden",
                  colorPalet(p),
                )}
              >
                {art ? (
                  <div className="flex w-full items-center justify-between gap-0.5 leading-none">
                    <span className="truncate text-[7px] font-bold uppercase text-foreground">
                      {abreviaturaArticulo(art)}
                    </span>
                    <span className="text-[8px] font-bold tabular-nums text-foreground">{p?.cantidad ?? 0}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    };

    const renderRow = (nivel: "arriba" | "abajo") => {
      const huecos = [1, 2, 3].map((pos) => ubics.find((u) => u.nivel === nivel && u.posicion === pos));
      return <div className="grid grid-cols-3 gap-1">{huecos.map((u, i) => renderHueco(u, i))}</div>;
    };

    return (
      <div className="space-y-1">
        {renderRow("arriba")}
        <div className="border-t border-border/60" />
        {renderRow("abajo")}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estanterías</h1>
          <p className="mt-1 text-muted-foreground">Cada estantería tiene 6 huecos: 3 arriba y 3 abajo</p>
        </div>
        <Button onClick={() => setOpen(true)} size="lg">
          <Plus /> Nueva estantería
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay estanterías todavía. Crea la primera con "Nueva estantería".
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => (
            <Card key={e.id} className="transition-colors hover:bg-accent/30">
              <CardHeader className="flex flex-row items-start justify-between">
                <Link to={`/estanterias/${e.id}`} className="flex-1">
                  <CardTitle>{e.nombre}</CardTitle>
                  {e.pasillo && e.posicion && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Pasillo {e.pasillo} · Estantería {e.posicion}
                    </p>
                  )}
                  {e.descripcion && <p className="mt-1 text-sm text-muted-foreground">{e.descripcion}</p>}
                </Link>
                <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                  <Trash2 />
                </Button>
              </CardHeader>
              <CardContent>
                <Link to={`/estanterias/${e.id}`}>
                  <MiniEstanteria estanteriaId={e.id} />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva estantería</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n">Nombre *</Label>
              <Input id="n" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Estantería A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d">Descripción</Label>
              <Input
                id="d"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Junto a la entrada"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p">Pasillo</Label>
                <Input
                  id="p"
                  type="number"
                  min={1}
                  value={pasillo}
                  onChange={(e) => setPasillo(e.target.value)}
                  placeholder="Ej: 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos">Posición en el pasillo</Label>
                <Input
                  id="pos"
                  type="number"
                  min={1}
                  value={posicion}
                  onChange={(e) => setPosicion(e.target.value)}
                  placeholder="Ej: 1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Indica pasillo y posición para que la estantería aparezca en el mapa.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create}>Crear con 6 huecos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estanterias;
