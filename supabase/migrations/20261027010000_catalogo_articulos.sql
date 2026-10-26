-- Catálogo de artículos con fotos y características libres, y cantidades por
-- zona del mapa (existencias). Sustituye a las tablas del primer diseño
-- (articulos, estanterias, ubicaciones, palets, movimientos), que estaban
-- vacías y ya no usa la app.

DROP FUNCTION IF EXISTS public.crear_estanteria_con_ubicaciones(TEXT, TEXT, INTEGER, INTEGER);
DROP TABLE IF EXISTS public.movimientos, public.palets, public.ubicaciones, public.estanterias, public.articulos CASCADE;

-- Artículos: lo que tenemos (carros, cartón, film, etiquetas...)
CREATE TABLE public.articulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  -- En qué se cuenta: carros, cajas, rollos, palets...
  unidad TEXT NOT NULL DEFAULT 'unidades',
  -- Características libres: [{"nombre": "Medidas", "valor": "120 × 80 cm"}, ...]
  caracteristicas JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Rutas de las fotos en el bucket "fotos-articulos"; la primera es la principal
  fotos TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existencias: cuántos hay de cada artículo en cada zona del mapa.
-- Si se borra la zona del mapa, la cantidad se queda "sin ubicar" en vez de perderse.
CREATE TABLE public.existencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  articulo_id UUID NOT NULL REFERENCES public.articulos(id) ON DELETE CASCADE,
  elemento_id UUID REFERENCES public.elementos_mapa(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  nota TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_existencias_articulo ON public.existencias(articulo_id);
CREATE INDEX idx_existencias_elemento ON public.existencias(elemento_id);

CREATE TRIGGER update_articulos_updated_at BEFORE UPDATE ON public.articulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_existencias_updated_at BEFORE UPDATE ON public.existencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: acceso abierto por ahora (sin login), como el resto de tablas
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.existencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read articulos" ON public.articulos FOR SELECT USING (true);
CREATE POLICY "Public insert articulos" ON public.articulos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update articulos" ON public.articulos FOR UPDATE USING (true);
CREATE POLICY "Public delete articulos" ON public.articulos FOR DELETE USING (true);

CREATE POLICY "Public read existencias" ON public.existencias FOR SELECT USING (true);
CREATE POLICY "Public insert existencias" ON public.existencias FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update existencias" ON public.existencias FOR UPDATE USING (true);
CREATE POLICY "Public delete existencias" ON public.existencias FOR DELETE USING (true);

-- Fotos de los artículos: bucket público, solo imágenes de hasta 10 MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-articulos', 'fotos-articulos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read fotos-articulos" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-articulos');
CREATE POLICY "Public insert fotos-articulos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fotos-articulos');
CREATE POLICY "Public update fotos-articulos" ON storage.objects FOR UPDATE USING (bucket_id = 'fotos-articulos');
CREATE POLICY "Public delete fotos-articulos" ON storage.objects FOR DELETE USING (bucket_id = 'fotos-articulos');

-- Primer artículo: el carro CC de la foto del usuario (la foto se sube aparte a carros/carro-cc.png)
INSERT INTO public.articulos (nombre, categoria, descripcion, unidad, fotos)
VALUES (
  'Carro CC',
  'Carros',
  'Carro danés de Container Centralen, con baldas. Todos son iguales: se cuentan los que hay apilados en cada zona.',
  'carros',
  ARRAY['carros/carro-cc.png']
);
