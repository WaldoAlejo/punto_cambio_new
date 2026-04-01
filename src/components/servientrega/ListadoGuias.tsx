"use client";

import React, { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/services/axiosInstance";
import { format, isToday, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Loading } from "@/components/ui/loading";
import SaldoCompacto from "./SaldoCompacto";
import { useAuth } from "@/hooks/useAuth";
import { Guia } from "@/types/servientrega";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";

export default function ListadoGuias() {
  const hoy = new Date();
  const [guias, setGuias] = useState<Guia[]>([]);
  const [desde, setDesde] = useState(format(subDays(hoy, 7), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const { user } = useAuth();

  // Estados para solicitud de anulación
  const [showAnulacionDialog, setShowAnulacionDialog] = useState(false);
  const [guiaParaAnular, setGuiaParaAnular] = useState<Guia | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const fetchGuias = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get("/servientrega/informes/guias", {
        params: { desde, hasta },
      });

      if (response.data && Array.isArray(response.data.data)) {
        setGuias(response.data.data);
        if (response.data.data.length === 0) {
          toast.info("No se encontraron guías en el período seleccionado.");
        }
      } else {
        throw new Error("Formato de respuesta inválido");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al cargar guías: ${errorMessage}`);
      toast.error("No se pudieron cargar las guías.");
      setGuias([]);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  const handleSolicitarAnulacion = (guia: Guia) => {
    setGuiaParaAnular(guia);
    setMotivoAnulacion("");
    setShowAnulacionDialog(true);
  };

  const handleConfirmarSolicitudAnulacion = async () => {
    if (!guiaParaAnular || !motivoAnulacion.trim()) {
      toast.error("Debe proporcionar un motivo para la anulación");
      return;
    }

    try {
      await axiosInstance.post("/servientrega/solicitar-anulacion", {
        guia_id: guiaParaAnular.id,
        numero_guia: guiaParaAnular.numero_guia,
        motivo: motivoAnulacion.trim(),
      });

      toast.success(
        "✅ Solicitud de anulación enviada. Esperando aprobación del administrador."
      );
      setShowAnulacionDialog(false);
      setGuiaParaAnular(null);
      setMotivoAnulacion("");
      fetchGuias();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error desconocido";
      console.error("Error al solicitar anulación:", err);
      toast.error(`No se pudo enviar la solicitud: ${errorMessage}`);
    }
  };

  const handleAnularDirecto = (guia: Guia) => {
    showConfirmation(
      "Confirmar anulación",
      `¿Está seguro de que desea anular la guía ${guia.numero_guia}? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await axiosInstance.post("/servientrega/anular-guia", {
            guia: guia.numero_guia,
            motivo: "Anulación directa por administrador",
          });
          toast.success("✅ Guía anulada exitosamente.");
          fetchGuias();
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Error desconocido";
          console.error("Error al anular guía:", err);
          toast.error(`No se pudo anular la guía: ${errorMessage}`);
        }
      },
      "destructive"
    );
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
      console.error("Error al abrir PDF:", err);
      toast.error("Error al mostrar el PDF.");
    }
  };

  useEffect(() => {
    fetchGuias();
  }, [fetchGuias]);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "ACTIVA":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Activa
          </span>
        );
      case "ANULADA":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Anulada
          </span>
        );
      case "PENDIENTE_ANULACION":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pendiente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {estado}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-3 sm:mt-4 space-y-2 sm:space-y-3">
      {/* Información del saldo */}
      {user?.punto_atencion_id && (
        <SaldoCompacto
          puntoAtencionId={user.punto_atencion_id}
          showSolicitar={true}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Guías generadas</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex gap-3 mb-4 flex-wrap items-end">
            <div className="flex-1 min-w-32">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 min-w-32">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button onClick={fetchGuias} className="h-8 text-sm">
              Buscar
            </Button>
          </div>

          {/* Listado de guías */}
          {loading ? (
            <Loading text="Cargando guías..." className="py-4" />
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-destructive mb-2 text-sm">{error}</p>
              <Button onClick={fetchGuias} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          ) : guias.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">
              No hay guías en este periodo.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Guía</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Destinatario</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Destino</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Costo</th>
                    <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Estado</th>
                    <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {guias.map((guia) => {
                    const isExpanded = expandedId === guia.id;
                    return (
                      <React.Fragment key={guia.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                            {guia.numero_guia}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                            {guia.created_at
                              ? format(parseISO(guia.created_at), "dd/MM/yyyy HH:mm")
                              : "N/A"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                            {guia.destinatario_nombre || "N/A"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                            {guia.ciudad_destino || "N/A"}
                            {guia.provincia_destino ? ` (${guia.provincia_destino})` : ""}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-gray-900">
                            {typeof guia.costo_envio === "number"
                              ? `$${guia.costo_envio.toFixed(2)}`
                              : "N/A"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-center">
                            {getEstadoBadge(guia.estado)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                onClick={() => handleVerPDF(guia.base64_response || "")}
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                PDF
                              </Button>

                              {guia.estado === "ACTIVA" &&
                                isToday(parseISO(guia.created_at || "")) && (
                                  <>
                                    {user?.rol === "ADMIN" ||
                                    user?.rol === "SUPER_USUARIO" ? (
                                      <Button
                                        onClick={() => handleAnularDirecto(guia)}
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                      >
                                        Anular
                                      </Button>
                                    ) : (
                                      <Button
                                        onClick={() => handleSolicitarAnulacion(guia)}
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                                      >
                                        Solicitar
                                      </Button>
                                    )}
                                  </>
                                )}

                              {guia.estado === "PENDIENTE_ANULACION" && (
                                <span className="text-xs text-yellow-600 font-medium">
                                  Esperando
                                </span>
                              )}

                              {guia.estado === "ANULADA" && (
                                <span className="text-xs text-red-600 font-medium">
                                  Anulada
                                </span>
                              )}

                              {guia.estado === "ACTIVA" &&
                                !isToday(parseISO(guia.created_at || "")) && (
                                  <span className="text-xs text-gray-500">
                                    Cerrada
                                  </span>
                                )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  setExpandedId(isExpanded ? null : guia.id)
                                }
                                title="Ver detalles"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/50">
                            <td colSpan={7} className="px-3 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm text-gray-700">
                                <p>
                                  <span className="font-medium text-gray-900">Punto:</span>{" "}
                                  {guia.punto_atencion_nombre || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Usuario:</span>{" "}
                                  {guia.usuario_nombre || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Teléfono dest.:</span>{" "}
                                  {guia.destinatario_telefono || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Agencia:</span>{" "}
                                  {guia.agencia_nombre || guia.agencia_codigo || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Alianza:</span>{" "}
                                  {guia.alianza || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Oficina Alianza:</span>{" "}
                                  {guia.oficina_alianza || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Ciudad Origen:</span>{" "}
                                  {guia.ciudad_origen || "N/A"}
                                  {guia.provincia_origen ? ` (${guia.provincia_origen})` : ""}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Dirección dest.:</span>{" "}
                                  {guia.destinatario_direccion || "N/A"}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-900">Valor Declarado:</span>{" "}
                                  {guia.valor_declarado !== undefined
                                    ? `$${guia.valor_declarado.toLocaleString()}`
                                    : "N/A"}
                                </p>
                                {guia.motivo_anulacion && (
                                  <p className="sm:col-span-2 lg:col-span-3">
                                    <span className="font-medium text-gray-900">Motivo anulación:</span>{" "}
                                    {guia.motivo_anulacion}
                                  </p>
                                )}
                                {guia.fecha_anulacion && (
                                  <p>
                                    <span className="font-medium text-gray-900">Fecha anulación:</span>{" "}
                                    {format(parseISO(guia.fecha_anulacion), "dd/MM/yyyy HH:mm")}
                                  </p>
                                )}
                                {guia.anulada_por && (
                                  <p>
                                    <span className="font-medium text-gray-900">Anulada por:</span>{" "}
                                    {guia.anulada_por}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        <ConfirmationDialog />
      </Card>

      {/* Modal para solicitar anulación */}
      <Dialog open={showAnulacionDialog} onOpenChange={setShowAnulacionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Anulación de Guía</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p>
                <strong>Guía:</strong> {guiaParaAnular?.numero_guia}
              </p>
              <p>
                <strong>Fecha:</strong>{" "}
                {guiaParaAnular &&
                  format(
                    parseISO(guiaParaAnular.created_at || ""),
                    "yyyy-MM-dd HH:mm"
                  )}
              </p>
            </div>
            <div>
              <Label htmlFor="motivo">Motivo de la anulación *</Label>
              <Textarea
                id="motivo"
                placeholder="Explique el motivo por el cual solicita la anulación de esta guía..."
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAnulacionDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarSolicitudAnulacion}
              disabled={!motivoAnulacion.trim()}
            >
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
