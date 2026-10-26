import { createClient } from '@supabase/supabase-js';
import { autorActual, codificarAutor } from '@/lib/autor';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Faltan variables de Supabase. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env o Vercel.',
  );
}

/** Las peticiones a la base de datos llevan quién las hace: así lo apunta el historial. */
const fetchConAutor: typeof fetch = (entrada: RequestInfo | URL, opciones: RequestInit = {}) => {
  const autor = autorActual();
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  if (!autor || !url.includes('/rest/v1/')) return fetch(entrada, opciones);
  const cabeceras = new Headers(opciones.headers);
  cabeceras.set('x-autor', codificarAutor(autor));
  return fetch(entrada, { ...opciones, headers: cabeceras });
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: fetchConAutor },
});
