import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Camera, ImagePlus, Loader2, MapPin, MapPinned, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";
import type { Elemento } from "@/nave/elementos";
import { ListaHistorial } from "@/historial/ListaHistorial";
import { useHistorial } from "@/historial/useHistorial";
import { CARACTERISTICAS_SUGERIDAS, ESTADOS, UNIDADES, estadoStock, nuevaExistencia, total, urlFoto, type Articulo } from "./modelo";
import { ASPECTOS, esAspecto, type Aspecto } from "./aspectos";
import {
  CLAVE_ARTICULOS,
  ConflictoError,
  borrarArticulo,
  borrarFotos,
  guardarArticulo,
  leerArticulo,
  subirFoto,
} from "./useArticulos";

const SIN_UBICAR = "__sin__";
/** El desplegable no admite valores vacíos: «sin dibujo» va con esta marca. */
const SIN_DIBUJO = "__sin_dibujo__";

type Props = {
  /** Artículo a editar tal como está guardado, o uno vacío si es nuevo. */
  inicial: Articulo;
  esNuevo: boolean;
  /** Abre la ficha con una fila nueva para esta zona («poner aquí uno que ya existe»). */
  anadirEn?: string | null;
  /** Elementos del mapa, para elegir dónde está. */
  elementos: Elemento[];
  /** Categorías que ya existen, para sugerirlas. */
  categorias: string[];
  onCerrar: () => void;
  /** Lleva al mapa con las zonas donde está el artículo señaladas. */
  onVerEnMapa?: (a: Articulo) => void;
};

/** Últimos cambios del artículo, con enlace al historial completo. */
function UltimosCambios({ articuloId }: { articuloId: string }) {
  const historial = useHistorial({ articuloId }, 6);
  const cambios = historial.data?.pages.flat() ?? [];
  if (historial.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!cambios.length) return <p className="text-sm text-muted-foreground">Aún no hay cambios apuntados.</p>;
  return <ListaHistorial cambios={cambios} compacta />;
}

