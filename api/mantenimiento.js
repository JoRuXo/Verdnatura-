// Tarea diaria de mantenimiento (la lanza el cron de Vercel, ver vercel.json):
// 1. Lee la base de datos, y así el proyecto gratuito de Supabase no se pausa
//    por falta de uso (se pausa tras 7 días sin actividad).
// 2. Guarda una copia de seguridad de todo en el bucket privado «copias»
//    (un JSON por día). Se descargan desde el panel de Supabase.

const TABLAS = ["elementos_mapa", "articulos", "existencias", "historial"];
const POR_PAGINA = 1000;

async function leerTabla(url, cabeceras, tabla) {
  const filas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const r = await fetch(`${url}/rest/v1/${tabla}?select=*&order=id&limit=${POR_PAGINA}&offset=${desde}`, { headers: cabeceras });
    if (!r.ok) throw new Error(`${tabla}: ${r.status} ${await r.text()}`);
    const pagina = await r.json();
    filas.push(...pagina);
    if (pagina.length < POR_PAGINA) return filas;
  }
}

export async function GET() {
  const url = process.env.VITE_SUPABASE_URL;
  const clave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return Response.json({ ok: false, error: "Faltan las variables de Supabase" }, { status: 500 });
  const cabeceras = { apikey: clave, Authorization: `Bearer ${clave}` };

  try {
    const fecha = new Date().toISOString();
    const copia = { fecha };
    const filas = {};
    for (const tabla of TABLAS) {
      copia[tabla] = await leerTabla(url, cabeceras, tabla);
      filas[tabla] = copia[tabla].length;
    }

    const nombre = `${fecha.slice(0, 10)}.json`;
    const subida = await fetch(`${url}/storage/v1/object/copias/${nombre}`, {
      method: "POST",
      headers: { ...cabeceras, "Content-Type": "application/json" },
      body: JSON.stringify(copia),
    });
    const respuesta = await subida.json().catch(() => ({}));
    // Si ya había copia de hoy (el cron puede repetirse), no es un error
    const yaEstaba = String(respuesta.statusCode) === "409";
    if (!subida.ok && !yaEstaba) throw new Error(`copia: ${subida.status} ${JSON.stringify(respuesta)}`);

    return Response.json({ ok: true, copia: nombre, nueva: !yaEstaba, filas });
  } catch (err) {
    console.error("Mantenimiento fallido", err);
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 502 });
  }
}
