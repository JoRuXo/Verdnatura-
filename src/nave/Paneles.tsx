import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, MousePointerClick, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TIPOS, referenciaDe, textoSentido, type Elemento } from "./elementos";
import { ESTADOS, cantidadEn, estadoStock, sinUbicar, total, type Articulo } from "@/articulos/modelo";
import { ArmarioEditable } from "./ArmarioEditable";
import { ContadorCantidad, Miniatura } from "./ControlesArticulo";
import { DetalleArticulo } from "./DetalleArticulo";
import { TextoEditable } from "./TextoEditable";
import { CLAVE_MAPA, guardarZona, type CambiosZona } from "./useMapa";

/** Panel flotante: a la derecha en pantallas anchas, abajo en el móvil. */
function PanelLateral({ id, children }: { id: string; children: ReactNode }) {
  return (
    <aside
      key={id}
      className={cn(
        "absolute z-20 overflow-y-auto rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur",
        "inset-x-3 bottom-3 max-h-[60dvh] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-32 sm:max-h-[calc(100dvh-9rem)] sm:w-[22rem]",
        "animate-in fade-in slide-in-from-bottom-6 duration-700 sm:slide-in-from-bottom-0 sm:slide-in-from-right-6",
      )}
    >
      {children}
    </aside>
  );
}

/** Un artículo de la zona: se toca para verlo y editarlo; a la derecha, su cantidad con + / −. */
function FilaArticulo({ a, zona, elegido, onElegir }: { a: Articulo; zona: Elemento; elegido: boolean; onElegir: () => void }) {
  const existencia = a.existencias.find((e) => e.elementoId === zona.id);
  if (!existencia) return null;
  const bajo = estadoStock(a) === "bajo-minimo";
  const resumen = a.descripcion.split("\n").find((l) => l.trim()) ?? "";
  return (
    <li className={cn("flex items-center gap-2 px-2 py-2 transition-colors", elegido && "bg-marca-lima/15")}>
      <button
        type="button"
        onClick={onElegir}
        aria-pressed={elegido}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left hover:opacity-80"
      >
        <Miniatura a={a} />
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-medium leading-tight">{a.nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {bajo ? <span className="font-medium text-peligro">Bajo mínimo · </span> : null}
            {resumen || a.categoria || a.unidad}
          </span>
        </span>
      </button>
      <ContadorCantidad a={a} existencia={existencia} />
    </li>
  );
}

