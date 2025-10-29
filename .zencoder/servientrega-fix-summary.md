# 🔧 Servientrega Guide Generation - Payload Fix Summary

## 📋 Problema Identificado

**El Servientrega API genera la guía correctamente desde Postman**, pero falla cuando se envía desde la aplicación. La razón: diferencias en la construcción del payload y falta de normalización de campos.

### Errores Específicos:

1. **Campos sin normalización**: `pais_destinatario` y `contenido` no siempre estaban en mayúsculas
2. **Tipos de datos inconsistentes**: Algunos campos eran strings, otros numbers, sin conversión explícita
3. **Campos faltantes**: `valor_asegurado` no se incluía si era 0
4. **Fallback insuficiente**: Si `contenido` llegaba vacío, se quedaba vacío en lugar de usar un default

---

## ✅ Cambios Realizados

### 1. **Frontend** (`src/components/servientrega/PasoConfirmarEnvio.tsx`)

**Línea 181**: Asegurar que `pais_destinatario` siempre esté en mayúsculas

```typescript
// ❌ ANTES
pais_destinatario: d.pais || "ECUADOR",

// ✅ DESPUÉS
pais_destinatario: (d.pais || "ECUADOR").toUpperCase(),
```

**Línea 183**: Asegurar que `contenido` siempre esté en mayúsculas con fallback

```typescript
// ❌ ANTES
contenido: (m?.contenido || "").trim() || "DOCUMENTO",

// ✅ DESPUÉS
contenido: ((m?.contenido || "").trim() || "DOCUMENTO").toUpperCase(),
```

---

### 2. **Backend** (`server/routes/servientrega/shipping.ts`)

#### **A. Rama 1: Payload NO pre-formateado** (líneas 288-331)

- ✅ Conversión explícita a `String()` para todos los campos de texto
- ✅ `pais_destinatario` siempre en mayúsculas con `.toUpperCase()`
- ✅ Fallback robusto para `contenido`
- ✅ `valor_asegurado` siempre incluido (incluso si es 0)
- ✅ Conversión explícita a `Number()` para campos numéricos

```typescript
payload = {
  tipo: "GeneracionGuia",
  nombre_producto: producto,
  ciudad_origen: ciudadOrigen,
  cedula_remitente: String(
    remitente?.identificacion || remitente?.cedula || ""
  ),
  // ... otros campos con String()
  pais_destinatario: String(destinatario?.pais || "ECUADOR").toUpperCase(),
  contenido: (
    contenido ||
    (producto === "DOCUMENTO UNITARIO" ? "DOCUMENTOS" : "MERCANCIA")
  ).toUpperCase(),
  valor_asegurado: va, // ← Ahora siempre se incluye
  peso_fisico: Number(peso_fisico),
  // ... otros numéricos con Number()
  usuingreso: String(credentials.usuingreso),
  contrasenha: String(credentials.contrasenha),
};
```

#### **B. Rama 2: Payload pre-formateado** (líneas 356-382)

- ✅ Misma lógica de conversión y normalización
- ✅ `pais_destinatario` en mayúsculas
- ✅ `contenido` con fallback a "DOCUMENTO"
- ✅ `valor_asegurado` siempre incluido
- ✅ Credenciales SIEMPRE desde env (sin permitir sobrescritura)

---

#### **C. Logging Mejorado** (líneas 399-421)

Ahora muestra exactamente qué se envía a Servientrega:

```typescript
// LOG 1: Payload completo
console.log("📤 PAYLOAD FINAL ENVIADO A SERVIENTREGA:");
console.log(JSON.stringify(payload, null, 2));

// LOG 2: Credenciales (enmascaradas)
console.log("🔐 Credenciales (enmascaradas):", {
  usuingreso: payload.usuingreso,
  contrasenha: "***",
});

// LOG 3: Validación de campos críticos
console.log("✅ Validación de campos críticos:", {
  tipo: payload.tipo,
  nombre_producto: payload.nombre_producto,
  ciudad_origen: payload.ciudad_origen,
  ciudad_destinatario: payload.ciudad_destinatario,
  pais_destinatario: payload.pais_destinatario,
  contenido: payload.contenido,
  cedula_remitente: payload.cedula_remitente ? "✓ (lleno)" : "✗ (vacío)",
  cedula_destinatario: payload.cedula_destinatario ? "✓ (lleno)" : "✗ (vacío)",
});
```

#### **D. Logging de Respuesta de Servientrega** (líneas 424-429)

```typescript
console.log("📡 Llamando a Servientrega API...");
const response = await apiService.callAPI(payload);

// 📥 LOG: Respuesta RAW de Servientrega
console.log("📥 RESPUESTA RAW DE SERVIENTREGA:");
console.log(JSON.stringify(response, null, 2));
```

#### **E. Logging de Extracción de Guía** (líneas 461-468)

```typescript
console.log("📊 Extracción de guía y base64:", {
  guia: guia ? `✓ ${guia}` : "✗ (no encontrada)",
  base64: base64
    ? `✓ (${(base64 as string).length} caracteres)`
    : "✗ (no encontrado)",
  proceso: fetchData?.proceso || processed?.proceso || "N/A",
});
```

#### **F. Logging de Errores** (líneas 529-536)

