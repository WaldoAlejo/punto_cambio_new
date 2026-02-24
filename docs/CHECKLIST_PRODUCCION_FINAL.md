# 📋 CHECKLIST FINAL PARA PRODUCCIÓN
# Sistema Punto Cambio - Casa de Cambios Multi-Punto

---

## 1. CONFIGURACIÓN INFRAESTRUCTURA ✅

### 1.1 Variables de Entorno
```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/punto_cambio
DB_POOL_MIN=2
DB_POOL_MAX=10

# Seguridad
JWT_SECRET=<clave_segura_aleatoria_minimo_32_chars>

# Servientrega (Producción)
SERVIENTREGA_URL=https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php
SERVIENTREGA_USER=<usuario_produccion>
SERVIENTREGA_PASSWORD=<password_produccion>

# Frontend/Backend
PORT=3001
FRONTEND_URL=http://<ip_o_dominio>:3001
VITE_API_URL=http://<ip_o_dominio>:3001/api
INTERNAL_API_BASE_URL=http://<ip_o_dominio>:3001/api
```

### 1.2 Base de Datos
- [ ] Migraciones aplicadas: `npx prisma migrate deploy`
- [ ] Seed de monedas aplicado
- [ ] Índices creados en campos frecuentes (fecha, estado, punto_atencion_id)
- [ ] Backups automáticos configurados

### 1.3 Servidor
- [ ] Timezone configurado a America/Guayaquil
- [ ] PM2 configurado con `ecosystem.config.cjs`
- [ ] Logs rotativos configurados
- [ ] Firewall permitiendo puertos 3001, 80, 443

---

## 2. USUARIOS Y ROLES ✅

### 2.1 Jerarquía de Roles
| Rol | Permisos | Límite Operativo |
|-----|----------|------------------|
| SUPER_USUARIO | Todo + Configuración sistema | Sin límite |
| ADMIN | Usuarios, puntos, reportes, aprobaciones | Sin límite |
| ADMINISTRATIVO | Horarios, permisos, reportes limitados | Sin límite |
| OPERADOR | Cambios, transferencias, servicios, cierre | 1 punto/jornada |
| CONCESION | Aprobaciones, guías Servientrega | 1 punto fijo |

### 2.2 Usuarios Iniciales Requeridos
- [ ] SUPER_USUARIO (ti)
- [ ] ADMIN (administrador del negocio)
- [ ] Al menos 1 OPERADOR por punto

---

## 3. PUNTOS DE ATENCIÓN ✅

### 3.1 Configuración por Punto
Cada punto debe tener:
```typescript
{
  nombre: string;           // Nombre visible
  direccion: string;        // Dirección física
  ciudad: string;           // Ciudad
  provincia: string;        // Provincia
  
  // Servientrega (OBLIGATORIO para operar)
  servientrega_agencia_codigo: string;
  servientrega_agencia_nombre: string;
  servientrega_alianza: string;
  servientrega_oficina_alianza: string;
}
```

### 3.2 Lista de Verificación por Punto
- [ ] Nombre único y descriptivo
- [ ] Dirección completa
- [ ] Ciudad y provincia correctas
- [ ] **Código de agencia Servientrega asignado**
- [ ] **Nombre de agencia Servientrega configurado**
- [ ] **Alianza Servientrega configurada**
- [ ] **Oficina de alianza configurada**

---

## 4. SALDOS INICIALES ✅

### 4.1 Proceso de Apertura de Día
Para cada punto y cada moneda:

1. [ ] Verificar cierre del día anterior
2. [ ] Contar físicamente: billetes + monedas
3. [ ] Registrar saldo inicial en sistema
4. [ ] Validar que cantidad = billetes + monedas

### 4.2 Monedas Requeridas (Mínimo)
- [ ] USD (Dólar estadounidense) - Principal
- [ ] EUR (Euro)
- [ ] COP (Peso colombiano)
- [ ] Otras según necesidad del negocio

---

