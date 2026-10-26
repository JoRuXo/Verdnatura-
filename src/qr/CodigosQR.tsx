import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMapa } from "@/nave/useMapa";
import { TIPOS, agruparPorCategoria } from "@/nave/elementos";

// Etiquetas para pegar en cada zona de la nave: al escanear el QR con el móvil
// se abre esa zona en la app, con lo que hay y los botones para contar.
// En pausa: solo se ve si se activa en src/funciones.ts.

const urlZona = (clave: string) => `${window.location.origin}/zona/${clave}`;

function Etiqueta({ nombre, categoria, tipo, color, url }: { nombre: string; categoria: string; tipo: string; color: string; url: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    void QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then(setSvg);
  }, [url]);
  return (
    <div className="flex break-inside-avoid flex-col overflow-hidden rounded-lg border-2 bg-white text-slate-900" style={{ borderColor: color }}>
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white" style={{ backgroundColor: color }}>
        {categoria || tipo}
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="h-24 w-24 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight">{nombre}</div>
          <div className="mt-1 text-[11px] leading-snug text-slate-500">Escanéalo para ver qué hay aquí y contar.</div>
        </div>
      </div>
    </div>
  );
}

const CodigosQR = () => {
  const mapa = useMapa();
  // Solo tienen etiqueta los sitios donde se guardan artículos
  const zonas = useMemo(() => mapa.elementos.filter((e) => e.almacen), [mapa.elementos]);
  const grupos = useMemo(() => agruparPorCategoria(zonas), [zonas]);
  const [elegidas, setElegidas] = useState<Set<string> | null>(null);
  const seleccion = elegidas ?? new Set(zonas.map((e) => e.id));
  const alternar = (id: string) =>
    setElegidas(() => {
      const s = new Set(seleccion);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 px-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Mapa
            </Link>
          </Button>
          <h1 className="text-lg font-bold">Códigos QR de las zonas</h1>
          <span className="flex-1" />
          <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-4 print:max-w-none print:p-0">
        <details className="rounded-lg border p-3 print:hidden">
          <summary className="cursor-pointer text-sm font-medium">
            Elegir zonas ({seleccion.size} de {zonas.length})
          </summary>
          <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-3">
            {grupos.flatMap((g) =>
              g.zonas.map((z) => (
                <label key={z.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={seleccion.has(z.id)} onCheckedChange={() => alternar(z.id)} />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: z.color }} />
                  {z.nombre}
                </label>
              )),
            )}
          </div>
        </details>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
          {zonas
            .filter((z) => seleccion.has(z.id))
            .map((z) => (
              <Etiqueta key={z.id} nombre={z.nombre} categoria={z.categoria} tipo={TIPOS[z.tipo]} color={z.color} url={urlZona(z.clave)} />
            ))}
        </div>
      </main>
    </div>
  );
};

export default CodigosQR;
