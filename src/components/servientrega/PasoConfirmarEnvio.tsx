"use client";

import React, { useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ==========================
// 📌 Tipado de datos
// ==========================
export interface Remitente {
  identificacion: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais?: string;
}

export interface Destinatario {
  identificacion: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email?: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
}

export interface Medidas {
  alto: number;
  ancho: number;
  largo: number;
  peso: number;
  valor_declarado: number;
  valor_seguro: number;
  recoleccion: boolean;
}

export interface Empaque {
  tipo_empaque: string;
  cantidad: number;
  descripcion: string;
  costo_unitario: number;
  costo_total: number;
}

export interface ResumenCostos {
  costo_empaque: number;
  valor_seguro: number;
  flete: number;
  total: number;
}

export interface FormDataGuia {
  nombre_producto: string;
  contenido: string;
  retiro_oficina: boolean;
  nombre_agencia_retiro_oficina?: string;
  pedido?: string;
  factura?: string;
  punto_atencion_id: string;
  remitente: Remitente;
  destinatario: Destinatario;
  medidas: Medidas;
  empaque?: Empaque;
  requiere_empaque: boolean;
  resumen_costos: ResumenCostos;
}

// ==========================
// 📌 Props del componente
// ==========================
interface PasoConfirmarEnvioProps {
  formData: FormDataGuia;
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
    // ✅ Validación previa
    if (!formData.remitente || !formData.destinatario || !formData.medidas) {
      toast.error("Faltan datos obligatorios para generar la guía.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ Construcción del payload según API Servientrega
      const payload: FormDataGuia = {
        ...formData,
        contenido: formData.contenido || formData.nombre_producto,
        retiro_oficina: formData.retiro_oficina,
        nombre_agencia_retiro_oficina: formData.retiro_oficina
          ? formData.nombre_agencia_retiro_oficina
          : "",
        pedido: formData.pedido || "PRUEBA",
        factura: formData.factura || "PRUEBA",
      };

      const res = await axios.post<GenerarGuiaResponse>(
        "/api/servientrega/generar-guia",
        payload
      );

      const data = res.data;
      if (data?.guia && data?.base64) {
        setGuia(data.guia);
        setBase64(data.base64);
        toast.success(`✅ Guía generada: ${data.guia}`);
        if (onSuccess) onSuccess();
      } else {
        setError("No se pudo generar la guía. Verifica los datos.");
        toast.error("No se pudo generar la guía.");
      }
    } catch (err: any) {
      console.error("Error al generar guía:", err);
      setError("Ocurrió un error al generar la guía.");
      toast.error("Error al generar la guía. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerPDF = () => {
    if (base64) {
      const pdfURL = `data:application/pdf;base64,${base64}`;
      window.open(pdfURL, "_blank");
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Confirmar y generar guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!guia ? (
          <>
            <p className="text-gray-700">
              ¿Deseas generar la guía con la información ingresada? Esta acción
              descontará saldo del punto de atención.
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button
              className="w-full bg-green-600 text-white hover:bg-green-700"
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
            <p className="text-green-600 font-semibold text-center">
              ✅ Guía generada exitosamente: {guia}
            </p>
            <div className="flex flex-col gap-3 mt-4">
              <Button
                onClick={handleVerPDF}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                Ver PDF de la guía
              </Button>
              <Button
                onClick={onReset}
                className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                variant="secondary"
              >
                Generar otra guía
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
