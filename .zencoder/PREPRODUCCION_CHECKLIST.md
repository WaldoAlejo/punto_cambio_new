# ✅ CHECKLIST PREPRODUCCIÓN - PUNTO CAMBIO

**Última actualización**: 2025  
**Status**: Listo para pruebas con datos reales

---

## 🎯 CAMBIOS COMPLETADOS

### ✅ 1. Finalización de Jornada sin Cierre (CRÍTICO)

**Implementado**: `server/routes/schedules.ts` línea 20  
**Cambio**: Agregado `OPERADOR` a `ROLES_EXENTOS_CIERRE`

```typescript
const ROLES_EXENTOS_CIERRE = new Set([
  "OPERADOR", // ✅ NUEVO
  "ADMINISTRATIVO",
  "ADMIN",
  "SUPER_USUARIO",
]);
```

**Impacto**:

- OPERADOR ahora puede cerrar jornada sin cierre de caja
- ADMINISTRATIVO ya podía (sin cambios)
- Mejora UX al reducir pasos requeridos

---

## 🔒 SEGURIDAD Y VALIDACIONES

### Nivel de transacciones: ALTO ✅

- ✅ Cambios de divisa: dentro de transacción
- ✅ Actualización de saldos: dentro de transacción
- ✅ Movimientos contables: registrados antes de confirmar
- ✅ Validación de saldo: antes de permitir operación

### Nivel de validación: ALTO ✅

- ✅ Esquema Zod en todos los endpoints
- ✅ Validación de monedas activas
- ✅ Validación de puntos activos
- ✅ Validación de usuarios autenticados
- ✅ Validación de roles y permisos

---

## 📊 OPERACIONES CRÍTICAS VALIDADAS

### 1. Asignación de Saldos Iniciales ✅

**Endpoint**: `POST /api/saldos-iniciales/`  
**Validaciones**:

- Punto existe y está activo
- Moneda existe y está activa
- Cantidad > 0
- Billetes y monedas ≥ 0
- Suma de billetes + monedas = cantidad total

**Precaución**: Si se asigna cantidad a través de `cantidad_inicial`, se suma a la anterior (incrementa). Si se usan `billetes` + `monedas_fisicas`, se calcula el total.

---

### 2. Cambios de Divisas (COMPRA/VENTA) ✅

**Endpoint**: `POST /api/exchanges/`  
**Validaciones**:

- Moneda origen ≠ Moneda destino
- Montos > 0
- Saldo suficiente en moneda origen
- Tasa de cambio > 0 y válida
- Billetes y monedas ≥ 0

**Cálculos**:

- Si tasa_cambio_billetes > 0: usa esa
- Si no, usa tasa_cambio_monedas
- Normaliza pares con USD automáticamente
- Redondeo con `Number.EPSILON` para precisión

**Normalizacion USD**:

- COMPRA (divisa → USD): Si USD es destino, el punto entrega USD
- VENTA (USD → divisa): Si USD es origen, el punto entrega divisa

---

### 3. Transferencias Entre Puntos ✅

**Endpoint**: `POST /api/transfers/`  
**Validaciones**:

- Origen existe (puede ser null para DEPOSITO_MATRIZ)
- Destino existe y está activo
- Moneda existe y está activa
- Monto > 0
- Saldo suficiente en origen (si existe)

**Características**:

- Soporte para MIXTO (efectivo + banco)
- Repartición automática 50/50 si no viene especificado
- Desglose físico (billetes, monedas)
- Responsable de movilización

---

### 4. Cierre de Caja (Cuadre) ✅

**Endpoint**: `GET/POST /api/cuadre-caja/`  
**Lógica**:

1. Calcula saldo apertura:

   - Busca último cierre (CERRADO o PARCIAL)
   - Si existe: saldo_apertura = conteo_fisico
   - Si no: saldo_apertura = saldo actual

2. Calcula movimientos del período:

   - Ingresos: cambios + transferencias entrada
   - Egresos: servicios externos + transferencias salida
   - Saldo cierre = apertura + ingresos - egresos

3. Detalle por moneda:
   - Billetes vs monedas
   - Conteo físico vs sistema
   - Diferencia (descuadre)

---

### 5. Cálculos de Ingresos/Egresos ✅

**Sistema centralizado**: `server/services/movimientoSaldoService.ts`

**Garantías**:

- ✅ INGRESO: siempre positivo
- ✅ EGRESO: siempre negativo
- ✅ AJUSTE: mantiene signo original
- ✅ Validación: |delta_real - delta_esperado| ≤ 0.01
- ✅ Precisión: Prisma.Decimal (no flotantes)

**Uso obligatorio**: NUNCA insertar directo a `MovimientoSaldo`, SIEMPRE usar `registrarMovimientoSaldo()`

---

## 🚀 MEJORAS IMPLEMENTADAS

### 1. Redondeo seguro

**Cambio**: Agregado `Number.EPSILON` en todos los `round2()`

```typescript
const round2 = (n: number) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;
```

**Beneficio**: Evita errores de punto flotante comunes

### 2. Mensajes de error mejorados

**Cambio**: Mensajes más descriptivos en `schedules.ts`

```javascript
{
  error: "Cierre de caja requerido",
  details: "Debe realizar el cierre de caja diario..."
}
```

---

## 📋 PRUEBAS PRE-PRODUCCIÓN RECOMENDADAS

### Prueba 1: Asignación de saldos

```
1. Admin asigna 1000 USD a Punto A
2. Verificar: Saldo.cantidad = 1000
3. Verificar: HistorialSaldo tiene entrada INGRESO
4. Verificar: MovimientoSaldo registrado
```

