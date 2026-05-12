# ANALISIS COMPLETO DE FLUJOS DE NEGOCIO — PUNTO CAMBIO

**Fecha:** 2026-05-05
**Proposito:** Entender a fondo los flujos criticos antes de cualquier modificacion
**Alcance:** Cambio de Divisas, Servicios Externos, Servientrega, Asignacion de Saldos

---

## PARTE 1: CAMBIO DE DIVISAS

### 1.1 Conceptos Basicos

Desde la perspectiva del **Punto de Atencion** (negocio):

| Operacion | Punto hace | Cliente entrega | Cliente recibe |
|-----------|-----------|-----------------|----------------|
| **COMPRA** | El punto COMPRA divisa extranjera al cliente | Divisa extranjera (EUR, COP, etc.) | USD |
| **VENTA** | El punto VENDE divisa extranjera al cliente | USD | Divisa extranjera (EUR, COP, etc.) |

**ORIGEN** = lo que el cliente entrega al operador  
**DESTINO** = lo que el operador entrega al cliente

### 1.2 Normalizacion USD en Backend

El backend (`server/routes/exchanges.ts`, lineas 407-461) **reorganiza forzosamente** el par de monedas cuando una es USD:

```
COMPRA de USD -> EUR (invertido):
  Backend intercambia: origen=EUR, destino=USD
VENTA de EUR -> USD (invertido):
  Backend intercambia: origen=USD, destino=EUR
```

Resultado: COMPRA siempre termina con destino=USD. VENTA siempre termina con origen=USD.

**Impacto:** Los campos `divisas_entregadas_*` y `divisas_recibidas_*` tambien se intercambian. El frontend ya detecta esto y muestra aviso amarillo.

### 1.3 Tasas de Billetes vs Monedas

El sistema permite dos tasas independientes:
- `tasa_cambio_billetes`: aplica al monto en billetes
- `tasa_cambio_monedas`: aplica al monto en monedas

**Cuando solo hay una tasa:**
- Si `amountMonedas = 0`, solo se valida/almacena `tasa_cambio_billetes`
- Si `amountBilletes = 0`, solo se valida/almacena `tasa_cambio_monedas`
- El backend usa la primera tasa disponible como `tasaEfectiva`

### 1.4 Comportamientos MULTIPLICA / DIVIDE

**Frontend** (`ExchangeForm.tsx`):
```
COMPRA: usa comportamiento_compra de moneda ORIGEN
VENTA:  usa comportamiento_venta de moneda DESTINO
```

**Backend** (`exchangeCalculationService.ts` + `exchanges.ts`):
```
EUR, GBP, CHF, JPY -> USD_PER_UNIT
COP, PYG, CLP, PEN, ARS, MXN, BRL, UYU, DOP -> UNITS_PER_USD
```

| Escenario | Modo backend | Formula COMPRA | Formula VENTA |
|-----------|-------------|----------------|---------------|
| EUR (USD_PER_UNIT) | 1 EUR = X USD | destino = origen * tasa | destino = origen / tasa |
| COP (UNITS_PER_USD) | 1 USD = X COP | destino = origen / tasa | destino = origen * tasa |

**Ejemplo COMPRA EUR (tasa 1.08):**
- Cliente entrega 100 EUR
- Backend: 100 * 1.08 = 108 USD
- Cliente recibe 108 USD

**Ejemplo VENTA COP (tasa 4000):**
- Cliente entrega 100 USD
- Backend: 100 * 4000 = 400,000 COP
- Cliente recibe 400,000 COP

### 1.5 Desglose de Pago (Destino)

En `ExchangeDetailsForm.tsx`, el operador captura:
- `divisasRecibidas.billetes` -> `divisas_recibidas_billetes`
- `divisasRecibidas.monedas` -> `divisas_recibidas_monedas`
- `divisasRecibidas.total` -> `divisas_recibidas_total`
- `metodoEntrega`: "efectivo" o "transferencia"

El backend infiere:
```
efectivo -> usd_entregado_efectivo = total, usd_entregado_transfer = 0
transferencia -> usd_entregado_efectivo = 0, usd_entregado_transfer = total
```

### 1.6 Flujo Completo Crear Cambio

