import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import prisma from "../../lib/prisma.js";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ServicioExterno } from "@prisma/client";

const router = express.Router();
const dbService = new ServientregaDBService();

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
  async (req: express.Request, res: express.Response) => {
    try {
      const { desde, hasta, estado, punto_atencion_id } = req.query;
      const rol = req.user?.rol;
      // Solo OPERADOR ve sus propias guías. Admin/Super/Administrativo ven todas.
      const usuario_id = rol === "OPERADOR" ? req.user?.id : undefined;

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
        estado: mapearEstadoGuia(guia.proceso),
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
        // Destinatario
        destinatario_nombre: guia.destinatario?.nombre || "N/A",
        destinatario_telefono: guia.destinatario?.telefono || "N/A",
        destinatario_direccion: guia.destinatario?.direccion || "N/A",
        // Valores
        valor_declarado: parseFloat(guia.valor_declarado?.toString() || "0"),
        costo_envio: parseFloat(guia.costo_envio?.toString() || "0"),
        valor_cobrado: parseFloat(guia.costo_envio?.toString() || "0"), // Valor que se cobró por la guía
        base64_response: guia.base64_response || "", // Mantener el nombre original para compatibilidad
        pdf_base64: guia.base64_response || "",
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

// GET /api/servientrega/informes/estadisticas
router.get(
  "/informes/estadisticas",
  authenticateToken,
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
          estado: mapearEstadoGuia(guia.proceso),
          punto_atencion: guia.punto_atencion?.nombre || "N/A",
          agencia_codigo: guia.agencia_codigo || guia.punto_atencion?.servientrega_agencia_codigo || "N/A",
          agencia_nombre: guia.agencia_nombre || guia.punto_atencion?.servientrega_agencia_nombre || "N/A",
          ciudad_origen: guia.punto_atencion?.ciudad || "N/A",
          provincia_origen: guia.punto_atencion?.provincia || "N/A",
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

      // 2. Obtener historial de asignaciones (recargas)
      const asignacionesWhere: any = {
        servicio: ServicioExterno.SERVIENTREGA,
        moneda_id: usdId,
      };
      if (punto_atencion_id) {
        asignacionesWhere.punto_atencion_id = punto_atencion_id as string;
      }

      const recargas = await prisma.servicioExternoAsignacion.findMany({
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
        orderBy: { fecha: "desc" },
      });

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
      const totalRecargas = recargas.reduce((acc, r) => acc + parseFloat(r.monto.toString()), 0);

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
            punto_id: r.punto_atencion_id,
            punto_nombre: r.puntoAtencion?.nombre || "N/A",
            punto_ciudad: r.puntoAtencion?.ciudad || "N/A",
            monto: parseFloat(r.monto.toString()),
            tipo: r.tipo,
            observaciones: r.observaciones,
            fecha: r.fecha,
            asignado_por: r.usuarioAsignador?.nombre || r.usuarioAsignador?.username || "Sistema",
          })),
          // Resumen de recargas
          resumen_recargas: {
            total_recargas: recargas.length,
            monto_total_recargas: totalRecargas,
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

      const [saldosActuales, recargas, solicitudes] = await Promise.all([
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
          orderBy: { fecha: "desc" },
        }),
        prisma.servientregaSolicitudSaldo.findMany({
          where: punto_atencion_id ? { punto_atencion_id: punto_atencion_id as string } : {},
          include: {
            punto_atencion: { select: { nombre: true, ciudad: true } },
          },
          orderBy: { creado_en: "desc" },
        }),
      ]);

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

      // Hoja 2: Historial de Recargas
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

      recargas.forEach((r) => {
        wsRecargas.addRow({
          fecha: format(new Date(r.fecha), "dd/MM/yyyy HH:mm", { locale: es }),
          punto: r.puntoAtencion?.nombre || "N/A",
          ciudad: r.puntoAtencion?.ciudad || "N/A",
          monto: parseFloat(r.monto.toString()),
          tipo: r.tipo,
          asignado_por: r.usuarioAsignador?.nombre || r.usuarioAsignador?.username || "Sistema",
          observaciones: r.observaciones || "",
        });
      });

      // Hoja 3: Solicitudes de Saldo
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
      [wsSaldos, wsRecargas, wsSolicitudes].forEach((ws) => {
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

export { router as informesRouter };
