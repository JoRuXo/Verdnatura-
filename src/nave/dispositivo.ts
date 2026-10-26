/** Equipos táctiles pequeños (móvil, tablet pequeña): sin sombras ni animación continua. */
export function esGamaLigera() {
  if (typeof window === "undefined") return false;
  const tactil = window.matchMedia("(pointer: coarse)").matches;
  return tactil && Math.min(window.screen.width, window.screen.height) < 900;
}
