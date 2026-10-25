import { useEffect, useState } from "react";
import { ArrowLeftRight, Clock, Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { TipoMovimiento } from "@/lib/historial";

type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  descripcion: string;
  articulo_nombre: string | null;
  cantidad_antes: number | null;
  cantidad_despues: number | null;
  ubicacion_origen: string | null;
  ubicacion_destino: string | null;
  created_at: string;
};

const TIPO_CONFIG: Record<TipoMovimiento, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  mover:           { label: "Movido",    variant: "default",     icon: <ArrowLeftRight className="h-3 w-3" /> },
  editar_cantidad: { label: "Editado",   variant: "secondary",   icon: <Package className="h-3 w-3" /> },
  crear:           { label: "Creado",    variant: "outline",     icon: <Plus className="h-3 w-3" /> },
  eliminar:        { label: "Eliminado", variant: "destructive", icon: <Trash2 className="h-3 w-3" /> },
  vaciar:          { label: "Vaciado",   variant: "secondary",   icon: <Trash2 className="h-3 w-3" /> },
};

const TODOS = "__todos__";

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const Historial = () => {
  const [items, setItems] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>(TODOS);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("movimientos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Error al cargar el historial", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as Movimiento[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filtroTipo === TODOS
    ? items
    : items.filter((m) => m.tipo === filtroTipo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Historial</h1>
          <p className="mt-1 text-muted-foreground">
            Registro de movimientos, ediciones y cambios en el almacén.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los tipos</SelectItem>
              <SelectItem value="mover">Movidos</SelectItem>
              <SelectItem value="editar_cantidad">Editados</SelectItem>
              <SelectItem value="crear">Creados</SelectItem>
              <SelectItem value="eliminar">Eliminados</SelectItem>
              <SelectItem value="vaciar">Vaciados</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total registros</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Palets movidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.filter((m) => m.tipo === "mover").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Último movimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {items[0] ? formatFecha(items[0].created_at) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="mx-auto mb-3 h-8 w-8 opacity-30" />
            {loading ? "Cargando..." : "No hay registros todavía."}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Después</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Fecha y hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const cfg = TIPO_CONFIG[m.tipo] ?? { label: m.tipo, variant: "outline" as const, icon: null };
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant={cfg.variant} className="flex w-fit items-center gap-1 whitespace-nowrap">
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{m.descripcion}</TableCell>
                      <TableCell className="text-sm font-medium">{m.articulo_nombre ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {m.cantidad_antes != null ? (
                          <span className="text-muted-foreground">{m.cantidad_antes}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {m.cantidad_despues != null ? (
                          <span className="font-semibold">{m.cantidad_despues}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.ubicacion_origen ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.ubicacion_destino ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatFecha(m.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Historial;
