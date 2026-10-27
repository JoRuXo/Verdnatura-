import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileDown, History, Map as IconoMapa, Package, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { MenuGeneral } from "@/components/MenuGeneral";
import { DialogoExportar } from "@/exportar/DialogoExportar";

type Apartado = { id: "mapa" | "articulos" | "historial"; nombre: string; icono: LucideIcon; a: string };

const APARTADOS: Apartado[] = [
  { id: "mapa", nombre: "Mapa", icono: IconoMapa, a: "/" },
  { id: "articulos", nombre: "Artículos", icono: Package, a: "/articulos" },
  { id: "historial", nombre: "Historial", icono: History, a: "/historial" },
];

const apartadoDe = (ruta: string): Apartado["id"] =>
  ruta.startsWith("/articulos") ? "articulos" : ruta.startsWith("/historial") ? "historial" : "mapa";

/** Enlace de la barra en ordenador: como el menú de verdnatura.es, con raya lima debajo del apartado abierto. */
function Enlace({ activo, icono: Icono, children, ...props }: { activo?: boolean; icono: LucideIcon; children: ReactNode } & (
  | { a: string; onClick?: never }
  | { a?: never; onClick: () => void }
)) {
  const clase = cn(
    "relative flex h-full items-center gap-2 px-2.5 text-[13px] font-semibold tracking-[0.06em] transition-colors lg:px-3.5",
    activo ? "text-foreground" : "text-marca-gris hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
  );
  const contenido = (
    <>
      <Icono className="h-4 w-4 shrink-0" />
      <span className="hidden md:inline">{children}</span>
      {activo && <span className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-t-full bg-primary lg:inset-x-3.5" />}
    </>
  );
  return props.a ? (
    <Link to={props.a} aria-current={activo ? "page" : undefined} title={String(children)} className={clase}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={props.onClick} title={String(children)} className={clase}>
      {contenido}
    </button>
  );
}

/** Pestaña de la fila de apartados en el móvil: icono con su nombre debajo. */
function Pestana({ activo, icono: Icono, nombre, destacada, a, onClick }: {
  activo?: boolean;
  icono: LucideIcon;
  nombre: string;
  destacada?: boolean;
  a?: string;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
          destacada ? "bg-primary text-primary-foreground" : activo ? "bg-primary/15 text-marca-lima-oscuro" : "",
        )}
      >
        <Icono className="h-[18px] w-[18px]" />
      </span>
      <span className={cn("text-[11px] font-semibold tracking-[0.02em]", activo ? "text-foreground" : "text-muted-foreground")}>{nombre}</span>
    </>
  );
  const clase = "flex flex-col items-center justify-center gap-0.5 py-1.5";
  return a ? (
    <Link to={a} aria-current={activo ? "page" : undefined} className={clase}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={clase}>
      {contenido}
    </button>
  );
}

/**
 * Barra de arriba, igual en todas las páginas: logo, los apartados de la app
 * (Mapa, Artículos, Historial, Exportar) y el botón de «Nuevo artículo».
 * En el móvil, los apartados van en una fila de pestañas debajo del logo.
 * `menu`: opciones propias de la página para el menú ☰.
 */
export function BarraSuperior({ menu, className }: { menu?: ReactNode; className?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [exportando, setExportando] = useState(false);
  const actual = apartadoDe(pathname);
  const nuevo = () => navigate("/articulos/nuevo");

  return (
    <>
      <header className={cn("z-30 border-b bg-card/95 shadow-sm backdrop-blur", className)}>
        <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:gap-2 sm:px-5 lg:gap-4">
          <Link to="/" aria-label="Verdnatura, mapa de la nave" className="mr-1 shrink-0 sm:mr-3">
            <Logo className="h-5 sm:h-6" />
          </Link>

          <nav className="hidden h-full items-stretch sm:flex" aria-label="Apartados">
            {APARTADOS.map((a) => (
              <Enlace key={a.id} a={a.a} icono={a.icono} activo={actual === a.id}>
                {a.nombre}
              </Enlace>
            ))}
            <Enlace icono={FileDown} onClick={() => setExportando(true)}>
              Exportar
            </Enlace>
          </nav>

          <span className="flex-1" />
          <Button onClick={nuevo} className="hidden h-10 gap-1.5 px-3 sm:inline-flex lg:px-5" title="Nuevo artículo">
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">Nuevo artículo</span>
          </Button>
          <MenuGeneral className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">{menu}</MenuGeneral>
        </div>

        <nav className="grid grid-cols-5 border-t sm:hidden" aria-label="Apartados">
          <Pestana a="/" icono={IconoMapa} nombre="Mapa" activo={actual === "mapa"} />
          <Pestana a="/articulos" icono={Package} nombre="Artículos" activo={actual === "articulos" && pathname !== "/articulos/nuevo"} />
          <Pestana onClick={nuevo} icono={Plus} nombre="Nuevo" destacada />
          <Pestana a="/historial" icono={History} nombre="Historial" activo={actual === "historial"} />
          <Pestana onClick={() => setExportando(true)} icono={FileDown} nombre="Exportar" />
        </nav>
      </header>
      <DialogoExportar abierto={exportando} onCerrar={() => setExportando(false)} />
    </>
  );
}
