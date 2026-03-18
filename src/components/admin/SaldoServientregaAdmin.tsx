"use client";

import React, { useEffect, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const UMBRAL_SALDO_BAJO = 5;

interface PuntoAtencion {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
  servientrega_agencia_codigo?: string;
  servientrega_agencia_nombre?: string;
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

  // Estados para investigación
  const [investigacionDias, setInvestigacionDias] = useState<any[]>([]);
  const [buscandoInvestigacion, setBuscandoInvestigacion] = useState(false);
  const [invFiltros, setInvFiltros] = useState({
    punto_id: "",
    fecha_desde: "",
    fecha_hasta: "",
  });
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState("gestion");

  // ✅ Obtener puntos y saldos
  const obtenerPuntosYSaldo = async () => {
    try {
      const { data } = await axiosInstance.get<PuntosResponse>(
        "/servientrega/remitente/puntos"
      );

      if (!data.success) {
        console.error("❌ Error en respuesta de puntos:", data);
        toast.error("Error al obtener puntos de atención");
        return;
      }

      const puntosActivos = data.puntos || [];

      setPuntos(puntosActivos);

      if (puntosActivos.length === 0) {
        console.warn("⚠️ No se encontraron puntos de atención activos");
        setSaldos({});
        return;
      }

      const saldosTemp: Record<string, number> = {};

      const saldoPromises = puntosActivos.map(async (p) => {
        try {
          const res = await axiosInstance.get<SaldoResponse>(
            `/servientrega/saldo/${p.id}`
          );
          const saldoDisponible = res.data?.disponible ?? 0;
          saldosTemp[p.id] = saldoDisponible;
          return { punto: p.nombre, saldo: saldoDisponible };
        } catch (error) {
          console.error(`❌ Error obteniendo saldo para ${p.nombre}:`, error);
          saldosTemp[p.id] = 0;
          return { punto: p.nombre, saldo: 0, error: true };
        }
      });

      await Promise.all(saldoPromises);

      setSaldos(saldosTemp);
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

      if (Array.isArray(response.data)) {
        setHistorial(response.data);
      } else {
        // Intentar extraer datos si están anidados
        if (response.data && Array.isArray(response.data.data)) {
          setHistorial(response.data.data);
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

      // Verificar si la respuesta tiene la estructura esperada
      if (data && Array.isArray(data.solicitudes)) {
        setSolicitudes(data.solicitudes);
      } else if (Array.isArray(data)) {
        setSolicitudes(data);
      } else {
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
        await axiosInstance.put(`/servientrega/solicitar-saldo/${id}/estado`, {
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
    let interval: ReturnType<typeof setInterval>;
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

  // ✅ Función de debug para verificar datos
  const debugHistorial = async () => {
    try {
      const { data } = await axiosInstance.get("/servientrega/saldo/historial");
      const total = Array.isArray(data) ? data.length : 0;
      toast.success(
        `Debug completado. Total registros: ${total}`
      );
    } catch (error) {
      console.error("❌ Error en debug:", error);
      toast.error("Error al ejecutar debug");
    }
  };

  // ✅ Función para probar conexión a la base de datos
  const testDB = async () => {
    try {
      await axiosInstance.get("/servientrega/saldo/historial");
      toast.success("Test de DB completado.");
    } catch (error) {
      console.error("❌ Error en test de DB:", error);
      toast.error("Error al probar conexión a DB");
    }
  };

  const handleInvestigar = async () => {
    if (!invFiltros.punto_id) {
      toast.error("Seleccione un punto de atención");
      return;
    }

    setBuscandoInvestigacion(true);
    try {
      const { data } = await axiosInstance.get(
        `/servientrega/investigacion/auditoria`,
        {
          params: {
            punto_id: invFiltros.punto_id,
            fecha_desde: invFiltros.fecha_desde,
            fecha_hasta: invFiltros.fecha_hasta,
          },
        }
      );

      if (data.success) {
        setInvestigacionDias(data.dias || []);
        if (data.dias?.length === 0) {
          toast.info("No se encontraron registros para este rango");
        }
      } else {
        toast.error(data.message || "Error en investigación");
      }
    } catch (error) {
      console.error("Error en investigación:", error);
      toast.error("Error al realizar la investigación");
    } finally {
      setBuscandoInvestigacion(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
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

      <Tabs value={vistaActual} onValueChange={setVistaActual} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="gestion">💰 Gestión de Saldos</TabsTrigger>
          <TabsTrigger value="investigacion">🔍 Investigación Diaria</TabsTrigger>
        </TabsList>

        <TabsContent value="gestion">
          {/* Grid de puntos de atención */}
          {puntos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No se encontraron puntos de atención activos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
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
                        await axiosInstance.post(
                          "/servientrega/saldo",
                          {
                            monto_total: monto,
                            creado_por: user?.nombre ?? "admin",
                            punto_atencion_id: punto.id,
                          }
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
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-lg">
                          {punto.nombre}
                        </span>
                        <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">
                          📦 Servientrega
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 block">
                        📍 {punto.ciudad}
                      </span>
                    </div>

                    <div
                      className={`p-4 rounded-lg flex justify-between items-center ${
                        saldoBajoPunto ? "bg-red-50" : "bg-green-50"
                      }`}
                    >
                      <span className="text-sm font-medium text-gray-700">
                        Saldo disponible:
                      </span>
                      <span
                        className={`text-2xl font-bold font-mono ${
                          saldoBajoPunto ? "text-red-600" : "text-green-700"
                        }`}
                      >
                        ${saldoActualPunto.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                        Recargar Cupo
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-7"
                            value={montoInput}
                            onChange={(e) =>
                              setMontosInput((prev) => ({
                                ...prev,
                                [punto.id]: e.target.value,
                              }))
                            }
                            onKeyPress={(e) => {
                              if (e.key === "Enter") handleAsignarSaldoPunto();
                            }}
                          />
                        </div>
                        <Button
                          onClick={handleAsignarSaldoPunto}
                          disabled={loadingPunto || !montoInput}
                          className="bg-cyan-600 hover:bg-cyan-700"
                        >
                          {loadingPunto ? "⏳" : "✅"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sección de Solicitudes Pendientes */}
          {esAdmin &&
            (solicitudes || []).filter((s) => s.estado === "PENDIENTE").length >
              0 && (
              <Card className="mt-8 border-red-200">
                <CardHeader className="bg-red-50 border-b border-red-100">
                  <CardTitle className="text-red-800 text-lg flex items-center gap-2">
                    🔔 Solicitudes de Saldo Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-6 py-3 text-left">Fecha</th>
                          <th className="px-6 py-3 text-left">Punto</th>
                          <th className="px-6 py-3 text-right">Monto</th>
                          <th className="px-6 py-3 text-left">Observaciones</th>
                          <th className="px-6 py-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {solicitudes
                          .filter((s) => s.estado === "PENDIENTE")
                          .map((sol) => (
                            <tr key={sol.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm">
                                {new Date(sol.creado_en).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium">
                                {sol.punto_atencion_nombre}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-bold text-blue-600">
                                ${sol.monto_requerido.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm italic">
                                {sol.observaciones || "-"}
                              </td>
                              <td className="px-6 py-4 text-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-200 hover:bg-green-50"
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
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
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
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Sección de Historial Consolidado */}
          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between p-4 bg-gray-50 border-b">
              <CardTitle className="text-lg">📋 Historial de Asignaciones</CardTitle>
              <div className="flex gap-4">
                <Select value={filtroPunto} onValueChange={setFiltroPunto}>
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder="Filtrar por punto" />
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
                <Input
                  type="date"
                  className="w-[150px] h-9"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha y Hora</th>
                      <th className="px-4 py-3 text-left">Punto de Atención</th>
                      <th className="px-4 py-3 text-right">Monto</th>
                      <th className="px-4 py-3 text-left">Asignado por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historialFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-500 italic">
                          No hay registros que coincidan con los filtros
                        </td>
                      </tr>
                    ) : (
                      historialFiltrado.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/50">
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(item.creado_en).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {item.punto_atencion_nombre}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${item.monto_total > 0 ? "text-green-600" : "text-red-600"}`}>
                            {item.monto_total > 0 ? "+" : ""}${Number(item.monto_total).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {item.creado_por}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investigacion">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                🔍 Investigación Diaria de Cupo Servientrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Punto de Atención</Label>
                  <Select
                    value={invFiltros.punto_id}
                    onValueChange={(value) => setInvFiltros(p => ({ ...p, punto_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar punto" />
                    </SelectTrigger>
                    <SelectContent>
                      {puntos.map((punto) => (
                        <SelectItem key={punto.id} value={punto.id}>
                          {punto.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha Desde</Label>
                  <Input
                    type="date"
                    value={invFiltros.fecha_desde}
                    onChange={(e) => setInvFiltros(p => ({ ...p, fecha_desde: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={invFiltros.fecha_hasta}
                    onChange={(e) => setInvFiltros(p => ({ ...p, fecha_hasta: e.target.value }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleInvestigar}
                    disabled={buscandoInvestigacion}
                    className="w-full"
                  >
                    {buscandoInvestigacion ? "Buscando..." : "🚀 Iniciar Investigación"}
                  </Button>
                </div>
              </div>

              {investigacionDias.length > 0 && (
                <div className="space-y-4">
                  <div className="overflow-x-auto bg-white rounded-lg shadow border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="p-3 text-left">Fecha</th>
                          <th className="p-3 text-right">Saldo Inicial</th>
                          <th className="p-3 text-right">Asignaciones (+)</th>
                          <th className="p-3 text-right">Gastos (-)</th>
                          <th className="p-3 text-right">Saldo Final</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investigacionDias.map((dia) => (
                          <React.Fragment key={dia.fecha}>
                            <tr className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">{dia.fecha}</td>
                              <td className="p-3 text-right font-mono">${dia.saldo_inicial.toFixed(2)}</td>
                              <td className="p-3 text-right text-blue-600 font-mono">
                                {dia.asignaciones > 0 ? `+$${dia.asignaciones.toFixed(2)}` : "-"}
                              </td>
                              <td className="p-3 text-right text-red-600 font-mono">
                                {dia.egresos > 0 ? `-$${dia.egresos.toFixed(2)}` : "-"}
                              </td>
                              <td className="p-3 text-right font-bold font-mono">${dia.saldo_final.toFixed(2)}</td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDiaExpandido(diaExpandido === dia.fecha ? null : dia.fecha)}
                                >
                                  {diaExpandido === dia.fecha ? "🔼 Ocultar" : `🔽 Ver (${dia.num_movimientos})`}
                                </Button>
                              </td>
                            </tr>
                            {diaExpandido === dia.fecha && (
                              <tr>
                                <td colSpan={6} className="p-4 bg-gray-50">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-bold text-xs mb-2 text-blue-800 text-uppercase">RECARGAS DE CUPO</h4>
                                      <div className="space-y-2">
                                        {dia.detalles_asignaciones?.map((a: any) => (
                                          <div key={a.id} className="bg-white p-2 rounded shadow-sm text-xs flex justify-between">
                                            <span>{a.hora} - {a.observaciones}</span>
                                            <span className="font-bold text-blue-600">+${a.monto.toFixed(2)}</span>
                                          </div>
                                        ))}
                                        {dia.detalles_asignaciones?.length === 0 && <p className="text-xs text-gray-400">Sin recargas</p>}
                                      </div>
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-xs mb-2 text-red-800 text-uppercase">USO DE CUPO (GUÍAS)</h4>
                                      <div className="space-y-2">
                                        {dia.detalles_movimientos?.map((m: any) => (
                                          <div key={m.id} className="bg-white p-2 rounded shadow-sm text-xs flex justify-between items-center">
                                            <div className="flex flex-col">
                                              <span className="font-medium">{m.hora} - {m.tipo}</span>
                                              <span className="text-[10px] text-gray-500">{m.descripcion}</span>
                                            </div>
                                            <span className="font-bold text-red-600">
                                              -${m.monto.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                        {dia.detalles_movimientos?.length === 0 && <p className="text-xs text-gray-400">Sin gastos</p>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmationDialog />
    </div>
  );
}
