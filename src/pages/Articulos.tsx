import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, FileDown, Package, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { puntuar } from "@/lib/texto";
import { MenuGeneral } from "@/components/MenuGeneral";
import { Logo } from "@/components/Logo";
import { useMapa } from "@/nave/useMapa";
import { useArticulos } from "@/articulos/useArticulos";
import { ESTADOS, articuloVacio, estadoStock, sinUbicar, textoBuscable, tieneSinUbicar, total, urlFoto } from "@/articulos/modelo";
import { FichaArticulo } from "@/articulos/FichaArticulo";
import { DialogoExportar } from "@/exportar/DialogoExportar";

type Filtro = { tipo: "categoria"; valor: string } | { tipo: "bajo-minimo" } | { tipo: "sin-ubicar" } | null;

const filtroInicial = (ver: string | null): Filtro =>
  ver === "sin-ubicar" ? { tipo: "sin-ubicar" } : ver === "bajo-minimo" ? { tipo: "bajo-minimo" } : null;

function Chip({ activo, aviso, onClick, children }: { activo: boolean; aviso?: "rojo" | "ambar"; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition",
        activo
          ? "border-primary bg-primary text-primary-foreground"
          : aviso === "rojo"
            ? "border-peligro-borde bg-peligro-suave text-peligro-texto hover:bg-peligro-suave/70"
            : aviso === "ambar"
              ? "border-aviso-borde bg-aviso-suave text-aviso-texto hover:bg-aviso-suave/70"
              : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/** Catálogo de artículos: fotos, cuántos hay y dónde. */
const Articulos = () => {
  const { articuloId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: articulos = [], isLoading, error } = useArticulos();
  const mapa = useMapa();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(() => filtroInicial(params.get("ver")));
  const [exportando, setExportando] = useState(false);

  const nombreZona = useMemo(() => {
    const porId = new Map(mapa.elementos.map((e) => [e.id, e.nombre]));
    return (id: string) => porId.get(id);
  }, [mapa.elementos]);

  const categorias = useMemo(() => [...new Set(articulos.map((a) => a.categoria).filter(Boolean))].sort(), [articulos]);
  const bajoMinimo = articulos.filter((a) => estadoStock(a) === "bajo-minimo");
  const conSinUbicar = articulos.filter(tieneSinUbicar);

  const visibles = useMemo(() => {
    const filtrados = articulos.filter((a) =>
      !filtro
        ? true
        : filtro.tipo === "categoria"
          ? a.categoria === filtro.valor
          : filtro.tipo === "bajo-minimo"
            ? estadoStock(a) === "bajo-minimo"
            : tieneSinUbicar(a),
    );
    if (!busqueda.trim()) return filtrados;
    return filtrados
      .map((a) => ({ a, p: puntuar(busqueda, a.nombre, textoBuscable(a, nombreZona)) }))
      .filter((x) => x.p > 0)
      .sort((x, y) => y.p - x.p)
      .map((x) => x.a);
  }, [articulos, filtro, busqueda, nombreZona]);

  const esNuevo = articuloId === "nuevo";
  const abierto = esNuevo ? articuloVacio(params.get("zona")) : articulos.find((a) => a.id === articuloId);
  const inicial = useMemo(() => abierto, [articuloId, articulos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const alternar = (f: Filtro) => setFiltro((actual) => (JSON.stringify(actual) === JSON.stringify(f) ? null : f));

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            aria-label="Volver al mapa"
            title="Volver al mapa"
            className="flex items-center gap-2 rounded-full py-1 pr-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <Logo className="h-7 sm:h-6" compacto />
          </Link>
          <span className="h-6 w-px bg-border" aria-hidden />
          <h1 className="text-lg font-bold">Artículos</h1>
          <span className="flex-1" />
          <Button variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex" onClick={() => setExportando(true)}>
            <FileDown className="h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/articulos/nuevo")}>
            <Plus className="h-4 w-4" /> <span className="hidden min-[400px]:inline">Nuevo</span>
          </Button>
          <MenuGeneral className="h-9 w-9" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        {conSinUbicar.length > 0 && filtro?.tipo !== "sin-ubicar" && (
          <button
            type="button"
            onClick={() => setFiltro({ tipo: "sin-ubicar" })}
            className="flex w-full items-center gap-3 rounded-xl border border-aviso-borde bg-aviso-suave p-3 text-left text-sm text-aviso-texto"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {conSinUbicar.length === 1 ? "1 artículo tiene" : `${conSinUbicar.length} artículos tienen`} cantidades sin ubicar (su zona se
              borró del mapa).
            </span>
            <span className="font-semibold underline-offset-2 hover:underline">Ver</span>
          </button>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, categoría, medida, zona…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            type="search"
          />
        </div>
        {articulos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip activo={!filtro} onClick={() => setFiltro(null)}>
              Todos <span className="opacity-70">{articulos.length}</span>
            </Chip>
            {bajoMinimo.length > 0 && (
              <Chip activo={filtro?.tipo === "bajo-minimo"} aviso="rojo" onClick={() => alternar({ tipo: "bajo-minimo" })}>
                Bajo mínimo <span className="opacity-70">{bajoMinimo.length}</span>
              </Chip>
            )}
            {conSinUbicar.length > 0 && (
              <Chip activo={filtro?.tipo === "sin-ubicar"} aviso="ambar" onClick={() => alternar({ tipo: "sin-ubicar" })}>
                Sin ubicar <span className="opacity-70">{conSinUbicar.length}</span>
              </Chip>
            )}
            {categorias.map((c) => (
              <Chip key={c} activo={filtro?.tipo === "categoria" && filtro.valor === c} onClick={() => alternar({ tipo: "categoria", valor: c })}>
                {c}
              </Chip>
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
          {visibles.map((a) => {
            const estado = estadoStock(a);
            const fuera = sinUbicar(a);
            const zonas = new Set(a.existencias.filter((e) => e.elementoId).map((e) => e.elementoId)).size;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/articulos/${a.id}`)}
                className="relative overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:shadow-md"
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
                {estado === "bajo-minimo" && (
                  <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm", ESTADOS[estado].clase)}>
                    {ESTADOS[estado].nombre}
                  </span>
                )}
                <div className="space-y-0.5 p-3">
                  <div className="truncate font-semibold">{a.nombre}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.categoria || "Sin categoría"}</div>
                  <div className="text-sm">
                    <span className="font-semibold tabular-nums">{total(a)}</span> {a.unidad}
                    {zonas > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {zonas} {zonas === 1 ? "zona" : "zonas"}
                      </span>
                    )}
                  </div>
                  {fuera > 0 && <div className="text-xs font-medium text-aviso-texto">{fuera} sin ubicar</div>}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {articuloId && inicial && (
        <FichaArticulo
          key={articuloId}
          inicial={inicial}
          esNuevo={esNuevo}
          elementos={mapa.elementos}
          categorias={categorias}
          onCerrar={() => navigate("/articulos")}
          onVerEnMapa={(a) => navigate(`/?articulo=${a.id}`)}
        />
      )}
      <DialogoExportar abierto={exportando} onCerrar={() => setExportando(false)} />
    </div>
  );
};

export default Articulos;
