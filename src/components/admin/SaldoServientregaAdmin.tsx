"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
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
  const [filtroPunto, setFiltroPunto] = useState<string>("todos");

  // ✅ Obtener puntos y saldos
  const obtenerPuntosYSaldo = async () => {
    try {
      const { data } = await axiosInstance.get<PuntosResponse>(
        "/servientrega/remitente/puntos"
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
            const res = await axiosInstance.get<SaldoResponse>(
              `/servientrega/saldo/${p.id}`
            );
            saldosTemp[p.id] = res.data?.disponible ?? 0;
          } catch {
            saldosTemp[p.id] = 0;
          }
        })
      );
      setSaldos(saldosTemp);
    } catch (error) {
      console.error("Error al obtener puntos o saldos:", error);
      toast.error("Error al cargar información de puntos y saldos");
    }
  };

  // ✅ Obtener historial de asignaciones
  const obtenerHistorial = async () => {
    try {
      const response = await axiosInstance.get("/servientrega/saldo/historial");
      console.log("📊 Respuesta completa del historial:", response);
      console.log("📊 Datos del historial recibidos:", response.data);

      if (Array.isArray(response.data)) {
        setHistorial(response.data);
        console.log(
          "📊 Historial establecido:",
          response.data.length,
          "registros"
        );
      } else {
        console.log(
          "❌ Los datos del historial no son un array:",
          response.data
        );
        console.log("❌ Tipo de datos recibidos:", typeof response.data);
        // Intentar extraer datos si están anidados
        if (response.data && Array.isArray(response.data.data)) {
          setHistorial(response.data.data);
          console.log(
            "📊 Historial establecido desde data.data:",
            response.data.data.length,
            "registros"
          );
        } else {
          setHistorial([]);
        }
      }
    } catch (error) {
      console.error("❌ Error al obtener historial:", error);
      setHistorial([]);
    }
  };

  // ✅ Obtener solicitudes de saldo
  const obtenerSolicitudes = async () => {
    try {
      const { data } = await axiosInstance.get(
        "/servientrega/solicitar-saldo/listar"
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
      await axiosInstance.post("/servientrega/solicitar-saldo/responder", {
        solicitud_id: id,
        estado,
        aprobado_por: user?.nombre || "admin",
      });

      if (estado === "APROBADA") {
        // Actualiza el saldo automáticamente
        await axiosInstance.post("/servientrega/saldo", {
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
  const handleAsignarSaldo = () => {
    const monto = parseFloat(nuevoMonto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto válido mayor a 0");
      return;
    }
    if (!puntoSeleccionado) {
      toast.error("Seleccione un punto de atención");
      return;
    }

    const punto = puntos.find((p) => p.id === puntoSeleccionado);
    showConfirmation(
      "Confirmar asignación de saldo",
      `¿Está seguro de asignar $${monto.toLocaleString()} al punto "${
        punto?.nombre
      }"?`,
      async () => {
        setLoading(true);
        try {
          await axiosInstance.post("/servientrega/saldo", {
            monto_total: monto,
            creado_por: user?.nombre ?? "admin",
            punto_atencion_id: puntoSeleccionado,
          });
          toast.success(
            `✅ Saldo de $${monto.toLocaleString()} asignado correctamente`
          );
          setNuevoMonto("");
          obtenerPuntosYSaldo();
          obtenerHistorial();
        } catch {
          toast.error("Error al asignar saldo");
        } finally {
          setLoading(false);
        }
      }
    );
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
      filtroPunto === "todos" ||
      puntos.find((p) => p.id === filtroPunto)?.nombre ===
        h.punto_atencion_nombre;

    const coincideFecha =
      !filtroFecha ||
      new Date(h.creado_en).toISOString().slice(0, 10) === filtroFecha;

    return coincidePunto && coincideFecha;
  });

  // Debug logging
  console.log("🔍 Estado del historial:", {
    historialTotal: historial.length,
    historialFiltrado: historialFiltrado.length,
    filtroFecha,
    filtroPunto,
    esAdmin,
  });

  // ✅ Función de debug para verificar datos
  const debugHistorial = async () => {
    try {
      const { data } = await axiosInstance.get(
        "/servientrega/saldo/historial/debug"
      );
      console.log("🔧 Debug del historial:", data);
      toast.success(
        `Debug completado. Ver consola. Total registros: ${data.totalRegistros}`
      );
    } catch (error) {
      console.error("❌ Error en debug:", error);
      toast.error("Error al ejecutar debug");
    }
  };

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
                onClick={handleAsignarSaldo}
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
            <CardTitle className="text-lg flex justify-between items-center">
              <span>
                Historial de asignaciones ({historial.length} total,{" "}
                {historialFiltrado.length} mostrados)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={debugHistorial}
                className="text-xs"
              >
                🔧 Debug
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Controles de filtro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label>Filtrar por punto</Label>
                <Select value={filtroPunto} onValueChange={setFiltroPunto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los puntos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los puntos</SelectItem>
                    {puntos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filtrar por fecha</Label>
                <Input
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiltroPunto("todos");
                    setFiltroFecha("");
                  }}
                  className="w-full"
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>

            {historialFiltrado.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 italic">
                  {historial.length === 0
                    ? "No hay asignaciones registradas."
                    : "No hay asignaciones que coincidan con los filtros aplicados."}
                </p>
                {historial.length > 0 &&
                  (filtroFecha || (filtroPunto && filtroPunto !== "todos")) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFiltroPunto("todos");
                        setFiltroFecha("");
                      }}
                      className="mt-2"
                    >
                      Ver todas las asignaciones
                    </Button>
                  )}
              </div>
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

      <ConfirmationDialog />
    </div>
  );
}
