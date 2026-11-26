import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { urlFoto, type Articulo, type Existencia } from "@/articulos/modelo";
import { CLAVE_ARTICULOS, ajustarExistencia, fijarExistencia } from "@/articulos/useArticulos";

export function Miniatura({ a, grande = false }: { a: Articulo; grande?: boolean }) {
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

const ESPERA_ENVIO = 800;

/**
 * Cantidad de un artículo en una zona, con botones + / −. Los toques seguidos se
 * juntan y se mandan como una sola suma o resta (una sola línea en el historial);
 * la suma la hace la base de datos, así que dos personas contando a la vez no se
 * pisan. Tocando el número se escribe la cantidad exacta.
 */
export function ContadorCantidad({ a, existencia, grande = false }: { a: Articulo; existencia: Existencia; grande?: boolean }) {
  const queryClient = useQueryClient();
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
    if (!delta) return;
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

  // Al cerrar con toques sin mandar, se mandan ya
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  useEffect(() => () => void enviarRef.current(), []);

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

  const boton = grande ? "h-11 w-11" : "h-9 w-9";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className={cn(boton, "rounded-full")}
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
            if (e.key === "Escape") {
              e.stopPropagation();
              setEscribiendo(null);
            }
          }}
          className={cn("rounded-md border bg-background text-center font-semibold tabular-nums", grande ? "h-11 w-16 text-lg" : "h-9 w-14 text-base")}
          aria-label={`Cantidad de ${a.nombre}`}
        />
      ) : (
        <button
          type="button"
          onClick={async () => {
            await enviar();
            setEscribiendo(String(existencia.cantidad + pendienteRef.current));
          }}
          className={cn(
            "flex flex-col items-center rounded-md py-0.5 leading-tight hover:bg-accent",
            grande ? "w-16" : "w-14",
            pendiente !== 0 && "text-marca-lima-oscuro",
          )}
          title="Escribir la cantidad"
        >
          <span className={cn("font-semibold tabular-nums", grande ? "text-xl" : "text-base")}>{cantidad}</span>
          <span className="max-w-full truncate text-[10px] text-muted-foreground">{a.unidad}</span>
        </button>
      )}
      <Button variant="outline" size="icon" className={cn(boton, "rounded-full")} aria-label={`Añadir uno de ${a.nombre}`} onClick={() => sumar(1)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
