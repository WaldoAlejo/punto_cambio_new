import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Loading } from "@/components/ui/loading";
import { SolicitudAnulacionGuia } from "@/types/servientrega";
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

const extractErrorMessage = (err: unknown): string => {
  if (!isRecord(err)) return "Error desconocido";
  const response = err.response;
  if (isRecord(response)) {
    const data = response.data;
    if (isRecord(data) && typeof data.message === "string") return data.message;
  }
  const message = err.message;
  return typeof message === "string" ? message : "Error desconocido";
};

interface ServientregaAnulacionesProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

export const ServientregaAnulaciones = ({
  user: _user,
  selectedPoint: _selectedPoint,
}: ServientregaAnulacionesProps) => {
  const isFiltroEstado = (
    v: string
  ): v is "TODOS" | "PENDIENTE" | "APROBADA" | "RECHAZADA" =>
    v === "TODOS" || v === "PENDIENTE" || v === "APROBADA" || v === "RECHAZADA";

  const hoy = new Date();
  const [solicitudes, setSolicitudes] = useState<SolicitudAnulacionGuia[]>([]);
  const [desde, setDesde] = useState(format(subDays(hoy, 30), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [filtroEstado, setFiltroEstado] = useState<
    "TODOS" | "PENDIENTE" | "APROBADA" | "RECHAZADA"
  >("TODOS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const desdeRef = useRef(desde);
  const hastaRef = useRef(hasta);
  const filtroEstadoRef = useRef(filtroEstado);

  useEffect(() => {
    desdeRef.current = desde;
  }, [desde]);

  useEffect(() => {
    hastaRef.current = hasta;
  }, [hasta]);

  useEffect(() => {
    filtroEstadoRef.current = filtroEstado;
  }, [filtroEstado]);

  // Estados para modal de respuesta
  const [showRespuestaDialog, setShowRespuestaDialog] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] =
    useState<SolicitudAnulacionGuia | null>(null);
  const [comentarioRespuesta, setComentarioRespuesta] = useState("");
  const [accionRespuesta, setAccionRespuesta] = useState<
    "APROBAR" | "RECHAZAR"
  >("APROBAR");

  const { ConfirmationDialog } = useConfirmationDialog();

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const desdeValue = desdeRef.current;
      const hastaValue = hastaRef.current;
      const filtroEstadoValue = filtroEstadoRef.current;

      const response = await axiosInstance.get(
        "/servientrega/solicitudes-anulacion",
        {
          params: {
            desde: desdeValue,
            hasta: hastaValue,
            estado:
              filtroEstadoValue === "TODOS" ? undefined : filtroEstadoValue,
          },
        }
      );

      // El backend devuelve { success: true, data: [...] }
      const data = response.data?.data || response.data;

      if (Array.isArray(data)) {
        setSolicitudes(data);
        if (data.length === 0) {
          toast.info(
            "No se encontraron solicitudes en el período seleccionado."
          );
        }
      } else {
        console.error("Respuesta inesperada del servidor:", response.data);
        setSolicitudes([]);
        toast.warning("No se recibieron solicitudes del servidor.");
      }
    } catch (err: unknown) {
      console.error("Error al cargar solicitudes:", err);

      if (getAxiosStatus(err) === 404) {
        setError(
          "Los endpoints de anulaciones de Servientrega no están disponibles en el backend."
        );
        toast.warning(
          "Funcionalidad de anulaciones no disponible. Contacte al administrador."
        );
      } else {
        setError("Error al cargar las solicitudes de anulación.");
        toast.error("No se pudieron cargar las solicitudes.");
      }

      setSolicitudes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  const handleResponderSolicitud = (
    solicitud: SolicitudAnulacionGuia,
    accion: "APROBAR" | "RECHAZAR"
  ) => {
    setSolicitudSeleccionada(solicitud);
    setAccionRespuesta(accion);
    setComentarioRespuesta("");
    setShowRespuestaDialog(true);
  };

  const handleConfirmarRespuesta = async () => {
    if (!solicitudSeleccionada) return;

    try {
      // Usar el endpoint correcto con el método y parámetros correctos
      await axiosInstance.post("/servientrega/responder-solicitud-anulacion", {
        solicitud_id: solicitudSeleccionada.id,
        accion: accionRespuesta,
        comentario: comentarioRespuesta.trim() || undefined,
      });

      const mensaje =
        accionRespuesta === "APROBAR"
          ? "✅ Solicitud aprobada y guía anulada exitosamente."
          : "❌ Solicitud rechazada.";

      toast.success(mensaje);
      setShowRespuestaDialog(false);
      setSolicitudSeleccionada(null);
      setComentarioRespuesta("");
      fetchSolicitudes();
    } catch (err: unknown) {
      const errorMessage = extractErrorMessage(err);
      console.error("Error al responder solicitud:", err);
      toast.error(`No se pudo procesar la respuesta: ${errorMessage}`);
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "PENDIENTE":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pendiente
          </Badge>
        );
      case "APROBADA":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprobada
          </Badge>
        );
      case "RECHAZADA":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rechazada
          </Badge>
        );
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const solicitudesFiltradas = solicitudes.filter(
    (solicitud) => filtroEstado === "TODOS" || solicitud.estado === filtroEstado
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Gestión de Anulaciones - Servientrega
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de Anulación de Guías</CardTitle>
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
                <option value="PENDIENTE">Pendientes</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="RECHAZADA">Rechazadas</option>
              </select>
            </div>
            <Button onClick={fetchSolicitudes} className="self-end h-9">
              Buscar
            </Button>
          </div>

          {/* Lista de solicitudes */}
          {loading ? (
            <Loading text="Cargando solicitudes..." className="py-8" />
          ) : error ? (
            <div className="text-center py-8">
              {error.includes("no están disponibles") ? (
                <Card className="border-yellow-200 bg-yellow-50 max-w-md mx-auto">
                  <CardContent className="p-6 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                          Funcionalidad en Desarrollo
                        </h3>
                        <p className="text-yellow-700 mb-4">
                          Las anulaciones de Servientrega aún no están
                          disponibles en el backend.
                        </p>
                        <p className="text-sm text-yellow-600">
                          Esta funcionalidad será habilitada próximamente.
                        </p>
                      </div>
                      <Button
                        onClick={fetchSolicitudes}
                        variant="outline"
                        className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reintentar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div>
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={fetchSolicitudes} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reintentar
                  </Button>
                </div>
              )}
            </div>
          ) : solicitudesFiltradas.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay solicitudes en este periodo.
            </p>
          ) : (
            <div className="space-y-4">
              {solicitudesFiltradas.map((solicitud) => (
                <div
                  key={solicitud.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          Guía: {solicitud.numero_guia}
                        </h3>
                        {getEstadoBadge(solicitud.estado)}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <strong>Solicitado por:</strong>{" "}
                          {solicitud.solicitado_por_nombre}
                        </p>
                        <p>
                          <strong>Punto:</strong>{" "}
                          {solicitud.punto_atencion_nombre}
                        </p>
                        <p>
                          <strong>Fecha solicitud:</strong>{" "}
                          {format(
                            parseISO(solicitud.fecha_solicitud),
                            "yyyy-MM-dd HH:mm"
                          )}
                        </p>
                        <p>
                          <strong>Motivo:</strong>{" "}
                          {solicitud.motivo_anulacion || solicitud.motivo}
                        </p>
                      </div>
                    </div>

                    {solicitud.estado === "PENDIENTE" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() =>
                            handleResponderSolicitud(solicitud, "APROBAR")
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() =>
                            handleResponderSolicitud(solicitud, "RECHAZAR")
                          }
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Información de respuesta si ya fue procesada */}
                  {solicitud.estado !== "PENDIENTE" && (
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      <p>
                        <strong>Respondido por:</strong>{" "}
                        {solicitud.respondido_por_nombre}
                      </p>
                      <p>
                        <strong>Fecha respuesta:</strong>{" "}
                        {solicitud.fecha_respuesta &&
                          format(
                            parseISO(solicitud.fecha_respuesta),
                            "yyyy-MM-dd HH:mm"
                          )}
                      </p>
                      {(solicitud.comentario_respuesta ||
                        solicitud.observaciones_respuesta) && (
                        <p>
                          <strong>Comentario:</strong>{" "}
                          {solicitud.comentario_respuesta ||
                            solicitud.observaciones_respuesta}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para responder solicitud */}
      <Dialog open={showRespuestaDialog} onOpenChange={setShowRespuestaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accionRespuesta === "APROBAR" ? "Aprobar" : "Rechazar"} Solicitud
              de Anulación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded">
              <p>
                <strong>Guía:</strong> {solicitudSeleccionada?.numero_guia}
              </p>
              <p>
                <strong>Solicitado por:</strong>{" "}
                {solicitudSeleccionada?.solicitado_por_nombre}
              </p>
              <p>
                <strong>Motivo:</strong>{" "}
                {solicitudSeleccionada?.motivo_anulacion ||
                  solicitudSeleccionada?.motivo}
              </p>
            </div>
            <div>
              <Label htmlFor="comentario">
                Comentario{" "}
                {accionRespuesta === "RECHAZAR" ? "(requerido)" : "(opcional)"}
              </Label>
              <Textarea
                id="comentario"
                placeholder={
                  accionRespuesta === "APROBAR"
                    ? "Comentario adicional sobre la aprobación..."
                    : "Explique el motivo del rechazo..."
                }
                value={comentarioRespuesta}
                onChange={(e) => setComentarioRespuesta(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRespuestaDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarRespuesta}
              disabled={
                accionRespuesta === "RECHAZAR" && !comentarioRespuesta.trim()
              }
              variant={
                accionRespuesta === "APROBAR" ? "default" : "destructive"
              }
            >
              {accionRespuesta === "APROBAR"
                ? "Aprobar y Anular"
                : "Rechazar Solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog />
    </div>
  );
};

export default ServientregaAnulaciones;
