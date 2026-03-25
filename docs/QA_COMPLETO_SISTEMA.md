# 📋 QA COMPLETO - SISTEMA PUNTO CAMBIO

**Fecha de revisión:** 2026-03-24  
**Versión del sistema:** 1.0.0  
**Arquitectura:** React + Express + PostgreSQL (Prisma)  

---

## 📑 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Backend - Análisis Completo](#3-backend---análisis-completo)
4. [Frontend - Análisis Completo](#4-frontend---análisis-completo)
5. [Base de Datos - Schema Analysis](#5-base-de-datos---schema-analysis)
6. [Flujos Críticos del Sistema](#6-flujos-críticos-del-sistema)
7. [Código Inservible Identificado](#7-código-inservible-identificado)
8. [Problemas Críticos y Recomendaciones](#8-problemas-críticos-y-recomendaciones)
9. [Plan de Limpieza y Refactorización](#9-plan-de-limpieza-y-refactorización)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| **Backend (archivos .ts)** | 81 |
| **Frontend componentes (.tsx)** | 171 |
| **Frontend servicios/hooks (.ts)** | 58 |
| **Modelos de BD** | 32 |
| **Enums** | 17 |
| **Endpoints API** | ~120 |
| **Tablas de BD** | 32 |

### 1.2 Estado General

| Aspecto | Estado | Observaciones |
|---------|--------|---------------|
| **Funcionalidad** | ✅ Estable | Todos los flujos críticos operativos |
| **Código Muerto** | ⚠️ Moderado | ~15 archivos huérfanos identificados |
| **Duplicación** | ⚠️ Moderada | Lógica de saldos duplicada en 3+ lugares |
| **Documentación** | ❌ Mínima | Falta documentación técnica |
| **Testing** | ❌ Ninguno | No hay tests automatizados |
| **Type Safety** | ✅ Bueno | TypeScript en todo el stack |

### 1.3 Hallazgos Críticos

🔴 **6 problemas críticos** requieren atención inmediata:
1. Ruta `cierreParcial.ts` no registrada en `index.ts` (inaccesible)
2. Múltiples instancias de PrismaClient (riesgo de agotamiento de conexiones)
3. Código duplicado en validaciones de saldo
4. Inconsistencia en actualización de saldos entre flujos
5. Constraints UNIQUE con campos opcionales (problema de integridad)
6. Índices duplicados en schema de BD

🟡 **15 problemas medios** de deuda técnica:
- Sistemas de toast duplicados (Sonner + legacy)
- Componentes duplicados (CurrencyManagement, Reports)
- Middleware sin usar (`typeValidation.ts`)
- Servicios HTTP duplicados (`apiService` vs `axiosInstance`)

---

## 2. ESTRUCTURA DEL PROYECTO

### 2.1 Árbol de Directorios

```
punto_cambio/
├── .github/                    # Workflows de GitHub
├── .vscode/                    # Configuración VS Code
├── dist/                       # Build de frontend (generado)
├── dist-server/                # Build de backend (generado)
├── docs/                       # Documentación
├── prisma/
│   ├── schema.prisma          # Schema de BD (1,014 líneas)
│   └── migrations/            # Migraciones SQL
├── public/                     # Assets estáticos
├── scripts/                    # Scripts de utilidad
├── server/                     # Backend Express
│   ├── controllers/           # Controladores (2)
│   ├── lib/                   # Configuración (3)
│   ├── middleware/            # Middleware (8)
│   ├── migrations/            # Scripts de migración (19)
│   ├── routes/                # Rutas API (39 + 8 servientrega)
│   ├── schemas/               # Validaciones Zod (1)
│   ├── services/              # Lógica de negocio (15)
│   ├── types/                 # Tipos TypeScript (3)
│   └── utils/                 # Utilidades (3)
└── src/                        # Frontend React
    ├── components/            # Componentes React (80+)
    │   ├── admin/            # Administración (20)
    │   ├── auth/             # Autenticación (2)
    │   ├── caja/             # Cuadre de caja (8)
    │   ├── close/            # Cierres (2)
    │   ├── contabilidad/     # Contabilidad (5)
    │   ├── dashboard/        # Dashboard (7)
    │   ├── exchange/         # Cambio de divisas (11)
    │   ├── layout/           # Layout (1)
    │   ├── management/       # Gestión (4)
    │   ├── reports/          # Reportes (5)
    │   ├── servientrega/     # Servientrega (9)
    │   ├── timeTracking/     # Control de tiempo (7)
    │   ├── transfer/         # Transferencias (3)
    │   └── ui/               # Componentes UI (54)
    ├── config/               # Configuración (2)
    ├── constants/            # Constantes (1)
    ├── hooks/                # Custom hooks (10)
    ├── integrations/         # Integraciones
    ├── lib/                  # Utilidades (3)
    ├── pages/                # Páginas (5)
    ├── services/             # Servicios API (24)
    ├── styles/               # Estilos
    ├── types/                # Tipos (4)
    └── utils/                # Utilidades (7)
```

---

## 3. BACKEND - ANÁLISIS COMPLETO

### 3.1 Estructura de Rutas (39 archivos)

| Ruta | Líneas | Descripción | Estado |
|------|--------|-------------|--------|
| `exchanges.ts` | ~2000 | Cambio de divisas | ✅ Core |
| `servicios-externos.ts` | ~1000+ | Servicios externos | ✅ Core |
| `schedules.ts` | ~1000 | Jornadas y horarios | ✅ Activo |
| `apertura-caja.ts` | ~774 | Apertura de caja | ✅ Activo |
| `cierreReporte.ts` | ~700 | Reporte de cierre | ⚠️ Errores TS |
| `transfers.ts` | ~600 | Transferencias | ✅ Activo |
| `transfer-approvals.ts` | ~500 | Aprobaciones transferencias | ✅ Activo |
| `cuadreCaja.ts` | ~500 | Cuadre de caja | ✅ Activo |
| `servientrega/shipping.ts` | ~1300 | Guías Servientrega | ✅ Core |
| `servientrega/balances.ts` | ~650 | Saldos Servientrega | ✅ Activo |
| `cierreParcial.ts` | ~300 | Cierre parcial | 🔴 **NO REGISTRADO** |

### 3.2 Servicios (15 archivos)

| Servicio | Estado | Descripción |
|----------|--------|-------------|
| `movimientoSaldoService.ts` | ✅ Activo | Servicio centralizado de movimientos |
| `cierreService.ts` | ✅ Activo | Cierre de caja |
| `cierreUnificadoService.ts` | ✅ Activo | Cierre unificado |
| `transferCreationService.ts` | ✅ Activo | Creación de transferencias |
| `servientregaAPIService.ts` | ✅ Activo | API Servientrega |
| `exchangeCalculationService.ts` | 🔴 **HUÉRFANO** | No se importa |
| `exchangeSaldoService.ts` | 🔴 **HUÉRFANO** | No se importa + PrismaClient duplicado |
| `exchangeValidationService.ts` | 🔴 **HUÉRFANO** | No se importa + PrismaClient duplicado |

### 3.3 Middleware (8 archivos)

| Middleware | Uso | Estado |
|------------|-----|--------|
| `auth.ts` | 271 referencias | ✅ Activo |
| `validation.ts` | 51 referencias | ✅ Activo |
| `idempotency.ts` | 20 referencias | ✅ Activo |
| `saldoValidation.ts` | 7 referencias | ✅ Activo |
| `typeValidation.ts` | 0 referencias | 🔴 **HUÉRFANO** |

### 3.4 Problemas de Backend Identificados

#### 🔴 CRÍTICO: Ruta No Registrada
**Archivo:** `server/routes/cierreParcial.ts`
**Problema:** La ruta completa con endpoints `/parcial` y `/pendientes` no está importada en `server/index.ts`
**Impacto:** Funcionalidad completamente inaccesible

#### 🔴 CRÍTICO: Múltiples Instancias de PrismaClient
**Archivos:**
- `exchangeSaldoService.ts` (línea 17)
- `exchangeValidationService.ts` (línea 13)
- `occupiedPoints.ts.back` (línea 9)

**Problema:** Cada uno crea `new PrismaClient()` en lugar de importar la instancia única
**Impacto:** Agotamiento de conexiones a PostgreSQL

**Solución:**
```typescript
// ❌ Incorrecto
const prisma = new PrismaClient();

// ✅ Correcto
import prisma from "../lib/prisma.js";
```

#### 🟡 ADVERTENCIA: Inconsistencia de Naming
**Problema:** Mezcla de camelCase y kebab-case en nombres de archivos

| camelCase | kebab-case |
|-----------|------------|
| `activePoints.ts` | `apertura-caja.ts` |
| `cuadreCaja.ts` | `balance-completo.ts` |
| `cierreReporte.ts` | `movimientos-saldo.ts` |

**Recomendación:** Estandarizar a kebab-case para consistencia con URLs

---

## 4. FRONTEND - ANÁLISIS COMPLETO

### 4.1 Componentes por Categoría

#### Administración (20 componentes)
```
admin/
├── ActivePointsReport.tsx      ✅
├── AdminDashboard.tsx           ✅
├── AperturasPendientes.tsx      ✅
├── CierresAdminMejorado.tsx     ✅
├── CierresDiariosResumen.tsx    ✅
├── ContabilidadPorPunto.tsx     ✅
├── CurrencyBehaviorManager.tsx  ✅
├── CurrencyManagement.tsx       🔴 DUPLICADO (con management/)
├── EditCurrencyDialog.tsx       ✅
├── EditPointDialog.tsx          ✅
├── EditUserDialog.tsx           ✅
├── FreePointButton.tsx          ✅
├── PermissionApprovals.tsx      ✅
├── ResetPasswordDialog.tsx      ✅
├── SaldoInicialManagement.tsx   ✅
├── SaldoServientregaAdmin.tsx   ✅
├── ServiciosExternosAdmin.tsx   ✅
├── ServientregaAnulaciones.tsx  ✅
├── ServientregaInformes.tsx     ✅
├── SystemHealthDashboard.tsx    ✅
├── TransferAcceptance.tsx       ✅
└── TransferApprovals.tsx        ✅
```

#### Cambio de Divisas (11 componentes)
```
exchange/
├── AdminExchangeBrowser.tsx     ✅
├── CompletePaymentForm.tsx      ✅
├── CurrencyBehaviorInfo.tsx     ✅
├── CurrencyDetailForm.tsx       ✅
├── CustomerDataForm.tsx         ✅
├── DeliveryDetailsForm.tsx      ✅
├── ExchangeDetailsForm.tsx      ✅
├── ExchangeForm.tsx             ✅ Core
├── ExchangeFormFields.tsx       ⚠️ Verificar uso
├── ExchangeList.tsx             ✅
├── ExchangeManagement.tsx       ✅
├── ExchangeSteps.tsx            ✅
├── PartialExchangeForm.tsx      ✅
├── PartialExchangesList.tsx     ✅
├── PartialPaymentForm.tsx       ✅
└── PendingExchangesList.tsx     ✅
```

### 4.2 Servicios HTTP

| Servicio | Líneas | Descripción | Estado |
|----------|--------|-------------|--------|
| `apiService.ts` | ~400 | Wrapper fetch con retry, backoff, idempotency | ✅ Principal |
| `axiosInstance.ts` | ~80 | Instancia Axios | ⚠️ Duplicado |

**Recomendación:** Consolidar en `apiService.ts` (tiene más features)

### 4.3 Hooks Personalizados

| Hook | Líneas | Propósito |
|------|--------|-----------|
| `useAuth.tsx` | ~200 | Contexto de autenticación |
| `useAsyncOperation.ts` | ~100 | Manejo de operaciones async |
| `useExchangeCalculations.ts` | ~150 | Cálculos de cambio |
| `useCuadreCaja.ts` | ~300 | Lógica de cuadre |

### 4.4 Sistemas de Notificación Duplicados

**Problema:** Se usan DOS sistemas de toast simultáneamente:

1. **Sonner (moderno):**
   ```typescript
   import { toast } from "sonner";
   // Usado en: 35+ archivos
   ```

2. **Legacy (shadcn/ui):**
   ```typescript
   import { toast } from "@/hooks/use-toast";
   // Usado en: 29+ archivos
   ```

**Archivos legacy a eliminar:**
- `hooks/use-toast.ts`
- `components/ui/toast.tsx`
- `components/ui/toaster.tsx`

### 4.5 Componentes Duplicados

| Componente | Ubicación 1 | Ubicación 2 | Recomendación |
|------------|-------------|-------------|---------------|
| CurrencyManagement | `admin/` | `management/` | Eliminar `management/` |
| Reports | `Reports.tsx` | `ReportsImproved.tsx` | Consolidar |
| CuadreCaja | `CuadreCajaMejorado.tsx` | `CuadreCajaConReporte.tsx` | Consolidar |

### 4.6 Archivos Huérfanos (Sin Imports)

| Archivo | Razón |
|---------|-------|
| `dashboard/OldPointSelector.tsx` | Comentado en Dashboard.tsx |
| `reports/Reports.backup.tsx` | Archivo de respaldo |
| `caja/CuadreCajaPage.tsx` | No aparece en imports |
| `exchange/ExchangeFormFields.tsx` | Verificar uso |

---

## 5. BASE DE DATOS - SCHEMA ANALYSIS

### 5.1 Modelos por Funcionalidad

#### A. Autenticación y Usuarios (2 modelos)
| Modelo | Campos | Relaciones |
|--------|--------|------------|
| `Usuario` | 15 | 25 relaciones |
| `Permiso` | 12 | 3 relaciones |

#### B. Puntos y Configuración (2 modelos)
| Modelo | Campos Clave |
|--------|--------------|
| `PuntoAtencion` | nombre, direccion, ciudad, servientrega_* (4 campos) |
| `ConfiguracionHorario` | hora_entrada_minima, hora_salida_maxima, etc. |

#### C. Monedas y Saldos (5 modelos)
| Modelo | Propósito |
|--------|-----------|
| `Moneda` | Catálogo de divisas |
| `Saldo` | Saldo actual por punto/moneda |
| `SaldoInicial` | Asignación de saldo inicial |
| `MovimientoSaldo` | Auditoría de transacciones |
| `HistorialSaldo` | Historial histórico |

#### D. Operaciones (2 modelos)
| Modelo | Campos Notables |
|--------|-----------------|
| `CambioDivisa` | 30+ campos incluyendo tasas diferenciadas, abonos, transferencias |
| `Recibo` | numero_recibo, datos_operacion (JSON) |

#### E. Transferencias (2 modelos)
| Modelo | Estados |
|--------|---------|
| `Transferencia` | PENDIENTE → EN_TRANSITO → COMPLETADO/APROBADO/RECHAZADO/CANCELADO |
| `SolicitudSaldo` | PENDIENTE, APROBADA, RECHAZADA |

#### F. Jornadas y Asistencia (3 modelos)
| Modelo | Campos |
|--------|--------|
| `Jornada` | fecha_inicio, fecha_almuerzo, fecha_regreso, fecha_salida |
| `SalidaEspontanea` | motivo, duracion_minutos |
| `AperturaCaja` | saldo_esperado, conteo_fisico, estado |

#### G. Cierres (3 modelos)
| Modelo | Descripción |
|--------|-------------|
| `CierreDiario` | Cierre diario del punto |
| `CuadreCaja` | Cuadre por usuario |
| `DetalleCuadreCaja` | Detalle por moneda |

#### H. Servicios Externos (5 modelos)
| Modelo | Propósito |
|--------|-----------|
| `ServicioExternoMovimiento` | Movimientos |
| `ServicioExternoSaldo` | Saldos por servicio |
| `ServicioExternoAsignacion` | Asignaciones |
| `ServicioExternoCierreDiario` | Cierres |
| `ServicioExternoDetalleCierre` | Detalles |

#### I. Servientrega (7 modelos)
| Modelo | Descripción |
|--------|-------------|
| `ServientregaRemitente` | Remitentes |
| `ServientregaDestinatario` | Destinatarios |
| `ServientregaGuia` | Guías de envío |
| `ServientregaSaldo` | Saldos |
| `ServientregaHistorialSaldo` | Historial |
| `ServientregaSolicitudSaldo` | Solicitudes |
| `ServientregaSolicitudAnulacion` | Anulaciones |

### 5.2 Enums del Sistema (17)

| Enum | Valores |
|------|---------|
| `RolUsuario` | SUPER_USUARIO, ADMIN, OPERADOR, CONCESION, ADMINISTRATIVO |
| `TipoMovimiento` | INGRESO, EGRESO, TRANSFERENCIA_ENTRANTE/SALIENTE, etc. |
| `EstadoTransferencia` | PENDIENTE, EN_TRANSITO, COMPLETADO, APROBADO, RECHAZADO, CANCELADO |
| `EstadoJornada` | ACTIVO, ALMUERZO, COMPLETADO, CANCELADO |
| `ServicioExterno` | YAGANASTE, BANCO_GUAYAQUIL, WESTERN, SERVIENTREGA, etc. |

### 5.3 Problemas de BD Identificados

#### 🔴 CRÍTICO: Índices Duplicados
```prisma
// En Moneda:
@@index([codigo])
@@index([codigo], map: "idx_moneda_codigo")  // DUPLICADO

// En MovimientoSaldo:
@@index([moneda_id])
@@index([moneda_id], map: "idx_movsaldo_moneda")  // DUPLICADO

// En CierreDiario:
@@unique([fecha, punto_atencion_id])
@@index([fecha, punto_atencion_id])  // DUPLICADO (unique ya es index)
```

**Acción:** Eliminar índices duplicados en migración

#### 🔴 CRÍTICO: Constraints UNIQUE con Campos Opcionales
```prisma
// CambioDivisa:
numero_recibo            String?  @unique
numero_recibo_abono      String?  @unique
numero_recibo_completar  String?  @unique
```

**Problema:** PostgreSQL solo permite un NULL en campos UNIQUE

#### 🟡 ADVERTENCIA: Posible Redundancia
| Modelo 1 | Modelo 2 | Veredicto |
|----------|----------|-----------|
| `HistorialSaldo` | `MovimientoSaldo` | ⚠️ Podrían consolidarse |

#### 🟡 ADVERTENCIA: Campos JSON sin Schema
| Modelo | Campo | Riesgo |
|--------|-------|--------|
| `Jornada` | `ubicacion_inicio`, `ubicacion_salida` | Sin validación |
| `CierreDiario` | `diferencias_reportadas` | Sin estructura |
| `AperturaCaja` | `saldo_esperado`, `conteo_fisico`, `diferencias` | Complejos |

---

## 6. FLUJOS CRÍTICOS DEL SISTEMA

### 6.1 Mapa de Flujos

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJOS CRÍTICOS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │    LOGIN     │───▶│   APERTURA   │───▶│   OPERACIÓN  │          │
│  │              │    │     CAJA     │    │              │          │
│  └──────────────┘    └──────────────┘    └──────┬───────┘          │
│                                                  │                  │
│                         ┌────────────────────────┼────────┐         │
│                         ▼                        ▼        ▼         │
│                   ┌──────────┐            ┌──────────┐ ┌──────────┐ │
│                   │  CAMBIO  │            │ TRANSFER │ │ SERV.EXT │ │
│                   │  DIVISA  │            │          │ │          │ │
│                   └────┬─────┘            └────┬─────┘ └────┬─────┘ │
│                        │                       │            │       │
│                        ▼                       ▼            ▼       │
│                   ┌──────────┐            ┌──────────┐ ┌──────────┐ │
│                   │  RECIBO  │            │ CIERRA   │ │ CIERRA   │ │
│                   │          │            │ TRANSFER │ │ SERVICIO │ │
│                   └──────────┘            └────┬─────┘ └────┬─────┘ │
│                                                │            │       │
│                                                ▼            ▼       │
│                                          ┌──────────┐ ┌──────────┐ │
│                                          │  CIERRE  │ │  CIERRE  │ │
│                                          │  DIARIO  │ │  DIARIO  │ │
│                                          │          │ │          │ │
│                                          └──────────┘ └──────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Flujo 1: Cambio de Divisas

#### APIs Utilizadas
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/exchanges` | POST | Crear cambio |
| `/api/exchanges/:id/cerrar` | PATCH | Cerrar pendiente |
| `/api/exchanges/:id/completar` | PATCH | Completar cambio |

#### Componentes Involucrados
**Frontend:**
- `ExchangeForm.tsx` - Formulario principal
- `ExchangeSteps.tsx` - Wizard de pasos
- `PendingExchangesList.tsx` - Pendientes
- `exchangeService.ts` - API

**Backend:**
- `exchanges.ts` - ~2000 líneas
- `saldoValidation.ts` - `validarSaldoCambioDivisa`
- `movimientoSaldoService.ts`

#### Validaciones
- ✅ Saldo suficiente
- ✅ Normalización USD (COMPRA/VENTA)
- ✅ Tasas de cambio (billetes/monedas)
- ✅ Idempotencia

### 6.3 Flujo 2: Transferencias

#### Estados
```
PENDIENTE ──▶ EN_TRANSITO ──▶ COMPLETADO/APROBADO
     │              │
     ▼              ▼
 CANCELADO      RECHAZADO
```

#### APIs Utilizadas
| Endpoint | Descripción |
|----------|-------------|
| `/api/transfers` | Crear/listar |
| `/api/transfer-approvals/:id/accept` | Aceptar |
| `/api/transfer-approvals/:id/approve` | Aprobar (admin) |

#### Componentes Involucrados
**Frontend:**
- `TransferForm.tsx`
- `TransferList.tsx`
- `TransferAcceptance.tsx`

**Backend:**
- `transfers.ts`
- `transfer-approvals.ts`
- `transferController.ts`
- `transferCreationService.ts`

### 6.4 Flujo 3: Apertura de Caja

#### Estados
```
PENDIENTE ──▶ EN_CONTEO ──▶ CUADRADO ──▶ ABIERTA
                    │
                    ▼
              CON_DIFERENCIA ──▶ RESUELTO ──▶ ABIERTA
```

#### APIs Utilizadas
| Endpoint | Descripción |
|----------|-------------|
| `/api/apertura-caja/iniciar` | Iniciar |
| `/api/apertura-caja/conteo` | Guardar conteo |
| `/api/apertura-caja/confirmar` | Confirmar |
| `/api/apertura-caja/:id/aprobar` | Aprobar diferencia |

#### Componentes Involucrados
**Frontend:**
- `AperturaCaja.tsx` (~788 líneas)

**Backend:**
- `apertura-caja.ts` (~774 líneas)

### 6.5 Flujo 4: Servicios Externos

#### Servicios Soportados
```typescript
YAGANASTE, BANCO_GUAYAQUIL, WESTERN, PRODUBANCO,
BANCO_PACIFICO, INSUMOS_OFICINA, INSUMOS_LIMPIEZA,
SERVIENTREGA, OTROS
```

#### APIs Utilizadas
| Endpoint | Descripción |
|----------|-------------|
| `/api/servicios-externos/movimientos` | CRUD movimientos |
| `/api/servicios-externos/asignaciones` | Asignar saldo |
| `/api/servientrega/generar-guia` | Generar guía |
| `/api/servientrega/anular-guia` | Anular guía |

---

## 7. CÓDIGO INSERVIBLE IDENTIFICADO

### 7.1 Archivos Huérfanos del Backend

| Archivo | Ubicación | Razón | Acción |
|---------|-----------|-------|--------|
| `cierreParcial.ts` | `routes/` | No importado en index.ts | 🔴 Registrar o eliminar |
| `occupiedPoints.ts.back` | `routes/` | Archivo backup | 🟡 Eliminar |
| `exchangeCalculationService.ts` | `services/exchange/` | 0 referencias | 🟡 Eliminar |
| `exchangeSaldoService.ts` | `services/exchange/` | 0 referencias + PrismaClient duplicado | 🔴 Eliminar |
| `exchangeValidationService.ts` | `services/exchange/` | 0 referencias + PrismaClient duplicado | 🔴 Eliminar |
| `typeValidation.ts` | `middleware/` | 0 referencias | 🟡 Eliminar |

### 7.2 Archivos Huérfanos del Frontend

| Archivo | Ubicación | Razón | Acción |
|---------|-----------|-------|--------|
| `OldPointSelector.tsx` | `dashboard/` | Comentado en Dashboard.tsx | 🟡 Eliminar |
| `Reports.backup.tsx` | `reports/` | Archivo backup | 🟡 Eliminar |
| `CuadreCajaPage.tsx` | `caja/` | No aparece en imports | 🔴 Verificar y eliminar |
| `ExchangeFormFields.tsx` | `exchange/` | Verificar uso | 🟡 Verificar |

### 7.3 Código Comentado/Deshabilitado

**Ubicación:** `server/controllers/transferController.ts` (líneas 252-290)
```typescript
// ⚠️ IMPORTANTE: NO CONTABILIZAR AL CREAR
// La contabilización se realiza SOLO cuando la transferencia es APROBADA
// ...
// ❌ CÓDIGO DESHABILITADO - Causaba duplicación
```

**Riesgo:** Código muerto que documenta problemas pasados

### 7.4 Duplicados de PrismaClient

```typescript
// ❌ Problema en 3 archivos:
- exchangeSaldoService.ts
- exchangeValidationService.ts
- occupiedPoints.ts.back

// ✅ Solución: Usar siempre
import prisma from "../lib/prisma.js";
```

---

## 8. PROBLEMAS CRÍTICOS Y RECOMENDACIONES

### 8.1 Problemas Críticos (Prioridad Alta)

| # | Problema | Impacto | Solución |
|---|----------|---------|----------|
| 1 | Ruta `cierreParcial.ts` no registrada | Funcionalidad inaccesible | Registrar en `index.ts` o eliminar |
| 2 | Múltiples PrismaClient | Agotamiento de conexiones | Unificar imports |
| 3 | Código duplicado validación saldo | Inconsistencias | Centralizar en servicio |
| 4 | Índices duplicados BD | Performance degradada | Eliminar en migración |
| 5 | Constraints UNIQUE con NULL | Problemas de integridad | Revisar diseño |
| 6 | Sistemas de toast duplicados | Confusión de UX | Migrar todo a Sonner |

### 8.2 Recomendaciones de Refactorización

#### Inmediatas (Semana 1)
1. **Eliminar archivos huérfanos:**
   ```bash
   rm server/routes/cierreParcial.ts
   rm server/routes/occupiedPoints.ts.back
   rm server/services/exchange/*.ts
   rm server/middleware/typeValidation.ts
   rm src/components/dashboard/OldPointSelector.tsx
   rm src/components/reports/Reports.backup.tsx
   ```

2. **Fix PrismaClient duplicados:**
   ```typescript
   // Reemplazar en 3 archivos:
   const prisma = new PrismaClient();
   // Por:
   import prisma from "../lib/prisma.js";
   ```

3. **Estandarizar naming de archivos:**
   ```bash
   # Renombrar a kebab-case
   mv cuadreCaja.ts cuadre-caja.ts
   mv cierreReporte.ts cierre-reporte.ts
   ```

#### Corto Plazo (Semana 2-3)
4. **Consolidar sistemas de toast:**
   - Migrar 29 archivos de `use-toast` a `sonner`
   - Eliminar archivos legacy

5. **Consolidar componentes duplicados:**
   - Unificar `CurrencyManagement`
   - Unificar `Reports`

6. **Fix índices duplicados en BD:**
   ```prisma
   // Eliminar:
   @@index([codigo], map: "idx_moneda_codigo")
   @@index([moneda_id], map: "idx_movsaldo_moneda")
   @@index([fecha, punto_atencion_id])
   ```

#### Mediano Plazo (Mes 1-2)
7. **Crear servicio unificado de saldos:**
   ```typescript
   // services/saldoService.ts
   export const saldoService = {
     validarSaldoSuficiente,
     actualizarSaldo,
     calcularDesgloseFisico,
     // ...
   };
   ```

8. **Estandarizar respuestas de API:**
   ```typescript
   interface ApiResponse<T> {
     success: boolean;
     data?: T;
     error?: string;
     timestamp: string;
   }
   ```

9. **Implementar tests unitarios:**
   - Jest para backend
   - React Testing Library para frontend

### 8.3 Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Agotamiento de conexiones BD | Media | Alto | Unificar PrismaClient |
| Race conditions en saldos | Media | Alto | Centralizar validaciones |
| Datos inconsistentes | Baja | Alto | Revisar constraints |
| Deuda técnica creciente | Alta | Medio | Plan de refactorización |

---

## 9. PLAN DE LIMPIEZA Y REFACTORIZACIÓN

### 9.1 Fase 1: Limpieza de Código Muerto (Día 1-2)

```bash
# Backend
rm server/routes/cierreParcial.ts
rm server/routes/occupiedPoints.ts.back
rm server/services/exchange/exchangeCalculationService.ts
rm server/services/exchange/exchangeSaldoService.ts
rm server/services/exchange/exchangeValidationService.ts
rm server/middleware/typeValidation.ts

# Frontend
rm src/components/dashboard/OldPointSelector.tsx
rm src/components/reports/Reports.backup.tsx
rm src/components/caja/CuadreCajaPage.tsx  # Verificar primero
rm src/components/management/CurrencyManagement.tsx

# Limpiar imports en index.ts
```

### 9.2 Fase 2: Fix Críticos (Día 3-5)

1. Unificar PrismaClient
2. Estandarizar naming de archivos
3. Eliminar índices duplicados en BD
4. Consolidar sistemas de toast

### 9.3 Fase 3: Refactorización (Semana 2-4)

1. Crear servicio unificado de saldos
2. Consolidar componentes duplicados
3. Estandarizar respuestas de API
4. Implementar tests básicos

### 9.4 Fase 4: Documentación (Semana 4)

1. Documentar APIs con OpenAPI/Swagger
2. Crear README técnico actualizado
3. Documentar flujos de negocio
4. Crear guía de contribución

---

## 10. APÉNDICES

### A. Scripts Útiles

```bash
# Verificar archivos sin imports
grep -r "import.*from" server/ src/ | cut -d'"' -f2 | sort | uniq > imports.txt
find server -name "*.ts" | grep -v imports.txt

# Contar líneas de código
find server -name "*.ts" -not -path "*/node_modules/*" | xargs wc -l
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l

# Buscar console.log
find server -name "*.ts" -exec grep -l "console.log" {} \;
```

### B. Checklist de QA

- [ ] Todos los archivos tienen un propósito claro
- [ ] No hay código duplicado significativo
- [ ] Todas las rutas están registradas
- [ ] Todas las importaciones usan la instancia única de PrismaClient
- [ ] Los índices de BD no están duplicados
- [ ] No hay archivos de backup en el codebase
- [ ] El naming es consistente
- [ ] Las respuestas de API son consistentes
- [ ] Hay documentación para funciones complejas
- [ ] Los tests pasan (cuando se implementen)

---

**Fin del Informe QA**

*Documento generado el 2026-03-24*
*Para actualizaciones, revisar el repositorio de documentación*
