# Repo Overview

## Proyecto

- **Nombre**: Punto Cambio (frontend + backend en el mismo monorepo)
- **Stack**:
  - **Frontend**: React + Vite + TypeScript, TailwindCSS, Shadcn UI
  - **Backend**: Express + TypeScript, Prisma Client (PostgreSQL), PM2 (ecosystem.config.cjs)
  - **DB**: PostgreSQL (Prisma schema en `prisma/schema.prisma`)
  - **Infra**: Docker, docker-compose, nginx (reverse proxy), Supabase (algunas integraciones)

## Estructura principal

- `/src`: Frontend React (páginas, componentes, hooks, servicios, types)
- `/server`: Backend Express (rutas, controladores, servicios, middleware, utils, prisma client wrapper)
- `/prisma`: Modelos, migraciones y seeds
- `/scripts`: Utilidades de despliegue/verificación, reparaciones y fixes
- `/docs`: Documentación adicional del sistema

## Variables de entorno

- `.env`, `.env.example`, `.env.production`
- Claves importantes:
  - `DATABASE_URL` (Postgres)
  - `JWT_SECRET`
  - `VITE_API_URL` (frontend)

## Comandos útiles

- Desarrollo
  - `npm install`
  - `npm run dev` (frontend Vite)
  - `npm run dev:server` (backend ts-node o bun/ts-node según config)
- Prisma / DB
  - `npx prisma generate`
  - `npx prisma migrate dev`
  - Seeds: ver `prisma/seed-*.ts` y scripts en `package.json`
- Build / Producción
  - `npm run build` (frontend)
  - `npm run build:server` o `scripts/build-server.sh`
  - PM2: `pm2 start ecosystem.config.cjs` (ajustar según server)

## Backend (Express)

- Entrada: `server/index.ts`
- Rutas principales (`server/routes`):
  - `auth.ts` (login, JWT)
  - `schedules.ts` (jornadas/marcaciones: iniciar, almuerzo, regreso, salida, activo, listado con filtros)
  - `servientrega*.ts` (flujos con Servientrega)
  - `transfers.ts`, `transfer-approvals.ts`
  - `movimientos-contables.ts` (historial y procesamiento de saldo por cambios)
  - `balances.ts`, `contabilidad-diaria.ts`, `cuadreCaja.ts`, `saldos-actuales.ts`, etc.
- Middleware: `server/middleware/auth.ts` (JWT + verificación de jornada para OPERADOR), `validation.ts`
- Prisma wrapper: `server/lib/prisma.ts`; conexión pg cruda: `server/lib/database.ts` (para consultas SQL directas en algunos módulos)

## Frontend (React)

- Páginas: `src/pages`
- Componentes principales:
  - `components/timeTracking/*`: UI de marcaciones (Jornada), salidas espontáneas e historial
  - `components/dashboard/*`, `components/contabilidad/*`, `components/reports/*`
  - `components/admin/ActivePointsReport.tsx`: Reporte de usuarios activos
- Servicios HTTP: `src/services/*` usando `axiosInstance.ts`
- Estado de autenticación: `src/hooks/useAuth.tsx`

## Modelos clave (Prisma)

- `Usuario` (rol: OPERADOR, ADMINISTRATIVO, ADMIN, SUPER_USUARIO)
- `PuntoAtencion` (incluye `es_principal`)
- `Jornada` (control de horarios con `EstadoJornada`: ACTIVO, ALMUERZO, COMPLETADO, CANCELADO)
- `SalidaEspontanea` (pausas con motivo, regreso e impacto en cálculo de tiempo)
- `Saldo`, `MovimientoSaldo`, `CambioDivisa`, `Transferencia`, etc.

## Jornadas / Marcaciones (visión general)

- Endpoint POST `/schedules`: crea o actualiza la jornada del día
  - En inicio: crea `Jornada` con `estado=ACTIVO` y asigna `punto_atencion_id` al usuario
  - En almuerzo: set `fecha_almuerzo` y `estado=ALMUERZO`
  - En regreso: set `fecha_regreso` y `estado=ACTIVO`
  - En salida: set `fecha_salida` y `estado=COMPLETADO` y limpia `punto_atencion_id` del usuario
- GET `/schedules/active`: devuelve jornada activa del día (ACTIVO o ALMUERZO)
- GET `/schedules`: listado con filtros: `fecha`, `from`, `to`, `estados`, `usuario_id` (según rol)

## Salidas espontáneas

- UI en `components/timeTracking/` y servicio en `src/services/spontaneousExitService.ts`
- Afectan cálculo del tiempo total trabajado (descontadas en frontend)

## Scripts útiles (carpeta scripts)

- `setup-frontend-backend.sh`, `fix-*`, `check-*`, `verify-system.sh`, etc.
- `scripts/repair-exchange.ts`, `scripts/update-currency-behaviors.mjs`

## Despliegue

- Docker + docker-compose con nginx reverse proxy
- PM2 para backend
- Asegurar variables `.env.production`

## Prácticas y notas

- Validar transiciones de estado en jornadas
- Logs en `server/utils/logger.ts`
- Revisar permisos por rol en `auth.ts` y en cada ruta
- Exportaciones/reportes: usar filtros de `/schedules`; agregar paginación/export CSV si se requiere
