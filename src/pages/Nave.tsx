import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ChevronRight, Grid3x3, ListTree, Maximize, MousePointerClick, Package, Pencil, Route, Search, X } from "lucide-react";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MenuGeneral } from "@/components/MenuGeneral";
import { Logo } from "@/components/Logo";
import { esGamaLigera } from "@/nave/dispositivo";
import { agruparPorCategoria, duplicar, nuevoElemento, type Elemento } from "@/nave/elementos";
import type { Rect } from "@/nave/plano";
import { diferencias, guardarMapa, useMapa } from "@/nave/useMapa";
import { useEditor } from "@/nave/useEditor";
import { PanelEdicion } from "@/nave/PanelEdicion";
import { BarraEdicion } from "@/nave/BarraEdicion";
import { PanelArticulo, PanelZona } from "@/nave/Paneles";
import type { EdicionEscena, Encuadre, RefCentro } from "@/nave/EscenaNave";
import { useArticulos } from "@/articulos/useArticulos";
import { articuloVacio, cantidadEn, type Articulo } from "@/articulos/modelo";
import { FichaArticulo } from "@/articulos/FichaArticulo";
import { Buscador, type AccionBuscador } from "@/buscador/Buscador";
import { DialogoExportar } from "@/exportar/DialogoExportar";

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
        "h-9 w-9 sm:h-10 sm:w-10",
        activo && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
        className,
      )}
    >
      {children}
    </Button>
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
        <Button variant="outline" className="h-9 w-9 gap-2 px-0 sm:h-10 sm:w-10 lg:w-auto lg:px-4" aria-label="Zonas" title="Zonas">
          <ListTree className="h-4 w-4" />
          <span className="hidden lg:inline">Zonas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
        {grupos.length === 0 && <div className="px-2 py-3 text-sm text-muted-foreground">Aún no hay zonas donde guardar artículos.</div>}
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
          <span className="text-foreground">Toca una zona para entrar, o usa la lupa para buscar un artículo.</span>
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

/** Rectángulo que contiene a todos. */
const unir = (areas: Rect[]): Rect => ({
  x0: Math.min(...areas.map((r) => r.x0)),
  y0: Math.min(...areas.map((r) => r.y0)),
  x1: Math.max(...areas.map((r) => r.x1)),
  y1: Math.max(...areas.map((r) => r.y1)),
});

type Ficha = { articulo: Articulo; esNuevo: boolean; anadirEn?: string };
type BorradoZona = { elemento: Elemento; articulos: { a: Articulo; cantidad: number }[] };

