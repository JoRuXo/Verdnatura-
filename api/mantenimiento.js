// Tarea diaria (la lanza el cron de Vercel, ver vercel.json): llama al
// «latido» de la base de datos para que el proyecto gratuito de Supabase no se
// pause por falta de uso (se pausa tras 7 días sin actividad).
//
// No lee datos: la base de datos solo se abre a quien entra con su usuario.
// La copia de seguridad la hace la propia base de datos cada noche (tabla
// copias_seguridad, ver supabase/migrations/20261027050000_usuarios.sql).

export async function GET() {
  const url = process.env.VITE_SUPABASE_URL;
  const clave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return Response.json({ ok: false, error: "Faltan las variables de Supabase" }, { status: 500 });

  try {
    const r = await fetch(`${url}/rest/v1/rpc/latido`, {
      method: "POST",
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) throw new Error(`latido: ${r.status} ${await r.text()}`);
    return Response.json({ ok: true, hora: await r.json() });
  } catch (err) {
    console.error("Mantenimiento fallido", err);
    return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 502 });
  }
}
