# Deeremax Web App

Aplicacion web profesional para control de empaque y rendimiento por productor, basada en el flujo de tu Excel semanal.

## Funcionalidades incluidas

- Login con Supabase Auth (registro e inicio de sesion)
- Productores con historial de reportes semanales
- Carga diaria con fecha automatica
- Calculo de rendimiento por Americana y Hindu
- Reportes por rango: semanal, mensual y todos
- Edicion y eliminacion de dias cargados
- Eliminacion de semanas completas
- Impresion y exportacion PDF, Excel, Imagen y CSV
- Diseño responsive con branding DeereMax

## Stack tecnologico

- React + TypeScript + Vite
- Supabase (Auth + Postgres)
- React Query
- date-fns

## Configuracion

1. Instala dependencias:

```bash
npm install
```

2. Crea el archivo `.env` copiando `.env.example`.

3. En Supabase SQL Editor ejecuta el script:

`supabase/schema.sql`

Eso crea tablas, indices, RLS y carga los productores iniciales.

4. Levanta el proyecto:

```bash
npm run dev
```

## Estructura de datos

- `producers`: catalogo de productores
- `weekly_reports`: cabecera de semana por productor
- `daily_entries`: detalle diario dentro de cada semana

## Logica de rendimiento

- Total cajas Americana = A-4kg + A-5kg + A-7kg
- Total cajas Hindu = H-4kg + H-5kg + H-7kg
- Rendimiento A = Total cajas Americana / Cestas A
- Rendimiento H = Total cajas Hindu / Cestas H

## Notas de uso

- Si registras el mismo dia dentro de la misma semana, se actualiza el registro existente.
- El filtro semanal muestra la semana actual automaticamente.
- El boton de imprimir usa la vista filtrada activa.
