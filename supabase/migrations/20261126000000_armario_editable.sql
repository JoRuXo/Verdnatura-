-- Armario editable: cada caja se coloca donde se quiera a lo largo de su balda
-- y cada armario tiene las baldas que se quieran.
--   · existencias.posicion: dónde empieza la caja a lo largo de la balda, como
--     fracción del largo (0 = pegada a la izquierda). NULL = se coloca sola.
--   · elementos_mapa.baldas: cuántas baldas tiene el armario. NULL = 2.
--
-- Mover una caja dentro de la misma balda no se apunta en el historial (serían
-- decenas de líneas por cada arrastre); cambiarla de balda, sí, como hasta ahora.
-- Se puede volver a pasar sin duplicar nada.

ALTER TABLE public.existencias
  ADD COLUMN IF NOT EXISTS posicion REAL CHECK (posicion IS NULL OR (posicion >= 0 AND posicion <= 1));

ALTER TABLE public.elementos_mapa
  ADD COLUMN IF NOT EXISTS baldas SMALLINT CHECK (baldas IS NULL OR (baldas >= 1 AND baldas <= 8));

-- Historial del mapa: cambiar las baldas de un armario también queda apuntado
-- (es la versión de 20261027040000_aspecto_y_nombres.sql con esa línea más)
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
    IF NEW.baldas IS DISTINCT FROM OLD.baldas THEN
      cambios := cambios || format('baldas: %s → %s', coalesce(OLD.baldas, 2), coalesce(NEW.baldas, 2));
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
