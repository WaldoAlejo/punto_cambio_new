/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO DE CONTROL DE TIEMPO Y JORNADAS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este servicio centraliza todo el cálculo de tiempos y validaciones de
 * jornadas laborales. TODOS los cálculos se realizan en el backend para
 * garantizar integridad y prevenir manipulación.
 */

import { PrismaClient, EstadoJornada, Prisma } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// Tipos y Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface TimeCalculationResult {
  minutosTrabajados: number;
  minutosAlmuerzo: number;
  minutosSalidas: number;
  minutosNetos: number; // Trabajados - Almuerzo - Salidas
}

export interface JornadaStats {
  totalJornadas: number;
  minutosTrabajadosPromedio: number;
  minutosAlmuerzoPromedio: number;
  diasConLlegadaTarde: number;
  diasConSalidaAnticipada: number;
  jornadasCompletadas: number;
  jornadasEnProgreso: number;
}

export interface ValidacionJornada {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}

export interface ConfigHorario {
  horaEntradaMinima: string; // "06:00"
  horaEntradaMaxima: string; // "10:00"
  horaSalidaMinima: string; // "16:00"
  horaSalidaMaxima: string; // "20:00"
  minAlmuerzoMaximo: number;
  minJornadaMinima: number;
  minJornadaMaxima: number;
  minToleranciaLlegada: number;
  minToleranciaSalida: number;
  requiereUbicacion: boolean;
  radioPermitidoMetros: number;
}

// Configuración por defecto
const DEFAULT_CONFIG: ConfigHorario = {
  horaEntradaMinima: "06:00",
  horaEntradaMaxima: "10:00",
  horaSalidaMinima: "16:00",
  horaSalidaMaxima: "20:00",
  minAlmuerzoMaximo: 60,
  minJornadaMinima: 480, // 8 horas
  minJornadaMaxima: 600, // 10 horas
  minToleranciaLlegada: 10,
  minToleranciaSalida: 10,
  requiereUbicacion: false,
  radioPermitidoMetros: 500,
};

// ═══════════════════════════════════════════════════════════════════════════
// Funciones de Cálculo de Tiempos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula los tiempos de una jornada de forma precisa
 * Esta es la función principal de cálculo - siempre se ejecuta en el backend
 */
export function calcularTiemposJornada(
  fechaInicio: Date,
  fechaAlmuerzo: Date | null,
  fechaRegreso: Date | null,
  fechaSalida: Date | null,
  salidasEspontaneas: Array<{ fecha_salida: Date; fecha_regreso: Date | null; duracion_minutos: number | null }> = []
): TimeCalculationResult {
  const ahora = new Date();
  const finJornada = fechaSalida || ahora;
  
  // 1. Calcular tiempo total desde inicio hasta fin (o ahora)
  let minutosTrabajados = Math.max(0, Math.floor((finJornada.getTime() - fechaInicio.getTime()) / (1000 * 60)));
  
  // 2. Calcular tiempo de almuerzo
  let minutosAlmuerzo = 0;
  if (fechaAlmuerzo) {
    const finAlmuerzo = fechaRegreso || ahora;
    minutosAlmuerzo = Math.max(0, Math.floor((finAlmuerzo.getTime() - fechaAlmuerzo.getTime()) / (1000 * 60)));
  }
  
  // 3. Calcular tiempo en salidas espontáneas
  let minutosSalidas = 0;
  for (const salida of salidasEspontaneas) {
    if (salida.duracion_minutos) {
      minutosSalidas += salida.duracion_minutos;
    } else if (salida.fecha_regreso) {
      minutosSalidas += Math.max(0, Math.floor(
        (salida.fecha_regreso.getTime() - salida.fecha_salida.getTime()) / (1000 * 60)
      ));
    } else {
      // Salida activa - calcular hasta ahora
      minutosSalidas += Math.max(0, Math.floor(
        (ahora.getTime() - salida.fecha_salida.getTime()) / (1000 * 60)
      ));
    }
  }
  
  // 4. Calcular minutos netos (tiempo efectivo de trabajo)
  const minutosNetos = Math.max(0, minutosTrabajados - minutosAlmuerzo - minutosSalidas);
  
  return {
    minutosTrabajados,
    minutosAlmuerzo,
    minutosSalidas,
    minutosNetos,
  };
}

