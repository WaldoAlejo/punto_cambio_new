# Flujo de Cierre de Caja Alineado

## Resumen de Cambios Realizados

Fecha: 26 de marzo de 2026

---

## 1. Problemas Identificados

### Problema 1: Short-circuit en `/cuadre-caja`
El endpoint solo verificaba `MovimientoSaldo` para determinar si había movimientos. Si no había movimientos en esa tabla (pero sí había cambios de divisa), retornaba `detalles: []`.

**Solución**: Modificar el short-circuit para verificar 5 fuentes de movimientos:
- MovimientoSaldo
- CambioDivisa
- Transferencia
- ServicioExternoMovimiento
- ServientregaGuia

### Problema 2: Cuadres sin detalles
El cuadre del 25 de marzo existía pero no tenía detalles porque se creó antes del fix.

**Solución**: Script para cerrar cuadres del 25 de marzo de todos los puntos.

### Problema 3: Apertura y Cuadre no conectados
El sistema de Apertura de Caja y el sistema de Cuadre de Caja funcionaban de forma independiente.

**Solución**: Modificar `apertura-caja.ts` para crear automáticamente el cuadre de caja al confirmar la apertura.

### Problema 4: `/guardar-cierre` usa fecha actual
El endpoint no podía cerrar cuadres de días anteriores porque siempre buscaba del día actual.

**Solución**: Modificar para buscar el cuadre ABIERTO más reciente, permitiendo cerrar días pendientes.

---

## 2. Archivos Modificados

### 2.1 `server/routes/cuadreCaja.ts`
**Cambio**: Short-circuit para verificar todas las fuentes de movimientos.

```typescript
// Antes: Solo verificaba MovimientoSaldo
const movimientosDelDia = await prisma.movimientoSaldo.count({...});

// Ahora: Verifica 5 fuentes
const [movimientosSaldo, cambiosDivisa, transferencias, serviciosExternos, guiasServientrega] = 
  await Promise.all([...]);
```

### 2.2 `server/routes/apertura-caja.ts`
**Cambio**: Crear cuadre de caja automáticamente al confirmar apertura.

```typescript
// En POST /confirmar, después de actualizar la apertura:
// 1. Verificar si ya existe cuadre para hoy
// 2. Si no existe, crear cuadre con estado ABIERTO
// 3. Crear detalles del cuadre con el conteo físico de la apertura
```

### 2.3 `server/routes/guardar-cierre.ts`
**Cambio**: Buscar cuadre ABIERTO más reciente (no solo del día actual).

```typescript
// Antes: Solo buscaba del día actual
let cabecera = await tx.cuadreCaja.findFirst({
  where: { fecha: { gte: hoyGte, lt: hoyLt }, estado: "ABIERTO" }
});

// Ahora: Busca del día actual, luego cualquier ABIERTO anterior
let cabecera = await tx.cuadreCaja.findFirst({...}); // del día
if (!cabecera) cabecera = await tx.cuadreCaja.findFirst({...}); // cualquier ABIERTO
```

### 2.4 `server/routes/cierreParcial.ts`
**Cambio**: Buscar cuadre ABIERTO más reciente (igual que guardar-cierre).

---

## 3. Scripts Creados

### 3.1 `scripts/cerrar-cuadres-25-marzo-todos-puntos.ts`
Cierra los cuadres del 25 de marzo de todos los puntos que quedaron ABIERTOS.

Uso:
```bash
npx tsx scripts/cerrar-cuadres-25-marzo-todos-puntos.ts
```

### 3.2 `scripts/validar-flujo-cierre-dia.ts`
Valida el flujo completo de cierre para un punto y fecha específicos.

Uso:
```bash
npm run validate:cierre-dia [PUNTO_ID] [FECHA]
```

### 3.3 `scripts/diagnostico-el-bosque-25-marzo.ts`
Diagnóstico específico para el punto El Bosque.

Uso:
```bash
npm run diagnose:el-bosque
```

---

