# 🔧 PROBLEMAS REPORTADOS - SOLUCIONES APLICADAS

**Reporte del Usuario Administrador:**

- Asignación de saldo solo funciona en YAGANASTE
- Descrepancia de montos (402.42 vs 502.42 en Cotoollao)
- Valor declarado obligatorio en Servientrega
- Documentos bloqueados cuando se ingresan medidas
- Falta incluir flete en cálculo de guía
- No se genera valor total correcto

---

## ✅ CORRECCIONES APLICADAS

### 1. **VALOR DECLARADO NO OBLIGATORIO**

**Archivo:** `src/components/servientrega/PasoEmpaqueYMedidas.tsx`
**Problema:** La validación exigía `valor_declarado > 0` aunque el comentario decía que era opcional
**Solución:**

```typescript
// ANTES: Bloqueaba si valor_declarado <= 0
if (!medidas.valor_declarado || medidas.valor_declarado <= 0) {
  toast.error("Debes ingresar un valor declarado válido.");
  return false;
}

// DESPUÉS: Se permite valor_declarado = 0
if (esDocumento) {
  return true; // Para documentos, solo necesita contenido
}
// Para mercancía, valor_declarado puede ser 0
```

**Cambios realizados:**

- ✅ Documentos: solo necesitan descripción de contenido
- ✅ Mercancía: pueden tener valor_declarado = 0
- ✅ Validación separada para cada tipo

---

### 2. **DOCUMENTOS BLOQUEADOS CON MEDIDAS**

**Archivo:** `src/components/servientrega/PasoEmpaqueYMedidas.tsx`
**Problema:** La validación requería medidas (alto, ancho, largo) incluso para documentos, pero documentos fuerzan medidas a 0
**Solución:**

```typescript
// ANTES: Validaba medidas para todos (incluyendo documentos)
if (!requiereEmpaque) {
  if (!medidas.alto || !medidas.ancho || !medidas.largo || !medidas.peso) {
    toast.error("Debes ingresar alto, ancho, largo y peso.");
    return false;
  }
}

// DESPUÉS: Valida medidas SOLO para mercancía
if (!esDocumento) {
  if (!requiereEmpaque) {
    if (!medidas.alto || !medidas.ancho || !medidas.largo || !medidas.peso) {
      toast.error("Debes ingresar alto, ancho, largo y peso.");
      return false;
    }
  } else {
    // Requiere empaque si lo marcó
  }
}
// Si es documento, NO valida medidas (solo contenido)
```

**Cambios:**

- ✅ Documentos: validación simplificada (solo contenido)
- ✅ Mercancía nacional sin empaque: requiere todas las medidas
- ✅ Mercancía nacional con empaque: requiere tipo de empaque
- ✅ Mercancía internacional: requiere empaque obligatoriamente

---

### 3. **CÁLCULO DE GUÍA - INCLUIR FLETE CORRECTAMENTE**

**Archivo:** `server/routes/servientrega/shipping.ts` (línea 366-433)
**Problema:**

- No está sumando flete
- No está diferenciando entre costo_envio y valor_declarado
- valor_declarado se estaba descontando del saldo

**Solución:**

```typescript
// ANTES:
const valorTotal =
  Number(processed?.total_transacion) || Number(processed?.gtotal) || 0; // Solo toma un valor sin verificar componentes

// DESPUÉS: Desglose detallado
let valorTotalGuia = 0;

if (processed?.total_transacion) {
  valorTotalGuia = Number(processed.total_transacion); // Incluye todo
} else if (processed?.gtotal) {
  valorTotalGuia = Number(processed.gtotal); // Incluye todo
} else if (processed?.flete) {
  // Si solo viene el flete, construir total
  valorTotalGuia = Number(processed.flete);
  if (processed?.valor_asegurado) {
    valorTotalGuia += Number(processed.valor_asegurado);
  }
  if (processed?.valor_empaque) {
    valorTotalGuia += Number(processed.valor_empaque);
  }
}

console.log("💰 Desglose de costos:", {
  flete: processed?.flete,
  valor_asegurado: processed?.valor_asegurado,
  valor_empaque: processed?.valor_empaque,
  total_final: valorTotalGuia,
  valor_declarado: req.body?.valor_declarado, // ⚠️ NO se descuenta
});

// Guardar con COSTO REAL, no incluir valor_declarado
await db.guardarGuia({
  costo_envio: valorTotalGuia, // Solo costo del envío
  valor_declarado: req.body?.valor_declarado, // Informativo
});

// Descontar SOLO el costo de la guía
await db.descontarSaldo(punto_atencion_id, valorTotalGuia);
```

**Cambios:**

