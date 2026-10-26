-- Mapa de la nave: zonas (líneas, áreas, estanterías) y puestos que se editan
-- desde la propia app. Coordenadas en metros del plano (ver src/nave/plano.ts).
-- Los datos iniciales salen de src/nave/mapa-inicial.json (croquis del 26/10/2026).

CREATE TABLE public.elementos_mapa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('linea', 'area', 'estanteria', 'puesto')),
  categoria TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#64748b',
  x0 DOUBLE PRECISION NOT NULL,
  y0 DOUBLE PRECISION NOT NULL,
  x1 DOUBLE PRECISION NOT NULL,
  y1 DOUBLE PRECISION NOT NULL,
  sentido SMALLINT CHECK (sentido IN (-1, 1)),
  muelle TEXT,
  modelo TEXT,
  descripcion TEXT NOT NULL DEFAULT '',
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (x1 > x0 AND y1 > y0)
);

CREATE TRIGGER update_elementos_mapa_updated_at BEFORE UPDATE ON public.elementos_mapa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: acceso abierto por ahora (sin login), como el resto de tablas
ALTER TABLE public.elementos_mapa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read elementos_mapa" ON public.elementos_mapa FOR SELECT USING (true);
CREATE POLICY "Public insert elementos_mapa" ON public.elementos_mapa FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update elementos_mapa" ON public.elementos_mapa FOR UPDATE USING (true);
CREATE POLICY "Public delete elementos_mapa" ON public.elementos_mapa FOR DELETE USING (true);

INSERT INTO public.elementos_mapa
  (clave, nombre, tipo, categoria, color, x0, y0, x1, y1, sentido, muelle, modelo, descripcion, orden)
VALUES
  ('entrada-1', 'Entrada 1', 'linea', 'Entrada de producto', '#14b8a6', 2, 1.2, 55.4, 2.45, 1, NULL, NULL, 'Línea por la que entra el producto desde las puertas, camino de los muelles.', 0),
  ('entrada-2', 'Entrada 2', 'linea', 'Entrada de producto', '#14b8a6', 2, 4.2, 55.4, 5.45, 1, NULL, NULL, 'Línea por la que entra el producto desde las puertas, camino de los muelles.', 1),
  ('entrada-3', 'Entrada 3', 'linea', 'Entrada de producto', '#14b8a6', 2, 6.9, 55.4, 8.15, 1, NULL, NULL, 'Línea por la que entra el producto desde las puertas, camino de los muelles.', 2),
  ('vuelta-vacios', 'Vuelta de vacíos', 'linea', 'Vuelta de vacíos', '#475569', 2, 8.4, 55.4, 9.5, -1, NULL, NULL, 'Los carros CC vacíos vuelven por aquí hacia las puertas.', 3),
  ('tumba-1', 'Tumba 1', 'linea', 'Tumba', '#a855f7', 64.5, 16, 86, 17.2, NULL, NULL, NULL, 'Flores que hay que tumbar: aquí esperan a pasar por el proceso de tumbado.', 4),
  ('tumba-2', 'Tumba 2', 'linea', 'Tumba', '#a855f7', 64.5, 17.4, 86, 18.6, NULL, NULL, NULL, 'Flores que hay que tumbar: aquí esperan a pasar por el proceso de tumbado.', 5),
  ('tumba-3', 'Tumba 3', 'linea', 'Tumba', '#a855f7', 60.5, 6.6, 88.5, 7.8, NULL, NULL, NULL, 'Flores que hay que tumbar: aquí esperan a pasar por el proceso de tumbado.', 6),
  ('tumba-4', 'Tumba 4', 'linea', 'Tumba', '#a855f7', 60.5, 8, 88.5, 9.2, NULL, NULL, NULL, 'Flores que hay que tumbar: aquí esperan a pasar por el proceso de tumbado.', 7),
  ('cubos', 'Cubos', 'area', 'Cubos', '#ec4899', 56.6, 11.5, 62, 16, NULL, NULL, NULL, 'Zona de cubos.', 8),
  ('estanteria', 'Estantería', 'estanteria', 'Estanterías', '#78716c', 60.8, 0.5, 63.5, 1.1, NULL, NULL, 'pared', 'Estantería pegada a la pared larga, junto al carro de bobinas.', 9),
  ('cc-tumbados', 'CC tumbados', 'linea', 'CC tumbados', '#f97316', 90.5, 12.4, 107.6, 13.7, 1, 'M5', NULL, 'Carros CC con las flores ya tumbadas, camino del muelle para expedirlas.', 10),
  ('boxes', 'Boxes', 'linea', 'Boxes', '#eab308', 90.5, 13.9, 107.6, 15.2, NULL, NULL, NULL, 'Boxes, al lado de la oficina y de los CC tumbados.', 11),
  ('frio-1', 'Frío 1', 'linea', 'Frío', '#0ea5e9', 90.5, 9.1, 107.6, 10.4, 1, 'M6', NULL, 'Línea de frío hacia el muelle.', 12),
  ('frio-2', 'Frío 2', 'linea', 'Frío', '#0ea5e9', 90.5, 5.9, 107.6, 7.2, 1, 'M7', NULL, 'Línea de frío hacia el muelle.', 13),
  ('plantas-2', 'Plantas 2', 'linea', 'Plantas', '#22c55e', 90.5, 4.4, 107.6, 5.7, 1, 'M7', NULL, 'Línea de plantas hacia el muelle.', 14),
  ('plantas-1', 'Plantas 1', 'linea', 'Plantas', '#22c55e', 90.5, 1.2, 107.6, 2.5, 1, 'M8', NULL, 'Línea de plantas, pegada a la pared larga, hacia el muelle.', 15),
  ('carton', 'Cartón', 'estanteria', 'Cartón', '#b45309', 80.2, 29.9, 88.3, 32.2, NULL, NULL, 'carton', 'Estanterías de cartón.', 16),
  ('cargadores', 'Cargadores', 'puesto', 'Puestos', '#334155', 79.1, 24.4, 80.6, 28.6, NULL, NULL, 'cargador', 'Cargadores, pegados a la cámara frigorífica.', 17),
  ('carro-bobinas', 'Carro de bobinas', 'puesto', 'Puestos', '#475569', 63.8, 0.5, 65.1, 1.3, NULL, NULL, 'carro-bobinas', '', 18),
  ('pc-1', 'PC', 'puesto', 'Puestos', '#475569', 53.6, 0.5, 54.6, 1.1, NULL, NULL, 'pc', '', 19),
  ('pc-2', 'PC', 'puesto', 'Puestos', '#475569', 36.4, 0.5, 37.4, 1.1, NULL, NULL, 'pc', '', 20);
