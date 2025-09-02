# 🔧 Diagnóstico: API de Agencias Servientrega

## 🐛 Problema Reportado

El selector de agencias de Servientrega muestra "No hay agencias disponibles" cuando antes funcionaba correctamente.

## 🔍 Pasos de Diagnóstico

### 1. **Acceder a la Página de Debug**

Una vez que el servidor esté ejecutándose, ve a:

```
http://localhost:3000/debug-servientrega
```

Esta página te permitirá probar la conectividad con la API de Servientrega.

### 2. **Ejecutar Tests de Conectividad**

En la página de debug:

1. **Haz clic en "🧪 Test Conectividad"**

   - Esto probará tanto productos como agencias
   - Revisa la consola del navegador para logs detallados
   - Revisa los logs del servidor

2. **Haz clic en "🔍 Test Normal"**
   - Esto probará el endpoint normal de agencias
   - Compara los resultados con el test de conectividad

### 3. **Revisar Logs del Servidor**

En la terminal del servidor, busca:

```bash
# Logs de credenciales
🔑 Credenciales utilizadas: { usuingreso: "INTPUNTOC", contrasenha: "***" }

# Logs de respuesta de la API
📍 Servientrega API: Respuesta de agencias recibida: [objeto]

# Logs de procesamiento
✅ Agencias procesadas: X encontradas
```

### 4. **Posibles Problemas y Soluciones**

#### **A. Problema de Credenciales**

```bash
# Si ves:
🔑 Credenciales utilizadas: { usuingreso: "INTPUNTOC", contrasenha: "NO_SET" }

# Solución: Verificar variables de entorno
```

#### **B. Problema de Conectividad**

```bash
# Si ves errores como:
❌ Error al conectar con Servientrega: ECONNREFUSED
❌ Timeout al conectar con Servientrega

# Solución: Verificar conexión a internet y URLs de la API
```

#### **C. Problema de Formato de Respuesta**

```bash
# Si ves:
🔍 Estructura de respuesta no reconocida, intentando extraer agencias...
📋 Claves disponibles: [array de claves]

# Solución: La API cambió su formato de respuesta
```

#### **D. Problema de Autenticación**

```bash
# Si la respuesta contiene errores de autenticación
# Solución: Verificar que las credenciales sean válidas
```

## 🛠️ Archivos Modificados para Diagnóstico

### 1. **Backend - Endpoint de Test**

- `server/routes/servientrega/products.ts`
- Agregado endpoint `/test-agencias` para diagnóstico
- Logs mejorados en endpoint `/agencias`

### 2. **Frontend - Componente de Debug**

- `src/components/debug/ServientregaDebug.tsx`
- Interfaz para probar conectividad
- Muestra resultados detallados

### 3. **Rutas - Acceso Temporal**

- `src/App.tsx`
- Ruta temporal `/debug-servientrega`

## 📊 Información de las APIs

### **URL Principal**

```
https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php
```

### **Credenciales Actuales**

```
Usuario: INTPUNTOC
Contraseña: 73Yes7321t
```

### **Payload para Agencias**

```json
{
  "tipo": "obtener_agencias_aliadas",
  "usuingreso": "INTPUNTOC",
  "contrasenha": "73Yes7321t"
}
```

## 🔄 Pasos de Recuperación

### **Si el problema es temporal:**

1. Esperar unos minutos y volver a probar
2. Verificar que Servientrega no esté en mantenimiento

### **Si el problema es de credenciales:**

1. Contactar a Servientrega para verificar credenciales
2. Actualizar variables de entorno si es necesario

### **Si el problema es de formato:**

1. Revisar la nueva estructura de respuesta
2. Actualizar el código de procesamiento en `products.ts`

### **Si el problema persiste:**

1. Implementar cache temporal de agencias
2. Usar datos de respaldo mientras se resuelve

## 🧹 Limpieza Post-Diagnóstico

Una vez resuelto el problema, eliminar:

1. **Componente de debug**: `src/components/debug/ServientregaDebug.tsx`
2. **Ruta temporal**: Remover `/debug-servientrega` de `App.tsx`
3. **Endpoint de test**: Remover `/test-agencias` de `products.ts`
4. **Logs extra**: Limpiar logs de debug en producción

---

**Fecha**: $(date)
**Estado**: 🔍 **Diagnóstico en progreso**
**Próximo paso**: Ejecutar tests de conectividad
