import { urlFoto, type Articulo } from "@/articulos/modelo";

/** Foto principal reducida a un cuadrado pequeño (JPEG en data URL), con fondo blanco. */
async function miniatura(url: string, lado: number): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const imagen = await createImageBitmap(await r.blob());
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = lado;
    const g = lienzo.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, lado, lado);
    const escala = Math.min(lado / imagen.width, lado / imagen.height);
    const w = imagen.width * escala;
    const h = imagen.height * escala;
    g.drawImage(imagen, (lado - w) / 2, (lado - h) / 2, w, h);
    imagen.close();
    return lienzo.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

/**
 * Miniaturas de la foto principal de cada artículo, por id de artículo.
 * Se descargan de 6 en 6 para no saturar la conexión del móvil.
 */
export async function miniaturas(articulos: Articulo[], lado = 120, onProgreso?: (hechas: number, total: number) => void) {
  const conFoto = articulos.filter((a) => a.fotos[0]);
  const resultado = new Map<string, string>();
  let hechas = 0;
  for (let i = 0; i < conFoto.length; i += 6) {
    await Promise.all(
      conFoto.slice(i, i + 6).map(async (a) => {
        const datos = await miniatura(urlFoto(a.fotos[0]), lado);
        if (datos) resultado.set(a.id, datos);
        onProgreso?.(++hechas, conFoto.length);
      }),
    );
  }
  return resultado;
}

/** Descarga un fichero generado en el navegador. */
export function descargar(datos: Blob, nombre: string) {
  const url = URL.createObjectURL(datos);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
