import { useId, type ReactNode } from "react";
import { Copy, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MUELLES } from "./plano";
import {
  CATEGORIAS_DE_SERIE,
  COLORES,
  MODELOS,
  TIPOS,
  almacenDeSerie,
  orientacion,
  referenciaDe,
  type Elemento,
  type TipoElemento,
} from "./elementos";

type Props = {
  elemento: Elemento;
  /** Categorías que ya existen en el mapa, para sugerirlas al escribir. */
  categorias: string[];
  onCambiar: (cambios: Partial<Elemento>, conHistorial?: boolean) => void;
  /** Foto para deshacer antes de empezar a escribir en un campo de texto. */
  onRegistrar: () => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onCerrar: () => void;
  /** Artículos apuntados en este elemento (para avisar si deja de guardar artículos). */
  articulosAqui?: number;
};

function Campo({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {etiqueta}
      </Label>
      <div id={id}>{children}</div>
    </div>
  );
}

const redondear = (v: number) => Math.round(v * 100) / 100;

/** Propiedades del elemento seleccionado en modo edición. */
export function PanelEdicion({ elemento: e, categorias, onCambiar, onRegistrar, onDuplicar, onBorrar, onCerrar, articulosAqui = 0 }: Props) {
  const { x0, y0, x1, y1 } = e.area;
  const ancho = redondear(x1 - x0);
  const fondo = redondear(y1 - y0);
  const eje = orientacion(e.area);
  const sugerencias = [...new Set([...CATEGORIAS_DE_SERIE.map((c) => c.nombre), ...categorias])];
  const listaId = useId();

  const cambiarTipo = (tipo: TipoElemento) => {
    const modelo = tipo === "estanteria" ? "carton" : tipo === "puesto" ? "carros-cc" : null;
    onCambiar({
      tipo,
      modelo,
      sentido: tipo === "linea" ? (e.sentido ?? 1) : null,
      almacen: almacenDeSerie(tipo, modelo),
    });
  };

  const cambiarMedida = (campo: "x" | "y" | "ancho" | "fondo", valor: number) => {
    if (!Number.isFinite(valor)) return;
    const a = { ...e.area };
    if (campo === "x") {
      a.x0 = valor;
      a.x1 = valor + ancho;
    } else if (campo === "y") {
      a.y0 = valor;
      a.y1 = valor + fondo;
    } else if (campo === "ancho") a.x1 = a.x0 + Math.max(valor, 0.4);
    else a.y1 = a.y0 + Math.max(valor, 0.4);
    onCambiar({ area: a }, false);
  };

  /** Gira 90° sobre su centro: intercambia ancho y fondo. */
  const girar = () => {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    onCambiar({ area: { x0: cx - fondo / 2, x1: cx + fondo / 2, y0: cy - ancho / 2, y1: cy + ancho / 2 } });
  };

  const opcionesSentido =
    eje === "x"
      ? [
          { valor: "1", nombre: "Hacia los muelles" },
          { valor: "-1", nombre: "Hacia las puertas" },
        ]
      : [
          { valor: "1", nombre: "Hacia el fondo" },
          { valor: "-1", nombre: "Hacia la pared larga" },
        ];

  const numero = (campo: "x" | "y" | "ancho" | "fondo", valor: number) => (
    <Input
      type="number"
      step={0.1}
      inputMode="decimal"
      className="h-8"
      value={valor}
      onFocus={onRegistrar}
      onChange={(ev) => cambiarMedida(campo, parseFloat(ev.target.value))}
    />
  );

  return (
    <aside
      key={e.id}
      className={cn(
        "absolute z-20 flex flex-col rounded-xl border bg-card/95 shadow-xl backdrop-blur",
        "inset-x-3 bottom-24 max-h-[55dvh] sm:inset-x-auto sm:bottom-24 sm:right-4 sm:top-32 sm:max-h-none sm:w-80",
        "animate-in fade-in slide-in-from-bottom-6 duration-500 sm:slide-in-from-bottom-0 sm:slide-in-from-right-6",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Editando · {referenciaDe(e.area)}</div>
          <div className="truncate font-semibold">{e.nombre || "Sin nombre"}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCerrar} aria-label="Quitar selección">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 overflow-y-auto px-4 py-3">
        <Campo etiqueta="Nombre">
          <Input className="h-8" value={e.nombre} onFocus={onRegistrar} onChange={(ev) => onCambiar({ nombre: ev.target.value }, false)} />
        </Campo>

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Tipo">
            <Select value={e.tipo} onValueChange={(v) => cambiarTipo(v as TipoElemento)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPOS) as TipoElemento[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPOS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          {(e.tipo === "estanteria" || e.tipo === "puesto") && (
            <Campo etiqueta="Modelo">
              <Select value={e.modelo ?? ""} onValueChange={(v) => onCambiar({ modelo: v, almacen: almacenDeSerie(e.tipo, v) })}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Elige" />
                </SelectTrigger>
                <SelectContent>
                  {MODELOS[e.tipo].map((m) => (
                    <SelectItem key={m.valor} value={m.valor}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          )}
          {e.tipo === "linea" && (
            <Campo etiqueta="Flechas">
              <Select
                value={e.sentido ? String(e.sentido) : "0"}
                onValueChange={(v) => onCambiar({ sentido: v === "0" ? null : (Number(v) as 1 | -1) })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcionesSentido.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.nombre}
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Sin flechas</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          )}
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-2.5">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Se guardan artículos aquí</span>
            <span className="block text-xs text-muted-foreground">
              {e.almacen
                ? "Sale en «Zonas» y se puede entrar desde el mapa para apuntar lo que hay."
                : "Solo se ve en el mapa: no sale en «Zonas» ni se puede entrar."}
            </span>
            {!e.almacen && articulosAqui > 0 && (
              <span className="block text-xs font-medium text-aviso-texto">
                Tiene {articulosAqui === 1 ? "1 artículo apuntado" : `${articulosAqui} artículos apuntados`}: siguen aquí, pero no se podrá entrar a
                contarlos.
              </span>
            )}
          </span>
          <Switch checked={e.almacen} onCheckedChange={(v) => onCambiar({ almacen: v })} aria-label="Se guardan artículos aquí" />
        </label>

        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-2.5">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Mostrar el nombre en el mapa</span>
            <span className="block text-xs text-muted-foreground">
              {e.mostrarNombre
                ? "El nombre se ve siempre sobre el mapa."
                : e.almacen
                  ? "Mapa más limpio: el nombre sale al pasar por encima y en «Zonas»."
                  : "Mapa más limpio: el nombre solo se ve al editar el mapa."}
            </span>
          </span>
          <Switch checked={e.mostrarNombre} onCheckedChange={(v) => onCambiar({ mostrarNombre: v })} aria-label="Mostrar el nombre en el mapa" />
        </label>

        <Campo etiqueta="Categoría (agrupa en el menú Zonas)">
          <Input
            className="h-8"
            list={listaId}
            value={e.categoria}
            onFocus={onRegistrar}
            onChange={(ev) => {
              const categoria = ev.target.value;
              // Si es una categoría de serie, coge también su color
              const deSerie = CATEGORIAS_DE_SERIE.find((c) => c.nombre === categoria);
              onCambiar(deSerie ? { categoria, color: deSerie.color } : { categoria }, false);
            }}
          />
          <datalist id={listaId}>
            {sugerencias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>

        <Campo etiqueta="Color">
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => onCambiar({ color: c })}
                className={cn("h-6 w-6 rounded-full ring-offset-2 ring-offset-card transition", e.color === c && "ring-2 ring-foreground")}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              aria-label="Otro color"
              value={e.color}
              onFocus={onRegistrar}
              onChange={(ev) => onCambiar({ color: ev.target.value }, false)}
              className="h-6 w-8 cursor-pointer rounded border bg-transparent"
            />
          </div>
        </Campo>

        {e.tipo !== "puesto" && (
          <Campo etiqueta="Muelle al que llega">
            <Select value={e.muelle ?? "ninguno"} onValueChange={(v) => onCambiar({ muelle: v === "ninguno" ? null : v })}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Ninguno</SelectItem>
                {MUELLES.map((m) => (
                  <SelectItem key={m.nombre} value={m.nombre}>
                    {m.nombre}
                  </SelectItem>
                ))}
                <SelectItem value="P">Puerta P</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Posición X">{numero("x", redondear(x0))}</Campo>
          <Campo etiqueta="Posición Y">{numero("y", redondear(y0))}</Campo>
          <Campo etiqueta="Medida X">{numero("ancho", ancho)}</Campo>
          <Campo etiqueta="Medida Y">{numero("fondo", fondo)}</Campo>
        </div>
        <p className="-mt-1 text-[11px] text-muted-foreground">
          En metros. X va de la pared de las puertas (0) a los muelles (110); Y, de la pared larga (0) hacia el fondo.
        </p>

        <Campo etiqueta="Descripción">
          <Textarea
            rows={2}
            value={e.descripcion}
            onFocus={onRegistrar}
            onChange={(ev) => onCambiar({ descripcion: ev.target.value }, false)}
          />
        </Campo>
      </div>

      <div className="flex gap-2 border-t px-4 py-3">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={girar}>
          <RotateCw className="h-3.5 w-3.5" /> Girar
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onDuplicar}>
          <Copy className="h-3.5 w-3.5" /> Duplicar
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-destructive hover:text-destructive" onClick={onBorrar}>
          <Trash2 className="h-3.5 w-3.5" /> Borrar
        </Button>
      </div>
    </aside>
  );
}
