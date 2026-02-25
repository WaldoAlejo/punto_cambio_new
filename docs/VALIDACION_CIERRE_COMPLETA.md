# 🔍 Validación Exhaustiva - Proceso de Cierre de Caja

## Objetivo
Garantizar que el proceso de cierre funcione al 100% sin errores.

## Flujo de Cierre Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE CIERRE DE CAJA                       │
└─────────────────────────────────────────────────────────────────┘

[1] INICIAR JORNADA
    ↓
[2] OPERAR (cambios, transferencias, servicios)
    ↓
[3] ABRIR CUADRE (automático al consultar /cuadre-caja)
    ↓
[4] INGRESAR CONTEO FÍSICO (/cuadre-caja/conteo-fisico)
    - Billetes por divisa
    - Monedas por divisa
    - Bancos por divisa
    ↓
[5] VALIDAR DIFERENCIAS (/cuadre-caja/validar)
    - Si diferencia ≤ $10: ADVERTENCIA (puede continuar)
    - Si diferencia > $10: BLOQUEO (requiere corrección)
    ↓
[6] REVISAR MOVIMIENTOS (/cuadre-caja/movimientos-auditoria)
    - Cambios de divisa
    - Servicios externos
    - Transferencias
    - Guías Servientrega
    ↓
[7] GUARDAR CIERRE (/guardar-cierre)
    - Validar tolerancias
    - Crear ajustes contables si hay diferencias
    - Actualizar saldos
    - Cerrar jornada automáticamente
    - Liberar punto de atención
    ↓
[8] CIERRE COMPLETADO ✓
```

## Endpoints a Validar

### 1. GET /api/cuadre-caja
**Propósito:** Obtener estado actual del cuadre del día

**Validaciones necesarias:**
- [ ] Verificar que devuelve todos los detalles por moneda
- [ ] Saldo de apertura correcto (último cierre anterior)
- [ ] Saldo de cierre calculado correctamente
- [ ] Movimientos del período contados

**Problemas potenciales:**
- Si no existe cuadre, debe crearlo automáticamente
- Si existe PARCIAL, debe permitir continuar
- Si existe CERRADO, debe informar que ya está cerrado

### 2. POST /api/cuadre-caja/conteo-fisico
**Propósito:** Guardar conteo manual del operador

**Validaciones necesarias:**
- [ ] Verificar que el cuadre existe y está ABIERTO
- [ ] Validar que billetes + monedas = conteo_fisico
- [ ] Calcular diferencia vs saldo teórico
- [ ] Generar alerta si diferencia > $10
- [ ] Actualizar tabla Saldo con nuevos valores

**Problemas potenciales:**
- Permisos: solo el operador del punto puede modificar
- Concurrencia: evitar que dos operadores modifiquen al mismo tiempo
- Validación de números negativos

### 3. POST /api/cuadre-caja/validar
**Propósito:** Validar antes de permitir cierre

**Validaciones necesarias:**
- [ ] Verificar todas las monedas tienen conteo
- [ ] Detectar diferencias mayores a $10
- [ ] Clasificar severidad (INFO/ADVERTENCIA/CRITICA)
- [ ] Permitir "forzar" cierre solo para admins

**Problemas potenciales:**
- Falso positivo en alertas
- No detectar conteos vacíos

### 4. GET /api/cuadre-caja/movimientos-auditoria
**Propósito:** Mostrar todos los movimientos del día

**Validaciones necesarias:**
- [ ] Incluir cambios de divisa
- [ ] Incluir servicios externos
- [ ] Incluir transferencias
- [ ] Incluir guías Servientrega
- [ ] Ordenar por fecha descendente

**Problemas potenciales:**
- Faltan tipos de movimientos
- Fechas incorrectas (timezone)
- Filtros no funcionan

### 5. POST /api/guardar-cierre
**Propósito:** Guardar cierre definitivo

**Validaciones necesarias:**
- [ ] Validar tolerancia USD ±$1.00, otras ±$0.01
- [ ] Verificar billetes + monedas = conteo_fisico
- [ ] Evitar cierre duplicado (idempotencia)
- [ ] Crear movimientos de ajuste si hay diferencias
- [ ] Actualizar saldos en tabla Saldo
- [ ] Cerrar jornada activa
- [ ] Liberar punto de atención

**Problemas potenciales:**
- Transacción no atómica (datos inconsistentes)
- No cerrar jornada correctamente
- No liberar punto
- Duplicar movimientos de ajuste

## Integraciones a Validar

### Con Módulo de Jornadas
```
Al cerrar caja:
  ↓
Buscar jornada ACTIVA/ALMUERZO del usuario
  ↓
Actualizar fecha_salida = NOW()
Actualizar estado = "COMPLETADO"
  ↓
Liberar punto: usuario.punto_atencion_id = null
```

**Validaciones:**
- [ ] Solo cierra la jornada del usuario que cierra caja
- [ ] No afecta jornadas de otros usuarios
- [ ] No permite cerrar caja sin jornada activa (para OPERADOR)

### Con Módulo de Saldos
```
Al cerrar caja:
  ↓