/**
 * Obtiene la configuración de horario aplicable
 */
export async function obtenerConfigHorario(
  puntoAtencionId?: string
): Promise<ConfigHorario> {
  try {
    // Buscar configuración específica del punto o la default
    const config = await prisma.configuracionHorario.findFirst({
      where: {
        activo: true,
        OR: [
          { punto_atencion_id: puntoAtencionId || null },
          { es_default: true },
        ],
      },
      orderBy: [
        { punto_atencion_id: "desc" }, // Priorizar config específica
        { created_at: "desc" },
      ],
    });

    if (!config) {
      return DEFAULT_CONFIG;
    }

    return {
      horaEntradaMinima: config.hora_entrada_minima,
      horaEntradaMaxima: config.hora_entrada_maxima,
      horaSalidaMinima: config.hora_salida_minima,
      horaSalidaMaxima: config.hora_salida_maxima,
      minAlmuerzoMaximo: config.min_almuerzo_maximo,
      minJornadaMinima: config.min_jornada_minima,
      minJornadaMaxima: config.min_jornada_maxima,
      minToleranciaLlegada: config.min_tolerancia_llegada,
      minToleranciaSalida: config.min_tolerancia_salida,
      requiereUbicacion: config.requiere_ubicacion,
      radioPermitidoMetros: config.radio_permitido_metros,
    };
  } catch (error) {
    logger.error("Error obteniendo configuración de horario", { error });
    return DEFAULT_CONFIG;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Validaciones de Negocio
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida si se puede iniciar una jornada
 */
export async function validarInicioJornada(
  usuarioId: string,
  puntoAtencionId: string,
  fechaInicio: Date = new Date(),
  ubicacion?: { lat: number; lng: number } | null
): Promise<ValidacionJornada> {
  const errores: string[] = [];
  const advertencias: string[] = [];
  
  const config = await obtenerConfigHorario(puntoAtencionId);
  
  // 1. Verificar que no existe una jornada activa para hoy
  const inicioDia = new Date(fechaInicio);
  inicioDia.setHours(0, 0, 0, 0);
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);
  
  const jornadaExistente = await prisma.jornada.findFirst({
    where: {
      usuario_id: usuarioId,
      fecha_inicio: { gte: inicioDia, lt: finDia },
      estado: { in: [EstadoJornada.ACTIVO, EstadoJornada.ALMUERZO] },
    },
  });
  
  if (jornadaExistente) {
    errores.push("Ya existe una jornada activa para hoy. Finalice la jornada anterior antes de iniciar una nueva.");
  }
  
  // 2. Validar hora de entrada
  const horaActual = fechaInicio.getHours();
  const minutosActual = fechaInicio.getMinutes();
  const tiempoActual = horaActual * 60 + minutosActual;
  
  const [horaMin, minMin] = config.horaEntradaMinima.split(":").map(Number);
  const [horaMax, minMax] = config.horaEntradaMaxima.split(":").map(Number);
  const tiempoMinimo = horaMin * 60 + minMin;
  const tiempoMaximo = horaMax * 60 + minMax + config.minToleranciaLlegada;
  
  if (tiempoActual < tiempoMinimo) {
    advertencias.push(`La hora de entrada (${horaActual}:${minutosActual.toString().padStart(2, "0")}) es antes del horario permitido (${config.horaEntradaMinima}).`);
  }
  
  if (tiempoActual > tiempoMaximo) {
    advertencias.push(`La hora de entrada (${horaActual}:${minutosActual.toString().padStart(2, "0")}) excede el límite permitido (${config.horaEntradaMaxima} + ${config.minToleranciaLlegada}min tolerancia).`);
  }
  
  // 3. Validar ubicación si es requerida
  if (config.requiereUbicacion && ubicacion) {
    // TODO: Implementar validación de distancia al punto de atención
    // Requiere obtener coordenadas del punto desde la BD
  }
  
  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  };
}