```
1. Operador selecciona monedas, montos, tasas
2. Frontend calcula total destino
3. Operador ingresa desglose de destino
4. Frontend valida saldo disponible
5. POST /api/exchanges
6. Backend: valida JWT, apertura, idempotencia, schema
7. Backend: normaliza par USD (intercambia si es necesario)
8. Backend: recalcula totales con convertir()
9. Backend: inicia prisma.$transaction
10. Crea CambioDivisa
11. Crea Recibo
12. ORIGEN: upsert Saldo (+cantidad, +billetes/monedas/bancos)
13. Registra MovimientoSaldo INGRESO
14. DESTINO: valida saldo suficiente
15. upsert Saldo (-cantidad, -billetes/monedas/bancos)
16. Registra MovimientoSaldo EGRESO
17. Valida que existan 2 movimientos (auto-fix si faltan)
18. Commitea transaccion
19. Frontend genera recibo
```

### 1.7 Cambios Parciales / Pendientes

Cuando el punto NO puede entregar el monto completo:
- Cliente hace abono inicial (paga todo)
- Recibe solo una parte
- Queda saldo pendiente

**Ejemplo:**
```
Total destino: 100 USD
Abono inicial: 30 USD
Saldo pendiente: 70 USD
Estado: PENDIENTE
Saldos actualizados: solo 30%
```

Al completar posteriormente:
- Backend calcula porcentaje restante (70%)
- Actualiza saldos restantes
- Genera nuevo recibo
- Estado: COMPLETADO

---

## PARTE 2: SERVICIOS EXTERNOS

### 2.1 Dos Tipos de Servicios

#### A. Servicios CON asignacion de saldo (credito digital)
YAGANASTE, BANCO_GUAYAQUIL, WESTERN, PRODUBANCO, BANCO_PACIFICO, SERVIENTREGA

Estos tienen:
- `ServicioExternoSaldo`: saldo asignado/recargado por admin
- `ServicioExternoMovimiento`: historial de movimientos
- `ServicioExternoAsignacion`: registro de recargas iniciales

**Logica contable:**
```
INGRESO (cliente paga servicio) -> RESTA del saldo asignado (se usa el credito)
EGRESO (operador repone dinero)  -> SUMA al saldo asignado (se recarga el credito)
```

Ademas, INGRESO tambien suma al `Saldo` general USD del punto (efectivo entra a caja).

#### B. Servicios SIN asignacion de saldo (saldo general)
INSUMOS_OFICINA, INSUMOS_LIMPIEZA, OTROS

Estos NO tienen `ServicioExternoSaldo`. Solo registran:
- `ServicioExternoMovimiento`: historial
- `Saldo` general: se actualiza directamente

**Logica contable:**
```
INGRESO -> SUMA al Saldo general USD (entra dinero a caja)
EGRESO  -> RESTA del Saldo general USD (sale dinero de caja)
```

### 2.2 Flujo Contable Completo (Servicio CON asignacion)

**Cuando un cliente paga un servicio (INGRESO):**
```
1. Se descuenta de ServicioExternoSaldo (credito digital)
   - cantidad: -monto
   - billetes/monedas/bancos: segun metodo de pago

2. Se suma al Saldo general USD (efectivo entra a caja)
   - cantidad: +monto
   - billetes/monedas/bancos: segun metodo de pago

3. Se registra MovimientoSaldo INGRESO (auditoria)

4. Se registra ServicioExternoMovimiento INGRESO (auditoria del servicio)
```

**Cuando un operador repone (EGRESO):**
```
1. Se suma a ServicioExternoSaldo (credito digital)
   - cantidad: +monto

2. Se resta del Saldo general USD (efectivo sale de caja)
   - cantidad: -monto

3. Se registra MovimientoSaldo EGRESO

4. Se registra ServicioExternoMovimiento EGRESO
```

### 2.3 Servicios SIN asignacion (INSUMOS, OTROS)

**INGRESO (venta de insumos):**
```
1. Solo se suma al Saldo general USD
2. Se registra MovimientoSaldo INGRESO
3. Se registra ServicioExternoMovimiento INGRESO
```

**EGRESO (compra de insumos):**
```
1. Solo se resta del Saldo general USD
2. Se registra MovimientoSaldo EGRESO
3. Se registra ServicioExternoMovimiento EGRESO
```

