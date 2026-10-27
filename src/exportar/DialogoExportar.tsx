import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePerfil } from "@/auth/sesion";
import { useArticulos } from "@/articulos/useArticulos";
import { useMapa } from "@/nave/useMapa";
import { nombreFichero, prepararInforme } from "./informe";
import { descargar, miniaturas } from "./miniaturas";
import { cargarMarca } from "./marca";

type Formato = "excel" | "pdf";

const FORMATOS: Record<Formato, { nombre: string; texto: string; icono: typeof FileText; color: string }> = {
  excel: {
    nombre: "Excel",
    texto: "Resumen, cada artículo y cada zona en hojas separadas. Para filtrar, ordenar o seguir trabajando.",
    icono: FileSpreadsheet,
    color: "text-marca-lima-oscuro",
  },
  pdf: {
    nombre: "PDF",
    texto: "Listo para imprimir o mandar por WhatsApp o correo. No se puede editar.",
    icono: FileText,
    color: "text-peligro",
  },
};

/** Descargar todo el stock en Excel o PDF. */
export function DialogoExportar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const articulos = useArticulos();
  const mapa = useMapa();
  const autor = usePerfil().nombre;
  const [formato, setFormato] = useState<Formato>("excel");
  const [conFotos, setConFotos] = useState(true);
  const [progreso, setProgreso] = useState<string | null>(null);

  const exportar = async () => {
    const lista = articulos.data ?? [];
    try {
      setProgreso("Preparando…");
      const informe = prepararInforme(lista, mapa.elementos, autor);
      const fotos = conFotos
        ? await miniaturas(lista, 120, (hechas, total) => setProgreso(`Preparando fotos ${hechas} de ${total}…`))
        : new Map<string, string>();
      setProgreso(`Creando el ${FORMATOS[formato].nombre}…`);
      // Logo de la marca y, para el PDF, la letra Poppins
      const marca = await cargarMarca(formato === "pdf");
      const nombre = nombreFichero(informe.fecha);
      if (formato === "excel") {
        const { crearExcel } = await import("./excel");
        const datos = await crearExcel(informe, fotos, marca.logo);
        descargar(new Blob([datos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${nombre}.xlsx`);
      } else {
        const { crearPdf } = await import("./pdf");
        descargar(new Blob([crearPdf(informe, fotos, marca)], { type: "application/pdf" }), `${nombre}.pdf`);
      }
      toast.success(`${FORMATOS[formato].nombre} descargado`, { description: `${nombre}.${formato === "excel" ? "xlsx" : "pdf"}` });
      onCerrar();
    } catch (err) {
      toast.error("No se ha podido exportar", { description: (err as Error).message });
    } finally {
      setProgreso(null);
    }
  };

  const listo = !articulos.isLoading && !mapa.cargando;

  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && !progreso && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar el stock</DialogTitle>
          <DialogDescription>
            Todo lo que hay ahora: {articulos.data?.length ?? "…"} artículos, cuánto hay de cada uno y en qué zona está.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" role="radiogroup" aria-label="Formato">
          {(Object.keys(FORMATOS) as Formato[]).map((f) => {
            const { nombre, texto, icono: Icono, color } = FORMATOS[f];
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={formato === f}
                onClick={() => setFormato(f)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border-2 p-3 text-left transition",
                  formato === f ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
                )}
              >
                <Icono className={cn("mt-0.5 h-7 w-7 shrink-0", color)} />
                <span>
                  <span className="block font-semibold">{nombre}</span>
                  <span className="block text-sm text-muted-foreground">{texto}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="exportar-fotos" checked={conFotos} onCheckedChange={(v) => setConFotos(v === true)} />
          <Label htmlFor="exportar-fotos" className="font-normal">
            Incluir las fotos de los artículos
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCerrar} disabled={!!progreso}>
            Cancelar
          </Button>
          <Button onClick={exportar} disabled={!listo || !!progreso} className="min-w-40">
            {progreso ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {progreso}
              </>
            ) : (
              `Descargar ${FORMATOS[formato].nombre}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
