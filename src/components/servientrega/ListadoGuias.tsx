"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { format, isToday, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

export default function ListadoGuias() {
  const hoy = new Date();
  const [guias, setGuias] = useState<Guia[]>([]);
  const [desde, setDesde] = useState(format(subDays(hoy, 7), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const { user } = useAuth();

  // Estados para solicitud de anulación
  const [showAnulacionDialog, setShowAnulacionDialog] = useState(false);
  const [guiaParaAnular, setGuiaParaAnular] = useState<Guia | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const fetchGuias = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get<Guia[]>("/servientrega/guias", {
        params: { desde, hasta },
      });

      if (Array.isArray(response.data)) {
        setGuias(response.data);
        if (response.data.length === 0) {
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
  };

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
  }, [desde, hasta]);

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
          <div className="flex gap-3 mb-4 flex-wrap">
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
            <Button onClick={fetchGuias} className="self-end h-8 text-sm">
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
            <div className="space-y-4">
              {guias.map((guia) => (
                <div
                  key={guia.id}
                  className="border p-4 rounded flex flex-col md:flex-row justify-between items-start md:items-center gap-2"
                >
                  <div>
                    <p>
                      <strong>Guía:</strong> {guia.numero_guia}
                    </p>
                    <p>
                      <strong>Fecha:</strong>{" "}
                      {format(
                        parseISO(guia.created_at || ""),
                        "yyyy-MM-dd HH:mm"
                      )}
                    </p>
                    <p>
                      <strong>Costo:</strong>{" "}
                      {typeof guia.costo_envio === "number"
                        ? `$${guia.costo_envio.toFixed(2)}`
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Estado:</strong>{" "}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          guia.estado === "ACTIVA"
                            ? "bg-green-100 text-green-800"
                            : guia.estado === "ANULADA"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {guia.estado === "ACTIVA"
                          ? "Activa"
                          : guia.estado === "ANULADA"
                          ? "Anulada"
                          : "Pendiente Anulación"}
                      </span>
                    </p>
                    {guia.motivo_anulacion && (
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Motivo:</strong> {guia.motivo_anulacion}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleVerPDF(guia.base64_response || "")}
                      variant="secondary"
                      size="sm"
                    >
                      Ver PDF
                    </Button>

                    {/* Lógica de botones según rol y estado */}
                    {guia.estado === "ACTIVA" &&
                      isToday(parseISO(guia.created_at || "")) && (
                        <>
                          {user?.rol === "ADMIN" ||
                          user?.rol === "SUPER_USUARIO" ? (
                            <Button
                              onClick={() => handleAnularDirecto(guia)}
                              variant="destructive"
                              size="sm"
                            >
                              Anular
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleSolicitarAnulacion(guia)}
                              variant="outline"
                              size="sm"
                              className="border-orange-300 text-orange-700 hover:bg-orange-50"
                            >
                              Solicitar Anulación
                            </Button>
                          )}
                        </>
                      )}

                    {guia.estado === "PENDIENTE_ANULACION" && (
                      <span className="text-sm text-yellow-600 font-medium">
                        Esperando aprobación
                      </span>
                    )}

                    {guia.estado === "ANULADA" && (
                      <span className="text-sm text-red-600 font-medium">
                        Guía anulada
                      </span>
                    )}

                    {guia.estado === "ACTIVA" &&
                      !isToday(parseISO(guia.created_at || "")) && (
                        <span className="text-sm text-gray-500">
                          No se puede anular
                        </span>
                      )}
                  </div>
                </div>
              ))}
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
