# Auditoría del Sistema y Plan de Correcciones

**Fecha:** 24 de marzo 2026  
**Auditor:** Sistema de Análisis Automático  
**Estado:** CRÍTICO - Requiere atención inmediata

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. RACE CONDITION EN CAMBIOS DE DIVISAS (DUPLICADOS)

**Severidad:** CRÍTICA  
**Impacto:** Alto - Duplicación de transacciones, pérdida de dinero  
**Estado:** Parcialmente corregido

#### Descripción
Los cambios de divisas se están duplicando debido a race conditions. El análisis del 21 de marzo 2026 (ANALISIS_RACE_CONDITION.md) confirmó duplicados con diferencia de **19 milisegundos**.

#### Causas Raíz
1. **Frontend no envía `idempotency-key`:** El backend tiene middleware de idempotencia, pero el frontend nunca lo usaba
2. **Falta de índice único en BD:** No hay constraint de unicidad en MovimientoSaldo
3. **Doble clic del usuario:** El botón no se deshabilita inmediatamente al hacer clic

#### Correcciones Implementadas
- [x] Crear utilidad `generateIdempotencyKey()` en frontend
- [x] Actualizar `apiService` para soportar header `Idempotency-Key`
- [x] Actualizar `exchangeService.createExchange()` para enviar clave única
- [x] Actualizar `transferService.createTransfer()` para enviar clave única
- [x] Crear migración SQL con índices únicos en BD

#### Archivos Modificados
```
src/utils/idempotency.ts (NUEVO)
src/services/apiService.ts
src/services/exchangeService.ts
src/services/transferService.ts
server/migrations/2026-03-24-add-unique-constraints-prevent-duplicates.sql
```

#### Pendiente
- [ ] Deshabilitar botón inmediatamente al hacer clic en "Guardar Cambio"
- [ ] Mostrar spinner/loading state en botón
- [ ] Agregar índice único a nivel de base de datos (ejecutar migración)

---

### 2. ASIGNACIÓN DE SALDOS REEMPLAZA EN LUGAR DE SUMAR

**Severidad:** MEDIA-ALTA  
**Impacto:** Medio - Pérdida de saldo existente  
**Estado:** Requiere verificación

#### Descripción
El administrador reporta que al asignar divisas, el saldo existente se reemplaza en lugar de sumarse.

#### Análisis del Código
Revisando `server/routes/saldos-iniciales.ts` (líneas 239-318):

```typescript
// Lógica CORRECTA encontrada:
if (existingSaldo) {
  const baseCantidad = new Prisma.Decimal(
    existingSaldo.cantidad ?? 0
  ).add(decCantidad);  // ✅ SUMAR al existente
  // ...
  saldoResult = await tx.saldo.update({
    where: { id: existingSaldo.id },
    data: {
      cantidad: baseCantidad,  // ✅ Actualiza con la suma
      billetes: baseBilletes,
      monedas_fisicas: baseMonedas,
    },
  });
}
```

**Conclusión:** La lógica del backend ES CORRECTA - suma al saldo existente.

#### Posibles Causas del Problema Reportado
1. **Confusión en la UI:** El administrador ve el saldo final pero espera ver un historial
2. **Problema de concurrencia:** Dos asignaciones simultáneas pueden causar race condition
3. **Caché del navegador:** El saldo mostrado puede no estar actualizado
4. **Problema en otro endpoint:** Posiblemente hay otra ruta que sí reemplaza

#### Acciones Recomendadas
- [ ] Verificar con el administrador el flujo exacto que sigue
- [ ] Revisar si hay otro endpoint de asignación de saldos
- [ ] Agregar logs detallados de asignaciones de saldo
- [ ] Implementar validación de que el saldo nuevo = saldo anterior + asignación

---

## 🟡 PROBLEMAS MEDIOS IDENTIFICADOS

### 3. FALTA DE VALIDACIÓN DE SALDO INSUFICIENTE EN TRANSFERENCIAS

**Severidad:** MEDIA  
**Archivo:** `server/routes/transfers.ts`  

El endpoint de transferencias no valida si el punto origen tiene saldo suficiente antes de crear la transferencia.

#### Corrección Sugerida
Agregar validación similar a `validarSaldoCambioDivisa` en exchanges.

---

### 4. NO HAY ROLLBACK AUTOMÁTICO DE TRANSACCIONES FALLIDAS

**Severidad:** MEDIA  
**Áreas Afectadas:** Cambios de divisa, transferencias, cierres

Algunos endpoints no usan transacciones Prisma (`$transaction`) para operaciones que afectan múltiples tablas.

#### Corrección Sugerida
- Envolver operaciones críticas en `prisma.$transaction()`
- Usar el cliente de transacción `tx` en todas las operaciones relacionadas

---

