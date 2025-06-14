
-- Crear los enums primero
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_USUARIO', 'ADMIN', 'OPERADOR', 'CONCESION');
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA_ENTRANTE', 'TRANSFERENCIA_SALIENTE', 'CAMBIO_DIVISA');
CREATE TYPE "TipoOperacion" AS ENUM ('COMPRA', 'VENTA');
CREATE TYPE "TipoTransferencia" AS ENUM ('ENTRE_PUNTOS', 'DEPOSITO_MATRIZ', 'RETIRO_GERENCIA', 'DEPOSITO_GERENCIA');
CREATE TYPE "EstadoTransferencia" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
CREATE TYPE "EstadoTransaccion" AS ENUM ('COMPLETADO', 'PENDIENTE', 'CANCELADO');
CREATE TYPE "EstadoCierre" AS ENUM ('ABIERTO', 'CERRADO');
CREATE TYPE "TipoRecibo" AS ENUM ('CAMBIO_DIVISA', 'TRANSFERENCIA', 'MOVIMIENTO', 'DEPOSITO', 'RETIRO');

-- Crear tabla PuntoAtencion
CREATE TABLE public."PuntoAtencion" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL,
    ciudad TEXT NOT NULL,
    provincia TEXT NOT NULL,
    codigo_postal TEXT,
    telefono TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla Usuario
CREATE TABLE public."Usuario" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol "RolUsuario" NOT NULL,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE,
    telefono TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    punto_atencion_id UUID REFERENCES public."PuntoAtencion"(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla Moneda
CREATE TABLE public."Moneda" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    simbolo TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    orden_display INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla Saldo
CREATE TABLE public."Saldo" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE CASCADE,
    moneda_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE CASCADE,
    cantidad DECIMAL(15,2) NOT NULL DEFAULT 0,
    billetes INTEGER NOT NULL DEFAULT 0,
    monedas_fisicas INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(punto_atencion_id, moneda_id)
);

-- Crear tabla HistorialSaldo
CREATE TABLE public."HistorialSaldo" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE CASCADE,
    moneda_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE CASCADE,
    cantidad_anterior DECIMAL(15,2) NOT NULL,
    cantidad_incrementada DECIMAL(15,2) NOT NULL,
    cantidad_nueva DECIMAL(15,2) NOT NULL,
    tipo_movimiento "TipoMovimiento" NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    descripcion TEXT,
    numero_referencia TEXT
);

-- Crear tabla CambioDivisa
CREATE TABLE public."CambioDivisa" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    monto_origen DECIMAL(15,2) NOT NULL,
    monto_destino DECIMAL(15,2) NOT NULL,
    tasa_cambio DECIMAL(10,6) NOT NULL,
    tipo_operacion "TipoOperacion" NOT NULL,
    moneda_origen_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE RESTRICT,
    moneda_destino_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE RESTRICT,
    observacion TEXT,
    numero_recibo TEXT UNIQUE,
    estado "EstadoTransaccion" NOT NULL DEFAULT 'COMPLETADO'
);

-- Crear tabla Transferencia
CREATE TABLE public."Transferencia" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origen_id UUID REFERENCES public."PuntoAtencion"(id) ON DELETE SET NULL,
    destino_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE RESTRICT,
    moneda_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE RESTRICT,
    monto DECIMAL(15,2) NOT NULL,
    tipo_transferencia "TipoTransferencia" NOT NULL,
    estado "EstadoTransferencia" NOT NULL DEFAULT 'PENDIENTE',
    solicitado_por UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
    aprobado_por UUID REFERENCES public."Usuario"(id) ON DELETE SET NULL,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    descripcion TEXT,
    numero_recibo TEXT UNIQUE
);

-- Crear tabla Movimiento
CREATE TABLE public."Movimiento" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo "TipoMovimiento" NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    moneda_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE RESTRICT,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    descripcion TEXT,
    numero_recibo TEXT UNIQUE
);

-- Crear tabla Recibo
CREATE TABLE public."Recibo" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_recibo TEXT UNIQUE NOT NULL,
    tipo_operacion "TipoRecibo" NOT NULL,
    referencia_id TEXT NOT NULL,
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE RESTRICT,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    datos_operacion JSONB NOT NULL,
    impreso BOOLEAN NOT NULL DEFAULT false,
    numero_copias INTEGER NOT NULL DEFAULT 2
);

-- Crear tabla SolicitudSaldo
CREATE TABLE public."SolicitudSaldo" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE CASCADE,
    moneda_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE CASCADE,
    monto_solicitado DECIMAL(15,2) NOT NULL,
    aprobado BOOLEAN NOT NULL DEFAULT false,
    fecha_solicitud TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_respuesta TIMESTAMP WITH TIME ZONE,
    observaciones TEXT
);

-- Crear tabla Jornada
CREATE TABLE public."Jornada" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE CASCADE,
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fecha_almuerzo TIMESTAMP WITH TIME ZONE,
    fecha_regreso TIMESTAMP WITH TIME ZONE,
    fecha_salida TIMESTAMP WITH TIME ZONE
);

