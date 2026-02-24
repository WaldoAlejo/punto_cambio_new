# 📋 Mejoras Implementadas: Control de Tiempo y Jornadas

## Resumen

Se ha realizado una mejora completa del sistema de control de tiempo y jornadas, migrando los cálculos al backend y agregando validaciones de negocio robustas.

---

## 🎯 Problemas Solucionados

### 1. Cálculo de Tiempo en Frontend (🔴 Crítico)
**Problema:** El tiempo trabajado se calculaba en el navegador, susceptible a manipulación del reloj del cliente.

**Solución:** 
- Nuevo servicio `timeTrackingService.ts` que centraliza TODOS los cálculos en el backend
- Función `calcularTiemposJornada()` calcula tiempos de forma precisa y consistente
- Los tiempos se devuelven en cada respuesta de API en el campo `tiempos_calculados`

### 2. Sin Validaciones de Negocio (🔴 Crítico)
**Problema:** No había validaciones de horarios, tiempos máximos, ni prevención de duplicados.

**Solución:**
- `validarInicioJornada()` - Valida hora de entrada, prevención de duplicados
- `validarAlmuerzo()` - Valida transiciones de estado, tiempo máximo de almuerzo
- `validarFinJornada()` - Valida tiempo mínimo/máximo de jornada, hora de salida
- Las validaciones se ejecutan automáticamente en cada operación

### 3. Falta de Reportes de Asistencia (🟡 Alta)
**Problema:** No había forma de generar reportes de horas trabajadas.

**Solución:**
- Endpoints nuevos:
  - `GET /api/schedules/stats/me` - Estadísticas del usuario autenticado
  - `GET /api/schedules/stats/:userId` - Estadísticas de cualquier usuario (admin)
- Cálculo de estadísticas por período configurable
- Exportación CSV en `GET /api/schedules?format=csv`

### 4. Sin Auditoría (🟡 Alta)
**Problema:** No se registraba quién modificaba jornadas ni cuándo.

**Solución:**
- Nuevos campos en tabla `Jornada`:
  - `created_at`, `updated_at` - Timestamps
  - `created_by`, `updated_by` - Usuario que realizó la acción
  - `minutos_trabajados`, `minutos_almuerzo`, `minutos_salidas` - Campos calculados
- Todos los endpoints actualizan estos campos automáticamente

### 5. Sin Configuración de Horarios (🟢 Media)
**Problema:** No había forma de configurar reglas de validación.

**Solución:**
- Nueva tabla `ConfiguracionHorario`
- Nuevos endpoints:
  - `GET /api/schedule-config` - Listar configuraciones
  - `POST /api/schedule-config` - Crear configuración (admin)
  - `PUT /api/schedule-config/:id` - Actualizar (admin)
  - `GET /api/schedule-config/current/applicable` - Config aplicable al usuario

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `server/services/timeTrackingService.ts` | Servicio central de cálculo de tiempos y validaciones |
| `server/routes/schedule-config.ts` | Endpoints de configuración de horarios |
| `docs/MEJORAS_TIME_TRACKING.md` | Este documento |

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | Campos de auditoría en Jornada, tabla ConfiguracionHorario |
| `server/routes/schedules.ts` | Integración con timeTrackingService, nuevos endpoints de stats |
| `server/index.ts` | Registro de nueva ruta `/api/schedule-config` |

---

## 🔧 Nuevos Endpoints

### Estadísticas
```
GET /api/schedules/stats/me
GET /api/schedules/stats/:userId
```
**Respuesta:**
```json
{
  "success": true,
  "data": {
    "periodo": { "desde": "2025-01-01", "hasta": "2025-01-31" },
    "estadisticas": {
      "totalJornadas": 20,
      "minutosTrabajadosPromedio": 450,
      "minutosAlmuerzoPromedio": 55,
      "diasConLlegadaTarde": 2,
      "diasConSalidaAnticipada": 1,
      "jornadasCompletadas": 18,
      "jornadasEnProgreso": 2
    },
    "resumen_hoy": {
      "totalActivas": 5,
      "totalAlmuerzo": 2,
      "totalCompletadas": 12,
      "promedioMinutosTrabajados": 465
    }
  }
}
```

### Configuración de Horarios
```
GET    /api/schedule-config
POST   /api/schedule-config      (admin)
PUT    /api/schedule-config/:id  (admin)
DELETE /api/schedule-config/:id  (admin)
GET    /api/schedule-config/current/applicable
```

---

## ⚙️ Configuración de Horario

### Campos Configurables

| Campo | Descripción | Default |
|-------|-------------|---------|
| `hora_entrada_minima` | Hora más temprana permitida | 06:00 |
| `hora_entrada_maxima` | Hora más tarde permitida | 10:00 |
| `hora_salida_minima` | Hora más temprana para salir | 16:00 |
| `hora_salida_maxima` | Hora más tarde permitida | 20:00 |
| `min_almuerzo_maximo` | Máximo tiempo de almuerzo | 60 min |
| `min_jornada_minima` | Jornada mínima | 480 min (8h) |
| `min_jornada_maxima` | Jornada máxima | 600 min (10h) |
| `min_tolerancia_llegada` | Gracia para llegar | 10 min |
| `min_tolerancia_salida` | Gracia para salir | 10 min |
| `requiere_ubicacion` | GPS obligatorio | false |
| `radio_permitido_metros` | Radio máximo del punto | 500 m |

---

## 📊 Respuestas con Tiempos Calculados

Todas las respuestas de jornadas ahora incluyen tiempos calculados:

```json
{
  "schedule": {
    "id": "...",
    "estado": "COMPLETADO",
    "fecha_inicio": "2025-01-15T08:00:00Z",
    "fecha_salida": "2025-01-15T17:00:00Z",
    "tiempos_calculados": {
      "minutosTrabajados": 540,
      "minutosAlmuerzo": 60,
      "minutosSalidas": 15,
      "minutosNetos": 465
    }
  },
  "validacion": {
    "valido": true,
    "errores": [],
    "advertencias": ["Tiempo de almuerzo excede el máximo recomendado"]
  }
}
```

---

## 🔒 Validaciones Implementadas

### Inicio de Jornada
- ✅ No duplicar jornadas activas por día
- ✅ Validar hora de entrada dentro de rangos permitidos
- ✅ Validar ubicación GPS (si está configurado)
- ✅ Prevenir jornadas en puntos ya ocupados

### Almuerzo
- ✅ Solo desde estado ACTIVO
- ✅ Solo un almuerzo por jornada
- ✅ Regreso solo desde estado ALMUERZO
- ✅ Alerta si excede tiempo máximo

### Fin de Jornada
- ✅ No finalizar desde estado ALMUERZO
- ✅ Validar tiempo mínimo de jornada
- ✅ Validar tiempo máximo de jornada
- ✅ Validar hora de salida
- ✅ Cierre de caja requerido (para roles no exentos)

---

## 🚀 Próximos Pasos Sugeridos

1. **Frontend:** Actualizar componentes para mostrar las advertencias de validación
2. **Frontend:** Crear vista de estadísticas personales usando `/api/schedules/stats/me`
3. **Admin:** Crear interfaz de configuración de horarios
4. **Reportes:** Agregar más tipos de reportes (tardanzas, horas extras, etc.)

---

## 📝 Notas Técnicas

- Los cálculos de tiempo usan la hora del servidor (UTC), no del cliente
- Las validaciones pueden ser ignoradas con el flag `override` (solo admins)
- Los campos calculados se actualizan automáticamente al finalizar jornada
- La exportación CSV incluye todos los tiempos calculados
