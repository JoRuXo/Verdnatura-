import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Package, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMapa } from "@/nave/useMapa";
import { useArticulos } from "@/articulos/useArticulos";
import { articuloVacio, total, urlFoto } from "@/articulos/modelo";
import { FichaArticulo } from "@/articulos/FichaArticulo";

/** Catálogo de artículos: fotos, cuántos hay y dónde. */
const Articulos = () => {
  const { articuloId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: articulos = [], isLoading, error } = useArticulos();
  const mapa = useMapa();
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const categorias = useMemo(() => [...new Set(articulos.map((a) => a.categoria).filter(Boolean))].sort(), [articulos]);
  const visibles = articulos.filter(
    (a) =>
      (!categoria || a.categoria === categoria) &&
      (!busqueda || `${a.nombre} ${a.categoria} ${a.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())),
  );

  const esNuevo = articuloId === "nuevo";
  const abierto = esNuevo ? articuloVacio(params.get("zona")) : articulos.find((a) => a.id === articuloId);
  const inicial = useMemo(() => abierto, [articuloId, articulos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Mapa
            </Link>
          </Button>
          <h1 className="text-lg font-bold">Artículos</h1>
          <span className="flex-1" />
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/articulos/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar artículo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {[null, ...categorias].map((c) => (
              <button
                key={c ?? "todas"}
                type="button"
                onClick={() => setCategoria(c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  categoria === c ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {c ?? "Todas"}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">No se han podido cargar los artículos: {(error as Error).message}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && visibles.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8" />
            {articulos.length ? "Nada coincide con la búsqueda." : "Aún no hay artículos. Pulsa «Nuevo» para añadir el primero."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/articulos/${a.id}`)}
              className="overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-square bg-white">
                {a.fotos[0] ? (
                  <img src={urlFoto(a.fotos[0])} alt={a.nombre} loading="lazy" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Package className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5 p-3">
                <div className="truncate font-semibold">{a.nombre}</div>
                <div className="truncate text-xs text-muted-foreground">{a.categoria || "Sin categoría"}</div>
                <div className="text-sm">
                  {total(a)} {a.unidad}
                  {a.existencias.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {a.existencias.length} {a.existencias.length === 1 ? "zona" : "zonas"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {articuloId && inicial && (
        <FichaArticulo
          inicial={inicial}
          esNuevo={esNuevo}
          elementos={mapa.elementos}
          categorias={categorias}
          onCerrar={() => navigate("/articulos")}
        />
      )}
    </div>
  );
};

export default Articulos;
