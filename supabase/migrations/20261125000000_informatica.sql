-- Sección de Informática: la estantería de la pared larga (junto al carro de
-- bobinas) pasa a ser el armario de repuestos de informática, con sus cajas
-- en baldas. Además:
--   · cada existencia sabe en qué balda está (1 = la de abajo);
--   · las cantidades de prueba se ponen a 0 (los artículos se conservan);
--   · se quita el carro de bobinas del mapa.
--
-- Se pega entera en el SQL Editor de Supabase. Si no encuentra la estantería,
-- no cambia nada. Se puede volver a pasar sin duplicar nada.

-- ---------------------------------------------------------------------------
-- Balda de cada existencia
-- ---------------------------------------------------------------------------
ALTER TABLE public.existencias
  ADD COLUMN IF NOT EXISTS balda SMALLINT NOT NULL DEFAULT 1 CHECK (balda >= 1);

-- Historial: cambiar una caja de balda también queda apuntado
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
    ELSIF NEW.balda IS DISTINCT FROM OLD.balda THEN
      INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, elemento_id, elemento_nombre, cantidad_antes, cantidad_despues, detalle)
      VALUES (autor_peticion(), 'stock', 'traslado', art.id, art.nombre, art.unidad, NEW.elemento_id, nombre_zona(NEW.elemento_id),
              OLD.cantidad, NEW.cantidad, format('Balda %s → %s', OLD.balda, NEW.balda));
    END IF;
  ELSE
    INSERT INTO historial (autor, tipo, accion, articulo_id, articulo_nombre, unidad, elemento_id, elemento_nombre, cantidad_antes, cantidad_despues)
    VALUES (autor_peticion(), 'stock', 'baja', art.id, art.nombre, art.unidad, OLD.elemento_id, nombre_zona(OLD.elemento_id), OLD.cantidad, 0);
  END IF;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Datos: limpieza de pruebas, carro de bobinas fuera y armario de Informática
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  zona UUID;
BEGIN
  SELECT id INTO zona FROM public.elementos_mapa WHERE clave IN ('informatica', 'estanteria') ORDER BY clave = 'informatica' DESC LIMIT 1;
  IF zona IS NULL THEN
    RAISE EXCEPTION 'No encuentro la estantería (clave «estanteria»): no se ha cambiado nada';
  END IF;

  -- Las cantidades eran pruebas (solo la primera vez: luego ya son de verdad)
  IF NOT EXISTS (SELECT 1 FROM public.articulos WHERE categoria = 'Informática') THEN
    UPDATE public.existencias SET cantidad = 0 WHERE cantidad <> 0;
  END IF;

  DELETE FROM public.elementos_mapa WHERE clave = 'carro-bobinas';

  UPDATE public.elementos_mapa
  SET clave = 'informatica',
      nombre = 'Informática',
      categoria = 'Informática',
      color = '#6366f1',
      modelo = 'informatica',
      almacen = true,
      mostrar_nombre = true,
      descripcion = 'Armario de repuestos de informática, pegado a la pared larga. Cajas de cartón con su etiqueta, en dos baldas.'
  WHERE id = zona;

  -- Lo que hay en el armario (balda 2 = la de arriba, balda 1 = la de abajo)
  WITH nuevos (nombre, descripcion, unidad, cantidad, balda) AS (
    VALUES
      ('Ordenador i3', 'Ordenador con procesador Intel i3. Viejo, de repuesto.', 'unidades', 1, 2),
      ('Cabezal impresora Zebra', 'Cabezal de impresión para impresora Zebra. Nuevo.', 'unidades', 1, 2),
      ('Soporte mini PC', 'Soporte para un mini ordenador.', 'unidades', 1, 2),
      ('Ribbons', 'Caja de ribbons para las impresoras de etiquetas.', 'cajas', 1, 2),
      ('Pistola escáner', 'Pistolas de escanear nuevas, cada una en su caja.', 'cajas', 2, 2),
      ('Cables de internet', 'Caja con 3 cables de red.', 'cajas', 1, 1),
      ('Impresora Zebra ZT111', 'Impresora de etiquetas Zebra ZT111, en su caja.', 'unidades', 1, 1)
  ),
  creados AS (
    INSERT INTO public.articulos (nombre, categoria, descripcion, unidad)
    SELECT n.nombre, 'Informática', n.descripcion, n.unidad
    FROM nuevos n
    WHERE NOT EXISTS (SELECT 1 FROM public.articulos a WHERE a.nombre = n.nombre AND a.categoria = 'Informática')
    RETURNING id, nombre
  )
  INSERT INTO public.existencias (articulo_id, elemento_id, cantidad, balda)
  SELECT c.id, zona, n.cantidad, n.balda
  FROM creados c
  JOIN nuevos n ON n.nombre = c.nombre;
END;
$$;
