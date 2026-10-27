// Función «usuarios»: altas y cambios de usuarios desde la página Usuarios de
// la app. Solo la pueden usar los administradores: comprueba quién llama y usa
// la clave de servicio, que no sale de Supabase.
//
// Acciones (POST, JSON):
//   { accion: "crear", nombre, email, password, rol }
//   { accion: "contrasena", id, password }
//   { accion: "baja", id }   quita el acceso (no se borra: su nombre sigue en el historial)
//   { accion: "alta", id }   lo devuelve
//
// Se despliega desde el panel de Supabase (Edge Functions) con «Verify JWT»
// apagado: la comprobación de quién llama la hace la propia función.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });
const fallo = (error: string, estado = 400) => responder({ error }, estado);

/** La clave de servicio: la de siempre o, en proyectos con claves nuevas, la secreta por defecto. */
function claveServicio(): string | null {
  const directa = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (directa) return directa;
  const nuevas = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!nuevas) return null;
  try {
    const claves: unknown = JSON.parse(nuevas);
    const lista = Array.isArray(claves) ? claves : Object.entries(claves as Record<string, unknown>).sort(([a]) => (a === "default" ? -1 : 1)).map(([, v]) => v);
    for (const c of lista) {
      if (typeof c === "string" && c) return c;
      const k = (c as { api_key?: string; key?: string } | null)?.api_key ?? (c as { key?: string } | null)?.key;
      if (k) return k;
    }
    return null;
  } catch {
    return nuevas.startsWith("sb_secret_") ? nuevas : null;
  }
}

const ROLES = ["admin", "equipo"];
const PARA_SIEMPRE = "876000h"; // unos 100 años
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fallo("Método no permitido", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const clave = claveServicio();
  if (!url || !clave) return fallo("Falta la configuración del servidor", 500);
  const admin = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });

  // Quién llama: tiene que haber entrado y ser administrador con acceso
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: sesion } = await admin.auth.getUser(token);
  const yo = sesion?.user;
  if (!yo) return fallo("Tienes que entrar en la app", 401);
  const { data: perfil } = await admin.from("perfiles").select("rol, activo").eq("id", yo.id).maybeSingle();
  if (!perfil?.activo || perfil.rol !== "admin") return fallo("Solo los administradores pueden gestionar usuarios", 403);

  let datos: Record<string, unknown>;
  try {
    datos = await req.json();
  } catch {
    return fallo("Petición no válida");
  }
  const id = texto(datos.id);
  const password = typeof datos.password === "string" ? datos.password : "";

  switch (datos.accion) {
    case "crear": {
      const nombre = texto(datos.nombre).replace(/\s+/g, " ");
      const email = texto(datos.email).toLowerCase();
      const rol = ROLES.includes(datos.rol as string) ? (datos.rol as string) : "equipo";
      if (nombre.length < 2 || nombre.length > 60) return fallo("El nombre tiene que tener entre 2 y 60 letras.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fallo("Ese correo no es válido. Revísalo.");
      if (password.length < 8) return fallo("La contraseña tiene que tener al menos 8 caracteres.");

      const { data: nuevo, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre },
      });
      if (error || !nuevo.user) {
        const repetido = /already|registered|exists/i.test(error?.message ?? "");
        return fallo(repetido ? "Ya hay un usuario con ese correo." : `No se ha podido crear el usuario: ${error?.message}`);
      }
      const { error: errorPerfil } = await admin.from("perfiles").insert({ id: nuevo.user.id, nombre, email, rol });
      if (errorPerfil) {
        await admin.auth.admin.deleteUser(nuevo.user.id);
        return fallo(`No se ha podido crear el usuario: ${errorPerfil.message}`);
      }
      return responder({ id: nuevo.user.id });
    }

    case "contrasena": {
      if (!id) return fallo("Falta el usuario.");
      if (password.length < 8) return fallo("La contraseña tiene que tener al menos 8 caracteres.");
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return fallo(`No se ha podido cambiar la contraseña: ${error.message}`);
      return responder({ ok: true });
    }

    case "baja":
    case "alta": {
      if (!id) return fallo("Falta el usuario.");
      const baja = datos.accion === "baja";
      if (baja && id === yo.id) return fallo("No puedes quitarte el acceso a ti mismo.");
      // Primero el perfil: si es el último administrador, la base de datos no deja
      const { error: errorPerfil } = await admin.from("perfiles").update({ activo: !baja }).eq("id", id);
      if (errorPerfil) {
        const ultimo = /administrador/i.test(errorPerfil.message);
        return fallo(ultimo ? "Tiene que quedar al menos un administrador." : errorPerfil.message);
      }
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: baja ? PARA_SIEMPRE : "none" });
      if (error) {
        await admin.from("perfiles").update({ activo: baja }).eq("id", id);
        return fallo(`No se ha podido cambiar el acceso: ${error.message}`);
      }
      return responder({ ok: true });
    }

    default:
      return fallo("Acción desconocida.");
  }
});