## 4. Flujo Ideal del Sistema (Después de los Cambios)

### 4.1 Inicio de Jornada (Mañana)

```
1. Operador llega al punto
   ↓
2. Enciende computador e inicia sesión
   ↓
3. Sistema muestra pantalla de "Apertura de Caja"
   ↓
4. Operador cuenta efectivo físico
   ↓
5. Operador ingresa conteo en el sistema
   ↓
6. Operador confirma apertura
   ↓
7. Sistema CREA AUTOMÁTICAMENTE:
   - Registro de AperturaCaja (con conteo físico)
   - CuadreCaja del día (estado: ABIERTO)
   - Detalles del cuadre (saldo_apertura = conteo físico)
   ↓
8. Operador puede empezar a operar
```

### 4.2 Durante el Día

```
Operador realiza:
- Cambios de divisa
- Transferencias
- Servicios externos
- Guías Servientrega

Cada operación:
- Se registra en su tabla correspondiente
- Actualiza saldos
- El cuadre mantiene su estado ABIERTO
```

### 4.3 Cierre Parcial (Cambio de Turno)

```
1. Operador de la mañana va a "Cierre Parcial"
   ↓
2. Sistema muestra formulario con:
   - Saldo inicial (del conteo de apertura)
   - Movimientos del período
   - Campos para conteo físico
   ↓
3. Operador ingresa conteo físico
   ↓
4. Sistema guarda conteo y cambia estado a PARCIAL
   ↓
5. Nuevo operador inicia sesión
   ↓
6. Sistema encuentra cuadre PARCIAL
   ↓
7. Sistema reactiva cuadre a ABIERTO
   ↓
8. Nuevo operador continúa operando
```

### 4.4 Cierre Completo (Fin del Día)

```
1. Operador va a "Cierre del Día"
   ↓
2. Sistema busca cuadre ABIERTO (hoy o anterior)
   ↓
3. Sistema muestra formulario con:
   - Saldo inicial (del conteo de apertura)
   - Movimientos del día
   - Campos para conteo final
   ↓
4. Operador ingresa conteo físico de cada moneda
   ↓
5. Sistema calcula diferencias (conteo - saldo_teorico)
   ↓
6. Operador confirma cierre
   ↓
7. Sistema:
   - Guarda conteo final en DetalleCuadreCaja
   - Cambia estado a CERRADO
   - Registra fecha_cierre
   - Actualiza saldos para el día siguiente
   ↓
8. Cierre completado
```

---

## 5. Comandos Útiles

### Validar flujo de un punto:
```bash
npm run validate:cierre-dia [PUNTO_ID] [FECHA]
```

### Diagnóstico de El Bosque:
```bash
npm run diagnose:el-bosque
```

### Verificar estado de cuadres:
```bash
npx tsx scripts/verificar-estado-cuadre.ts
```

---

## 6. Notas Importantes

1. **Los cuadres del 25 de marzo fueron cerrados** para todos los puntos que tenían operaciones.

2. **Hoy (26 de marzo) los operadores pueden iniciar jornada normalmente**.

3. **Al confirmar la apertura, el sistema creará automáticamente el cuadre de caja**.

4. **El cierre ahora puede cerrar cuadres de días anteriores** si quedaron pendientes.

5. **El sistema de apertura y cierre están ahora conectados**:
   - La apertura crea el cuadre inicial
   - El cierre completa el cuadre

---

## 7. Próximos Pasos Recomendados

1. **Monitorear hoy (26 de marzo)**:
   - Verificar que los operadores puedan iniciar jornada
   - Verificar que el cierre funcione correctamente

2. **Si hay problemas**:
   - Ejecutar `npm run validate:cierre-dia [PUNTO_ID]`
   - Revisar logs del servidor

3. **Considerar mejoras futuras**:
   - Notificaciones si un cuadre queda ABIERTO por más de 24 horas
   - Reporte de cuadres pendientes de cierre
   - Validación de que no se puedan hacer operaciones sin apertura previa
