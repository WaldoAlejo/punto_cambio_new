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
  observaciones?: string;
  creado_en: string;
  aprobado_por?: string;
  aprobado_en?: string;
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
  const [saldos, setSaldos] = useState<Record<string, number>>({});

  const [historial, setHistorial] = useState<HistorialAsignacion[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudSaldo[]>([]);
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [filtroPunto, setFiltroPunto] = useState<string>("todos");
  const [montosInput, setMontosInput] = useState<Record<string, string>>({});
  const [loadingPuntos, setLoadingPuntos] = useState<Record<string, boolean>>(
    {}
  );

  // ✅ Obtener puntos y saldos
  const obtenerPuntosYSaldo = async () => {
    try {
      console.log(
        "🔍 SaldoServientregaAdmin: Iniciando carga de puntos y saldos..."
      );

      const { data } = await axiosInstance.get<PuntosResponse>(
        "/servientrega/remitente/puntos"
      );
      console.log("📍 Respuesta completa de puntos Servientrega:", data);

      if (!data.success) {
        console.error("❌ Error en respuesta de puntos:", data);
        toast.error("Error al obtener puntos de atención");
        return;
      }

      const puntosActivos = data.puntos || [];
      console.log(
        `📍 Puntos Servientrega encontrados: ${puntosActivos.length}`,
        puntosActivos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          ciudad: p.ciudad,
        }))
      );

      setPuntos(puntosActivos);

      if (puntosActivos.length === 0) {
        console.warn("⚠️ No se encontraron puntos de atención activos");
        setSaldos({});
        return;
      }

      console.log("💰 Obteniendo saldos para cada punto...");
      const saldosTemp: Record<string, number> = {};

      const saldoPromises = puntosActivos.map(async (p) => {
        try {
          console.log(`💰 Consultando saldo para: ${p.nombre} (ID: ${p.id})`);
          const res = await axiosInstance.get<SaldoResponse>(
            `/servientrega/saldo/${p.id}`
          );
          const saldoDisponible = res.data?.disponible ?? 0;
          saldosTemp[p.id] = saldoDisponible;
          console.log(
            `✅ Saldo para ${p.nombre}: $${saldoDisponible.toFixed(2)}`
          );
          return { punto: p.nombre, saldo: saldoDisponible };
        } catch (error) {
          console.error(`❌ Error obteniendo saldo para ${p.nombre}:`, error);
          saldosTemp[p.id] = 0;
          return { punto: p.nombre, saldo: 0, error: true };
        }
      });

      const resultadosSaldos = await Promise.all(saldoPromises);
      console.log("💰 Resumen de saldos obtenidos:", resultadosSaldos);

      setSaldos(saldosTemp);
      console.log(
        "✅ Proceso de carga completado. Saldos finales:",
        saldosTemp
      );
    } catch (error) {
      console.error("❌ Error crítico al obtener puntos o saldos:", error);
      toast.error("Error al cargar información de puntos y saldos");
      setPuntos([]);
      setSaldos({});
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
      console.log("📋 Respuesta completa de solicitudes:", data);

      // Verificar si la respuesta tiene la estructura esperada
      if (data && Array.isArray(data.solicitudes)) {
        setSolicitudes(data.solicitudes);
        console.log(
          "📋 Solicitudes establecidas:",
          data.solicitudes.length,
          "registros"
        );
      } else if (Array.isArray(data)) {
        setSolicitudes(data);
        console.log(
          "📋 Solicitudes establecidas (array directo):",
          data.length,
          "registros"
        );
      } else {
        console.log(
          "❌ Los datos de solicitudes no tienen el formato esperado:",
          data
        );
        setSolicitudes([]);
      }
    } catch (error) {
      console.error("❌ Error al obtener solicitudes de saldo:", error);
      setSolicitudes([]);
    }
  };

  // ✅ Aprobar/Rechazar solicitud
  const responderSolicitud = async (
    id: string,
    estado: "APROBADA" | "RECHAZADA",
    monto: number,
    punto_id: string
  ) => {
    const solicitud = solicitudes.find((s) => s.id === id);
    const nombrePunto = solicitud?.punto_atencion_nombre || "punto desconocido";

    const accion = estado === "APROBADA" ? "aprobar" : "rechazar";
    const mensaje =
      estado === "APROBADA"
        ? `¿Está seguro de aprobar la solicitud de $${monto.toLocaleString()} para ${nombrePunto}? Esto asignará automáticamente el saldo.`
        : `¿Está seguro de rechazar la solicitud de $${monto.toLocaleString()} para ${nombrePunto}?`;

    showConfirmation(`Confirmar ${accion} solicitud`, mensaje, async () => {
      try {
        console.log(
          `📋 ${
            estado === "APROBADA" ? "Aprobando" : "Rechazando"
          } solicitud ${id} para ${nombrePunto}`
        );

        await axiosInstance.put(`/servientrega/solicitar-saldo/${id}/estado`, {
          estado,
          aprobado_por: user?.nombre || "admin",
        });

        if (estado === "APROBADA") {
          console.log(
            `💰 Asignando saldo automáticamente: $${monto} al punto ${punto_id}`
          );
          // Actualiza el saldo automáticamente
          await axiosInstance.post("/servientrega/saldo", {
            monto_total: monto,
            creado_por: user?.nombre || "admin",
            punto_atencion_id: punto_id,
          });
          toast.success(
            `✅ Solicitud aprobada y saldo de $${monto.toLocaleString()} asignado a ${nombrePunto}`
          );

          // Actualizar todos los datos
          await Promise.all([obtenerPuntosYSaldo(), obtenerHistorial()]);
        } else {
          toast.success(
            `❌ Solicitud de ${nombrePunto} rechazada correctamente`
          );
        }

        obtenerSolicitudes();
      } catch (error) {
        console.error(`❌ Error al ${accion} solicitud:`, error);
        toast.error(`❌ Error al ${accion} la solicitud`);
      }
    });
  };

  useEffect(() => {
    obtenerPuntosYSaldo();
    obtenerHistorial();
    if (esAdmin) obtenerSolicitudes();

    // Auto-actualizar solicitudes cada 30 segundos para el admin
    let interval: NodeJS.Timeout;
    if (esAdmin) {
      interval = setInterval(() => {
        obtenerSolicitudes();
      }, 30000); // 30 segundos
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [esAdmin]);

  // ✅ Filtrar historial
  const historialFiltrado = (historial || []).filter((h) => {
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
      const { data } = await axiosInstance.get("/servientrega/saldo/historial");
      console.log("🔧 Debug del historial:", data);
      toast.success(
        `Debug completado. Ver consola. Total registros: ${data.length}`
      );
    } catch (error) {
      console.error("❌ Error en debug:", error);
      toast.error("Error al ejecutar debug");
    }
  };

  // ✅ Función para probar conexión a la base de datos
  const testDB = async () => {
    try {
      const { data } = await axiosInstance.get("/servientrega/saldo/historial");
      console.log("🔧 Test de DB:", data);
      toast.success("Test de DB completado. Ver consola.");
    } catch (error) {
      console.error("❌ Error en test de DB:", error);
      toast.error("Error al probar conexión a DB");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          💰 Gestión de Saldos Servientrega
          {esAdmin &&
            (solicitudes || []).filter((s) => s.estado === "PENDIENTE").length >
              0 && (
              <span className="animate-pulse bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                🔔{" "}
                {
                  (solicitudes || []).filter((s) => s.estado === "PENDIENTE")
                    .length
                }{" "}
                solicitudes pendientes
              </span>
            )}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={obtenerPuntosYSaldo}
            className="text-xs"
          >
            🔄 Actualizar
          </Button>
          <div className="text-sm text-gray-500 px-2 py-1 bg-gray-100 rounded">
            {puntos.length} puntos cargados
          </div>
        </div>
      </div>

      {/* Grid de puntos de atención */}
      {puntos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📍</div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            No se encontraron puntos de atención
          </h3>
          <p className="text-gray-500 mb-4">
            Verifica que existan puntos de atención activos en el sistema
          </p>
          <Button
            variant="outline"
            onClick={obtenerPuntosYSaldo}
            className="mx-auto"
          >
            🔄 Recargar puntos
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(puntos || []).map((punto) => {
            const saldoActualPunto = Number(saldos[punto.id] ?? 0);
            const saldoBajoPunto = saldoActualPunto < UMBRAL_SALDO_BAJO;
            const montoInput = montosInput[punto.id] || "";
            const loadingPunto = loadingPuntos[punto.id] || false;

            const handleAsignarSaldoPunto = async () => {
              const monto = parseFloat(montoInput);
              if (isNaN(monto) || monto <= 0) {
                toast.error("Ingrese un monto válido mayor a 0");
                return;
              }

              showConfirmation(
                "Confirmar asignación de saldo Servientrega",
                `¿Está seguro de asignar $${monto.toLocaleString()} al punto "${
                  punto.nombre
                }" para servicios de Servientrega?`,
                async () => {
                  setLoadingPuntos((prev) => ({ ...prev, [punto.id]: true }));
                  try {
                    console.log(
                      `💰 Asignando saldo Servientrega: $${monto} al punto ${punto.nombre} (${punto.id})`
                    );

                    const response = await axiosInstance.post(
                      "/servientrega/saldo",
                      {
                        monto_total: monto,
                        creado_por: user?.nombre ?? "admin",
                        punto_atencion_id: punto.id,
                      }
                    );

                    console.log(
                      "✅ Respuesta de asignación de saldo:",
                      response.data
                    );

                    toast.success(
                      `✅ Saldo de $${monto.toLocaleString()} asignado correctamente a ${
                        punto.nombre
                      }`
                    );
                    setMontosInput((prev) => ({ ...prev, [punto.id]: "" }));

                    // Actualizar datos
                    await Promise.all([
                      obtenerPuntosYSaldo(),
                      obtenerHistorial(),
                    ]);
                  } catch (error) {
                    console.error(
                      "❌ Error al asignar saldo Servientrega:",
                      error
                    );
                    toast.error("Error al asignar saldo");
                  } finally {
                    setLoadingPuntos((prev) => ({
                      ...prev,
                      [punto.id]: false,
                    }));
                  }
                }
              );
            };

            return (
              <div
                key={punto.id}
                className="border rounded-lg p-6 bg-white shadow-sm space-y-4"
              >
                <div className="mb-2">
                  <span className="font-semibold text-lg">{punto.nombre}</span>
                  <span className="ml-2 text-gray-500">
                    {punto.ciudad}, {punto.provincia}
                  </span>
                </div>

                {/* Saldo actual */}
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    Saldo Servientrega Disponible
                  </Label>
                  <div
                    className={`font-semibold text-xl mb-2 ${
                      saldoBajoPunto ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    $
                    {saldoActualPunto.toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    {saldoBajoPunto && (
                      <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full animate-pulse">
                        ⚠️ Saldo bajo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Umbral mínimo: ${UMBRAL_SALDO_BAJO.toFixed(2)}
                  </div>
                </div>

                {/* Asignación de saldo */}
                {esAdmin && (
                  <>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Asignar Saldo para Servientrega
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={montoInput}
                        onChange={(e) =>
                          setMontosInput((prev) => ({
                            ...prev,
                            [punto.id]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="mt-1"
                        disabled={loadingPunto}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleAsignarSaldoPunto}
                      disabled={
                        loadingPunto ||
                        !montoInput.trim() ||
                        parseFloat(montoInput) <= 0
                      }
                    >
                      {loadingPunto ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Asignando...
                        </>
                      ) : (
                        <>💰 Asignar Saldo</>
                      )}
                    </Button>
                  </>
                )}

                {/* Información adicional para no-admin */}
                {!esAdmin && (
                  <div className="text-center py-2 text-gray-500 text-sm">
                    👤 Solo los administradores pueden asignar saldos
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Solicitudes de saldo */}
      {esAdmin && (
        <Card className="p-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <span>📋 Solicitudes de saldo</span>
                {(solicitudes || []).filter((s) => s.estado === "PENDIENTE")
                  .length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {
                      (solicitudes || []).filter(
                        (s) => s.estado === "PENDIENTE"
                      ).length
                    }{" "}
                    pendientes
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={obtenerSolicitudes}
                className="text-xs"
              >
                🔄 Actualizar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(solicitudes || []).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">
                  📭 No hay solicitudes de saldo
                </p>
                <p className="text-sm text-gray-400">
                  Las solicitudes aparecerán aquí cuando los operadores las
                  envíen
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Solicitudes pendientes primero */}
                {(solicitudes || [])
                  .filter((sol) => sol.estado === "PENDIENTE")
                  .map((sol) => (
                    <div
                      key={sol.id}
                      className="border-2 border-yellow-300 rounded-lg p-4 bg-yellow-50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg text-gray-800">
                              {sol.punto_atencion_nombre}
                            </h3>
                            <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                              PENDIENTE
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-sm text-gray-600">
                                <strong>💰 Monto solicitado:</strong>
                              </p>
                              <p className="text-xl font-bold text-green-600">
                                ${Number(sol.monto_requerido).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">
                                <strong>📅 Fecha de solicitud:</strong>
                              </p>
                              <p className="text-sm">
                                {new Date(sol.creado_en).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {sol.observaciones && (
                            <div className="mb-3">
                              <p className="text-sm text-gray-600">
                                <strong>📝 Observaciones:</strong>
                              </p>
                              <p className="text-sm bg-white p-2 rounded border">
                                {sol.observaciones}
                              </p>
                            </div>
                          )}

                          <div className="text-xs text-gray-500">
                            <strong>ID:</strong> {sol.id}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white px-6"
                            onClick={() =>
                              responderSolicitud(
                                sol.id,
                                "APROBADA",
                                sol.monto_requerido,
                                sol.punto_atencion_id
                              )
                            }
                          >
                            ✅ Aprobar
                          </Button>
                          <Button
                            className="bg-red-600 hover:bg-red-700 text-white px-6"
                            onClick={() =>
                              responderSolicitud(
                                sol.id,
                                "RECHAZADA",
                                sol.monto_requerido,
                                sol.punto_atencion_id
                              )
                            }
                          >
                            ❌ Rechazar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Solicitudes procesadas */}
                {(solicitudes || []).filter((sol) => sol.estado !== "PENDIENTE")
                  .length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      📋 Historial de solicitudes procesadas
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {
                          (solicitudes || []).filter(
                            (sol) => sol.estado !== "PENDIENTE"
                          ).length
                        }
                      </span>
                    </h4>

                    <div className="space-y-3">
                      {(solicitudes || [])
                        .filter((sol) => sol.estado !== "PENDIENTE")
                        .sort(
                          (a, b) =>
                            new Date(b.creado_en).getTime() -
                            new Date(a.creado_en).getTime()
                        )
                        .slice(0, 5) // Mostrar solo las últimas 5
                        .map((sol) => (
                          <div
                            key={sol.id}
                            className={`border rounded-lg p-3 ${
                              sol.estado === "APROBADA"
                                ? "bg-green-50 border-green-200"
                                : "bg-red-50 border-red-200"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-800">
                                    {sol.punto_atencion_nombre}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-1 rounded-full ${
                                      sol.estado === "APROBADA"
                                        ? "bg-green-500 text-white"
                                        : "bg-red-500 text-white"
                                    }`}
                                  >
                                    {sol.estado}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  <strong>Monto:</strong> $
                                  {Number(sol.monto_requerido).toFixed(2)} |
                                  <strong> Fecha:</strong>{" "}
                                  {new Date(sol.creado_en).toLocaleDateString()}
                                  {sol.aprobado_por && (
                                    <span>
                                      {" "}
                                      | <strong>Por:</strong> {sol.aprobado_por}
                                    </span>
                                  )}
                                </p>
                                {sol.observaciones && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <strong>Obs:</strong> {sol.observaciones}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span
                                  className={`text-2xl ${
                                    sol.estado === "APROBADA"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {sol.estado === "APROBADA" ? "✅" : "❌"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>

                    {(solicitudes || []).filter(
                      (sol) => sol.estado !== "PENDIENTE"
                    ).length > 5 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Mostrando las últimas 5 solicitudes procesadas
                      </p>
                    )}
                  </div>
                )}
              </div>
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
                Historial de asignaciones ({(historial || []).length} total,{" "}
                {historialFiltrado.length} mostrados)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testDB}
                  className="text-xs"
                >
                  🔌 Test DB
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={debugHistorial}
                  className="text-xs"
                >
                  🔧 Debug
                </Button>
              </div>
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
                    {(puntos || []).map((p) => (
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
                  {(historial || []).length === 0
                    ? "No hay asignaciones registradas."
                    : "No hay asignaciones que coincidan con los filtros aplicados."}
                </p>
                {(historial || []).length > 0 &&
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
                          +${Number(h.monto_total || 0).toFixed(2)}
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
