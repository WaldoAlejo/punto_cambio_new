# 📘 MANUAL COMPLETO - SISTEMA PUNTO CAMBIO

**Versión:** 1.0.0  
**Fecha:** 2026-03-24  
**Sistema:** Casa de Cambio y Servicios Financieros  

---

## 📑 TABLA DE CONTENIDOS

1. [Introducción](#1-introducción)
2. [Roles y Permisos](#2-roles-y-permisos)
3. [Guía de Inicio](#3-guía-de-inicio)
4. [Módulos del Sistema](#4-módulos-del-sistema)
5. [Flujos de Trabajo](#5-flujos-de-trabajo)
6. [Solución de Problemas](#6-solución-de-problemas)
7. [Preguntas Frecuentes](#7-preguntas-frecuentes)

---

## 1. INTRODUCCIÓN

### 1.1 ¿Qué es Punto Cambio?

Punto Cambio es un sistema integral de gestión para casas de cambio que permite:

- **Cambio de divisas** (compra y venta)
- **Transferencias** entre puntos de atención
- **Servicios externos** (Western Union, Servientrega, Bancos)
- **Control de caja** (aperturas, cierres, cuadres)
- **Gestión de personal** (jornadas, permisos)
- **Reportes y contabilidad**

### 1.2 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     PUNTO CAMBIO                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐        ┌──────────────┐                 │
│   │   FRONTEND   │◀──────▶│   BACKEND    │                 │
│   │   (React)    │  REST  │  (Express)   │                 │
│   └──────────────┘        └──────┬───────┘                 │
│                                  │                          │
│                                  ▼                          │
│                          ┌──────────────┐                  │
│                          │  POSTGRESQL  │                  │
│                          │   (Prisma)   │                  │
│                          └──────────────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Requisitos Técnicos

- **Navegador:** Chrome, Firefox, Edge (últimas versiones)
- **Resolución mínima:** 1280x720
- **Conexión:** Internet estable
- **Cámara:** Requerida para verificación de apertura (opcional según config)

---

## 2. ROLES Y PERMISOS

### 2.1 Tipos de Usuarios

| Rol | Descripción | Acceso Principal |
|-----|-------------|------------------|
| **SUPER_USUARIO** | Administrador total del sistema | Todo |
| **ADMIN** | Administrador de sucursal | Gestión de usuarios, puntos, reportes |
| **OPERADOR** | Cajero/Operador de punto | Cambios, transferencias, cierres |
| **CONCESION** | Supervisor de concesión | Aprobaciones, aceptación de transferencias |
| **ADMINISTRATIVO** | Personal administrativo | Reportes, gestión de horarios |

### 2.2 Matriz de Permisos

| Funcionalidad | SUPER_USUARIO | ADMIN | OPERADOR | CONCESION | ADMINISTRATIVO |
|---------------|:-------------:|:-----:|:--------:|:---------:|:--------------:|
| **Cambio de Divisas** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Transferencias** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Aceptar Transferencias** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Aprobaciones** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Gestión de Usuarios** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Gestión de Puntos** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Reportes** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cierre Diario** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Apertura de Caja** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Servicios Externos** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Gestión de Horarios** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Permisos de Salida** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Contabilidad General** | ✅ | ✅ | ❌ | ❌ | ✅ |

### 2.3 Jerarquía de Aprobaciones

```
SUPER_USUARIO
     │
     ├──▶ Puede aprobar todo
     │
ADMIN
     │
     ├──▶ Puede aprobar: transferencias, permisos, aperturas con diferencia
     │
CONCESION
     │
     ├──▶ Puede aprobar: transferencias hacia su punto, permisos de operadores
     │
OPERADOR/ADMINISTRATIVO
     │
     └──▶ Solo operaciones dentro de su punto asignado
```

---

## 3. GUÍA DE INICIO

### 3.1 Primer Acceso

1. **Abrir navegador** e ir a la URL del sistema
2. **Ingresar credenciales:**
   - Usuario: proporcionado por administrador
   - Contraseña: temporal (debe cambiarse en primer login)
3. **Cambiar contraseña** (obligatorio en primer acceso)
4. **Seleccionar punto de atención** (si es OPERADOR/CONCESION)

### 3.2 Flujo Diario del Operador

```
┌──────────────────────────────────────────────────────────────┐
│                    DÍA TÍPICO DEL OPERADOR                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. LOGIN                                                    │
│     └── Ingresar al sistema                                  │
│                                                              │
│  2. SELECCIONAR PUNTO                                        │
│     └── Elegir punto de atención disponible                  │
│                                                              │
│  3. APERTURA DE CAJA                                         │
│     └── Contar efectivo físico                               │
│     └── Verificar servicios externos                         │
│     └── Confirmar apertura                                   │
│                                                              │
│  4. OPERACIONES DEL DÍA                                      │
│     ├── Cambios de divisas                                   │
│     ├── Transferencias                                       │
│     ├── Servicios externos                                   │
│     └── Recibir transferencias                               │
│                                                              │
│  5. CIERRE DIARIO                                            │
│     └── Contar efectivo físico                               │
│     └── Cuadrar caja                                         │
│     └── Generar reporte                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Iniciar Jornada (Control de Horarios)

El sistema registra automáticamente:
- **Hora de entrada**
- **Tiempo de almuerzo** (pausa/reanudación)
- **Salidas espontáneas** (banco, diligencias)
- **Hora de salida**

**Para registrar entrada:**
1. Al hacer login, el sistema registra automáticamente el inicio
2. Se puede verificar en "Gestión de Horarios"

**Para almuerzo:**
1. Ir a "Gestión de Horarios"
2. Click en "Iniciar Almuerzo"
3. Al regresar, "Finalizar Almuerzo"

**Para salidas:**
1. Ir a "Permisos de Salida"
2. Seleccionar motivo (Banco, Diligencia, etc.)
3. Click en "Registrar Salida"
4. Al regresar, "Registrar Regreso"

---

## 4. MÓDULOS DEL SISTEMA

### 4.1 Cambio de Divisas

#### 4.1.1 Realizar un Cambio

1. Ir a **"Cambio de Divisas"** en el menú
2. Seleccionar:
   - **Tipo de operación:** COMPRA o VENTA
   - **Moneda origen:** La que entrega el cliente
   - **Moneda destino:** La que recibe el cliente
3. Ingresar monto
4. El sistema calcula automáticamente:
   - Tasa de cambio (según comportamiento de la moneda)
   - Monto destino
   - Desglose de billetes/monedas si aplica
5. Ingresar datos del cliente (nombre, documento, teléfono)
6. Verificar y confirmar
7. Imprimir recibo

#### 4.1.2 Cambios Parciales (Abonos)

Para operaciones donde el cliente no tiene todo el efectivo:

1. En el formulario de cambio, seleccionar **"Cambio Parcial"**
2. Ingresar el **abono inicial** (lo que paga ahora)
3. El sistema calcula el **saldo pendiente**
4. Establecer **fecha de compromiso** de pago
5. Guardar cambio parcial
6. El sistema genera dos recibos:
   - Recibo de abono inicial
   - Referencia del cambio pendiente

**Para completar un cambio parcial:**
1. Ir a **"Cambios Pendientes"**
2. Buscar el cambio por número de recibo o documento
3. Click en **"Completar Pago"**
4. Ingresar el pago restante
5. Confirmar y generar recibo final

#### 4.1.3 Cambios con Transferencia

Cuando el pago/recibo es por transferencia bancaria:

1. En el formulario, seleccionar **"Método de entrega: Transferencia"**
2. Ingresar:
   - Número de transferencia
   - Banco
   - Subir imagen del comprobante
3. El sistema marca el cambio como pendiente hasta verificación
4. Una vez verificado, se completa la operación

### 4.2 Transferencias

#### 4.2.1 Enviar Transferencia

1. Ir a **"Transferencias"** en el menú
2. Click en **"Nueva Transferencia"**
3. Seleccionar:
   - **Punto destino:** A dónde se envía
   - **Moneda:** Tipo de divisa
   - **Monto:** Cantidad a transferir
   - **Descripción:** Motivo de la transferencia
4. Confirmar (requiere aprobación si monto > límite)

#### 4.2.2 Aceptar Transferencia

1. Ir a **"Recibir Transferencias"**
2. Ver lista de transferencias pendientes
3. Verificar físicamente el efectivo recibido
4. Click en **"Aceptar"** y confirmar

#### 4.2.3 Estados de Transferencia

| Estado | Descripción | Acción Requerida |
|--------|-------------|------------------|
| **PENDIENTE** | Esperando aprobación de concesión/admin | Aprobación |
| **EN_TRANSITO** | Aprobada, en camino al destino | Recepción física |
| **COMPLETADO** | Recibida y aceptada en destino | Ninguna |
| **APROBADO** | Aprobada por admin/concesión | Envío físico |
| **RECHAZADO** | Rechazada por admin/concesión | Ninguna |
| **CANCELADO** | Cancelada por origen | Ninguna |

### 4.3 Apertura de Caja

#### 4.3.1 Proceso de Apertura

```
┌────────────────────────────────────────────────────────────┐
│                  FLUJO DE APERTURA                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. INICIAR                                                │
│     └── El sistema muestra saldos esperados                │
│         (desde el cierre del día anterior)                 │
│                                                            │
│  2. CONTEO FÍSICO                                          │
│     └── Contar billetes y monedas de cada divisa           │
│     └── Contar saldos de servicios externos                │
│     └── Ingresar cantidades en el sistema                  │
│                                                            │
│  3. VERIFICACIÓN                                           │
│     └── El sistema compara esperado vs físico              │
│                                                            │
│  4. RESULTADO                                              │
│     ├── CUADRADO: Todo coincide → Apertura automática      │
│     └── CON_DIFERENCIA: Discrepancia → Requiere aprobación │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Estados de Apertura

| Estado | Significado | Siguiente Paso |
|--------|-------------|----------------|
| **PENDIENTE** | Apertura iniciada | Ingresar conteo |
| **EN_CONTEO** | Conteo en progreso | Confirmar conteo |
| **CUADRADO** | Todo coincide | Apertura automática |
| **CON_DIFERENCIA** | Hay diferencias | Esperar aprobación admin |
| **RESUELTO** | Diferencia aprobada | Apertura completada |
| **ABIERTA** | Caja operativa | Iniciar operaciones |
| **RECHAZADO** | Apertura rechazada | Corregir y reiniciar |

### 4.4 Cierre Diario

#### 4.4.1 Proceso de Cierre

1. Ir a **"Cierre Diario"**
2. El sistema muestra:
   - Todas las operaciones del día
   - Saldos esperados por moneda
   - Transferencias enviadas/recibidas
   - Servicios externos realizados
3. Realizar conteo físico de cada moneda
4. Ingresar cantidades contadas
5. El sistema calcula diferencias
6. Si hay diferencias, ingresar justificación
7. Confirmar cierre
8. Generar y guardar reporte

#### 4.4.2 Reporte de Cierre

El reporte incluye:
- Resumen por moneda (entradas, salidas, saldo final)
- Detalle de cambios de divisas
- Detalle de transferencias
- Detalle de servicios externos
- Cuadre de caja (sistema vs físico)
- Firmas de responsables

### 4.5 Servicios Externos

#### 4.5.1 Tipos de Servicios

| Servicio | Descripción | Tipo de Saldo |
|----------|-------------|---------------|
| **WESTERN UNION** | Giros internacionales | Servicio Externo USD |
| **SERVIENTREGA** | Envíos de paquetería | Servicio Externo USD |
| **BANCO GUAYAQUIL** | Transacciones bancarias | Servicio Externo USD |
| **PRODUBANCO** | Transacciones bancarias | Servicio Externo USD |
| **YAGANASTE** | Pagos de servicios | Servicio Externo USD |
| **INSUMOS OFICINA** | Compras de insumos | Saldo General USD |
| **INSUMOS LIMPIEZA** | Compras de limpieza | Saldo General USD |

#### 4.5.2 Registrar Movimiento

1. Ir a **"Servicios Externos"**
2. Seleccionar el servicio
3. Seleccionar tipo: **INGRESO** o **EGRESO**
4. Ingresar monto
5. Ingresar descripción/referencia
6. Confirmar (si es EGRESO, valida saldo disponible)

#### 4.5.3 Servientrega - Generar Guía

1. Ir a **"Guía Servientrega"**
2. Ingresar datos del **remitente**:
   - Nombre completo
   - Cédula/RUC
   - Dirección
   - Teléfono
   - Email
3. Ingresar datos del **destinatario**:
   - Nombre completo
   - Cédula/RUC
   - Dirección
   - Ciudad/Provincia
   - Teléfono
4. Ingresar datos de la **mercancía**:
   - Descripción
   - Valor declarado
   - Peso
   - Dimensiones (alto, ancho, largo)
5. Seleccionar **tipo de envío** (estándar, exprés)
6. El sistema calcula costo automáticamente
7. Verificar y confirmar
8. El sistema genera guía con PDF

#### 4.5.4 Servientrega - Anular Guía

1. Ir a **"Guía Servientrega"** → **"Historial"**
2. Buscar la guía a anular
3. Click en **"Solicitar Anulación"**
4. Ingresar motivo de anulación
5. Confirmar
6. **Nota:** La anulación requiere aprobación de administrador

### 4.6 Gestión de Horarios y Permisos

#### 4.6.1 Control de Jornada

El sistema registra automáticamente:
- **Entrada:** Al iniciar sesión
- **Almuerzo:** Pausa manual
- **Salidas:** Registro manual con motivo
- **Salida:** Al cerrar jornada

**Visualizar mi jornada:**
1. Ir a **"Gestión de Horarios"**
2. Ver calendario con:
   - Horas trabajadas
   - Almuerzos tomados
   - Salidas registradas
   - Minutos totales

#### 4.6.2 Solicitar Permiso

Para ausencias programadas (vacaciones, citas médicas, etc.):

1. Ir a **"Permisos de Salida"**
2. Click en **"Nuevo Permiso"**
3. Seleccionar:
   - **Tipo:** Personal, Salud, Oficial, Otro
   - **Fecha inicio:** Desde cuándo
   - **Fecha fin:** Hasta cuándo
   - **Descripción:** Motivo detallado
4. Adjuntar documento si aplica
5. Enviar solicitud

**Estados del permiso:**
- **PENDIENTE:** Esperando aprobación
- **APROBADO:** Aprobado por admin/concesión
- **RECHAZADO:** Rechazado (ver observaciones)

### 4.7 Reportes

#### 4.7.1 Reportes Disponibles

| Reporte | Descripción | Roles |
|---------|-------------|-------|
| **Contabilidad General** | Movimientos de todo el sistema | ADMIN, SUPER |
| **Contabilidad por Punto** | Movimientos de un punto específico | ADMIN, SUPER, OPERADOR |
| **Control por Punto** | Resumen de operaciones por punto | ADMIN, SUPER |
| **Reportes Generales** | Estadísticas y gráficos | ADMIN, SUPER |
| **Cierres Diarios** | Historial de cierres | ADMIN, SUPER |
| **Aperturas Pendientes** | Aperturas con diferencia | ADMIN, SUPER |

#### 4.7.2 Filtros de Reportes

La mayoría de reportes permiten filtrar por:
- **Rango de fechas** (desde/hasta)
- **Punto de atención**
- **Usuario**
- **Tipo de operación**
- **Moneda**

#### 4.7.3 Exportar Reportes

Los reportes pueden exportarse en:
- **PDF:** Para impresión y archivos
- **Excel:** Para análisis adicionales

---

## 5. FLUJOS DE TRABAJO

### 5.1 Flujo: Cambio de Divisas Completo

```
CLIENTE LLEGA
      │
      ▼
┌─────────────────────────────────────────┐
│ 1. IDENTIFICAR TIPO DE OPERACIÓN        │
│    ├─ ¿Cliente quiere comprar o vender? │
│    └─ ¿Qué moneda tiene? ¿Cuál quiere?  │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ 2. CONSULTAR TASA                       │
│    ├─ El sistema muestra tasa actual    │
│    ├─ Diferenciada billetes/monedas     │
│    └─ Comportamiento: MULTIPLICA/DIVIDE │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ 3. INGRESAR DATOS                       │
│    ├─ Monto                             │
│    ├─ Datos del cliente (obligatorio)   │
│    └─ Método de entrega (efectivo/trans)│
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ 4. VERIFICAR SALDO                      │
│    ├─ Sistema valida saldo suficiente   │
│    ├─ Verifica fondos para entregar     │
│    └─ Si no hay saldo: ERROR            │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ 5. CONFIRMAR OPERACIÓN                  │
│    ├─ Revisar montos finales            │
│    ├─ Aplicar idempotencia (anti-duplic)│
│    └─ Confirmar                         │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ 6. ENTREGAR Y RECIBIR                   │
│    ├─ Recibir divisa del cliente        │
│    ├─ Entregar divisa calculada         │
│    └─ Ambos firman si aplica            │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ 7. IMPRIMIR RECIBO                      │
│    ├─ Generar número de recibo único    │
│    ├─ Imprimir o enviar por email       │
│    └─ Guardar copia digital             │
└─────────────────────────────────────────┘
      │
      ▼
  OPERACIÓN COMPLETADA
```

### 5.2 Flujo: Transferencia entre Puntos

```
PUNTO A (Origen)              PUNTO B (Destino)
      │                              │
      ▼                              │
┌──────────────────┐                 │
│ 1. CREAR TRANSFERENCIA             │
│    Ingresar monto, moneda, destino │
│    y descripción                   │
└────────┬─────────┘                 │
         │                           │
         ▼                           │
┌──────────────────┐                 │
│ 2. VALIDAR SALDO  │                 │
│    Origen debe tener               │
│    fondos suficientes              │
└────────┬─────────┘                 │
         │                           │
         ▼                           │
┌──────────────────┐                 │
│ 3. ENVIAR A APROBACIÓN            │
│    Estado: PENDIENTE               │
└────────┬─────────┘                 │
         │                           │
         ▼                           │
┌──────────────────┐                 │
│ 4. APROBAR (Admin/Concesión)      │
│    Estado: EN_TRANSITO             │
└────────┬─────────┘                 │
         │                           │
         │ Enviar físicamente        │
         │───────────────────────────▶│
         │                           │
         │                      ┌────┴──────────────┐
         │                      │ 5. RECIBIR        │
         │                      │    Verificar físicamente
         │                      │    el contenido   │
         │                      └────┬──────────────┘
         │                           │
         │                      ┌────┴──────────────┐
         │                      │ 6. ACEPTAR        │
         │                      │    Estado:COMPLETADO│
         │                      └────┬──────────────┘
         │                           │
         ▼                           ▼
    ┌─────────────────────────────────────┐
    │ TRANSFERENCIA COMPLETADA            │
    │ Saldos actualizados en ambos puntos │
    └─────────────────────────────────────┘
```

### 5.3 Flujo: Servientrega - Envío de Paquete

```
┌────────────────────────────────────────────────────────────┐
│              PROCESO DE ENVÍO SERVIENTREGA                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. DATOS DEL REMITENTE                                    │
│     ├── Nombre completo                                    │
│     ├── Cédula/RUC                                         │
│     ├── Dirección completa                                 │
│     ├── Teléfono                                           │
│     └── Email                                              │
│                                                            │
│  2. DATOS DEL DESTINATARIO                                 │
│     ├── Nombre completo                                    │
│     ├── Cédula/RUC                                         │
│     ├── Dirección                                          │
│     ├── Ciudad/Provincia                                   │
│     └── Teléfono                                           │
│                                                            │
│  3. DATOS DEL PAQUETE                                      │
│     ├── Descripción del contenido                          │
│     ├── Valor declarado (para seguro)                      │
│     ├── Peso en kg                                         │
│     └── Dimensiones (A x L x A cm)                         │
│                                                            │
│  4. CALCULO DE TARIFA                                      │
│     ├── Sistema consulta API Servientrega                  │
│     ├── Calcula costo según peso/volumen                   │
│     └── Muestra valor total                                │
│                                                            │
│  5. VALIDACIÓN DE SALDO                                    │
│     ├── Verifica saldo Servientrega del punto              │
│     ├── Si saldo insuficiente: ERROR                       │
│     └── Si saldo OK: Continúa                              │
│                                                            │
│  6. GENERACIÓN DE GUÍA                                     │
│     ├── Sistema consume API Servientrega                   │
│     ├── Recibe número de guía                              │
│     ├── Recibe PDF de guía                                 │
│     └── Descuenta saldo del punto                          │
│                                                            │
│  7. ENTREGA AL CLIENTE                                     │
│     ├── Imprimir guía                                      │
│     ├── Pegar en paquete                                   │
│     └── Entregar copia al cliente                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 6. SOLUCIÓN DE PROBLEMAS

### 6.1 Errores Comunes

#### Error: "Saldo insuficiente"

**Causas:**
1. No hay suficiente efectivo de la moneda requerida
2. Fondos comprometidos en operaciones pendientes
3. Error de cálculo en cuadre anterior

**Solución:**
1. Verificar saldo real en "Dashboard"
2. Revisar operaciones pendientes
3. Si el saldo físico existe pero el sistema no lo refleja:
   - Reportar a administrador para ajuste

#### Error: "No se puede generar guía - Servientrega"

**Causas:**
1. Punto no tiene agencia Servientrega configurada
2. Saldo de Servientrega agotado
3. Error en API de Servientrega

**Solución:**
1. Verificar que el punto tenga configuración completa:
   - Agencia código
   - Agencia nombre
   - Alianza
   - Oficina alianza
2. Verificar saldo en "Saldo Servientrega"
3. Contactar administrador si persiste

#### Error: "No se puede cerrar jornada"

**Causas:**
1. Cierre de caja pendiente
2. Transferencias en estado EN_TRANSITO
3. Cambios pendientes sin completar

**Solución:**
1. Completar cierre diario en "Cierre Diario"
2. Verificar transferencias pendientes en "Transferencias"
3. Completar cambios parciales en "Cambios Pendientes"

#### Error: "Idempotency key already used"

**Causa:**
- Intento de procesar la misma operación dos veces

**Solución:**
1. Verificar si la operación ya se completó (revisar historial)
2. Si no aparece, esperar 30 segundos y reintentar
3. Si persiste, contactar soporte

### 6.2 Problemas de Conexión

#### No carga el sistema

1. Verificar conexión a internet
2. Limpiar caché del navegador (Ctrl+F5)
3. Probar en modo incógnito
4. Verificar si el servidor está activo

#### Lentitud en operaciones

1. Verificar velocidad de internet
2. Cerrar pestañas innecesarias
3. Verificar que no haya descargas en segundo plano
4. Si persiste, reportar a TI

### 6.3 Problemas de Impresión

#### No imprime recibos

1. Verificar que la impresora esté encendida
2. Verificar conexión de la impresora
3. En Windows: Panel de control → Impresoras → Verificar predeterminada
4. Intentar imprimir página de prueba
5. En el sistema: Verificar que el diálogo de impresión aparezca

#### Recibo mal formateado

1. Verificar que sea impresora térmica de 80mm
2. Verificar configuración de página en el navegador
3. Usar Chrome para mejor compatibilidad

---

## 7. PREGUNTAS FRECUENTES

### 7.1 General

**P: ¿Puedo usar el sistema en mi celular?**
R: Sí, el sistema es responsivo, pero se recomienda usar tablet o computadora para mejor experiencia.

**P: ¿Qué pasa si se me olvida cerrar mi jornada?**
R: El sistema registra automáticamente al salir, pero es responsabilidad del operador cerrar correctamente el día.

**P: ¿Puedo cambiar mi contraseña?**
R: Sí, en "Mi Perfil" o solicitando al administrador.

### 7.2 Operaciones

**P: ¿Puedo anular un cambio ya realizado?**
R: No directamente. Debe reportarse al administrador para ajuste manual.

**P: ¿Qué hago si me doy cuenta de un error en un cambio?**
R: No intentes "corregir" con otro cambio. Reporta inmediatamente al administrador.

**P: ¿Puedo hacer cambios sin internet?**
R: No, el sistema requiere conexión constante para validar saldos y registrar operaciones.

### 7.3 Transferencias

**P: ¿Cuánto tarda una transferencia en llegar?**
R: Depende de la logística física. El sistema la marca como EN_TRANSITO hasta que el destino la acepte.

**P: ¿Puedo cancelar una transferencia ya enviada?**
R: Solo si aún está en estado PENDIENTE (sin aprobar). Una vez EN_TRANSITO, debe completarse.

### 7.4 Servientrega

**P: ¿Puedo anular una guía ya generada?**
R: Sí, pero requiere aprobación de administrador y debe hacerse el mismo día.

**P: ¿Qué pasa si el cliente no tiene el valor exacto del envío?**
R: El operador debe recibir el pago completo antes de generar la guía.

**P: ¿Cuánto tiempo tarda en llegar un envío?**
R: Depende del destino y tipo de servicio. El sistema muestra la estimación al calcular la tarifa.

### 7.5 Cierres y Aperturas

**P: ¿Qué pasa si hay diferencia en el cierre?**
R: Se debe justificar la diferencia. Si es significativa, requiere revisión del administrador.

**P: ¿Puedo reabrir una caja ya cerrada?**
R: No. Una vez cerrado el día, no se pueden hacer más operaciones en esa fecha.

**P: ¿Qué pasa si olvidé hacer el cierre ayer?**
R: Contacta inmediatamente al administrador. El sistema bloquea operaciones hasta regularizar.

### 7.6 Soporte

**P: ¿A quién reporto problemas técnicos?**
R: Al administrador del sistema o al departamento de TI.

**P: ¿Hay horario de mantenimiento del sistema?**
R: Generalmente los mantenimientos se programan fuera de horario laboral. Se notifica con anticipación.

**P: ¿Dónde encuentro mi historial de operaciones?**
R: En los reportes correspondientes según tu rol, o solicitándolo al administrador.

---

## 8. GLOSARIO

| Término | Definición |
|---------|------------|
| **COMPRA** | El cliente vende divisa extranjera al punto de cambio |
| **VENTA** | El cliente compra divisa extranjera del punto de cambio |
| **TASA** | Valor de cambio entre dos monedas |
| **BILLETES/MONEDAS** | Desglose físico del dinero |
| **CUADRE** | Proceso de verificar que el sistema coincida con el físico |
| **DIFERENCIA** | Monto por el que no cuadra el sistema vs físico |
| **ABONO** | Pago parcial de una operación |
| **SALDO PENDIENTE** | Monto restante por pagar en operación parcial |
| **IDEMPOTENCIA** | Sistema que previene operaciones duplicadas |
| **CARGO/DESCARGO** | Términos de transferencia (enviar/recibir) |
| **PUNTO** | Sucursal o ubicación física de atención |
| **CONCESIÓN** | Supervisor con permisos de aprobación |

---

## 9. CONTACTO Y SOPORTE

| Rol | Contacto | Para qué contactar |
|-----|----------|-------------------|
| **Administrador Local** | [Definir] | Problemas operativos, aprobaciones |
| **Soporte TI** | [Definir] | Problemas técnicos, errores de sistema |
| **Soporte Servientrega** | [Definir] | Problemas con envíos, guías |

---

**Fin del Manual de Sistema**

*Última actualización: 2026-03-24*
*Para actualizaciones, consultar la documentación técnica en `/docs/QA_COMPLETO_SISTEMA.md`*
