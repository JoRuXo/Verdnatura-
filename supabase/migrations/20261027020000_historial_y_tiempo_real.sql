-- Historial de cambios (quién cambió qué y cuándo), stock mínimo, ajuste
-- atómico de cantidades, cambios en tiempo real y copias de seguridad diarias.

-- ---------------------------------------------------------------------------
-- Stock mínimo por artículo (opcional): por debajo, el artículo sale en aviso
-- ---------------------------------------------------------------------------
ALTER TABLE public.articulos
  ADD COLUMN IF NOT EXISTS stock_minimo INTEGER CHECK (stock_minimo IS NULL OR stock_minimo >= 0);

-- ---------------------------------------------------------------------------
-- Historial: lo escriben solo los disparadores de esta migración
-- ---------------------------------------------------------------------------
CREATE TABLE public.historial (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Nombre que la persona puso en la app (aún no hay usuarios con contraseña)
  autor TEXT NOT NULL DEFAULT '',
  -- stock: cantidades por zona · articulo: ficha del artículo · mapa: zonas y objetos
  tipo TEXT NOT NULL CHECK (tipo IN ('stock', 'articulo', 'mapa')),
  -- alta, cambio, baja o traslado
  accion TEXT NOT NULL,
  -- Sin claves foráneas: el historial se conserva aunque se borre el artículo o la zona
  articulo_id UUID,
  articulo_nombre TEXT NOT NULL DEFAULT '',
  unidad TEXT NOT NULL DEFAULT '',
  elemento_id UUID,
  elemento_nombre TEXT NOT NULL DEFAULT '',
  cantidad_antes INTEGER,
  cantidad_despues INTEGER,
  detalle TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_historial_fecha ON public.historial (fecha DESC);
CREATE INDEX idx_historial_articulo ON public.historial (articulo_id, fecha DESC);
CREATE INDEX idx_historial_elemento ON public.historial (elemento_id, fecha DESC);

ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read historial" ON public.historial FOR SELECT USING (true);
-- Sin políticas de escritura: desde la app no se puede tocar ni borrar

-- La app manda el nombre en la cabecera x-autor (UTF-8 en base64, por las tildes)
CREATE OR REPLACE FUNCTION public.autor_peticion()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cabecera TEXT := current_setting('request.headers', true)::json ->> 'x-autor';
BEGIN
  IF cabecera IS NULL OR cabecera = '' THEN
    RETURN '';
  END IF;
  RETURN left(btrim(convert_from(decode(cabecera, 'base64'), 'UTF8')), 60);
EXCEPTION WHEN others THEN
  RETURN '';
END;
$$;

-- Zonas borradas en esta misma transacción: su nombre, para las existencias que se quedan sin ubicar
CREATE OR REPLACE FUNCTION public.nombre_zona(p_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (SELECT nombre FROM public.elementos_mapa WHERE id = p_id),
    nullif(current_setting('verdnatura.zona_' || replace(p_id::text, '-', ''), true), ''),
    CASE WHEN p_id IS NULL THEN 'Sin ubicar' ELSE 'Zona borrada' END
  );
$$;

-- Artículos: alta, cambios en la ficha y baja (con lo que había en total)
CREATE OR REPLACE FUNCTION public.historial_articulos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cambios TEXT[] := '{}';
  total INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad)
    VALUES (autor_peticion(), 'articulo', 'alta', NEW.id, NEW.nombre, NEW.unidad);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
      cambios := cambios || format('nombre: «%s» → «%s»', OLD.nombre, NEW.nombre);
    END IF;
    IF NEW.categoria IS DISTINCT FROM OLD.categoria THEN
      cambios := cambios || format('categoría: «%s» → «%s»', OLD.categoria, NEW.categoria);
    END IF;
    IF NEW.unidad IS DISTINCT FROM OLD.unidad THEN
      cambios := cambios || format('se cuenta en: %s → %s', OLD.unidad, NEW.unidad);
    END IF;
    IF NEW.stock_minimo IS DISTINCT FROM OLD.stock_minimo THEN
      cambios := cambios || format('stock mínimo: %s → %s', coalesce(OLD.stock_minimo::text, 'ninguno'), coalesce(NEW.stock_minimo::text, 'ninguno'));
    END IF;
    IF NEW.descripcion IS DISTINCT FROM OLD.descripcion THEN
      cambios := cambios || 'descripción'::text;
    END IF;
    IF NEW.caracteristicas IS DISTINCT FROM OLD.caracteristicas THEN
      cambios := cambios || 'características'::text;
    END IF;
    IF NEW.fotos IS DISTINCT FROM OLD.fotos THEN
      cambios := cambios || 'fotos'::text;
    END IF;
    IF cardinality(cambios) = 0 THEN
      RETURN NEW;
    END IF;
    INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, detalle)
    VALUES (autor_peticion(), 'articulo', 'cambio', NEW.id, NEW.nombre, NEW.unidad, array_to_string(cambios, ' · '));
    RETURN NEW;
  ELSE
    -- Antes de borrar: las existencias aún están y se puede apuntar el total
    SELECT coalesce(sum(cantidad), 0) INTO total FROM existencias WHERE articulo_id = OLD.id;
    INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, cantidad_antes, cantidad_despues)
    VALUES (autor_peticion(), 'articulo', 'baja', OLD.id, OLD.nombre, OLD.unidad, total, 0);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER historial_articulos_cambios AFTER INSERT OR UPDATE ON public.articulos
  FOR EACH ROW EXECUTE FUNCTION public.historial_articulos();