**No hay ServicioExternoSaldo involucrado.**

---

## PARTE 3: SERVIENTREGA (CASO ESPECIAL)

### 3.1 Asignacion de Saldo

Los administradores asignan saldo via `POST /api/servientrega/saldo`:

```
1. Admin envia monto_total y punto_atencion_id
2. Busca ServicioExternoSaldo para SERVIENTREGA + USD
3. Si existe: incrementa cantidad y billetes
4. Si no existe: crea nuevo registro
5. Registra ServicioExternoAsignacion tipo "RECARGA"
6. NO afecta Saldo general (solo es credito digital)
```

### 3.2 Generacion de Guia (paso a paso)

```
1. Frontend: operador llena datos del envio
2. Frontend: valida saldo via GET /saldo/validar/:puntoId
3. Frontend: POST /generar-guia con datos del envio
4. Backend: valida JWT, apertura, saldo en middleware
5. Backend: llama API de Servientrega (latencia 2-20s)
6. Backend: guarda remitente y destinatario en BD
7. Backend: guarda guia en ServientregaGuia
8. Backend: descontarSaldo()
   - Busca ServicioExternoSaldo SERVIENTREGA/USD
   - Valida saldo suficiente
   - Resta cantidad, billetes, monedas
   - Crea ServicioExternoMovimiento EGRESO (uso de credito)
   - Crea ServientregaHistorialSaldo con monto negativo
9. Backend: registrarIngresoServicioExterno()
   - Crea ServicioExternoMovimiento INGRESO (auditoria)
   - Si NO es concesion:
     - Calcula saldo caja desde movimientos
     - Suma a Saldo general USD (cantidad, billetes, monedas)
     - Crea MovimientoSaldo INGRESO CAJA
     - Si hay bancos: actualiza bancos en Saldo y crea MovimientoSaldo INGRESO BANCOS
   - Si es concesion: NO actualiza saldo general
```

### 3.3 Anulacion de Guia (paso a paso)

```
1. Admin aprueba solicitud de anulacion
2. Backend: llama API Servientrega para anular (ActualizaEstadoGuia = "Anulada")
3. Backend: actualiza guia a estado ANULADA
4. Backend: actualiza solicitud a APROBADA
5. Backend: revertirIngresoServicioExterno()
   a. Crea ServicioExternoMovimiento EGRESO (reversion)
   b. Devuelve saldo a ServicioExternoSaldo SERVIENTREGA
      - cantidad: +monto
      - billetes: +monto
   c. Resta de Saldo general USD
      - Calcula saldo caja desde movimientos
      - Resta cantidad, billetes, monedas
      - Crea MovimientoSaldo EGRESO CAJA
      - Si hay bancos: resta bancos y crea MovimientoSaldo EGRESO BANCOS
```

### 3.4 Concesiones

Las concesiones solo manejan saldo de Servientrega. NO actualizan el Saldo general USD del punto.

En `shipping.ts`, linea 1228:
```typescript
const esConcesion = req.user?.rol === "CONCESION";
await db.registrarIngresoServicioExterno(..., !esConcesion);
```

Si es concesion, `actualizarSaldoGeneral = false`.

### 3.5 Tablas involucradas en Servientrega

| Tabla | Rol |
|-------|-----|
| `ServientregaGuia` | Cabecera de guia generada |
| `ServientregaRemitente` | Datos del remitente |
| `ServientregaDestinatario` | Datos del destinatario |
| `ServientregaSolicitudAnulacion` | Solicitudes de anulacion |
| `ServicioExternoSaldo` | Saldo asignado (credito digital) |
| `ServicioExternoMovimiento` | Movimientos de auditoria |
| `ServicioExternoAsignacion` | Recargas/asignaciones historicas |
| `ServientregaHistorialSaldo` | Historial legacy (positivo=asignacion, negativo=gasto) |
| `Saldo` | Saldo general USD del punto |
| `MovimientoSaldo` | Auditoria de saldo general |

---

## PARTE 4: MODELOS DE DATOS CLAVE

### 4.1 Moneda
```prisma
model Moneda {
  comportamiento_compra  ComportamientoCalculo @default(MULTIPLICA)
  comportamiento_venta   ComportamientoCalculo @default(DIVIDE)
}
```

