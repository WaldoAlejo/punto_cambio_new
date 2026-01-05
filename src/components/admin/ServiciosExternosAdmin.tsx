"use client";

import { useEffect, useState } from "react";
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
  const [vistaActual, setVistaActual] = useState<"asignacion" | "movimientos">(
    "asignacion"
  );

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

  const obtenerMovimientos = async () => {
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
  };

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
      } catch (error: any) {
        console.error("Error al crear movimiento:", error);
        const mensaje =
          error.response?.data?.error || "Error al crear el movimiento";
        toast.error(mensaje);
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
    const tipoTexto = tipoAsignacion === "INICIAL" ? "establecer" : "recargar";
    const mensaje = `¿Está seguro de ${tipoTexto} $${monto.toFixed(
      2
    )} de ${servicio} al punto "${punto?.nombre}"?${
      tipoAsignacion === "INICIAL"
        ? " (Esto REEMPLAZARÁ el saldo actual)"
        : " (Esto se SUMARÁ al saldo actual)"
    }`;

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
      } catch (error: any) {
        console.error("Error al asignar saldo:", error);
        const mensaje =
          error.response?.data?.error || "Error al asignar el saldo";
        toast.error(mensaje);
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
  }, [filtros, esAdmin]);

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
            {/* Resumen de Saldos Totales */}
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
        ) : (
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
        )}

        <ConfirmationDialog />
      </div>
    </div>
  );
}
