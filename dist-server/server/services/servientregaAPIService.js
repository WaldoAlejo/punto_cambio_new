import axios from "axios";
import https from "https";
const MAIN_URL = "https://servientrega-ecuador.appsiscore.com/app/ws/aliados/servicore_ws_aliados.php";
const RETAIL_URL = "https://servientrega-ecuador.appsiscore.com/app/ws/serviretail_cs.php";
// Evita problemas de SSL si el proveedor tiene cadenas intermedias raras
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
function isEmptyUpstream(data) {
    if (data === null || data === undefined)
        return true;
    if (typeof data === "string" && data.trim() === "")
        return true;
    if (Array.isArray(data) && data.length === 0)
        return true;
    return false;
}
// 👉 Quita BOM/whitespace y trata de parsear JSON si viene como string
function normalizeUpstream(raw) {
    try {
        if (typeof raw !== "string")
            return raw;
        // quitar BOM UTF-8 y espacios
        const trimmed = raw.replace(/^\uFEFF/, "").trim();
        if (trimmed === "")
            return trimmed;
        const first = trimmed[0];
        if (first === "{" || first === "[") {
            return JSON.parse(trimmed);
        }
        return trimmed;
    }
    catch {
        // si no se puede parsear, devuelvo el original
        return raw;
    }
}
async function doPost(url, payload, mode, timeoutMs) {
    let body;
    let headers;
    if (mode === "json") {
        body = payload;
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "PuntoCambio/1.0",
        };
    }
    else {
        const form = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => form.append(k, String(v)));
        body = form.toString();
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "PuntoCambio/1.0",
        };
    }
    const start = Date.now();
    const res = await axios.post(url, body, {
        headers,
        httpsAgent,
        timeout: timeoutMs,
        validateStatus: (s) => s < 500,
        maxRedirects: 2,
    });
    const ms = Date.now() - start;
    // Logging útil (moderado)
    console.log(`🔗 POST ${url} [${mode}] -> HTTP ${res.status} en ${ms}ms | vacio=${isEmptyUpstream(res.data)}`);
    return res;
}
export class ServientregaAPIService {
    credentials;
    /** Permite sobreescribir la URL main desde fuera (router lee .env y la setea). */
    apiUrl = MAIN_URL;
    constructor(credentials) {
        this.credentials = credentials;
    }
    /**
     * Estrategia robusta para tarifas:
     *  1) MAIN JSON
     *  2) MAIN FORM
     *  3) RETAIL JSON
     *  4) RETAIL FORM
     */
    async calcularTarifa(payload, timeoutMs = 15000) {
        const basePayload = { ...payload, ...this.credentials };
        const attempts = [
            { url: this.apiUrl || MAIN_URL, mode: "json", label: "MAIN JSON" },
            { url: this.apiUrl || MAIN_URL, mode: "form", label: "MAIN FORM" },
            { url: RETAIL_URL, mode: "json", label: "RETAIL JSON" },
            { url: RETAIL_URL, mode: "form", label: "RETAIL FORM" },
        ];
        let lastErr = null;
        for (const att of attempts) {
            try {
                const res = await doPost(att.url, basePayload, att.mode, timeoutMs);
                const data = normalizeUpstream(res.data);
                if (res.status >= 400) {
                    const e = new Error(`HTTP ${res.status} en ${att.label}: ${JSON.stringify(data)}`);
                    e.httpStatus = res.status;
                    e.endpoint = att.url;
                    throw e;
                }
                if (isEmptyUpstream(data)) {
                    console.warn(`⚠️ Respuesta vacía en ${att.label}, probando siguiente...`);
                    lastErr = new Error("UPSTREAM_EMPTY");
                    lastErr.code = "UPSTREAM_EMPTY";
                    lastErr.endpoint = att.url;
                    continue;
                }
                return data;
            }
            catch (err) {
                lastErr = err;
                if (err?.code === "ECONNABORTED" ||
                    err?.code === "UPSTREAM_EMPTY" ||
                    err?.response?.status === 408) {
                    console.warn(`⏳/🈳 ${att.label} falló: ${err?.message || err}`);
                    continue;
                }
                console.warn(`❗ ${att.label} error: ${err?.message || err}`);
                continue;
            }
        }
        const out = new Error(lastErr?.code === "UPSTREAM_EMPTY"
            ? "Proveedor no devolvió datos (tarifa vacía) en todos los endpoints"
            : "Error al conectar con Servientrega");
        out.code = lastErr?.code || "UPSTREAM_FAILURE";
        out.httpStatus = lastErr?.httpStatus || 502;
        throw out;
    }
    // Generación de guía (JSON)
    async generarGuia(payload, timeoutMs = 20000) {
        const url = this.apiUrl || MAIN_URL;
        const full = { tipo: "GeneracionGuia", ...payload, ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        const data = normalizeUpstream(res.data);
        if (isEmptyUpstream(data)) {
            const e = new Error("Respuesta vacía al generar guía");
            e.code = "UPSTREAM_EMPTY";
            e.httpStatus = 502;
            e.endpoint = url;
            throw e;
        }
        return data;
    }
    // Anulación / actualización de estado
    async anularGuia(guia, estado = "Anulada", timeoutMs = 15000) {
        const url = this.apiUrl || MAIN_URL;
        const full = {
            tipo: "ActualizaEstadoGuia",
            guia,
            estado,
            ...this.credentials,
        };
        const res = await doPost(url, full, "json", timeoutMs);
        const data = normalizeUpstream(res.data);
        if (isEmptyUpstream(data)) {
            const e = new Error("Respuesta vacía al anular guía");
            e.code = "UPSTREAM_EMPTY";
            e.httpStatus = 502;
            e.endpoint = url;
            throw e;
        }
        return data;
    }
    // Catálogos (JSON)
    async obtenerProductos(timeoutMs = 10000) {
        const url = this.apiUrl || MAIN_URL;
        const full = { tipo: "obtener_producto", ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        return normalizeUpstream(res.data);
    }
    async obtenerPaises(timeoutMs = 10000) {
        const url = this.apiUrl || MAIN_URL;
        const full = { tipo: "obtener_paises", ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        return normalizeUpstream(res.data);
    }
    async obtenerCiudades(codpais, timeoutMs = 10000) {
        const url = this.apiUrl || MAIN_URL;
        const full = { tipo: "obtener_ciudades", codpais, ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        return normalizeUpstream(res.data);
    }
    async obtenerAgencias(timeoutMs = 10000) {
        const url = this.apiUrl || MAIN_URL;
        const full = { tipo: "obtener_agencias_aliadas", ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        return normalizeUpstream(res.data);
    }
    async obtenerEmpaques(timeoutMs = 10000) {
        const url = this.apiUrl || MAIN_URL;
        const full = { tipo: "obtener_empaqueyembalaje", ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        return normalizeUpstream(res.data);
    }
    // =========================================================
    // 🔁 Compatibilidad: callAPI(payload, timeoutMs?, useRetailUrl?)
    // =========================================================
    async callAPI(payload, timeoutMs = 15000, useRetailUrl = false) {
        const tipo = (payload?.tipo || "").toString();
        if (tipo === "obtener_tarifa_nacional") {
            return this.calcularTarifa(payload, timeoutMs);
        }
        if (tipo === "GeneracionGuia") {
            return this.generarGuia(payload, Math.max(timeoutMs, 20000));
        }
        if (tipo === "ActualizaEstadoGuia" || tipo === "AnulacionGuia") {
            const guia = payload.guia ?? payload?.Guia ?? payload?.numero_guia;
            const estado = payload.estado || "Anulada";
            if (!guia) {
                throw new Error("Falta 'guia' en payload para ActualizaEstadoGuia/AnulacionGuia");
            }
            return this.anularGuia(String(guia), String(estado), timeoutMs);
        }
        if (tipo === "obtener_producto")
            return this.obtenerProductos(timeoutMs);
        if (tipo === "obtener_paises")
            return this.obtenerPaises(timeoutMs);
        if (tipo === "obtener_ciudades") {
            const codpais = Number(payload?.codpais ?? payload?.pais ?? 0);
            if (!codpais)
                throw new Error("Falta 'codpais' para obtener_ciudades");
            return this.obtenerCiudades(codpais, timeoutMs);
        }
        if (tipo === "obtener_agencias_aliadas")
            return this.obtenerAgencias(timeoutMs);
        if (tipo === "obtener_empaqueyembalaje")
            return this.obtenerEmpaques(timeoutMs);
        // Genérico: POST JSON a MAIN o RETAIL (según useRetailUrl)
        const url = useRetailUrl ? RETAIL_URL : this.apiUrl || MAIN_URL;
        const full = { ...payload, ...this.credentials };
        const res = await doPost(url, full, "json", timeoutMs);
        const data = normalizeUpstream(res.data);
        if (isEmptyUpstream(data)) {
            const e = new Error("Respuesta vacía del proveedor");
            e.code = "UPSTREAM_EMPTY";
            e.httpStatus = 502;
            e.endpoint = url;
            throw e;
        }
        return data;
    }
}