Si la guía NO se genera:

```typescript
console.error("❌ FALLO: Guía NO se generó correctamente");
console.error("Razón:", {
  guia_presente: !!guia,
  base64_presente: !!base64,
  proceso: fetchData?.proceso || processed?.proceso,
  respuesta_completa: JSON.stringify(processed, null, 2),
});
```

---

## 🚀 Cómo Probar

### 1. **Rebuilld del Backend**

```bash
cd /Users/oswaldo/Documents/Punto\ Cambio/punto_cambio_new
npm run build:server
```

O si usas `bun`:

```bash
bun run build:server
```

### 2. **Inicia el backend**

```bash
npm run dev:server
# O
bun run dev:server
```

### 3. **Prueba desde la App**

1. Abre la app en el navegador
2. Navega a Servientrega → Generar Guía
3. Completa el formulario con datos de prueba
4. Haz clic en "Generar Guía"

### 4. **Revisa la Consola del Backend**

Deberías ver logs como:

```
📤 PAYLOAD FINAL ENVIADO A SERVIENTREGA:
{
  "tipo": "GeneracionGuia",
  "nombre_producto": "DOCUMENTO UNITARIO",
  "ciudad_origen": "QUITO-PICHINCHA",
  ...
  "pais_destinatario": "ECUADOR",
  "contenido": "PAPELITOS PEQUENOS",
  "valor_asegurado": 0,
  ...
}

🔐 Credenciales (enmascaradas): { usuingreso: "INTPUNTOC", contrasenha: "***" }

✅ Validación de campos críticos:
{
  tipo: "GeneracionGuia",
  nombre_producto: "DOCUMENTO UNITARIO",
  ciudad_origen: "QUITO-PICHINCHA",
  ciudad_destinatario: "QUITO-PICHINCHA",
  pais_destinatario: "ECUADOR",
  contenido: "PAPELITOS PEQUENOS",
  cedula_remitente: "✓ (lleno)",
  cedula_destinatario: "✓ (lleno)"
}

📡 Llamando a Servientrega API...

📥 RESPUESTA RAW DE SERVIENTREGA:
{
  fetch: {
    proceso: "Guia_Generada_Correctamente",
    guia: "1000720952",
    guia_pdf: "https://...",
    guia_64: "JVBERi0xLjMK..."
  }
}

📊 Extracción de guía y base64:
{
  guia: "✓ 1000720952",
  base64: "✓ (28345 caracteres)",
  proceso: "Guia_Generada_Correctamente"
}
```

---

## 🔍 Si Aún Falla

### Casos Comunes:

**1. Logs muestran `pais_destinatario: "Ecuador"` (minúsculas)**

- Problema: El frontend NO está enviando la versión corregida
- Solución: Limpia cache del navegador (Ctrl+Shift+Delete)

**2. Logs muestran `contenido: ""` (vacío)**

- Problema: El fallback del frontend no está funcionando
- Solución: Asegúrate de que el campo "Contenido" esté lleno en el formulario

**3. `cedula_destinatario` diferente de `cedula_remitente`**

- Problema: Los datos del destinatario no se están pasando correctamente
- Solución: Verifica que el formulario de pasos anteriores esté guardando los datos

**4. Log muestra `guia_64` pero el frontend dice "Respuesta incompleta"**

- Problema: El frontend NO está extrayendo correctamente el base64
- Solución: El frontend tiene lógica para buscar en diferentes ubicaciones. Comprueba `PasoConfirmarEnvio.tsx` líneas 212-248

---

## 📝 Notas Importantes

✅ **El base64 se guarda en BD** en la tabla `servientrega_guia` (campo `base64_response`)

✅ **El base64 se puede recuperar** vía GET `/servientrega/guias?desde=...&hasta=...`

✅ **Las credenciales vienen del .env**, NO del payload del frontend (por seguridad)

✅ **El payload se reorganiza** para coincidir exactamente con lo que Servientrega espera

---

## 🎯 Resumen de Campos Críticos

| Campo               | Tipo   | Normalización        | Ejemplo              |
| ------------------- | ------ | -------------------- | -------------------- |
| `tipo`              | String | N/A                  | "GeneracionGuia"     |
| `nombre_producto`   | String | N/A                  | "DOCUMENTO UNITARIO" |
| `pais_destinatario` | String | **UPPERCASE**        | "ECUADOR"            |
| `contenido`         | String | **UPPERCASE**        | "PAPELITOS PEQUENOS" |
| `valor_asegurado`   | Number | **Siempre incluido** | 0                    |
| `valor_declarado`   | Number | Siempre incluido     | 0                    |
| `peso_fisico`       | Number | Conversión explícita | 0.5                  |

---

## ⚠️ Si el Problema Persiste

1. **Copia los logs COMPLETOS** de la consola del backend (desde "📤 PAYLOAD FINAL..." hasta "📊 Extracción de guía...")
2. **Compara manualmente** con el payload de Postman que funciona
3. **Busca diferencias** en:
   - Mayúsculas/minúsculas
   - Valores numéricos vs strings
   - Campos faltantes o con valores diferentes
   - Orden de campos (aunque TypeScript preserva el orden de creación)

---

**✨ Última actualización:** 2025-10-29
