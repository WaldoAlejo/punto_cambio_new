import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import { Download, Eye, FileText, BarChart3, RefreshCw, Wallet, History, CreditCard } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { Guia } from "@/types/servientrega";
import axiosInstance from "@/services/axiosInstance";
import { User, PuntoAtencion } from "@/types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const getAxiosStatus = (err: unknown): number | null => {
  if (!isRecord(err)) return null;
  const response = err.response;
  if (!isRecord(response)) return null;
  const status = response.status;
  return typeof status === "number" ? status : null;
};

interface ServientregaInformesProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface EstadisticasGuias {
  total_guias: number;
  guias_activas: number;
  guias_anuladas: number;
  guias_pendientes_anulacion: number;
  total_por_punto: Array<{
    punto_atencion_nombre: string;
    total: number;
    activas: number;
    anuladas: number;
  }>;
}

interface SaldoInfo {
  punto_id: string;
  punto_nombre: string;
  punto_ciudad: string;
  saldo_disponible: number;
  billetes: number;
  monedas_fisicas: number;
  bancos: number;
  updated_at: string;
}

interface RecargaInfo {
  id: string;
  punto_id: string;
  punto_nombre: string;
  punto_ciudad: string;
  monto: number;
  tipo: string;
  observaciones?: string;
  fecha: string;
  asignado_por: string;
}

interface SolicitudSaldoInfo {
  id: string;
  punto_id: string;
  punto_nombre: string;
  punto_ciudad: string;
  monto_solicitado: number;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  observaciones?: string;
  fecha_solicitud: string;
  fecha_respuesta?: string;
  operador_solicitante: string;
  admin_aprobador?: string;
}

interface SaldosRecargasData {
  saldos_actuales: SaldoInfo[];
  resumen_saldos: {
    total_puntos: number;
    saldo_total_disponible: number;
  };
  recargas: RecargaInfo[];
  resumen_recargas: {
    total_recargas: number;
    monto_total_recargas: number;
  };
  solicitudes: SolicitudSaldoInfo[];
  resumen_solicitudes: {
    total_solicitudes: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
  };
}