## 5. TRANSFERENCIAS ENTRE PUNTOS ✅

### 5.1 Flujo Normal
1. **Origen** crea transferencia
   - Descuenta saldo inmediatamente
   - Estado: EN_TRANSITO
   
2. **Destino** acepta transferencia
   - Suma saldo al punto destino
   - Estado: COMPLETADO

3. **Físicamente**: Operador transporta efectivo entre puntos

### 5.2 Validaciones
- [ ] Saldo suficiente en origen antes de crear
- [ ] Solo el punto destino puede aceptar
- [ ] No se puede cancelar si ya fue aceptada
- [ ] Devolución automática al cancelar

---

## 6. CAMBIOS DE DIVISAS ✅

### 6.1 Casos de Uso Soportados

| Caso | Descripción | Implementación |
|------|-------------|----------------|
| Normal Efectivo | Cliente paga y recibe en efectivo | ✅ Completo |
| Normal Transferencia | Cliente paga o recibe por transferencia | ✅ Completo |
| Mixto | Combinación efectivo + transferencia | ✅ Completo |
| Solo Billetes | Desglose: solo aumenta billetes | ✅ Completo |
| Solo Monedas | Desglose: solo aumenta monedas | ✅ Completo |
| Billetes + Monedas | Desglose proporcional | ✅ Completo |
| Parcial (Abono) | Cliente deja anticipo | ✅ Completo |
| Cierre Parcial | Cliente paga el resto después | ✅ Completo |

### 6.2 Validaciones Críticas
- [ ] Tasas dentro de rangos permitidos
- [ ] Saldo suficiente en moneda destino
- [ ] Montos > 0
- [ ] Monedas diferentes (origen ≠ destino)
- [ ] Cliente identificado (nombre, cédula)

### 6.3 Recibos
- [ ] Genera recibo único por cambio
- [ ] Guarda datos del cliente completo
- [ ] Incluye tasas aplicadas
- [ ] Historial consultable

---

## 7. SERVICIOS EXTERNOS ✅

### 7.1 Servicios CON Asignación de Saldo
Estos servicios tienen su propio saldo (crédito) separado:

| Servicio | Tipo | Validación |
|----------|------|------------|
| WESTERN | Asignación | Saldo asignado para INGRESO |
| BANCO_GUAYAQUIL | Asignación | Saldo asignado para INGRESO |
| PRODUBANCO | Asignación | Saldo asignado para INGRESO |
| BANCO_PACIFICO | Asignación | Saldo asignado para INGRESO |
| YAGANASTE | Asignación | Saldo asignado para INGRESO |
| SERVIENTREGA | Asignación | Saldo asignado para generar guías |

**Lógica INGRESO** (cliente paga):
- Resta del saldo asignado del servicio
- Suma al saldo físico (efectivo) del punto

**Lógica EGRESO** (operador repone):
- Suma al saldo asignado del servicio
- Resta del saldo físico (efectivo) del punto

### 7.2 Servicios SIN Asignación
Usan saldo general del punto:

| Servicio | Tipo | Validación |
|----------|------|------------|
| INSUMOS_OFICINA | General | Saldo general para EGRESO |
| INSUMOS_LIMPIEZA | General | Saldo general para EGRESO |
| OTROS | General | Saldo general para EGRESO |

### 7.3 Intercambio Saldo Servicio ↔ Divisas

**Escenario 1: Bajar saldo servicio, subir divisas**
- EGRESO en servicio (repone saldo asignado)
- El efectivo sale de la caja y se "convierte" en crédito del servicio

**Escenario 2: Subir saldo servicio, bajar divisas**
- INGRESO en servicio (usa saldo asignado)
- El crédito del servicio se convierte en efectivo en caja

---

## 8. SERVIENTREGA ✅

### 8.1 Requisitos para Operar
Para que un punto pueda generar guías:
1. [ ] Tener configurado `servientrega_agencia_codigo`
2. [ ] Tener configurado `servientrega_agencia_nombre`
3. [ ] Tener configurado `servientrega_alianza`
4. [ ] Tener configurado `servientrega_oficina_alianza`
5. [ ] Tener saldo Servientrega asignado > 0

