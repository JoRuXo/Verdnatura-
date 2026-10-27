-- Acceso con usuario (2 de 2): la base de datos y las fotos se cierran a quien
-- no haya entrado con un usuario con acceso. Los administradores editan el
-- mapa y borran artículos; el resto del equipo cuenta y edita artículos.

-- ---------------------------------------------------------------------------
-- Artículos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read articulos" ON public.articulos;
DROP POLICY IF EXISTS "Public insert articulos" ON public.articulos;
DROP POLICY IF EXISTS "Public update articulos" ON public.articulos;
DROP POLICY IF EXISTS "Public delete articulos" ON public.articulos;
CREATE POLICY "Ver artículos" ON public.articulos FOR SELECT TO authenticated
  USING (public.es_usuario());
CREATE POLICY "Crear artículos" ON public.articulos FOR INSERT TO authenticated
  WITH CHECK (public.es_usuario());
CREATE POLICY "Cambiar artículos" ON public.articulos FOR UPDATE TO authenticated
  USING (public.es_usuario()) WITH CHECK (public.es_usuario());
CREATE POLICY "Borrar artículos" ON public.articulos FOR DELETE TO authenticated
  USING (public.es_admin());

-- ---------------------------------------------------------------------------
-- Existencias (cuánto hay de cada artículo en cada zona)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read existencias" ON public.existencias;
DROP POLICY IF EXISTS "Public insert existencias" ON public.existencias;
DROP POLICY IF EXISTS "Public update existencias" ON public.existencias;
DROP POLICY IF EXISTS "Public delete existencias" ON public.existencias;
CREATE POLICY "Ver existencias" ON public.existencias FOR SELECT TO authenticated
  USING (public.es_usuario());
CREATE POLICY "Crear existencias" ON public.existencias FOR INSERT TO authenticated
  WITH CHECK (public.es_usuario());
CREATE POLICY "Cambiar existencias" ON public.existencias FOR UPDATE TO authenticated
  USING (public.es_usuario()) WITH CHECK (public.es_usuario());
CREATE POLICY "Borrar existencias" ON public.existencias FOR DELETE TO authenticated
  USING (public.es_usuario());

REVOKE EXECUTE ON FUNCTION public.ajustar_existencia(UUID, INTEGER) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- Mapa: lo ve todo el equipo, lo cambian los administradores
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read elementos_mapa" ON public.elementos_mapa;
DROP POLICY IF EXISTS "Public insert elementos_mapa" ON public.elementos_mapa;
DROP POLICY IF EXISTS "Public update elementos_mapa" ON public.elementos_mapa;
DROP POLICY IF EXISTS "Public delete elementos_mapa" ON public.elementos_mapa;
CREATE POLICY "Ver el mapa" ON public.elementos_mapa FOR SELECT TO authenticated
  USING (public.es_usuario());
CREATE POLICY "Crear en el mapa" ON public.elementos_mapa FOR INSERT TO authenticated
  WITH CHECK (public.es_admin());
CREATE POLICY "Cambiar el mapa" ON public.elementos_mapa FOR UPDATE TO authenticated
  USING (public.es_admin()) WITH CHECK (public.es_admin());
CREATE POLICY "Borrar del mapa" ON public.elementos_mapa FOR DELETE TO authenticated
  USING (public.es_admin());

-- ---------------------------------------------------------------------------
-- Historial (lo escriben los disparadores; aquí solo se lee)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read historial" ON public.historial;
CREATE POLICY "Ver el historial" ON public.historial FOR SELECT TO authenticated
  USING (public.es_usuario());

-- ---------------------------------------------------------------------------
-- Fotos: el bucket deja de ser público; la app pide enlaces firmados
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'fotos-articulos';
DROP POLICY IF EXISTS "Public read fotos-articulos" ON storage.objects;
DROP POLICY IF EXISTS "Public insert fotos-articulos" ON storage.objects;
DROP POLICY IF EXISTS "Public update fotos-articulos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete fotos-articulos" ON storage.objects;
CREATE POLICY "Ver fotos de artículos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-articulos' AND public.es_usuario());
CREATE POLICY "Subir fotos de artículos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-articulos' AND public.es_usuario());
CREATE POLICY "Cambiar fotos de artículos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-articulos' AND public.es_usuario());
CREATE POLICY "Borrar fotos de artículos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-articulos' AND public.es_usuario());

-- Las copias ya no se suben al bucket «copias» (ahora van a copias_seguridad);
-- las que ya estaban se quedan ahí
DROP POLICY IF EXISTS "Subir copias de seguridad" ON storage.objects;

-- ---------------------------------------------------------------------------
-- El historial ya solo apunta el nombre del perfil (la cabecera x-autor sobra)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.autor_peticion()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT p.nombre FROM public.perfiles p WHERE p.id = auth.uid()), '');
$$;
