"use client";

import React, { useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PasoConfirmarEnvioProps {
  formData: any;
  onReset: () => void;
}

interface GenerarGuiaResponse {
  guia: string;
  base64: string;
  [key: string]: any;
}

export default function PasoConfirmarEnvio({
  formData,
  onReset,
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
        ...formData,
        tipo: "GeneracionGuia",
      };

      const { data }: { data: GenerarGuiaResponse } = await axios.post(
        "/api/servientrega/generar-guia",
        payload
      );

      if (data.guia && data.base64) {
        setGuia(data.guia);
        setBase64(data.base64);
      } else {
        setError("No se pudo generar la guía.");
      }
    } catch (err: any) {
      console.error("Error al generar guía:", err);
      setError("Error al generar la guía.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerPDF = () => {
    if (base64) {
      const linkSource = `data:application/pdf;base64,${base64}`;
      const pdfWindow = window.open();
      if (pdfWindow) {
        pdfWindow.document.write(
          `<iframe width='100%' height='100%' src='${linkSource}'></iframe>`
        );
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Confirmación y envío</CardTitle>
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
