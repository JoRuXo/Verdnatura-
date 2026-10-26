import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, MapPin, Plus, Star, Trash2, X } from "lucide-react";
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
import { CARACTERISTICAS_SUGERIDAS, UNIDADES, total, urlFoto, type Articulo } from "./modelo";
import { CLAVE_ARTICULOS, borrarArticulo, borrarFotos, guardarArticulo, subirFoto } from "./useArticulos";

const SIN_UBICAR = "__sin__";

type Props = {
  /** Artículo a editar, o uno vacío si es nuevo. */
  inicial: Articulo;
  esNuevo: boolean;
  /** Elementos del mapa, para elegir dónde está. */
  elementos: Elemento[];
  /** Categorías que ya existen, para sugerirlas. */
  categorias: string[];
  onCerrar: () => void;
};

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
export function FichaArticulo({ inicial, esNuevo, elementos, categorias, onCerrar }: Props) {
  const queryClient = useQueryClient();
  const [a, setA] = useState<Articulo>(inicial);
  const [subiendo, setSubiendo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  // Fotos subidas en esta edición: si se cancela, se borran para no dejar basura
  const subidas = useRef<string[]>([]);
  const archivos = useRef<HTMLInputElement>(null);
  const idCategorias = useId();
  const idUnidades = useId();
  const idCaracteristicas = useId();

  useEffect(() => setA(inicial), [inicial]);

  const cambiar = (cambios: Partial<Articulo>) => setA((x) => ({ ...x, ...cambios }));

  const zonas = useMemo(
    () => [...elementos].sort((x, y) => x.categoria.localeCompare(y.categoria) || x.nombre.localeCompare(y.nombre, "es", { numeric: true })),
    [elementos],
  );
  const nombreZona = (id: string | null) => {
    const z = id && elementos.find((e) => e.id === id);
    return z ? z.nombre : "Sin ubicar";
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
      await guardarArticulo(a, esNuevo ? null : inicial);
      subidas.current = [];
      await queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      toast.success(esNuevo ? "Artículo creado" : "Artículo guardado");
      onCerrar();
    } catch (err) {
      toast.error("No se ha podido guardar", { description: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    try {
      await borrarArticulo(inicial);
      await queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      toast.success("Artículo borrado");
      onCerrar();
    } catch (err) {
      toast.error("No se ha podido borrar", { description: (err as Error).message });
    }
  };

  const zonasUsadas = new Set(a.existencias.map((e) => e.elementoId));
  const principal = a.fotos[0];

  return (
    <Sheet open onOpenChange={(abierto) => !abierto && cancelar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>{esNuevo ? "Nuevo artículo" : a.nombre || "Artículo"}</SheetTitle>
          <SheetDescription>
            {esNuevo ? "Rellena lo que sepas; lo demás lo puedes completar después." : `${total(a)} ${a.unidad} en total`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
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
                        className="rounded bg-white/90 p-0.5 text-amber-500"
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
              <AlertDialogTitle>¿Borrar «{inicial.nombre}»?</AlertDialogTitle>
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