CREATE TRIGGER historial_articulos_baja BEFORE DELETE ON public.articulos
  FOR EACH ROW EXECUTE FUNCTION public.historial_articulos();

-- Existencias: cuántos hay en cada zona
CREATE OR REPLACE FUNCTION public.historial_existencias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  art articulos%ROWTYPE;
BEGIN
  SELECT * INTO art FROM articulos WHERE id = coalesce(NEW.articulo_id, OLD.articulo_id);
  -- Se está borrando el artículo entero: ya queda apuntado como baja del artículo
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, elemento_id, elemento_nombre, cantidad_antes, cantidad_despues)
    VALUES (autor_peticion(), 'stock', 'alta', art.id, art.nombre, art.unidad, NEW.elemento_id, nombre_zona(NEW.elemento_id), 0, NEW.cantidad);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.elemento_id IS DISTINCT FROM OLD.elemento_id THEN
      INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, elemento_id, elemento_nombre, cantidad_antes, cantidad_despues, detalle)
      VALUES (autor_peticion(), 'stock', 'traslado', art.id, art.nombre, art.unidad, NEW.elemento_id, nombre_zona(NEW.elemento_id),
              OLD.cantidad, NEW.cantidad, 'Desde ' || nombre_zona(OLD.elemento_id));
    ELSIF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
      INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, elemento_id, elemento_nombre, cantidad_antes, cantidad_despues)
      VALUES (autor_peticion(), 'stock', 'cambio', art.id, art.nombre, art.unidad, NEW.elemento_id, nombre_zona(NEW.elemento_id), OLD.cantidad, NEW.cantidad);
    END IF;
  ELSE
    INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, elemento_id, elemento_nombre, cantidad_antes, cantidad_despues)
    VALUES (autor_peticion(), 'stock', 'baja', art.id, art.nombre, art.unidad, OLD.elemento_id, nombre_zona(OLD.elemento_id), OLD.cantidad, 0);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER historial_existencias AFTER INSERT OR UPDATE OR DELETE ON public.existencias
  FOR EACH ROW EXECUTE FUNCTION public.historial_existencias();

