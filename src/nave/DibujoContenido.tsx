import { Html } from "@react-three/drei";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Instancias } from "./piezas";
import type { Pieza } from "./contenido";

/** Un artículo guardado en una zona, con lo que hace falta para dibujarlo y enseñarlo. */
export type ArticuloEnZona = {
  id: string;
  nombre: string;
  /** URL pública de la foto principal (sin fondo, si se ha subido así). */
  foto: string | null;
  cantidad: number;
  unidad: string;
};

/** Lo que hay guardado en una zona, dibujado con sus piezas. */
export function ContenidoElemento({ piezas, opacidad }: { piezas: Pieza[]; opacidad: number }) {
  return (
    <group>
      {piezas.map((p, i) => (
        <Instancias
          key={`${i}-${p.color}-${p.cajas.length}`}
          cajas={p.cajas}
          color={p.color}
          opacidad={(p.opacidad ?? 1) * opacidad}
          sombras={(p.opacidad ?? 1) >= 1}
        />
      ))}
    </group>
  );
}

/** Fotos que caben en un bocadillo: menos en el móvil, para que no se pisen. */
const VISIBLES = 3;
const VISIBLES_MOVIL = 2;

/**
 * Bocadillo sobre una zona con la foto de lo que hay guardado y cuánto: se ve de
 * un vistazo dónde está cada cosa. Al tocarlo se entra en la zona.
 */
export function Bocadillo({
  posicion,
  nombre,
  articulos,
  onAbrir,
}: {
  posicion: [number, number, number];
  /** Nombre de la zona encima de las fotos (null para no ponerlo). */
  nombre: string | null;
  articulos: ArticuloEnZona[];
  onAbrir: () => void;
}) {
  const visibles = articulos.slice(0, VISIBLES);
  const resto = articulos.length - visibles.length;
  const restoMovil = articulos.length - Math.min(articulos.length, VISIBLES_MOVIL);
  return (
    <Html position={posicion} zIndexRange={[7, 6]} style={{ pointerEvents: "none" }}>
      <button
        type="button"
        onClick={onAbrir}
        title={`${nombre ?? "Zona"}: ${articulos.map((a) => `${a.cantidad} ${a.unidad} de ${a.nombre}`).join(", ")}`}
        className="pointer-events-auto -translate-x-1/2 -translate-y-full pb-2 text-left animate-in fade-in zoom-in-90 duration-300 focus-visible:outline-none"
      >
        <span className="relative block rounded-2xl border border-black/5 bg-card px-1.5 pb-1.5 pt-1 shadow-[0_8px_20px_-8px_rgba(26,26,26,0.45)] ring-primary transition-transform hover:-translate-y-0.5 focus-visible:ring-2 dark:border-white/10">
          {nombre && (
            <span className="block max-w-[11rem] truncate px-1 pb-0.5 text-[10px] font-semibold text-muted-foreground">{nombre}</span>
          )}
          <span className="flex items-end gap-1">
            {visibles.map((a, i) => (
              <span key={a.id} className={cn("w-10 flex-col items-center sm:flex sm:w-12", i < VISIBLES_MOVIL ? "flex" : "hidden")}>
                <span className="flex h-10 w-10 items-center justify-center sm:h-12 sm:w-12">
                  {a.foto ? (
                    <img src={a.foto} alt={a.nombre} loading="lazy" draggable={false} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </span>
                <span className="text-xs font-bold leading-tight tabular-nums text-foreground">{a.cantidad}</span>
              </span>
            ))}
            {restoMovil > 0 && (
              <span className="self-center px-1 text-xs font-semibold text-muted-foreground sm:hidden">+{restoMovil}</span>
            )}
            {resto > 0 && (
              <span className="hidden self-center px-1 text-xs font-semibold text-muted-foreground sm:inline">+{resto}</span>
            )}
          </span>
          {/* Pico que apunta a la zona */}
          <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[8px] border-x-transparent border-t-card" />
        </span>
      </button>
    </Html>
  );
}