export const ServientregaInformes = ({
  user: _user,
  selectedPoint: _selectedPoint,
}: ServientregaInformesProps) => {
  const isFiltroEstado = (
    v: string
  ): v is "TODOS" | "ACTIVA" | "ANULADA" | "PENDIENTE_ANULACION" =>
    v === "TODOS" ||
    v === "ACTIVA" ||
    v === "ANULADA" ||
    v === "PENDIENTE_ANULACION";

  const hoy = new Date();
  const [activeTab, setActiveTab] = useState<"guias" | "saldos">("guias");
  
  // Estado para informe de guías
  const [guias, setGuias] = useState<Guia[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasGuias | null>(
    null
  );
  const [desde, setDesde] = useState(format(subDays(hoy, 30), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [filtroEstado, setFiltroEstado] = useState<
    "TODOS" | "ACTIVA" | "ANULADA" | "PENDIENTE_ANULACION"
  >("TODOS");
  const [filtroPunto, setFiltroPunto] = useState<string>("TODOS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para informe de saldos
  const [saldosData, setSaldosData] = useState<SaldosRecargasData | null>(null);
  const [loadingSaldos, setLoadingSaldos] = useState(false);

  const desdeRef = useRef(desde);
  const hastaRef = useRef(hasta);
  const filtroEstadoRef = useRef(filtroEstado);
  const filtroPuntoRef = useRef(filtroPunto);

  useEffect(() => {
    desdeRef.current = desde;
  }, [desde]);

  useEffect(() => {
    hastaRef.current = hasta;
  }, [hasta]);

  useEffect(() => {
    filtroEstadoRef.current = filtroEstado;
  }, [filtroEstado]);

  useEffect(() => {
    filtroPuntoRef.current = filtroPunto;
  }, [filtroPunto]);
  
  // Fetch saldos y recargas
  const fetchSaldosRecargas = useCallback(async () => {
    setLoadingSaldos(true);
    try {
      const response = await axiosInstance.get<{ data: SaldosRecargasData; success: boolean }>(
        "/servientrega/informes/saldos-recargas"
      );
      if (response.data?.data) {
        setSaldosData(response.data.data);
      }
    } catch (err: unknown) {
      console.error("Error al cargar saldos y recargas:", err);
      toast.error("No se pudieron cargar los datos de saldos");
    } finally {
      setLoadingSaldos(false);
    }
  }, []);
  
  useEffect(() => {
    if (activeTab === "saldos") {
      fetchSaldosRecargas();
    }
  }, [activeTab, fetchSaldosRecargas]);

  const fetchInformes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const desdeValue = desdeRef.current;
      const hastaValue = hastaRef.current;
      const filtroEstadoValue = filtroEstadoRef.current;
      const filtroPuntoValue = filtroPuntoRef.current;

      const [guiasResponse, estadisticasResponse] = await Promise.all([
        axiosInstance.get<{ data: Guia[]; success: boolean }>(
          "/servientrega/informes/guias",
          {
            params: {
              desde: desdeValue,
              hasta: hastaValue,
              estado:
                filtroEstadoValue === "TODOS"
                  ? undefined
                  : filtroEstadoValue,
              punto_atencion_id:
                filtroPuntoValue === "TODOS" ? undefined : filtroPuntoValue,
            },
          }
        ),
        axiosInstance.get<{ data: EstadisticasGuias; success: boolean }>(
          "/servientrega/informes/estadisticas",
          {
            params: { desde: desdeValue, hasta: hastaValue },
          }
        ),
      ]);

      // Acceder a la propiedad 'data' de la respuesta del backend
      if (Array.isArray(guiasResponse.data?.data)) {
        setGuias(guiasResponse.data.data);
      } else {
        setGuias([]);
      }

      if (estadisticasResponse.data?.data) {
        setEstadisticas(estadisticasResponse.data.data);
      } else {
        setEstadisticas(null);
      }

      if ((guiasResponse.data?.data || []).length === 0) {
        toast.info("No se encontraron guías en el período seleccionado.");
      }
    } catch (err: unknown) {
      console.error("Error al cargar informes:", err);

      if (getAxiosStatus(err) === 404) {
        setError(
          "Los endpoints de informes de Servientrega no están disponibles en el backend."
        );
        toast.warning(
          "Funcionalidad de informes no disponible. Contacte al administrador."
        );
      } else {
        setError("Error al cargar los informes de Servientrega.");
        toast.error("No se pudieron cargar los informes.");
      }

      setGuias([]);
      setEstadisticas(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInformes();
  }, [fetchInformes]);

  const handleExportarExcel = async () => {
    try {
      const response = await axiosInstance.get(
        "/servientrega/informes/exportar",
        {
          params: {
            desde,
            hasta,
            estado: filtroEstado === "TODOS" ? undefined : filtroEstado,
            punto_atencion_id:
              filtroPunto === "TODOS" ? undefined : filtroPunto,
          },
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `informe_servientrega_${desde}_${hasta}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("✅ Informe exportado exitosamente");
    } catch (err: unknown) {
      console.error("Error al exportar:", err);

      if (getAxiosStatus(err) === 404) {
        toast.warning(
          "Funcionalidad de exportación no disponible. Contacte al administrador."
        );
      } else {
        toast.error("Error al exportar el informe");
      }
    }
  };
  
  const handleExportarSaldosExcel = async () => {
    try {
      const response = await axiosInstance.get(
        "/servientrega/informes/exportar-saldos-recargas",
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fechaActual = format(new Date(), "yyyy-MM-dd");
      link.download = `informe_saldos_servientrega_${fechaActual}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("✅ Informe de saldos exportado exitosamente");
    } catch (err: unknown) {
      console.error("Error al exportar saldos:", err);
      toast.error("Error al exportar el informe de saldos");
    }
  };

  const handleVerPDF = (base64: string) => {
    try {
      const pdfURL = `data:application/pdf;base64,${base64}`;
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe width="100%" height="100%" style="border:none;" src="${pdfURL}"></iframe>`
        );
      } else {
        toast.error(
          "No se pudo abrir la ventana del PDF. Verifique que no esté bloqueada por el navegador."
        );
      }
    } catch (err) {
      console.error("Error al mostrar PDF:", err);
      toast.error("Error al mostrar el PDF");
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "ACTIVA":
        return <Badge className="bg-green-100 text-green-800">Activa</Badge>;
      case "ANULADA":
        return <Badge className="bg-red-100 text-red-800">Anulada</Badge>;
      case "PENDIENTE_ANULACION":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            Pendiente Anulación
          </Badge>
        );
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const guiasFiltradas = (guias || []).filter((guia) => {
    const cumpleEstado =
      filtroEstado === "TODOS" || guia.estado === filtroEstado;
    const cumplePunto =
      filtroPunto === "TODOS" || guia.punto_atencion_id === filtroPunto;
    return cumpleEstado && cumplePunto;
  });

  // Obtener lista única de puntos para el filtro
  const puntosUnicos = Array.from(
    new Set((guias || []).map((g) => g.punto_atencion_id))
  ).map((id) => {
    const guia = (guias || []).find((g) => g.punto_atencion_id === id);
    return {
      id,
      nombre: guia?.punto_atencion_nombre || `Punto ${id}`,
    };
  });

  // Si hay error 404, mostrar mensaje informativo
  if (error && error.includes("no están disponibles")) {
    return (
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            Informes de Servientrega
          </h1>
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  Funcionalidad en Desarrollo
                </h3>
                <p className="text-yellow-700 mb-4">
                  Los informes de Servientrega aún no están disponibles en el
                  backend.
                </p>
                <p className="text-sm text-yellow-600">
                  Esta funcionalidad será habilitada próximamente. Contacte al
                  administrador del sistema para más información.
                </p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Renderizar el badge de estado para solicitudes
  const getEstadoSolicitudBadge = (estado: string) => {
    switch (estado) {
      case "APROBADA":
        return <Badge className="bg-green-100 text-green-800">Aprobada</Badge>;
      case "RECHAZADA":
        return <Badge className="bg-red-100 text-red-800">Rechazada</Badge>;
      case "PENDIENTE":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Informes de Servientrega
        </h1>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "guias" ? "default" : "outline"}
            onClick={() => setActiveTab("guias")}
            className={activeTab === "guias" ? "bg-blue-600" : ""}
          >
            <FileText className="w-4 h-4 mr-2" />
            Guías
          </Button>
          <Button
            variant={activeTab === "saldos" ? "default" : "outline"}
            onClick={() => setActiveTab("saldos")}
            className={activeTab === "saldos" ? "bg-blue-600" : ""}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Saldos y Recargas
          </Button>
        </div>
      </div>

      {activeTab === "guias" ? (
        <>
          {/* Botón exportar */}
          <div className="flex justify-end">
            <Button
              onClick={handleExportarExcel}
              className="bg-green-600 hover:bg-green-700"
              disabled={loading || error !== null}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>

          {/* Estadísticas generales */}
          {estadisticas && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Guías
                      </p>
                      <p className="text-2xl font-bold">
                        {estadisticas.total_guias}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Activas</p>
                      <p className="text-2xl font-bold text-green-600">
                        {estadisticas.guias_activas}
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Anuladas</p>
                      <p className="text-2xl font-bold text-red-600">
                        {estadisticas.guias_anuladas}
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Pendientes
                      </p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {estadisticas.guias_pendientes_anulacion}
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Listado de Guías</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-32">
                  <Label className="text-sm">Desde</Label>
                  <Input
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-32">
                  <Label className="text-sm">Hasta</Label>
                  <Input
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-32">
                  <Label className="text-sm">Estado</Label>
                  <select
                    value={filtroEstado}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFiltroEstado(isFiltroEstado(v) ? v : "TODOS");
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  >
                    <option value="TODOS">Todos</option>
                    <option value="ACTIVA">Activas</option>
                    <option value="ANULADA">Anuladas</option>
                    <option value="PENDIENTE_ANULACION">
                      Pendientes Anulación
                    </option>
                  </select>
                </div>
                <div className="flex-1 min-w-32">
                  <Label className="text-sm">Punto de Atención</Label>
                  <select
                    value={filtroPunto}
                    onChange={(e) => setFiltroPunto(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  >
                    <option value="TODOS">Todos los puntos</option>
                    {puntosUnicos.map((punto) => (
                      <option key={punto.id} value={punto.id}>
                        {punto.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={fetchInformes} className="self-end h-9">
                  Buscar
                </Button>
              </div>

              {/* Lista de guías */}
              {loading ? (
                <Loading text="Cargando informes..." className="py-8" />
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={fetchInformes} variant="outline">
                    Reintentar
                  </Button>
                </div>
              ) : guiasFiltradas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay guías en este periodo con los filtros seleccionados.
                </p>
              ) : (
                <div className="space-y-4">
                  {guiasFiltradas.map((guia) => (
                    <div
                      key={guia.id}
                      className="border rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            Guía: {guia.numero_guia}
                          </h3>
                          {getEstadoBadge(guia.estado)}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <strong>Fecha:</strong>{" "}
                            {format(
                              parseISO(
                                guia.fecha_creacion ||
                                  guia.created_at ||
                                  new Date().toISOString()
                              ),
                              "yyyy-MM-dd HH:mm"
                            )}
                          </p>
                          <p>
                            <strong>Punto:</strong>{" "}
                            {guia.punto_atencion_nombre || "N/A"}
                          </p>
                          {/* Agencia */}
                          <p>
                            <strong>Agencia:</strong>{" "}
                            {guia.agencia_nombre || guia.agencia_codigo || "N/A"}
                          </p>
                          {/* Ciudad Origen */}
                          <p>
                            <strong>Ciudad Origen:</strong>{" "}
                            {guia.ciudad_origen || "N/A"}
                            {guia.provincia_origen && ` (${guia.provincia_origen})`}
                          </p>
                          {/* Ciudad Destino */}
                          <p>
                            <strong>Ciudad Destino:</strong>{" "}
                            {guia.ciudad_destino || "N/A"}
                            {guia.provincia_destino && ` (${guia.provincia_destino})`}
                          </p>
                          {guia.usuario_nombre && (
                            <p>
                              <strong>Usuario:</strong> {guia.usuario_nombre}
                            </p>
                          )}
                          {guia.destinatario_nombre && (
                            <p>
                              <strong>Destinatario:</strong>{" "}
                              {guia.destinatario_nombre}
                            </p>
                          )}
                          {guia.destinatario_telefono && (
                            <p>
                              <strong>Teléfono:</strong>{" "}
                              {guia.destinatario_telefono}
                            </p>
                          )}
                          {guia.valor_declarado !== undefined && (
                            <p>
                              <strong>Valor Declarado:</strong> $
                              {guia.valor_declarado.toLocaleString()}
                            </p>
                          )}
                          {(guia.costo_envio !== undefined || guia.valor_cobrado !== undefined) && (
                            <p>
                              <strong>Valor Cobrado:</strong>{" "}
                              <span className="font-semibold text-green-700">
                                ${(guia.valor_cobrado || guia.costo_envio || 0).toLocaleString()}
                              </span>
                            </p>
                          )}
                          {guia.motivo_anulacion && (
                            <p>
                              <strong>Motivo anulación:</strong>{" "}
                              {guia.motivo_anulacion}
                            </p>
                          )}
                          {guia.fecha_anulacion && (
                            <p>
                              <strong>Fecha anulación:</strong>{" "}
                              {format(
                                parseISO(guia.fecha_anulacion),
                                "yyyy-MM-dd HH:mm"
                              )}
                            </p>
                          )}
                          {guia.anulada_por && (
                            <p>
                              <strong>Anulada por:</strong> {guia.anulada_por}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleVerPDF(
                              guia.pdf_base64 || guia.base64_response || ""
                            )
                          }
                          disabled={!guia.pdf_base64 && !guia.base64_response}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estadísticas por punto */}
          {estadisticas &&
            estadisticas.total_por_punto &&
            estadisticas.total_por_punto.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Estadísticas por Punto de Atención</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {estadisticas.total_por_punto.map((punto, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">
                          {punto.punto_atencion_nombre}
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Total</p>
                            <p className="text-lg font-bold">{punto.total}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Activas</p>
                            <p className="text-lg font-bold text-green-600">
                              {punto.activas}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Anuladas</p>
                            <p className="text-lg font-bold text-red-600">
                              {punto.anuladas}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </>
      ) : (
        /* Tab de Saldos y Recargas */
        <>
          {/* Botón exportar */}
          <div className="flex justify-end">
            <Button
              onClick={handleExportarSaldosExcel}
              className="bg-green-600 hover:bg-green-700"
              disabled={loadingSaldos}
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>

          {loadingSaldos ? (
            <Loading text="Cargando datos de saldos..." className="py-8" />
          ) : saldosData ? (
            <>
              {/* Resumen de Saldos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Puntos Activos
                        </p>
                        <p className="text-2xl font-bold">
                          {saldosData.resumen_saldos.total_puntos}
                        </p>
                      </div>
                      <Wallet className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Saldo Total Disponible
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          ${saldosData.resumen_saldos.saldo_total_disponible.toLocaleString()}
                        </p>
                      </div>
                      <CreditCard className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Total Recargado
                        </p>
                        <p className="text-2xl font-bold text-purple-600">
                          ${saldosData.resumen_recargas.monto_total_recargas.toLocaleString()}
                        </p>
                      </div>
                      <History className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Saldos por Punto */}
              <Card>
                <CardHeader>
                  <CardTitle>Saldos por Punto de Atención</CardTitle>
                </CardHeader>
                <CardContent>
                  {saldosData.saldos_actuales.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No hay saldos registrados.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {saldosData.saldos_actuales.map((saldo) => (
                        <div key={saldo.punto_id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{saldo.punto_nombre}</h3>
                              <p className="text-sm text-gray-600">{saldo.punto_ciudad}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-600">
                                ${saldo.saldo_disponible.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">Disponible</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                            <div>
                              <p className="text-gray-600">Billetes</p>
                              <p className="font-semibold">${saldo.billetes.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Monedas</p>
                              <p className="font-semibold">${saldo.monedas_fisicas.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Bancos</p>
                              <p className="font-semibold">${saldo.bancos.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen de Solicitudes */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumen de Solicitudes de Saldo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-600">Total Solicitudes</p>
                      <p className="text-2xl font-bold">{saldosData.resumen_solicitudes.total_solicitudes}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-yellow-600">Pendientes</p>
                      <p className="text-2xl font-bold text-yellow-700">{saldosData.resumen_solicitudes.pendientes}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-green-600">Aprobadas</p>
                      <p className="text-2xl font-bold text-green-700">{saldosData.resumen_solicitudes.aprobadas}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-red-600">Rechazadas</p>
                      <p className="text-2xl font-bold text-red-700">{saldosData.resumen_solicitudes.rechazadas}</p>
                    </div>
                  </div>

                  {saldosData.solicitudes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No hay solicitudes registradas.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {saldosData.solicitudes.map((solicitud) => (
                        <div key={solicitud.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{solicitud.punto_nombre}</h3>
                                {getEstadoSolicitudBadge(solicitud.estado)}
                              </div>
                              <p className="text-sm text-gray-600">{solicitud.punto_ciudad}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">
                                ${solicitud.monto_solicitado.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">Monto solicitado</p>
                            </div>
                          </div>
                          <div className="mt-3 text-sm space-y-1">
                            <p>
                              <strong>Fecha solicitud:</strong>{" "}
                              {format(parseISO(solicitud.fecha_solicitud), "yyyy-MM-dd HH:mm")}
                            </p>
                            {solicitud.fecha_respuesta && (
                              <p>
                                <strong>Fecha respuesta:</strong>{" "}
                                {format(parseISO(solicitud.fecha_respuesta), "yyyy-MM-dd HH:mm")}
                              </p>
                            )}
                            {solicitud.admin_aprobador && (
                              <p>
                                <strong>Administrador:</strong>{" "}
                                {solicitud.admin_aprobador}
                              </p>
                            )}
                            {solicitud.observaciones && (
                              <p>
                                <strong>Observaciones:</strong>{" "}
                                {solicitud.observaciones}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial de Recargas */}
              <Card>
                <CardHeader>
                  <CardTitle>Historial de Recargas</CardTitle>
                </CardHeader>
                <CardContent>
                  {saldosData.recargas.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No hay recargas registradas.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {saldosData.recargas.map((recarga) => (
                        <div key={recarga.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold">{recarga.punto_nombre}</h3>
                              <p className="text-sm text-gray-600">{recarga.punto_ciudad}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-green-600">
                                +${recarga.monto.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">{recarga.tipo}</p>
                            </div>
                          </div>
                          <div className="mt-3 text-sm space-y-1">
                            <p>
                              <strong>Fecha:</strong>{" "}
                              {format(parseISO(recarga.fecha), "yyyy-MM-dd HH:mm")}
                            </p>
                            <p>
                              <strong>Asignado por:</strong>{" "}
                              {recarga.asignado_por}
                            </p>
                            {recarga.observaciones && (
                              <p>
                                <strong>Observaciones:</strong>{" "}
                                {recarga.observaciones}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">Error al cargar los datos de saldos</p>
              <Button onClick={fetchSaldosRecargas} variant="outline">
                Reintentar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServientregaInformes;
