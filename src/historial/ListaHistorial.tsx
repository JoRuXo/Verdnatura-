import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRightLeft, Map as IconoMapa, Package, PackageMinus, PackagePlus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { describir, nombreAutor, type Cambio } from "./modelo";

const dia = (fecha: Date) =>
  isToday(fecha) ? "Hoy" : isYesterday(fecha) ? "Ayer" : format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es });

function Icono({ c }: { c: Cambio }) {
  const clase = "h-4 w-4";
  if (c.tipo === "mapa") return <IconoMapa className={clase} />;
  if (c.tipo === "articulo") return c.accion === "cambio" ? <Pencil className={clase} /> : <Package className={clase} />;
  if (c.accion === "traslado") return <ArrowRightLeft className={clase} />;
  if (c.accion === "baja" || (c.antes ?? 0) > (c.despues ?? 0)) return <PackageMinus className={clase} />;
  return <PackagePlus className={clase} />;
}

function Diferencia({ n }: { n: number | null }) {
  if (n == null || n === 0) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        n > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      )}
    >
      {n > 0 ? `+${n}` : `−${-n}`}
    </span>
  );
}

/** Lista de cambios agrupada por días, del más reciente al más antiguo. */
export function ListaHistorial({ cambios, compacta = false }: { cambios: Cambio[]; compacta?: boolean }) {
  const grupos: { dia: string; cambios: Cambio[] }[] = [];
  for (const c of cambios) {
    const d = dia(c.fecha);
    if (grupos.at(-1)?.dia !== d) grupos.push({ dia: d, cambios: [] });
    grupos[grupos.length - 1].cambios.push(c);
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.dia}>
          <h3 className={cn("mb-1.5 font-semibold capitalize text-muted-foreground", compacta ? "text-xs" : "text-sm")}>{g.dia}</h3>
          <ol className="divide-y rounded-lg border bg-card">
            {g.cambios.map((c) => {
              const { texto, detalle, diferencia } = describir(c);
              return (
                <li key={c.id} className={cn("flex items-start gap-3", compacta ? "px-2.5 py-2" : "px-3 py-2.5")}>
                  <span
                    className={cn(
                      "mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
                      compacta ? "h-6 w-6" : "h-8 w-8",
                    )}
                  >
                    <Icono c={c} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className={cn("min-w-0 flex-1 font-medium", compacta ? "text-xs" : "text-sm")}>{texto}</p>
                      <Diferencia n={diferencia} />
                    </div>
                    {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{nombreAutor(c.autor)}</span> · {format(c.fecha, "HH:mm")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
