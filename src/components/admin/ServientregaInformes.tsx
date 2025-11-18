import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import { Download, Eye, FileText, BarChart3, RefreshCw } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { Guia } from "@/types/servientrega";
import axiosInstance from "@/services/axiosInstance";
import { User, PuntoAtencion } from "@/types";

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

export const ServientregaInformes = ({
  user: _user,
  selectedPoint: _selectedPoint,
}: ServientregaInformesProps) => {
  const hoy = new Date();
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

  const fetchInformes = async () => {
    setLoading(true);
    setError(null);

    try {
      const [guiasResponse, estadisticasResponse] = await Promise.all([
        axiosInstance.get<{ data: Guia[]; success: boolean }>(
          "/servientrega/informes/guias",
          {
            params: {
              desde,
              hasta,
              estado: filtroEstado === "TODOS" ? undefined : filtroEstado,
              punto_atencion_id:
                filtroPunto === "TODOS" ? undefined : filtroPunto,
            },
          }
        ),
        axiosInstance.get<{ data: EstadisticasGuias; success: boolean }>(
          "/servientrega/informes/estadisticas",
          {
            params: { desde, hasta },
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
    } catch (err: any) {
      console.error("Error al cargar informes:", err);

      if (err.response?.status === 404) {
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
  };

  useEffect(() => {
    fetchInformes();
  }, []);

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
    } catch (err: any) {
      console.error("Error al exportar:", err);

      if (err.response?.status === 404) {
        toast.warning(
          "Funcionalidad de exportación no disponible. Contacte al administrador."
        );
      } else {
        toast.error("Error al exportar el informe");
      }
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Informes de Servientrega
        </h1>
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
                onChange={(e) => setFiltroEstado(e.target.value as any)}
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
                      {guia.valor_declarado && (
                        <p>
                          <strong>Valor Declarado:</strong> $
                          {guia.valor_declarado.toLocaleString()}
                        </p>
                      )}
                      {guia.costo_envio && (
                        <p>
                          <strong>Costo Envío:</strong> $
                          {guia.costo_envio.toLocaleString()}
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
    </div>
  );
};

export default ServientregaInformes;
