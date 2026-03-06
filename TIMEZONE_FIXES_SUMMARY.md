# Correcciones de Timezone - Resumen

## Fecha: 2026-03-05

## Problema Identificado
Las horas de salida en el "Control de Horarios" mostraban valores incorrectos como:
- 04:29 en lugar de 19:29 (7:29 PM)
- 00:11 en lugar de 17:11 (5:11 PM)
- 04:37 en lugar de 23:37 (11:37 PM)

## Causa Raíz
1. **Backend**: El servidor está en Ecuador (GMT-5), pero el código `nowEcuador()` estaba restando 5 horas adicionales a las fechas que ya eran locales, causando un desfase de 5 horas.

2. **Frontend**: Las funciones `toLocaleTimeString()` y `toLocaleDateString()` no especificaban la zona horaria, usando la configuración del navegador. Si el navegador estaba en UTC, mostraba las horas UTC sin conversión.

## Cambios Realizados

### Backend - Server

#### 1. `server/utils/timezone.ts`
- **Agregada función `isServerInEcuador()`**: Detecta si el servidor está en zona horaria GMT-5
- **Modificada función `nowEcuador()`**: Devuelve `new Date()` directamente si el servidor ya está en Ecuador, evitando la doble conversión
- **Modificada función `toEcuadorTime()`**: Usa `isServerInEcuador()` para evitar conversión innecesaria

#### 2. `server/routes/schedules.ts`
- **Línea 494**: Cambiado `new Date()` a `nowEcuador()` para `fecha_salida`
- **Línea 573**: Cambiado `new Date()` a `nowEcuador()` para `fecha_inicio`

#### 3. `server/routes/contabilidad-diaria.ts`
- **Línea 1111**: Cambiado `new Date()` a `nowEcuador()` para `fecha_salida`

#### 4. `server/routes/guardar-cierre.ts`
- **Línea 331**: Cambiado `new Date()` a `nowEcuador()` para `fecha_salida`

### Frontend - Cliente

#### 1. `src/components/admin/ActivePointsReport.tsx`
- **Función `formatTime()`**: Agregado `timeZone: "America/Guayaquil"`
- **Función `formatDate()`**: Agregado `timeZone: "America/Guayaquil"`

#### 2. `src/components/admin/AdminDashboard.tsx`
- **Función `formatDate()`**: Agregado `timeZone: "America/Guayaquil"`

#### 3. `src/components/timeTracking/SpontaneousExitHistory.tsx`
- **Línea 186**: Agregado `timeZone: "America/Guayaquil"` a `toLocaleTimeString`
- **Línea 201**: Agregado `timeZone: "America/Guayaquil"` a `toLocaleTimeString`

## Scripts de Soporte

### `scripts/fix-historical-timezone-data.ts`
Script para analizar y corregir datos históricos con desfase:
```bash
# Analizar datos (sin cambios)
npx tsx scripts/fix-historical-timezone-data.ts

# Aplicar correcciones
npx tsx scripts/fix-historical-timezone-data.ts --fix
```

**Nota**: Después de analizar, se determinó que los datos históricos NO necesitan corrección. Las fechas almacenadas están correctas; el problema era solo en la visualización del frontend.

## Verificación

### Datos Corregidos en Producción
Las siguientes jornadas tenían visualización incorrecta:
- Giuliana Reinoso: UTC 04:48 → Ecuador 23:48 ✅
- BYRON MESIAS: UTC 00:17 → Ecuador 19:17 ✅
- ARUBA VILLARREAL: UTC 03:01 → Ecuador 22:01 ✅

### Build Exitoso
```bash
npm run build        # ✅ Frontend compilado correctamente
npm run build:server # ✅ Backend compilado correctamente
```

## Recomendaciones Futuras
1. Siempre usar `nowEcuador()` en lugar de `new Date()` para timestamps del servidor
2. Siempre especificar `timeZone: "America/Guayaquil"` en formateos de fecha del frontend
3. Considerar usar la utilidad `toGyeClock()` del frontend para conversiones consistentes
