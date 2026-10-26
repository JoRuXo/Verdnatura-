import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, FileDown, History, Menu, Monitor, Moon, QrCode, Sun, UserRound } from "lucide-react";
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
import { abrirCambioNombre, useAutor } from "@/lib/autor";
import { useInstalacion } from "@/lib/instalar";
import { useConexionTiempoReal } from "@/lib/tiempoReal";
import { DialogoExportar } from "@/exportar/DialogoExportar";
import { FUNCIONES } from "@/funciones";

/**
 * Menú de la cabecera con lo que no tiene botón propio: exportar, historial,
 * tema (claro / oscuro), nombre de quien usa la app e instalarla en el móvil.
 * `children`: opciones propias de la página (p. ej. las del mapa en el móvil).
 */
export function MenuGeneral({ children, className }: { children?: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const autor = useAutor();
  const conexion = useConexionTiempoReal();
  const instalacion = useInstalacion();
  const [exportando, setExportando] = useState(false);

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
          <DropdownMenuItem onSelect={() => abrirCambioNombre()} className="gap-2">
            <UserRound className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted-foreground">Eres </span>
              <span className="font-semibold">{autor || "—"}</span>
            </span>
            <span className="text-xs text-muted-foreground">Cambiar</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {children}

          <DropdownMenuItem onSelect={() => setExportando(true)} className="gap-2">
            <FileDown className="h-4 w-4" /> Exportar stock (Excel o PDF)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/historial")} className="gap-2">
            <History className="h-4 w-4" /> Historial de cambios
          </DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogoExportar abierto={exportando} onCerrar={() => setExportando(false)} />
    </>
  );
}
