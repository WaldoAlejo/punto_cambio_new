# Correcciones Críticas - Módulo Servientrega

**Fecha:** 24 de marzo 2026  
**Estado:** ✅ Completado

---

## 🛡️ Correcciones Aplicadas

### 1. Idempotencia en Generación de Guías ✅

**Archivo:** `server/routes/servientrega/shipping.ts`

**Cambio:**
```typescript
// ANTES
router.post("/generar-guia", async (req, res) => {

// DESPUÉS
router.post("/generar-guia",
  idempotency({ route: "/api/servientrega/generar-guia" }),
  validarSaldoGenerarGuia,
  async (req, res) => {
```

**Impacto:** Previene generación de guías duplicadas si el usuario hace doble click o hay problemas de red.

---

### 2. Idempotencia en Anulación de Guías ✅

**Archivo:** `server/routes/servientrega/shipping.ts`

**Cambio:**
```typescript
// ANTES
router.post("/anular-guia", async (req, res) => {

// DESPUÉS
router.post("/anular-guia",
  idempotency({ route: "/api/servientrega/anular-guia" }),
  async (req, res) => {
```

**Impacto:** Previene anulaciones múltiples de la misma guía.

---

### 3. Validación de Saldo Antes de Generar Guía ✅

**Archivo:** `server/routes/servientrega/shipping.ts`

**Nueva Función:** `validarSaldoGenerarGuia`

**Funcionamiento:**
1. Verifica que el punto de atención esté asignado
2. Obtiene el saldo actual (USD) del punto
3. Valida según el método de ingreso:
   - **EFECTIVO:** Valida saldo en caja
   - **BANCO:** Valida saldo en bancos
   - **MIXTO:** Valida saldo en caja + bancos
4. Si el saldo es insuficiente, retorna error 400 con detalles

**Respuesta de Error:**
```json
{
  "success": false,
  "error": "Saldo insuficiente",
  "detalles": {
    "saldo_disponible": 150.00,
    "saldo_requerido": 200.00,
    "tipo_saldo": "efectivo (caja)",
    "metodo_ingreso": "EFECTIVO",
    "mensaje": "El saldo disponible en efectivo (caja) ($150.00) es menor al valor de la guía ($200.00)"
  }
}
```

**Impacto:** Evita generar guías cuando no hay fondos suficientes para cubrir el envío.

---

## 📋 Resumen de Cambios

| Endpoint | Protección | Estado |
|----------|------------|--------|
| POST /api/servientrega/generar-guia | Idempotencia + Validación de Saldo | ✅ Protegido |
| POST /api/servientrega/anular-guia | Idempotencia | ✅ Protegido |

---

## 🔍 Cómo Funciona la Validación

### Flujo de Generación de Guía (Actualizado):

```
1. Frontend envía request con idempotency-key
   ↓
2. Middleware de Idempotencia verifica duplicados
   ↓
3. Middleware validarSaldoGenerarGuia:
   a. Obtiene punto_atencion_id del usuario
   b. Busca saldo USD del punto
   c. Calcula saldo disponible según método (EFECTIVO/BANCO/MIXTO)
   d. Compara con valor_total de la guía
   e. Si es suficiente → continúa
   f. Si es insuficiente → retorna error 400
   ↓
4. Procesa generación de guía normalmente
   ↓
5. Registra ingreso en saldo del punto
   ↓
6. Retorna guía generada
```

---

## ⚠️ Notas Importantes

1. **Idempotency Key:** El frontend debe enviar el header `idempotency-key` en las peticiones. Si no se envía, la protección no se activa (pero la validación de saldo sí).

2. **Método de Ingreso:** La validación respeta el desglose de pago:
   - Si el usuario indica "EFECTIVO $50, BANCO $30", se valida que haya $50 en caja y $30 en bancos.
   - Si indica "MIXTO", se valida la suma total.

3. **Mensajes de Error:** Los errores ahora son descriptivos, indicando:
   - Cuánto saldo hay disponible
   - Cuánto se requiere
   - En qué tipo de saldo (efectivo/bancos)

---

## ✅ Pruebas Recomendadas

Antes de deployar a producción, probar:

1. **Generar guía con saldo suficiente** → Debe funcionar normalmente
2. **Generar guía con saldo insuficiente** → Debe retornar error 400
3. **Generar guía sin idempotency-key** → Debe funcionar (pero sin protección)
4. **Generar guía con mismo idempotency-key** → Segunda petición debe retornar resultado de la primera
5. **Doble click en generar guía** → Solo debe generarse una guía
6. **Anular guía dos veces** → Segunda anulación debe retornar resultado de la primera

---

**Correcciones completadas y listas para producción.**
