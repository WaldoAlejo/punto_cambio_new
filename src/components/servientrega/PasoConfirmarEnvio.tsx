"use client";

import React, { useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PasoConfirmarEnvioProps {
  formData: any;
  onReset: () => void;
  onSuccess?: () => void;
}

interface GenerarGuiaResponse {
  guia: string;
  base64: string;
  proceso?: string;
}

export default function PasoConfirmarEnvio({
  formData,
  onReset,
  onSuccess,
}: PasoConfirmarEnvioProps) {
  const [loading, setLoading] = useState(false);
  const [guia, setGuia] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerarGuia = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        tipo: "GeneracionGuia",
        ...formData,
      };

      const res = await axios.post<GenerarGuiaResponse>(
        "/api/servientrega/generar-guia",
        payload
      );
      const data = res.data;

      if (data?.guia && data?.base64) {
        setGuia(data.guia);
        setBase64(data.base64);
        if (onSuccess) onSuccess();
      } else {
        setError("No se pudo generar la guía.");
      }
    } catch (err: any) {
      console.error("Error al generar guía:", err);
      setError("Ocurrió un error al generar la guía. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerPDF = () => {
    if (base64) {
      const pdfURL = `data:application/pdf;base64,${base64}`;
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe width="100%" height="100%" src="${pdfURL}"></iframe>`
        );
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Confirmar y generar guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!guia ? (
          <>
            <p>¿Deseas generar la guía con la información ingresada?</p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              className="w-full"
              onClick={handleGenerarGuia}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generando guía...
                </>
              ) : (
                "Generar guía"
              )}
            </Button>
          </>
        ) : (
          <>
            <p className="text-green-600 font-semibold">
              Guía generada exitosamente: {guia}
            </p>
            <Button onClick={handleVerPDF} className="w-full">
              Ver PDF de la guía
            </Button>
            <Button onClick={onReset} className="w-full" variant="secondary">
              Generar otra guía
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