/**
 * Valida si se puede registrar almuerzo
 */
export async function validarAlmuerzo(
  jornadaId: string,
  tipo: "INICIO" | "REGRESO",
  fecha: Date = new Date()
): Promise<ValidacionJornada> {
  const errores: string[] = [];
  const advertencias: string[] = [];
  
  const jornada = await prisma.jornada.findUnique({
    where: { id: jornadaId },
  });
  
  if (!jornada) {
    errores.push("Jornada no encontrada");
    return { valido: false, errores, advertencias };
  }
  
  if (tipo === "INICIO") {
    if (jornada.estado !== EstadoJornada.ACTIVO) {
      errores.push("Solo se puede iniciar almuerzo desde estado ACTIVO");
    }
    if (jornada.fecha_almuerzo) {
      errores.push("El almuerzo ya fue iniciado anteriormente");
    }
  } else {
    if (jornada.estado !== EstadoJornada.ALMUERZO) {
      errores.push("Solo se puede regresar de almuerzo desde estado ALMUERZO");
    }
    if (!jornada.fecha_almuerzo) {
      errores.push("No hay registro de inicio de almuerzo");
    }
    if (jornada.fecha_regreso) {
      errores.push("El regreso de almuerzo ya fue registrado");
    }
    
    // Validar tiempo máximo de almuerzo
    if (jornada.fecha_almuerzo) {
      const config = await obtenerConfigHorario(jornada.punto_atencion_id);
      const minutosAlmuerzo = Math.floor(
        (fecha.getTime() - jornada.fecha_almuerzo.getTime()) / (1000 * 60)
      );
      
      if (minutosAlmuerzo > config.minAlmuerzoMaximo) {
        advertencias.push(`El tiempo de almuerzo (${minutosAlmuerzo} min) excede el máximo permitido (${config.minAlmuerzoMaximo} min).`);
      }
    }
  }
  
  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  };
}

/**
 * Valida si se puede finalizar una jornada
 */
