import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, History, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MenuGeneral } from "@/components/MenuGeneral";
import { useArticulos } from "@/articulos/useArticulos";
import { useMapa } from "@/nave/useMapa";
import { ListaHistorial } from "@/historial/ListaHistorial";
import { TIPOS_CAMBIO, nombreAutor, type TipoCambio } from "@/historial/modelo";
import { useAutores, useHistorial } from "@/historial/useHistorial";

const TODOS = "__todos__";
// El desplegable no admite valores vacíos: los cambios sin nombre van con esta marca
const SIN_NOMBRE = "__sin_nombre__";

/** Historial de cambios: quién cambió qué y cuándo, con filtros. */
const Historial = () => {
  const [params, setParams] = useSearchParams();
  const articuloId = params.get("articulo");
  const elementoId = params.get("zona");
  const [texto, setTexto] = useState("");
  const [textoBuscado, setTextoBuscado] = useState("");
  const [autor, setAutor] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoCambio | null>(null);
  const autores = useAutores();
  const articulos = useArticulos();
  const mapa = useMapa();

  // Se busca al dejar de escribir, no con cada letra
  useEffect(() => {
    const t = window.setTimeout(() => setTextoBuscado(texto), 350);
    return () => window.clearTimeout(t);
  }, [texto]);

  const historial = useHistorial({ articuloId, elementoId, autor, tipo, texto: textoBuscado });
  const cambios = historial.data?.pages.flat() ?? [];

  const nombreArticulo = articuloId ? (articulos.data?.find((a) => a.id === articuloId)?.nombre ?? cambios[0]?.articuloNombre ?? "Artículo") : null;
  const nombreZona = elementoId ? (mapa.elementos.find((e) => e.id === elementoId)?.nombre ?? cambios[0]?.elementoNombre ?? "Zona") : null;
  const quitarParam = (clave: string) => {
    const nuevos = new URLSearchParams(params);
    nuevos.delete(clave);
    setParams(nuevos, { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Mapa
            </Link>
          </Button>
          <h1 className="text-lg font-bold">Historial</h1>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/articulos">Artículos</Link>
          </Button>
          <MenuGeneral className="h-9 w-9 bg-background shadow-none backdrop-blur-none" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          Todo lo que se cambia en la app queda apuntado aquí con el nombre de quien lo hizo: cantidades, artículos y el mapa.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" type="search" placeholder="Buscar artículo, zona o persona…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <Select value={autor == null ? TODOS : autor || SIN_NOMBRE} onValueChange={(v) => setAutor(v === TODOS ? null : v === SIN_NOMBRE ? "" : v)}>
            <SelectTrigger className="sm:w-48" aria-label="Persona">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas las personas</SelectItem>
              {(autores.data ?? []).map((a) => (
                <SelectItem key={a || SIN_NOMBRE} value={a || SIN_NOMBRE}>
                  {nombreAutor(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {[null, ...(Object.keys(TIPOS_CAMBIO) as TipoCambio[])].map((t) => (
            <button
              key={t ?? "todo"}
              type="button"
              onClick={() => setTipo(t)}
              className={cn("rounded-full border px-3 py-1 text-sm", tipo === t ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
            >
              {t ? TIPOS_CAMBIO[t] : "Todo"}
            </button>
          ))}
          {nombreArticulo && (
            <span className="flex items-center gap-1 rounded-full border bg-accent px-3 py-1 text-sm">
              Artículo: <strong>{nombreArticulo}</strong>
              <button type="button" onClick={() => quitarParam("articulo")} aria-label="Quitar filtro de artículo" className="ml-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {nombreZona && (
            <span className="flex items-center gap-1 rounded-full border bg-accent px-3 py-1 text-sm">
              Zona: <strong>{nombreZona}</strong>
              <button type="button" onClick={() => quitarParam("zona")} aria-label="Quitar filtro de zona" className="ml-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        {historial.error && <p className="text-sm text-destructive">No se ha podido cargar el historial: {(historial.error as Error).message}</p>}
        {historial.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!historial.isLoading && cambios.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            <History className="mx-auto mb-2 h-8 w-8" />
            No hay cambios {textoBuscado || autor != null || tipo || articuloId || elementoId ? "que coincidan con los filtros" : "todavía"}.
          </div>
        )}

        <ListaHistorial cambios={cambios} />

        {historial.hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => void historial.fetchNextPage()} disabled={historial.isFetchingNextPage}>
              {historial.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ver más
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Historial;