### 5. FALTA DE VALIDACIÓN DE FECHAS EN REPORTES

**Severidad:** BAJA-MEDIA  
**Áreas Afectadas:** Reportes, contabilidad

Los endpoints de reportes no validan rangos de fechas razonables, permitiendo consultas que pueden sobrecargar la BD.

#### Corrección Sugerida
- Limitar rango máximo de consultas (ej: 90 días)
- Validar formato de fechas
- Rechazar fechas futuras

---

## 🟢 MEJORAS RECOMENDADAS

### 6. IMPLEMENTAR SOFT DELETE EN LUGAR DE DELETE FÍSICO

**Áreas:** Cambios de divisa, transferencias, movimientos

En lugar de eliminar registros, marcarlos como `eliminado: true` con fecha y usuario.

### 7. AGREGAR AUDITORÍA COMPLETA

Crear tabla `Auditoria` para registrar:
- Quién hizo qué cambio
- Cuándo
- Valores anteriores y nuevos
- IP del usuario

### 8. OPTIMIZAR CONSULTAS CON ÍNDICES ADICIONALES

```sql
-- Índices recomendados para mejorar performance
CREATE INDEX idx_cambio_divisa_fecha ON "CambioDivisa"(fecha DESC);
CREATE INDEX idx_movimiento_saldo_fecha ON "MovimientoSaldo"(fecha DESC);
CREATE INDEX idx_transferencia_estado ON "Transferencia"(estado) WHERE estado = 'PENDIENTE';
```

### 9. IMPLEMENTAR RATE LIMITING MÁS ESTRICTO

Agregar rate limiting específico para operaciones críticas:
- Máximo 10 cambios de divisa por minuto por usuario
- Máximo 5 transferencias por minuto
- Máximo 3 intentos de login fallidos

### 10. MEJORAR MANEJO DE ERRORES

- Estandarizar formato de errores en todos los endpoints
- Incluir códigos de error únicos para facilitar debugging
- Agregar mensajes de error amigables para el usuario final

---

## 📊 MATRIZ DE RIESGO

| Problema | Probabilidad | Impacto | Riesgo Total | Prioridad |
|----------|-------------|---------|--------------|-----------|
| Duplicados en cambios | Alta | Alto | 🔴 CRÍTICO | 1 |
| Asignación de saldos | Media | Alto | 🟡 ALTO | 2 |
| Saldo insuficiente transferencias | Media | Medio | 🟡 MEDIO | 3 |
| Sin rollback transacciones | Baja | Alto | 🟡 MEDIO | 4 |
| Validación de fechas | Alta | Bajo | 🟢 BAJO | 5 |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Inmediato (Hoy)
- [x] Implementar generación de idempotency-key en frontend
- [x] Actualizar servicios para enviar idempotency-key
- [x] Crear migración SQL de índices únicos
- [ ] Ejecutar migración en producción
- [ ] Deshabilitar botón de guardar durante submit

### Esta Semana
- [ ] Investigar problema de asignación de saldos con admin
- [ ] Agregar validación de saldo insuficiente en transferencias
- [ ] Revisar todos los endpoints que modifican saldos
- [ ] Implementar logs de auditoría para asignaciones

### Este Mes
- [ ] Implementar soft delete en tablas críticas
- [ ] Crear sistema de auditoría completo
- [ ] Optimizar consultas con índices adicionales
- [ ] Implementar rate limiting estricto

---

## 🧪 PLAN DE PRUEBAS

### Pruebas de Idempotencia
1. Hacer clic 10 veces rápidamente en "Guardar Cambio"
2. Verificar que solo se creó 1 cambio y 1 movimiento
3. Verificar que el saldo solo se actualizó 1 vez

### Pruebas de Asignación de Saldos
1. Asignar $100 a un punto
2. Verificar saldo = $100
3. Asignar $50 más al mismo punto
4. Verificar saldo = $150 (no $50)

### Pruebas de Race Condition
1. Enviar 50 peticiones simultáneas de cambio
2. Verificar que no hay duplicados
3. Verificar integridad de saldos

---

## 📈 METRICAS A MONITOREAR

Después de implementar las correcciones:

- Número de duplicados por día (debe ser 0)
- Tiempo promedio de respuesta de endpoints críticos
- Número de errores 500 por día
- Satisfacción del administrador con asignaciones

---

## 📞 CONTACTO Y ESCALACIÓN

Si los problemas persisten después de las correcciones:

1. Revisar logs de la aplicación
2. Ejecutar scripts de validación en `scripts/validate/`
3. Contactar al equipo de desarrollo con:
   - IDs de transacciones afectadas
   - Timestamps exactos
   - Logs del navegador (F12 > Console)

---

**Documento generado:** 24 de marzo 2026  
**Última actualización:** 24 de marzo 2026  
**Versión:** 1.0
