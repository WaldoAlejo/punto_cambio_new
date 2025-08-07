"use client";

import React, { useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  Remitente,
  Destinatario,
  Medidas,
  Empaque,
  ResumenCostos,
  FormDataGuia,
} from "@/types/servientrega";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saldoDisponible, setSaldoDisponible] = useState<number | null>(null);
  const [saldoEstado, setSaldoEstado] = useState<string | null>(null);

  // ==========================
  // 🔍 Validar saldo disponible
  // ==========================
  const validarSaldo = async () => {
    try {
      const { data } = await axiosInstance.get(
        `/servientrega/saldo/validar/${formData?.punto_atencion_id || ""}`
      );
      setSaldoDisponible(Number(data?.disponible) || 0);
      setSaldoEstado(data?.estado);

      if (data?.estado !== "OK") {
        toast.error(
          data?.mensaje || "Saldo insuficiente para generar la guía."
        );
        return false;
      }
      return true;
    } catch (err) {
      toast.error("No se pudo validar el saldo.");
      setSaldoEstado("ERROR");
      return false;
    }
  };

  const abrirModalConfirmacion = async () => {
    const valido = await validarSaldo();
    if (valido) setConfirmOpen(true);
  };

  // ==========================
  // 📄 Generar guía
  // ==========================
  const handleGenerarGuia = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: FormDataGuia = {
        ...formData,
        contenido: formData?.contenido || formData?.nombre_producto || "",
        retiro_oficina: formData.retiro_oficina,
        nombre_agencia_retiro_oficina: formData.retiro_oficina
          ? formData.nombre_agencia_retiro_oficina
          : "",
        pedido: formData.pedido || "PRUEBA",
        factura: formData.factura || "PRUEBA",
      };

      const res = await axiosInstance.post<GenerarGuiaResponse>(
        "/servientrega/generar-guia",
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
      setError("Ocurrió un error al generar la guía.");
      toast.error(
        err?.response?.data?.error ||
          "Error al generar la guía. Intenta nuevamente."
      );
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  // ==========================
  // 📄 Ver PDF de la guía
  // ==========================
  const handleVerPDF = () => {
    if (base64) {
      const pdfURL = `data:application/pdf;base64,${base64}`;
      window.open(pdfURL, "_blank");
    }
  };

  // ==========================
  // 🔔 Solicitar saldo
  // ==========================
  const handleSolicitarSaldo = async () => {
    try {
      const montoRequerido = Math.max(
        formData?.resumen_costos?.total || 0,
        50 // Monto mínimo sugerido
      );

      await axiosInstance.post("/servientrega/solicitar-saldo", {
        punto_atencion_id: formData?.punto_atencion_id || "",
        monto_requerido: montoRequerido,
        observaciones: `Solicitud automática para generar guía. Costo estimado: $${formData?.resumen_costos?.total?.toFixed(
          2
        )}`,
      });
      toast.success("Solicitud de saldo enviada al administrador.");
      setConfirmOpen(false);
    } catch (err) {
      toast.error("No se pudo enviar la solicitud de saldo.");
    }
  };

  const saldoRestante =
    saldoDisponible !== null
      ? saldoDisponible - formData.resumen_costos.total
      : null;

  // ==========================
  // 🎨 Render
  // ==========================
  return (
    <Card className="w-full max-w-2xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Confirmar y generar guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!guia ? (
          <>
            <p className="text-gray-700">
              Revisa el resumen antes de confirmar. Esta acción descontará saldo
              del punto de atención.
            </p>

            <div className="border rounded-md p-3 bg-gray-50 text-sm space-y-2">
              <p>
                <strong>Producto:</strong> {formData?.nombre_producto || "N/A"}
              </p>
              <p>
                <strong>Valor declarado:</strong> $
                {Number(formData?.medidas?.valor_declarado || 0).toFixed(2)}
              </p>
              <p>
                <strong>Flete estimado:</strong> $
                {Number(formData?.resumen_costos?.flete || 0).toFixed(2)}
              </p>
              <p>
                <strong>Total estimado:</strong>{" "}
                <span className="text-green-700 font-semibold">
                  ${Number(formData?.resumen_costos?.total || 0).toFixed(2)}
                </span>
              </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button
              className="w-full bg-green-600 text-white hover:bg-green-700"
              disabled={loading}
              onClick={abrirModalConfirmacion}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Validando saldo...
                </>
              ) : (
                "Confirmar y generar guía"
              )}
            </Button>

            {/* Modal de confirmación */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Confirmar generación de la guía
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    <div className="space-y-3 mt-3 text-sm">
                      <p>
                        <strong>Saldo disponible:</strong>{" "}
                        <span className="text-blue-600">
                          $
                          {saldoDisponible !== null
                            ? saldoDisponible.toFixed(2)
                            : "-"}
                        </span>
                      </p>
                      <p>
                        <strong>Saldo requerido:</strong>{" "}
                        <span className="text-green-600">
                          ${Number(formData.resumen_costos.total).toFixed(2)}
                        </span>
                      </p>
                      <p>
                        <strong>Saldo restante:</strong>{" "}
                        <span
                          className={`${
                            saldoRestante !== null && saldoRestante < 0
                              ? "text-red-600"
                              : "text-gray-800"
                          } font-semibold`}
                        >
                          $
                          {saldoRestante !== null
                            ? saldoRestante.toFixed(2)
                            : "-"}
                        </span>
                      </p>
                      {saldoEstado !== "OK" ||
                      (saldoRestante !== null && saldoRestante < 0) ? (
                        <div className="mt-2 text-red-600 text-sm">
                          ❌ No puedes generar esta guía, saldo insuficiente.
                        </div>
                      ) : null}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  {saldoEstado !== "OK" ||
                  (saldoRestante !== null && saldoRestante < 0) ? (
                    <Button
                      onClick={handleSolicitarSaldo}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white w-full"
                    >
                      Solicitar saldo al administrador
                    </Button>
                  ) : (
                    <AlertDialogAction
                      onClick={handleGenerarGuia}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={loading}
                    >
                      Sí, generar guía
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <>
            <p className="text-green-600 font-semibold text-center">
              ✅ Guía generada exitosamente: {guia}
            </p>
            <div className="flex flex-col gap-3 mt-4">
              <Button
                onClick={handleVerPDF}
                disabled={!base64}
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
