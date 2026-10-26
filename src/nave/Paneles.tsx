import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Minus, Package, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ESTADOS, cantidadEn, estadoStock, sinUbicar, total, urlFoto, type Articulo } from "@/articulos/modelo";
import { CLAVE_ARTICULOS, ajustarExistencia, fijarExistencia } from "@/articulos/useArticulos";

/** Panel flotante: a la derecha en pantallas anchas, abajo en el móvil. */
function PanelLateral({ id, children }: { id: string; children: ReactNode }) {
  return (
    <aside
      key={id}
      className={cn(
        "absolute z-20 overflow-y-auto rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur",
        "inset-x-3 bottom-3 max-h-[60dvh] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:max-h-[calc(100dvh-6rem)] sm:w-[22rem]",
        "animate-in fade-in slide-in-from-bottom-6 duration-700 sm:slide-in-from-bottom-0 sm:slide-in-from-right-6",
      )}
    >
      {children}
    </aside>
  );
}

function Miniatura({ a, grande = false }: { a: Articulo; grande?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white",
        grande ? "h-14 w-14" : "h-10 w-10",
      )}
    >
      {a.fotos[0] ? (
        <img src={urlFoto(a.fotos[0])} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <Package className={cn("text-muted-foreground", grande ? "h-6 w-6" : "h-5 w-5")} />
      )}
    </span>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const ESPERA_ENVIO = 800;

/**
 * Un artículo de la zona con su cantidad y botones + / −. Los toques seguidos se
 * juntan y se mandan como una sola suma o resta (una sola línea en el historial);
 * la suma la hace la base de datos, así que dos personas contando a la vez no se
 * pisan. Tocando el número se escribe la cantidad exacta.
 */
