import express from "express";
import { authenticateToken, requireRole } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import prisma from "../../lib/prisma.js";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Prisma, ServicioExterno } from "@prisma/client";
import { gyeDayRangeUtcFromDateOnly } from "../../utils/timezone.js";

const router = express.Router();
const dbService = new ServientregaDBService();

function buildGuideAccessWhere(req: express.Request): Prisma.ServientregaGuiaWhereInput {
  const rol = req.user?.rol;

  if (rol === "OPERADOR" || rol === "CONCESION") {
    return {
      punto_atencion_id: req.user?.punto_atencion_id || "__NO_ACCESS_POINT__",
    };
  }

  return {};
}

type AssignmentReportRow = {
  id: string;
  fecha_asignacion: Date;
  punto_id: string;
  punto_nombre: string;
  punto_ciudad: string;
  tipo: string;
  valor_asignado: number;
  valor_total: number;
  asignado_por: string;
  observaciones: string | null;
  saldo_actual_reporte: number;
};

function buildServientregaAssignmentReport(
  assignments: Array<{
    id: string;
    punto_atencion_id: string;
    tipo: string;
    monto: { toString(): string };
    observaciones: string | null;
    fecha: Date;
    puntoAtencion?: { nombre: string; ciudad: string | null } | null;
    usuarioAsignador?: { nombre: string | null; username: string } | null;
  }>,
  currentBalances: Array<{
    punto_atencion_id: string;
    cantidad: { toString(): string };
  }>
): AssignmentReportRow[] {
  const currentBalanceByPoint = new Map(
    currentBalances.map((balance) => [
      balance.punto_atencion_id,
      parseFloat(balance.cantidad.toString()),
    ])
  );
  const cumulativeAssignedByPoint = new Map<string, number>();

  return assignments.map((assignment) => {
    const amount = parseFloat(assignment.monto.toString());
    const previousTotal = cumulativeAssignedByPoint.get(assignment.punto_atencion_id) || 0;
    const nextTotal = previousTotal + amount;
    cumulativeAssignedByPoint.set(assignment.punto_atencion_id, nextTotal);

    return {
      id: assignment.id,
      fecha_asignacion: assignment.fecha,
      punto_id: assignment.punto_atencion_id,
      punto_nombre: assignment.puntoAtencion?.nombre || "N/A",
      punto_ciudad: assignment.puntoAtencion?.ciudad || "N/A",
      tipo: assignment.tipo,
      valor_asignado: amount,
      valor_total: nextTotal,
      asignado_por:
        assignment.usuarioAsignador?.nombre ||
        assignment.usuarioAsignador?.username ||
        "Sistema",
      observaciones: assignment.observaciones,
      saldo_actual_reporte:
        currentBalanceByPoint.get(assignment.punto_atencion_id) || 0,
    };
  });
}

/** Asegura que exista USD y devuelve su id */
async function ensureUsdMonedaId(): Promise<string> {
  const existing = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const created = await prisma.moneda.create({
    data: {
      nombre: "Dólar estadounidense",
      simbolo: "$",
      codigo: "USD",
      activo: true,
      orden_display: 0,
      comportamiento_compra: "MULTIPLICA",
      comportamiento_venta: "DIVIDE",
    },
    select: { id: true },
  });
  return created.id;
}

