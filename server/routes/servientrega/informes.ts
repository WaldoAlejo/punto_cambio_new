import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import { ServientregaAPIService } from "../../services/servientregaAPIService.js";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const router = express.Router();
const dbService = new ServientregaDBService();

// GET /api/servientrega/informes/guias
router.get("/informes/guias", authenticateToken, async (req, res) => {
  try {
    const { desde, hasta, estado, punto_atencion_id } = req.query;

    console.log("🔍 Obteniendo informes de guías:", {
      desde,
      hasta,
      estado,
      punto_atencion_id,
    });

    // Obtener guías de la base de datos
    const guias = await dbService.obtenerGuiasConFiltros({
      desde: desde as string,
      hasta: hasta as string,
      estado: estado as string,
      punto_atencion_id: punto_atencion_id as string,
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
      destinatario_nombre: guia.destinatario?.nombre || "N/A",
      destinatario_telefono: guia.destinatario?.telefono || "N/A",
      destinatario_direccion: guia.destinatario?.direccion || "N/A",
      valor_declarado: parseFloat(guia.valor_declarado?.toString() || "0"),
      costo_envio: parseFloat(guia.costo_envio?.toString() || "0"),
      base64_response: guia.base64_response || "", // Mantener el nombre original para compatibilidad
      pdf_base64: guia.base64_response || "",
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
});

// GET /api/servientrega/informes/estadisticas
router.get("/informes/estadisticas", authenticateToken, async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    console.log("📊 Obteniendo estadísticas de guías:", { desde, hasta });

    const estadisticas = await dbService.obtenerEstadisticasGuias({
      desde: desde as string,
      hasta: hasta as string,
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
});

// GET /api/servientrega/informes/exportar
router.get("/informes/exportar", authenticateToken, async (req, res) => {
  try {
    const { desde, hasta, estado, punto_atencion_id } = req.query;

    console.log("📥 Exportando informes de guías:", {
      desde,
      hasta,
      estado,
      punto_atencion_id,
    });

    // Obtener guías
    const guias = await dbService.obtenerGuiasConFiltros({
      desde: desde as string,
      hasta: hasta as string,
      estado: estado as string,
      punto_atencion_id: punto_atencion_id as string,
    });

    // Crear archivo Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Informes Servientrega");

    // Configurar columnas
    worksheet.columns = [
      { header: "Número de Guía", key: "numero_guia", width: 15 },
      { header: "Fecha Creación", key: "fecha_creacion", width: 20 },
      { header: "Estado", key: "estado", width: 20 },
      { header: "Punto de Atención", key: "punto_atencion", width: 25 },
      { header: "Destinatario", key: "destinatario_nombre", width: 30 },
      { header: "Teléfono", key: "destinatario_telefono", width: 15 },
      { header: "Dirección", key: "destinatario_direccion", width: 40 },
      { header: "Valor Declarado", key: "valor_declarado", width: 15 },
      { header: "Costo Envío", key: "costo_envio", width: 15 },
    ];

    // Agregar datos
    guias.forEach((guia) => {
      worksheet.addRow({
        numero_guia: guia.numero_guia,
        fecha_creacion: format(new Date(guia.created_at), "dd/MM/yyyy HH:mm", {
          locale: es,
        }),
        estado: mapearEstadoGuia(guia.proceso),
        punto_atencion: guia.punto_atencion?.nombre || "N/A",
        destinatario_nombre: guia.destinatario?.nombre || "N/A",
        destinatario_telefono: guia.destinatario?.telefono || "N/A",
        destinatario_direccion: guia.destinatario?.direccion || "N/A",
        valor_declarado: parseFloat(guia.valor_declarado?.toString() || "0"),
        costo_envio: parseFloat(guia.costo_envio?.toString() || "0"),
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
});

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

export { router as informesRouter };