export async function validarFinJornada(
  jornadaId: string,
  fechaSalida: Date = new Date()
): Promise<ValidacionJornada> {
  const errores: string[] = [];
  const advertencias: string[] = [];
  
  const jornada = await prisma.jornada.findUnique({
    where: { id: jornadaId },
    include: {
      usuario: { select: { rol: true } },
    },
  });
  
  if (!jornada) {
    errores.push("Jornada no encontrada");
    return { valido: false, errores, advertencias };
  }
  
  if (jornada.estado === EstadoJornada.COMPLETADO || jornada.estado === EstadoJornada.CANCELADO) {
    errores.push("La jornada ya fue finalizada");
  }
  
  if (jornada.estado === EstadoJornada.ALMUERZO) {
    errores.push("Debe regresar del almuerzo antes de finalizar la jornada");
  }
  
  // Validar tiempo mínimo de jornada
  const config = await obtenerConfigHorario(jornada.punto_atencion_id);
  const minutosTrabajados = Math.floor(
    (fechaSalida.getTime() - jornada.fecha_inicio.getTime()) / (1000 * 60)
  );
  
  // Restar tiempo de almuerzo si existe
  let minutosAlmuerzo = 0;
  if (jornada.fecha_almuerzo && jornada.fecha_regreso) {
    minutosAlmuerzo = Math.floor(
      (jornada.fecha_regreso.getTime() - jornada.fecha_almuerzo.getTime()) / (1000 * 60)
    );
  }
  
  const minutosEfectivos = minutosTrabajados - minutosAlmuerzo;
  
  if (minutosEfectivos < config.minJornadaMinima) {
    const horas = Math.floor(minutosEfectivos / 60);
    const min = minutosEfectivos % 60;
    const horasReq = Math.floor(config.minJornadaMinima / 60);
    const minReq = config.minJornadaMinima % 60;
    advertencias.push(`Tiempo de jornada (${horas}h ${min}m) es menor al mínimo requerido (${horasReq}h ${minReq}m).`);
  }
  
  if (minutosEfectivos > config.minJornadaMaxima) {
    const horas = Math.floor(minutosEfectivos / 60);
    const min = minutosEfectivos % 60;
    const horasMax = Math.floor(config.minJornadaMaxima / 60);
    const minMax = config.minJornadaMaxima % 60;
    advertencias.push(`Tiempo de jornada (${horas}h ${min}m) excede el máximo permitido (${horasMax}h ${minMax}m).`);
  }
  
  // Validar hora de salida
  const horaActual = fechaSalida.getHours();
  const minutosActual = fechaSalida.getMinutes();
  const tiempoActual = horaActual * 60 + minutosActual;
  
  const [horaMin, minMin] = config.horaSalidaMinima.split(":").map(Number);
  const tiempoMinimo = horaMin * 60 + minMin - config.minToleranciaSalida;
  
  if (tiempoActual < tiempoMinimo) {
    advertencias.push(`La hora de salida es antes del horario mínimo permitido (${config.horaSalidaMinima}).`);
  }
  
  return {
    valido: errores.length === 0,
    errores,
    advertencias,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Actualización de Cálculos en BD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Actualiza los campos calculados de una jornada en la base de datos
 */
export async function actualizarTiemposJornada(jornadaId: string): Promise<void> {
  try {
    const jornada = await prisma.jornada.findUnique({
      where: { id: jornadaId },
      include: {
        usuario: {
          include: {
            salidasEspontaneas: {
              where: {
                estado: "COMPLETADO",
              },
            },
          },
        },
      },
    });
    
    if (!jornada) return;
    
    // Filtrar salidas espontáneas del día de la jornada
    const inicioDia = new Date(jornada.fecha_inicio);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia);
    finDia.setDate(finDia.getDate() + 1);
    
    const salidasDelDia = jornada.usuario.salidasEspontaneas.filter(
      (s) => s.fecha_salida >= inicioDia && s.fecha_salida < finDia
    );
    
    const tiempos = calcularTiemposJornada(
      jornada.fecha_inicio,
      jornada.fecha_almuerzo,
      jornada.fecha_regreso,
      jornada.fecha_salida,
      salidasDelDia
    );
    
    await prisma.jornada.update({
      where: { id: jornadaId },
      data: {
        minutos_trabajados: tiempos.minutosTrabajados,
        minutos_almuerzo: tiempos.minutosAlmuerzo,
        minutos_salidas: tiempos.minutosSalidas,
      },
    });
    
    logger.info("Tiempos de jornada actualizados", {
      jornadaId,
      ...tiempos,
    });
  } catch (error) {
    logger.error("Error actualizando tiempos de jornada", { jornadaId, error });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Estadísticas y Reportes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene estadísticas de jornadas para un usuario en un período
 */
export async function obtenerEstadisticasUsuario(
  usuarioId: string,
  fechaDesde: Date,
  fechaHasta: Date
): Promise<JornadaStats> {
  const jornadas = await prisma.jornada.findMany({
    where: {
      usuario_id: usuarioId,
      fecha_inicio: { gte: fechaDesde, lte: fechaHasta },
      estado: { in: [EstadoJornada.COMPLETADO, EstadoJornada.ACTIVO, EstadoJornada.ALMUERZO] },
    },
  });
  
  if (jornadas.length === 0) {
    return {
      totalJornadas: 0,
      minutosTrabajadosPromedio: 0,
      minutosAlmuerzoPromedio: 0,
      diasConLlegadaTarde: 0,
      diasConSalidaAnticipada: 0,
      jornadasCompletadas: 0,
      jornadasEnProgreso: 0,
    };
  }
  
  const config = await obtenerConfigHorario();
  const [horaMax, minMax] = config.horaEntradaMaxima.split(":").map(Number);
  const tiempoMaximoEntrada = horaMax * 60 + minMax;
  
  const [horaMinSalida, minMinSalida] = config.horaSalidaMinima.split(":").map(Number);
  const tiempoMinimoSalida = horaMinSalida * 60 + minMinSalida;
  
  let totalMinutosTrabajados = 0;
  let totalMinutosAlmuerzo = 0;
  let diasConLlegadaTarde = 0;
  let diasConSalidaAnticipada = 0;
  let jornadasCompletadas = 0;
  let jornadasEnProgreso = 0;
  
  for (const jornada of jornadas) {
    // Contar jornadas por estado
    if (jornada.estado === EstadoJornada.COMPLETADO) {
      jornadasCompletadas++;
    } else {
      jornadasEnProgreso++;
    }
    
    // Usar campos calculados si existen, sino calcular
    const minTrabajados = jornada.minutos_trabajados || 
      Math.floor((new Date().getTime() - jornada.fecha_inicio.getTime()) / (1000 * 60));
    const minAlmuerzo = jornada.minutos_almuerzo || 0;
    
    totalMinutosTrabajados += minTrabajados;
    totalMinutosAlmuerzo += minAlmuerzo;
    
    // Verificar llegada tarde
    const horaEntrada = jornada.fecha_inicio.getHours() * 60 + jornada.fecha_inicio.getMinutes();
    if (horaEntrada > tiempoMaximoEntrada + config.minToleranciaLlegada) {
      diasConLlegadaTarde++;
    }
    
    // Verificar salida anticipada
    if (jornada.fecha_salida) {
      const horaSalida = jornada.fecha_salida.getHours() * 60 + jornada.fecha_salida.getMinutes();
      if (horaSalida < tiempoMinimoSalida - config.minToleranciaSalida) {
        diasConSalidaAnticipada++;
      }
    }
  }
  
  return {
    totalJornadas: jornadas.length,
    minutosTrabajadosPromedio: Math.round(totalMinutosTrabajados / jornadas.length),
    minutosAlmuerzoPromedio: Math.round(totalMinutosAlmuerzo / jornadas.length),
    diasConLlegadaTarde,
    diasConSalidaAnticipada,
    jornadasCompletadas,
    jornadasEnProgreso,
  };
}

/**
 * Obtiene resumen de jornadas para el dashboard de administrador
 */
export async function obtenerResumenJornadasHoy(): Promise<{
  totalActivas: number;
  totalAlmuerzo: number;
  totalCompletadas: number;
  promedioMinutosTrabajados: number;
}> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  
  const [activas, almuerzo, completadas] = await Promise.all([
    prisma.jornada.count({
      where: {
        fecha_inicio: { gte: hoy, lt: manana },
        estado: EstadoJornada.ACTIVO,
      },
    }),
    prisma.jornada.count({
      where: {
        fecha_inicio: { gte: hoy, lt: manana },
        estado: EstadoJornada.ALMUERZO,
      },
    }),
    prisma.jornada.findMany({
      where: {
        fecha_inicio: { gte: hoy, lt: manana },
        estado: EstadoJornada.COMPLETADO,
      },
      select: { minutos_trabajados: true },
    }),
  ]);
  
  const totalMinutos = completadas.reduce((sum, j) => sum + (j.minutos_trabajados || 0), 0);
  const promedio = completadas.length > 0 ? Math.round(totalMinutos / completadas.length) : 0;
  
  return {
    totalActivas: activas,
    totalAlmuerzo: almuerzo,
    totalCompletadas: completadas.length,
    promedioMinutosTrabajados: promedio,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exportar servicio
// ═══════════════════════════════════════════════════════════════════════════

export const timeTrackingService = {
  calcularTiemposJornada,
  obtenerConfigHorario,
  validarInicioJornada,
  validarAlmuerzo,
  validarFinJornada,
  actualizarTiemposJornada,
  obtenerEstadisticasUsuario,
  obtenerResumenJornadasHoy,
};

export default timeTrackingService;
