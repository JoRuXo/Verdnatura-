import { Check, Loader2, Magnet, Plus, Undo2, X } from "lucide-react";
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
import { MODELOS, type TipoElemento } from "./elementos";

type Props = {
  pendientes: number;
  puedeDeshacer: boolean;
  rejilla: boolean;
  guardando: boolean;
  onAnadir: (tipo: TipoElemento, modelo: string | null) => void;
  onRejilla: () => void;
  onDeshacer: () => void;
  onDescartar: () => void;
  onGuardar: () => void;
  onTerminar: () => void;
};

/** Barra inferior del modo edición: añadir, rejilla, deshacer, guardar. */
export function BarraEdicion({
  pendientes,
  puedeDeshacer,
  rejilla,
  guardando,
  onAnadir,
  onRejilla,
  onDeshacer,
  onDescartar,
  onGuardar,
  onTerminar,
}: Props) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 w-[min(96vw,44rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-1.5 rounded-xl border bg-card/95 p-2 shadow-xl backdrop-blur sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Añadir
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Zonas</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onAnadir("linea", null)}>Línea (con flechas)</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAnadir("area", null)}>Zona</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Estanterías</DropdownMenuLabel>
            {MODELOS.estanteria.map((m) => (
              <DropdownMenuItem key={m.valor} onSelect={() => onAnadir("estanteria", m.valor)}>
                {m.nombre}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Objetos</DropdownMenuLabel>
            {MODELOS.puesto.map((m) => (
              <DropdownMenuItem key={m.valor} onSelect={() => onAnadir("puesto", m.valor)}>
                {m.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="icon"
          className={cn("h-9 w-9 shrink-0", rejilla && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
          onClick={onRejilla}
          title="Ajustar a una rejilla de 25 cm al mover"
          aria-label="Ajustar a rejilla"
          aria-pressed={rejilla}
        >
          <Magnet className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onDeshacer}
          disabled={!puedeDeshacer}
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <span className="hidden min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground sm:block">
          {pendientes
            ? `${pendientes} ${pendientes === 1 ? "cambio sin guardar" : "cambios sin guardar"}`
            : "Arrastra para mover · esquinas y lados para cambiar el tamaño"}
        </span>
        <span className="flex-1 sm:hidden" />

        {pendientes > 0 && (
          <Button variant="ghost" size="sm" onClick={onDescartar} disabled={guardando}>
            Descartar
          </Button>
        )}
        <Button size="sm" className="gap-1.5" onClick={onGuardar} disabled={!pendientes || guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar{pendientes ? ` (${pendientes})` : ""}
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onTerminar} title="Salir del modo edición" aria-label="Salir del modo edición">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
