# Correcciones Completas - Módulo Servientrega

**Fecha:** 24 de marzo 2026  
**Estado:** ✅ Completado

---

## 📋 Resumen de Correcciones

### 1. Idempotencia en Generación de Guías ✅

**Archivo:** `server/routes/servientrega/shipping.ts`

**Cambio:**
```typescript
router.post("/generar-guia",
  idempotency({ route: "/api/servientrega/generar-guia" }),
  validarSaldoGenerarGuia,
  async (req, res) => {
```

**Impacto:** Previene generación de guías duplicadas.

---

### 2. Idempotencia en Anulación de Guías ✅

**Archivo:** `server/routes/servientrega/shipping.ts`

**Cambio:**
```typescript
router.post("/anular-guia",
  idempotency({ route: "/api/servientrega/anular-guia" }),
  async (req, res) => {
```

**Impacto:** Previene anulaciones múltiples.

---

### 3. Validación de Saldo Antes de Generar Guía ✅

**Archivo:** `server/routes/servientrega/shipping.ts`

**Nuevo Middleware:** `validarSaldoGenerarGuia`

- Valida saldo según método de ingreso (EFECTIVO/BANCO/MIXTO)
- Retorna error 400 con detalles si el saldo es insuficiente

---

### 4. Guardar Información de Agencia en BD ✅

**Problema:** La información de la agencia Servientrega (código y nombre) no se guardaba en la base de datos, aunque sí se enviaba a la API de Servientrega.

**Solución aplicada:**

#### a) Interfaz GuiaData actualizada:
**Archivo:** `server/services/servientregaDBService.ts`
```typescript
export interface GuiaData {
  // ... campos existentes
  agencia_codigo?: string;    // ✅ NUEVO
  agencia_nombre?: string;    // ✅ NUEVO
}
```

#### b) Método guardarGuia actualizado:
**Archivo:** `server/services/servientregaDBService.ts`
```typescript
// ✅ NUEVO: Guardar información de la agencia Servientrega
if (data.agencia_codigo) cleanData.agencia_codigo = data.agencia_codigo;
if (data.agencia_nombre) cleanData.agencia_nombre = data.agencia_nombre;
```

#### c) Objeto guiaData actualizado:
**Archivo:** `server/routes/servientrega/shipping.ts`
```typescript
const guiaData: GuiaData = {
  // ... campos existentes
  agencia_codigo: agencia_codigo,      // ✅ Código de agencia Servientrega del punto
  agencia_nombre: agencia_nombre,      // ✅ Nombre de agencia Servientrega del punto
};
```

**Impacto:** 
- Las guías ahora guardan el código y nombre de la agencia Servientrega usada
- Permite consultas históricas por agencia
- Mantiene integridad de datos si el punto cambia de agencia en el futuro

---

## 🔍 Flujo Completo de Generación de Guía

```
1. Usuario solicita generar guía
   ↓
2. Middleware de Idempotencia verifica duplicados
   ↓
3. Middleware validarSaldoGenerarGuia:
   a. Obtiene punto_atencion_id del usuario
   b. Busca saldo USD del punto
   c. Valida saldo según método (EFECTIVO/BANCO/MIXTO)
   d. Si es insuficiente → Error 400
   ↓
4. Validación de Punto:
   a. Obtiene información del punto (alianza, oficina, agencia)
   b. Valida que tenga servientrega_agencia_codigo
   c. Si no está configurado → Error 403
   ↓
5. Construcción de Payload:
   a. Incluye datos de remitente/destinatario
   b. Incluye datos del punto de origen (alianza, oficina, agencia)
   ↓
6. Llamada a API Servientrega:
   a. Genera guía con información del punto
   b. Retorna número de guía y PDF (base64)
   ↓
7. Guardado en BD:
   a. Guarda número_guia, proceso, base64
   b. ✅ Guarda agencia_codigo y agencia_nombre
   c. Guarda punto_atencion_id, usuario_id
   d. Guarda costo_envio, valor_declarado
   ↓
8. Registro contable:
   a. Descuenta saldo de Servientrega
   b. Registra ingreso en saldo general USD
   ↓
9. Respuesta al frontend con guía generada
```

---

## 📊 Estado de Campos en BD

### Tabla: ServientregaGuia

| Campo | Tipo | Estado | Descripción |
|-------|------|--------|-------------|
| numero_guia | String | ✅ | Número de guía generado |
| proceso | String | ✅ | Estado del proceso |
| base64_response | String | ✅ | PDF en base64 |
| punto_atencion_id | String | ✅ | Punto que generó la guía |
| usuario_id | String | ✅ | Usuario que generó la guía |
| agencia_codigo | String | ✅ **NUEVO** | Código agencia Servientrega |
| agencia_nombre | String | ✅ **NUEVO** | Nombre agencia Servientrega |
| costo_envio | Decimal | ✅ | Costo del envío |
| valor_declarado | Decimal | ✅ | Valor declarado |

---

## ✅ Verificación de Compilación

```bash
npx tsc --noEmit
```

**Resultado:** ✅ Sin errores

---

## 🧪 Pruebas Recomendadas

1. **Generar guía con saldo suficiente**
   - Verificar que se guarde agencia_codigo y agencia_nombre

2. **Generar guía sin saldo**
   - Verificar error 400 con mensaje claro

3. **Generar guía en punto sin Servientrega configurado**
   - Verificar error 403 con mensaje informativo

4. **Consultar guías por agencia**
   - Verificar que el filtro por agencia_codigo funcione

5. **Imprimir guía**
   - Verificar que el PDF tenga información correcta del punto de origen

---

## 📝 Notas Finales

- La información del punto de origen **SÍ se envía correctamente** a Servientrega para generar el PDF
- El problema era que **no se guardaba en la BD local** para consultas históricas
- Ahora la información se guarda completa en ambos lugares
- Todos los endpoints críticos tienen protección de idempotencia
