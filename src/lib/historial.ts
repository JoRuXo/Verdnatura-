import { supabase } from "@/integrations/supabase/client";

export type TipoMovimiento =
  | "mover"
  | "editar_cantidad"
  | "crear"
  | "eliminar"
  | "vaciar";

export interface Movimiento {
  tipo: TipoMovimiento;
  descripcion: string;
  articulo_id?: string | null;
  articulo_nombre?: string | null;
  cantidad_antes?: number | null;
  cantidad_despues?: number | null;
  ubicacion_origen?: string | null;
  ubicacion_destino?: string | null;
}

/**
 * Registra un movimiento en el historial.
 * Los errores son silenciosos para no interrumpir el flujo principal.
 */
export async function logMovimiento(m: Movimiento): Promise<void> {
  try {
    await supabase.from("movimientos").insert(m);
  } catch {
    // No interrumpir el flujo principal
  }
}