function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Ficha de un artículo: fotos, datos, dónde está y cuántos hay, y características. */
export function FichaArticulo({ inicial, esNuevo, anadirEn, elementos, categorias, onCerrar, onVerEnMapa }: Props) {
  const queryClient = useQueryClient();
  // Cómo estaba guardado al abrir: al guardar solo se manda lo que ha cambiado desde aquí
  const [base, setBase] = useState<Articulo>(inicial);
  const [a, setA] = useState<Articulo>(() =>
    anadirEn ? { ...inicial, existencias: [...inicial.existencias, nuevaExistencia(anadirEn)] } : inicial,
  );
  const [conflicto, setConflicto] = useState<string[] | null>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  // Fotos subidas en esta edición: si se cancela, se borran para no dejar basura
  const subidas = useRef<string[]>([]);
  const archivos = useRef<HTMLInputElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const idCategorias = useId();
  const idUnidades = useId();
  const idCaracteristicas = useId();

  const cambiar = (cambios: Partial<Articulo>) => setA((x) => ({ ...x, ...cambios }));

  const zonas = useMemo(
    () =>
      elementos
        .filter((e) => e.almacen)
        .sort((x, y) => x.categoria.localeCompare(y.categoria) || x.nombre.localeCompare(y.nombre, "es", { numeric: true })),
    [elementos],
  );
  const nombreZona = (id: string | null) => {
    const z = id && elementos.find((e) => e.id === id);
    return z ? z.nombre : "Sin ubicar";
  };

  /** Tras un conflicto: se descarta lo editado y se carga lo que hay ahora guardado. */
  const cargarLoUltimo = async () => {
    try {
      const fresco = await leerArticulo(a.id);
      void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      if (!fresco) {
        toast.error("Este artículo lo ha borrado otra persona");
        onCerrar();
        return;
      }
      setBase(fresco);
      setA(fresco);
      setConflicto(null);
    } catch (err) {
      toast.error("No se ha podido cargar", { description: (err as Error).message });
    }
  };

  const anadirFotos = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const ficheros = [...lista];
    setSubiendo((n) => n + ficheros.length);
    for (const f of ficheros) {
      try {
        const ruta = await subirFoto(a.id, f);
        subidas.current.push(ruta);
        setA((x) => ({ ...x, fotos: [...x.fotos, ruta] }));
      } catch (err) {
        toast.error(`No se ha podido subir ${f.name}`, { description: (err as Error).message });
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  };

  const cancelar = () => {
    // Fotos nuevas que no se van a guardar: fuera del almacén
    if (subidas.current.length) void borrarFotos(subidas.current);
    subidas.current = [];
    onCerrar();
  };

  const guardar = async () => {
    if (!a.nombre.trim()) {
      toast.error("Ponle un nombre al artículo");
      return;
    }
    setGuardando(true);
    try {
      await guardarArticulo(a, esNuevo ? null : base, nombreZona);
      subidas.current = [];
      await queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      toast.success(esNuevo ? "Artículo creado" : "Artículo guardado");
      onCerrar();
    } catch (err) {
      if (err instanceof ConflictoError) {
        setConflicto(err.detalles);
        // El aviso está arriba de la ficha y se suele guardar desde abajo
        contenido.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
      else toast.error("No se ha podido guardar", { description: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    try {
      await borrarArticulo(base);
      await queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      toast.success("Artículo borrado");
      onCerrar();
    } catch (err) {
      toast.error("No se ha podido borrar", { description: (err as Error).message });
    }
  };

  const zonasUsadas = new Set(a.existencias.map((e) => e.elementoId));
  const principal = a.fotos[0];
  const estado = estadoStock(a);
  const ubicado = base.existencias.some((e) => e.elementoId);

  return (
    <Sheet open onOpenChange={(abierto) => !abierto && cancelar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>{esNuevo ? "Nuevo artículo" : a.nombre || "Artículo"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {esNuevo ? (
              "Rellena lo que sepas; lo demás lo puedes completar después."
            ) : (
              <>
                <span>
                  {total(a)} {a.unidad} en total
                </span>
                {estado !== "ok" && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ESTADOS[estado].clase)}>{ESTADOS[estado].nombre}</span>
                )}
              </>
            )}
          </SheetDescription>
          {!esNuevo && ubicado && onVerEnMapa && (
            <Button variant="outline" size="sm" className="mt-2 w-fit gap-1.5" onClick={() => onVerEnMapa(base)}>
              <MapPinned className="h-4 w-4" /> Ver en el mapa
            </Button>
          )}
        </SheetHeader>

        <div ref={contenido} className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {conflicto && (
            <div role="alert" className="rounded-lg border border-aviso-borde bg-aviso-suave p-3 text-sm text-aviso-texto">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Otra persona ha cambiado esto mientras lo editabas. No se ha guardado nada.</p>
                  <ul className="list-disc pl-4">
                    {conflicto.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <Button size="sm" variant="outline" className="mt-1 bg-background" onClick={cargarLoUltimo}>
                    Cargar lo último y volver a empezar
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* Fotos */}
          <Seccion titulo="Fotos">
            <input
              ref={archivos}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void anadirFotos(e.target.files);
                e.target.value = "";
              }}
            />
            {principal ? (
              <div className="overflow-hidden rounded-lg border bg-white">
                <img src={urlFoto(principal)} alt={a.nombre} className="aspect-[4/3] w-full object-contain" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => archivos.current?.click()}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Haz o sube una foto</span>
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              {a.fotos.map((f, i) => (
                <div key={f} className={cn("group relative h-16 w-16 overflow-hidden rounded-md border bg-white", i === 0 && "ring-2 ring-primary")}>
                  <img src={urlFoto(f)} alt="" className="h-full w-full object-contain" />
                  <div className="absolute inset-0 flex items-start justify-between bg-black/0 p-0.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:bg-black/30 sm:group-hover:opacity-100">
                    {i > 0 ? (
                      <button
                        type="button"
                        title="Poner como principal"
                        aria-label="Poner como principal"
                        onClick={() => cambiar({ fotos: [f, ...a.fotos.filter((x) => x !== f)] })}
                        className="rounded bg-white/90 p-0.5 text-aviso"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      title="Quitar foto"
                      aria-label="Quitar foto"
                      onClick={() => cambiar({ fotos: a.fotos.filter((x) => x !== f) })}
                      className="rounded bg-white/90 p-0.5 text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {subiendo > 0 && (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => archivos.current?.click()}
                className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-[10px] text-muted-foreground hover:text-foreground"
              >
                <ImagePlus className="h-5 w-5" />
                Añadir
              </button>
            </div>
          </Seccion>

          {/* Datos */}
          <Seccion titulo="Datos">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nombre</Label>
                <Input value={a.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} placeholder="Ej: Film estirable 23 µ" autoFocus={esNuevo} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Categoría</Label>
                  <Input list={idCategorias} value={a.categoria} onChange={(e) => cambiar({ categoria: e.target.value })} placeholder="Ej: Film" />
                  <datalist id={idCategorias}>
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Se cuenta en</Label>
                  <Input list={idUnidades} value={a.unidad} onChange={(e) => cambiar({ unidad: e.target.value })} />
                  <datalist id={idUnidades}>
                    {UNIDADES.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <Textarea rows={2} value={a.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />
              </div>
              <div className="flex items-end gap-3">
                <div className="w-28 shrink-0 space-y-1">
                  <Label className="text-xs text-muted-foreground">Stock mínimo</Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="—"
                    value={a.stockMinimo ?? ""}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      cambiar({ stockMinimo: Number.isNaN(n) ? null : Math.max(0, n) });
                    }}
                    aria-label="Stock mínimo"
                  />
                </div>
                <p className="pb-2 text-xs text-muted-foreground">Opcional. Si el total baja de aquí, el artículo sale marcado como «Bajo mínimo».</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cómo se ve en el mapa</Label>
                <Select
                  value={a.aspecto ?? SIN_DIBUJO}
                  onValueChange={(v) => cambiar({ aspecto: esAspecto(v) ? v : null })}
                >
                  <SelectTrigger className="h-9" aria-label="Cómo se ve en el mapa">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_DIBUJO}>Solo la foto, sin dibujo</SelectItem>
                    {(Object.keys(ASPECTOS) as Aspecto[]).map((v) => (
                      <SelectItem key={v} value={v}>
                        {ASPECTOS[v].nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {a.aspecto ? ASPECTOS[a.aspecto].texto : "En el mapa solo sale su foto encima de la zona donde está."}
                </p>
              </div>
            </div>
          </Seccion>

          {/* Dónde está y cuántos hay */}
          <Seccion
            titulo={`Dónde está · ${total(a)} ${a.unidad}`}
            accion={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() =>
                  cambiar({
                    existencias: [
                      ...a.existencias,
                      { id: crypto.randomUUID(), elementoId: zonas.find((z) => !zonasUsadas.has(z.id))?.id ?? null, cantidad: 0, nota: "" },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Añadir ubicación
              </Button>
            }
          >
            {a.existencias.length === 0 && (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Todavía no está en ninguna zona. Añade una ubicación y cuántos hay.
              </p>
            )}
            {a.existencias.some((e) => !e.elementoId) && (
              <p className="rounded-lg bg-aviso-suave p-2.5 text-xs text-aviso-texto">
                Hay cantidades «Sin ubicar» (su zona se borró del mapa). Elige en qué zona están ahora.
              </p>
            )}
            {a.existencias.map((x) => (
              <div key={x.id} className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select
                  value={x.elementoId ?? SIN_UBICAR}
                  onValueChange={(v) =>
                    cambiar({
                      existencias: a.existencias.map((e) => (e.id === x.id ? { ...e, elementoId: v === SIN_UBICAR ? null : v } : e)),
                    })
                  }
                >
                  <SelectTrigger className="h-9 min-w-0 flex-1">
                    <SelectValue>{nombreZona(x.elementoId)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={SIN_UBICAR}>Sin ubicar</SelectItem>
                    {zonas.map((z) => (
                      <SelectItem key={z.id} value={z.id} disabled={z.id !== x.elementoId && zonasUsadas.has(z.id)}>
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: z.color }} />
                        {z.nombre}
                        <span className="ml-1 text-xs text-muted-foreground">· {z.categoria}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="h-9 w-24"
                  value={x.cantidad}
                  onChange={(e) =>
                    cambiar({
                      existencias: a.existencias.map((ex) =>
                        ex.id === x.id ? { ...ex, cantidad: Math.max(0, parseInt(e.target.value, 10) || 0) } : ex,
                      ),
                    })
                  }
                  aria-label="Cantidad"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Quitar ubicación"
                  onClick={() => cambiar({ existencias: a.existencias.filter((e) => e.id !== x.id) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Seccion>

          {/* Características libres */}
          <Seccion
            titulo="Características"
            accion={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => cambiar({ caracteristicas: [...a.caracteristicas, { nombre: "", valor: "" }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Añadir característica
              </Button>
            }
          >
            {a.caracteristicas.length === 0 && (
              <p className="text-sm text-muted-foreground">Medidas, material, proveedor, código… lo que quieras apuntar.</p>
            )}
            <datalist id={idCaracteristicas}>
              {CARACTERISTICAS_SUGERIDAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {a.caracteristicas.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  list={idCaracteristicas}
                  className="h-9 w-2/5"
                  placeholder="Nombre"
                  value={c.nombre}
                  onChange={(e) =>
                    cambiar({ caracteristicas: a.caracteristicas.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) })
                  }
                />
                <Input
                  className="h-9 flex-1"
                  placeholder="Valor"
                  value={c.valor}
                  onChange={(e) =>
                    cambiar({ caracteristicas: a.caracteristicas.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Quitar característica"
                  onClick={() => cambiar({ caracteristicas: a.caracteristicas.filter((_, j) => j !== i) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Seccion>

          {!esNuevo && (
            <Seccion
              titulo="Últimos cambios"
              accion={
                <Link to={`/historial?articulo=${a.id}`} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Ver todo
                </Link>
              }
            >
              <UltimosCambios articuloId={a.id} />
            </Seccion>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-5 py-3">
          {!esNuevo && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmarBorrado(true)}>
              <Trash2 className="h-4 w-4" /> Borrar
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={cancelar} disabled={guardando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={guardar} disabled={guardando || subiendo > 0}>
            {guardando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>

        <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar «{base.nombre}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borran el artículo, sus fotos y lo que hay apuntado en cada zona. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={borrar}>
                Borrar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
