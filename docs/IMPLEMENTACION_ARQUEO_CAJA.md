# Implementación: Sistema de Arqueo de Caja por Operador

## ✅ Resumen de Cambios

### 1. Base de Datos (Prisma)
**Archivo:** `prisma/schema.prisma`

- **Nuevo enum `EstadoApertura`**: PENDIENTE, EN_CONTEO, CUADRADO, CON_DIFERENCIA, RESUELTO, ABIERTA, RECHAZADO
- **Nuevo modelo `AperturaCaja`**:
  - Registra el conteo físico del operador
  - Almacena saldo esperado vs conteo físico
  - Guarda diferencias detectadas
  - Registra aprobaciones del admin
  - Soporta fotos evidencia y links de videollamada

**Comando ejecutado:**
```bash
npx prisma db push
```

---

### 2. Backend - API Endpoints
**Archivo:** `server/routes/apertura-caja.ts`

| Endpoint | Método | Descripción | Rol |
|----------|--------|-------------|-----|
| `/api/apertura-caja/iniciar` | POST | Inicia proceso de apertura | Operador |
| `/api/apertura-caja/conteo` | POST | Guarda conteo físico | Operador |
| `/api/apertura-caja/confirmar` | POST | Confirma apertura cuadrada | Operador |
| `/api/apertura-caja/:id` | GET | Obtiene detalle de apertura | Todos |
| `/api/apertura-caja/mis-aperturas/lista` | GET | Lista mis aperturas | Operador |
| `/api/apertura-caja/pendientes/admin` | GET | Lista pendientes | Admin |
| `/api/apertura-caja/:id/aprobar` | POST | Aprueba con diferencia | Admin |
| `/api/apertura-caja/:id/rechazar` | POST | Rechaza apertura | Admin |

**Archivo modificado:** `server/index.ts` (registro de rutas)

---

### 3. Frontend - Servicio
**Archivo:** `src/services/aperturaCajaService.ts`

Servicio completo con métodos:
- `iniciarApertura(jornada_id)`
- `guardarConteo(apertura_id, conteos, fotos, observaciones)`
- `confirmarApertura(apertura_id)`
- `getApertura(id)`
- `getMisAperturas()`
- `getAperturasPendientes()` (admin)
- `aprobarApertura(id, data)` (admin)
- `rechazarApertura(id, observaciones)` (admin)

---

### 4. Frontend - Componentes

#### Operador: Apertura de Caja
**Archivo:** `src/components/caja/AperturaCaja.tsx`

Funcionalidades:
- Muestra saldo esperado del sistema
- Permite ingresar conteo físico desglosado:
  - Billetes: $100, $50, $20, $10, $5, $1
  - Monedas: $1, 50¢, 25¢, 10¢, 5¢, 1¢
- Calcula diferencias en tiempo real
- Valida contra tolerancias (USD: ±$1.00, otras: ±$0.01)
- Si cuadra: permite confirmar apertura
- Si hay diferencia: botón para llamar al admin (videollamada)

#### Admin: Panel de Verificación
**Archivo:** `src/components/admin/AperturasPendientes.tsx`

Funcionalidades:
- Dashboard con contadores: total pendientes, con diferencias, en conteo
- Lista de aperturas pendientes con:
  - Info del operador y punto
  - Diferencias detectadas
  - Botón de videollamada (Google Meet)
- Dialog de detalle con:
  - Desglose completo del conteo
  - Comparación esperado vs físico
  - Checkbox para ajustar saldos
  - Campo para observaciones
  - Botones: Aprobar / Rechazar

---

### 5. Navegación
**Archivo:** `src/components/dashboard/Dashboard.tsx`

- Agregadas vistas: `apertura-caja` y `aperturas-pendientes`
- Lazy imports para los nuevos componentes

**Archivo:** `src/components/dashboard/Sidebar.tsx`

- Menú para operador: "Apertura de Caja"
- Menú para admin: "Aperturas Pendientes"

**Archivo:** `src/components/caja/index.ts`

- Exportación de AperturaCaja

---

## 🔄 Flujo de Uso

### Para el Operador:

1. **Iniciar jornada** → Seleccionar punto de atención
2. **Abrir "Apertura de Caja"** desde el menú
3. **Ver saldo esperado** que el sistema muestra
4. **Contar físicamente** todo el dinero
5. **Ingresar desglose** por denominación (billetes y monedas)
6. **Guardar conteo** → Sistema valida automáticamente

**Si todo cuadra:**
- Estado: CUADRADO ✅
- Click "Confirmar Apertura"
- Jornada iniciada oficialmente

**Si hay diferencia:**
- Estado: CON_DIFERENCIA ❌
- Click "Llamar al Administrador" (abre Google Meet)
- En videollamada muestra el dinero físico
- Admin aprueba desde su panel

### Para el Administrador:

1. **Abrir "Aperturas Pendientes"** desde el menú
2. **Ver lista** de aperturas que requieren atención
3. **Click en "Llamar"** para iniciar videollamada
4. **Click "Ver Detalle"** para revisar el conteo
5. **Durante videollamada:**
   - Operador muestra físicamente el dinero
   - Admin revisa desglose en pantalla
6. **Decisión:**
   - **Aprobar:** Si el conteo es correcto (puede ajustar saldos)
   - **Rechazar:** Si debe re-contar

---

## 🧪 Pruebas

### Escenario 1: Apertura Cuadrada
```
1. Operador inicia jornada
2. Sistema espera: $1,200 USD
3. Operador cuenta: $1,200 USD
4. Ingresa: 5×$100 + 10×$50 + 10×$20 = $1,200
5. Guarda → Todo cuadrado ✅
6. Confirma apertura → Jornada abierta
```

### Escenario 2: Diferencia Detectada
```
1. Operador inicia jornada
2. Sistema espera: $1,200 USD
3. Operador cuenta: $1,175 USD (faltan $25)
4. Ingresa conteo
5. Guarda → Diferencia detectada ❌
6. Click "Llamar al Admin"
7. Admin entra a videollamada
8. Operador muestra billetes: "Aquí están 5 de $100, 10 de $50..."
9. Admin revisa y aprueba con ajuste de saldos
10. Jornada abierta
```

---

## 📋 Próximos Pasos (Opcional)

1. **Integrar videollamada embebida**: Usar Daily.co o Twilio en lugar de Google Meet
2. **Reporte impreso**: Generar PDF firmado de apertura/cierre
3. **Notificaciones**: Alertar al admin cuando hay aperturas pendientes
4. **Integrar con Cierre**: Agregar verificación similar al cierre de caja

---

## 📁 Archivos Creados/Modificados

### Nuevos archivos:
- `server/routes/apertura-caja.ts`
- `src/services/aperturaCajaService.ts`
- `src/components/caja/AperturaCaja.tsx`
- `src/components/admin/AperturasPendientes.tsx`
- `docs/IMPLEMENTACION_ARQUEO_CAJA.md`
- `docs/DISENO_ARQUEO_OPERADOR.md`

### Modificados:
- `prisma/schema.prisma` - Modelo AperturaCaja
- `server/index.ts` - Rutas API
- `src/components/dashboard/Dashboard.tsx` - Vistas
- `src/components/dashboard/Sidebar.tsx` - Menú
- `src/components/caja/index.ts` - Exportaciones

---

**Fecha:** 24 de marzo 2026
**Estado:** ✅ Implementación completa lista para pruebas
