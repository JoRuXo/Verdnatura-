import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Move, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLAVE_ARTICULOS, colocarCaja, redondearPosicion, type SitioCaja } from "@/articulos/useArticulos";
import type { Articulo } from "@/articulos/modelo";
import {
  aCajaArmario,
  cajasDelArmario,
  disposicionArmario,
  formaArmario,
  MAX_BALDAS,
  nombreBalda,
  numeroBaldas,
  posicionDesdeInicio,
  type CajaColocada,
} from "./armario";
import type { Elemento } from "./elementos";
import { CLAVE_MAPA, guardarZona } from "./useMapa";

/** Alto de cada balda en la vista de frente y dónde va la caja dentro. */
const FILA_REM = 5.25;
const CAJA_ARRIBA_REM = 1.4;
const CAJA_ALTO_REM = 3.5;
/** Paso de las flechas del teclado, en metros. */
const PASO_TECLADO = 0.05;
const ESPERA_TECLADO = 500;

type Arrastre = {
  id: string;
  pointerId: number;
  inicioX: number;
  inicioY: number;
  /** Dónde se ha cogido la caja, desde su esquina. */
  dx: number;
  dy: number;
  ancho: number;
  alto: number;
  huella: number;
  activo: boolean;
  /** Esquina de la copia que va con el dedo, en la capa de cajas. */
  x: number;
  y: number;
  destino: SitioCaja | null;
};

type Pendiente = { antes: SitioCaja; nuevo: SitioCaja; t: number; nombre: string };

/**
 * El armario visto de frente, como en la nave: cajas de cartón con su etiqueta
 * amarilla en cada balda, a escala y donde están de verdad. Las cajas se
 * arrastran (ratón o dedo) a cualquier balda y a cualquier sitio a lo largo;
 * si chocan, empujan a las de al lado. Tocar una la elige para editarla.
 * Con una elegida, las flechas del teclado también la mueven.
 */
