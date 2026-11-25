import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLAVE_ARTICULOS, moverBalda } from "@/articulos/useArticulos";
import type { Articulo } from "@/articulos/modelo";
import { BALDAS_ARMARIO, cajasPorBalda, type CajaFrontal } from "./armario";
import type { Elemento } from "./elementos";

const nombreBalda = (balda: number) => (balda === BALDAS_ARMARIO ? "Arriba" : balda === 1 ? "Abajo" : `Balda ${balda}`);

/**
 * El armario visto de frente, como en la nave: cajas de cartón con su etiqueta
 * amarilla en cada balda. Se toca una caja y se sube o se baja de balda.
 */
export function ArmarioFrontal({ zona, articulos }: { zona: Elemento; articulos: Articulo[] }) {
  const queryClient = useQueryClient();
  const [elegida, setElegida] = useState<string | null>(null);
  const baldas = cajasPorBalda(articulos, zona.id);
  const seleccion = baldas.flatMap((b) => b.cajas).find((c) => c.e.id === elegida) ?? null;

  const ponerBalda = (existenciaId: string, balda: number) =>
    queryClient.setQueryData<Articulo[]>(CLAVE_ARTICULOS, (lista) =>
      lista?.map((x) => ({ ...x, existencias: x.existencias.map((e) => (e.id === existenciaId ? { ...e, balda } : e)) })),
    );

  const mover = async (c: CajaFrontal, destino: number) => {
    if (destino < 1 || destino > BALDAS_ARMARIO) return;
    const antes = c.e.balda;
    ponerBalda(c.e.id, destino);
    try {
      const guardada = await moverBalda(c.e.id, antes, destino);
      if (guardada == null) {
        toast.warning(`Alguien acaba de mover ${c.a.nombre}`, { description: "Ya ves dónde está ahora." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      }
    } catch (err) {
      toast.error(`No se ha podido mover ${c.a.nombre}`, { description: (err as Error).message });
      void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
    }
  };

  return (
    <section className="mt-4">
      <h3 className="mb-2 text-sm font-semibold">El armario</h3>
      <div className="rounded-lg border-4 border-[#cfccc4] bg-[#efeee9] p-1.5 dark:border-[#5b5953] dark:bg-[#2b2a27]">
        {baldas.map(({ balda, cajas }) => (
          <div key={balda} className="border-b-4 border-[#dcdad3] px-1 pb-1 pt-2 last:border-b-0 dark:border-[#45433e]">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{nombreBalda(balda)}</p>
            <div className="flex min-h-[3.75rem] flex-wrap items-end gap-1.5">
              {cajas.length === 0 && <span className="self-center text-xs text-muted-foreground">Vacía</span>}
              {cajas.map((c) => (
                <button
                  key={c.e.id}
                  type="button"
                  onClick={() => setElegida(elegida === c.e.id ? null : c.e.id)}
                  aria-pressed={elegida === c.e.id}
                  title={c.a.nombre}
                  className={cn(
                    "relative flex h-14 w-[5.5rem] items-center justify-center rounded-sm bg-[#c4a27a] px-1 shadow-sm transition",
                    "outline-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ring",
                    elegida === c.e.id && "ring-2 ring-marca-lima ring-offset-2 ring-offset-[#efeee9] dark:ring-offset-[#2b2a27]",
                  )}
                >
                  <span className="line-clamp-2 w-full rounded-[2px] bg-[#f4e04d] px-1 py-0.5 text-center text-[10px] font-semibold leading-tight text-[#1a1a1a]">
                    {c.a.nombre}
                  </span>
                  {c.e.cantidad > 1 && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                      ×{c.e.cantidad}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {seleccion ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-medium">{seleccion.a.nombre}</span>
            <span className="text-muted-foreground"> · {nombreBalda(seleccion.balda).toLowerCase()}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            disabled={seleccion.balda >= BALDAS_ARMARIO}
            onClick={() => void mover(seleccion, seleccion.balda + 1)}
          >
            <ArrowUp className="h-3.5 w-3.5" /> Subir
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" disabled={seleccion.balda <= 1} onClick={() => void mover(seleccion, seleccion.balda - 1)}>
            <ArrowDown className="h-3.5 w-3.5" /> Bajar
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Toca una caja para subirla o bajarla de balda.</p>
      )}
    </section>
  );
}