-- Crear tabla CuadreCaja
CREATE TABLE public."CuadreCaja" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
    punto_atencion_id UUID NOT NULL REFERENCES public."PuntoAtencion"(id) ON DELETE RESTRICT,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    estado "EstadoCierre" NOT NULL DEFAULT 'ABIERTO',
    total_cambios INTEGER NOT NULL DEFAULT 0,
    total_transferencias_entrada INTEGER NOT NULL DEFAULT 0,
    total_transferencias_salida INTEGER NOT NULL DEFAULT 0,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    observaciones TEXT
);

-- Crear tabla DetalleCuadreCaja
CREATE TABLE public."DetalleCuadreCaja" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuadre_id UUID NOT NULL REFERENCES public."CuadreCaja"(id) ON DELETE CASCADE,
    moneda_id UUID NOT NULL REFERENCES public."Moneda"(id) ON DELETE RESTRICT,
    saldo_apertura DECIMAL(15,2) NOT NULL,
    saldo_cierre DECIMAL(15,2) NOT NULL,
    conteo_fisico DECIMAL(15,2) NOT NULL,
    billetes INTEGER NOT NULL DEFAULT 0,
    monedas_fisicas INTEGER NOT NULL DEFAULT 0,
    diferencia DECIMAL(15,2) NOT NULL DEFAULT 0,
    UNIQUE(cuadre_id, moneda_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX "Usuario_username_idx" ON public."Usuario"(username);
CREATE INDEX "Usuario_punto_atencion_id_idx" ON public."Usuario"(punto_atencion_id);
CREATE INDEX "PuntoAtencion_ciudad_idx" ON public."PuntoAtencion"(ciudad);
CREATE INDEX "PuntoAtencion_activo_idx" ON public."PuntoAtencion"(activo);
CREATE INDEX "Moneda_codigo_idx" ON public."Moneda"(codigo);
CREATE INDEX "Moneda_activo_idx" ON public."Moneda"(activo);
CREATE INDEX "Saldo_punto_atencion_id_idx" ON public."Saldo"(punto_atencion_id);
CREATE INDEX "Saldo_moneda_id_idx" ON public."Saldo"(moneda_id);
CREATE INDEX "HistorialSaldo_punto_atencion_id_idx" ON public."HistorialSaldo"(punto_atencion_id);
CREATE INDEX "HistorialSaldo_fecha_idx" ON public."HistorialSaldo"(fecha);
CREATE INDEX "HistorialSaldo_tipo_movimiento_idx" ON public."HistorialSaldo"(tipo_movimiento);
CREATE INDEX "CambioDivisa_fecha_idx" ON public."CambioDivisa"(fecha);
CREATE INDEX "CambioDivisa_punto_atencion_id_idx" ON public."CambioDivisa"(punto_atencion_id);
CREATE INDEX "CambioDivisa_usuario_id_idx" ON public."CambioDivisa"(usuario_id);
CREATE INDEX "Transferencia_fecha_idx" ON public."Transferencia"(fecha);
CREATE INDEX "Transferencia_estado_idx" ON public."Transferencia"(estado);
CREATE INDEX "Transferencia_destino_id_idx" ON public."Transferencia"(destino_id);
CREATE INDEX "Movimiento_fecha_idx" ON public."Movimiento"(fecha);
CREATE INDEX "Movimiento_punto_atencion_id_idx" ON public."Movimiento"(punto_atencion_id);
CREATE INDEX "SolicitudSaldo_fecha_solicitud_idx" ON public."SolicitudSaldo"(fecha_solicitud);
CREATE INDEX "SolicitudSaldo_aprobado_idx" ON public."SolicitudSaldo"(aprobado);
CREATE INDEX "Jornada_usuario_id_idx" ON public."Jornada"(usuario_id);
CREATE INDEX "Jornada_fecha_inicio_idx" ON public."Jornada"(fecha_inicio);
CREATE INDEX "CuadreCaja_fecha_idx" ON public."CuadreCaja"(fecha);
CREATE INDEX "CuadreCaja_punto_atencion_id_idx" ON public."CuadreCaja"(punto_atencion_id);

-- Insertar algunos datos de ejemplo
-- Monedas
INSERT INTO public."Moneda" (nombre, simbolo, codigo, orden_display) VALUES
('Peso Dominicano', 'RD$', 'DOP', 1),
('Dólar Americano', '$', 'USD', 2),
('Euro', '€', 'EUR', 3);

-- Punto de Atención
INSERT INTO public."PuntoAtencion" (nombre, direccion, ciudad, provincia) VALUES
('Casa Central', 'Av. 27 de Febrero #123', 'Santo Domingo', 'Distrito Nacional'),
('Sucursal Santiago', 'Calle del Sol #456', 'Santiago', 'Santiago');

-- Usuario Administrador
INSERT INTO public."Usuario" (username, password, rol, nombre, correo) VALUES
('admin', '$2b$10$rOjWQwVqo8ePOjQwVqo8ePOjQwVqo8ePOjQwVqo8e', 'SUPER_USUARIO', 'Administrador del Sistema', 'admin@puntocambio.com');
