# Análisis: Información del Punto de Origen en Servientrega

## 🔍 Problemas Identificados

### 1. Información de Agencia NO se guarda en BD ❌

**Archivo:** `server/routes/servientrega/shipping.ts`

**Problema:**
- Líneas 986-987: Se obtienen `agencia_codigo` y `agencia_nombre` del punto
- Línea 1003-1011: Se crea `guiaData` pero NO incluye estos campos
- Resultado: La guía se guarda sin información de la agencia de Servientrega

**Código actual:**
```typescript
const guiaData: GuiaData = {
  numero_guia: guia,
  proceso: procesoGuia,
  base64_response: typeof base64 === "string" ? base64 : "",
  punto_atencion_id: punto_atencion_id_captado || undefined,
  usuario_id: req.user?.id || undefined,
  costo_envio: valorTotalGuia > 0 ? Number(valorTotalGuia) : undefined,
  valor_declarado: Number(req.body?.valor_declarado || 0),
};
// ❌ Falta: agencia_codigo y agencia_nombre
```

### 2. Interfaz GuiaData NO tiene los campos ❌

**Archivo:** `server/services/servientregaDBService.ts`

```typescript
export interface GuiaData {
  numero_guia: string;
  proceso: string;
  base64_response: string;
  remitente_id?: string;
  destinatario_id?: string;
  punto_atencion_id?: string;
  usuario_id?: string;
  costo_envio?: number;
  valor_declarado?: number;
  // ❌ Falta: agencia_codigo y agencia_nombre
}
```

### 3. Método guardarGuia NO guarda la información ❌

**Archivo:** `server/services/servientregaDBService.ts` (línea 306-345)

El método `guardarGuia` no incluye los campos `agencia_codigo` y `agencia_nombre` en el `cleanData`.

### 4. Validación de Punto sin Servientrega Configurado ✅ (YA EXISTE)

Líneas 474-485: Ya existe validación que rechaza guías si el punto no tiene `servientrega_agencia_codigo`.

```typescript
if (!punto.servientrega_agencia_codigo) {
  return res.status(403).json({
    error: "Servientrega no habilitado",
    mensaje: `El punto "${punto.nombre}" no tiene Servientrega configurado...`,
  });
}
```

### 5. Payload a Servientrega SÍ incluye información del punto ✅ (YA FUNCIONA)

Líneas 550-559: El payload enviado a Servientrega incluye:
- `alianza`: servientregaAlianza
- `alianza_oficina`: servientregaOficinaAlianza
- `nombre_agencia`: servientrega_agencia_nombre o servientrega_oficina_alianza
- `agencia_codigo`: servientrega_agencia_codigo

Esto significa que el PDF generado por Servientrega SÍ tiene la información correcta.

---

## ✅ Soluciones Aplicadas

### Corrección 1: Agregar campos a interfaz GuiaData

```typescript
export interface GuiaData {
  numero_guia: string;
  proceso: string;
  base64_response: string;
  remitente_id?: string;
  destinatario_id?: string;
  punto_atencion_id?: string;
  usuario_id?: string;
  costo_envio?: number;
  valor_declarado?: number;
  agencia_codigo?: string;  // ✅ NUEVO
  agencia_nombre?: string;  // ✅ NUEVO
}
```

### Corrección 2: Incluir información en guiaData

```typescript
const guiaData: GuiaData = {
  numero_guia: guia,
  proceso: procesoGuia,
  base64_response: typeof base64 === "string" ? base64 : "",
  punto_atencion_id: punto_atencion_id_captado || undefined,
  usuario_id: req.user?.id || undefined,
  costo_envio: valorTotalGuia > 0 ? Number(valorTotalGuia) : undefined,
  valor_declarado: Number(req.body?.valor_declarado || 0),
  agencia_codigo: agencia_codigo,      // ✅ NUEVO
  agencia_nombre: agencia_nombre,      // ✅ NUEVO
};
```

### Corrección 3: Guardar en método guardarGuia

```typescript
const cleanData: Prisma.ServientregaGuiaUncheckedCreateInput = {
  numero_guia: data.numero_guia,
  proceso: data.proceso,
  // ... otros campos
};

if (data.agencia_codigo) cleanData.agencia_codigo = data.agencia_codigo;  // ✅ NUEVO
if (data.agencia_nombre) cleanData.agencia_nombre = data.agencia_nombre;  // ✅ NUEVO
```

---

## 📝 Notas Adicionales

1. **El PDF generado por Servientrega YA incluye la información correcta** del punto de origen porque se envía en el payload a la API de Servientrega.

2. **El problema es solo en la BD local** donde no se guarda el registro de qué agencia se usó.

3. **Impacto:** Si un punto cambia de agencia Servientrega en el futuro, las guías históricas no tendrán registro de qué agencia se usó originalmente.

4. **Validación:** Ya existe validación para evitar generar guías en puntos sin Servientrega configurado.
