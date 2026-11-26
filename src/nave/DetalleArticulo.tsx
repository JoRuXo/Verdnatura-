import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlignLeft, Images, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { total, UNIDADES, type Articulo, type Existencia } from "@/articulos/modelo";
import { CLAVE_ARTICULOS, cambiarNota, colocarCaja, ConflictoError, guardarArticulo } from "@/articulos/useArticulos";
import { ContadorCantidad, Miniatura } from "./ControlesArticulo";
import { TextoEditable } from "./TextoEditable";
import { baldaValida, nombreBalda, numeroBaldas } from "./armario";
import type { Elemento } from "./elementos";

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      {children}
    </div>
  );
}

/**
 * Lo que se ha tocado en la ventana de una zona: el artículo, editable
 * escribiendo encima (se guarda al salir de cada campo), su cantidad aquí y la
 * nota de esta caja. Lo demás (fotos, características, otras zonas, borrar) en
 * la ficha completa.
 */
export function DetalleArticulo({
  a,
  existencia,
  zona,
  categorias,
  onMasOpciones,
}: {
  a: Articulo;
  existencia: Existencia;
  zona: Elemento;
  categorias: string[];
  onMasOpciones: () => void;
}) {
  const queryClient = useQueryClient();
  const esArmario = zona.tipo === "estanteria" && zona.modelo === "informatica";
  const cambiarEnCache = (f: (x: Articulo) => Articulo) =>
    queryClient.setQueryData<Articulo[]>(CLAVE_ARTICULOS, (lista) => lista?.map((x) => (x.id === a.id ? f(x) : x)));

  /** Guarda unos campos del artículo; si otra persona ha cambiado eso mismo, avisa y no guarda. */
  const guardar = async (cambios: Partial<Pick<Articulo, "nombre" | "descripcion" | "categoria" | "unidad">>) => {
    try {
      await guardarArticulo({ ...a, ...cambios }, a, (id) => (id === zona.id ? zona.nombre : "otra zona"));
      cambiarEnCache((x) => ({ ...x, ...cambios }));
    } catch (err) {
      if (err instanceof ConflictoError) {
        toast.warning("Otra persona acaba de cambiar este artículo", { description: `${err.detalles.join(" ")} Ya ves lo de ahora.` });
        void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      } else toast.error(`No se ha podido guardar ${a.nombre}`, { description: (err as Error).message });
      throw err;
    }
  };

  const guardarNota = async (nota: string) => {
    try {
      const guardada = await cambiarNota(existencia.id, existencia.nota, nota);
      if (guardada == null) {
        toast.warning("Otra persona acaba de cambiar esta nota", { description: "Ya ves la de ahora." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
        throw new Error("conflicto");
      }
      cambiarEnCache((x) => ({ ...x, existencias: x.existencias.map((e) => (e.id === existencia.id ? { ...e, nota: guardada } : e)) }));
    } catch (err) {
      if ((err as Error).message !== "conflicto") toast.error("No se ha podido guardar la nota", { description: (err as Error).message });
      throw err;
    }
  };

  const colocarSola = async () => {
    const antes = { balda: existencia.balda, posicion: existencia.posicion };
    const nuevo = { balda: existencia.balda, posicion: null };
    cambiarEnCache((x) => ({ ...x, existencias: x.existencias.map((e) => (e.id === existencia.id ? { ...e, posicion: null } : e)) }));
    try {
      if (!(await colocarCaja(existencia.id, antes, nuevo))) {
        toast.warning(`Alguien acaba de mover ${a.nombre}`, { description: "Ya ves dónde está ahora." });
        void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
      }
    } catch (err) {
      toast.error(`No se ha podido mover ${a.nombre}`, { description: (err as Error).message });
      void queryClient.invalidateQueries({ queryKey: CLAVE_ARTICULOS });
    }
  };

  const otrosSitios = a.existencias.filter((e) => e.id !== existencia.id && e.cantidad > 0).length;
  const baldas = numeroBaldas(zona.baldas);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Miniatura a={a} grande />
        <div className="min-w-0 flex-1 pr-4">
          <TextoEditable
            valor={a.nombre}
            obligatorio
            etiqueta="Nombre del artículo"
            className="text-lg font-semibold leading-tight"
            onGuardar={(nombre) => guardar({ nombre })}
          />
          <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs">
            <TextoEditable
              valor={a.categoria}
              etiqueta="Categoría"
              placeholder="Sin categoría"
              sugerencias={categorias}
              className="text-muted-foreground"
              onGuardar={(categoria) => guardar({ categoria })}
            />
            <TextoEditable
              valor={a.unidad}
              obligatorio
              etiqueta="En qué se cuenta"
              sugerencias={UNIDADES}
              className="text-muted-foreground"
              onGuardar={(unidad) => guardar({ unidad })}
            />
          </div>
        </div>
      </div>

      <Campo etiqueta="Descripción">
        <TextoEditable
          valor={a.descripcion}
          multilinea
          etiqueta="Descripción del artículo"
          placeholder="Añade una descripción: qué es, para qué sirve, cómo reconocerlo…"
          className="text-sm"
          onGuardar={(descripcion) => guardar({ descripcion })}
        />
      </Campo>

      <Campo etiqueta={`Cuántas hay en ${zona.nombre}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ContadorCantidad a={a} existencia={existencia} grande />
          {otrosSitios > 0 && (
            <span className="text-xs text-muted-foreground">
              {total(a)} {a.unidad} en total, también en {otrosSitios} {otrosSitios === 1 ? "sitio más" : "sitios más"}
            </span>
          )}
        </div>
      </Campo>

      <Campo etiqueta={esArmario ? "Nota de esta caja" : "Nota de aquí"}>
        <TextoEditable
          valor={existencia.nota}
          multilinea
          etiqueta="Nota de esta caja"
          placeholder={esArmario ? "Algo de esta caja en concreto: si está abierta, qué le falta…" : "Algo de lo que hay aquí en concreto…"}
          className="text-sm"
          onGuardar={guardarNota}
        />
      </Campo>

      {esArmario && (
        <Campo etiqueta="Dónde está">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              {nombreBalda(baldaValida(existencia.balda, baldas), baldas)}
              <span className="text-muted-foreground"> · {existencia.posicion == null ? "colocada sola" : "colocada a mano"}</span>
            </span>
            {existencia.posicion != null && (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void colocarSola()}>
                <Wand2 className="h-3.5 w-3.5" /> Que se coloque sola
              </Button>
            )}
          </div>
        </Campo>
      )}

      <Button variant="outline" className="w-full gap-2" onClick={onMasOpciones}>
        <Images className="h-4 w-4" /> Fotos, características y más…
      </Button>
      {!a.descripcion && !existencia.nota && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlignLeft className="h-3.5 w-3.5 shrink-0" />
          Toca cualquier texto para cambiarlo; se guarda solo.
        </p>
      )}
    </div>
  );
}
