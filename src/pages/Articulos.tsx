import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { calcularFifoIds } from "@/lib/fifo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatFechaAlmacen, normalizarTexto, textoSeguro } from "@/lib/format";
import { logMovimiento } from "@/lib/historial";

type Articulo = {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  proveedor: string | null;
  stock_minimo: number;
  cajas: number;
  unidades_por_caja: number;
  fecha: string | null;
  lote: string | null;
};

const empty: Omit<Articulo, "id"> = {
  nombre: "",
  categoria: "",
  descripcion: "",
  proveedor: "",
  stock_minimo: 0,
  cajas: 0,
  unidades_por_caja: 0,
  fecha: "",
  lote: "",
};

const Articulos = () => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<Articulo[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Articulo | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const load = async () => {
    const { data, error } = await supabase.from("articulos").select("*").order("nombre");
    if (error) {
      toast({ title: "Error al cargar", description: error.message, variant: "destructive" });
      return;
    }
    setItems((data ?? []) as Articulo[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (a) =>
        normalizarTexto(a.nombre).includes(q) ||
        normalizarTexto(a.categoria).includes(q) ||
        normalizarTexto(a.proveedor).includes(q) ||
        normalizarTexto(a.lote).includes(q)
    );
  }, [items, search]);

  const categorias = useMemo(
    () => Array.from(new Set(items.map((a) => a.categoria?.trim()).filter(Boolean) as string[])).sort(),
    [items],
  );

  const totalesPorNombre = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((a) => {
      const key = normalizarTexto(a.nombre);
      m.set(key, (m.get(key) ?? 0) + (a.cajas ?? 0));
    });
    return m;
  }, [items]);

  const fifoIds = useMemo(() => calcularFifoIds(items), [items]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (a: Articulo) => {
    setEditing(a);
    setForm({
      nombre: a.nombre,
      categoria: a.categoria ?? "",
      descripcion: a.descripcion ?? "",
      proveedor: a.proveedor ?? "",
      stock_minimo: a.stock_minimo,
      cajas: a.cajas ?? 0,
      unidades_por_caja: a.unidades_por_caja ?? 0,
      fecha: a.fecha ?? "",
      lote: a.lote ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nombre.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria?.trim() || null,
      descripcion: form.descripcion?.trim() || null,
      proveedor: form.proveedor?.trim() || null,
      stock_minimo: Number(form.stock_minimo) || 0,
      cajas: Number(form.cajas) || 0,
      unidades_por_caja: Number(form.unidades_por_caja) || 0,
      fecha: form.fecha?.trim() || null,
      lote: form.lote?.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("articulos").update(payload).eq("id", editing.id)
      : await supabase.from("articulos").insert(payload);
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Artículo actualizado" : "Artículo creado" });
    await logMovimiento({
      tipo: editing ? "editar_cantidad" : "crear",
      descripcion: editing ? `Artículo editado: ${form.nombre.trim()}` : `Artículo creado: ${form.nombre.trim()}`,
      articulo_nombre: form.nombre.trim(),
      cantidad_antes: editing?.cajas ?? null,
      cantidad_despues: Number(form.cajas) || 0,
    });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este artículo?")) return;
    const art = items.find((a) => a.id === id);
    const { error } = await supabase.from("articulos").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      await logMovimiento({
        tipo: "eliminar",
        descripcion: `Artículo eliminado: ${art?.nombre ?? id}`,
        articulo_id: id,
        articulo_nombre: art?.nombre ?? null,
        cantidad_antes: art?.cajas ?? null,
      });
      toast({ title: "Artículo eliminado" });
      load();
    }
  };

  const formatFecha = (f: string | null) => {
    if (!f) return "—";
    return formatFechaAlmacen(f);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Artículos</h1>
          <p className="mt-1 text-muted-foreground">Material del almacén (1 artículo = 1 palet)</p>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, categoria, proveedor o lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openNew} size="lg">
          <Plus /> Nuevo artículo
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Stock mínimo</TableHead>
              <TableHead className="text-right">Cajas</TableHead>
              <TableHead className="text-right">Uds × caja</TableHead>
              <TableHead className="text-right">Total mismo artículo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  {search ? `No se encontraron artículos para "${search}".` : "No hay artículos. Crea el primero con \"Nuevo artículo\"."}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((a) => {
                const total = totalesPorNombre.get(normalizarTexto(a.nombre)) ?? 0;
                const isFifo = fifoIds.has(a.id);
                return (
                  <TableRow key={a.id} className={cn(isFifo && "bg-warning/15 hover:bg-warning/20")}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{textoSeguro(a.nombre, "Sin nombre")}</span>
                        {isFifo && (
                          <Badge variant="outline" className="border-warning bg-warning/20 text-[10px] text-warning-foreground">
                            FIFO
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{textoSeguro(a.categoria)}</TableCell>
                    <TableCell>{textoSeguro(a.proveedor)}</TableCell>
                    <TableCell className="text-right">{a.stock_minimo}</TableCell>
                    <TableCell className="text-right">{a.cajas ?? 0}</TableCell>
                    <TableCell className="text-right">{a.unidades_por_caja ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          total === 0
                            ? "font-semibold text-destructive"
                            : total < a.stock_minimo
                            ? "font-semibold text-warning"
                            : "font-semibold text-success"
                        }
                      >
                        {total}
                      </span>
                    </TableCell>
                    <TableCell className={cn(isFifo && "font-semibold text-warning")}>{formatFecha(a.fecha)}</TableCell>
                    <TableCell>{textoSeguro(a.lote)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Etiqueta film 120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input
                id="categoria"
                list="categorias-existentes"
                value={form.categoria ?? ""}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ej: Etiquetas film"
              />
              <datalist id="categorias-existentes">
                {categorias.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prov">Proveedor</Label>
              <Input
                id="prov"
                value={form.proveedor ?? ""}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción</Label>
              <Input
                id="desc"
                value={form.descripcion ?? ""}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={form.fecha ?? ""}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lote">Lote</Label>
                <Input
                  id="lote"
                  value={form.lote ?? ""}
                  onChange={(e) => setForm({ ...form, lote: e.target.value })}
                  placeholder="Ej: A1234"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min">Stock mínimo (cajas)</Label>
                <Input
                  id="min"
                  type="number"
                  min={0}
                  value={form.stock_minimo}
                  onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cajas">Cajas (en este palet)</Label>
                <Input
                  id="cajas"
                  type="number"
                  min={0}
                  value={form.cajas}
                  onChange={(e) => setForm({ ...form, cajas: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upc">Unidades × caja</Label>
                <Input
                  id="upc"
                  type="number"
                  min={0}
                  value={form.unidades_por_caja}
                  onChange={(e) => setForm({ ...form, unidades_por_caja: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Articulos;
