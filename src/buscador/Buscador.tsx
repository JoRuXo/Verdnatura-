import { useMemo, useState } from "react";
import { CircleCheck, Clock, FileDown, History, LayoutGrid, Package, Plus, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { puntuar } from "@/lib/texto";
import { TIPOS, type Elemento } from "@/nave/elementos";
import { ESTADOS, estadoStock, textoBuscable, total, urlFoto, type Articulo } from "@/articulos/modelo";
import { anotarReciente, leerRecientes } from "./recientes";

export type AccionBuscador = "catalogo" | "nuevo" | "exportar" | "historial";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  articulos: Articulo[];
  elementos: Elemento[];
  onArticulo: (a: Articulo) => void;
  onZona: (z: Elemento) => void;
  onAccion: (accion: AccionBuscador) => void;
};

const MAX_ARTICULOS = 8;
const MAX_ZONAS = 6;

function FilaArticulo({ a, nombreZona }: { a: Articulo; nombreZona: (id: string) => string | undefined }) {
  const estado = estadoStock(a);
  const zonas = a.existencias.filter((e) => e.elementoId).map((e) => nombreZona(e.elementoId!)).filter(Boolean);
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
        {a.fotos[0] ? (
          <img src={urlFoto(a.fotos[0])} alt="" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <Package className="!h-4 !w-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{a.nombre}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[a.categoria, zonas.length ? zonas.join(", ") : "Sin colocar en el mapa"].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums">
          {total(a)} <span className="text-xs font-normal text-muted-foreground">{a.unidad}</span>
        </span>
        {estado === "bajo-minimo" && (
          <span className={cn("rounded px-1.5 text-[10px] font-semibold", ESTADOS[estado].clase)}>{ESTADOS[estado].nombre}</span>
        )}
      </span>
    </>
  );
}

function FilaZona({ z, articulos }: { z: Elemento; articulos: number }) {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <span className="h-3.5 w-3.5 rounded-full ring-4 ring-background" style={{ backgroundColor: z.color, boxShadow: `0 0 0 6px ${z.color}33` }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{z.nombre}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[TIPOS[z.tipo], z.categoria !== z.nombre ? z.categoria : "", z.muelle].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {articulos === 0 ? "vacía" : articulos === 1 ? "1 artículo" : `${articulos} artículos`}
      </span>
    </>
  );
}

/** Buscador del mapa: artículos (por nombre, categoría, características o zona) y zonas. */
export function Buscador({ abierto, onCerrar, articulos, elementos, onArticulo, onZona, onAccion }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const zonaPorId = useMemo(() => new Map(elementos.map((e) => [e.id, e])), [elementos]);
  const nombreZona = (id: string) => zonaPorId.get(id)?.nombre;
  const articulosEnZona = useMemo(() => {
    const n = new Map<string, number>();
    for (const a of articulos) for (const id of new Set(a.existencias.map((e) => e.elementoId))) if (id) n.set(id, (n.get(id) ?? 0) + 1);
    return n;
  }, [articulos]);

  const q = busqueda.trim();
  const encontrados = useMemo(() => {
    if (!q) return { articulos: [], zonas: [] };
    const nombre = (id: string) => zonaPorId.get(id)?.nombre;
    return {
      articulos: articulos
        .map((a) => ({ a, p: puntuar(q, a.nombre, textoBuscable(a, nombre)) }))
        .filter((x) => x.p > 0)
        .sort((x, y) => y.p - x.p || x.a.nombre.localeCompare(y.a.nombre, "es"))
        .slice(0, MAX_ARTICULOS)
        .map((x) => x.a),
      zonas: elementos
        .filter((z) => z.almacen)
        .map((z) => ({ z, p: puntuar(q, z.nombre, [z.categoria, TIPOS[z.tipo], z.muelle ?? "", z.descripcion]) }))
        .filter((x) => x.p > 0)
        .sort((x, y) => y.p - x.p)
        .slice(0, MAX_ZONAS)
        .map((x) => x.z),
    };
  }, [q, articulos, elementos, zonaPorId]);

  const recientes = useMemo(
    () =>
      abierto
        ? leerRecientes()
            .map((r) => (r.tipo === "articulo" ? articulos.find((a) => a.id === r.id) : zonaPorId.get(r.id)))
            .filter((x): x is Articulo | Elemento => !!x)
        : [],
    [abierto, articulos, zonaPorId],
  );
  const bajoMinimo = articulos.filter((a) => estadoStock(a) === "bajo-minimo").slice(0, 5);

  const cerrar = () => {
    setBusqueda("");
    onCerrar();
  };
  const elegirArticulo = (a: Articulo) => {
    anotarReciente({ tipo: "articulo", id: a.id });
    cerrar();
    onArticulo(a);
  };
  const elegirZona = (z: Elemento) => {
    anotarReciente({ tipo: "zona", id: z.id });
    cerrar();
    onZona(z);
  };
  const accion = (a: AccionBuscador) => {
    cerrar();
    onAccion(a);
  };

  const esArticulo = (x: Articulo | Elemento): x is Articulo => "existencias" in x;

  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && cerrar()}>
      <DialogContent className="top-[8%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%] [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-base [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2">
          <CommandInput value={busqueda} onValueChange={setBusqueda} placeholder="Busca un artículo, una zona, una medida…" />
          <CommandList className="max-h-[min(65vh,520px)]">
            {q ? (
              <>
                <CommandEmpty>
                  <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  Nada coincide con «{q}».
                </CommandEmpty>
                {encontrados.articulos.length > 0 && (
                  <CommandGroup heading="Artículos">
                    {encontrados.articulos.map((a) => (
                      <CommandItem key={a.id} value={`a:${a.id}`} onSelect={() => elegirArticulo(a)}>
                        <FilaArticulo a={a} nombreZona={nombreZona} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {encontrados.zonas.length > 0 && (
                  <CommandGroup heading="Zonas y objetos del mapa">
                    {encontrados.zonas.map((z) => (
                      <CommandItem key={z.id} value={`z:${z.id}`} onSelect={() => elegirZona(z)}>
                        <FilaZona z={z} articulos={articulosEnZona.get(z.id) ?? 0} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            ) : (
              <>
                {recientes.length > 0 && (
                  <CommandGroup heading="Vistos hace poco">
                    {recientes.map((x) =>
                      esArticulo(x) ? (
                        <CommandItem key={x.id} value={`ra:${x.id}`} onSelect={() => elegirArticulo(x)}>
                          <FilaArticulo a={x} nombreZona={nombreZona} />
                        </CommandItem>
                      ) : (
                        <CommandItem key={x.id} value={`rz:${x.id}`} onSelect={() => elegirZona(x)}>
                          <FilaZona z={x} articulos={articulosEnZona.get(x.id) ?? 0} />
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                )}
                {bajoMinimo.length > 0 && (
                  <CommandGroup heading="Por debajo del mínimo">
                    {bajoMinimo.map((a) => (
                      <CommandItem key={a.id} value={`bm:${a.id}`} onSelect={() => elegirArticulo(a)}>
                        <FilaArticulo a={a} nombreZona={nombreZona} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {(recientes.length > 0 || bajoMinimo.length > 0) && <CommandSeparator />}
                <CommandGroup heading="Ir a">
                  <CommandItem value="x:catalogo" onSelect={() => accion("catalogo")}>
                    <LayoutGrid className="text-muted-foreground" /> Catálogo de artículos
                  </CommandItem>
                  <CommandItem value="x:nuevo" onSelect={() => accion("nuevo")}>
                    <Plus className="text-muted-foreground" /> Nuevo artículo
                  </CommandItem>
                  <CommandItem value="x:exportar" onSelect={() => accion("exportar")}>
                    <FileDown className="text-muted-foreground" /> Exportar stock (Excel o PDF)
                  </CommandItem>
                  <CommandItem value="x:historial" onSelect={() => accion("historial")}>
                    <History className="text-muted-foreground" /> Historial de cambios
                  </CommandItem>
                </CommandGroup>
                {!recientes.length && (
                  <p className="flex items-center gap-2 px-4 pb-3 pt-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Lo que abras desde aquí saldrá luego en «Vistos hace poco».
                  </p>
                )}
                {bajoMinimo.length === 0 && articulos.some((a) => a.stockMinimo != null) && (
                  <p className="flex items-center gap-2 px-4 pb-3 text-xs text-correcto-texto">
                    <CircleCheck className="h-3.5 w-3.5" /> Ningún artículo está por debajo de su mínimo.
                  </p>
                )}
              </>
            )}
          </CommandList>
          <div className="hidden items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground sm:flex">
            <span>
              <kbd className="rounded border bg-muted px-1">↑</kbd> <kbd className="rounded border bg-muted px-1">↓</kbd> moverse
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1">Enter</kbd> abrir
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1">Esc</kbd> cerrar
            </span>
            <span className="ml-auto">Da igual escribir con o sin tildes</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