### 8.2 Flujo de Guía

```
1. Calcular Tarifa
   └─> Llama API Servientrega
   └─> Valida datos destinatario/remitente

2. Generar Guía
   └─> Valida saldo suficiente
   └─> Descuenta saldo Servientrega
   └─> Llama API Servientrega
   └─> Guarda guía en BD con punto_atencion_id
   └─> Genera PDF (base64)

3. Anular Guía (mismo día)
   └─> Llama API Servientrega
   └─> Actualiza estado en BD
   └─> Devuelve saldo al punto
```

### 8.3 Validaciones
- [ ] Identificación válida (cédula/RUC/pasaporte)
- [ ] Campos obligatorios completos
- [ ] Tarifa calculada antes de generar
- [ ] Saldo suficiente disponible

---

## 9. CIERRE DE CAJA (CUADRE) ✅

### 9.1 Proceso de Cierre

```
1. Iniciar Cierre
   └─> Sistema calcula saldos teóricos desde último cierre

2. Conteo Físico
   └─> Operador cuenta billetes físicos
   └─> Operador cuenta monedas físicas
   └─> Valida: billetes + monedas = conteo_fisico

3. Validación
   └─> USD: tolerancia ±$1.00
   └─> Otras: tolerancia ±$0.01

4. Ajustes (si hay diferencias)
   └─> Crea movimiento AJUSTE por diferencia
   └─> Actualiza saldo con conteo físico

5. Cierre
   └─> Cierra jornada del operador
   └─> Libera punto de atención
   └─> Guarda registro de cierre
```

### 9.2 Reporte de Diferencias
Si hay diferencia entre saldo teórico y físico:
- [ ] Se registra en CuadreCajaDetalle
- [ ] Se crea MovimientoSaldo tipo AJUSTE
- [ ] Se puede forzar cierre con permiso (allowMismatch)

---

## 10. RECONCILIACIÓN DE SALDOS ✅

### 10.1 Servicio Automático
- Ubicación: `server/services/saldoReconciliationService.ts`
- Función: Calcula saldo real desde último saldo inicial
- Reconciliación: Auto-corrige diferencias > $0.01

### 10.2 Endpoints Disponibles
- `GET /api/saldo-reconciliation/calcular-real`
- `POST /api/saldo-reconciliation/reconciliar`
- `POST /api/saldo-reconciliation/reconcile-point/:pointId`

### 10.3 Dashboard de Salud
- Acceso: Admin > Salud del Sistema
- Muestra: Inconsistencias, transferencias pendientes, cambios sin movimientos

---

## 11. SEGURIDAD ✅

### 11.1 Autenticación
- [ ] JWT con expiración (24h)
- [ ] Tokens invalidados al logout
- [ ] Contraseñas hasheadas con bcrypt

### 11.2 Autorización
- [ ] Middleware requireRole en rutas administrativas
- [ ] Validación de punto_atencion_id en operaciones
- [ ] Solo el punto destino puede aceptar transferencias

### 11.3 Validaciones
- [ ] Rate limiting en login (5 intentos)
- [ ] Rate limiting global (100 req/15min)
- [ ] Validación de datos con Zod
- [ ] Sanitización de inputs

### 11.4 Auditoría
- [ ] Todos los movimientos registrados en MovimientoSaldo
- [ ] Recibos generados para cada operación
- [ ] Historial de cambios en saldos
- [ ] Logs de errores con Winston

---

## 12. BACKUP Y RECUPERACIÓN ✅

### 12.1 Backups Automáticos
```bash
# Diario a las 2 AM
pg_dump -h <host> -U postgres punto_cambio > backup_$(date +%Y%m%d).sql

# Retención: 30 días
find /backups -name "backup_*.sql" -mtime +30 -delete
```

