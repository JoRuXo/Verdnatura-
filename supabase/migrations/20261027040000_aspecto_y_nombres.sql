-- Cómo se ve cada artículo en el mapa 3D (carros apilados, carro con barras,
-- palet con film...) y si cada zona u objeto enseña su nombre en el mapa.

ALTER TABLE public.articulos ADD COLUMN IF NOT EXISTS aspecto TEXT;
ALTER TABLE public.elementos_mapa ADD COLUMN IF NOT EXISTS mostrar_nombre BOOLEAN NOT NULL DEFAULT true;

-- Los cargadores, sin nombre (pedido: menos ruido en el mapa)
UPDATE public.elementos_mapa SET mostrar_nombre = false WHERE tipo = 'puesto' AND modelo = 'cargador';
-- El carro CC que ya estaba dado de alta se ve como carros apilados
UPDATE public.articulos SET aspecto = 'carros-apilados' WHERE nombre = 'Carro CC' AND aspecto IS NULL;

-- El historial también apunta estos dos cambios
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
    IF NEW.aspecto IS DISTINCT FROM OLD.aspecto THEN
      cambios := cambios || 'cómo se ve en el mapa'::text;
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
    IF NEW.almacen IS DISTINCT FROM OLD.almacen THEN
      cambios := cambios || CASE WHEN NEW.almacen THEN 'ahora guarda artículos' ELSE 'ya no guarda artículos' END;
    END IF;
    IF NEW.mostrar_nombre IS DISTINCT FROM OLD.mostrar_nombre THEN
      cambios := cambios || CASE WHEN NEW.mostrar_nombre THEN 'nombre visible en el mapa' ELSE 'nombre oculto en el mapa' END;
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
