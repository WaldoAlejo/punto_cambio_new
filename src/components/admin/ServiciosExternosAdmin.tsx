"use client";

import React, { useEffect, useState, useCallback, Fragment } from "react";
import axios from "axios";
import axiosInstance from "@/services/axiosInstance";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (isRecord(data)) {
      const err = data.error;
      const msg = data.message;
      if (typeof err === "string" && err.trim()) return err;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    return error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

interface PuntoAtencion {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
}

interface MovimientoServicioExterno {
  id: string;
  servicio: string;
  tipo: "INGRESO" | "EGRESO";
  monto: number;
  descripcion?: string;
  punto_atencion_nombre: string;
  creado_por: string;
  creado_en: string;
}

interface SaldoServicioExterno {
  servicio: string;
  saldo_actual: number;
  ultimo_movimiento?: string;
}

interface SaldoPorPuntoServicio {
  punto_atencion_id: string;
  punto_atencion_nombre: string;
  servicio: string;
  saldo_actual: number;
}

interface HistorialAsignacion {
  id: string;
  punto_atencion_nombre: string;
  servicio: string;
  monto_asignado: number;
  creado_por: string;
  creado_en: string;
}

interface InvestigacionDia {
  fecha: string;
  saldo_inicial: number;
  asignaciones: number;
  ingresos: number;
  egresos: number;
  saldo_final: number;
  num_movimientos: number;
  detalles_movimientos: {
    id: string;
    tipo: string;
    monto: number;
    descripcion: string;
    usuario: string;
    hora: string;
  }[];
  detalles_asignaciones: {
    id: string;
    monto: number;
    tipo: string;
    observaciones: string;
    hora: string;
  }[];
}

const SERVICIOS_EXTERNOS = [
  "YAGANASTE",
  "BANCO_GUAYAQUIL",
  "WESTERN",
  "PRODUBANCO",
  "BANCO_PACIFICO",
  "SERVIENTREGA",
  "INSUMOS_OFICINA",
  "INSUMOS_LIMPIEZA",
  "OTROS",
] as const;

type ServicioExterno = (typeof SERVICIOS_EXTERNOS)[number];

const UMBRAL_SALDO_BAJO = 10; // USD

export default function ServiciosExternosAdmin() {
  const { user } = useAuth();
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const esAdmin = user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO";

  const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoServicioExterno[]>(
    []
  );
  const [saldos, setSaldos] = useState<SaldoServicioExterno[]>([]);
  const [saldosPorPunto, setSaldosPorPunto] = useState<SaldoPorPuntoServicio[]>(
    []
  );
  const [historialAsignaciones, setHistorialAsignaciones] = useState<
    HistorialAsignacion[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vistaActual, setVistaActual] = useState<
    "asignacion" | "movimientos" | "investigacion"
  >("asignacion");

  // Estados para investigación de saldos
  const [investigacionDias, setInvestigacionDias] = useState<
    InvestigacionDia[]
  >([]);
  const [investigacionFiltros, setInvestigacionFiltros] = useState({
    punto_id: "",
    servicio: "" as ServicioExterno | "",
    fecha_desde: "",
    fecha_hasta: "",
  });
  const [buscandoInvestigacion, setBuscandoInvestigacion] = useState(false);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);

  // Estados para asignación de saldos
  const [montosAsignacion, setMontosAsignacion] = useState<
    Record<string, Record<string, string>>
  >({});
  const [tiposAsignacion, setTiposAsignacion] = useState<
    Record<string, Record<string, "INICIAL" | "RECARGA">>
  >({});
  const [loadingAsignaciones, setLoadingAsignaciones] = useState<
    Record<string, boolean>
  >({});

  // Formulario para nuevo movimiento
  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    punto_atencion_id: "",
    servicio: "" as ServicioExterno | "",
    tipo: "" as "INGRESO" | "EGRESO" | "",
    monto: "",
    descripcion: "",
  });

  // Filtros
  const [filtros, setFiltros] = useState({
    punto_id: "todos",
    servicio: "todos",
    fecha_desde: "",
    fecha_hasta: "",
  });

  const obtenerPuntos = async () => {
    try {
      const { data } = await axiosInstance.get("/puntos-atencion");
      setPuntos(data.puntos || []);
    } catch (error) {
      console.error("Error al obtener puntos:", error);
      toast.error("Error al cargar puntos de atención");
    }
  };

  const obtenerMovimientos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filtros.punto_id !== "todos")
        params.append("punto_id", filtros.punto_id);
      if (filtros.servicio !== "todos")
        params.append("servicio", filtros.servicio);
      if (filtros.fecha_desde)
        params.append("fecha_desde", filtros.fecha_desde);
      if (filtros.fecha_hasta)
        params.append("fecha_hasta", filtros.fecha_hasta);

      const { data } = await axiosInstance.get(
        `/servicios-externos/movimientos?${params}`
      );
      setMovimientos(data.movimientos || []);
    } catch (error) {
      console.error("Error al obtener movimientos:", error);
      toast.error("Error al cargar movimientos");
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  const obtenerSaldos = async () => {
    try {
      const { data } = await axiosInstance.get("/servicios-externos/saldos");
      setSaldos(data.saldos || []);
    } catch (error) {
      console.error("Error al obtener saldos:", error);
      toast.error("Error al cargar saldos");
      setSaldos([]);
    }
  };

  const obtenerSaldosPorPunto = async () => {
    try {
      const { data } = await axiosInstance.get(
        "/servicios-externos/saldos-por-punto"
      );
      setSaldosPorPunto(data.saldos || []);
    } catch (error) {
      console.error("Error al obtener saldos por punto:", error);
      toast.error("Error al cargar saldos por punto");
      setSaldosPorPunto([]);
    }
  };

  const obtenerHistorialAsignaciones = async () => {
    try {
      const { data } = await axiosInstance.get(
        "/servicios-externos/historial-asignaciones"
      );
      setHistorialAsignaciones(data.historial || []);
    } catch (error) {
      console.error("Error al obtener historial:", error);
      toast.error("Error al cargar historial de asignaciones");
      setHistorialAsignaciones([]);
    }
  };

  const realizarInvestigacion = async () => {
    if (!investigacionFiltros.punto_id || !investigacionFiltros.servicio) {
      toast.error("Seleccione un punto y un servicio");
      return;
    }

    try {
      setBuscandoInvestigacion(true);
      const params = new URLSearchParams();
      params.append("punto_id", investigacionFiltros.punto_id);
      params.append("servicio", investigacionFiltros.servicio);
      if (investigacionFiltros.fecha_desde)
        params.append("fecha_desde", investigacionFiltros.fecha_desde);
      if (investigacionFiltros.fecha_hasta)
        params.append("fecha_hasta", investigacionFiltros.fecha_hasta);

      const { data } = await axiosInstance.get(
        `/servicios-externos/investigacion-saldos?${params}`
      );
      setInvestigacionDias(data.dias || []);
      if (data.dias?.length === 0) {
        toast.info(
          data.message || "No se encontraron datos para los filtros seleccionados"
        );
      }
    } catch (error) {
      console.error("Error en investigación:", error);
      toast.error("Error al realizar la investigación");
    } finally {
      setBuscandoInvestigacion(false);
    }
  };

  const crearMovimiento = async () => {
    if (
      !nuevoMovimiento.punto_atencion_id ||
      !nuevoMovimiento.servicio ||
      !nuevoMovimiento.tipo ||
      !nuevoMovimiento.monto
    ) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    const monto = parseFloat(nuevoMovimiento.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error("El monto debe ser un número positivo");
      return;
    }

    const punto = puntos.find(
      (p) => p.id === nuevoMovimiento.punto_atencion_id
    );
    const mensaje = `¿Confirma crear un ${nuevoMovimiento.tipo.toLowerCase()} de $${monto.toFixed(
      2
    )} para ${nuevoMovimiento.servicio} en ${punto?.nombre}?`;

    showConfirmation("Confirmar movimiento", mensaje, async () => {
      try {
        setSaving(true);
        await axiosInstance.post("/servicios-externos/movimientos", {
          punto_atencion_id: nuevoMovimiento.punto_atencion_id,
          servicio: nuevoMovimiento.servicio,
          tipo: nuevoMovimiento.tipo,
          monto: monto,
          descripcion: nuevoMovimiento.descripcion || undefined,
        });

        toast.success("Movimiento creado correctamente");

        // Limpiar formulario
        setNuevoMovimiento({
          punto_atencion_id: "",
          servicio: "",
          tipo: "",
          monto: "",
          descripcion: "",
        });

        // Recargar datos
        await Promise.all([obtenerMovimientos(), obtenerSaldos()]);
      } catch (error: unknown) {
        console.error("Error al crear movimiento:", error);
        toast.error(getErrorMessage(error, "Error al crear el movimiento"));
      } finally {
        setSaving(false);
      }
    });
  };

  const asignarSaldo = async (
    puntoId: string,
    servicio: ServicioExterno,
    monto: number,
    tipoAsignacion: "INICIAL" | "RECARGA"
  ) => {
    const punto = puntos.find((p) => p.id === puntoId);
    
    // Obtener saldo actual para mostrar en la confirmación
    const saldoPunto = saldosPorPunto.find(
      (s) => s.punto_atencion_id === puntoId && s.servicio === servicio
    );
    const saldoActual = saldoPunto?.saldo_actual || 0;
    const nuevoSaldo = saldoActual + monto;

    const mensaje = `¿Está seguro de asignar $${monto.toFixed(
      2
    )} de ${servicio} al punto "${punto?.nombre}"? 
    \nSaldo actual: $${saldoActual.toFixed(2)}
    \nNuevo saldo final: $${nuevoSaldo.toFixed(2)}
    \n(Esta operación se sumará al saldo existente para mantener la trazabilidad)`;

    showConfirmation("Confirmar asignación de saldo", mensaje, async () => {
      const key = `${puntoId}-${servicio}`;
      setLoadingAsignaciones((prev) => ({ ...prev, [key]: true }));

      try {
        await axiosInstance.post("/servicios-externos/asignar-saldo", {
          punto_atencion_id: puntoId,
          servicio: servicio,
          monto_asignado: monto,
          tipo_asignacion: tipoAsignacion,
          creado_por: user?.nombre || "admin",
        });

        toast.success(
          `✅ Saldo de $${monto.toFixed(2)} asignado correctamente a ${
            punto?.nombre
          } para ${servicio}`
        );

        // Limpiar el input y el tipo
        setMontosAsignacion((prev) => ({
          ...prev,
          [puntoId]: {
            ...prev[puntoId],
            [servicio]: "",
          },
        }));
        setTiposAsignacion((prev) => ({
          ...prev,
          [puntoId]: {
            ...prev[puntoId],
            [servicio]: "INICIAL",
          },
        }));

        // Recargar datos
        await Promise.all([
          obtenerSaldosPorPunto(),
          obtenerHistorialAsignaciones(),
          obtenerSaldos(),
        ]);
      } catch (error: unknown) {
        console.error("Error al asignar saldo:", error);
        toast.error(getErrorMessage(error, "Error al asignar el saldo"));
      } finally {
        setLoadingAsignaciones((prev) => ({ ...prev, [key]: false }));
      }
    });
  };

  useEffect(() => {
    if (esAdmin) {
      obtenerPuntos();
      obtenerSaldos();
      obtenerSaldosPorPunto();
      obtenerHistorialAsignaciones();
    }
  }, [esAdmin]);

  useEffect(() => {
    if (esAdmin) {
      obtenerMovimientos();
    }
  }, [esAdmin, obtenerMovimientos]);

  if (!esAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Acceso Restringido
            </h3>
            <p className="text-gray-500">
              Solo los administradores pueden acceder a esta sección
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header - Siempre visible */}
      <div className="flex-shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            💼 Gestión de Saldos - Servicios Externos
          </h1>
          <p className="text-xs text-gray-600">
            Administra saldos y movimientos de servicios externos por punto
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant={vistaActual === "asignacion" ? "default" : "ghost"}
              size="sm"
              onClick={() => setVistaActual("asignacion")}
            >
              💰 Asignación de Saldos
            </Button>
            <Button
              variant={vistaActual === "movimientos" ? "default" : "ghost"}
              size="sm"
              onClick={() => setVistaActual("movimientos")}
            >
              📋 Movimientos
            </Button>
            <Button
              variant={vistaActual === "investigacion" ? "default" : "ghost"}
              size="sm"
              onClick={() => setVistaActual("investigacion")}
            >
              🔍 Investigación
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              obtenerSaldosPorPunto();
              obtenerHistorialAsignaciones();
              obtenerSaldos();
              if (vistaActual === "movimientos") obtenerMovimientos();
            }}
            className="text-xs"
          >
            🔄 Actualizar
          </Button>
          <div className="text-sm text-gray-500 px-2 py-1 bg-gray-100 rounded">
            {puntos.length} puntos cargados
          </div>
        </div>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {vistaActual === "asignacion" ? (
          <>
            {/* ... Asignación ... */}
            <Card className="flex-shrink-0">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  📊 Saldos Totales por Servicio
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {saldos.map((saldo) => (
                    <div key={saldo.servicio} className="p-3 border rounded-lg">
                      <h3 className="font-semibold text-xs text-gray-600 mb-1">
                        {saldo.servicio}
                      </h3>
                      <p className="text-lg font-bold text-green-600">
                        ${saldo.saldo_actual.toFixed(2)}
                      </p>
                      {saldo.ultimo_movimiento && (
                        <p className="text-xs text-gray-500 mt-1">
                          Último:{" "}
                          {new Date(
                            saldo.ultimo_movimiento
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Grid de Puntos de Atención para Asignación */}
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
                  onClick={obtenerPuntos}
                  className="mx-auto"
                >
                  🔄 Recargar puntos
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {puntos.map((punto) => (
                  <Card key={punto.id} className="p-4 bg-white shadow-sm">
                    <div className="mb-3">
                      <h3 className="font-semibold text-base text-gray-800">
                        {punto.nombre}
                      </h3>
                      <p className="text-gray-500 text-xs">
                        {punto.ciudad}, {punto.provincia}
                      </p>
                    </div>

                    {/* Saldos actuales del punto */}
                    <div className="mb-3">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">
                        Saldos Asignados:
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {SERVICIOS_EXTERNOS.map((servicio) => {
                          const saldoPunto = saldosPorPunto.find(
                            (s) =>
                              s.punto_atencion_id === punto.id &&
                              s.servicio === servicio
                          );
                          const saldoActual = saldoPunto?.saldo_actual || 0;
                          const saldoBajo = saldoActual < UMBRAL_SALDO_BAJO;

                          return (
                            <div
                              key={servicio}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-gray-600">{servicio}:</span>
                              <span
                                className={`font-semibold ${
                                  saldoBajo ? "text-red-600" : "text-green-600"
                                }`}
                              >
                                ${saldoActual.toFixed(2)}
                                {saldoBajo && (
                                  <span className="ml-1 text-xs">⚠️</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Formulario de asignación */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-700">
                        Asignar Nuevo Saldo:
                      </h4>
                      {SERVICIOS_EXTERNOS.map((servicio) => {
                        const key = `${punto.id}-${servicio}`;
                        const loading = loadingAsignaciones[key] || false;
                        const montoInput =
                          montosAsignacion[punto.id]?.[servicio] || "";
                        const tipoAsignacion =
                          tiposAsignacion[punto.id]?.[servicio] || "INICIAL";

                        return (
                          <div key={servicio} className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Label className="text-xs text-gray-600">
                                {servicio}
                              </Label>
                              <div className="flex gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={montoInput}
                                  onChange={(e) =>
                                    setMontosAsignacion((prev) => ({
                                      ...prev,
                                      [punto.id]: {
                                        ...prev[punto.id],
                                        [servicio]: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="0.00"
                                  className="text-sm flex-1"
                                  disabled={loading}
                                />
                                <Select
                                  value={tipoAsignacion}
                                  onValueChange={(
                                    value: "INICIAL" | "RECARGA"
                                  ) =>
                                    setTiposAsignacion((prev) => ({
                                      ...prev,
                                      [punto.id]: {
                                        ...prev[punto.id],
                                        [servicio]: value,
                                      },
                                    }))
                                  }
                                  disabled={loading}
                                >
                                  <SelectTrigger className="text-xs w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="INICIAL"
                                      className="text-xs"
                                    >
                                      Inicial
                                    </SelectItem>
                                    <SelectItem
                                      value="RECARGA"
                                      className="text-xs"
                                    >
                                      Recarga
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                const monto = parseFloat(montoInput);
                                if (isNaN(monto) || monto <= 0) {
                                  toast.error(
                                    "Ingrese un monto válido mayor a 0"
                                  );
                                  return;
                                }
                                asignarSaldo(
                                  punto.id,
                                  servicio,
                                  monto,
                                  tipoAsignacion
                                );
                              }}
                              disabled={
                                loading ||
                                !montoInput.trim() ||
                                parseFloat(montoInput) <= 0
                              }
                              className="text-xs px-2"
                            >
                              {loading ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                "💰"
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Historial de Asignaciones */}
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  📋 Historial de Asignaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {historialAsignaciones.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      📭 No hay asignaciones registradas
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Fecha</th>
                          <th className="text-left p-2">Punto</th>
                          <th className="text-left p-2">Servicio</th>
                          <th className="text-left p-2">Monto</th>
                          <th className="text-left p-2">Creado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialAsignaciones
                          .slice(0, 10)
                          .map((asignacion) => (
                            <tr
                              key={asignacion.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="p-2">
                                {new Date(
                                  asignacion.creado_en
                                ).toLocaleDateString()}
                              </td>
                              <td className="p-2">
                                {asignacion.punto_atencion_nombre}
                              </td>
                              <td className="p-2">{asignacion.servicio}</td>
                              <td className="p-2 font-semibold text-green-600">
                                ${asignacion.monto_asignado.toFixed(2)}
                              </td>
                              <td className="p-2">{asignacion.creado_por}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : vistaActual === "movimientos" ? (
          <>
            {/* Vista de Movimientos */}
            {/* Formulario para Nuevo Movimiento */}
            <Card className="flex-shrink-0">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  ➕ Crear Nuevo Movimiento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label>Punto de Atención</Label>
                    <Select
                      value={nuevoMovimiento.punto_atencion_id}
                      onValueChange={(value) =>
                        setNuevoMovimiento((prev) => ({
                          ...prev,
                          punto_atencion_id: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar punto" />
                      </SelectTrigger>
                      <SelectContent>
                        {puntos.map((punto) => (
                          <SelectItem key={punto.id} value={punto.id}>
                            {punto.nombre} - {punto.ciudad}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Servicio</Label>
                    <Select
                      value={nuevoMovimiento.servicio}
                      onValueChange={(value) =>
                        setNuevoMovimiento((prev) => ({
                          ...prev,
                          servicio: value as ServicioExterno,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICIOS_EXTERNOS.map((servicio) => (
                          <SelectItem key={servicio} value={servicio}>
                            {servicio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={nuevoMovimiento.tipo}
                      onValueChange={(value) =>
                        setNuevoMovimiento((prev) => ({
                          ...prev,
                          tipo: value as "INGRESO" | "EGRESO",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INGRESO">INGRESO</SelectItem>
                        <SelectItem value="EGRESO">EGRESO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Monto (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={nuevoMovimiento.monto}
                      onChange={(e) =>
                        setNuevoMovimiento((prev) => ({
                          ...prev,
                          monto: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label>Descripción</Label>
                    <Input
                      value={nuevoMovimiento.descripcion}
                      onChange={(e) =>
                        setNuevoMovimiento((prev) => ({
                          ...prev,
                          descripcion: e.target.value,
                        }))
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <Button
                  onClick={crearMovimiento}
                  disabled={saving}
                  className="w-full md:w-auto"
                >
                  {saving ? "Guardando..." : "💾 Crear Movimiento"}
                </Button>
              </CardContent>
            </Card>

            {/* Filtros */}
            <Card className="flex-shrink-0">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  🔍 Filtros de Búsqueda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Punto de Atención</Label>
                    <Select
                      value={filtros.punto_id}
                      onValueChange={(value) =>
                        setFiltros((prev) => ({ ...prev, punto_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los puntos</SelectItem>
                        {puntos.map((punto) => (
                          <SelectItem key={punto.id} value={punto.id}>
                            {punto.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Servicio</Label>
                    <Select
                      value={filtros.servicio}
                      onValueChange={(value) =>
                        setFiltros((prev) => ({ ...prev, servicio: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">
                          Todos los servicios
                        </SelectItem>
                        {SERVICIOS_EXTERNOS.map((servicio) => (
                          <SelectItem key={servicio} value={servicio}>
                            {servicio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Fecha Desde</Label>
                    <Input
                      type="date"
                      value={filtros.fecha_desde}
                      onChange={(e) =>
                        setFiltros((prev) => ({
                          ...prev,
                          fecha_desde: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Fecha Hasta</Label>
                    <Input
                      type="date"
                      value={filtros.fecha_hasta}
                      onChange={(e) =>
                        setFiltros((prev) => ({
                          ...prev,
                          fecha_hasta: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Historial de Movimientos */}
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  📋 Historial de Movimientos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                {loading ? (
                  <div className="text-center py-8">
                    <p>Cargando movimientos...</p>
                  </div>
                ) : movimientos.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>
                      No se encontraron movimientos con los filtros aplicados
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Punto</th>
                          <th className="px-3 py-2 text-left">Servicio</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                          <th className="px-3 py-2 text-left">Descripción</th>
                          <th className="px-3 py-2 text-left">Creado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientos.map((mov) => (
                          <tr key={mov.id} className="border-t">
                            <td className="px-3 py-2">
                              {new Date(mov.creado_en).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                              {mov.punto_atencion_nombre}
                            </td>
                            <td className="px-3 py-2">{mov.servicio}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  mov.tipo === "INGRESO"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {mov.tipo}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              ${mov.monto.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              {mov.descripcion || "-"}
                            </td>
                            <td className="px-3 py-2">{mov.creado_por}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Vista de Investigación */}
            <Card className="flex-shrink-0">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">
                  🔍 Investigación Diaria de Saldos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <Label>Punto de Atención</Label>
                    <Select
                      value={investigacionFiltros.punto_id}
                      onValueChange={(value) =>
                        setInvestigacionFiltros((prev) => ({
                          ...prev,
                          punto_id: value,
                        }))
                      }
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
                    <Label>Servicio</Label>
                    <Select
                      value={investigacionFiltros.servicio}
                      onValueChange={(value) =>
                        setInvestigacionFiltros((prev) => ({
                          ...prev,
                          servicio: value as ServicioExterno,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICIOS_EXTERNOS.map((servicio) => (
                          <SelectItem key={servicio} value={servicio}>
                            {servicio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Fecha Desde</Label>
                    <Input
                      type="date"
                      value={investigacionFiltros.fecha_desde}
                      onChange={(e) =>
                        setInvestigacionFiltros((prev) => ({
                          ...prev,
                          fecha_desde: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Fecha Hasta</Label>
                    <Input
                      type="date"
                      value={investigacionFiltros.fecha_hasta}
                      onChange={(e) =>
                        setInvestigacionFiltros((prev) => ({
                          ...prev,
                          fecha_hasta: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={realizarInvestigacion}
                  disabled={buscandoInvestigacion}
                  className="w-full md:w-auto"
                >
                  {buscandoInvestigacion ? "Buscando..." : "🚀 Iniciar Investigación"}
                </Button>
              </CardContent>
            </Card>

            {/* Resultados de Investigación */}
            {investigacionDias.length > 0 && (
              <div className="space-y-4">
                <div className="overflow-x-auto bg-white rounded-lg shadow border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="p-3 text-left">Fecha</th>
                        <th className="p-3 text-right">Saldo Inicial</th>
                        <th className="p-3 text-right">Asignaciones (+)</th>
                        <th className="p-3 text-right">Egresos (+)</th>
                        <th className="p-3 text-right">Ingresos (-)</th>
                        <th className="p-3 text-right">Saldo Final</th>
                        <th className="p-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investigacionDias.map((dia) => (
                        <Fragment key={dia.fecha}>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{dia.fecha}</td>
                            <td className="p-3 text-right font-mono">${dia.saldo_inicial.toFixed(2)}</td>
                            <td className="p-3 text-right text-blue-600 font-mono">
                              {dia.asignaciones > 0 ? `+$${dia.asignaciones.toFixed(2)}` : "-"}
                            </td>
                            <td className="p-3 text-right text-green-600 font-mono">
                              {dia.egresos > 0 ? `+$${dia.egresos.toFixed(2)}` : "-"}
                            </td>
                            <td className="p-3 text-right text-red-600 font-mono">
                              {dia.ingresos > 0 ? `-$${dia.ingresos.toFixed(2)}` : "-"}
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
                              <td colSpan={7} className="p-4 bg-gray-50 border-b">
                                <div className="space-y-4">
                                  {dia.detalles_asignaciones.length > 0 && (
                                    <div>
                                      <h4 className="font-bold text-xs uppercase text-gray-500 mb-2">Asignaciones / Recargas</h4>
                                      <div className="space-y-1">
                                        {dia.detalles_asignaciones.map(a => (
                                          <div key={a.id} className="flex justify-between text-xs bg-blue-50 p-2 rounded border border-blue-100">
                                            <span><strong>{a.hora}</strong> - {a.tipo}: {a.observaciones || "Sin observaciones"}</span>
                                            <span className="font-bold text-blue-700">+${a.monto.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="font-bold text-xs uppercase text-gray-500 mb-2">Movimientos del Día</h4>
                                    {dia.detalles_movimientos.length === 0 ? (
                                      <p className="text-xs text-gray-400 italic">No hubo movimientos operativos este día</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {dia.detalles_movimientos.map(m => (
                                          <div key={m.id} className={`flex justify-between text-xs p-2 rounded border ${m.tipo === "INGRESO" ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
                                            <span>
                                              <strong>{m.hora}</strong> - 
                                              <span className={`mx-1 font-bold ${m.tipo === "INGRESO" ? "text-red-700" : "text-green-700"}`}>{m.tipo}</span>: 
                                              {m.descripcion || "Sin descripción"} ({m.usuario})
                                            </span>
                                            <span className={`font-bold ${m.tipo === "INGRESO" ? "text-red-700" : "text-green-700"}`}>
                                              {m.tipo === "INGRESO" ? "-" : "+"}${m.monto.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <ConfirmationDialog />
      </div>
    </div>
  );
}
