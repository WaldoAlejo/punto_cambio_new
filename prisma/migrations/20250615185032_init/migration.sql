-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_USUARIO', 'ADMIN', 'OPERADOR', 'CONCESION');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA_ENTRANTE', 'TRANSFERENCIA_SALIENTE', 'CAMBIO_DIVISA');

-- CreateEnum
CREATE TYPE "TipoOperacion" AS ENUM ('COMPRA', 'VENTA');

-- CreateEnum
CREATE TYPE "TipoTransferencia" AS ENUM ('ENTRE_PUNTOS', 'DEPOSITO_MATRIZ', 'RETIRO_GERENCIA', 'DEPOSITO_GERENCIA');

-- CreateEnum
CREATE TYPE "EstadoTransferencia" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoTransaccion" AS ENUM ('COMPLETADO', 'PENDIENTE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoCierre" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoRecibo" AS ENUM ('CAMBIO_DIVISA', 'TRANSFERENCIA', 'MOVIMIENTO', 'DEPOSITO', 'RETIRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "punto_atencion_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoAtencion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "codigo_postal" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuntoAtencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moneda" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden_display" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saldo" (
    "id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "cantidad" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "billetes" INTEGER NOT NULL DEFAULT 0,
    "monedas_fisicas" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Saldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialSaldo" (
    "id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cantidad_anterior" DECIMAL(15,2) NOT NULL,
    "cantidad_incrementada" DECIMAL(15,2) NOT NULL,
    "cantidad_nueva" DECIMAL(15,2) NOT NULL,
    "tipo_movimiento" "TipoMovimiento" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "numero_referencia" TEXT,

    CONSTRAINT "HistorialSaldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioDivisa" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_origen" DECIMAL(15,2) NOT NULL,
    "monto_destino" DECIMAL(15,2) NOT NULL,
    "tasa_cambio" DECIMAL(10,6) NOT NULL,
    "tipo_operacion" "TipoOperacion" NOT NULL,
    "moneda_origen_id" TEXT NOT NULL,
    "moneda_destino_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "observacion" TEXT,
    "numero_recibo" TEXT,
    "estado" "EstadoTransaccion" NOT NULL DEFAULT 'COMPLETADO',

    CONSTRAINT "CambioDivisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transferencia" (
    "id" TEXT NOT NULL,
    "origen_id" TEXT,
    "destino_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "tipo_transferencia" "TipoTransferencia" NOT NULL,
    "estado" "EstadoTransferencia" NOT NULL DEFAULT 'PENDIENTE',
    "solicitado_por" TEXT NOT NULL,
    "aprobado_por" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_aprobacion" TIMESTAMP(3),
    "descripcion" TEXT,
    "numero_recibo" TEXT,

    CONSTRAINT "Transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT,
    "numero_recibo" TEXT,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" TEXT NOT NULL,
    "numero_recibo" TEXT NOT NULL,
    "tipo_operacion" "TipoRecibo" NOT NULL,
    "referencia_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datos_operacion" JSONB NOT NULL,
    "impreso" BOOLEAN NOT NULL DEFAULT false,
    "numero_copias" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudSaldo" (
    "id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "monto_solicitado" DECIMAL(15,2) NOT NULL,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_respuesta" TIMESTAMP(3),
    "observaciones" TEXT,

    CONSTRAINT "SolicitudSaldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_almuerzo" TIMESTAMP(3),
    "fecha_regreso" TIMESTAMP(3),
    "fecha_salida" TIMESTAMP(3),

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuadreCaja" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_atencion_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoCierre" NOT NULL DEFAULT 'ABIERTO',
    "total_cambios" INTEGER NOT NULL DEFAULT 0,
    "total_transferencias_entrada" INTEGER NOT NULL DEFAULT 0,
    "total_transferencias_salida" INTEGER NOT NULL DEFAULT 0,
    "fecha_cierre" TIMESTAMP(3),
    "observaciones" TEXT,

    CONSTRAINT "CuadreCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCuadreCaja" (
    "id" TEXT NOT NULL,
    "cuadre_id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "saldo_apertura" DECIMAL(15,2) NOT NULL,
    "saldo_cierre" DECIMAL(15,2) NOT NULL,
    "conteo_fisico" DECIMAL(15,2) NOT NULL,
    "billetes" INTEGER NOT NULL DEFAULT 0,
    "monedas_fisicas" INTEGER NOT NULL DEFAULT 0,
    "diferencia" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DetalleCuadreCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Usuario_username_idx" ON "Usuario"("username");

-- CreateIndex
CREATE INDEX "Usuario_punto_atencion_id_idx" ON "Usuario"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "PuntoAtencion_ciudad_idx" ON "PuntoAtencion"("ciudad");

-- CreateIndex
CREATE INDEX "PuntoAtencion_activo_idx" ON "PuntoAtencion"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "Moneda_codigo_key" ON "Moneda"("codigo");

-- CreateIndex
CREATE INDEX "Moneda_codigo_idx" ON "Moneda"("codigo");

-- CreateIndex
CREATE INDEX "Moneda_activo_idx" ON "Moneda"("activo");

-- CreateIndex
CREATE INDEX "Saldo_punto_atencion_id_idx" ON "Saldo"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "Saldo_moneda_id_idx" ON "Saldo"("moneda_id");

-- CreateIndex
CREATE UNIQUE INDEX "Saldo_punto_atencion_id_moneda_id_key" ON "Saldo"("punto_atencion_id", "moneda_id");

-- CreateIndex
CREATE INDEX "HistorialSaldo_punto_atencion_id_idx" ON "HistorialSaldo"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "HistorialSaldo_fecha_idx" ON "HistorialSaldo"("fecha");

-- CreateIndex
CREATE INDEX "HistorialSaldo_tipo_movimiento_idx" ON "HistorialSaldo"("tipo_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "CambioDivisa_numero_recibo_key" ON "CambioDivisa"("numero_recibo");

-- CreateIndex
CREATE INDEX "CambioDivisa_fecha_idx" ON "CambioDivisa"("fecha");

-- CreateIndex
CREATE INDEX "CambioDivisa_punto_atencion_id_idx" ON "CambioDivisa"("punto_atencion_id");

-- CreateIndex
CREATE INDEX "CambioDivisa_usuario_id_idx" ON "CambioDivisa"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transferencia_numero_recibo_key" ON "Transferencia"("numero_recibo");

-- CreateIndex
CREATE INDEX "Transferencia_fecha_idx" ON "Transferencia"("fecha");

-- CreateIndex
CREATE INDEX "Transferencia_estado_idx" ON "Transferencia"("estado");

-- CreateIndex
CREATE INDEX "Transferencia_destino_id_idx" ON "Transferencia"("destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_numero_recibo_key" ON "Movimiento"("numero_recibo");

-- CreateIndex
CREATE INDEX "Movimiento_fecha_idx" ON "Movimiento"("fecha");

-- CreateIndex
CREATE INDEX "Movimiento_punto_atencion_id_idx" ON "Movimiento"("punto_atencion_id");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_numero_recibo_key" ON "Recibo"("numero_recibo");

-- CreateIndex
CREATE INDEX "Recibo_fecha_idx" ON "Recibo"("fecha");

-- CreateIndex
CREATE INDEX "Recibo_numero_recibo_idx" ON "Recibo"("numero_recibo");

-- CreateIndex
CREATE INDEX "Recibo_tipo_operacion_idx" ON "Recibo"("tipo_operacion");

-- CreateIndex
CREATE INDEX "SolicitudSaldo_fecha_solicitud_idx" ON "SolicitudSaldo"("fecha_solicitud");

-- CreateIndex
CREATE INDEX "SolicitudSaldo_aprobado_idx" ON "SolicitudSaldo"("aprobado");

-- CreateIndex
CREATE INDEX "Jornada_usuario_id_idx" ON "Jornada"("usuario_id");

-- CreateIndex
CREATE INDEX "Jornada_fecha_inicio_idx" ON "Jornada"("fecha_inicio");

-- CreateIndex
CREATE INDEX "CuadreCaja_fecha_idx" ON "CuadreCaja"("fecha");

-- CreateIndex
CREATE INDEX "CuadreCaja_punto_atencion_id_idx" ON "CuadreCaja"("punto_atencion_id");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleCuadreCaja_cuadre_id_moneda_id_key" ON "DetalleCuadreCaja"("cuadre_id", "moneda_id");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saldo" ADD CONSTRAINT "Saldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saldo" ADD CONSTRAINT "Saldo_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialSaldo" ADD CONSTRAINT "HistorialSaldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialSaldo" ADD CONSTRAINT "HistorialSaldo_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialSaldo" ADD CONSTRAINT "HistorialSaldo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDivisa" ADD CONSTRAINT "CambioDivisa_moneda_origen_id_fkey" FOREIGN KEY ("moneda_origen_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDivisa" ADD CONSTRAINT "CambioDivisa_moneda_destino_id_fkey" FOREIGN KEY ("moneda_destino_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDivisa" ADD CONSTRAINT "CambioDivisa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioDivisa" ADD CONSTRAINT "CambioDivisa_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "PuntoAtencion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudSaldo" ADD CONSTRAINT "SolicitudSaldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudSaldo" ADD CONSTRAINT "SolicitudSaldo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudSaldo" ADD CONSTRAINT "SolicitudSaldo_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadreCaja" ADD CONSTRAINT "CuadreCaja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadreCaja" ADD CONSTRAINT "CuadreCaja_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCuadreCaja" ADD CONSTRAINT "DetalleCuadreCaja_cuadre_id_fkey" FOREIGN KEY ("cuadre_id") REFERENCES "CuadreCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCuadreCaja" ADD CONSTRAINT "DetalleCuadreCaja_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "Moneda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
