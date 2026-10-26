import { cn } from "@/lib/utils";

/**
 * Logo oficial de Verdnatura (el de verdnatura.es). En tema oscuro sale la
 * versión con «Verd» en blanco. Con `compacto`, en el móvil se queda en el
 * símbolo de las cuatro hojas (el icono de la web) para que quepa la cabecera.
 * La altura se da con `className` (p. ej. "h-6").
 */
export function Logo({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {compacto && <img src="/marca/hojas-verdnatura.png" alt="Verdnatura" className="h-full w-auto sm:hidden" />}
      <img
        src="/marca/logo-verdnatura.png"
        alt="Verdnatura"
        className={cn("h-full w-auto dark:hidden", compacto && "hidden sm:block sm:dark:hidden")}
      />
      <img
        src="/marca/logo-verdnatura-blanco.png"
        alt=""
        aria-hidden
        className={cn("hidden h-full w-auto dark:block", compacto && "dark:hidden sm:dark:block")}
      />
    </span>
  );
}
