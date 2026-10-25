-- Esquema inicial de Verdnatura Stock
-- Artículos, estanterías (con pasillo/posición en el mapa), huecos (ubicaciones),
-- palets apilados por hueco e historial de movimientos.

-- Trigger genérico updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Artículos
CREATE TABLE public.articulos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT,
  descripcion TEXT,
  proveedor TEXT,
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  cajas INTEGER NOT NULL DEFAULT 0,
  unidades_por_caja INTEGER NOT NULL DEFAULT 0,
  fecha DATE,
  lote TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estanterías (pasillo + posición = sitio en el mapa)
CREATE TABLE public.estanterias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  pasillo INTEGER,
  posicion INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX estanterias_pasillo_posicion_uidx
  ON public.estanterias(pasillo, posicion)
  WHERE pasillo IS NOT NULL AND posicion IS NOT NULL;

-- Ubicaciones (6 huecos por estantería: arriba/abajo × 3)
CREATE TABLE public.ubicaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estanteria_id UUID NOT NULL REFERENCES public.estanterias(id) ON DELETE CASCADE,
  nivel TEXT NOT NULL CHECK (nivel IN ('arriba','abajo')),
  posicion INTEGER NOT NULL CHECK (posicion BETWEEN 1 AND 3),
  articulo_id UUID REFERENCES public.articulos(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estanteria_id, nivel, posicion)
);

CREATE INDEX idx_ubicaciones_estanteria ON public.ubicaciones(estanteria_id);
CREATE INDEX idx_ubicaciones_articulo ON public.ubicaciones(articulo_id);

-- Palets apilados dentro de cada hueco (slot 1 = abajo, 4 = arriba)
CREATE TABLE public.palets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ubicacion_id UUID NOT NULL REFERENCES public.ubicaciones(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,
  articulo_id UUID REFERENCES public.articulos(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT palets_slot_range CHECK (slot BETWEEN 1 AND 4),
  CONSTRAINT palets_unique_slot UNIQUE (ubicacion_id, slot)
);

CREATE INDEX idx_palets_ubicacion ON public.palets(ubicacion_id);
CREATE INDEX idx_palets_articulo ON public.palets(articulo_id);

-- Historial de movimientos
CREATE TABLE public.movimientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('mover','editar_cantidad','crear','eliminar','vaciar')),
  descripcion TEXT NOT NULL,
  articulo_id UUID REFERENCES public.articulos(id) ON DELETE SET NULL,
  articulo_nombre TEXT,
  cantidad_antes INTEGER,
  cantidad_despues INTEGER,
  ubicacion_origen TEXT,
  ubicacion_destino TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movimientos_created_at ON public.movimientos(created_at DESC);
CREATE INDEX idx_movimientos_articulo ON public.movimientos(articulo_id);

-- Triggers updated_at
CREATE TRIGGER update_articulos_updated_at BEFORE UPDATE ON public.articulos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ubicaciones_updated_at BEFORE UPDATE ON public.ubicaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_palets_updated_at BEFORE UPDATE ON public.palets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: acceso abierto por ahora (sin login) - se sustituirá al añadir usuarios
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estanterias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read articulos" ON public.articulos FOR SELECT USING (true);
CREATE POLICY "Public insert articulos" ON public.articulos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update articulos" ON public.articulos FOR UPDATE USING (true);
CREATE POLICY "Public delete articulos" ON public.articulos FOR DELETE USING (true);

CREATE POLICY "Public read estanterias" ON public.estanterias FOR SELECT USING (true);
CREATE POLICY "Public insert estanterias" ON public.estanterias FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update estanterias" ON public.estanterias FOR UPDATE USING (true);
CREATE POLICY "Public delete estanterias" ON public.estanterias FOR DELETE USING (true);

CREATE POLICY "Public read ubicaciones" ON public.ubicaciones FOR SELECT USING (true);
CREATE POLICY "Public insert ubicaciones" ON public.ubicaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ubicaciones" ON public.ubicaciones FOR UPDATE USING (true);
CREATE POLICY "Public delete ubicaciones" ON public.ubicaciones FOR DELETE USING (true);

CREATE POLICY "Public read palets" ON public.palets FOR SELECT USING (true);
CREATE POLICY "Public insert palets" ON public.palets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update palets" ON public.palets FOR UPDATE USING (true);
CREATE POLICY "Public delete palets" ON public.palets FOR DELETE USING (true);

CREATE POLICY "Public read movimientos" ON public.movimientos FOR SELECT USING (true);
CREATE POLICY "Public insert movimientos" ON public.movimientos FOR INSERT WITH CHECK (true);

-- Crear una estantería con sus 6 huecos
CREATE OR REPLACE FUNCTION public.crear_estanteria_con_ubicaciones(
  p_nombre TEXT,
  p_descripcion TEXT DEFAULT NULL,
  p_pasillo INTEGER DEFAULT NULL,
  p_posicion INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_nivel TEXT;
  v_pos INTEGER;
BEGIN
  INSERT INTO public.estanterias (nombre, descripcion, pasillo, posicion)
    VALUES (p_nombre, p_descripcion, p_pasillo, p_posicion)
    RETURNING id INTO v_id;
  FOREACH v_nivel IN ARRAY ARRAY['arriba','abajo'] LOOP
    FOR v_pos IN 1..3 LOOP
      INSERT INTO public.ubicaciones (estanteria_id, nivel, posicion)
        VALUES (v_id, v_nivel, v_pos);
    END LOOP;
  END LOOP;
  RETURN v_id;
END;
$function$;
