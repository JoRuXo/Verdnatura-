import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Perfil, Rol } from "@/auth/sesion";

// Gestión de usuarios (solo administradores). Las altas, contraseñas y el
// acceso pasan por la función «usuarios» de Supabase, que es la que tiene la
// clave de servicio; el nombre y el rol se cambian directamente en «perfiles».

export const CLAVE_USUARIOS = ["perfiles"] as const;

export const ROLES: Record<Rol, { nombre: string; texto: string }> = {
  admin: { nombre: "Administrador", texto: "Edita el mapa, borra artículos y gestiona usuarios." },
  equipo: { nombre: "Equipo", texto: "Cuenta stock y crea o edita artículos." },
};

export type Usuario = Perfil & { creado: string };

export function useUsuarios() {
  return useQuery({
    queryKey: CLAVE_USUARIOS,
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase.from("perfiles").select("id, nombre, email, rol, activo, creado").order("nombre");
      if (error) throw error;
      return data.map((f) => ({ ...f, rol: f.rol === "admin" ? "admin" : "equipo" }));
    },
  });
}

const FALLO_GENERAL = "No se ha podido hacer el cambio. Vuelve a probar en un momento.";

async function llamar(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("usuarios", { body: cuerpo });
  if (error) {
    // La función devuelve el motivo en la respuesta: es lo que se enseña
    let mensaje = FALLO_GENERAL;
    const respuesta = (error as { context?: Response }).context;
    if (respuesta && typeof respuesta.json === "function") {
      try {
        const j = await respuesta.json();
        if (typeof j?.error === "string") mensaje = j.error;
      } catch {
        // Sin cuerpo legible: mensaje general
      }
    }
    throw new Error(mensaje);
  }
  return data;
}

export const crearUsuario = (datos: { nombre: string; email: string; password: string; rol: Rol }) =>
  llamar({ accion: "crear", ...datos });

export const ponerContrasena = (id: string, password: string) => llamar({ accion: "contrasena", id, password });

export const cambiarAcceso = (id: string, activo: boolean) => llamar({ accion: activo ? "alta" : "baja", id });

export async function editarPerfil(id: string, cambios: { nombre: string; rol: Rol }) {
  const { error } = await supabase
    .from("perfiles")
    .update({ nombre: cambios.nombre.trim().replace(/\s+/g, " "), rol: cambios.rol })
    .eq("id", id);
  if (error) throw new Error(/administrador/i.test(error.message) ? "Tiene que quedar al menos un administrador." : FALLO_GENERAL);
}

/** Contraseña provisional fácil de dictar: «kfrt-4829-mpwa» (sin letras que se confunden). */
export function generarContrasena() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const cifras = "23456789";
  const azar = new Uint32Array(12);
  crypto.getRandomValues(azar);
  const tramo = (desde: number, juego: string) =>
    Array.from(azar.slice(desde, desde + 4), (n) => juego[n % juego.length]).join("");
  return `${tramo(0, letras)}-${tramo(4, cifras)}-${tramo(8, letras)}`;
}