Para cada moneda:
  saldo.cantidad = detalle.conteo_fisico
  saldo.billetes = detalle.billetes
  saldo.monedas_fisicas = detalle.monedas
  saldo.bancos = detalle.conteo_bancos
```

**Validaciones:**
- [ ] Saldos actualizados correctamente
- [ ] Próximo día usa estos saldos como apertura

### Con Movimientos Contables
```
Si diferencia > 0:
  Crear MovimientoSaldo INGRESO
  "AJUSTE CIERRE [fecha]"
  
Si diferencia < 0:
  Crear MovimientoSaldo EGRESO
  "AJUSTE CIERRE [fecha]"
```

**Validaciones:**
- [ ] No duplicar ajustes (verificar antes de crear)
- [ ] Monto correcto (valor absoluto de diferencia)
- [ ] Referencia al cuadre correcto

## Casos de Prueba

### Caso 1: Cierre Perfecto (Sin Diferencias)
```
Precondición:
- Jornada activa
- Cambios realizados durante el día
- Conteo físico exacto (= saldo teórico)

Pasos:
1. GET /cuadre-caja → Obtiene datos
2. POST /conteo-fisico → Ingresa valores exactos
3. POST /validar → Sin alertas
4. POST /guardar-cierre → Éxito

Resultado esperado:
- Cuadre estado = CERRADO
- Jornada estado = COMPLETADO
- Punto liberado
- Sin movimientos de ajuste
```

### Caso 2: Cierre con Diferencia Pequeña (< $10)
```
Precondición:
- Conteo físico difiere $5 del teórico

Pasos:
1. POST /conteo-fisico → Guarda conteo
2. POST /validar → Alerta INFO
3. POST /guardar-cierre → Éxito con observación

Resultado esperado:
- Cierre exitoso
- Movimiento de ajuste creado por $5
- Observación registrada
```

### Caso 3: Cierre con Diferencia Grande (> $10)
```
Precondición:
- Conteo físico difiere $25 del teórico

Pasos:
1. POST /conteo-fisico → Guarda conteo
2. POST /validar → Alerta CRÍTICA, bloquea cierre
3. GET /movimientos-auditoria → Revisar movimientos
4. Corregir conteo o usar "forzar" (admin)

Resultado esperado:
- Cierre bloqueado hasta corrección
- Admin puede forzar con override
```

### Caso 4: Intento de Cierre Duplicado
```
Precondición:
- Cuadre ya cerrado

Pasos:
1. POST /guardar-cierre → Intenta cerrar de nuevo

Resultado esperado:
- Error: "Ya existe un cuadre CERRADO para hoy"
- HTTP 400
- No crear datos duplicados
```

### Caso 5: Cierre sin Jornada (Admin)
```
Precondición:
- Usuario ADMIN
- Sin jornada activa

Pasos:
1. POST /guardar-cierre

Resultado esperado:
- ADMIN puede cerrar sin jornada
- Jornada no se modifica (no existe)
```

## Checklist de Validación

### Backend
- [ ] Todos los endpoints responden sin errores
- [ ] Validaciones de seguridad funcionan (solo usuarios autorizados)
- [ ] Transacciones atómicas (rollback en errores)
- [ ] Logs informativos en cada operación
- [ ] Manejo de errores graceful (no crashea)

### Frontend
- [ ] Formulario de conteo valida números
- [ ] Muestra diferencias en tiempo real
- [ ] Alertas visuales claras
- [ ] Botón de cierre deshabilitado hasta validación
- [ ] Confirmación antes de cerrar
- [ ] Mensajes de éxito/error claros

### Integración
- [ ] Cierre actualiza jornada
- [ ] Cierre actualiza saldos
- [ ] Cierre crea ajustes contables si aplica
- [ ] No permite cierre duplicado
- [ ] Punto se libera correctamente

## Errores Conocidos a Corregir

1. **Error: "No existe cuadre ABIERTO"**
   - Solución: Crear cuadre automáticamente en GET /cuadre-caja

2. **Error: Desglose no cuadra**
   - Solución: Validación billetes + monedas = conteo en frontend y backend

3. **Error: Diferencias no detectadas**
   - Solución: Mejorar endpoint de validación

4. **Error: Jornada no cierra**
   - Solución: Revisar lógica de cierre de jornada en guardar-cierre

5. **Error: Saldos no actualizan**
   - Solución: Verificar transacción en upsert de Saldo

## Acciones Inmediatas

### Prioridad 1 (Crítico)
- [ ] Revisar endpoint POST /guardar-cierre (lógica completa)
- [ ] Verificar cierre de jornada automático
- [ ] Validar actualización de saldos
- [ ] Probar flujo completo en ambiente local

### Prioridad 2 (Alto)
- [ ] Mejorar mensajes de error
- [ ] Agregar más logs
- [ ] Optimizar consultas de auditoría
- [ ] Revisar validaciones de permisos

### Prioridad 3 (Medio)
- [ ] Agregar tests automatizados
- [ ] Mejorar documentación
- [ ] Optimizar performance