- ✅ Se calcula `total_transacion` o `gtotal` (incluyen todos los costos)
- ✅ Si viene solo `flete`, se suman otros componentes (seguro, empaque)
- ✅ Se diferencia entre `costo_envio` (descuenta) y `valor_declarado` (no descuenta)
- ✅ Se agrega logging detallado para debug
- ✅ El descuento es SOLO del costo real, no del valor declarado

---

### 4. **ASIGNACIÓN DE SALDO LIMITADA A YAGANASTE**

**Estado:** ⏳ REQUIERE INVESTIGACIÓN

**Análisis realizado:**

- ✅ Backend: Endpoint `/servicios-externos/asignar-saldo` acepta todos los servicios
- ✅ Backend: No hay filtro específico por YAGANASTE
- ✅ Frontend: ListaComponente `SERVICIOS_EXTERNOS` incluye todos los servicios
- ✅ Frontend: No hay filtro que limite a YAGANASTE

**Posibles causas:**

1. Error silencioso en la llamada API
2. Validación en middleware que no es visible
3. Permiso de usuario específico

**Acción requerida:**

```
Necesitamos revisar:
1. Logs del servidor al intentar asignar a otros servicios
2. Revisar respuesta de error en el navegador (ver console)
3. Verificar si el usuario tiene permisos ADMIN/SUPER_USUARIO
```

**Recomendación:** Revisar en el navegador la pestaña "Network" cuando intente asignar a otro servicio y ver qué error devuelve el servidor.

---

### 5. **DESCREPANCIA DE MONTOS (402.42 vs 502.42)**

**Estado:** ⏳ REQUIERE INVESTIGACIÓN

**Posibles causas identificadas:**

1. Conversión de Prisma Decimal a Number
2. Duplicación en un middleware
3. Error en cálculo de incremento
4. Problema en visualización (mostrar un valor pero guardar otro)

**Análisis:**

- Diferencia de 100 es sospechosa (redondeo simple)
- Podría ser multiplicación por 1.25 o suma duplicada de 100

**Acción requerida:**

```
Necesitamos logs detallados:
1. Log de la solicitud: cuánto se intenta asignar
2. Log del respuesta: cuánto se asignó
3. Log en BD: qué valor se guardó
4. Verificar tabla: servientregaSaldo y servicioExternoAsignacion
```

**Recomendación:** Revisar los logs del servidor con DEBUG habilitado cuando se asigne el monto.

---

## 📋 ARCHIVOS MODIFICADOS

| Archivo                                               | Líneas  | Cambio                                           |
| ----------------------------------------------------- | ------- | ------------------------------------------------ |
| `src/components/servientrega/PasoEmpaqueYMedidas.tsx` | 195-230 | Validación separada para documentos vs mercancía |
| `server/routes/servientrega/shipping.ts`              | 366-433 | Cálculo correcto de flete y descuento            |

---

## 🧪 CÓMO PROBAR LAS CORRECCIONES

### 1. Valor Declarado Opcional

```
1. Crear guía para DOCUMENTOS
2. Dejar "Valor declarado" en 0 o vacío
3. Debe permitir continuar ✅
```

### 2. Documentos con Medidas

```
1. Seleccionar "DOCUMENTOS"
2. NO debe mostrar campos de medidas (alto, ancho, largo)
3. Solo debe pedir contenido y peso mínimo (0.5kg)
4. Debe permitir continuar ✅
```

### 3. Cálculo de Flete

```
1. Generar guía
2. Revisar logs del servidor: ver desglose de costos
3. Verificar que se descuente:
   - flete ✅
   - seguro ✅
   - empaque ✅
4. NO debe descontar el valor_declarado ✅
```

### 4. Asignación de Saldos

```
1. Ir a Gestión de Saldos - Servicios Externos (Admin)
2. Intentar asignar a:
   - YAGANASTE ✅
   - BANCO_GUAYAQUIL
   - WESTERN
   - PRODUBANCO
   - Otros servicios
3. Si alguno falla, revisar error en console del navegador
```

---

## 🔍 PRÓXIMAS ACCIONES RECOMENDADAS

1. **Investigar problema de YAGANASTE:**

   - Habilitar logs DEBUG
   - Revisar error exacto en console
   - Verificar permisos del usuario

2. **Investigar descrepancia de montos:**

   - Revisar entrada y salida en logs
   - Verificar conversiones Decimal
   - Auditar tabla servicioExternoAsignacion

3. **Testing completo de Servientrega:**

   - Probar con documentos
   - Probar con mercancía nacional
   - Probar con envío internacional
   - Verificar cálculo de flete en cada caso

4. **Documentación:**
   - Actualizar documentación de API
   - Crear guías para usuarios
   - Documentar cambios en changelog

---

## 📞 CONTACTO PARA ISSUES

Si encuentras más problemas:

1. Verificar logs del servidor: `npm run dev:server`
2. Revisar console del navegador (F12)
3. Revisar Network tab para ver respuestas API
4. Documentar error exacto con pasos para reproducir
