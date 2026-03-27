import { EstadoApertura, EstadoJornada } from "@prisma/client";
import prisma from "../lib/prisma.js";

export const MONEDAS_APERTURA_OBLIGATORIAS = ["USD", "EUR"] as const;

type AperturaJsonItem = {
  moneda_id?: string;
  codigo?: string;
  cantidad?: number | string;
  total?: number | string;
  billetes?: Array<{ denominacion?: number | string; cantidad?: number | string }>;
  monedas?: Array<{ denominacion?: number | string; cantidad?: number | string }>;
};

type UsuarioAperturaContext = {
  id?: string;
  punto_atencion_id?: string | null;
  rol?: string | null;
};

type AperturaConJson = {
  id: string;
  estado: EstadoApertura;
  saldo_esperado?: unknown;
  conteo_fisico?: unknown;
  requiere_aprobacion?: boolean;
  tolerancia_usd?: unknown;
  tolerancia_otras?: unknown;
};

type JornadaMinima = {
  id: string;
  estado: EstadoJornada;
  punto_atencion_id: string;
};

export type EstadoAperturaOperativa = {
  puede_operar: boolean;
  requiere_inicio_jornada: boolean;
  requiere_apertura: boolean;
  requiere_confirmacion: boolean;
  requiere_cuadre_obligatorio: boolean;
  monedas_obligatorias: string[];
  monedas_obligatorias_guardadas: string[];
  monedas_obligatorias_cuadradas: string[];
  monedas_obligatorias_descuadradas: string[];
  monedas_obligatorias_pendientes: string[];
  jornada: JornadaMinima | null;
  apertura: AperturaConJson | null;
  code:
    | "OK"
    | "NO_AUTH"
    | "NO_PUNTO"
    | "NO_JORNADA"
    | "NO_APERTURA"
    | "APERTURA_PENDIENTE"
    | "APERTURA_NO_CONFIRMADA"
    | "APERTURA_OBLIGATORIA_INCOMPLETA";
  error?: string;
};

function asArray(value: unknown): AperturaJsonItem[] {
  return Array.isArray(value) ? (value as AperturaJsonItem[]) : [];
}

function toNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function calcularTotalConteoItem(item: AperturaJsonItem | undefined): number {
  if (!item) {
    return 0;
  }

  if (item.total !== undefined) {
    return toNumber(item.total);
  }

  const totalBilletes = (item.billetes || []).reduce(
    (sum, billete) => sum + toNumber(billete.denominacion) * toNumber(billete.cantidad),
    0
  );
  const totalMonedas = (item.monedas || []).reduce(
    (sum, moneda) => sum + toNumber(moneda.denominacion) * toNumber(moneda.cantidad),
    0
  );

  return Number((totalBilletes + totalMonedas).toFixed(2));
}

export function getEstadoMonedasObligatorias(apertura: Pick<AperturaConJson, "saldo_esperado" | "conteo_fisico" | "tolerancia_usd" | "tolerancia_otras"> | null | undefined): {
  guardadas: string[];
  cuadradas: string[];
  descuadradas: string[];
  pendientes_guardado: string[];
  pendientes: string[];
} {
  const saldoEsperado = asArray(apertura?.saldo_esperado);
  const conteoFisico = asArray(apertura?.conteo_fisico);

  const esperadoPorCodigo = new Map<string, AperturaJsonItem>();
  const conteoPorMonedaId = new Map<string, AperturaJsonItem>();

  for (const item of saldoEsperado) {
    if (item.moneda_id && item.codigo) {
      esperadoPorCodigo.set(String(item.codigo).toUpperCase(), item);
    }
  }

  for (const item of conteoFisico) {
    if (item.moneda_id) {
      conteoPorMonedaId.set(item.moneda_id, item);
    }
  }

  const guardadas = new Set<string>();
  const cuadradas = new Set<string>();
  const descuadradas = new Set<string>();
  const pendientesGuardado = new Set<string>();

  for (const codigo of MONEDAS_APERTURA_OBLIGATORIAS) {
    const esperado = esperadoPorCodigo.get(codigo);
    if (!esperado || !esperado.moneda_id) {
      pendientesGuardado.add(codigo);
      continue;
    }

    const conteo = conteoPorMonedaId.get(esperado.moneda_id);
    if (!conteo) {
      pendientesGuardado.add(codigo);
      continue;
    }

    guardadas.add(codigo);

    const tolerancia =
      codigo === "USD" ? toNumber(apertura?.tolerancia_usd ?? 1) : toNumber(apertura?.tolerancia_otras ?? 0.01);
    const diferencia = Math.abs(calcularTotalConteoItem(conteo) - toNumber(esperado.cantidad));

    if (diferencia <= tolerancia) {
      cuadradas.add(codigo);
    } else {
      descuadradas.add(codigo);
    }
  }

  const pendientes = MONEDAS_APERTURA_OBLIGATORIAS.filter(
    (codigo) => pendientesGuardado.has(codigo) || descuadradas.has(codigo)
  );

  return {
    guardadas: Array.from(guardadas),
    cuadradas: Array.from(cuadradas),
    descuadradas: Array.from(descuadradas),
    pendientes_guardado: Array.from(pendientesGuardado),
    pendientes,
  };
}

