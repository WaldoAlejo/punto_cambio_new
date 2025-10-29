import { apiService } from "./apiService";
import { Agencia, ApiResponse } from "../types";

type RawAgencia = Partial<{
  agencia: string;
  nombre: string;
  tipo_cs: string;
  direccion: string;
  ciudad: string;
  Codigo_Establecimiento: string;
}> &
  Record<string, unknown>;

// ⬇️ Nota: quitamos 'success' de ApiResponse y lo redeclaramos opcional aquí
interface AgenciasResponse extends Omit<ApiResponse, "success"> {
  success?: boolean;
  error?: string;
  data?: RawAgencia[];
  fetch?: RawAgencia[];
  agencias?: RawAgencia[];
  // algunos endpoints devuelven array plano
  0?: unknown;
}

function toAgencia(raw: RawAgencia): Agencia {
  const nombre = String(raw.agencia ?? raw.nombre ?? "").trim();
  const tipo_cs = String(raw.tipo_cs ?? "").trim();
  const direccion = String(raw.direccion ?? "").trim();
  const ciudad = String(raw.ciudad ?? "").trim();
  const codigo_establecimiento = String(
    raw.Codigo_Establecimiento ?? ""
  ).trim();
  const agencia = String(raw.agencia ?? "").trim();
  return {
    nombre,
    tipo_cs,
    direccion,
    ciudad,
    codigo_establecimiento,
    agencia,
  };
}

function dedupeAndSort(agencias: Agencia[]): Agencia[] {
  const seen = new Set<string>();
  const out: Agencia[] = [];
  for (const a of agencias) {
    const key = `${a.nombre.toUpperCase()}|${a.ciudad.toUpperCase()}`;
    if (!seen.has(key) && a.nombre) {
      seen.add(key);
      out.push(a);
    }
  }
  out.sort((a, b) => {
    const c = a.ciudad.localeCompare(b.ciudad, "es", { sensitivity: "base" });
    return c !== 0
      ? c
      : a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });
  return out;
}

export const servientregaService = {
  async getAgencias(): Promise<{ agencias: Agencia[]; error: string | null }> {
    try {
      const response = await apiService.post<AgenciasResponse>(
        "/servientrega/agencias",
        {}
      );

      if (!response) {
        return { agencias: [], error: "Respuesta vacía del servidor" };
      }

      if (response.success === false) {
        return {
          agencias: [],
          error: response.error || "Error al obtener agencias de Servientrega",
        };
      }

      let raw: RawAgencia[] = [];

      if (Array.isArray(response as unknown as unknown[])) {
        raw = response as unknown as RawAgencia[];
      } else if (Array.isArray(response.data)) {
        raw = response.data;
      } else if (Array.isArray(response.fetch)) {
        raw = response.fetch;
      } else if (Array.isArray(response.agencias)) {
        raw = response.agencias;
      } else {
        const candidate = Object.values(response).find(
          (v) => Array.isArray(v) && (v as unknown[]).length > 0
        );
        if (candidate) raw = candidate as RawAgencia[];
      }

      if (!raw.length) return { agencias: [], error: null };

      const agencias = dedupeAndSort(raw.map(toAgencia));
      return { agencias, error: null };
    } catch (error) {
      let msg = "Error de conexión con el servidor";
      if (error instanceof Error) {
        const m = error.message.toLowerCase();
        if (m.includes("404")) msg = "Servicio de agencias no encontrado";
        else if (m.includes("500"))
          msg = "Error interno del servidor de Servientrega";
        else if (m.includes("timeout"))
          msg = "Timeout al conectar con Servientrega";
        else msg = `Error: ${error.message}`;
      }
      return { agencias: [], error: msg };
    }
  },
};