### 12.2 Procedimiento de Recuperación
1. Detener aplicación
2. Restaurar base de datos
3. Verificar consistencia de saldos
4. Reconciliar si es necesario
5. Iniciar aplicación

---

## 13. MONITOREO Y ALERTAS ✅

### 13.1 Métricas Críticas
- [ ] Diferencias en cierres de caja > $10
- [ ] Transferencias EN_TRANSITO > 24h
- [ ] Cambios sin 2 movimientos asociados
- [ ] Guías Servientrega sin saldo descontado
- [ ] Saldos negativos

### 13.2 Logs Importantes
```bash
# Errores críticos
grep -i "error\|critical\|fatal" logs/error.log

# Reconciliaciones
grep -i "reconcil" logs/app.log

# Servientrega
grep -i "servientrega" logs/app.log
```

---

## 14. PROCEDIMIENTOS OPERATIVOS ✅

### 14.1 Apertura de Día
1. Verificar que el punto esté libre
2. Iniciar jornada
3. Registrar saldos iniciales (conteo físico)
4. Verificar que cuadren

### 14.2 Durante el Día
1. Realizar cambios de divisas
2. Registrar servicios externos
3. Generar guías Servientrega (si aplica)
4. Aceptar transferencias entrantes
5. Solicitar transferencias si hay faltante

### 14.3 Cierre de Día
1. Contar físicamente todas las monedas
2. Registrar conteos en sistema
3. Verificar que cuadren (o justificar diferencias)
4. Realizar cierre
5. Sistema cierra jornada automáticamente

---

## 15. SOLUCIÓN DE PROBLEMAS COMUNES ✅

### 15.1 "Saldo insuficiente" en cambio
- Verificar saldo en moneda destino
- Verificar si hay transferencias pendientes de llegar
- Reconciliar saldo si es necesario

### 15.2 "No cuadra" en cierre
- Revisar si hay movimientos pendientes
- Verificar servicios externos registrados
- Contar nuevamente físicamente
- Forzar cierre con observación si es necesario

### 15.3 Error generando guía Servientrega
- Verificar que el punto tenga agencia configurada
- Verificar saldo Servientrega suficiente
- Revisar identificación de remitente/destinatario
- Verificar formato de ciudad (CIUDAD-PROVINCIA)

### 15.4 Diferencias en saldos
- Usar dashboard de salud del sistema
- Reconciliar saldos automáticamente
- Verificar movimientos faltantes

---

## ✅ CHECKLIST FINAL PRE-LANZAMIENTO

### Configuración
- [ ] Variables de entorno correctas
- [ ] Base de datos migrada
- [ ] Timezone configurado (America/Guayaquil)
- [ ] PM2 configurado

### Datos Iniciales
- [ ] Monedas creadas (USD, EUR, COP, etc.)
- [ ] Puntos de atención configurados con Servientrega
- [ ] Usuarios creados con roles correctos
- [ ] Saldos iniciales asignados

### Pruebas
- [ ] Cambio de divisas normal (efectivo)
- [ ] Cambio de divisas con transferencia
- [ ] Cambio parcial (abono)
- [ ] Transferencia entre puntos
- [ ] Servicio externo INGRESO/EGRESO
- [ ] Guía Servientrega (tarifa + generación)
- [ ] Anulación guía Servientrega
- [ ] Cierre de caja con cuadre
- [ ] Reconciliación de saldos

### Seguridad
- [ ] Contraseñas cambiadas de default
- [ ] JWT secret seguro
- [ ] Rate limiting activo
- [ ] Logs configurados

---

## 📞 CONTACTOS DE SOPORTE

| Rol | Nombre | Contacto |
|-----|--------|----------|
| Admin Sistema | [Nombre] | [Teléfono] |
| Soporte Técnico | [Nombre] | [Teléfono] |
| Servientrega | Soporte API | soporte@servientrega.com |

---

**Documento versión:** 1.0  
**Última actualización:** 2026-02-24  
**Responsable:** Sistema Punto Cambio
