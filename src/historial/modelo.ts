import type { Tables } from "@/integrations/supabase/types";

// Historial de cambios: lo escribe la base de datos sola (disparadores), así
// que recoge todo lo que se toca desde cualquier móvil u ordenador.

export type TipoCambio = "stock" | "articulo" | "mapa";
export type Accion = "alta" | "cambio" | "baja" | "traslado";

export type Cambio = {
  id: number;
  fecha: Date;
  autor: string;
  tipo: TipoCambio;
  accion: Accion;
  articuloId: string | null;
  articuloNombre: string;
  unidad: string;
  elementoId: string | null;
  elementoNombre: string;
  antes: number | null;
  despues: number | null;
  detalle: string;
};

export const TIPOS_CAMBIO: Record<TipoCambio, string> = {
  stock: "Cantidades",
  articulo: "Artículos",
  mapa: "Mapa",
};

export const deFila = (f: Tables<"historial">): Cambio => ({
  id: f.id,
  fecha: new Date(f.fecha),
  autor: f.autor,
  tipo: f.tipo as TipoCambio,
  accion: f.accion as Accion,
  articuloId: f.articulo_id,
  articuloNombre: f.articulo_nombre,
  unidad: f.unidad,
  elementoId: f.elemento_id,
  elementoNombre: f.elemento_nombre,
  antes: f.cantidad_antes,
  despues: f.cantidad_despues,
  detalle: f.detalle,
});

/**
 * Cómo se cuenta un cambio en una línea: qué pasó (`texto`), con algo más de
 * detalle si lo hay, y la diferencia de cantidad (+5, −3) si cambió el stock.
 */
export function describir(c: Cambio): { texto: string; detalle: string; diferencia: number | null } {
  const diferencia = c.antes != null && c.despues != null && c.tipo === "stock" ? c.despues - c.antes : null;
  const cantidad = (n: number | null) => `${n ?? 0} ${c.unidad}`.trim();
  switch (c.tipo) {
    case "stock":
      switch (c.accion) {
        case "alta":
          return { texto: `${c.articuloNombre}: puesto en ${c.elementoNombre}`, detalle: cantidad(c.despues), diferencia };
        case "baja":
          return { texto: `${c.articuloNombre}: quitado de ${c.elementoNombre}`, detalle: `tenía ${cantidad(c.antes)}`, diferencia };
        case "traslado":
          return {
            texto: `${c.articuloNombre}: movido a ${c.elementoNombre}`,
            detalle: [c.detalle, c.antes !== c.despues ? `${c.antes} → ${c.despues}` : cantidad(c.despues)].filter(Boolean).join(" · "),
            diferencia: diferencia === 0 ? null : diferencia,
          };
        default:
          return { texto: `${c.articuloNombre} en ${c.elementoNombre}`, detalle: `${c.antes} → ${c.despues} ${c.unidad}`, diferencia };
      }
    case "articulo":
      switch (c.accion) {
        case "alta":
          return { texto: `Artículo nuevo: ${c.articuloNombre}`, detalle: "", diferencia: null };
        case "baja":
          return {
            texto: `Artículo borrado: ${c.articuloNombre}`,
            detalle: c.antes ? `tenía ${cantidad(c.antes)} en total` : "",
            diferencia: null,
          };
        default:
          return { texto: `Ficha de ${c.articuloNombre} cambiada`, detalle: c.detalle, diferencia: null };
      }
    default:
      switch (c.accion) {
        case "alta":
          return { texto: `Mapa: añadido «${c.elementoNombre}»`, detalle: "", diferencia: null };
        case "baja":
          return { texto: `Mapa: borrado «${c.elementoNombre}»`, detalle: c.detalle, diferencia: null };
        default:
          return { texto: `Mapa: cambiado «${c.elementoNombre}»`, detalle: c.detalle, diferencia: null };
      }
  }
}

/** Nombre que se enseña cuando el cambio no lleva autor (hecho desde el panel de Supabase). */
export const nombreAutor = (autor: string) => autor || "Sin nombre";