-- Mapa: zonas y objetos creados, cambiados o borrados
CREATE OR REPLACE FUNCTION public.historial_mapa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cambios TEXT[] := '{}';
  articulos_aqui INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO historial (autor, tipo, accion, elemento_id, elemento_nombre)
    VALUES (autor_peticion(), 'mapa', 'alta', NEW.id, NEW.nombre);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
      cambios := cambios || format('nombre: «%s» → «%s»', OLD.nombre, NEW.nombre);
    END IF;
    IF (NEW.x0, NEW.y0, NEW.x1, NEW.y1) IS DISTINCT FROM (OLD.x0, OLD.y0, OLD.x1, OLD.y1) THEN
      cambios := cambios || 'posición o tamaño'::text;
    END IF;
    IF NEW.categoria IS DISTINCT FROM OLD.categoria THEN
      cambios := cambios || format('categoría: «%s» → «%s»', OLD.categoria, NEW.categoria);
    END IF;
    IF (NEW.tipo, NEW.modelo) IS DISTINCT FROM (OLD.tipo, OLD.modelo) THEN
      cambios := cambios || 'tipo'::text;
    END IF;
    IF (NEW.color, NEW.sentido, NEW.muelle, NEW.descripcion) IS DISTINCT FROM (OLD.color, OLD.sentido, OLD.muelle, OLD.descripcion) THEN
      cambios := cambios || 'otros datos'::text;
    END IF;
    -- Cambiar solo el orden (al borrar otra zona) no es un cambio para nadie
    IF cardinality(cambios) = 0 THEN
      RETURN NEW;
    END IF;
    INSERT INTO historial (autor, tipo, accion, elemento_id, elemento_nombre, detalle)
    VALUES (autor_peticion(), 'mapa', 'cambio', NEW.id, NEW.nombre, array_to_string(cambios, ' · '));
    RETURN NEW;
  ELSE
    SELECT count(*) INTO articulos_aqui FROM existencias WHERE elemento_id = OLD.id;
    -- Las existencias de esta zona se quedan sin ubicar justo después: que sepan de dónde venían
    PERFORM set_config('verdnatura.zona_' || replace(OLD.id::text, '-', ''), OLD.nombre, true);
    INSERT INTO historial (autor, tipo, accion, elemento_id, elemento_nombre, detalle)
    VALUES (autor_peticion(), 'mapa', 'baja', OLD.id, OLD.nombre,
            CASE WHEN articulos_aqui = 0 THEN ''
                 WHEN articulos_aqui = 1 THEN '1 artículo queda sin ubicar'
                 ELSE articulos_aqui || ' artículos quedan sin ubicar' END);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER historial_mapa_cambios AFTER INSERT OR UPDATE ON public.elementos_mapa
  FOR EACH ROW EXECUTE FUNCTION public.historial_mapa();
CREATE TRIGGER historial_mapa_baja BEFORE DELETE ON public.elementos_mapa
  FOR EACH ROW EXECUTE FUNCTION public.historial_mapa();

-- ---------------------------------------------------------------------------
-- Botones + / −: suma o resta en la propia base de datos, así dos personas
-- contando a la vez no se pisan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajustar_existencia(p_id UUID, p_delta INTEGER)
RETURNS INTEGER
LANGUAGE sql
AS $$
  UPDATE public.existencias
  SET cantidad = greatest(0, cantidad + p_delta)
  WHERE id = p_id
  RETURNING cantidad;
$$;

GRANT EXECUTE ON FUNCTION public.ajustar_existencia(UUID, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tiempo real: la app se entera al momento de lo que cambian los demás
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.articulos, public.existencias, public.elementos_mapa, public.historial;

-- ---------------------------------------------------------------------------
-- Copias de seguridad: cada noche se guarda un JSON con todo en este bucket
-- privado. Desde la app solo se puede subir, no leer ni borrar; se descargan
-- desde el panel de Supabase (Storage → copias).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('copias', 'copias', false, 52428800, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Subir copias de seguridad" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'copias');
