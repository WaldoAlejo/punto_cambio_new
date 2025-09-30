import express from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { ServientregaDBService } from "../../services/servientregaDBService.js";
import { ServientregaAPIService, } from "../../services/servientregaAPIService.js";
const router = express.Router();
/* ============================
   Helpers
============================ */
function sendError(res, status, msg, err) {
    console.error(msg, err);
    return res.status(status).json({
        success: false,
        error: msg,
        details: err instanceof Error ? err.message : "Error desconocido",
    });
}
function getCredentialsFromEnv() {
    return {
        usuingreso: process.env.SERVIENTREGA_USER || "PRUEBA",
        contrasenha: process.env.SERVIENTREGA_PASSWORD || "s12345ABCDe",
    };
}
function getApiUrl() {
    return (process.env.SERVIENTREGA_URL ||
        "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php");
}
/* ============================
   👤 Búsqueda de Remitentes y Destinatarios
============================ */
router.get("/remitente/buscar/:cedula", authenticateToken, async (req, res) => {
    try {
        const { cedula } = req.params;
        if (!cedula || cedula.length < 2) {
            return res
                .status(400)
                .json({
                success: false,
                error: "La cédula debe tener al menos 2 caracteres",
            });
        }
        const dbService = new ServientregaDBService();
        const remitentes = await dbService.buscarRemitentes(cedula);
        res.json({ success: true, remitentes });
    }
    catch (error) {
        return sendError(res, 500, "Error al buscar remitente", error);
    }
});
router.get("/destinatario/buscar/:cedula", authenticateToken, async (req, res) => {
    try {
        const { cedula } = req.params;
        if (!cedula || cedula.length < 2) {
            return res
                .status(400)
                .json({
                success: false,
                error: "La cédula debe tener al menos 2 caracteres",
            });
        }
        const dbService = new ServientregaDBService();
        const destinatarios = await dbService.buscarDestinatarios(cedula);
        res.json({ success: true, destinatarios });
    }
    catch (error) {
        return sendError(res, 500, "Error al buscar destinatario", error);
    }
});
router.get("/destinatario/buscar-nombre/:nombre", authenticateToken, async (req, res) => {
    try {
        const { nombre } = req.params;
        if (!nombre || nombre.length < 2) {
            return res
                .status(400)
                .json({
                success: false,
                error: "El nombre debe tener al menos 2 caracteres",
            });
        }
        const dbService = new ServientregaDBService();
        const destinatarios = await dbService.buscarDestinatariosPorNombre(nombre);
        res.json({ success: true, destinatarios });
    }
    catch (error) {
        return sendError(res, 500, "Error al buscar destinatario por nombre", error);
    }
});
/* ============================
   💾 Guardar / Actualizar Remitentes y Destinatarios
============================ */
router.post("/remitente/guardar", authenticateToken, async (req, res) => {
    try {
        const dbService = new ServientregaDBService();
        const remitente = await dbService.guardarRemitente(req.body);
        res.json({
            success: true,
            remitente,
            message: "Remitente guardado correctamente",
        });
    }
    catch (error) {
        return sendError(res, 500, "Error al guardar remitente", error);
    }
});
router.put("/remitente/actualizar/:cedula", authenticateToken, async (req, res) => {
    try {
        const { cedula } = req.params;
        if (!cedula)
            return res
                .status(400)
                .json({ success: false, error: "La cédula es requerida" });
        const dbService = new ServientregaDBService();
        const remitente = await dbService.actualizarRemitente(cedula, req.body);
        res.json({
            success: true,
            remitente,
            message: "Remitente actualizado correctamente",
        });
    }
    catch (error) {
        return sendError(res, 500, "Error al actualizar remitente", error);
    }
});
router.post("/destinatario/guardar", authenticateToken, async (req, res) => {
    try {
        const dbService = new ServientregaDBService();
        const destinatario = await dbService.guardarDestinatario(req.body);
        res.json({
            success: true,
            destinatario,
            message: "Destinatario guardado correctamente",
        });
    }
    catch (error) {
        return sendError(res, 500, "Error al guardar destinatario", error);
    }
});
router.put("/destinatario/actualizar/:cedula", authenticateToken, async (req, res) => {
    try {
        const { cedula } = req.params;
        if (!cedula)
            return res
                .status(400)
                .json({ success: false, error: "La cédula es requerida" });
        const dbService = new ServientregaDBService();
        const destinatario = await dbService.actualizarDestinatario(cedula, req.body);
        res.json({
            success: true,
            destinatario,
            message: "Destinatario actualizado correctamente",
        });
    }
    catch (error) {
        const msg = error instanceof Error && error.message === "Destinatario no encontrado"
            ? "Destinatario no encontrado"
            : "Error al actualizar destinatario";
        const code = msg === "Destinatario no encontrado" ? 404 : 500;
        return sendError(res, code, msg, error);
    }
});
/* ============================
   📍 Puntos de Atención (desde BD)
============================ */
router.get("/remitente/puntos", authenticateToken, async (req, res) => {
    try {
        const dbService = new ServientregaDBService();
        const puntos = await dbService.obtenerPuntosAtencion();
        res.json({ success: true, puntos });
    }
    catch (error) {
        return sendError(res, 500, "Error al obtener puntos de atención", error);
    }
});
/* ============================
   🌎 Países y Ciudades (Servientrega WS con credenciales .env)
============================ */
/**
 * POST /servientrega/paises
 * Body: {}  (no requiere nada)
 * Respuesta: { fetch: [{ codpais, nombrecorto, pais, phone_code }, ...] }
 */
router.post("/paises", authenticateToken, async (_req, res) => {
    try {
        const creds = getCredentialsFromEnv();
        const api = new ServientregaAPIService(creds);
        api.apiUrl = getApiUrl();
        const payload = { tipo: "obtener_paises" }; // sin credenciales en payload
        const result = await api.callAPI(payload);
        const fetch = Array.isArray(result?.fetch) ? result.fetch : [];
        return res.json({ fetch });
    }
    catch (error) {
        return sendError(res, 500, "Error al obtener países", error);
    }
});
/**
 * POST /servientrega/ciudades
 * Body: { codpais: number }
 * Respuesta: { fetch: [{ city: "CIUDAD-PROVINCIA" }, ...] }
 */
router.post("/ciudades", authenticateToken, async (req, res) => {
    try {
        const { codpais } = req.body;
        if (typeof codpais !== "number") {
            return res
                .status(400)
                .json({
                success: false,
                error: "codpais es requerido y debe ser numérico",
            });
        }
        const creds = getCredentialsFromEnv();
        const api = new ServientregaAPIService(creds);
        api.apiUrl = getApiUrl();
        const payload = { tipo: "obtener_ciudades", codpais }; // sin credenciales en payload
        const result = await api.callAPI(payload);
        // Normalizar
        let fetch = [];
        if (Array.isArray(result?.fetch)) {
            fetch = result.fetch
                .map((it) => {
                if (typeof it?.city === "string")
                    return { city: it.city };
                if (it?.ciudad && it?.provincia)
                    return {
                        city: `${String(it.ciudad).toUpperCase()}-${String(it.provincia).toUpperCase()}`,
                    };
                if (typeof it?.ciudad === "string")
                    return { city: String(it.ciudad).toUpperCase() };
                return { city: "" };
            })
                .filter((x) => x.city);
        }
        return res.json({ fetch });
    }
    catch (error) {
        return sendError(res, 500, "Error al obtener ciudades", error);
    }
});
export { router as usersRouter };