export async function obtenerEstadoAperturaOperativa(
  usuario: UsuarioAperturaContext | undefined
): Promise<EstadoAperturaOperativa> {
  const usuarioId = usuario?.id;
  const puntoAtencionId = usuario?.punto_atencion_id ?? null;
  const rol = usuario?.rol ?? null;

  if (rol === "ADMIN" || rol === "SUPER_USUARIO" || rol === "ADMINISTRATIVO") {
    return {
      puede_operar: true,
      requiere_inicio_jornada: false,
      requiere_apertura: false,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: false,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_cuadradas: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_descuadradas: [],
      monedas_obligatorias_pendientes: [],
      jornada: null,
      apertura: null,
      code: "OK",
    };
  }

  if (!usuarioId) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: false,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: false,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: [],
      monedas_obligatorias_cuadradas: [],
      monedas_obligatorias_descuadradas: [],
      monedas_obligatorias_pendientes: [...MONEDAS_APERTURA_OBLIGATORIAS],
      jornada: null,
      apertura: null,
      code: "NO_AUTH",
      error: "Usuario no autenticado",
    };
  }

  if (!puntoAtencionId) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: false,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: false,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: [],
      monedas_obligatorias_cuadradas: [],
      monedas_obligatorias_descuadradas: [],
      monedas_obligatorias_pendientes: [...MONEDAS_APERTURA_OBLIGATORIAS],
      jornada: null,
      apertura: null,
      code: "NO_PUNTO",
      error: "Usuario no tiene punto de atención asignado",
    };
  }

  const jornada = await prisma.jornada.findFirst({
    where: {
      usuario_id: usuarioId,
      punto_atencion_id: puntoAtencionId,
      OR: [{ estado: EstadoJornada.ACTIVO }, { estado: EstadoJornada.ALMUERZO }],
    },
    orderBy: { fecha_inicio: "desc" },
    select: {
      id: true,
      estado: true,
      punto_atencion_id: true,
    },
  });

  if (!jornada) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: true,
      requiere_apertura: false,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: false,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: [],
      monedas_obligatorias_cuadradas: [],
      monedas_obligatorias_descuadradas: [],
      monedas_obligatorias_pendientes: [...MONEDAS_APERTURA_OBLIGATORIAS],
      jornada: null,
      apertura: null,
      code: "NO_JORNADA",
      error: "No tiene una jornada activa. Debe iniciar jornada primero.",
    };
  }

  const apertura = await prisma.aperturaCaja.findUnique({
    where: { jornada_id: jornada.id },
    select: {
      id: true,
      estado: true,
      saldo_esperado: true,
      conteo_fisico: true,
      requiere_aprobacion: true,
      tolerancia_usd: true,
      tolerancia_otras: true,
    },
  });

  if (!apertura) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: true,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: true,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: [],
      monedas_obligatorias_cuadradas: [],
      monedas_obligatorias_descuadradas: [],
      monedas_obligatorias_pendientes: [...MONEDAS_APERTURA_OBLIGATORIAS],
      jornada,
      apertura: null,
      code: "NO_APERTURA",
      error: "Debe completar la apertura de caja antes de operar.",
    };
  }

  const { guardadas, cuadradas, descuadradas, pendientes_guardado, pendientes } = getEstadoMonedasObligatorias(apertura);
  const aperturaConfirmada = apertura.estado === EstadoApertura.ABIERTA;

  if (pendientes_guardado.length > 0) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: true,
      requiere_confirmacion: apertura.estado !== EstadoApertura.EN_CONTEO,
      requiere_cuadre_obligatorio: true,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: guardadas,
      monedas_obligatorias_cuadradas: cuadradas,
      monedas_obligatorias_descuadradas: descuadradas,
      monedas_obligatorias_pendientes: pendientes,
      jornada,
      apertura,
      code: "APERTURA_OBLIGATORIA_INCOMPLETA",
      error: `Debe guardar el cuadre obligatorio de ${pendientes_guardado.join(" y ")} en la apertura de caja.`,
    };
  }

  if (descuadradas.length > 0) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: true,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: true,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: guardadas,
      monedas_obligatorias_cuadradas: cuadradas,
      monedas_obligatorias_descuadradas: descuadradas,
      monedas_obligatorias_pendientes: pendientes,
      jornada,
      apertura,
      code: "APERTURA_OBLIGATORIA_INCOMPLETA",
      error: `USD y EUR deben quedar cuadrados antes de habilitar operaciones. Descuadradas: ${descuadradas.join(", ")}.`,
    };
  }

  if (apertura.estado === EstadoApertura.EN_CONTEO) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: true,
      requiere_confirmacion: false,
      requiere_cuadre_obligatorio: false,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: guardadas,
      monedas_obligatorias_cuadradas: cuadradas,
      monedas_obligatorias_descuadradas: descuadradas,
      monedas_obligatorias_pendientes: pendientes,
      jornada,
      apertura,
      code: "APERTURA_PENDIENTE",
      error: "Debe completar y guardar el conteo de apertura de caja.",
    };
  }

  if (!aperturaConfirmada) {
    return {
      puede_operar: false,
      requiere_inicio_jornada: false,
      requiere_apertura: false,
      requiere_confirmacion: true,
      requiere_cuadre_obligatorio: false,
      monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
      monedas_obligatorias_guardadas: guardadas,
      monedas_obligatorias_cuadradas: cuadradas,
      monedas_obligatorias_descuadradas: descuadradas,
      monedas_obligatorias_pendientes: pendientes,
      jornada,
      apertura,
      code: "APERTURA_NO_CONFIRMADA",
      error: "Debe confirmar la apertura de caja para iniciar operaciones.",
    };
  }

  return {
    puede_operar: true,
    requiere_inicio_jornada: false,
    requiere_apertura: false,
    requiere_confirmacion: false,
    requiere_cuadre_obligatorio: false,
    monedas_obligatorias: [...MONEDAS_APERTURA_OBLIGATORIAS],
    monedas_obligatorias_guardadas: guardadas,
    monedas_obligatorias_cuadradas: cuadradas,
    monedas_obligatorias_descuadradas: descuadradas,
    monedas_obligatorias_pendientes: pendientes,
    jornada,
    apertura,
    code: "OK",
  };
}