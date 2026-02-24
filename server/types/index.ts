/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TIPOS CENTRALIZADOS DEL SERVIDOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo contiene todos los tipos compartidos del servidor para evitar
 * duplicación y mantener consistencia en toda la aplicación.
 */

import { Request } from "express";
import { Prisma } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Usuario y Autenticación
// ═══════════════════════════════════════════════════════════════════════════

export type RolUsuario =
  | "OPERADOR"
  | "ADMIN"
  | "SUPER_USUARIO"
  | "ADMINISTRATIVO"
  | "CONCESION";

export interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  punto_atencion_id: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Respuesta API
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Cambio de Divisa
// ═══════════════════════════════════════════════════════════════════════════

export type TipoOperacion = "COMPRA" | "VENTA";
export type MetodoEntrega = "efectivo" | "transferencia" | "mixto";
export type TipoViaTransferencia = "EFECTIVO" | "BANCO" | "MIXTO";

export interface ExchangeData {
  moneda_origen_id: string;
  moneda_destino_id: string;
  monto_origen: number;
  monto_destino: number;
  tasa_cambio_billetes: number;
  tasa_cambio_monedas: number;
  tipo_operacion: TipoOperacion;
  punto_atencion_id: string;
  metodo_entrega: MetodoEntrega;
  usd_entregado_efectivo?: number;
  usd_entregado_transfer?: number;
  metodo_pago_origen?: TipoViaTransferencia;
  usd_recibido_efectivo?: number;
  usd_recibido_transfer?: number;
}

