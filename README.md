# Verdnatura · Stock y almacén

Aplicación web para controlar el stock y el mapa del almacén de Verdnatura
(artículos, estanterías, huecos, palets, historial de movimientos).

## Stack

Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase.

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env` y rellenar los datos del proyecto de Supabase.
3. Aplicar las migraciones de `supabase/migrations` en orden (SQL Editor de Supabase o `supabase db push`).
4. `npm run dev` → http://localhost:8080

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon / publishable) |
| `VITE_SUPABASE_PROJECT_ID` | Ref del proyecto |
