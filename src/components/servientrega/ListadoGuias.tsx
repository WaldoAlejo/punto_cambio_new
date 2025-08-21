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

interface Guia {
  id: string;
  numero_guia: string;
  base64_response: string;
  created_at: string;
}

export default function ListadoGuias() {
  const hoy = new Date();
  const [guias, setGuias] = useState<Guia[]>([]);
  const [desde, setDesde] = useState(format(subDays(hoy, 7), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(hoy, "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();
  const { user } = useAuth();

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

  const handleAnular = (guia: string) => {
    showConfirmation(
      "Confirmar anulación",
      `¿Está seguro de que desea anular la guía ${guia}? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await axiosInstance.post("/servientrega/anular-guia", { guia });
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
    <div className="w-full max-w-4xl mx-auto mt-4 space-y-3">
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
                      {format(parseISO(guia.created_at), "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleVerPDF(guia.base64_response)}
                      variant="secondary"
                    >
                      Ver PDF
                    </Button>

                    {isToday(parseISO(guia.created_at)) ? (
                      <Button
                        onClick={() => handleAnular(guia.numero_guia)}
                        variant="destructive"
                      >
                        Anular
                      </Button>
                    ) : (
                      <p className="text-sm text-gray-500 mt-2 md:mt-0">
                        No se puede anular
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <ConfirmationDialog />
      </Card>
    </div>
  );
}