const Nave = () => {
  const { zonaId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const mapa = useMapa();
  const editor = useEditor(mapa.elementos);
  const articulos = useArticulos();
  const listaArticulos = useMemo(() => articulos.data ?? [], [articulos.data]);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [borradoZona, setBorradoZona] = useState<BorradoZona | null>(null);
  const [referencias, setReferencias] = useState(true);
  const [vistaKey, setVistaKey] = useState(0);
  const [ayuda, setAyuda] = useState(true);
  // Las flechas en movimiento gastan batería: de serie, apagadas en móvil
  const [flujos, setFlujos] = useState(() => !esGamaLigera());
  const [guardando, setGuardando] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const centroRef: RefCentro = useRef(null);

  const elementos = editor.activo ? editor.borrador : mapa.elementos;
  const zona = editor.activo ? undefined : mapa.elementos.find((e) => e.clave === zonaId && e.almacen);

  // Artículo buscado (/?articulo=...): sus zonas se señalan en el mapa con la cantidad
  const articuloFoco = !zonaId && !editor.activo ? listaArticulos.find((a) => a.id === params.get("articulo")) : undefined;
  const foco = useMemo(() => {
    if (!articuloFoco) return null;
    const zonas = mapa.elementos.filter((e) => articuloFoco.existencias.some((x) => x.elementoId === e.id));
    const encuadre: Encuadre | undefined = zonas.length
      ? { id: `articulo:${articuloFoco.id}`, area: unir(zonas.map((z) => z.area)) }
      : undefined;
    return {
      encuadre,
      resaltadas: new Set(zonas.map((z) => z.id)),
      marcas: new Map(zonas.map((z) => [z.id, String(cantidadEn(articuloFoco, z.id))])),
    };
  }, [articuloFoco, mapa.elementos]);

  // Una dirección de zona (o de artículo) que no existe vuelve a la vista general
  useEffect(() => {
    if (zonaId && !zona && !mapa.cargando && !editor.activo) navigate("/", { replace: true });
  }, [zonaId, zona, mapa.cargando, editor.activo, navigate]);
  useEffect(() => {
    if (params.get("articulo") && !articuloFoco && articulos.isSuccess && !zonaId && !editor.activo) navigate("/", { replace: true });
  }, [params, articuloFoco, articulos.isSuccess, zonaId, editor.activo, navigate]);

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
  const verArticulo = useCallback(
    (a: Articulo) => {
      setAyuda(false);
      setFicha(null);
      navigate(`/?articulo=${a.id}`);
    },
    [navigate],
  );

  const accionBuscador = (accion: AccionBuscador) => {
    if (accion === "catalogo") navigate("/articulos");
    else if (accion === "nuevo") navigate("/articulos/nuevo");
    else if (accion === "historial") navigate("/historial");
    else setExportando(true);
  };

  const empezarEdicion = () => {
    setAyuda(false);
    if (zonaId || articuloFoco) navigate("/");
    editor.entrar();
  };

  const terminarEdicion = () => {
    if (editor.pendientes > 0) setConfirmarSalida(true);
    else editor.salir();
  };

  /** Antes de borrar una zona con artículos, se avisa de que se quedarán sin ubicar. */
  const pedirBorrado = useCallback(
    (id: string) => {
      const elemento = editor.borrador.find((e) => e.id === id);
      if (!elemento) return;
      const aqui = listaArticulos
        .filter((a) => a.existencias.some((e) => e.elementoId === id))
        .map((a) => ({ a, cantidad: cantidadEn(a, id) }));
      if (aqui.length) setBorradoZona({ elemento, articulos: aqui });
      else editor.borrar(id);
    },
    [editor, listaArticulos],
  );

  const guardar = async () => {
    setGuardando(true);
    try {
      const { borrados } = diferencias(editor.base, editor.borrador);
      const quedanSinUbicar = listaArticulos.filter((a) => a.existencias.some((e) => e.elementoId && borrados.includes(e.elementoId)));
      await guardarMapa(editor.base, editor.borrador);
      const nuevos = await mapa.recargar();
      if (nuevos) editor.restablecer(nuevos);
      if (quedanSinUbicar.length) {
        void articulos.refetch();
        toast.success("Mapa guardado", {
          description: `${quedanSinUbicar.length === 1 ? "1 artículo ha quedado" : `${quedanSinUbicar.length} artículos han quedado`} sin ubicar.`,
          action: { label: "Verlos", onClick: () => navigate("/articulos?ver=sin-ubicar") },
          duration: 10_000,
        });
      } else toast.success("Mapa guardado");
    } catch (err) {
      toast.error("No se ha podido guardar el mapa", { description: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  // Si otra persona guarda el mapa mientras se edita, se avisa (al guardar no se pisa lo suyo)
  const avisadoRef = useRef("");
  useEffect(() => {
    if (!editor.activo || guardando || !mapa.guardable) return;
    const firma = JSON.stringify(mapa.elementos);
    if (firma === JSON.stringify(editor.base) || firma === avisadoRef.current) return;
    avisadoRef.current = firma;
    toast.info("Otra persona ha cambiado el mapa mientras editabas", {
      description: "Al guardar se mantiene lo suyo; solo se cambia lo que tú has tocado.",
      duration: 8000,
    });
    // Solo interesa cuando llega un mapa nuevo de la base de datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa.elementos]);

  const anadir = (tipo: Elemento["tipo"], modelo: string | null) => {
    const [x, y] = centroRef.current?.() ?? [55, 10];
    editor.anadir(nuevoElemento(tipo, modelo, x, y));
  };

  // Atajos: Ctrl+K o / buscan; en edición Supr borra, Ctrl+Z deshace y Esc quita la selección
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (teclaAjena(e)) return;
      if (!editor.activo && ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || e.key === "/")) {
        e.preventDefault();
        setBuscando(true);
      } else if (editor.activo) {
        if ((e.key === "Delete" || e.key === "Backspace") && editor.seleccion) {
          e.preventDefault();
          pedirBorrado(editor.seleccion);
        } else if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          editor.deshacer();
        } else if (e.key === "Escape") editor.seleccionar(null);
      } else if (e.key === "Escape" && (zona || articuloFoco)) volver();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, zona, articuloFoco, volver, pedirBorrado]);

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
    () => [...new Set(listaArticulos.map((a) => a.categoria).filter(Boolean))].sort(),
    [listaArticulos],
  );
  const oscuro = resolvedTheme === "dark";
  const seleccionado = editor.seleccionado;
  const vistaGeneral = () => {
    if (zona || articuloFoco) volver();
    else setVistaKey((k) => k + 1);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <Suspense fallback={<Cargando />}>
        <EscenaNave
          elementos={elementos}
          zona={zona ?? foco?.encuadre}
          resaltadas={foco?.resaltadas}
          marcas={foco?.marcas}
          oscuro={oscuro}
          referencias={referencias}
          flujos={flujos}
          vistaKey={vistaKey}
          onElegirZona={elegirZona}
          edicion={edicion}
          centroRef={centroRef}
        />
      </Suspense>

      {/* Cabecera: barra blanca con el logo y la miga de pan, como la de verdnatura.es */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-3 py-2 shadow-sm backdrop-blur sm:gap-4 sm:px-5 sm:py-2.5">
        <div className="min-w-0">
          <button type="button" onClick={volver} aria-label="Vista general de la nave" className="block">
            <Logo className="h-5 sm:h-6" />
          </button>
          <nav className="mt-1 flex min-w-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground" aria-label="Ubicación">
            <button type="button" onClick={volver} className={cn("hover:text-foreground", !zona && !articuloFoco && "text-foreground")}>
              Nave Holland
            </button>
            {(zona || articuloFoco) && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium text-foreground animate-in fade-in duration-500">{zona?.nombre ?? articuloFoco?.nombre}</span>
              </>
            )}
            {editor.activo && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium text-marca-lima-oscuro">Editando</span>
              </>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 gap-1 sm:gap-2">
          {!editor.activo && (
            <Button
              variant="outline"
              onClick={() => setBuscando(true)}
              aria-label="Buscar"
              title="Buscar (Ctrl+K)"
              className="h-9 w-9 gap-2 px-0 sm:h-10 sm:w-10 lg:w-auto lg:px-4"
            >
              <Search className="h-4 w-4" />
              <span className="hidden text-muted-foreground lg:inline">Buscar…</span>
              <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] text-muted-foreground lg:inline">Ctrl K</kbd>
            </Button>
          )}
          <BotonFlotante titulo="Artículos" onClick={() => navigate("/articulos")}>
            <Package className="h-4 w-4" />
          </BotonFlotante>
          <MenuZonas
            // Fuera de edición solo las zonas donde se guardan artículos; editando, todas
            elementos={editor.activo ? elementos : elementos.filter((e) => e.almacen)}
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
          {/* En el móvil no caben: van dentro del menú */}
          <BotonFlotante titulo="Vista general" className="hidden sm:inline-flex" onClick={vistaGeneral}>
            <Maximize className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante
            titulo="Flechas de flujo en movimiento"
            activo={flujos}
            className="hidden sm:inline-flex"
            onClick={() => setFlujos((f) => !f)}
          >
            <Route className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante
            titulo="Referencias del plano (A–K, 1–4)"
            activo={referencias}
            className="hidden sm:inline-flex"
            onClick={() => setReferencias((r) => !r)}
          >
            <Grid3x3 className="h-4 w-4" />
          </BotonFlotante>
          <MenuGeneral className="h-9 w-9 sm:h-10 sm:w-10">
            <div className="sm:hidden">
              <DropdownMenuItem onSelect={vistaGeneral} className="gap-2">
                <Maximize className="h-4 w-4" /> Vista general
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem checked={flujos} onCheckedChange={(v) => setFlujos(v === true)}>
                Flechas en movimiento
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={referencias} onCheckedChange={(v) => setReferencias(v === true)}>
                Referencias del plano (A–K, 1–4)
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </div>
          </MenuGeneral>
        </div>
      </header>

      {mapa.error && (
        <div className="absolute left-1/2 top-20 z-20 w-[min(92vw,30rem)] -translate-x-1/2 rounded-lg border border-aviso-borde bg-aviso-suave px-3 py-2 text-xs text-aviso-texto shadow">
          No se ha podido leer el mapa guardado: se ve el de serie y no se puede editar. ({mapa.error})
        </div>
      )}

      {zona && (
        <PanelZona
          zona={zona}
          articulos={listaArticulos}
          cargando={articulos.isLoading}
          onVolver={volver}
          onAbrir={(a, ponerAqui) => setFicha({ articulo: a, esNuevo: false, anadirEn: ponerAqui ? zona.id : undefined })}
          onNuevo={() => setFicha({ articulo: articuloVacio(zona.id), esNuevo: true })}
        />
      )}
      {articuloFoco && (
        <PanelArticulo
          articulo={articuloFoco}
          elementos={mapa.elementos}
          onZona={(z) => elegirZona(z.clave)}
          onAbrirFicha={() => setFicha({ articulo: articuloFoco, esNuevo: false })}
          onCerrar={volver}
        />
      )}
      {ayuda && !zona && !articuloFoco && !editor.activo && <Ayuda onCerrar={() => setAyuda(false)} />}

      {ficha && (
        <FichaArticulo
          key={ficha.articulo.id}
          inicial={ficha.articulo}
          esNuevo={ficha.esNuevo}
          anadirEn={ficha.anadirEn}
          elementos={mapa.elementos}
          categorias={categoriasArticulos}
          onCerrar={() => setFicha(null)}
          onVerEnMapa={verArticulo}
        />
      )}

      <Buscador
        abierto={buscando}
        onCerrar={() => setBuscando(false)}
        articulos={listaArticulos}
        elementos={mapa.elementos}
        onArticulo={verArticulo}
        onZona={(z) => elegirZona(z.clave)}
        onAccion={accionBuscador}
      />
      <DialogoExportar abierto={exportando} onCerrar={() => setExportando(false)} />

      {editor.activo && seleccionado && (
        <PanelEdicion
          elemento={seleccionado}
          categorias={categorias}
          onCambiar={(cambios, conHistorial) => editor.cambiar(seleccionado.id, cambios, conHistorial)}
          onRegistrar={editor.registrar}
          onDuplicar={() => editor.anadir(duplicar(seleccionado))}
          onBorrar={() => pedirBorrado(seleccionado.id)}
          onCerrar={() => editor.seleccionar(null)}
          articulosAqui={listaArticulos.filter((a) => a.existencias.some((x) => x.elementoId === seleccionado.id)).length}
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

      <AlertDialog open={!!borradoZona} onOpenChange={(abrir) => !abrir && setBorradoZona(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{borradoZona?.elemento.nombre}»?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  En {borradoZona?.elemento.tipo === "puesto" ? "este objeto" : "esta zona"} hay{" "}
                  {borradoZona?.articulos.length === 1 ? "1 artículo apuntado" : `${borradoZona?.articulos.length} artículos apuntados`}:
                </p>
                <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border text-foreground">
                  {borradoZona?.articulos.map(({ a, cantidad }) => (
                    <li key={a.id} className="flex justify-between gap-3 px-3 py-1.5">
                      <span className="truncate">{a.nombre}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {cantidad} <span className="text-xs font-normal text-muted-foreground">{a.unidad}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  Si la borras y guardas el mapa, esas cantidades no se pierden: quedan como <strong>«Sin ubicar»</strong> en el catálogo
                  para que las coloques en otra zona.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No borrar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (borradoZona) editor.borrar(borradoZona.elemento.id);
                setBorradoZona(null);
              }}
            >
              Borrar igualmente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
