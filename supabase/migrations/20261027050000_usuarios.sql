-- Acceso con usuario (1 de 2): usuarios con su perfil, copias de seguridad
-- dentro de la base de datos y el latido que evita la pausa de Supabase.
-- No cierra nada todavía: eso va en 20261027060000_cerrar_acceso.sql, que se
-- aplica cuando la app con pantalla de entrada ya está publicada.

-- ---------------------------------------------------------------------------
-- Perfiles: quién puede entrar, con qué nombre (sale en el historial) y rol.
-- Las cuentas (correo y contraseña) son de Supabase Auth; las crea la función
-- «usuarios» desde la página Usuarios de la app.
-- ---------------------------------------------------------------------------
CREATE TABLE public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (length(btrim(nombre)) BETWEEN 2 AND 60),
  email TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'equipo' CHECK (rol IN ('admin', 'equipo')),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

/** Quien hace la petición ha entrado y tiene acceso. */
CREATE OR REPLACE FUNCTION public.es_usuario()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND activo);
$$;

/** Quien hace la petición es administrador (edita el mapa, borra, gestiona usuarios). */
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND activo AND rol = 'admin');
$$;

CREATE POLICY "Ver perfiles" ON public.perfiles FOR SELECT TO authenticated
  USING (public.es_usuario());
CREATE POLICY "Cambiar perfiles" ON public.perfiles FOR UPDATE TO authenticated
  USING (public.es_admin()) WITH CHECK (public.es_admin());
-- Altas: solo la función «usuarios», que usa la clave de servicio

-- Que nunca se quede la app sin administrador
CREATE OR REPLACE FUNCTION public.queda_un_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE rol = 'admin' AND activo) THEN
    RAISE EXCEPTION 'Tiene que quedar al menos un administrador';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER queda_un_admin
AFTER UPDATE OR DELETE ON public.perfiles
FOR EACH STATEMENT EXECUTE FUNCTION public.queda_un_admin();

-- ---------------------------------------------------------------------------
-- El historial apunta el nombre del perfil de quien ha entrado. Mientras la
-- app antigua siga abierta en algún móvil, vale también el nombre que manda
-- en la cabecera x-autor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.autor_peticion()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nombre_perfil TEXT;
  cabecera TEXT;
BEGIN
  SELECT p.nombre INTO nombre_perfil FROM public.perfiles p WHERE p.id = auth.uid();
  IF nombre_perfil IS NOT NULL THEN
    RETURN nombre_perfil;
  END IF;
  cabecera := current_setting('request.headers', true)::json ->> 'x-autor';
  IF cabecera IS NULL OR cabecera = '' THEN
    RETURN '';
  END IF;
  RETURN left(btrim(convert_from(decode(cabecera, 'base64'), 'UTF8')), 60);
EXCEPTION WHEN others THEN
  RETURN '';
END;
$$;

-- ---------------------------------------------------------------------------
-- Copias de seguridad: cada noche (03:17 UTC) una copia de todo en esta
-- tabla, una por día, y se guardan las de los últimos 30 días. Solo los
-- administradores las descargan (menú → «Descargar copia de seguridad»).
-- ---------------------------------------------------------------------------
CREATE TABLE public.copias_seguridad (
  fecha DATE PRIMARY KEY DEFAULT current_date,
  creada TIMESTAMPTZ NOT NULL DEFAULT now(),
  datos JSONB NOT NULL
);
ALTER TABLE public.copias_seguridad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Descargar copias" ON public.copias_seguridad FOR SELECT TO authenticated
  USING (public.es_admin());

CREATE OR REPLACE FUNCTION public.hacer_copia()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.copias_seguridad (fecha, datos)
  SELECT current_date, jsonb_build_object(
    'fecha', now(),
    'elementos_mapa', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.orden), '[]'::jsonb) FROM public.elementos_mapa t),
    'articulos', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nombre), '[]'::jsonb) FROM public.articulos t),
    'existencias', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.existencias t),
    'historial', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.historial t),
    'perfiles', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'email', t.email, 'rol', t.rol, 'activo', t.activo) ORDER BY t.nombre), '[]'::jsonb) FROM public.perfiles t)
  )
  ON CONFLICT (fecha) DO UPDATE SET datos = EXCLUDED.datos, creada = now();
  DELETE FROM public.copias_seguridad WHERE fecha < current_date - 30;
END;
$$;
REVOKE ALL ON FUNCTION public.hacer_copia() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('copia-nocturna', '17 3 * * *', 'SELECT public.hacer_copia()');

-- ---------------------------------------------------------------------------
-- Latido: el cron de Vercel lo llama cada día para que el proyecto gratuito
-- de Supabase no se pause por falta de uso. No devuelve ningún dato.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.latido()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;
GRANT EXECUTE ON FUNCTION public.latido() TO anon, authenticated;
