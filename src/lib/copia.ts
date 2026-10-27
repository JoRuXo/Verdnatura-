import { supabase } from "@/integrations/supabase/client";

/**
 * Descarga la última copia de seguridad (se hace cada noche en la base de
 * datos) como un archivo JSON. Solo la pueden leer los administradores.
 * Devuelve la fecha de la copia, o null si todavía no hay ninguna.
 */
export async function descargarCopia() {
  const { data, error } = await supabase
    .from("copias_seguridad")
    .select("fecha, datos")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const archivo = new Blob([JSON.stringify(data.datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `verdnatura-copia-${data.fecha}.json`;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  return data.fecha;
}
