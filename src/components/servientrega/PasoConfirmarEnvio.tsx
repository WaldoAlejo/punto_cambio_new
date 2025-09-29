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
import { ReceiptService } from "@/services/receiptService";

interface PasoConfirmarEnvioProps {
  formData: FormDataGuia;
  onReset: () => void;
  onSuccess?: () => void;
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
  const [reciboGenerado, setReciboGenerado] = useState<boolean>(false);

  // ==========================
  // 🔍 Validar saldo disponible
  // ==========================
  const validarSaldo = async () => {
    try {
      // Calcular el monto total de la transacción desde la tarifa
      const montoTotal = tarifa?.total_transacion || tarifa?.gtotal || 0;

      const { data } = await axiosInstance.get(
        `/servientrega/saldo/validar/${
          formData?.punto_atencion_id || ""
        }?monto=${montoTotal}`
      );

      setSaldoDisponible(Number(data?.disponible) || 0);
      setSaldoEstado(data?.estado);

      if (data?.estado !== "OK") {
        // Mostrar mensaje específico según el estado
        let mensaje =
          data?.mensaje || "Saldo insuficiente para generar la guía.";

        if (data?.estado === "SIN_SALDO") {
          mensaje =
            "No hay saldo asignado para este punto de atención. Contacte al administrador.";
        } else if (data?.estado === "SALDO_AGOTADO") {
          mensaje = "El saldo disponible se ha agotado. Solicite una recarga.";
        } else if (data?.estado === "SALDO_INSUFICIENTE") {
          mensaje = `Saldo insuficiente. Disponible: $${data.disponible?.toFixed(
            2
          )}, Requerido: $${montoTotal.toFixed(2)}`;
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

  // Helpers
  const safeUpper = (s?: string) => (s || "").toUpperCase().trim();
  const ciudadProv = (ciudad?: string, provincia?: string) =>
    `${safeUpper(ciudad)}-${safeUpper(provincia)}`;

  // Mapeo de producto según selección previa
  const mapNombreProducto = (raw?: string) => {
    const v = (raw || "").toUpperCase();
    if (v.includes("DOC")) return "DOCUMENTO";
    return "MERCANCIA PREMIER";
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
      const pesoVol =
        Number(m?.alto || 0) > 0 &&
        Number(m?.ancho || 0) > 0 &&
        Number(m?.largo || 0) > 0
          ? (Number(m.alto) * Number(m.ancho) * Number(m.largo)) / 5000
          : 0;

      // ⚠️ Forma de Consumo: GeneracionGuia
      const payload = {
        tipo: "GeneracionGuia",
        nombre_producto: mapNombreProducto(formData.nombre_producto),
        ciudad_origen: ciudadProv(r.ciudad, r.provincia),
        cedula_remitente: r.identificacion || r.cedula || "",
        nombre_remitente: r.nombre || "",
        direccion_remitente: r.direccion || "",
        telefono_remitente: r.telefono || "",
        codigo_postal_remitente: r.codigo_postal || "PRUEBA",
        cedula_destinatario: d.identificacion || d.cedula || "",
        nombre_destinatario: d.nombre || "",
        direccion_destinatario: d.direccion || "",
        telefono_destinatario: d.telefono || "",
        ciudad_destinatario: ciudadProv(d.ciudad, d.provincia),
        pais_destinatario: d.pais || "ECUADOR",
        codigo_postal_destinatario: d.codigo_postal || "PRUEBA",
        contenido:
          (formData?.contenido || formData?.nombre_producto || "PRUEBA") + "",
        retiro_oficina: formData.retiro_oficina ? "SI" : "NO",
        ...(formData.retiro_oficina &&
          formData.nombre_agencia_retiro_oficina && {
            nombre_agencia_retiro_oficina:
              formData.nombre_agencia_retiro_oficina,
          }),
        pedido: formData.pedido || "PRUEBA",
        factura: formData.factura || "PRUEBA",
        valor_declarado: Number(m?.valor_declarado || 0),
        valor_asegurado: Number(m?.valor_seguro || 0),
        peso_fisico: Number(m?.peso || 0),
        peso_volumentrico: Number(pesoVol || 0),
        piezas: Number(m?.piezas || 1),
        alto: Number(m?.alto || 0),
        ancho: Number(m?.ancho || 0),
        largo: Number(m?.largo || 0),
        tipo_guia: "1",
        alianza: "PRUEBAS",
        alianza_oficina: "OFICINA_PRUEBA",
        mail_remite: r.email || "correoremitente@gmail.com",

        // Si tu backend NO agrega credenciales, descomenta y completa:
        // usuingreso: "PRUEBA",
        // contrasenha: "s12345ABCDe",
      } as const;

      console.log("📤 Payload GeneracionGuia:", payload);

      const res = await axiosInstance.post(
        "/servientrega/generar-guia",
        payload
      );
      let data = res.data;

      // La API a veces devuelve: [ ...tarifa ]{ fetch: {...guia...} }
      // Normalizamos para extraer la guía y el PDF Base64
      let guiaStr: string | undefined;
      let guia64: string | undefined;

      if (typeof data === "string") {
        // Intento de parse cuando vienen concatenados como string
        try {
          // separa jsons contiguos: ][ o }{ etc.
          const parts = data
            .trim()
            .replace(/}\s*{/g, "}|{")
            .split("|")
            .map((p: string) => p.trim());
          for (const p of parts) {
            try {
              const j = JSON.parse(p);
              if (Array.isArray(j)) {
                // tarifa: ignoramos aquí
              } else if (j?.fetch?.guia) {
                guiaStr = j.fetch.guia;
                guia64 = j.fetch.guia_64 || j.fetch.guia_pdf;
              }
            } catch {}
          }
        } catch {}
      } else if (Array.isArray(data)) {
        // solo tarifa
      } else if (data?.fetch?.guia) {
        guiaStr = data.fetch.guia;
        guia64 = data.fetch.guia_64 || data.fetch.guia_pdf;
      } else if (data?.guia) {
        guiaStr = data.guia;
        guia64 = data.guia_64 || data.guia_pdf;
      }

      if (guiaStr && guia64) {
        setGuia(guiaStr);
        setBase64(guia64);
        toast.success(`✅ Guía generada: ${guiaStr}`);
        onSuccess?.();
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
    if (!base64) return;
    const isBase64 = !/^https?:\/\//i.test(base64);
    const url = isBase64 ? `data:application/pdf;base64,${base64}` : base64; // si vino url directa
    window.open(url, "_blank");
  };

  // ==========================
  // 🧾 Generar y guardar recibo
  // ==========================
  const generarRecibo = async () => {
    if (!guia || !formData.resumen_costos) {
      toast.error("No hay datos suficientes para generar el recibo");
      return;
    }

    try {
      // Generar el recibo usando el servicio
      const reciboData = ReceiptService.generateServientregaReceipt(
        {
          numero_guia: guia,
          nombre_producto: formData.nombre_producto,
          remitente: formData.remitente,
          destinatario: formData.destinatario,
          medidas: formData.medidas,
          observaciones: formData.observaciones,
        },
        formData.resumen_costos,
        formData.punto_atencion_nombre || "Punto de Atención",
        "Usuario Actual" // TODO: Obtener del contexto de usuario
      );

      // Guardar en la base de datos
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
            observaciones: formData.observaciones,
          },
          tarifa: formData.resumen_costos,
          fecha_generacion: new Date().toISOString(),
        },
      });

      // Mostrar el recibo
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
    if (!guia || !formData.resumen_costos) {
      toast.error("No hay datos suficientes para imprimir el recibo");
      return;
    }

    try {
      // Generar el recibo para impresión
      const reciboData = ReceiptService.generateServientregaReceipt(
        {
          numero_guia: guia,
          nombre_producto: formData.nombre_producto,
          remitente: formData.remitente,
          destinatario: formData.destinatario,
          medidas: formData.medidas,
          observaciones: formData.observaciones,
        },
        formData.resumen_costos,
        formData.punto_atencion_nombre || "Punto de Atención",
        "Usuario Actual" // TODO: Obtener del contexto de usuario
      );

      // Imprimir directamente
      ReceiptService.printReceipt(reciboData, 2);
      toast.success("Enviando recibo a impresora...");
    } catch (error) {
      console.error("Error al imprimir recibo:", error);
      toast.error("Error al imprimir el recibo");
    }
  };

  const saldoRestante =
    saldoDisponible !== null
      ? saldoDisponible - (formData.resumen_costos.total || 0)
      : null;

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
                          $
                          {Number(formData.resumen_costos.total || 0).toFixed(
                            2
                          )}
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
                            formData?.resumen_costos?.total || 0,
                            50
                          );
                          await axiosInstance.post(
                            "/servientrega/solicitar-saldo",
                            {
                              punto_atencion_id:
                                formData?.punto_atencion_id || "",
                              monto_solicitado: montoRequerido,
                              observaciones: `Solicitud automática. Costo estimado: $${Number(
                                formData?.resumen_costos?.total || 0
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
                  disabled={!guia || !formData.resumen_costos}
                  className="bg-green-600 text-white hover:bg-green-700"
                  size="sm"
                >
                  {reciboGenerado ? "Ver Recibo" : "Generar Recibo"}
                </Button>
                <Button
                  onClick={imprimirRecibo}
                  disabled={!guia || !formData.resumen_costos}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                  size="sm"
                >
                  Imprimir Recibo
                </Button>
              </div>

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