function FilaStock({ a, zona, onAbrir }: { a: Articulo; zona: Elemento; onAbrir: () => void }) {
  const queryClient = useQueryClient();
  const existencia = a.existencias.find((e) => e.elementoId === zona.id);
  const [pendiente, setPendiente] = useState(0);
  const pendienteRef = useRef(0);
  const espera = useRef<number>();
  const [escribiendo, setEscribiendo] = useState<string | null>(null);

  const ponerEnCache = (id: string, cantidad: (antes: number) => number) =>
    queryClient.setQueryData<Articulo[]>(CLAVE_ARTICULOS, (lista) =>
      lista?.map((x) =>
        x.id !== a.id ? x : { ...x, existencias: x.existencias.map((e) => (e.id === id ? { ...e, cantidad: cantidad(e.cantidad) } : e)) },
      ),
    );

  const enviar = async () => {
    window.clearTimeout(espera.current);
    const delta = pendienteRef.current;
    if (!delta || !existencia) return;
    pendienteRef.current = 0;
    setPendiente(0);
    ponerEnCache(existencia.id, (c) => Math.max(0, c + delta));
    try {
      const nueva = await ajustarExistencia(existencia.id, delta);
      if (nueva != null) ponerEnCache(existencia.id, () => nueva);
    } catch (err) {
      toast.error(`No se ha podido guardar la cantidad de ${a.nombre}`, { description: (err as Error).message });
      void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
    }
  };

  // Al cerrar el panel con toques sin mandar, se mandan ya
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  useEffect(() => () => void enviarRef.current(), []);

  if (!existencia) return null;
  const cantidad = existencia.cantidad + pendiente;

  const sumar = (d: number) => {
    if (cantidad + d < 0) return;
    pendienteRef.current += d;
    setPendiente(pendienteRef.current);
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => void enviar(), ESPERA_ENVIO);
  };

  const confirmarEscrito = async () => {
    const texto = escribiendo;
    setEscribiendo(null);
    const nueva = parseInt(texto ?? "", 10);
    if (Number.isNaN(nueva) || nueva < 0 || nueva === existencia.cantidad) return;
    try {
      const guardada = await fijarExistencia(existencia.id, existencia.cantidad, nueva);
      if (guardada == null) {
        toast.warning(`Alguien acaba de cambiar ${a.nombre} aquí`, { description: "Ya ves la cantidad de ahora; si hace falta, vuelve a escribirla." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      } else ponerEnCache(existencia.id, () => guardada);
    } catch (err) {
      toast.error(`No se ha podido guardar la cantidad de ${a.nombre}`, { description: (err as Error).message });
    }
  };

  const bajo = estadoStock(a) === "bajo-minimo";

  return (
    <li className="flex items-center gap-2 px-2 py-2">
      <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left hover:opacity-80">
        <Miniatura a={a} />
        <span className="min-w-0">
          <span className="line-clamp-2 text-sm font-medium leading-tight">{a.nombre}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {bajo ? <span className="font-medium text-peligro">Bajo mínimo · </span> : null}
            {a.categoria || a.unidad}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label={`Quitar uno de ${a.nombre}`}
          disabled={cantidad <= 0}
          onClick={() => sumar(-1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        {escribiendo != null ? (
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={0}
            value={escribiendo}
            onChange={(e) => setEscribiendo(e.target.value)}
            onBlur={() => void confirmarEscrito()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEscribiendo(null);
            }}
            className="h-9 w-14 rounded-md border bg-background text-center text-base font-semibold tabular-nums"
            aria-label={`Cantidad de ${a.nombre}`}
          />
        ) : (
          <button
            type="button"
            onClick={async () => {
              await enviar();
              setEscribiendo(String(existencia.cantidad + pendienteRef.current));
            }}
            className={cn("flex w-14 flex-col items-center rounded-md py-0.5 leading-tight hover:bg-accent", pendiente !== 0 && "text-marca-lima-oscuro")}
            title="Escribir la cantidad"
          >
            <span className="text-base font-semibold tabular-nums">{cantidad}</span>
            <span className="max-w-full truncate text-[10px] text-muted-foreground">{a.unidad}</span>
          </button>
        )}
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label={`Añadir uno de ${a.nombre}`} onClick={() => sumar(1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

/** Lo que hay guardado en una zona, con su cantidad y botones para contar. */
function QueHayAqui({
  zona,
  articulos,
  cargando,
  onAbrir,
  onNuevo,
}: {
  zona: Elemento;
  articulos: Articulo[];
  cargando: boolean;
  onAbrir: (a: Articulo, ponerAqui: boolean) => void;
  onNuevo: () => void;
}) {
  const aqui = articulos.filter((a) => a.existencias.some((e) => e.elementoId === zona.id));
  const otros = articulos.filter((a) => !a.existencias.some((e) => e.elementoId === zona.id));

  return (
    <section className="mt-4">
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
                  <DropdownMenuItem key={a.id} onSelect={() => onAbrir(a, true)}>
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
        <ul className="divide-y rounded-lg border">
          {aqui.map((a) => (
            <FilaStock key={a.id} a={a} zona={zona} onAbrir={() => onAbrir(a, false)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function PanelZona({
  zona,
  articulos,
  cargando,
  onVolver,
  onAbrir,
  onNuevo,
}: {
  zona: Elemento;
  articulos: Articulo[];
  cargando: boolean;
  onVolver: () => void;
  onAbrir: (a: Articulo, ponerAqui: boolean) => void;
  onNuevo: () => void;
}) {
  const sentido = textoSentido(zona);
  return (
    <PanelLateral id={zona.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: zona.color }} />
            <h2 className="truncate text-lg font-semibold">{zona.nombre}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{zona.categoria}</p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" onClick={onVolver} aria-label="Volver a la nave">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {zona.descripcion && <p className="mt-3 text-sm text-muted-foreground">{zona.descripcion}</p>}
      <dl className="mt-3 divide-y rounded-lg border px-3">
        <Dato etiqueta="Tipo">{TIPOS[zona.tipo]}</Dato>
        {sentido && <Dato etiqueta="Sentido">{sentido}</Dato>}
        {zona.muelle && <Dato etiqueta="Llega a">{zona.muelle}</Dato>}
        <Dato etiqueta="Posición en el plano">{referenciaDe(zona.area)}</Dato>
      </dl>
      <QueHayAqui zona={zona} articulos={articulos} cargando={cargando} onAbrir={onAbrir} onNuevo={onNuevo} />
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" variant="secondary" onClick={onVolver}>
          Volver a la nave
        </Button>
        <Button variant="outline" size="icon" asChild title="Historial de esta zona">
          <Link to={`/historial?zona=${zona.id}`} aria-label="Historial de esta zona">
            <History className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </PanelLateral>
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
