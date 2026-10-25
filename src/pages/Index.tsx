import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, LayoutGrid, Map as MapIcon, Package, PlusCircle, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { normalizarTexto, textoSeguro } from "@/lib/format";

type Articulo = { id: string; nombre: string; categoria: string | null; stock_minimo: number };
type Palet = { articulo_id: string | null; cantidad: number | null };

type Stats = {
  articulos: number;
  estanterias: number;
  stockTotal: number;
  alertas: number;
};

const Index = () => {
  const [stats, setStats] = useState<Stats>({ articulos: 0, estanterias: 0, stockTotal: 0, alertas: 0 });
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [palets, setPalets] = useState<Palet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ count: artCount, error: e1 }, { count: estCount, error: e2 }, { data: pls, error: e3 }, { data: arts, error: e4 }] =
        await Promise.all([
          supabase.from("articulos").select("*", { count: "exact", head: true }),
          supabase.from("estanterias").select("*", { count: "exact", head: true }),
          supabase.from("palets").select("articulo_id, cantidad"),
          supabase.from("articulos").select("id, nombre, categoria, stock_minimo"),
        ]);

      if (e1 || e2 || e3 || e4) {
        toast({ title: "No se pudo cargar el panel", description: "Revisa la conexión con Supabase.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const paletsData = (pls ?? []) as Palet[];
      const articulosData = (arts ?? []) as Articulo[];
      const stockTotal = paletsData.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);

      const totalsByArt = new Map<string, number>();
      paletsData.forEach((p) => {
        if (p.articulo_id) totalsByArt.set(p.articulo_id, (totalsByArt.get(p.articulo_id) ?? 0) + (Number(p.cantidad) || 0));
      });
      const alertas = articulosData.filter((a) => (totalsByArt.get(a.id) ?? 0) < (a.stock_minimo ?? 0)).length;

      setStats({ articulos: artCount ?? 0, estanterias: estCount ?? 0, stockTotal, alertas });
      setArticulos(articulosData);
      setPalets(paletsData);
      setLoading(false);
    };
    load();
  }, []);

  const alertasStock = useMemo(() => {
    const totalsByArt = new Map<string, number>();
    palets.forEach((p) => {
      if (p.articulo_id) totalsByArt.set(p.articulo_id, (totalsByArt.get(p.articulo_id) ?? 0) + (Number(p.cantidad) || 0));
    });

    return articulos
      .map((a) => ({ ...a, total: totalsByArt.get(a.id) ?? 0, key: normalizarTexto(a.nombre) }))
      .filter((a) => a.stock_minimo > 0 && a.total < a.stock_minimo)
      .sort((a, b) => a.total - b.total)
      .slice(0, 5);
  }, [articulos, palets]);

  const tiles = [
    { label: "Artículos", value: stats.articulos, icon: Package, to: "/articulos" },
    { label: "Estanterías", value: stats.estanterias, icon: LayoutGrid, to: "/estanterias" },
    { label: "Stock total (cajas)", value: stats.stockTotal, icon: Boxes, to: "/stock-total" },
    { label: "Alertas stock bajo", value: stats.alertas, icon: AlertTriangle, to: "/stock-total", danger: stats.alertas > 0 },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel de control</h1>
          <p className="mt-1 text-muted-foreground">Control rápido del almacén: stock, mapa y ubicaciones.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/articulos"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo artículo</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/mapa"><Search className="mr-2 h-4 w-4" /> Buscar en mapa</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, to, danger }) => (
          <Link key={label} to={to} className="block">
            <Card className={danger ? "border-warning/60 bg-warning/5" : "transition-colors hover:bg-accent"}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{label}</CardDescription>
                <Icon className={danger ? "h-5 w-5 text-warning" : "h-5 w-5 text-muted-foreground"} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{loading ? "…" : value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {alertasStock.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning-foreground">
              <AlertTriangle className="h-5 w-5" /> Prioridad: stock bajo
            </CardTitle>
            <CardDescription>Estos artículos están por debajo del mínimo marcado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertasStock.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-semibold text-foreground">{textoSeguro(a.nombre, "Sin nombre")}</div>
                  <div className="text-xs text-muted-foreground">{textoSeguro(a.categoria, "Sin categoría")}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-warning">{a.total} cajas</div>
                  <div className="text-xs text-muted-foreground">mínimo {a.stock_minimo}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Link to="/mapa" className="block">
        <Card className="border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10">
          <CardHeader>
            <MapIcon className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">Ver mapa del almacén</CardTitle>
            <CardDescription>Vista intuitiva del almacén: pasillos, estanterías, huecos y palets.</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
};

export default Index;
