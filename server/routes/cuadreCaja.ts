
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { authenticateToken } from "../middleware/auth";
import logger from "../utils/logger.js";

const router = express.Router();

const supabaseUrl = "https://kmmkrrlmvijvntnarfmo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttbWtycmxtdmlqdm50bmFyZm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MDYzNTIsImV4cCI6MjA2NTQ4MjM1Mn0.0Lj7RAlvwCh-xNpST8AEE_OHUNghqrljF5gkCfCvm4c";
const supabase = createClient(supabaseUrl, supabaseKey);

// Obtener el cuadre actual y datos para cierre
router.get("/", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user;
    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar cuadre abierto del día
    const { data: cuadre, error: cuadreError } = await supabase
      .from('CuadreCaja')
      .select(`
        *,
        detalles:DetalleCuadreCaja(
          *,
          moneda:Moneda(*)
        )
      `)
      .eq('punto_atencion_id', usuario.punto_atencion_id)
      .gte('fecha', hoy.toISOString())
      .eq('estado', 'ABIERTO')
      .single();

    if (cuadreError && cuadreError.code !== 'PGRST116') {
      console.error('Error obteniendo cuadre:', cuadreError);
    }

    // Obtener jornada activa para calcular período
    const { data: jornadaActiva, error: jornadaError } = await supabase
      .from('Jornada')
      .select('*')
      .eq('usuario_id', usuario.id)
      .eq('punto_atencion_id', usuario.punto_atencion_id)
      .eq('estado', 'ACTIVO')
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .single();

    if (jornadaError && jornadaError.code !== 'PGRST116') {
      console.error('Error obteniendo jornada:', jornadaError);
    }

    const fechaInicio = jornadaActiva?.fecha_inicio ? new Date(jornadaActiva.fecha_inicio) : hoy;

    console.log("📅 Cuadre debug info:", {
      puntoAtencionId: usuario.punto_atencion_id,
      fechaInicio: fechaInicio.toISOString(),
      fechaHoy: hoy.toISOString(),
      jornadaActiva: jornadaActiva ? {
        id: jornadaActiva.id,
        estado: jornadaActiva.estado,
        fechaInicio: jornadaActiva.fecha_inicio
      } : null
    });

    // Obtener cambios realizados en el período
    const { data: cambiosHoy, error: cambiosError } = await supabase
      .from('CambioDivisa')
      .select('id, moneda_origen_id, moneda_destino_id, monto_origen, monto_destino, fecha, estado')
      .eq('punto_atencion_id', usuario.punto_atencion_id)
      .gte('fecha', fechaInicio.toISOString())
      .eq('estado', 'COMPLETADO');

    if (cambiosError) {
      console.error('Error obteniendo cambios:', cambiosError);
      return res.status(500).json({ success: false, error: 'Error obteniendo cambios' });
    }

    // Obtener transferencias del período
    const { data: transferenciasEntrada, error: transferenciasEntradaError } = await supabase
      .from('Transferencia')
      .select('id, monto, moneda_id, tipo_transferencia')
      .eq('destino_id', usuario.punto_atencion_id)
      .gte('fecha', fechaInicio.toISOString())
      .eq('estado', 'APROBADA');

    const { data: transferenciasSalida, error: transferenciasSalidaError } = await supabase
      .from('Transferencia')
      .select('id, monto, moneda_id, tipo_transferencia')
      .eq('origen_id', usuario.punto_atencion_id)
      .gte('fecha', fechaInicio.toISOString())
      .eq('estado', 'APROBADA');

    if (transferenciasEntradaError || transferenciasSalidaError) {
      console.error('Error obteniendo transferencias:', { transferenciasEntradaError, transferenciasSalidaError });
    }

    console.log("💱 Cambios COMPLETADOS:", {
      total: cambiosHoy?.length || 0,
      cambios: cambiosHoy?.map(c => ({
        id: c.id,
        fecha: c.fecha,
        estado: c.estado,
        origen: c.moneda_origen_id,
        destino: c.moneda_destino_id,
        montoOrigen: c.monto_origen,
        montoDestino: c.monto_destino
      }))
    });

    console.log("📈 Transferencias:", {
      entrada: transferenciasEntrada?.length || 0,
      salida: transferenciasSalida?.length || 0
    });

    // Identificar monedas utilizadas
    const monedasUsadas = new Set<string>();
    cambiosHoy?.forEach((cambio) => {
      monedasUsadas.add(cambio.moneda_origen_id);
      monedasUsadas.add(cambio.moneda_destino_id);
    });

    console.log("🪙 Monedas utilizadas:", Array.from(monedasUsadas));

    if (monedasUsadas.size === 0) {
      console.log("⚠️ No hay monedas utilizadas, retornando mensaje");
      return res.status(200).json({
        success: true,
        data: {
          detalles: [],
          observaciones: "",
          mensaje: "No se han realizado cambios de divisa hoy",
          totales: {
            cambios: 0,
            transferencias_entrada: transferenciasEntrada?.length || 0,
            transferencias_salida: transferenciasSalida?.length || 0,
          },
        },
      });
    }

    // Obtener información de las monedas utilizadas
    const { data: monedas, error: monedasError } = await supabase
      .from('Moneda')
      .select('*')
      .in('id', Array.from(monedasUsadas))
      .eq('activo', true)
      .order('orden_display', { ascending: true });

    if (monedasError) {
      console.error('Error obteniendo monedas:', monedasError);
      return res.status(500).json({ success: false, error: 'Error obteniendo monedas' });
    }

    // Calcular movimientos para cada moneda
    const detallesConValores = await Promise.all(
      (monedas || []).map(async (moneda) => {
        const detalle = cuadre?.detalles?.find((d: any) => d.moneda_id === moneda.id);
        
        // Calcular saldo de apertura
        const saldoApertura = await calcularSaldoApertura(
          usuario.punto_atencion_id as string,
          moneda.id,
          fechaInicio
        );

        console.log(`💰 Calculando movimientos para ${moneda.codigo}:`, {
          saldoApertura,
          cambiosHoy: cambiosHoy?.filter(c => 
            c.moneda_origen_id === moneda.id || c.moneda_destino_id === moneda.id
          )
        });

        // Calcular movimientos del período con mejor claridad
        // INGRESOS: cuando esta moneda es la que SE RECIBE (moneda_destino)
        const ingresos = cambiosHoy
          ?.filter(c => c.moneda_destino_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_destino), 0) || 0;

        // EGRESOS: cuando esta moneda es la que SE ENTREGA (moneda_origen)
        const egresos = cambiosHoy
          ?.filter(c => c.moneda_origen_id === moneda.id)
          .reduce((sum, c) => sum + Number(c.monto_origen), 0) || 0;

        const saldoCierre = saldoApertura + ingresos - egresos;

        console.log(`📊 Resultado para ${moneda.codigo}:`, {
          saldoApertura,
          ingresos: `+${ingresos}`,
          egresos: `-${egresos}`,
          saldoCierre
        });

        return {
          moneda_id: moneda.id,
          codigo: moneda.codigo,
          nombre: moneda.nombre,
          simbolo: moneda.simbolo,
          saldo_apertura: saldoApertura,
          saldo_cierre: saldoCierre,
          conteo_fisico: detalle?.conteo_fisico || 0,
          billetes: detalle?.billetes || 0,
          monedas: detalle?.monedas_fisicas || 0,
          ingresos_periodo: ingresos,
          egresos_periodo: egresos,
          movimientos_periodo: cambiosHoy?.filter(c => 
            c.moneda_origen_id === moneda.id || c.moneda_destino_id === moneda.id
          ).length || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        detalles: detallesConValores,
        observaciones: cuadre?.observaciones || "",
        cuadre_id: cuadre?.id,
        periodo_inicio: fechaInicio,
        totales: {
          cambios: cambiosHoy?.length || 0,
          transferencias_entrada: transferenciasEntrada?.length || 0,
          transferencias_salida: transferenciasSalida?.length || 0,
        },
      },
    });
  } catch (error) {
    logger.error("Error al obtener cuadre de caja", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Función auxiliar para calcular saldo de apertura
async function calcularSaldoApertura(
  puntoAtencionId: string,
  monedaId: string,
  fecha: Date
): Promise<number> {
  try {
    console.log(`🔍 CALCULANDO SALDO APERTURA - Datos:`, {
      puntoAtencionId,
      monedaId,
      fecha: fecha.toISOString()
    });
    
    // 1. Buscar el último cierre anterior
    console.log(`🔍 Buscando último cierre anterior...`);
    const { data: ultimoCierre, error: ultimoCierreError } = await supabase
      .from('DetalleCuadreCaja')
      .select(`
        *,
        cuadre:CuadreCaja(*)
      `)
      .eq('moneda_id', monedaId)
      .eq('cuadre.punto_atencion_id', puntoAtencionId)
      .in('cuadre.estado', ['CERRADO', 'PARCIAL'])
      .lt('cuadre.fecha', fecha.toISOString())
      .order('cuadre.fecha', { ascending: false })
      .limit(1)
      .single();

    if (ultimoCierreError && ultimoCierreError.code !== 'PGRST116') {
      console.error('Error buscando último cierre:', ultimoCierreError);
    }

    console.log(`🔍 Resultado búsqueda último cierre:`, ultimoCierre ? {
      id: ultimoCierre.id,
      conteo_fisico: ultimoCierre.conteo_fisico,
      fecha_cuadre: ultimoCierre.cuadre?.fecha,
      estado_cuadre: ultimoCierre.cuadre?.estado
    } : 'NO ENCONTRADO');

    if (ultimoCierre) {
      console.log(`✅ USANDO ÚLTIMO CIERRE: ${ultimoCierre.conteo_fisico}`);
      return Number(ultimoCierre.conteo_fisico);
    }

    // 2. Si no hay cierre anterior, buscar saldo inicial actual
    console.log(`🔍 No hay cierre anterior, buscando saldo inicial en tabla Saldo...`);
    
    // Primero verificar todos los saldos del punto
    const { data: todosSaldos, error: todosSaldosError } = await supabase
      .from('Saldo')
      .select(`
        *,
        moneda:Moneda(codigo)
      `)
      .eq('punto_atencion_id', puntoAtencionId);

    if (todosSaldosError) {
      console.error('Error obteniendo todos los saldos:', todosSaldosError);
    }
    
    console.log(`🔍 TODOS LOS SALDOS del punto ${puntoAtencionId}:`, todosSaldos?.map(s => ({
      moneda_id: s.moneda_id,
      moneda_codigo: s.moneda?.codigo,
      cantidad: s.cantidad
    })));

    const { data: saldoInicial, error: saldoInicialError } = await supabase
      .from('Saldo')
      .select(`
        *,
        moneda:Moneda(codigo)
      `)
      .eq('punto_atencion_id', puntoAtencionId)
      .eq('moneda_id', monedaId)
      .single();

    if (saldoInicialError && saldoInicialError.code !== 'PGRST116') {
      console.error('Error obteniendo saldo inicial:', saldoInicialError);
    }

    console.log(`🔍 SALDO INICIAL específico:`, saldoInicial ? {
      id: saldoInicial.id,
      punto_atencion_id: saldoInicial.punto_atencion_id,
      moneda_id: saldoInicial.moneda_id,
      moneda_codigo: saldoInicial.moneda?.codigo,
      cantidad: saldoInicial.cantidad
    } : 'NO ENCONTRADO');

    if (saldoInicial) {
      console.log(`✅ USANDO SALDO INICIAL: ${saldoInicial.cantidad}`);
      return Number(saldoInicial.cantidad);
    }

    console.log(`❌ NO SE ENCONTRÓ SALDO APERTURA, usando 0`);
    return 0;
  } catch (error) {
    console.error(`💥 ERROR calculando saldo apertura:`, error);
    logger.error("Error calculando saldo apertura", { error });
    return 0;
  }
}

// Guardar cierre de caja
router.post("/", authenticateToken, async (req, res) => {
  try {
    const usuario = req.user;
    if (!usuario || !usuario.punto_atencion_id) {
      return res.status(401).json({
        success: false,
        error: "Usuario no autenticado o sin punto de atención asignado",
      });
    }

    const { detalles, observaciones } = req.body;

    if (!detalles || !Array.isArray(detalles)) {
      return res.status(400).json({
        success: false,
        error: "Detalles del cuadre son requeridos",
      });
    }

    // Obtener jornada activa para calcular período
    const { data: jornadaActiva, error: jornadaError } = await supabase
      .from('Jornada')
      .select('*')
      .eq('usuario_id', usuario.id)
      .eq('punto_atencion_id', usuario.punto_atencion_id)
      .eq('estado', 'ACTIVO')
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .single();

    const fechaInicio = jornadaActiva?.fecha_inicio ? new Date(jornadaActiva.fecha_inicio) : new Date();
    fechaInicio.setHours(0, 0, 0, 0);

    // Calcular totales del período
    const { count: totalCambios } = await supabase
      .from('CambioDivisa')
      .select('*', { count: 'exact', head: true })
      .eq('punto_atencion_id', usuario.punto_atencion_id)
      .gte('fecha', fechaInicio.toISOString())
      .eq('estado', 'COMPLETADO');

    const { count: totalTransferenciasEntrada } = await supabase
      .from('Transferencia')
      .select('*', { count: 'exact', head: true })
      .eq('destino_id', usuario.punto_atencion_id)
      .gte('fecha', fechaInicio.toISOString())
      .eq('estado', 'APROBADA');

    const { count: totalTransferenciasSalida } = await supabase
      .from('Transferencia')
      .select('*', { count: 'exact', head: true })
      .eq('origen_id', usuario.punto_atencion_id)
      .gte('fecha', fechaInicio.toISOString())
      .eq('estado', 'APROBADA');

    // Crear el cuadre principal
    const { data: cuadre, error: cuadreError } = await supabase
      .from('CuadreCaja')
      .insert({
        usuario_id: usuario.id,
        punto_atencion_id: usuario.punto_atencion_id,
        estado: 'CERRADO',
        observaciones: observaciones || null,
        fecha_cierre: new Date().toISOString(),
        total_cambios: totalCambios || 0,
        total_transferencias_entrada: totalTransferenciasEntrada || 0,
        total_transferencias_salida: totalTransferenciasSalida || 0,
      })
      .select()
      .single();

    if (cuadreError) {
      console.error('Error creando cuadre:', cuadreError);
      return res.status(500).json({
        success: false,
        error: 'Error creando cuadre de caja',
      });
    }

    // Crear los detalles del cuadre
    const detalleInserts = detalles.map((detalle: any) => ({
      cuadre_id: cuadre.id,
      moneda_id: detalle.moneda_id,
      saldo_apertura: detalle.saldo_apertura || 0,
      saldo_cierre: detalle.saldo_cierre || 0,
      conteo_fisico: detalle.conteo_fisico || 0,
      billetes: detalle.billetes || 0,
      monedas_fisicas: detalle.monedas || 0,
      diferencia: (detalle.conteo_fisico || 0) - (detalle.saldo_cierre || 0),
    }));

    const { error: detallesError } = await supabase
      .from('DetalleCuadreCaja')
      .insert(detalleInserts);

    if (detallesError) {
      console.error('Error creando detalles:', detallesError);
      return res.status(500).json({
        success: false,
        error: 'Error creando detalles de cuadre',
      });
    }

    // Obtener el cuadre completo
    const { data: cuadreCompleto, error: cuadreCompletoError } = await supabase
      .from('CuadreCaja')
      .select(`
        *,
        detalles:DetalleCuadreCaja(
          *,
          moneda:Moneda(*)
        ),
        usuario:Usuario(nombre, username)
      `)
      .eq('id', cuadre.id)
      .single();

    if (cuadreCompletoError) {
      console.error('Error obteniendo cuadre completo:', cuadreCompletoError);
    }

    logger.info("Cuadre de caja guardado exitosamente", {
      cuadreId: cuadre.id,
      usuario_id: usuario.id,
      punto_atencion_id: usuario.punto_atencion_id,
    });

    res.status(201).json({
      success: true,
      cuadre: cuadreCompleto || cuadre,
      message: "Cuadre de caja guardado exitosamente",
    });
  } catch (error) {
    logger.error("Error al guardar cuadre de caja", {
      error: error instanceof Error ? error.message : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
      usuario_id: req.user?.id,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
