import regular from "./fuentes/Poppins-Regular.ttf?url";
import negrita from "./fuentes/Poppins-Bold.ttf?url";

// Lo que llevan de la marca el Excel y el PDF: el logo con «Verd» en blanco
// (va sobre la banda negra) y, para el PDF, la letra Poppins incrustada.

export type RecursosMarca = {
  /** Logo en PNG como data URL. */
  logo?: string;
  /** Poppins en TTF y base64 (solo hace falta en el PDF). */
  fuentes?: { normal: string; negrita: string };
};

/** Proporción del logo (ancho / alto). */
export const PROPORCION_LOGO = 298 / 44;

const base64 = (datos: ArrayBuffer) => {
  const bytes = new Uint8Array(datos);
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto);
};

const leer = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se ha podido cargar ${url}`);
  return r.arrayBuffer();
};

export async function cargarMarca(conFuentes: boolean): Promise<RecursosMarca> {
  const [logo, fuentes] = await Promise.all([
    leer("/marca/logo-verdnatura-blanco.png").then((d) => `data:image/png;base64,${base64(d)}`),
    conFuentes
      ? Promise.all([leer(regular), leer(negrita)]).then(([n, b]) => ({ normal: base64(n), negrita: base64(b) }))
      : Promise.resolve(undefined),
  ]);
  return { logo, fuentes };
}