// GET /api/servientrega/informes/guias
router.get(
  "/informes/guias",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { desde, hasta, estado, punto_atencion_id: puntoQuery } = req.query;
      const rol = req.user?.rol;
      
      // 🎯 Determinar qué guías puede ver el usuario:
      // - OPERADOR: guías de su punto asignado (todas las que se generaron en su punto)
      // - CONCESION: guías de su punto asignado
      // - ADMIN/SUPER_USUARIO/ADMINISTRATIVO: todas las guías (pueden filtrar por punto)
      let usuario_id: string | undefined;
      let punto_atencion_id: string | undefined = puntoQuery as string | undefined;
      
      if (rol === "OPERADOR" || rol === "CONCESION") {
        // Operador y Concesión ven las guías de su punto asignado
        punto_atencion_id = req.user?.punto_atencion_id || punto_atencion_id;
      }
      // Admin/Super/Administrativo ven todas (sin filtro de usuario/punto a menos que se especifique)

      console.log("🔍 Obteniendo informes de guías:", {
        desde,
        hasta,
        estado,
        punto_atencion_id,
        usuario_id,
        rol,
      });

      // Obtener guías de la base de datos
      const guias = await dbService.obtenerGuiasConFiltros({
        desde: desde as string,
        hasta: hasta as string,
        estado: estado as string,
        punto_atencion_id: punto_atencion_id as string,
        usuario_id,
      });

      // Transformar datos para el frontend
      const guiasTransformadas = guias.map((guia) => ({
        id: guia.id,
        numero_guia: guia.numero_guia,
        created_at: guia.created_at, // Mantener el nombre original para compatibilidad
        fecha_creacion: guia.created_at,
        estado: guia.estado,
        punto_atencion_id: guia.punto_atencion_id || "",
        punto_atencion_nombre: guia.punto_atencion?.nombre || "N/A",
        // Agencia desde la que se realizó la guía
        agencia_codigo: guia.agencia_codigo || guia.punto_atencion?.servientrega_agencia_codigo || "N/A",
        agencia_nombre: guia.agencia_nombre || guia.punto_atencion?.servientrega_agencia_nombre || "N/A",
        alianza: guia.punto_atencion?.servientrega_alianza || "N/A",
        oficina_alianza: guia.punto_atencion?.servientrega_oficina_alianza || "N/A",
        // Ciudad de origen (del punto de atención)
        ciudad_origen: guia.punto_atencion?.ciudad || "N/A",
        provincia_origen: guia.punto_atencion?.provincia || "N/A",
        // Ciudad de destino (del destinatario)
        ciudad_destino: guia.destinatario?.ciudad || "N/A",
        provincia_destino: guia.destinatario?.provincia || "N/A",
        // Remitente
        remitente_nombre: guia.remitente?.nombre || "N/A",
        remitente_cedula: guia.remitente?.cedula || "N/A",
        remitente_telefono: guia.remitente?.telefono || "N/A",
        remitente_direccion: guia.remitente?.direccion || "N/A",
        // Destinatario
        destinatario_nombre: guia.destinatario?.nombre || "N/A",
        destinatario_telefono: guia.destinatario?.telefono || "N/A",
        destinatario_direccion: guia.destinatario?.direccion || "N/A",
        // Valores
        valor_declarado: parseFloat(guia.valor_declarado?.toString() || "0"),
        costo_envio: parseFloat(guia.costo_envio?.toString() || "0"),
        valor_cobrado: parseFloat(guia.costo_envio?.toString() || "0"), // Valor que se cobró por la guía
        tiene_pdf: true,
        // Usuario que generó la guía
        usuario_nombre: guia.usuario?.nombre || "N/A",
      }));

      res.json({
        data: guiasTransformadas,
        success: true,
      });
    } catch (error) {
      console.error("❌ Error al obtener informes de guías:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// GET /api/servientrega/informes/guias/:id/pdf
router.get(
  "/informes/guias/:id/pdf",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;

      const guia = await prisma.servientregaGuia.findFirst({
        where: {
          id,
          ...buildGuideAccessWhere(req),
        },
        select: {
          id: true,
          numero_guia: true,
          base64_response: true,
        },
      });

      if (!guia) {
        return res.status(404).json({
          error: "Guía no encontrada",
          message: "No existe la guía solicitada o no tiene permisos para verla",
        });
      }

      if (!guia.base64_response) {
        return res.status(404).json({
          error: "PDF no disponible",
          message: "La guía no tiene PDF almacenado",
        });
      }

      return res.json({
        success: true,
        data: {
          id: guia.id,
          numero_guia: guia.numero_guia,
          pdf_base64: guia.base64_response,
        },
      });
    } catch (error) {
      console.error("❌ Error al obtener PDF de la guía:", error);
      return res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// GET /api/servientrega/informes/estadisticas
router.get(
  "/informes/estadisticas",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { desde, hasta, estado, punto_atencion_id } = req.query;

      console.log("📊 Obteniendo estadísticas de guías:", {
        desde,
        hasta,
        estado,
        punto_atencion_id,
      });

      const estadisticas = await dbService.obtenerEstadisticasGuias({
        desde: desde as string,
        hasta: hasta as string,
        estado: estado as string,
        punto_atencion_id: punto_atencion_id as string,
      });

      res.json({
        data: estadisticas,
        success: true,
      });
    } catch (error) {
      console.error("❌ Error al obtener estadísticas:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// GET /api/servientrega/informes/exportar
router.get(
  "/informes/exportar",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { desde, hasta, estado, punto_atencion_id } = req.query;
      const rol = req.user?.rol;
      const usuario_id = rol === "OPERADOR" ? req.user?.id : undefined;

      console.log("📥 Exportando informes de guías:", {
        desde,
        hasta,
        estado,
        punto_atencion_id,
        usuario_id,
        rol,
      });

      // Obtener guías
      const guias = await dbService.obtenerGuiasConFiltros({
        desde: desde as string,
        hasta: hasta as string,
        estado: estado as string,
        punto_atencion_id: punto_atencion_id as string,
        usuario_id,
      });

      // Crear archivo Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Informes Servientrega");

      // Configurar columnas
      worksheet.columns = [
        { header: "Número de Guía", key: "numero_guia", width: 15 },
        { header: "Fecha Creación", key: "fecha_creacion", width: 20 },
        { header: "Estado", key: "estado", width: 15 },
        { header: "Punto de Atención", key: "punto_atencion", width: 25 },
        { header: "Agencia Código", key: "agencia_codigo", width: 15 },
        { header: "Agencia Nombre", key: "agencia_nombre", width: 25 },
        { header: "Ciudad Origen", key: "ciudad_origen", width: 20 },
        { header: "Provincia Origen", key: "provincia_origen", width: 20 },
        { header: "Remitente", key: "remitente_nombre", width: 30 },
        { header: "Cédula Remitente", key: "remitente_cedula", width: 15 },
        { header: "Teléfono Remitente", key: "remitente_telefono", width: 18 },
        { header: "Ciudad Destino", key: "ciudad_destino", width: 20 },
        { header: "Provincia Destino", key: "provincia_destino", width: 20 },
        { header: "Destinatario", key: "destinatario_nombre", width: 30 },
        { header: "Teléfono", key: "destinatario_telefono", width: 15 },
        { header: "Dirección", key: "destinatario_direccion", width: 40 },
        { header: "Valor Declarado", key: "valor_declarado", width: 15 },
        { header: "Costo Envío", key: "costo_envio", width: 15 },
        { header: "Valor Cobrado", key: "valor_cobrado", width: 15 },
        { header: "Usuario", key: "usuario_nombre", width: 25 },
      ];

      // Agregar datos
      guias.forEach((guia) => {
        worksheet.addRow({
          numero_guia: guia.numero_guia,
          fecha_creacion: format(
            new Date(guia.created_at),
            "dd/MM/yyyy HH:mm",
            {
              locale: es,
            }
          ),
          estado: guia.estado,
          punto_atencion: guia.punto_atencion?.nombre || "N/A",
          agencia_codigo: guia.agencia_codigo || guia.punto_atencion?.servientrega_agencia_codigo || "N/A",
          agencia_nombre: guia.agencia_nombre || guia.punto_atencion?.servientrega_agencia_nombre || "N/A",
          ciudad_origen: guia.punto_atencion?.ciudad || "N/A",
          provincia_origen: guia.punto_atencion?.provincia || "N/A",
          remitente_nombre: guia.remitente?.nombre || "N/A",
          remitente_cedula: guia.remitente?.cedula || "N/A",
          remitente_telefono: guia.remitente?.telefono || "N/A",
          ciudad_destino: guia.destinatario?.ciudad || "N/A",
          provincia_destino: guia.destinatario?.provincia || "N/A",
          destinatario_nombre: guia.destinatario?.nombre || "N/A",
          destinatario_telefono: guia.destinatario?.telefono || "N/A",
          destinatario_direccion: guia.destinatario?.direccion || "N/A",
          valor_declarado: parseFloat(guia.valor_declarado?.toString() || "0"),
          costo_envio: parseFloat(guia.costo_envio?.toString() || "0"),
          valor_cobrado: parseFloat(guia.costo_envio?.toString() || "0"),
          usuario_nombre: guia.usuario?.nombre || "N/A",
        });
      });

      // Estilizar encabezados
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      // Configurar respuesta
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=informe_servientrega_${desde}_${hasta}.xlsx`
      );

      // Enviar archivo
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("❌ Error al exportar informes:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// Función auxiliar para mapear estados
function mapearEstadoGuia(proceso: string): string {
  switch (proceso?.toLowerCase()) {
    case "anulada":
      return "ANULADA";
    case "pendiente_anulacion":
      return "PENDIENTE_ANULACION";
    default:
      return "ACTIVA";
  }
}

// GET /api/servientrega/informes/saldos-recargas
// Informe completo de saldos, recargas y solicitudes de Servientrega
router.get(
  "/informes/saldos-recargas",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { punto_atencion_id } = req.query;

      console.log("📊 Obteniendo informe de saldos y recargas:", {
        punto_atencion_id,
      });

      const usdId = await ensureUsdMonedaId();

      // 1. Obtener saldos actuales de todos los puntos o un punto específico
      const saldosWhere = punto_atencion_id
        ? { punto_atencion_id: punto_atencion_id as string, servicio: ServicioExterno.SERVIENTREGA, moneda_id: usdId }
        : { servicio: ServicioExterno.SERVIENTREGA, moneda_id: usdId };

      const saldosActuales = await prisma.servicioExternoSaldo.findMany({
        where: saldosWhere,
        include: {
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
              ciudad: true,
              provincia: true,
            },
          },
        },
      });

      // 2. Obtener historial de asignaciones (incluye iniciales y recargas)
      const asignacionesWhere: any = {
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: usdId,
      };
      if (punto_atencion_id) {
        asignacionesWhere.punto_atencion_id = punto_atencion_id as string;
      }

      const asignacionesHistoricasRaw = await prisma.servicioExternoAsignacion.findMany({
        where: asignacionesWhere,
        include: {
          puntoAtencion: {
            select: {
              id: true,
              nombre: true,
              ciudad: true,
            },
          },
          usuarioAsignador: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
        },
        orderBy: { fecha: "asc" },
      });

      const asignacionesHistoricas = buildServientregaAssignmentReport(
        asignacionesHistoricasRaw,
        saldosActuales
      );

      const recargas = [...asignacionesHistoricas].sort(
        (a, b) => new Date(b.fecha_asignacion).getTime() - new Date(a.fecha_asignacion).getTime()
      );

      // 3. Obtener solicitudes de saldo con información del operador y administrador
      const solicitudesWhere: any = {};
      if (punto_atencion_id) {
        solicitudesWhere.punto_atencion_id = punto_atencion_id as string;
      }

      const solicitudes = await prisma.servientregaSolicitudSaldo.findMany({
        where: solicitudesWhere,
        include: {
          punto_atencion: {
            select: {
              id: true,
              nombre: true,
              ciudad: true,
            },
          },
        },
        orderBy: { creado_en: "desc" },
      });

      // Enriquecer solicitudes con información del administrador que aprobó/rechazó
      const solicitudesEnriquecidas = await Promise.all(
        solicitudes.map(async (solicitud) => {
          let adminAprobador = null;
          if (solicitud.aprobado_por) {
            adminAprobador = await prisma.usuario.findUnique({
              where: { id: solicitud.aprobado_por },
              select: {
                id: true,
                nombre: true,
                username: true,
              },
            });
          }

          return {
            ...solicitud,
            monto_requerido: parseFloat(solicitud.monto_requerido.toString()),
            admin_aprobador: adminAprobador,
          };
        })
      );

      // 4. Calcular totales por estado
      const totalSolicitudes = solicitudes.length;
      const solicitudesPendientes = solicitudes.filter((s) => s.estado === "PENDIENTE").length;
      const solicitudesAprobadas = solicitudes.filter((s) => s.estado === "APROBADA").length;
      const solicitudesRechazadas = solicitudes.filter((s) => s.estado === "RECHAZADA").length;

      // 5. Calcular totales de recargas
      const totalRecargas = asignacionesHistoricas.reduce(
        (acc, assignment) => acc + assignment.valor_asignado,
        0
      );

      // 6. Calcular saldo total disponible
      const saldoTotalDisponible = saldosActuales.reduce(
        (acc, s) => acc + parseFloat(s.cantidad.toString()),
        0
      );

      res.json({
        success: true,
        data: {
          // Saldos actuales por punto
          saldos_actuales: saldosActuales.map((s) => ({
            punto_id: s.punto_atencion_id,
            punto_nombre: s.puntoAtencion?.nombre || "N/A",
            punto_ciudad: s.puntoAtencion?.ciudad || "N/A",
            saldo_disponible: parseFloat(s.cantidad.toString()),
            billetes: parseFloat(s.billetes.toString()),
            monedas_fisicas: parseFloat(s.monedas_fisicas.toString()),
            bancos: parseFloat(s.bancos.toString()),
            updated_at: s.updated_at,
          })),
          // Resumen de saldos
          resumen_saldos: {
            total_puntos: saldosActuales.length,
            saldo_total_disponible: saldoTotalDisponible,
          },
          // Historial de recargas
          recargas: recargas.map((r) => ({
            id: r.id,
            punto_id: r.punto_id,
            punto_nombre: r.punto_nombre,
            punto_ciudad: r.punto_ciudad,
            monto: r.valor_asignado,
            tipo: r.tipo,
            observaciones: r.observaciones,
            fecha: r.fecha_asignacion,
            asignado_por: r.asignado_por,
          })),
          asignaciones_historicas: recargas,
          // Resumen de recargas
          resumen_recargas: {
            total_recargas: asignacionesHistoricas.length,
            monto_total_recargas: totalRecargas,
          },
          resumen_asignaciones: {
            total_asignaciones: asignacionesHistoricas.length,
            monto_total_asignado: totalRecargas,
          },
          // Solicitudes de saldo
          solicitudes: solicitudesEnriquecidas.map((s) => ({
            id: s.id,
            punto_id: s.punto_atencion_id,
            punto_nombre: s.punto_atencion?.nombre || "N/A",
            punto_ciudad: s.punto_atencion?.ciudad || "N/A",
            monto_solicitado: s.monto_requerido,
            estado: s.estado,
            observaciones: s.observaciones,
            fecha_solicitud: s.creado_en,
            fecha_respuesta: s.aprobado_en,
            // Operador que solicitó (no tenemos el usuario directamente, pero podemos inferir del punto)
            operador_solicitante: "Operador del punto", // Se puede mejorar si se guarda el usuario
            // Administrador que aprobó/rechazó
            admin_aprobador: s.admin_aprobador?.nombre || s.admin_aprobador?.username || null,
          })),
          // Resumen de solicitudes
          resumen_solicitudes: {
            total_solicitudes: totalSolicitudes,
            pendientes: solicitudesPendientes,
            aprobadas: solicitudesAprobadas,
            rechazadas: solicitudesRechazadas,
          },
        },
      });
    } catch (error) {
      console.error("❌ Error al obtener informe de saldos y recargas:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// GET /api/servientrega/informes/exportar-saldos-recargas
// Exportar informe de saldos y recargas a Excel
router.get(
  "/informes/exportar-saldos-recargas",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { punto_atencion_id } = req.query;

      console.log("📥 Exportando informe de saldos y recargas:", {
        punto_atencion_id,
      });

      const usdId = await ensureUsdMonedaId();

      // Obtener datos (similar al endpoint anterior)
      const saldosWhere = punto_atencion_id
        ? { punto_atencion_id: punto_atencion_id as string, servicio: ServicioExterno.SERVIENTREGA, moneda_id: usdId }
        : { servicio: ServicioExterno.SERVIENTREGA, moneda_id: usdId };

      const [saldosActuales, asignacionesHistoricasRaw, solicitudes] = await Promise.all([
        prisma.servicioExternoSaldo.findMany({
          where: saldosWhere,
          include: {
            puntoAtencion: {
              select: { nombre: true, ciudad: true, provincia: true },
            },
          },
        }),
        prisma.servicioExternoAsignacion.findMany({
          where: {
            servicio: ServicioExterno.SERVIENTREGA,
            moneda_id: usdId,
            ...(punto_atencion_id ? { punto_atencion_id: punto_atencion_id as string } : {}),
          },
          include: {
            puntoAtencion: { select: { nombre: true, ciudad: true } },
            usuarioAsignador: { select: { nombre: true, username: true } },
          },
          orderBy: { fecha: "asc" },
        }),
        prisma.servientregaSolicitudSaldo.findMany({
          where: punto_atencion_id ? { punto_atencion_id: punto_atencion_id as string } : {},
          include: {
            punto_atencion: { select: { nombre: true, ciudad: true } },
          },
          orderBy: { creado_en: "desc" },
        }),
      ]);

      const asignacionesHistoricas = buildServientregaAssignmentReport(
        asignacionesHistoricasRaw,
        saldosActuales
      );

      // Crear archivo Excel
      const workbook = new ExcelJS.Workbook();

      // Hoja 1: Resumen de Saldos
      const wsSaldos = workbook.addWorksheet("Saldos Actuales");
      wsSaldos.columns = [
        { header: "Punto de Atención", key: "punto", width: 30 },
        { header: "Ciudad", key: "ciudad", width: 20 },
        { header: "Saldo Disponible", key: "saldo", width: 18 },
        { header: "Billetes", key: "billetes", width: 15 },
        { header: "Monedas", key: "monedas", width: 15 },
        { header: "Bancos", key: "bancos", width: 15 },
        { header: "Última Actualización", key: "updated", width: 22 },
      ];

      saldosActuales.forEach((s) => {
        wsSaldos.addRow({
          punto: s.puntoAtencion?.nombre || "N/A",
          ciudad: s.puntoAtencion?.ciudad || "N/A",
          saldo: parseFloat(s.cantidad.toString()),
          billetes: parseFloat(s.billetes.toString()),
          monedas: parseFloat(s.monedas_fisicas.toString()),
          bancos: parseFloat(s.bancos.toString()),
          updated: format(new Date(s.updated_at), "dd/MM/yyyy HH:mm", { locale: es }),
        });
      });

      // Hoja 2: Asignaciones históricas
      const wsAsignaciones = workbook.addWorksheet("Asignaciones Historicas");
      wsAsignaciones.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 30 },
        { header: "Ciudad", key: "ciudad", width: 20 },
        { header: "Valor Asignado", key: "monto", width: 15 },
        { header: "Valor Total", key: "valor_total", width: 15 },
        { header: "Saldo al Reporte", key: "saldo_reporte", width: 18 },
        { header: "Tipo", key: "tipo", width: 15 },
        { header: "Asignado Por", key: "asignado_por", width: 25 },
        { header: "Observaciones", key: "observaciones", width: 40 },
      ];

      asignacionesHistoricas.forEach((r) => {
        wsAsignaciones.addRow({
          fecha: format(new Date(r.fecha_asignacion), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: r.punto_nombre,
          ciudad: r.punto_ciudad,
          monto: r.valor_asignado,
          valor_total: r.valor_total,
          saldo_reporte: r.saldo_actual_reporte,
          tipo: r.tipo,
          asignado_por: r.asignado_por,
          observaciones: r.observaciones || "",
        });
      });

      // Hoja 3: Historial resumido de recargas para compatibilidad
      const wsRecargas = workbook.addWorksheet("Historial Recargas");
      wsRecargas.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 30 },
        { header: "Ciudad", key: "ciudad", width: 20 },
        { header: "Monto", key: "monto", width: 15 },
        { header: "Tipo", key: "tipo", width: 15 },
        { header: "Asignado Por", key: "asignado_por", width: 25 },
        { header: "Observaciones", key: "observaciones", width: 40 },
      ];

      [...asignacionesHistoricas]
        .sort((a, b) => new Date(b.fecha_asignacion).getTime() - new Date(a.fecha_asignacion).getTime())
        .forEach((r) => {
          wsRecargas.addRow({
            fecha: format(new Date(r.fecha_asignacion), "dd/MM/yyyy HH:mm", { locale: es }),
            punto: r.punto_nombre,
            ciudad: r.punto_ciudad,
            monto: r.valor_asignado,
            tipo: r.tipo,
            asignado_por: r.asignado_por,
            observaciones: r.observaciones || "",
          });
        });

      // Hoja 4: Solicitudes de Saldo
      const wsSolicitudes = workbook.addWorksheet("Solicitudes de Saldo");
      wsSolicitudes.columns = [
        { header: "Fecha Solicitud", key: "fecha_solicitud", width: 20 },
        { header: "Punto de Atención", key: "punto", width: 30 },
        { header: "Ciudad", key: "ciudad", width: 20 },
        { header: "Monto Solicitado", key: "monto", width: 18 },
        { header: "Estado", key: "estado", width: 15 },
        { header: "Fecha Respuesta", key: "fecha_respuesta", width: 20 },
        { header: "Admin Aprobador", key: "admin", width: 25 },
        { header: "Observaciones", key: "observaciones", width: 40 },
      ];

      // Enriquecer solicitudes con admin
      const solicitudesEnriquecidas = await Promise.all(
        solicitudes.map(async (s) => {
          let adminAprobador = null;
          if (s.aprobado_por) {
            adminAprobador = await prisma.usuario.findUnique({
              where: { id: s.aprobado_por },
              select: { nombre: true, username: true },
            });
          }
          return { solicitud: s, admin: adminAprobador };
        })
      );

      solicitudesEnriquecidas.forEach(({ solicitud: s, admin }) => {
        wsSolicitudes.addRow({
          fecha_solicitud: format(new Date(s.creado_en), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: s.punto_atencion?.nombre || "N/A",
          ciudad: s.punto_atencion?.ciudad || "N/A",
          monto: parseFloat(s.monto_requerido.toString()),
          estado: s.estado,
          fecha_respuesta: s.aprobado_en
            ? format(new Date(s.aprobado_en), "dd/MM/yyyy HH:mm", { locale: es })
            : "-",
          admin: admin?.nombre || admin?.username || "-",
          observaciones: s.observaciones || "",
        });
      });

      // Estilizar encabezados
      [wsSaldos, wsAsignaciones, wsRecargas, wsSolicitudes].forEach((ws) => {
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE6E6FA" },
        };
      });

      // Configurar respuesta
      const fechaActual = format(new Date(), "yyyy-MM-dd");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=informe_saldos_servientrega_${fechaActual}.xlsx`
      );

      // Enviar archivo
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("❌ Error al exportar informe de saldos:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// GET /api/servientrega/informes/saldo-detalle
// Informe detallado de saldos por guía, agrupado por usuario
router.get(
  "/informes/saldo-detalle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { desde, hasta, punto_atencion_id, usuario_id } = req.query;
      const rol = req.user?.rol;

      console.log("📊 Obteniendo informe de saldo detalle:", {
        desde,
        hasta,
        punto_atencion_id,
        usuario_id,
        rol,
      });

      // Construir where base
      const where: Prisma.ServientregaGuiaWhereInput = {};

      // Filtro de fechas
      if (desde || hasta) {
        const createdAt: Prisma.DateTimeFilter = {};
        if (desde) {
          const { gte: desdeDate } = gyeDayRangeUtcFromDateOnly(desde as string);
          createdAt.gte = desdeDate;
        }
        if (hasta) {
          const { lt: hastaDate } = gyeDayRangeUtcFromDateOnly(hasta as string);
          createdAt.lte = hastaDate;
        }
        where.created_at = createdAt;
      }

      // Filtro por punto
      if (punto_atencion_id && punto_atencion_id !== "TODOS") {
        where.punto_atencion_id = punto_atencion_id as string;
      }

      // Filtro por usuario
      if (usuario_id && usuario_id !== "TODOS") {
        where.usuario_id = usuario_id as string;
      }

      // Restricción por rol
      if (rol === "OPERADOR" || rol === "CONCESION") {
        where.punto_atencion_id = req.user?.punto_atencion_id || "__NO_ACCESS__";
      }

      // Obtener guías con sus relaciones
      const guias = await prisma.servientregaGuia.findMany({
        where,
        select: {
          id: true,
          numero_guia: true,
          created_at: true,
          costo_envio: true,
          saldo_anterior: true,
          saldo_nuevo: true,
          estado: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              username: true,
            },
          },
          punto_atencion: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: [{ usuario_id: "asc" }, { created_at: "asc" }],
      });

      // Obtener saldos actuales de ServicioExternoSaldo por punto
      const usdId = await ensureUsdMonedaId();
      const saldosActuales = await prisma.servicioExternoSaldo.findMany({
        where: {
          servicio: ServicioExterno.SERVIENTREGA,
          moneda_id: usdId,
        },
        select: {
          punto_atencion_id: true,
          cantidad: true,
        },
      });
      const saldoPorPunto = new Map(
        saldosActuales.map((s) => [
          s.punto_atencion_id,
          parseFloat(s.cantidad.toString()),
        ])
      );

      // Agrupar por usuario
      const gruposMap = new Map<
        string,
        {
          usuario_id: string;
          usuario_nombre: string;
          punto_id: string;
          punto_nombre: string;
          guias: Array<{
            id: string;
            fecha: string;
            numero_guia: string;
            costo_envio: number;
            saldo_anterior: number | null;
            saldo_nuevo: number | null;
            estado: string;
          }>;
        }
      >();

      for (const guia of guias) {
        const uid = guia.usuario?.id || "SIN_USUARIO";
        const nombre = guia.usuario?.nombre || guia.usuario?.username || "Sin usuario";
        const pid = guia.punto_atencion?.id || "SIN_PUNTO";
        const pnombre = guia.punto_atencion?.nombre || "Sin punto";

        if (!gruposMap.has(uid)) {
          gruposMap.set(uid, {
            usuario_id: uid,
            usuario_nombre: nombre,
            punto_id: pid,
            punto_nombre: pnombre,
            guias: [],
          });
        }

        const grupo = gruposMap.get(uid)!;
        grupo.guias.push({
          id: guia.id,
          fecha: format(new Date(guia.created_at), "dd/MM/yyyy HH:mm", { locale: es }),
          numero_guia: guia.numero_guia,
          costo_envio: parseFloat(guia.costo_envio?.toString() || "0"),
          saldo_anterior: guia.saldo_anterior ? parseFloat(guia.saldo_anterior.toString()) : null,
          saldo_nuevo: guia.saldo_nuevo ? parseFloat(guia.saldo_nuevo.toString()) : null,
          estado: guia.estado,
        });
      }

      const grupos = Array.from(gruposMap.values()).map((g) => {
        const cantidad = g.guias.length;
        const totalCosto = g.guias.reduce((sum, gui) => sum + gui.costo_envio, 0);
        const saldoActualPunto = saldoPorPunto.get(g.punto_id) || 0;
        const ultimoSaldoNuevo =
          g.guias.length > 0 ? g.guias[g.guias.length - 1].saldo_nuevo : null;

        return {
          ...g,
          cantidad_guias: cantidad,
          total_costo_guias: totalCosto,
          saldo_actual_punto: saldoActualPunto,
          ultimo_saldo_nuevo: ultimoSaldoNuevo,
        };
      });

      // Resumen global
      const totalGuias = guias.length;
      const totalCostoGlobal = grupos.reduce((s, g) => s + g.total_costo_guias, 0);

      res.json({
        success: true,
        data: {
          grupos,
          resumen: {
            total_guias: totalGuias,
            total_costo: totalCostoGlobal,
            total_operadores: grupos.length,
          },
        },
      });
    } catch (error) {
      console.error("❌ Error al obtener informe de saldo detalle:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

// GET /api/servientrega/informes/exportar-saldo-detalle
// Exportar informe detallado de saldos a Excel
router.get(
  "/informes/exportar-saldo-detalle",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO", "ADMINISTRATIVO", "OPERADOR", "CONCESION"]),
  async (req: express.Request, res: express.Response) => {
    try {
      const { desde, hasta, punto_atencion_id, usuario_id } = req.query;
      const rol = req.user?.rol;

      // Construir where base (misma lógica que saldo-detalle)
      const where: Prisma.ServientregaGuiaWhereInput = {};
      if (desde || hasta) {
        const createdAt: Prisma.DateTimeFilter = {};
        if (desde) {
          const { gte: desdeDate } = gyeDayRangeUtcFromDateOnly(desde as string);
          createdAt.gte = desdeDate;
        }
        if (hasta) {
          const { lt: hastaDate } = gyeDayRangeUtcFromDateOnly(hasta as string);
          createdAt.lte = hastaDate;
        }
        where.created_at = createdAt;
      }
      if (punto_atencion_id && punto_atencion_id !== "TODOS") {
        where.punto_atencion_id = punto_atencion_id as string;
      }
      if (usuario_id && usuario_id !== "TODOS") {
        where.usuario_id = usuario_id as string;
      }
      if (rol === "OPERADOR" || rol === "CONCESION") {
        where.punto_atencion_id = req.user?.punto_atencion_id || "__NO_ACCESS__";
      }

      const guias = await prisma.servientregaGuia.findMany({
        where,
        select: {
          id: true,
          numero_guia: true,
          created_at: true,
          costo_envio: true,
          saldo_anterior: true,
          saldo_nuevo: true,
          estado: true,
          usuario: { select: { id: true, nombre: true, username: true } },
          punto_atencion: { select: { id: true, nombre: true } },
        },
        orderBy: [{ usuario_id: "asc" }, { created_at: "asc" }],
      });

      // Crear Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Saldo Detalle Servientrega");

      // Columnas
      worksheet.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Usuario", key: "usuario", width: 28 },
        { header: "Guía", key: "guia", width: 18 },
        { header: "Saldo Actual", key: "saldo_actual", width: 16 },
        { header: "Costo Guía", key: "costo", width: 14 },
        { header: "Estado Anterior", key: "estado_anterior", width: 16 },
        { header: "Estado Nuevo", key: "estado_nuevo", width: 16 },
        { header: "Punto de Atención", key: "punto", width: 25 },
        { header: "Estado Guía", key: "estado_guia", width: 14 },
      ];

      // Agrupar por usuario para insertar filas de subtotal
      const grupos = new Map<string, typeof guias>();
      for (const g of guias) {
        const uid = g.usuario?.id || "SIN_USUARIO";
        if (!grupos.has(uid)) grupos.set(uid, []);
        grupos.get(uid)!.push(g);
      }

      let rowIndex = 2; // después del header

      for (const [, grupoGuias] of grupos) {
        const usuarioNombre =
          grupoGuias[0]?.usuario?.nombre ||
          grupoGuias[0]?.usuario?.username ||
          "Sin usuario";
        const puntoNombre = grupoGuias[0]?.punto_atencion?.nombre || "Sin punto";

        // Calcular subtotales del grupo
        const totalCosto = grupoGuias.reduce(
          (s, g) => s + parseFloat(g.costo_envio?.toString() || "0"),
          0
        );
        const ultimoSaldoNuevo =
          grupoGuias[grupoGuias.length - 1]?.saldo_nuevo;
        const saldoSubtotal = ultimoSaldoNuevo
          ? parseFloat(ultimoSaldoNuevo.toString())
          : null;

        // Fila de encabezado de grupo
        const grupoRow = worksheet.addRow({
          fecha: "",
          usuario: `${usuarioNombre} (${grupoGuias.length})`,
          guia: "",
          saldo_actual: saldoSubtotal ?? 0,
          costo: totalCosto,
          estado_anterior: null,
          estado_nuevo: null,
          punto: puntoNombre,
          estado_guia: "",
        });
        grupoRow.font = { bold: true };
        grupoRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        rowIndex++;

        // Filas de detalle
        for (const guia of grupoGuias) {
          worksheet.addRow({
            fecha: format(new Date(guia.created_at), "dd/MM/yyyy HH:mm", { locale: es }),
            usuario: usuarioNombre,
            guia: guia.numero_guia,
            saldo_actual: parseFloat(guia.saldo_nuevo?.toString() || "0"),
            costo: parseFloat(guia.costo_envio?.toString() || "0"),
            estado_anterior: guia.saldo_anterior
              ? parseFloat(guia.saldo_anterior.toString())
              : null,
            estado_nuevo: guia.saldo_nuevo
              ? parseFloat(guia.saldo_nuevo.toString())
              : null,
            punto: puntoNombre,
            estado_guia: guia.estado,
          });
          rowIndex++;
        }

        // Fila en blanco entre grupos
        worksheet.addRow({});
        rowIndex++;
      }

      // Estilizar encabezado
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6E6FA" },
      };

      // Formato numérico para columnas de saldo
      for (let i = 2; i <= rowIndex; i++) {
        const row = worksheet.getRow(i);
        [4, 5, 6, 7].forEach((col) => {
          const cell = row.getCell(col);
          if (typeof cell.value === "number") {
            cell.numFmt = '#,##0.00';
          }
        });
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const fileName = `informe_saldo_detalle_servientrega_${desde || "todo"}_${hasta || "todo"}.xlsx`;
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("❌ Error al exportar saldo detalle:", error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export { router as informesRouter };
