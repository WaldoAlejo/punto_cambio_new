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
  // Intentar múltiples nombres de campo
  const nombre = String(
    raw.agencia ?? raw.nombre ?? raw.agencia_nombre ?? raw["agencia"] ?? ""
  ).trim();

  const tipo_cs = String(
    raw.tipo_cs ?? raw.Codigo_Establecimiento ?? raw.codigo ?? ""
  ).trim();

  const direccion = String(raw.direccion ?? raw.address ?? "").trim();

  const ciudad = String(raw.ciudad ?? raw.city ?? "").trim();

  const codigo_establecimiento = String(
    raw.Codigo_Establecimiento ?? raw.codigo_establecimiento ?? raw.codigo ?? ""
  ).trim();

  const agencia = String(raw.agencia ?? "").trim();

  // Debug: log agencias sin nombre
  if (!nombre) {
    console.warn("⚠️ toAgencia: Raw agencia sin nombre detectada:", raw);
  }

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
        console.error("❌ getAgencias: Respuesta vacía del servidor");
        return { agencias: [], error: "Respuesta vacía del servidor" };
      }

      console.log("📨 getAgencias: Raw response:", response);

      if (response.success === false) {
        console.error(
          "❌ getAgencias: API returned success=false:",
          response.error
        );
        return {
          agencias: [],
          error: response.error || "Error al obtener agencias de Servientrega",
        };
      }

      let raw: RawAgencia[] = [];

      if (Array.isArray(response as unknown as unknown[])) {
        raw = response as unknown as RawAgencia[];
        console.log(
          "✅ getAgencias: Detected direct array, length:",
          raw.length
        );
      } else if (Array.isArray(response.data)) {
        raw = response.data;
        console.log(
          "✅ getAgencias: Found in response.data, length:",
          raw.length
        );
      } else if (Array.isArray(response.fetch)) {
        raw = response.fetch;
        console.log(
          "✅ getAgencias: Found in response.fetch, length:",
          raw.length
        );
      } else if (Array.isArray(response.agencias)) {
        raw = response.agencias;
        console.log(
          "✅ getAgencias: Found in response.agencias, length:",
          raw.length
        );
      } else {
        const candidate = Object.values(response).find(
          (v) => Array.isArray(v) && (v as unknown[]).length > 0
        );
        if (candidate) {
          raw = candidate as RawAgencia[];
          console.log(
            "✅ getAgencias: Found in dynamic key, length:",
            raw.length
          );
        }
      }

      console.log("📊 getAgencias: Raw items before mapping:", raw.slice(0, 2));

      if (!raw.length) {
        console.warn("⚠️ getAgencias: No agencias found after extraction");
        return { agencias: [], error: null };
      }

      const mapped = raw.map(toAgencia);
      console.log(
        "📊 getAgencias: Mapped items before dedup:",
        mapped.slice(0, 2)
      );

      const agencias = dedupeAndSort(mapped);
      console.log(
        "✅ getAgencias: Final agencias after dedup and sort:",
        agencias.length
      );

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
      console.error("❌ getAgencias: Exception:", msg, error);
      return { agencias: [], error: msg };
    }
  },
};