export function ArmarioEditable({
  zona,
  articulos,
  esAdmin,
  elegida,
  onElegir,
}: {
  zona: Elemento;
  articulos: Articulo[];
  esAdmin: boolean;
  elegida: string | null;
  onElegir: (existenciaId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const baldas = numeroBaldas(zona.baldas);
  const { largo, ancho } = useMemo(() => formaArmario(zona.area), [zona.area]);
  const frontales = cajasDelArmario(articulos, zona.id, baldas);
  const porId = new Map(frontales.map((c) => [c.e.id, c]));

  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  const ponerArrastre = (a: Arrastre | null) => {
    arrastreRef.current = a;
    setArrastre(a);
  };

  // Mientras se arrastra, la caja ya cuenta en su sitio nuevo: las demás se apartan
  const contenido = frontales
    .map(aCajaArmario)
    .map((c) => (arrastre?.activo && arrastre.destino && arrastre.id === c.id ? { ...c, ...arrastre.destino } : c));
  const colocadas = disposicionArmario(largo, ancho, contenido, baldas);
  const noCaben = colocadas.filter((c) => !c.cabe);

  const capaRef = useRef<HTMLDivElement>(null);
  const filasRef = useRef(new Map<number, HTMLDivElement>());

  // ---- Guardar el sitio de una caja (al soltarla, o tras unas flechas seguidas) ----
  const pendientes = useRef(new Map<string, Pendiente>());

  const ponerSitio = (id: string, s: SitioCaja) =>
    queryClient.setQueryData<Articulo[]>(CLAVE_ARTICULOS, (lista) =>
      lista?.map((x) =>
        x.existencias.some((e) => e.id === id)
          ? { ...x, existencias: x.existencias.map((e) => (e.id === id ? { ...e, balda: s.balda, posicion: s.posicion } : e)) }
          : x,
      ),
    );

  const enviarSitio = async (id: string) => {
    const p = pendientes.current.get(id);
    if (!p) return;
    window.clearTimeout(p.t);
    pendientes.current.delete(id);
    if (p.antes.balda === p.nuevo.balda && p.antes.posicion === p.nuevo.posicion) return;
    try {
      const guardado = await colocarCaja(id, p.antes, p.nuevo);
      if (!guardado) {
        toast.warning(`Alguien acaba de mover ${p.nombre}`, { description: "Ya ves dónde está ahora." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      } else ponerSitio(id, guardado);
    } catch (err) {
      toast.error(`No se ha podido mover ${p.nombre}`, { description: (err as Error).message });
      void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
    }
  };
  const enviarRef = useRef(enviarSitio);
  enviarRef.current = enviarSitio;
  // Al cerrar la ventana con algo sin mandar, se manda ya
  useEffect(() => {
    const lista = pendientes.current;
    return () => [...lista.keys()].forEach((id) => void enviarRef.current(id));
  }, []);

  const colocar = (id: string, nuevo: SitioCaja, espera = 0) => {
    const c = porId.get(id);
    if (!c) return;
    const previo = pendientes.current.get(id);
    if (previo) window.clearTimeout(previo.t);
    const antes = previo?.antes ?? { balda: c.e.balda, posicion: c.e.posicion };
    const sitio = { balda: nuevo.balda, posicion: redondearPosicion(nuevo.posicion) };
    ponerSitio(id, sitio);
    const t = window.setTimeout(() => void enviarRef.current(id), espera);
    pendientes.current.set(id, { antes, nuevo: sitio, t, nombre: c.a.nombre });
  };

  // ---- Arrastrar ----
  const alPulsar = (e: PointerEvent<HTMLButtonElement>, c: CajaColocada) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    ponerArrastre({
      id: c.id,
      pointerId: e.pointerId,
      inicioX: e.clientX,
      inicioY: e.clientY,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      ancho: r.width,
      alto: r.height,
      huella: c.medidas.huella,
      activo: false,
      x: 0,
      y: 0,
      destino: null,
    });
  };

  const alMover = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrastreRef.current;
    const capa = capaRef.current;
    if (!a || e.pointerId !== a.pointerId || !capa) return;
    if (!a.activo && Math.hypot(e.clientX - a.inicioX, e.clientY - a.inicioY) < 5) return;
    const rc = capa.getBoundingClientRect();
    // Balda: la fila en la que cae el centro de la caja
    const centro = e.clientY - a.dy + a.alto / 2;
    let balda = 1;
    let mejor = Infinity;
    filasRef.current.forEach((fila, b) => {
      const rf = fila.getBoundingClientRect();
      const d = centro < rf.top ? rf.top - centro : centro > rf.bottom ? centro - rf.bottom : 0;
      if (d < mejor) [mejor, balda] = [d, b];
    });
    // Sitio a lo largo: el borde izquierdo de la caja, en metros
    const desde = ((e.clientX - a.dx - rc.left) / rc.width) * largo;
    ponerArrastre({
      ...a,
      activo: true,
      x: e.clientX - a.dx - rc.left,
      y: e.clientY - a.dy - rc.top,
      destino: { balda, posicion: redondearPosicion(posicionDesdeInicio(desde, a.huella, largo)) },
    });
  };

  const alSoltar = (e: PointerEvent<HTMLButtonElement>) => {
    const a = arrastreRef.current;
    if (!a || e.pointerId !== a.pointerId) return;
    ponerArrastre(null);
    if (!a.activo) {
      onElegir(elegida === a.id ? null : a.id);
      return;
    }
    if (a.destino) colocar(a.id, a.destino);
    onElegir(a.id);
  };

  // ---- Teclado: con una caja elegida, ← → la corren y ↑ ↓ la cambian de balda ----
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, c: CajaColocada) => {
    const posicionCon = (desde: number) => posicionDesdeInicio(desde, c.medidas.huella, largo);
    let nuevo: SitioCaja | null = null;
    if (e.key === "ArrowLeft") nuevo = { balda: c.balda, posicion: posicionCon(c.desde - PASO_TECLADO) };
    if (e.key === "ArrowRight") nuevo = { balda: c.balda, posicion: posicionCon(c.desde + PASO_TECLADO) };
    if (e.key === "ArrowUp" && c.balda < baldas) nuevo = { balda: c.balda + 1, posicion: posicionCon(c.desde) };
    if (e.key === "ArrowDown" && c.balda > 1) nuevo = { balda: c.balda - 1, posicion: posicionCon(c.desde) };
    if (!nuevo) return;
    e.preventDefault();
    onElegir(c.id);
    colocar(c.id, nuevo, ESPERA_TECLADO);
  };

  // ---- Baldas (solo administradores) ----
  const arribaOcupada = frontales.some((c) => c.e.balda >= baldas);
  const cambiarBaldas = async (n: number) => {
    const antes = zona;
    queryClient.setQueryData<Elemento[]>(CLAVE_MAPA, (lista) => lista?.map((x) => (x.id === zona.id ? { ...x, baldas: n } : x)));
    try {
      if (!(await guardarZona(antes, { baldas: n }))) {
        toast.warning("Alguien acaba de cambiar este armario", { description: "Ya ves cómo está ahora." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_MAPA });
      }
    } catch (err) {
      toast.error("No se han podido cambiar las baldas", { description: (err as Error).message });
      void queryClient.invalidateQueries({ queryKey: CLAVE_MAPA });
    }
  };

  // Posición de una caja en la capa: a lo largo, a escala; de alto, en su fila (la de arriba primero)
  const estilo = (c: CajaColocada, fila: number): CSSProperties => ({
    left: `${(c.desde / largo) * 100}%`,
    width: `${(c.medidas.huella / largo) * 100}%`,
    top: `${fila * FILA_REM + CAJA_ARRIBA_REM}rem`,
    height: `${CAJA_ALTO_REM}rem`,
  });
  const filaDe = (c: CajaColocada) => (c.cabe ? baldas - c.balda : baldas);
  // Las que no caben, en fila debajo del armario, para poder cogerlas
  const enBandeja = new Map<string, number>();
  noCaben.reduce((x, c) => (enBandeja.set(c.id, x), x + c.medidas.huella + 0.04), 0.03);

  const movida = arrastre?.activo ? colocadas.find((c) => c.id === arrastre.id) : undefined;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">El armario</h3>
        {esAdmin && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="mr-1">
              {baldas} {baldas === 1 ? "balda" : "baldas"}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={baldas <= 1 || arribaOcupada}
              title={arribaOcupada ? "Para quitar la balda de arriba, primero baja sus cajas" : "Quitar la balda de arriba"}
              aria-label="Quitar la balda de arriba"
              onClick={() => void cambiarBaldas(baldas - 1)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={baldas >= MAX_BALDAS}
              title="Añadir una balda arriba"
              aria-label="Añadir una balda arriba"
              onClick={() => void cambiarBaldas(baldas + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border-4 border-[#cfccc4] bg-[#efeee9] px-2 dark:border-[#5b5953] dark:bg-[#2b2a27]">
        <div className="relative select-none">
          {Array.from({ length: baldas }, (_, i) => baldas - i).map((b) => (
            <div
              key={b}
              ref={(n) => {
                if (n) filasRef.current.set(b, n);
                else filasRef.current.delete(b);
              }}
              className={cn(
                "relative border-b-4 border-[#dcdad3] dark:border-[#45433e]",
                arrastre?.activo && arrastre.destino?.balda === b && "bg-marca-lima/10",
              )}
              style={{ height: `${FILA_REM}rem` }}
            >
              <span className="absolute left-0.5 top-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {nombreBalda(b, baldas)}
              </span>
              {!colocadas.some((c) => c.cabe && c.balda === b) && (
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground">Vacía</span>
              )}
            </div>
          ))}
          {noCaben.length > 0 && (
            <div className="relative" style={{ height: `${FILA_REM}rem` }}>
              <span className="absolute left-0.5 top-1 text-[10px] font-medium uppercase tracking-wide text-peligro-texto">
                No caben · arrástralas a un hueco
              </span>
            </div>
          )}

          {/* Todas las cajas en una sola capa: al cambiar de balda no se pierde el arrastre */}
          <div ref={capaRef} className="pointer-events-none absolute inset-0">
            {colocadas.map((c) => {
              const f = porId.get(c.id);
              if (!f) return null;
              const fila = filaDe(c);
              const sitio = c.cabe ? estilo(c, fila) : { ...estilo(c, fila), left: `${((enBandeja.get(c.id) ?? 0) / largo) * 100}%` };
              const esLaMovida = movida?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ ...sitio, touchAction: "none" }}
                  onPointerDown={(e) => alPulsar(e, c)}
                  onPointerMove={alMover}
                  onPointerUp={alSoltar}
                  onPointerCancel={() => ponerArrastre(null)}
                  onKeyDown={(e) => alTeclear(e, c)}
                  aria-pressed={elegida === c.id}
                  aria-label={`${f.a.nombre}, ${nombreBalda(c.balda, baldas).toLowerCase()}. Arrastra para moverla o usa las flechas.`}
                  title={f.a.nombre}
                  className={cn(
                    "pointer-events-auto absolute flex cursor-grab items-stretch gap-[2%] outline-none transition-[left,top] duration-150",
                    "focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                    elegida === c.id && "rounded-sm ring-2 ring-marca-lima ring-offset-2 ring-offset-[#efeee9] dark:ring-offset-[#2b2a27]",
                    esLaMovida && "opacity-40 [&>span]:border-2 [&>span]:border-dashed [&>span]:border-foreground/40",
                    !c.cabe && "opacity-80",
                  )}
                >
                  {Array.from({ length: c.medidas.pilas }, (_, p) => (
                    <span
                      key={p}
                      className="relative flex min-w-0 flex-1 items-center justify-center rounded-sm bg-[#c4a27a] px-0.5 shadow-sm"
                    >
                      {p === 0 && (
                        <span className="line-clamp-4 w-full rounded-[2px] bg-[#f4e04d] px-0.5 py-0.5 text-center text-[8px] font-semibold leading-tight text-[#1a1a1a] [overflow-wrap:anywhere] sm:line-clamp-3 sm:text-[10px]">
                          {f.a.nombre}
                        </span>
                      )}
                    </span>
                  ))}
                  {c.cantidad > 1 && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                      ×{c.cantidad}
                    </span>
                  )}
                  {f.e.nota && (
                    <span className="absolute -left-1 -top-1.5 rounded-full bg-background p-0.5 shadow" title={f.e.nota}>
                      <StickyNote className="h-2.5 w-2.5 text-muted-foreground" />
                    </span>
                  )}
                </button>
              );
            })}

            {/* La copia que va con el dedo */}
            {arrastre?.activo && movida && (
              <div
                className="absolute z-10 flex items-center justify-center rounded-sm bg-[#c4a27a] px-0.5 shadow-xl ring-2 ring-marca-lima"
                style={{ left: arrastre.x, top: arrastre.y, width: arrastre.ancho, height: arrastre.alto }}
              >
                <span className="line-clamp-3 w-full rounded-[2px] bg-[#f4e04d] px-0.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-[#1a1a1a] [overflow-wrap:anywhere]">
                  {porId.get(movida.id)?.a.nombre}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Move className="h-3.5 w-3.5 shrink-0" />
        Arrastra las cajas a donde quieras. Toca una para ver y cambiar sus datos.
      </p>
    </section>
  );
}
