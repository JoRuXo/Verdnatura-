import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ChevronRight,
  Grid3x3,
  ListTree,
  Maximize,
  Moon,
  MousePointerClick,
  Package,
  Pencil,
  Plus,
  Route,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { esGamaLigera } from "@/nave/dispositivo";
import { TIPOS, agruparPorCategoria, duplicar, nuevoElemento, referenciaDe, textoSentido, type Elemento } from "@/nave/elementos";
import { guardarMapa, useMapa } from "@/nave/useMapa";
import { useEditor } from "@/nave/useEditor";
import { PanelEdicion } from "@/nave/PanelEdicion";
import { BarraEdicion } from "@/nave/BarraEdicion";
import type { EdicionEscena, RefCentro } from "@/nave/EscenaNave";
import { useArticulos } from "@/articulos/useArticulos";
import { articuloVacio, urlFoto, type Articulo } from "@/articulos/modelo";
import { FichaArticulo } from "@/articulos/FichaArticulo";

// Three.js pesa bastante: se carga aparte para que la página aparezca enseguida
const EscenaNave = lazy(() => import("@/nave/EscenaNave"));

function Cargando() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <span className="text-sm">Cargando la nave…</span>
      </div>
    </div>
  );
}

function BotonFlotante({
  titulo,
  activo,
  disabled,
  className,
  onClick,
  children,
}: {
  titulo: string;
  activo?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-10 w-10 bg-card/90 shadow-md backdrop-blur",
        activo && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
        className,
      )}
    >
      {children}
    </Button>
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

/** Lo que hay guardado en una zona: cada artículo con su cantidad allí. */
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
  const estaAqui = (a: Articulo) => a.existencias.some((e) => e.elementoId === zona.id);
  const aqui = articulos.filter(estaAqui).map((a) => ({
    a,
    cantidad: a.existencias.filter((e) => e.elementoId === zona.id).reduce((s, e) => s + e.cantidad, 0),
  }));
  const otros = articulos.filter((a) => !estaAqui(a));

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
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No hay nada apuntado en esta zona.
        </p>
      )}
      {aqui.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {aqui.map(({ a, cantidad }) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onAbrir(a, false)}
                className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-accent"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                  {a.fotos[0] ? (
                    <img src={urlFoto(a.fotos[0])} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.nombre}</span>
                  {a.categoria && <span className="block truncate text-xs text-muted-foreground">{a.categoria}</span>}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-semibold">{cantidad}</span> <span className="text-xs text-muted-foreground">{a.unidad}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PanelZona({ zona, onVolver, children }: { zona: Elemento; onVolver: () => void; children?: ReactNode }) {
  const sentido = textoSentido(zona);
  return (
    <aside
      key={zona.id}
      className={cn(
        "absolute z-20 overflow-y-auto rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur",
        "inset-x-3 bottom-3 max-h-[60dvh] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:max-h-[calc(100dvh-6rem)] sm:w-80",
        "animate-in fade-in slide-in-from-bottom-6 duration-700 sm:slide-in-from-bottom-0 sm:slide-in-from-right-6",
      )}
    >
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
      {children}
      <Button className="mt-4 w-full" variant="secondary" onClick={onVolver}>
        Volver a la nave
      </Button>
    </aside>
  );
}

