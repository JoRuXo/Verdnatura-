/**
 * Reduce una foto antes de subirla: lado mayor de 1600 px y JPEG al 82 %.
 * Una foto de móvil pasa de varios MB a unos 200–400 KB, que el plan gratuito
 * de Supabase tiene 1 GB de almacenamiento.
 */
export async function comprimirImagen(archivo: File, ladoMax = 1600, calidad = 0.82): Promise<Blob> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    // Formato que el navegador no sabe abrir: se sube tal cual
    return archivo;
  }
  const escala = Math.min(1, ladoMax / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const g = lienzo.getContext("2d");
  if (!g) return archivo;
  // Fondo blanco: las transparencias de un PNG saldrían negras en JPEG
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, lienzo.width, lienzo.height);
  g.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return new Promise((resolver) => lienzo.toBlob((b) => resolver(b ?? archivo), "image/jpeg", calidad));
}
