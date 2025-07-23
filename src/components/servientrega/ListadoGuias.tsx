"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { format, isToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Guia {
  id: string;
  numero_guia: string;
  base64_response: string;
  created_at: string;
}

export default function ListadoGuias() {
  const [guias, setGuias] = useState<Guia[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const fetchGuias = async () => {
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
      setGuias([]);
    }
  };

  const handleAnular = async (guia: string) => {
    try {
      await axios.post("/api/servientrega/anular-guia", { guia });
      alert("Guía anulada exitosamente");
      fetchGuias();
    } catch (err) {
      console.error("Error al anular guía:", err);
      alert("No se pudo anular la guía");
    }
  };

  const handleVerPDF = (base64: string) => {
    const pdfURL = `data:application/pdf;base64,${base64}`;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe width="100%" height="100%" src="${pdfURL}"></iframe>`
      );
    }
  };

  useEffect(() => {
    if (desde && hasta) fetchGuias();
  }, [desde, hasta]);

  return (
    <Card className="w-full max-w-4xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Guías generadas</CardTitle>
      </CardHeader>
      <CardContent>
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
        </div>

        {guias.length === 0 ? (
          <p>No hay guías en este periodo.</p>
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
