import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Quién ha entrado en la app. Cada persona tiene su usuario (correo y
// contraseña de Supabase Auth) y un perfil con su nombre, que es el que apunta
// el historial, y su rol.

export type Rol = "admin" | "equipo";

export type Perfil = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
};

export type EstadoSesion =
  | { estado: "cargando" }
  | { estado: "fuera" }
  /** Ha entrado, pero su usuario no tiene perfil o se le ha quitado el acceso. */
  | { estado: "sin-acceso"; email: string }
  | { estado: "dentro"; perfil: Perfil };

type Contexto = EstadoSesion & {
  entrar: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
};

const ContextoSesion = createContext<Contexto | null>(null);

const aPerfil = (f: { id: string; nombre: string; email: string; rol: string; activo: boolean }): Perfil => ({
  ...f,
  rol: f.rol === "admin" ? "admin" : "equipo",
});

async function leerPerfil(sesion: Session): Promise<EstadoSesion> {
  const { data, error } = await supabase.from("perfiles").select("id, nombre, email, rol, activo").eq("id", sesion.user.id).maybeSingle();
  if (error) throw error;
  if (!data || !data.activo) return { estado: "sin-acceso", email: sesion.user.email ?? "" };
  return { estado: "dentro", perfil: aPerfil(data) };
}

/** Mensaje claro para cada fallo al entrar. */
export function mensajeEntrada(error: unknown) {
  const texto = error instanceof Error ? error.message : String(error ?? "");
  const codigo = (error as { code?: string } | null)?.code ?? "";
  if (codigo === "invalid_credentials" || /invalid login credentials/i.test(texto))
    return "El correo o la contraseña no son correctos. Revísalos y vuelve a probar.";
  if (codigo === "user_banned" || /banned/i.test(texto))
    return "Este usuario ya no tiene acceso. Si crees que es un error, habla con un administrador.";
  if (codigo === "over_request_rate_limit" || /rate limit|too many/i.test(texto))
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
  if (/fetch|network|failed to/i.test(texto)) return "No hay conexión. Comprueba que tienes internet y vuelve a probar.";
  return "No se ha podido entrar. Vuelve a probar en un momento.";
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoSesion>({ estado: "cargando" });

  useEffect(() => {
    let vigente = true;
    let ultimoUsuario: string | null = null;

    const aplicar = (sesion: Session | null) => {
      if (!sesion) {
        ultimoUsuario = null;
        queryClient.clear();
        setEstado({ estado: "fuera" });
        return;
      }
      // Al renovar la sesión del mismo usuario no hace falta releer el perfil
      if (sesion.user.id === ultimoUsuario) return;
      ultimoUsuario = sesion.user.id;
      leerPerfil(sesion)
        .then((e) => vigente && setEstado(e))
        .catch(() => vigente && setEstado({ estado: "sin-acceso", email: sesion.user.email ?? "" }));
    };

    // Supabase pide no llamar a la base de datos dentro del aviso: se hace justo después
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      window.setTimeout(() => vigente && aplicar(sesion), 0);
    });
    return () => {
      vigente = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const entrar = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  }, []);

  const salir = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const valor = useMemo<Contexto>(() => ({ ...estado, entrar, salir }), [estado, entrar, salir]);
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const c = useContext(ContextoSesion);
  if (!c) throw new Error("useSesion fuera de ProveedorSesion");
  return c;
}

/** El perfil de quien ha entrado (solo dentro de la app, ya con acceso). */
export function usePerfil(): Perfil {
  const s = useSesion();
  if (s.estado !== "dentro") throw new Error("usePerfil sin haber entrado");
  return s.perfil;
}

export const useEsAdmin = () => usePerfil().rol === "admin";