### 4.2 CambioDivisa
```prisma
model CambioDivisa {
  moneda_origen_id
  moneda_destino_id
  monto_origen
  monto_destino
  tasa_cambio_billetes
  tasa_cambio_monedas
  divisas_entregadas_billetes  // origen (cliente entrega)
  divisas_entregadas_monedas
  divisas_entregadas_total
  divisas_recibidas_billetes   // destino (cliente recibe)
  divisas_recibidas_monedas
  divisas_recibidas_total
  usd_entregado_efectivo
  usd_entregado_transfer
  usd_recibido_efectivo
  usd_recibido_transfer
  metodo_entrega               // efectivo, transferencia, mixto
  tipo_operacion               // COMPRA, VENTA
  estado                       // PENDIENTE, COMPLETADO
  abono_inicial_monto
  saldo_pendiente
}
```

### 4.3 Saldo (general de divisas)
```prisma
model Saldo {
  punto_atencion_id
  moneda_id
  cantidad         // total logico
  billetes         // snapshot fisico
  monedas_fisicas  // snapshot fisico
  bancos           // snapshot fisico
}
```

### 4.4 ServicioExternoSaldo
```prisma
model ServicioExternoSaldo {
  punto_atencion_id
  servicio         // SERVIENTREGA, WESTERN, etc.
  moneda_id
  cantidad         // total logico
  billetes
  monedas_fisicas
  bancos
}
```

### 4.5 ServicioExternoMovimiento
```prisma
model ServicioExternoMovimiento {
  punto_atencion_id
  servicio
  tipo_movimiento  // INGRESO, EGRESO
  moneda_id
  monto
  billetes
  monedas_fisicas
  bancos
  metodo_ingreso   // EFECTIVO, BANCO, MIXTO
  numero_referencia
}
```

---

## PARTE 5: CONCLUSIONES SOBRE QUE NO TOCAR

### Lo que funciona bien y NO debe cambiarse:

1. **La arquitectura de doble saldo** (ServicioExternoSaldo + Saldo general) es correcta:
   - ServicioExternoSaldo = credito digital asignado por admin
   - Saldo general = efectivo real en caja
   - Ambos deben moverse en espejo para servicios con asignacion

2. **El flujo de Servientrega** (generar guia -> descontar credito -> ingresar a caja) es logicamente correcto:
   - Se gasta credito digital (ServicioExternoSaldo)
   - Se recibe efectivo real (Saldo general)
   - La anulacion revierte ambos

3. **La distincion entre servicios CON y SIN asignacion** es correcta:
   - INSUMOS/OTROS no necesitan credito digital
   - Solo afectan Saldo general

4. **El manejo de concesiones** (no actualizar saldo general) es correcto:
   - Las concesiones solo manejan credito Servientrega
   - No manejan efectivo propio

### Lo que SI tiene errores y puede mejorarse:

1. **El backend ignora los comportamientos de divisa de la BD** (usa tabla hardcodeada)
2. **Los endpoints de Servientrega no validan roles** (cualquiera puede aprobar anulaciones)
3. **La generacion de guia no es atomica** (guardar + descuento + ingreso son operaciones separadas)
4. **El cuadre de caja muestra diferencia siempre en cero**
5. **Timezone inconsistente** en multiples endpoints

---

## PARTE 6: REGLAS DE ORO PARA MODIFICACIONES

### Si modificas calculo de divisas:
- El backend DEBE usar los campos `comportamiento_compra/venta` de la tabla Moneda
- La tabla hardcodeada `rateModeByCode` debe eliminarse o sincronizarse con la BD
- Todos los pares de monedas operativos deben probarse

### Si modificas saldos de Servientrega:
- Siempre mover ServicioExternoSaldo Y Saldo general en espejo
- Excepcion: concesiones solo mueven ServicioExternoSaldo
- Siempre registrar MovimientoSaldo para auditoria

### Si modificas servicios externos:
- Diferenciar si el servicio tiene asignacion (SERVICIOS_CON_ASIGNACION) o no
- Los que tienen asignacion: mover ambos saldos (credito + general)
- Los que NO tienen asignacion: mover solo Saldo general
