import { useSyncExternalStore } from "react";

// Quién usa la app en este dispositivo. Aún no hay usuarios con contraseña:
// es el nombre que la persona escribe una vez, y viaja con cada cambio para
// que el historial sepa quién lo hizo.

const CLAVE = "verdnatura-autor";
const oyentes = new Set<() => void>();

function leer() {
  try {
    return localStorage.getItem(CLAVE) ?? "";
  } catch {
    return "";
  }
}

let actual = leer();

export const autorActual = () => actual;

export function cambiarAutor(nombre: string) {
  actual = nombre.trim().replace(/\s+/g, " ").slice(0, 60);
  try {
    localStorage.setItem(CLAVE, actual);
  } catch {
    // Sin almacenamiento (modo privado): vale para esta visita
  }
  oyentes.forEach((f) => f());
}

export function useAutor() {
  return useSyncExternalStore((f) => {
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, autorActual);
}

/** El nombre en UTF-8 y base64: las cabeceras HTTP no admiten tildes ni eñes. */
export function codificarAutor(nombre: string) {
  let binario = "";
  for (const b of new TextEncoder().encode(nombre)) binario += String.fromCharCode(b);
  return btoa(binario);
}

// Diálogo para escribir o cambiar el nombre: se abre solo si no hay nombre,
// o desde el menú («Cambiar de nombre»)
let cambiando = false;
const oyentesDialogo = new Set<() => void>();

export function abrirCambioNombre(abrir = true) {
  cambiando = abrir;
  oyentesDialogo.forEach((f) => f());
}

export function useCambiandoNombre() {
  return useSyncExternalStore(
    (f) => {
      oyentesDialogo.add(f);
      return () => {
        oyentesDialogo.delete(f);
      };
    },
    () => cambiando,
  );
}
