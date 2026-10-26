import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { ChevronRight, Grid3x3, Maximize, Moon, MousePointerClick, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buscarZona, type Zona } from "@/nave/zonas";

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
  onClick,
  children,
}: {
  titulo: string;
  activo?: boolean;
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
      onClick={onClick}
      className={cn("h-10 w-10 bg-card/90 shadow-md backdrop-blur", activo && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
    >
      {children}
    </Button>
  );
}

function PanelZona({ zona, onVolver }: { zona: Zona; onVolver: () => void }) {
  return (
    <aside
      key={zona.id}
      className={cn(
        "absolute z-20 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur",
        "inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:w-80",
        "animate-in fade-in slide-in-from-bottom-6 duration-700 sm:slide-in-from-bottom-0 sm:slide-in-from-right-6",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: zona.color }} />
            <h2 className="truncate text-lg font-semibold">{zona.nombre}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Posición en el plano: {zona.referencia}</p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 shrink-0" onClick={onVolver} aria-label="Volver a la nave">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{zona.descripcion}</p>
      <div className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Aquí irán las estanterías, palets y stock de la zona en cuanto definamos cómo trabajáis.
      </div>
      <Button className="mt-4 w-full" variant="secondary" onClick={onVolver}>
        Volver a la nave
      </Button>
    </aside>
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
          <span className="text-foreground">Toca una zona para entrar.</span>
        </p>
        <button type="button" onClick={onCerrar} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Cerrar ayuda">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const Nave = () => {
  const { zonaId } = useParams();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const zona = buscarZona(zonaId);
  const [referencias, setReferencias] = useState(true);
  const [vistaKey, setVistaKey] = useState(0);
  const [ayuda, setAyuda] = useState(true);

  // Una dirección de zona que no existe vuelve a la vista general
  useEffect(() => {
    if (zonaId && !zona) navigate("/", { replace: true });
  }, [zonaId, zona, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => setAyuda(false), 9000);
    return () => window.clearTimeout(t);
  }, []);

  const volver = useCallback(() => navigate("/"), [navigate]);
  const elegirZona = useCallback(
    (id: string) => {
      setAyuda(false);
      navigate(`/zona/${id}`);
    },
    [navigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && zona) volver();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zona, volver]);

  const oscuro = resolvedTheme === "dark";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <Suspense fallback={<Cargando />}>
        <EscenaNave
          zona={zona}
          oscuro={oscuro}
          referencias={referencias}
          vistaKey={vistaKey}
          onElegirZona={elegirZona}
        />
      </Suspense>

      {/* Cabecera y miga de pan */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto rounded-xl border bg-card/90 px-3 py-2 shadow-md backdrop-blur">
          <div className="text-base font-bold leading-tight">Verdnatura</div>
          <nav className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground" aria-label="Ubicación">
            <button type="button" onClick={volver} className={cn("hover:text-foreground", !zona && "text-foreground")}>
              Nave Holland
            </button>
            {zona && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="font-medium text-foreground animate-in fade-in duration-500">{zona.nombre}</span>
              </>
            )}
          </nav>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <BotonFlotante
            titulo="Vista general"
            onClick={() => {
              if (zona) volver();
              else setVistaKey((k) => k + 1);
            }}
          >
            <Maximize className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante titulo="Referencias del plano (A–K, 1–4)" activo={referencias} onClick={() => setReferencias((r) => !r)}>
            <Grid3x3 className="h-4 w-4" />
          </BotonFlotante>
          <BotonFlotante titulo="Cambiar tema" onClick={() => setTheme(oscuro ? "light" : "dark")}>
            {oscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </BotonFlotante>
        </div>
      </header>

      {zona && <PanelZona zona={zona} onVolver={volver} />}
      {ayuda && !zona && <Ayuda onCerrar={() => setAyuda(false)} />}
    </div>
  );
};

export default Nave;
