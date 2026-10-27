import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { DatabaseBackup, Download, KeyRound, LogOut, Menu, Monitor, Moon, QrCode, Sun, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSesion, usePerfil } from "@/auth/sesion";
import { DialogoContrasena } from "@/auth/DialogoContrasena";
import { ROLES } from "@/usuarios/useUsuarios";
import { descargarCopia } from "@/lib/copia";
import { useInstalacion } from "@/lib/instalar";
import { useConexionTiempoReal } from "@/lib/tiempoReal";
import { FUNCIONES } from "@/funciones";

/**
 * Menú de la cabecera con lo que no tiene botón propio: la cuenta de quien ha
 * entrado (contraseña, salir y, para administradores, usuarios y copia de
 * seguridad), tema (claro / oscuro) e instalarla en el móvil.
 * `children`: opciones propias de la página (p. ej. las del mapa en el móvil).
 */
export function MenuGeneral({ children, className }: { children?: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const perfil = usePerfil();
  const { salir } = useSesion();
  const esAdmin = perfil.rol === "admin";
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);

  const copia = async () => {
    try {
      const fecha = await descargarCopia();
      if (fecha) toast.success(`Copia del ${new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES")} descargada`);
      else toast.info("Todavía no hay ninguna copia", { description: "Se hace sola cada noche." });
    } catch {
      toast.error("No se ha podido descargar la copia. Vuelve a probar en un momento.");
    }
  };
  const conexion = useConexionTiempoReal();
  const instalacion = useInstalacion();

  const instalar = async () => {
    const hecho = await instalacion.instalar();
    if (!hecho) {
      toast.info("Para instalarla en el iPhone", {
        description: "En Safari, toca el botón Compartir (el cuadrado con la flecha) y elige «Añadir a pantalla de inicio».",
        duration: 10_000,
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Menú"
            title="Menú"
            className={cn("h-10 w-10", className)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[80vh] w-64 overflow-y-auto">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold">{perfil.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{perfil.email}</p>
            <p className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{ROLES[perfil.rol].nombre}</p>
          </div>
          <DropdownMenuItem onSelect={() => setCambiandoContrasena(true)} className="gap-2">
            <KeyRound className="h-4 w-4" /> Cambiar mi contraseña
          </DropdownMenuItem>
          {esAdmin && (
            <>
              <DropdownMenuItem onSelect={() => navigate("/usuarios")} className="gap-2">
                <UsersRound className="h-4 w-4" /> Usuarios
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copia()} className="gap-2">
                <DatabaseBackup className="h-4 w-4" /> Descargar copia de seguridad
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />

          {children}

          {(FUNCIONES.codigosQR || instalacion.puede) && <DropdownMenuSeparator />}
          {FUNCIONES.codigosQR && (
            <DropdownMenuItem onSelect={() => navigate("/qr")} className="gap-2">
              <QrCode className="h-4 w-4" /> Códigos QR de las zonas
            </DropdownMenuItem>
          )}
          {instalacion.puede && (
            <DropdownMenuItem onSelect={instalar} className="gap-2">
              <Download className="h-4 w-4" /> Instalar en este dispositivo
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light" className="gap-2">
              <Sun className="h-4 w-4" /> Claro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className="gap-2">
              <Moon className="h-4 w-4" /> Oscuro
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" className="gap-2">
              <Monitor className="h-4 w-4" /> Como el dispositivo
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                conexion === "conectado" ? "bg-correcto" : conexion === "conectando" ? "bg-muted-foreground" : "bg-aviso",
              )}
            />
            {conexion === "conectado"
              ? "Cambios de los demás al momento"
              : conexion === "conectando"
                ? "Conectando…"
                : "Sin conexión en tiempo real: se actualiza al volver"}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void salir()} className="gap-2">
            <LogOut className="h-4 w-4" /> Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogoContrasena abierto={cambiandoContrasena} onCerrar={() => setCambiandoContrasena(false)} />
    </>
  );
}
