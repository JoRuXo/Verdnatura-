# Verdnatura · Stock y almacén

Aplicación web para controlar el stock del almacén de Verdnatura en la nave de
Holanda. La pantalla principal es la nave en 3D: se recorre como un mapa y, al
tocar una zona, la cámara vuela hasta ella.

> En reconstrucción: la versión anterior (listas de artículos, estanterías,
> historial) se ha retirado. Ahora mismo hay la nave a escala y una zona de
> ejemplo; las zonas reales y su contenido se irán definiendo.

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
| `zonas.ts` | Las zonas del almacén (de momento solo la de ejemplo). |
| `EscenaNave.tsx` | El lienzo 3D, las luces y la cámara con sus vuelos entre vista general y zona. |
| `Estructura.tsx` | Dibuja la nave: suelo, paredes cortadas, pilares, muelles, oficina, rótulos. |
| `ZonaSuelo.tsx` | Una zona tocable y las estanterías de muestra. |
| `piezas.tsx`, `geometria.ts` | Cajas instanciadas y utilidades para pasar del plano a la escena. |

La escala es provisional (1:300, unos 110 × 34 m) porque el plano no trae
cotas: cuando haya una medida real basta con reescalar los números de
`plano.ts`.

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon / publishable) |
| `VITE_SUPABASE_PROJECT_ID` | Ref del proyecto |