export interface DatosCliente {
  nombre: string;
  apellido: string;
  documento?: string | null;
  cedula: string;
  telefono?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Transferencia
// ═══════════════════════════════════════════════════════════════════════════

export type EstadoTransferencia =
  | "PENDIENTE"
  | "EN_TRANSITO"
  | "COMPLETADO"
  | "APROBADO"
  | "RECHAZADO"
  | "CANCELADO";

export type TipoTransferencia =
  | "ENTRE_PUNTOS"
  | "DEPOSITO_MATRIZ"
  | "RETIRO_GERENCIA"
  | "DEPOSITO_GERENCIA";

export interface TransferData {
  origen_id?: string;
  destino_id: string;
  moneda_id: string;
  monto: number;
  tipo_transferencia: TipoTransferencia;
  descripcion?: string;
  via?: TipoViaTransferencia;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Servicios Externos
// ═══════════════════════════════════════════════════════════════════════════

export type ServicioExterno =
  | "YAGANASTE"
  | "BANCO_GUAYAQUIL"
  | "WESTERN"
  | "PRODUBANCO"
  | "BANCO_PACIFICO"
  | "INSUMOS_OFICINA"
  | "INSUMOS_LIMPIEZA"
  | "SERVIENTREGA"
  | "OTROS";

export type TipoMovimientoServicio = "INGRESO" | "EGRESO";

export interface ServicioExternoData {
  servicio: ServicioExterno;
  tipo_movimiento: TipoMovimientoServicio;
  monto: number;
  descripcion?: string;
  numero_referencia?: string;
  comprobante_url?: string;
  billetes?: number;
  monedas_fisicas?: number;
  bancos?: number;
  metodo_ingreso?: TipoViaTransferencia;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Saldo
// ═══════════════════════════════════════════════════════════════════════════

export interface SaldoBreakdown {
  cantidad: number;
  billetes: number;
  monedas_fisicas: number;
  bancos: number;
}

export interface SaldoValidation {
  puntoAtencionId: string;
  monedaId: string;
  montoRequerido: number;
  puntoNombre: string;
  monedaCodigo: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos de Movimiento de Saldo
// ═══════════════════════════════════════════════════════════════════════════

export type TipoMovimiento =
  | "INGRESO"
  | "EGRESO"
  | "AJUSTE"
  | "SALDO_INICIAL"
  | "TRANSFERENCIA_ENTRANTE"
  | "TRANSFERENCIA_ENTRADA"
  | "TRANSFERENCIA_SALIENTE"
  | "TRANSFERENCIA_SALIDA"
  | "TRANSFERENCIA_DEVOLUCION";

export type TipoReferencia =
  | "EXCHANGE"
  | "CAMBIO_DIVISA"
  | "TRANSFERENCIA"
  | "SERVICIO_EXTERNO"
  | "AJUSTE_MANUAL"
  | "SALDO_INICIAL"
  | "CIERRE_DIARIO"
  | "SERVIENTREGA";

export interface MovimientoSaldoData {
  puntoAtencionId: string;
  monedaId: string;
  tipoMovimiento: TipoMovimiento;
  monto: number;
  saldoAnterior: number;
  saldoNuevo: number;
  tipoReferencia: TipoReferencia;
  referenciaId?: string;
  descripcion?: string;
  saldoBucket?: "CAJA" | "BANCOS" | "NINGUNO";
  usuarioId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers de tipos
// ═══════════════════════════════════════════════════════════════════════════

export type JsonRecord = Record<string, unknown>;

export type RateMode = "USD_PER_UNIT" | "UNITS_PER_USD";

export interface GyeDateRange {
  gte: Date;
  lt: Date;
}

// Type guards
export function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function getStringFromRecord(r: JsonRecord, key: string): string | undefined {
  const v = r[key];
  return typeof v === "string" ? v : undefined;
}

export function getIdFromUnknown(v: unknown): string | null {
  if (!isRecord(v)) return null;
  const id = v["id"];
  return typeof id === "string" ? id : null;
}

export function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Constantes
export const SERVICIOS_CON_ASIGNACION: ServicioExterno[] = [
  "YAGANASTE",
  "BANCO_GUAYAQUIL",
  "WESTERN",
  "PRODUBANCO",
  "BANCO_PACIFICO",
  "SERVIENTREGA",
];

export const SERVICIOS_SALDO_GENERAL: ServicioExterno[] = [
  "INSUMOS_OFICINA",
  "INSUMOS_LIMPIEZA",
  "OTROS",
];

export const MENSAJES_AYUDA_SERVICIOS: Record<ServicioExterno, { INGRESO: string; EGRESO: string }> = {
  YAGANASTE: {
    INGRESO: "Cliente PAGA por servicio YaGanaste (entra dinero al punto)",
    EGRESO: "Operador REPONE saldo YaGanaste (sale dinero del punto)",
  },
  BANCO_GUAYAQUIL: {
    INGRESO: "Cliente PAGA por servicio Banco Guayaquil (entra dinero)",
    EGRESO: "Operador REPONE saldo Banco Guayaquil (sale dinero)",
  },
  WESTERN: {
    INGRESO: "Cliente PAGA por envío Western Union (entra dinero)",
    EGRESO: "Operador REPONE saldo Western Union (sale dinero)",
  },
  PRODUBANCO: {
    INGRESO: "Cliente PAGA por servicio Produbanco (entra dinero)",
    EGRESO: "Operador REPONE saldo Produbanco (sale dinero)",
  },
  BANCO_PACIFICO: {
    INGRESO: "Cliente PAGA por servicio Banco Pacífico (entra dinero)",
    EGRESO: "Operador REPONE saldo Banco Pacífico (sale dinero)",
  },
  SERVIENTREGA: {
    INGRESO: "Cliente PAGA por envío Servientrega (entra dinero)",
    EGRESO: "Operador REPONE saldo Servientrega (sale dinero)",
  },
  INSUMOS_OFICINA: {
    INGRESO: "Venta de insumos de oficina (entra dinero)",
    EGRESO: "Compra de insumos de oficina (sale dinero)",
  },
  INSUMOS_LIMPIEZA: {
    INGRESO: "Venta de insumos de limpieza (entra dinero)",
    EGRESO: "Compra de insumos de limpieza (sale dinero)",
  },
  OTROS: {
    INGRESO: "Otro tipo de ingreso (entra dinero)",
    EGRESO: "Otro tipo de egreso (sale dinero)",
  },
};

// Constantes de validación
export const MAX_RATE_ALLOWED = 1e12;
export const ROUND_EPSILON = 0.01;