/** Lista de zonas por categoría: la forma cómoda de llegar a una línea fina desde el móvil. */
function MenuZonas({
  elementos,
  activa,
  onElegir,
}: {
  elementos: Elemento[];
  activa?: string;
  onElegir: (e: Elemento) => void;
}) {
  const grupos = agruparPorCategoria(elementos);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 bg-card/90 px-3 shadow-md backdrop-blur" aria-label="Zonas">
          <ListTree className="h-4 w-4" />
          <span className="hidden sm:inline">Zonas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
        {grupos.length === 0 && <div className="px-2 py-3 text-sm text-muted-foreground">Aún no hay zonas.</div>}
        {grupos.map((g, i) => (
          <DropdownMenuGroup key={g.categoria}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
              {g.categoria || "Sin categoría"}
            </DropdownMenuLabel>
            {g.zonas.map((z) => (
              <DropdownMenuItem
                key={z.id}
                onSelect={() => onElegir(z)}
                className={cn("pl-7", z.id === activa && "bg-accent font-medium")}
              >
                {z.nombre}
                {z.muelle && <span className="ml-auto text-xs text-muted-foreground">{z.muelle}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Ayuda({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 w-[min(92vw,34rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start gap-3 rounded-xl border bg-card/95 p-3 text-sm shadow-lg backdrop-blur">
        <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          <span className="hidden sm:inline">Arrastra para moverte · clic derecho para girar · rueda para acercar.</span>
          <span className="sm:hidden">Un dedo para moverte · dos dedos para girar y acercar.</span>{" "}
          <span className="text-foreground">Toca una zona para entrar, o búscala en «Zonas».</span>
        </p>
        <button type="button" onClick={onCerrar} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Cerrar ayuda">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * El usuario está escribiendo en un campo o tiene abierta una ventana o un menú
 * (Esc ya los cierra): los atajos de teclado del mapa no deben saltar.
 */
const teclaAjena = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const escribiendo = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
  return escribiendo || !!t.closest?.("[role=dialog], [role=alertdialog], [role=menu], [role=listbox]");
};

const Nave = () => {
  const { zonaId } = useParams();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const mapa = useMapa();
  const editor = useEditor(mapa.elementos);
  const articulos = useArticulos();
  const [ficha, setFicha] = useState<{ articulo: Articulo; esNuevo: boolean } | null>(null);
  const [referencias, setReferencias] = useState(true);
  const [vistaKey, setVistaKey] = useState(0);
  const [ayuda, setAyuda] = useState(true);
  // Las flechas en movimiento gastan batería: de serie, apagadas en móvil
  const [flujos, setFlujos] = useState(() => !esGamaLigera());
  const [guardando, setGuardando] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const centroRef: RefCentro = useRef(null);

  const elementos = editor.activo ? editor.borrador : mapa.elementos;
  const zona = editor.activo ? undefined : mapa.elementos.find((e) => e.clave === zonaId);

  // Una dirección de zona que no existe vuelve a la vista general (cuando ya se ha cargado el mapa)
  useEffect(() => {
    if (zonaId && !zona && !mapa.cargando && !editor.activo) navigate("/", { replace: true });
  }, [zonaId, zona, mapa.cargando, editor.activo, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => setAyuda(false), 9000);
    return () => window.clearTimeout(t);
  }, []);

  const volver = useCallback(() => navigate("/"), [navigate]);
  const elegirZona = useCallback(
    (clave: string) => {
      setAyuda(false);
      navigate(`/zona/${clave}`);
    },
    [navigate],
  );

  const empezarEdicion = () => {
    setAyuda(false);
    if (zonaId) navigate("/");
    editor.entrar();
  };

  const terminarEdicion = () => {
    if (editor.pendientes > 0) setConfirmarSalida(true);
    else editor.salir();
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarMapa(mapa.elementos, editor.borrador);
      const nuevos = await mapa.recargar();
      if (nuevos) editor.restablecer(nuevos);
      toast.success("Mapa guardado");
    } catch (err) {
      toast.error("No se ha podido guardar el mapa", { description: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const anadir = (tipo: Elemento["tipo"], modelo: string | null) => {
    const [x, y] = centroRef.current?.() ?? [55, 10];
    editor.anadir(nuevoElemento(tipo, modelo, x, y));
  };

  // Atajos del modo edición: Supr borra, Ctrl+Z deshace, Esc quita la selección
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (teclaAjena(e)) return;
      if (editor.activo) {
        if ((e.key === "Delete" || e.key === "Backspace") && editor.seleccion) {
          e.preventDefault();
          editor.borrar(editor.seleccion);
        } else if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          editor.deshacer();
        } else if (e.key === "Escape") editor.seleccionar(null);
      } else if (e.key === "Escape" && zona) volver();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, zona, volver]);

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar
  useEffect(() => {
    if (!editor.pendientes) return;
    const onSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onSalir);
    return () => window.removeEventListener("beforeunload", onSalir);
  }, [editor.pendientes]);

  const edicion: EdicionEscena | null = useMemo(
    () =>
      editor.activo
        ? {
            seleccion: editor.seleccion,
            rejilla: editor.rejilla,
            onSeleccionar: editor.seleccionar,
            onEmpezarCambio: editor.registrar,
            onCambiarArea: editor.cambiarArea,
          }
        : null,
    [editor.activo, editor.seleccion, editor.rejilla, editor.seleccionar, editor.registrar, editor.cambiarArea],
  );

  const categorias = useMemo(() => [...new Set(elementos.map((e) => e.categoria).filter(Boolean))], [elementos]);
  const categoriasArticulos = useMemo(
    () => [...new Set((articulos.data ?? []).map((a) => a.categoria).filter(Boolean))].sort(),
    [articulos.data],
  );

  /** Abre la ficha de un artículo; con `ponerAqui` le añade una fila para esta zona. */
  const abrirArticulo = (a: Articulo, ponerAqui: boolean) => {
    if (!zona) return;
    setFicha({
      articulo: ponerAqui
        ? { ...a, existencias: [...a.existencias, { id: crypto.randomUUID(), elementoId: zona.id, cantidad: 0, nota: "" }] }
        : a,
      esNuevo: false,
    });
  };
  const oscuro = resolvedTheme === "dark";
  const seleccionado = editor.seleccionado;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <Suspense fallback={<Cargando />}>
        <EscenaNave
          elementos={elementos}
          zona={zona}
          oscuro={oscuro}
          referencias={referencias}
          flujos={flujos}
          vistaKey={vistaKey}
          onElegirZona={elegirZona}
          edicion={edicion}
          centroRef={centroRef}
        />
      </Suspense>

      {/* Cabecera y miga de pan */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto min-w-0 rounded-xl border bg-card/90 px-3 py-2 shadow-md backdrop-blur">
          <div className="text-base font-bold leading-tight">Verdnatura</div>
          <nav className="flex min-w-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground" aria-label="Ubicación">
            <button type="button" onClick={volver} className={cn("hover:text-foreground", !zona && "text-foreground")}>
              Nave Holland
            </button>
            {zona && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium text-foreground animate-in fade-in duration-500">{zona.nombre}</span>
              </>
            )}
            {editor.activo && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium text-primary">Editando</span>
              </>
            )}
          </nav>
        </div>

        <div className="pointer-events-auto flex shrink-0 gap-1.5 sm:gap-2">
          <BotonFlotante titulo="Artículos" onClick={() => navigate("/articulos")}>
            <Package className="h-4 w-4" />
          </BotonFlotante>
          <MenuZonas
            elementos={elementos}
            activa={editor.activo ? (editor.seleccion ?? undefined) : zona?.id}
            onElegir={(z) => (editor.activo ? editor.seleccionar(z.id) : elegirZona(z.clave))}
          />
          <BotonFlotante
            titulo={mapa.guardable ? "Editar mapa" : "No se puede editar: sin conexión con la base de datos"}
            activo={editor.activo}
            disabled={!mapa.guardable && !editor.activo}
            onClick={() => (editor.activo ? terminarEdicion() : empezarEdicion())}
          >
            <Pencil className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante
            titulo="Vista general"
            onClick={() => {
              if (zona) volver();
              else setVistaKey((k) => k + 1);
            }}
          >
            <Maximize className="h-4 w-4" />
          </BotonFlotante>
          {/* En el móvil no cabe y allí las flechas van quietas de serie (batería) */}
          <BotonFlotante
            titulo="Flechas de flujo en movimiento"
            activo={flujos}
            className="hidden sm:inline-flex"
            onClick={() => setFlujos((f) => !f)}
          >
            <Route className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante titulo="Referencias del plano (A–K, 1–4)" activo={referencias} onClick={() => setReferencias((r) => !r)}>
            <Grid3x3 className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante titulo="Cambiar tema" className="hidden sm:inline-flex" onClick={() => setTheme(oscuro ? "light" : "dark")}>
            {oscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </BotonFlotante>
        </div>
      </header>

      {mapa.error && (
        <div className="absolute left-1/2 top-20 z-20 w-[min(92vw,30rem)] -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          No se ha podido leer el mapa guardado: se ve el de serie y no se puede editar. ({mapa.error})
        </div>
      )}

      {zona && (
        <PanelZona zona={zona} onVolver={volver}>
          <QueHayAqui
            zona={zona}
            articulos={articulos.data ?? []}
            cargando={articulos.isLoading}
            onAbrir={abrirArticulo}
            onNuevo={() => setFicha({ articulo: articuloVacio(zona.id), esNuevo: true })}
          />
        </PanelZona>
      )}
      {ficha && (
        <FichaArticulo
          inicial={ficha.articulo}
          esNuevo={ficha.esNuevo}
          elementos={mapa.elementos}
          categorias={categoriasArticulos}
          onCerrar={() => setFicha(null)}
        />
      )}
      {ayuda && !zona && !editor.activo && <Ayuda onCerrar={() => setAyuda(false)} />}

      {editor.activo && seleccionado && (
        <PanelEdicion
          elemento={seleccionado}
          categorias={categorias}
          onCambiar={(cambios, conHistorial) => editor.cambiar(seleccionado.id, cambios, conHistorial)}
          onRegistrar={editor.registrar}
          onDuplicar={() => editor.anadir(duplicar(seleccionado))}
          onBorrar={() => editor.borrar(seleccionado.id)}
          onCerrar={() => editor.seleccionar(null)}
        />
      )}
      {editor.activo && (
        <BarraEdicion
          pendientes={editor.pendientes}
          puedeDeshacer={editor.puedeDeshacer}
          rejilla={editor.rejilla}
          guardando={guardando}
          onAnadir={anadir}
          onRejilla={() => editor.setRejilla((r) => !r)}
          onDeshacer={editor.deshacer}
          onDescartar={() => editor.restablecer(mapa.elementos)}
          onGuardar={guardar}
          onTerminar={terminarEdicion}
        />
      )}

      <AlertDialog open={confirmarSalida} onOpenChange={setConfirmarSalida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes {editor.pendientes} {editor.pendientes === 1 ? "cambio" : "cambios"} sin guardar en el mapa. Si sales, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                editor.restablecer(mapa.elementos);
                editor.salir();
              }}
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Nave;