/** Lo que hay guardado en una zona, con su cantidad y botones para contar. */
function QueHayAqui({
  zona,
  articulos,
  cargando,
  elegido,
  onElegir,
  onAnadir,
  onNuevo,
}: {
  zona: Elemento;
  articulos: Articulo[];
  cargando: boolean;
  elegido: string | null;
  onElegir: (existenciaId: string) => void;
  onAnadir: (a: Articulo) => void;
  onNuevo: () => void;
}) {
  const aqui = articulos.filter((a) => a.existencias.some((e) => e.elementoId === zona.id));
  const otros = articulos.filter((a) => !a.existencias.some((e) => e.elementoId === zona.id));

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Qué hay aquí</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Añadir
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[50vh] w-60 overflow-y-auto">
            <DropdownMenuItem onSelect={onNuevo}>
              <Plus className="mr-2 h-4 w-4" /> Artículo nuevo…
            </DropdownMenuItem>
            {otros.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Uno que ya existe</DropdownMenuLabel>
                {otros.map((a) => (
                  <DropdownMenuItem key={a.id} onSelect={() => onAnadir(a)}>
                    <span className="truncate">{a.nombre}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">{a.categoria}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {cargando && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!cargando && aqui.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No hay nada apuntado en esta zona.</p>
      )}
      {aqui.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {aqui.map((a) => {
            const e = a.existencias.find((x) => x.elementoId === zona.id)!;
            return <FilaArticulo key={a.id} a={a} zona={zona} elegido={elegido === e.id} onElegir={() => onElegir(e.id)} />;
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Una zona del mapa, en una ventana en el medio: qué es, el armario de frente
 * (si lo es) y lo que hay guardado. Lo que se toca se ve y se edita al lado.
 * El nombre y la descripción de la zona los cambian los administradores.
 */
export function PanelZona({
  zona,
  articulos,
  cargando,
  esAdmin,
  categorias,
  onVolver,
  onAbrir,
  onNuevo,
}: {
  zona: Elemento;
  articulos: Articulo[];
  cargando: boolean;
  esAdmin: boolean;
  categorias: string[];
  onVolver: () => void;
  onAbrir: (a: Articulo, ponerAqui: boolean) => void;
  onNuevo: () => void;
}) {
  const queryClient = useQueryClient();
  const sentido = textoSentido(zona);
  const esArmario = zona.tipo === "estanteria" && zona.modelo === "informatica";
  const [elegida, setElegida] = useState<string | null>(null);
  const detalleRef = useRef<HTMLDivElement>(null);

  const seleccion = elegida
    ? articulos.flatMap((a) => a.existencias.filter((e) => e.id === elegida && e.elementoId === zona.id).map((e) => ({ a, e })))[0]
    : undefined;
  // Si lo elegido deja de estar aquí (lo han quitado), no se queda colgando
  useEffect(() => {
    if (elegida && !seleccion && !cargando) setElegida(null);
  }, [elegida, seleccion, cargando]);

  const elegir = (id: string | null) => {
    setElegida(id);
    // En el móvil el detalle queda debajo: se lleva a la vista
    if (id && window.matchMedia("(max-width: 767px)").matches) {
      window.setTimeout(() => {
        const detalle = detalleRef.current;
        const caja = detalle?.closest<HTMLElement>(".overflow-y-auto");
        if (!detalle || !caja) return;
        const arriba = caja.scrollTop + detalle.getBoundingClientRect().top - caja.getBoundingClientRect().top - 12;
        caja.scrollTo({ top: arriba, behavior: "smooth" });
      }, 80);
    }
  };

  const guardarDeZona = async (cambios: CambiosZona) => {
    try {
      if (!(await guardarZona(zona, cambios))) {
        toast.warning("Alguien acaba de cambiar esta zona", { description: "Ya ves lo de ahora." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_MAPA });
        throw new Error("conflicto");
      }
      queryClient.setQueryData<Elemento[]>(CLAVE_MAPA, (lista) => lista?.map((x) => (x.id === zona.id ? { ...x, ...cambios } : x)));
    } catch (err) {
      if ((err as Error).message !== "conflicto") toast.error("No se ha podido guardar la zona", { description: (err as Error).message });
      throw err;
    }
  };

  return (
    <Dialog open onOpenChange={(abierta) => !abierta && onVolver()}>
      <DialogContent
        className={cn(
          "flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-h-[88dvh]",
          "[&>button:last-child]:right-3 [&>button:last-child]:top-3",
        )}
        // Esc mientras se escribe solo deja lo que había; no cierra la ventana
        onEscapeKeyDown={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) e.preventDefault();
        }}
        // Al abrir no se pone a escribir en el primer campo
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{zona.nombre}</DialogTitle>
        <DialogDescription className="sr-only">Lo que hay en {zona.nombre} y sus datos</DialogDescription>

        <header className="border-b px-5 pb-3 pt-4">
          <div className="flex items-center gap-2 pr-8">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: zona.color }} />
            {esAdmin ? (
              <TextoEditable
                valor={zona.nombre}
                obligatorio
                etiqueta="Nombre de la zona"
                className="text-xl font-semibold"
                onGuardar={(nombre) => guardarDeZona({ nombre })}
              />
            ) : (
              <h2 className="truncate text-xl font-semibold">{zona.nombre}</h2>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap gap-x-2 pl-5 text-xs text-muted-foreground">
            <span>{zona.categoria}</span>
            <span>· {TIPOS[zona.tipo]}</span>
            <span>· {referenciaDe(zona.area)}</span>
            {sentido && <span>· {sentido}</span>}
            {zona.muelle && <span>· Llega a {zona.muelle}</span>}
          </p>
          <div className="mt-2 pl-5">
            <TextoEditable
              valor={zona.descripcion}
              soloLeer={!esAdmin}
              multilinea
              etiqueta="Descripción de la zona"
              placeholder="Añade una descripción de esta zona…"
              className="text-sm text-muted-foreground"
              onGuardar={(descripcion) => guardarDeZona({ descripcion })}
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {esArmario && (
            <div className="mb-5">
              <ArmarioEditable zona={zona} articulos={articulos} esAdmin={esAdmin} elegida={elegida} onElegir={elegir} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <QueHayAqui
              zona={zona}
              articulos={articulos}
              cargando={cargando}
              elegido={elegida}
              onElegir={(id) => elegir(elegida === id ? null : id)}
              onAnadir={(a) => onAbrir(a, true)}
              onNuevo={onNuevo}
            />
            <div ref={detalleRef} className="scroll-mt-4 rounded-lg border bg-muted/30 p-4">
              {seleccion ? (
                <DetalleArticulo
                  key={seleccion.e.id}
                  a={seleccion.a}
                  existencia={seleccion.e}
                  zona={zona}
                  categorias={categorias}
                  onMasOpciones={() => onAbrir(seleccion.a, false)}
                />
              ) : (
                <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <MousePointerClick className="h-6 w-6 opacity-60" />
                  {esArmario ? "Toca una caja o un artículo para ver y cambiar sus datos." : "Toca un artículo para ver y cambiar sus datos."}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="flex gap-2 border-t px-5 py-3">
          <Button className="flex-1" variant="secondary" onClick={onVolver}>
            Volver a la nave
          </Button>
          <Button variant="outline" size="icon" asChild title="Historial de esta zona">
            <Link to={`/historial?zona=${zona.id}`} aria-label="Historial de esta zona">
              <History className="h-4 w-4" />
            </Link>
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** Resultado del buscador: el artículo, cuánto hay y en qué zonas (señaladas en el mapa). */
export function PanelArticulo({
  articulo: a,
  elementos,
  onZona,
  onAbrirFicha,
  onCerrar,
}: {
  articulo: Articulo;
  elementos: Elemento[];
  onZona: (z: Elemento) => void;
  onAbrirFicha: () => void;
  onCerrar: () => void;
}) {
  const estado = estadoStock(a);
  const zonas = elementos
    .filter((z) => a.existencias.some((e) => e.elementoId === z.id))
    .map((z) => ({ z, cantidad: cantidadEn(a, z.id) }))
    .sort((x, y) => y.cantidad - x.cantidad);
  const fuera = sinUbicar(a);

  return (
    <PanelLateral id={`articulo-${a.id}`}>
      <div className="flex items-start gap-3">
        <Miniatura a={a} grande />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{a.nombre}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.categoria || "Sin categoría"}</p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" onClick={onCerrar} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{total(a)}</span>
        <span className="text-sm text-muted-foreground">{a.unidad} en total</span>
        {estado !== "ok" && <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-medium", ESTADOS[estado].clase)}>{ESTADOS[estado].nombre}</span>}
      </div>
      {a.stockMinimo != null && <p className="text-xs text-muted-foreground">Mínimo: {a.stockMinimo}</p>}

      <h3 className="mb-2 mt-4 text-sm font-semibold">Dónde está</h3>
      {zonas.length === 0 && !fuera && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No está colocado en ninguna zona.</p>
      )}
      {(zonas.length > 0 || fuera > 0) && (
        <ul className="divide-y rounded-lg border">
          {zonas.map(({ z, cantidad }) => (
            <li key={z.id}>
              <button type="button" onClick={() => onZona(z)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{z.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground">{referenciaDe(z.area)}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{cantidad}</span>
              </button>
            </li>
          ))}
          {fuera > 0 && (
            <li className="flex items-center gap-2.5 bg-aviso-suave px-3 py-2 text-aviso-texto">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-aviso" />
              <span className="flex-1 text-sm">Sin ubicar</span>
              <span className="text-sm font-semibold tabular-nums">{fuera}</span>
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onAbrirFicha}>
          Abrir ficha
        </Button>
        <Button className="flex-1" variant="secondary" onClick={onCerrar}>
          Volver a la nave
        </Button>
      </div>
    </PanelLateral>
  );
}
