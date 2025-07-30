"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { format, isToday, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  const fetchGuias = async () => {
    setLoading(true);
    try {
      const response = await axios.get<Guia[]>("/api/servientrega/guias", {
        params: { desde, hasta },
      });

      if (Array.isArray(response.data)) {
        setGuias(response.data);
      } else {
        console.error("Respuesta inesperada:", response.data);
        setGuias([]);
      }
    } catch (err) {
      console.error("Error al cargar guías:", err);
      toast.error("No se pudieron cargar las guías.");
      setGuias([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async (guia: string) => {
    try {
      await axios.post("/api/servientrega/anular-guia", { guia });
      toast.success("✅ Guía anulada exitosamente.");
      fetchGuias();
    } catch (err) {
      console.error("Error al anular guía:", err);
      toast.error("No se pudo anular la guía.");
    }
  };

  const handleVerPDF = (base64: string) => {
    const pdfURL = `data:application/pdf;base64,${base64}`;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe width="100%" height="100%" style="border:none;" src="${pdfURL}"></iframe>`
      );
    }
  };

  useEffect(() => {
    fetchGuias();
  }, [desde, hasta]);

  return (
    <Card className="w-full max-w-4xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>📦 Guías generadas</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex gap-4 mb-4">
          <div>
            <Label>Desde</Label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <Button onClick={fetchGuias} className="self-end">
            Buscar
          </Button>
        </div>

        {/* Listado de guías */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : guias.length === 0 ? (
          <p className="text-gray-600">No hay guías en este periodo.</p>
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
    </Card>
  );
}
