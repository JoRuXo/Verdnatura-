import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const MINIMO_CONTRASENA = 8;

/** Cambiar la contraseña de quien ha entrado. */
export function DialogoContrasena({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setNueva("");
      setRepetida("");
      setError(null);
    }
  }, [abierto]);

  const guardar = async () => {
    if (nueva.length < MINIMO_CONTRASENA) return setError(`La contraseña tiene que tener al menos ${MINIMO_CONTRASENA} caracteres.`);
    if (nueva !== repetida) return setError("Las dos contraseñas no coinciden. Vuelve a escribirlas.");
    setGuardando(true);
    setError(null);
    const { error: fallo } = await supabase.auth.updateUser({ password: nueva });
    setGuardando(false);
    if (fallo) {
      setError(
        fallo.code === "same_password"
          ? "La contraseña nueva tiene que ser distinta de la que tienes ahora."
          : fallo.code === "weak_password"
            ? "Esa contraseña es demasiado fácil. Prueba con otra más larga."
            : "No se ha podido cambiar la contraseña. Vuelve a probar en un momento.",
      );
      return;
    }
    toast.success("Contraseña cambiada");
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar mi contraseña</DialogTitle>
          <DialogDescription>Al menos {MINIMO_CONTRASENA} caracteres. Seguirás dentro en este dispositivo.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="contrasena-nueva">Contraseña nueva</Label>
            <Input id="contrasena-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contrasena-repetida">Repite la contraseña</Label>
            <Input id="contrasena-repetida" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-peligro-borde bg-peligro-suave px-3 py-2 text-sm text-peligro-texto">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Cambiar contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
