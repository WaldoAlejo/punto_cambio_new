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
import type { FormDataGuia } from "@/types/servientrega";
import type { PuntoAtencion } from "@/types";
import { ReceiptService } from "@/services/receiptService";

interface PasoConfirmarEnvioProps {
  formData: FormDataGuia;
  selectedPoint: PuntoAtencion | null;
  onReset: () => void;
  onSuccess?: () => void;
}

export default function PasoConfirmarEnvio({
  formData,
  selectedPoint,
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
  const [reciboGenerado, setReciboGenerado] = useState<boolean>(false);

  // Helpers seguros
  const safeUpper = (s?: string) => (s || "").toUpperCase().trim();
  const ciudadProv = (ciudad?: string, provincia?: string) =>
    `${safeUpper(ciudad)}-${safeUpper(provincia)}`;
  const mapNombreProducto = (raw?: string) => {
    const v = (raw || "").toUpperCase();
    if (v.includes("DOC")) return "DOCUMENTO UNITARIO";
    return "MERCANCIA PREMIER";
  };

  // Observaciones y nombre de punto (campos opcionales que NO están en el tipo)
  const observaciones: string =
    ((formData as any)?.observaciones as string) || "";
  const puntoAtencionNombre: string =
    ((formData as any)?.punto_atencion_nombre as string) ||
    formData.punto_atencion_id ||
    "Punto de Atención";

  // Total estimado desde resumen_costos (evita usar 'tarifa' inexistente)
  const totalEstimado = Number(
    (formData as any)?.resumen_costos?.total ??
      (formData as any)?.resumen_costos?.gtotal ??
      (formData as any)?.resumen_costos?.total_transaccion ??
      0
  );

  // ==========================
  // 🔍 Validar saldo disponible
  // ==========================
  const validarSaldo = async () => {
    try {
      const montoTotal = totalEstimado || 0;

      const { data } = await axiosInstance.get(
        `/servientrega/saldo/validar/${
          formData?.punto_atencion_id || ""
        }?monto=${montoTotal}`
      );

      setSaldoDisponible(Number(data?.disponible) || 0);
      setSaldoEstado(data?.estado);

      if (data?.estado !== "OK") {
        let mensaje =
          data?.mensaje || "Saldo insuficiente para generar la guía.";

        if (data?.estado === "SIN_SALDO") {
          mensaje =
            "No hay saldo asignado para este punto de atención. Contacte al administrador.";
        } else if (data?.estado === "SALDO_AGOTADO") {
          mensaje = "El saldo disponible se ha agotado. Solicite una recarga.";
        } else if (data?.estado === "SALDO_INSUFICIENTE") {
          mensaje = `Saldo insuficiente. Disponible: $${Number(
            data.disponible || 0
          ).toFixed(2)}, Requerido: $${Number(montoTotal).toFixed(2)}`;
        }

        toast.error(mensaje);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error al validar saldo:", error);
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
      const r = formData.remitente!;
      const d = formData.destinatario!;
      const m = formData.medidas!;

      // Peso volumétrico si no llega
      const alto = Number(m?.alto || 0);
      const ancho = Number(m?.ancho || 0);
      const largo = Number(m?.largo || 0);
      const pesoVol =
        alto > 0 && ancho > 0 && largo > 0 ? (alto * ancho * largo) / 5000 : 0;

      // Validar campos requeridos antes de enviar
      const camposRequeridos = {
        cedula_remitente: (r.identificacion || r.cedula || "").toString(),
        nombre_remitente: r.nombre || "",
        direccion_remitente: r.direccion || "",
        telefono_remitente: r.telefono || "",
        email_remitente: r.email || "",
        cedula_destinatario: (d.identificacion || d.cedula || "").toString(),
        nombre_destinatario: d.nombre || "",
        direccion_destinatario: d.direccion || "",
        telefono_destinatario: d.telefono || "",
        ciudad_origen: ciudadProv(r.ciudad, r.provincia),
        ciudad_destinatario: ciudadProv(d.ciudad, d.provincia),
      };

      // Validar que ningún campo requerido esté vacío
      for (const [campo, valor] of Object.entries(camposRequeridos)) {
        if (!valor || (typeof valor === "string" && valor.trim() === "")) {
          const nombreCampo = campo
            .replace(/_remitente$/, " del remitente")
            .replace(/_destinatario$/, " del destinatario")
            .replace(/_/g, " ");
          const msgError = `Campo requerido incompleto: ${nombreCampo}`;
          setError(msgError);
          toast.error(msgError);
          setLoading(false);
          return;
        }
      }

      const payload = {
        tipo: "GeneracionGuia",
        nombre_producto: mapNombreProducto(formData.nombre_producto),
        ciudad_origen: ciudadProv(r.ciudad, r.provincia),
        cedula_remitente: (r.identificacion || r.cedula || "").toString(),
        nombre_remitente: r.nombre || "",
        direccion_remitente: r.direccion || "",
        telefono_remitente: r.telefono || "",
        codigo_postal_remitente: r.codigo_postal?.trim() || "",
        cedula_destinatario: (d.identificacion || d.cedula || "").toString(),
        nombre_destinatario: d.nombre || "",
        direccion_destinatario: d.direccion || "",
        telefono_destinatario: d.telefono || "",
        ciudad_destinatario: ciudadProv(d.ciudad, d.provincia),
        pais_destinatario: (d.pais || "ECUADOR").toUpperCase(),
        codigo_postal_destinatario: d.codigo_postal?.trim() || "",
        contenido: ((m?.contenido || "").trim() || "DOCUMENTO").toUpperCase(),
        retiro_oficina: "NO",
        pedido: (formData as any).pedido?.trim() || "",
        factura: (formData as any).factura?.trim() || "",
        valor_declarado: Number(m?.valor_declarado || 0),
        valor_asegurado: Number((m as any)?.valor_seguro || 0),
        peso_fisico: Number(m?.peso || 0),
        peso_volumentrico: Number(pesoVol || 0),
        piezas: Number(m?.piezas || 1),
        alto: alto,
        ancho: ancho,
        largo: largo,
        tipo_guia: "1",
        alianza: selectedPoint?.servientrega_alianza || "PUNTO CAMBIO SAS",
        alianza_oficina:
          selectedPoint?.servientrega_oficina_alianza ||
          "QUITO_PLAZA DEL VALLE_PC",
        mail_remite: r.email?.trim() || "",
      } as const;

      console.log("📤 Payload GeneracionGuia (Production):", payload);

      const res = await axiosInstance.post(
        "/servientrega/generar-guia",
        payload
      );
      let data = res.data;

      // Normaliza respuesta para extraer guía y PDF Base64
      let guiaStr: string | undefined;
      let guia64: string | undefined;

      console.log("📥 Respuesta del servidor:", data);

      if (typeof data === "string") {
        try {
          const parts = data
            .trim()
            .replace(/}\s*{/g, "}|{")
            .split("|")
            .map((p: string) => p.trim());
          for (const p of parts) {
            try {
              const j = JSON.parse(p);
              if (Array.isArray(j)) {
                // tarifa: ignorar aquí
              } else if (j?.fetch?.guia) {
                guiaStr = j.fetch.guia;
                guia64 = j.fetch.guia_64;
              } else if (j?.guia) {
                guiaStr = j.guia;
                guia64 = j.guia_64;
              }
            } catch {}
          }
        } catch {}
      } else if (Array.isArray(data)) {
        // solo tarifa
      } else if (data?.fetch?.guia) {
        guiaStr = data.fetch.guia;
        guia64 = data.fetch.guia_64;
      } else if (data?.guia) {
        // Respuesta directa con guia y guia_64
        guiaStr = data.guia;
        guia64 = data.guia_64;
      }

      console.log("🎯 Extracción final:", { guiaStr, guia64 });

      if (guiaStr && guia64) {
        setGuia(guiaStr);
        setBase64(guia64);
        toast.success(`✅ Guía generada: ${guiaStr}`);
        // 🔧 NO llamar a onSuccess aquí para que el usuario vea los botones
        // Se llamará cuando el usuario haga click en "Generar otra guía"
      } else {
        setError("No se pudo generar la guía. Verifica los datos.");
        toast.error(
          "No se pudo generar la guía. Faltan guia o guia_64 en la respuesta."
        );
        console.error("❌ Error: Respuesta incompleta", { data });
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
    if (!base64) return;
    const isBase64 = !/^https?:\/\//i.test(base64);
    const url = isBase64 ? `data:application/pdf;base64,${base64}` : base64;
    window.open(url, "_blank");
  };

  // ==========================
  // 🧾 Generar y guardar recibo
  // ==========================
  const generarRecibo = async () => {
    if (!guia || !(formData as any).resumen_costos) {
      toast.error("No hay datos suficientes para generar el recibo");
      return;
    }

    try {
      const reciboData = ReceiptService.generateServientregaReceipt(
        {
          numero_guia: guia,
          nombre_producto: formData.nombre_producto,
          remitente: formData.remitente,
          destinatario: formData.destinatario,
          medidas: formData.medidas,
          observaciones, // <- seguro
        },
        (formData as any).resumen_costos,
        puntoAtencionNombre,
        "Usuario Actual" // TODO: obtener del contexto real
      );

      await axiosInstance.post("/servientrega/recibos", {
        numero_recibo: reciboData.numeroRecibo,
        referencia_id: guia,
        punto_atencion_id: formData.punto_atencion_id,
        datos_operacion: {
          guia: {
            numero_guia: guia,
            nombre_producto: formData.nombre_producto,
            remitente: formData.remitente,
            destinatario: formData.destinatario,
            medidas: formData.medidas,
            observaciones,
          },
          tarifa: (formData as any).resumen_costos,
          fecha_generacion: new Date().toISOString(),
        },
      });

      ReceiptService.showReceiptInCurrentWindow(reciboData);
      setReciboGenerado(true);
      toast.success("Recibo generado exitosamente");
    } catch (error) {
      console.error("Error al generar recibo:", error);
      toast.error("Error al generar el recibo");
    }
  };

  // ==========================
  // 🧾 Imprimir recibo
  // ==========================
  const imprimirRecibo = async () => {
    if (!guia || !(formData as any).resumen_costos) {
      toast.error("No hay datos suficientes para imprimir el recibo");
      return;
    }

    try {
      const reciboData = ReceiptService.generateServientregaReceipt(
        {
          numero_guia: guia,
          nombre_producto: formData.nombre_producto,
          remitente: formData.remitente,
          destinatario: formData.destinatario,
          medidas: formData.medidas,
          observaciones,
        },
        (formData as any).resumen_costos,
        puntoAtencionNombre,
        "Usuario Actual"
      );

      ReceiptService.printReceipt(reciboData, 2);
      toast.success("Enviando recibo a impresora...");
    } catch (error) {
      console.error("Error al imprimir recibo:", error);
      toast.error("Error al imprimir el recibo");
    }
  };

  const saldoRestante =
    saldoDisponible !== null ? saldoDisponible - totalEstimado : null;

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
                <strong>Producto:</strong>{" "}
                {mapNombreProducto(formData?.nombre_producto)}
              </p>
              <p>
                <strong>Valor declarado:</strong> $
                {Number(formData?.medidas?.valor_declarado || 0).toFixed(2)}
              </p>
              <p>
                <strong>Flete estimado:</strong> $
                {Number((formData as any)?.resumen_costos?.flete || 0).toFixed(
                  2
                )}
              </p>
              <p>
                <strong>Total estimado:</strong>{" "}
                <span className="text-green-700 font-semibold">
                  ${Number(totalEstimado).toFixed(2)}
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
                          ${Number(totalEstimado).toFixed(2)}
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
                      onClick={async () => {
                        try {
                          const montoRequerido = Math.max(
                            totalEstimado || 0,
                            50
                          );
                          await axiosInstance.post(
                            "/servientrega/solicitar-saldo",
                            {
                              punto_atencion_id:
                                formData?.punto_atencion_id || "",
                              monto_solicitado: montoRequerido,
                              observaciones: `Solicitud automática. Costo estimado: $${Number(
                                totalEstimado || 0
                              ).toFixed(2)}`,
                              creado_por: "Sistema",
                            }
                          );
                          toast.success(
                            "Solicitud de saldo enviada al administrador."
                          );
                          setConfirmOpen(false);
                        } catch {
                          toast.error(
                            "No se pudo enviar la solicitud de saldo."
                          );
                        }
                      }}
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

              {/* Botones de recibos */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={generarRecibo}
                  disabled={!guia || !(formData as any).resumen_costos}
                  className="bg-green-600 text-white hover:bg-green-700"
                  size="sm"
                >
                  {reciboGenerado ? "Ver Recibo" : "Generar Recibo"}
                </Button>
                <Button
                  onClick={imprimirRecibo}
                  disabled={!guia || !(formData as any).resumen_costos}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                  size="sm"
                >
                  Imprimir Recibo
                </Button>
              </div>

              <Button
                onClick={() => {
                  onReset();
                  onSuccess?.(); // 🔧 Llamar a onSuccess cuando el usuario resetea
                }}
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
