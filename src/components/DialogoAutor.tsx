import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { abrirCambioNombre, cambiarAutor, useAutor, useCambiandoNombre } from "@/lib/autor";
import { useAutores } from "@/historial/useHistorial";

/**
 * Pide el nombre la primera vez que se abre la app en un dispositivo (y cuando
 * se quiere cambiar). No es una contraseña: sirve para que el historial diga
 * quién hizo cada cambio.
 */
export function DialogoAutor() {
  const autor = useAutor();
  const cambiando = useCambiandoNombre();
  const abierto = !autor || cambiando;
  const [nombre, setNombre] = useState(autor);
  const autores = useAutores();

  useEffect(() => {
    if (abierto) setNombre(autor);
  }, [abierto, autor]);

  const valido = nombre.trim().length >= 2;
  const conocidos = (autores.data ?? []).filter((a) => a && a !== nombre.trim()).slice(0, 8);

  const aceptar = (n = nombre) => {
    if (n.trim().length < 2) return;
    cambiarAutor(n);
    abrirCambioNombre(false);
  };

  return (
    <Dialog
      open={abierto}
      onOpenChange={(abrir) => {
        // Sin nombre no se puede cerrar: hace falta para el historial
        if (!abrir && autor) abrirCambioNombre(false);
      }}
    >
      <DialogContent
        // Sin nombre tampoco se enseña la X de cerrar
        className={cn("max-w-sm", !autor && "[&>button:last-child]:hidden")}
        onEscapeKeyDown={(e) => !autor && e.preventDefault()}
        onPointerDownOutside={(e) => !autor && e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <UserRound className="h-6 w-6" />
          </div>
          <DialogTitle>{autor ? "Cambiar de nombre" : "¿Quién eres?"}</DialogTitle>
          <DialogDescription>
            Tu nombre se guarda en este dispositivo y sale en el historial junto a cada cambio que hagas. No hace falta contraseña.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            aceptar();
          }}
          className="space-y-3"
        >
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" maxLength={60} aria-label="Tu nombre" />
          {conocidos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">O elige uno que ya se ha usado:</p>
              <div className="flex flex-wrap gap-1.5">
                {conocidos.map((a) => (
                  <button key={a} type="button" onClick={() => aceptar(a)} className="rounded-full border px-3 py-1 text-sm hover:bg-accent">
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!valido} className="w-full sm:w-auto">
              {autor ? "Guardar" : "Empezar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
