# Verdnatura · Stock y almacén

Aplicación web para controlar el stock del almacén de Verdnatura en la nave de
Holanda. La pantalla principal es la nave en 3D: se recorre como un mapa y, al
tocar una zona, la cámara vuela hasta ella.

> En reconstrucción: la versión anterior (listas de artículos, estanterías,
> historial) se ha retirado. Ahora mismo hay la nave a escala con su
> distribución real, que se edita desde el propio mapa; el contenido de cada
> zona (stock) se irá definiendo.

## Editar el mapa

Con el botón del lápiz se entra en el modo edición. Ahí se pueden mover las
zonas y objetos arrastrándolos, cambiarles el tamaño por las esquinas o los
lados, añadir otros nuevos, duplicarlos, borrarlos y cambiar su nombre,
categoría, color, sentido de las flechas, muelle y medidas exactas. Nada se
guarda hasta pulsar «Guardar»; «Deshacer» (Ctrl+Z) vuelve atrás y Supr borra
lo seleccionado. Los cambios se guardan en la tabla `elementos_mapa` de
Supabase, así que todo el equipo ve el mismo mapa.

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase, y para el 3D
Three.js con React Three Fiber, drei y camera-controls.

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env.local` y rellenar los datos del proyecto de Supabase.
3. Aplicar las migraciones de `supabase/migrations` en orden (SQL Editor de Supabase o `supabase db push`).
4. `npm run dev` → http://localhost:8080 (en PowerShell, `npm.cmd run dev`).

## Cómo está organizado el 3D (`src/nave`)

| Archivo | Qué contiene |
| --- | --- |
| `plano.ts` | Medidas de la nave sacadas del PDF del plano: límite con las otras empresas, paredes, pilares, muelles M3–M8, oficinas, cámara frigorífica y la cuadrícula de referencia (vanos A–K, franjas 1–4). Solo se dibuja la parte de Verdnatura. |
| `elementos.ts` | Tipo `Elemento` (líneas, zonas, estanterías y objetos), categorías y colores de serie, y cómo se crea uno nuevo. |
| `mapa-inicial.json` | El mapa de serie sacado del croquis; también es la semilla de la migración y el respaldo si Supabase no responde. |
| `useMapa.ts`, `useEditor.ts` | Lectura y guardado en Supabase, y el borrador del modo edición con su historial para deshacer. |
| `EscenaNave.tsx` | El lienzo 3D, las luces y la cámara con sus vuelos entre vista general y zona. |
| `Estructura.tsx` | Dibuja la nave fija: suelo, paredes cortadas, pilares, muelles, oficinas, cámara frigorífica, rótulos. |
| `ElementoMapa.tsx` | Cada elemento según su tipo (flechas de flujo animadas, nombre pintado en el suelo) y, en edición, su selección, arrastre y tiradores. |
| `PanelEdicion.tsx`, `BarraEdicion.tsx` | Propiedades del elemento seleccionado y barra inferior del modo edición. |
| `marco.ts`, `Puestos.tsx`, `estanterias.ts` | Marco local (a lo largo / a lo ancho) y modelos de objetos y estanterías, que valen en las dos orientaciones. |
| `piezas.tsx`, `fundido.ts`, `geometria.ts` | Cajas instanciadas, fundido suave de opacidad y utilidades para pasar del plano a la escena. |

La escala es provisional (1:300, unos 110 × 34 m) porque el plano no trae
cotas: cuando haya una medida real basta con reescalar los números de
`plano.ts`.

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon / publishable) |
| `VITE_SUPABASE_PROJECT_ID` | Ref del proyecto |