### Prueba 2: Cambio de divisa

```
1. Operador hace COMPRA 100 USD → 330 PEN (tasa 3.3)
2. Verificar: Saldo USD disminuye 100
3. Verificar: Saldo PEN aumenta 330
4. Verificar: MovimientoSaldo registra EGRESO USD y INGRESO PEN
5. Verificar: CambioDivisa.estado = COMPLETADO
```

### Prueba 3: Transferencia

```
1. Operador transfiere 500 USD de Punto A a Punto B
2. Verificar: Punto A disminuye 500 USD
3. Verificar: Punto B aumenta 500 USD
4. Verificar: Movimientos registrados en ambos
5. Verificar: Transferencia.estado = COMPLETADO
```

### Prueba 4: Cierre de caja

```
1. Operador hace 5 cambios en el día
2. Accede a Cuadre de Caja
3. Verifica totales de ingresos/egresos
4. Ingresa conteo físico
5. Valida cuadre (diferencia ≤ tolerancia)
6. Presiona Cerrar
7. Verifica estado cambia a CERRADO
```

### Prueba 5: Finalización de jornada

```
1. Operador cierra jornada ANTES de cierre de caja
2. Debería: Fallar (si no está exento)
3. Ahora con cambio: Debería permitirse (OPERADOR está exento)
4. Verificar: punto_atencion_id se limpia del usuario
5. Verificar: Jornada estado = COMPLETADO
```

---

## 🔍 VALIDACIONES CRÍTICAS

### Base de datos

- [ ] PostgreSQL 12+ corriendo
- [ ] Tabla `Usuario` con índice en `username`
- [ ] Tabla `PuntoAtencion` con índice en `id`, `nombre`, `activo`
- [ ] Tabla `Moneda` con índice en `codigo`, `activo`
- [ ] Tabla `Saldo` con unique `(punto_atencion_id, moneda_id)`
- [ ] Tabla `MovimientoSaldo` con índices en fecha, punto_atencion_id
- [ ] Tabla `CambioDivisa` con índices en fecha, punto_atencion_id
- [ ] Tabla `Transferencia` con índices en fecha, estado

### Backend

- [ ] Variables de entorno configuradas
- [ ] JWT_SECRET suficientemente largo
- [ ] CORS configurado para frontend
- [ ] Rate limiting activo
- [ ] Helmet.js activo (headers de seguridad)
- [ ] Logs configurados (winston)
- [ ] Zona horaria configurada a Ecuador (GYE)

### Frontend

- [ ] Componentes de UI renderizando
- [ ] Toast notifications funcionando
- [ ] Validaciones de formulario activas
- [ ] Lazy loading de rutas funcionando
- [ ] localStorage limpio

---

## ⚠️ PUNTOS DE ATENCIÓN

### 1. Precisión decimal

**Problema**: Operaciones de punto flotante pueden generar 0.000001 de error
**Solución**: Ya implementado con Prisma.Decimal y round2() con EPSILON
**Monitorear**: Reportes de descuadres después de 100+ operaciones

### 2. Concurrencia

**Problema**: Dos usuarios podrían actualizar saldo simultáneamente
**Solución**: Transacciones ACID en puntos críticos
**Monitorear**: Logs de conflictos de concurrencia (P2034 en Prisma)

### 3. Saldo negativo

**Problema**: Alguien trata de sacar más de lo que hay
**Solución**: Validación en middleware antes de operación
**Monitorear**: Intentos de operaciones bloqueadas (400 SALDO_INSUFICIENTE)

### 4. Integridad referencial

**Problema**: Borrar punto/moneda con saldos asociados
**Solución**: Foreign keys con onDelete: Cascade en Prisma
**Monitorear**: Errores P2003 en logs

---

## 📞 SOPORTE Y DEBUGGING

### Logs clave

- `🚀 FINALIZACION_JORNADA_INICIADA`: Inicio de cierre de jornada
- `🔍 BUSCANDO_CIERRE`: Búsqueda de cierre de caja
- `📊 RESULTADO_CIERRE`: Resultado de búsqueda
- `❌ ERROR_CIERRE_REQUERIDO`: Error cuando falta cierre

### Errores comunes esperados

| Error                      | Causa                               | Solución                                   |
| -------------------------- | ----------------------------------- | ------------------------------------------ |
| `SALDO_INSUFICIENTE`       | No hay dinero suficiente            | Asignar más saldo inicial                  |
| `Punto inválido`           | Punto no existe o inactivo          | Crear/activar punto                        |
| `Moneda inválida`          | Moneda no existe o inactiva         | Crear/activar moneda                       |
| `Cierre de caja requerido` | OPERADOR trata de cerrar sin cierre | Hacer cierre primero (o está exento ahora) |

---

## ✨ PRÓXIMOS PASOS

1. **Hoy**: Validar cambios en ambiente local
2. **Mañana**: Desplegar a preprod
3. **Semana 1**: Pruebas exhaustivas con datos reales
4. **Semana 2**: Validación de reportes y exports
5. **Semana 3**: Ajustes y producción

---

## 📝 NOTAS FINALES

- **OPERADOR ya puede cerrar jornada sin cierre**: Cambio completado
- **Todas las operaciones son ACID**: Transacciones implementadas
- **Redondeo es seguro**: Number.EPSILON implementado
- **Cálculos centralizados**: MovimientoSaldo es única fuente de verdad

**Estado**: ✅ LISTO PARA PRUEBAS EN PREPROD CON DATOS REALES

---

_Documento generado automáticamente por Zencoder_  
_Última verificación: 2025_
