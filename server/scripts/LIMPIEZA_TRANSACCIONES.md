# 🧹 Limpieza de Datos de Transacciones

Este documento describe cómo usar los scripts para limpiar los datos de transacciones de la base de datos, manteniendo intactos los datos maestros (usuarios, puntos de atención, monedas y jornadas).

## ⚠️ ADVERTENCIA IMPORTANTE

**Esta operación NO se puede deshacer.** Se recomienda encarecidamente hacer un backup completo de la base de datos antes de ejecutar estos scripts.

### Crear un backup de la base de datos

```bash
# PostgreSQL backup
pg_dump -U usuario -d nombre_base_datos > backup_$(date +%Y%m%d_%H%M%S).sql

# O usando la URL de conexión
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 📋 ¿Qué se eliminará?

Los siguientes datos serán **ELIMINADOS**:

### Transacciones y Operaciones

- ✗ Cambios de divisa (CambioDivisa)
- ✗ Transferencias (Transferencia)
- ✗ Movimientos (Movimiento)
- ✗ Movimientos de saldo (MovimientoSaldo)
- ✗ Historial de saldos (HistorialSaldo)
- ✗ Recibos (Recibo)

### Saldos

- ✗ Saldos actuales (Saldo)
- ✗ Saldos iniciales (SaldoInicial)
- ✗ Solicitudes de saldo (SolicitudSaldo)

### Cierres y Cuadres

- ✗ Cuadres de caja (CuadreCaja)
- ✗ Detalles de cuadre (DetalleCuadreCaja)
- ✗ Cierres diarios (CierreDiario)

### Gestión de Personal

- ✗ Salidas espontáneas (SalidaEspontanea)
- ✗ Permisos (Permiso)
- ✗ Historial de asignación de puntos (HistorialAsignacionPunto)

### Servientrega

- ✗ Guías (ServientregaGuia)
- ✗ Remitentes (ServientregaRemitente)
- ✗ Destinatarios (ServientregaDestinatario)
- ✗ Saldos Servientrega (ServientregaSaldo)
- ✗ Historial de saldos (ServientregaHistorialSaldo)
- ✗ Solicitudes de saldo (ServientregaSolicitudSaldo)
- ✗ Solicitudes de anulación (ServientregaSolicitudAnulacion)

### Servicios Externos

- ✗ Movimientos de servicios externos (ServicioExternoMovimiento)
- ✗ Saldos de servicios externos (ServicioExternoSaldo)
- ✗ Asignaciones de servicios externos (ServicioExternoAsignacion)
- ✗ Cierres diarios de servicios externos (ServicioExternoCierreDiario)
- ✗ Detalles de cierre de servicios externos (ServicioExternoDetalleCierre)

## ✅ ¿Qué se mantendrá?

Los siguientes datos **NO serán afectados**:

- ✓ Usuarios (Usuario)
- ✓ Puntos de atención (PuntoAtencion)
- ✓ Monedas (Moneda)
- ✓ Jornadas (Jornada)

## 🚀 Cómo usar los scripts

### Paso 1: Verificar qué se va a eliminar

Primero, ejecuta el script de verificación para ver cuántos registros se eliminarán:

```bash
npm run script:verificar-limpieza
```

Este script mostrará:

- Cantidad de registros que serán eliminados por cada tabla
- Total de registros a eliminar
- Cantidad de registros que se mantendrán (usuarios, puntos, monedas, jornadas)

**Ejemplo de salida:**

```
🔍 VERIFICACIÓN DE DATOS ANTES DE LIMPIAR

═══════════════════════════════════════════════════════════

📊 DATOS QUE SERÁN ELIMINADOS:

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Detalles de cuadre:              150
   Cuadres de caja:                 50
   Cierres diarios:                 45
   Recibos:                         500
   Cambios de divisa:               1200
   Transferencias:                  80
   Movimientos:                     300
   ...
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL A ELIMINAR:                3500
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ DATOS QUE SE MANTENDRÁN:

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   👥 Usuarios:          15
   📍 Puntos atención:   8
   💱 Monedas:           5
   📅 Jornadas:          120
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Paso 2: Crear un backup (OBLIGATORIO)

**NO OMITAS ESTE PASO**

```bash
# Crear backup de la base de datos
pg_dump $DATABASE_URL > backup_antes_limpieza_$(date +%Y%m%d_%H%M%S).sql
```

### Paso 3: Ejecutar la limpieza

Una vez que hayas verificado los datos y creado el backup, ejecuta:

```bash
npm run script:limpiar-transacciones
```

Este script:

1. Eliminará todos los datos de transacciones en el orden correcto (respetando las foreign keys)
2. Mostrará el progreso de cada tabla
3. Mostrará un resumen final con:
   - Cantidad de registros eliminados por tabla
   - Total de registros eliminados
   - Confirmación de los datos que se mantuvieron

**Ejemplo de salida:**

```
🧹 Iniciando limpieza de datos de transacciones...

📋 Eliminando detalles de cuadre de caja...
   ✓ 150 registros eliminados

📋 Eliminando cuadres de caja...
   ✓ 50 registros eliminados

...

✅ Limpieza completada exitosamente!

📊 Resumen:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Detalles de cuadre:              150
   Cuadres de caja:                 50
   ...
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOTAL REGISTROS ELIMINADOS:      3500
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Datos preservados:
   👥 Usuarios:          15
   📍 Puntos atención:   8
   💱 Monedas:           5
   📅 Jornadas:          120
```

## 🔄 Restaurar desde backup (si es necesario)

Si necesitas restaurar la base de datos desde el backup:

```bash
# Restaurar desde backup
psql $DATABASE_URL < backup_antes_limpieza_YYYYMMDD_HHMMSS.sql
```

## 📝 Notas adicionales

1. **Tiempo de ejecución**: El tiempo dependerá de la cantidad de registros. Para bases de datos grandes, puede tomar varios minutos.

2. **Conexión a la base de datos**: Asegúrate de que la variable de entorno `DATABASE_URL` esté correctamente configurada en tu archivo `.env`.

3. **Permisos**: El usuario de la base de datos debe tener permisos para eliminar registros de todas las tablas mencionadas.

4. **Transacciones**: Los scripts no usan transacciones explícitas. Si algo falla a mitad del proceso, algunos datos pueden haber sido eliminados. Por eso es crítico tener un backup.

## 🆘 Soporte

Si encuentras algún error durante la ejecución:

1. **NO ejecutes el script nuevamente** sin antes investigar el error
2. Revisa los logs del error
3. Si es necesario, restaura desde el backup
4. Contacta al equipo de desarrollo con los detalles del error

## 📞 Contacto

Para cualquier duda o problema, contacta al equipo de desarrollo.
