"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const UMBRAL_SALDO_BAJO = 5;

interface PuntoAtencion {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
}

interface SaldoResponse {
  disponible: number;
}

interface HistorialAsignacion {
  id: string;
  punto_atencion_nombre: string;
  monto_total: number;
  creado_por: string;
  creado_en: string;
}

interface SolicitudSaldo {
  id: string;
  punto_atencion_id: string;
  punto_atencion_nombre: string;
  monto_requerido: number;
  estado: string;
  creado_en: string;
}

interface PuntosResponse {
  success: boolean;
  puntos: PuntoAtencion[];
}

export default function SaldoServientregaAdmin() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "ADMIN";

  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<string>("");
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [nuevoMonto, setNuevoMonto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialAsignacion[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudSaldo[]>([]);
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [filtroPunto, setFiltroPunto] = useState<string>("");

  // ✅ Obtener puntos y saldos
  const obtenerPuntosYSaldo = async () => {
    try {
      const { data } = await axios.get<PuntosResponse>(
        "/api/servientrega/remitente/puntos"
      );
      const puntosActivos = data.puntos || [];
      setPuntos(puntosActivos);
      if (puntosActivos.length > 0) {
        setPuntoSeleccionado(puntosActivos[0].id);
      }

      const saldosTemp: Record<string, number> = {};
      await Promise.all(
        puntosActivos.map(async (p) => {
          try {
            const res = await axios.get<SaldoResponse>(
              `/api/servientrega/saldo/${p.id}`
            );
            saldosTemp[p.id] = res.data?.disponible ?? 0;
          } catch {
            saldosTemp[p.id] = 0;
          }
        })
      );
      setSaldos(saldosTemp);
    } catch (error) {
      console.error("❌ Error al obtener puntos o saldos:", error);
    }
  };

  // ✅ Obtener historial de asignaciones
  const obtenerHistorial = async () => {
    try {
      const { data } = await axios.get("/api/servientrega/saldo/historial");
      if (Array.isArray(data)) setHistorial(data);
    } catch (error) {
      console.error("❌ Error al obtener historial:", error);
    }
  };

  // ✅ Obtener solicitudes de saldo
  const obtenerSolicitudes = async () => {
    try {
      const { data } = await axios.get(
        "/api/servientrega/solicitar-saldo/listar"
      );
      setSolicitudes(data || []);
    } catch (error) {
      console.error("❌ Error al obtener solicitudes de saldo:", error);
    }
  };

  // ✅ Aprobar/Rechazar solicitud
  const responderSolicitud = async (
    id: string,
    estado: "APROBADA" | "RECHAZADA",
    monto: number,
    punto_id: string
  ) => {
    try {
      await axios.post("/api/servientrega/solicitar-saldo/responder", {
        solicitud_id: id,
        estado,
        aprobado_por: user?.nombre || "admin",
      });

      if (estado === "APROBADA") {
        // Actualiza el saldo automáticamente
        await axios.post("/api/servientrega/saldo", {
          monto_total: monto,
          creado_por: user?.nombre || "admin",
          punto_atencion_id: punto_id,
        });
        toast.success("✅ Solicitud aprobada y saldo actualizado.");
        obtenerPuntosYSaldo();
        obtenerHistorial();
      } else {
        toast.success("❌ Solicitud rechazada correctamente.");
      }

      obtenerSolicitudes();
    } catch {
      toast.error("❌ Error al responder la solicitud.");
    }
  };

  // ✅ Asignar saldo (admin)
  const asignarSaldo = async () => {
    const monto = parseFloat(nuevoMonto);
    if (isNaN(monto) || monto <= 0 || !puntoSeleccionado) return;
    setLoading(true);
    setMensaje(null);
    try {
      await axios.post("/api/servientrega/saldo", {
        monto_total: monto,
        creado_por: user?.nombre ?? "admin",
        punto_atencion_id: puntoSeleccionado,
      });
      setMensaje("✅ Saldo asignado correctamente.");
      setNuevoMonto("");
      obtenerPuntosYSaldo();
      obtenerHistorial();
    } catch {
      setMensaje("❌ Error al asignar saldo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerPuntosYSaldo();
    obtenerHistorial();
    if (esAdmin) obtenerSolicitudes();
  }, []);

  // ✅ Filtrar historial
  const historialFiltrado = historial.filter((h) => {
    const coincidePunto =
      !filtroPunto ||
      puntos.find((p) => p.id === filtroPunto)?.nombre ===
        h.punto_atencion_nombre;

    const coincideFecha =
      !filtroFecha ||
      new Date(h.creado_en).toISOString().slice(0, 10) === filtroFecha;

    return coincidePunto && coincideFecha;
  });

  const saldoActual = Number(saldos[puntoSeleccionado] ?? 0);
  const saldoBajo = saldoActual < UMBRAL_SALDO_BAJO;

  return (
    <div className="max-w-6xl mx-auto mt-10 space-y-6">
      {/* Panel principal */}
      <Card className="p-4">
        <CardHeader>
          <CardTitle className="text-xl">
            Administrar saldos Servientrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selección punto */}
          <div className="space-y-2">
            <Label>Punto de atención</Label>
            <Select
              value={puntoSeleccionado}
              onValueChange={setPuntoSeleccionado}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar punto" />
              </SelectTrigger>
              <SelectContent>
                {puntos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} - {p.ciudad}, {p.provincia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Saldo */}
          {puntoSeleccionado && (
            <p
              className={`text-base font-semibold ${
                saldoBajo ? "text-red-600" : "text-green-700"
              }`}
            >
              Saldo disponible: ${saldoActual.toFixed(2)}
            </p>
          )}

          {/* Asignación saldo */}
          {esAdmin && (
            <>
              <div className="space-y-2">
                <Label>Monto a agregar</Label>
                <Input
                  type="number"
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(e.target.value)}
                  placeholder="Ej. 50.00"
                  min={0}
                />
              </div>
              <Button
                onClick={asignarSaldo}
                disabled={loading || !nuevoMonto.trim()}
              >
                {loading ? "Asignando..." : "Agregar saldo"}
              </Button>
              {mensaje && (
                <p
                  className={`text-sm mt-2 ${
                    mensaje.includes("✅") ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {mensaje}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Solicitudes de saldo */}
      {esAdmin && (
        <Card className="p-4">
          <CardHeader>
            <CardTitle className="text-lg">Solicitudes de saldo</CardTitle>
          </CardHeader>
          <CardContent>
            {solicitudes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No hay solicitudes pendientes.
              </p>
            ) : (
              <ul className="space-y-3">
                {solicitudes.map((sol) => (
                  <li
                    key={sol.id}
                    className="border rounded p-3 flex justify-between items-center bg-gray-50"
                  >
                    <div>
                      <p className="font-semibold">
                        {sol.punto_atencion_nombre}
                      </p>
                      <p className="text-sm text-gray-600">
                        Monto solicitado: ${sol.monto_requerido.toFixed(2)} -
                        Estado:{" "}
                        <span className="font-medium">{sol.estado}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Fecha: {new Date(sol.creado_en).toLocaleString()}
                      </p>
                    </div>
                    {sol.estado === "PENDIENTE" && (
                      <div className="flex gap-2">
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() =>
                            responderSolicitud(
                              sol.id,
                              "APROBADA",
                              sol.monto_requerido,
                              sol.punto_atencion_id
                            )
                          }
                        >
                          Aprobar
                        </Button>
                        <Button
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() =>
                            responderSolicitud(
                              sol.id,
                              "RECHAZADA",
                              sol.monto_requerido,
                              sol.punto_atencion_id
                            )
                          }
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historial de asignaciones */}
      {esAdmin && (
        <Card className="p-4">
          <CardHeader>
            <CardTitle className="text-lg">Historial de asignaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {historialFiltrado.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No hay asignaciones registradas.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[400px] overflow-auto pr-2">
                {historialFiltrado.map((h) => (
                  <li
                    key={h.id}
                    className="border p-3 rounded-md bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                      <div className="flex-1 space-y-1">
                        <p className="text-base font-medium text-gray-800">
                          {h.punto_atencion_nombre}
                        </p>
                        <p className="text-xs text-gray-500">
                          Asignado por: {h.creado_por}
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end mt-2 sm:mt-0">
                        <span className="text-green-700 font-bold">
                          +${h.monto_total.toFixed(2)}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(h.creado_en).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
