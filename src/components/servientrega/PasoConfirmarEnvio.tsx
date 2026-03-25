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

  const devWarn = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.warn(...args);
  };

  type FormDataGuiaExtra = FormDataGuia & {
    observaciones?: string;
    punto_atencion_nombre?: string;
  };
  const formDataExtra = formData as FormDataGuiaExtra;

  // Observaciones y nombre de punto (campos opcionales que NO están en el tipo)
  const observaciones: string = formDataExtra.observaciones || "";
  const puntoAtencionNombre: string =
    formDataExtra.punto_atencion_nombre ||
    formData.punto_atencion_id ||
    "Punto de Atención";

  // Total estimado desde resumen_costos (evita usar 'tarifa' inexistente)
  const resumenCostos = formData.resumen_costos || {};
  const totalEstimado = Number(
    resumenCostos?.total ??
      resumenCostos?.gtotal ??
      resumenCostos?.total_transaccion ??
      0
  );

  // DEBUG: Log para verificar qué se está calculando
  devWarn("💰 [PasoConfirmarEnvio] Cálculo de totalEstimado:", {
    resumen_costos: resumenCostos,
    total: resumenCostos?.total,
    gtotal: resumenCostos?.gtotal,
    total_transaccion: resumenCostos?.total_transaccion,
    totalEstimado,
  });

  // ==========================
  // 🔍 Validar saldo disponible de Servientrega (como servicio externo)
  // ==========================
  const validarSaldo = async () => {
    try {
      const montoTotal = totalEstimado || 0;

      // Usar el endpoint legacy que ahora consulta ServicioExternoSaldo
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
            "No hay saldo asignado para Servientrega en este punto. Contacte al administrador.";
        } else if (data?.estado === "SALDO_AGOTADO") {
          mensaje = "El saldo de Servientrega se ha agotado. Solicite una recarga.";
        } else if (data?.estado === "SALDO_INSUFICIENTE") {
          mensaje = `Saldo insuficiente en Servientrega. Disponible: $${Number(
            data.disponible || 0
          ).toFixed(2)}, Requerido: $${Number(montoTotal).toFixed(2)}`;
        }

        toast.error(mensaje);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error al validar saldo:", error);
      toast.error("No se pudo validar el saldo de Servientrega.");
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
      const r = formData.remitente;
      const d = formData.destinatario;
      const m = formData.medidas;

      if (!r || !d || !m) {
        const msgError = "Datos incompletos: remitente/destinatario/medidas";
        setError(msgError);
        toast.error(msgError);
        setLoading(false);
        return;
      }

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
        pedido: formData.pedido?.trim() || "",
        factura: formData.factura?.trim() || "",
        valor_declarado: Number(m?.valor_declarado || 0),
        valor_asegurado: Number(m?.valor_seguro || 0),
        peso_fisico: Number(m?.peso || 0),
        peso_volumentrico: Number(pesoVol || 0),
        piezas: Number(m?.piezas || 1),
        alto: alto,
        ancho: ancho,
        largo: largo,
        tipo_guia: "1",
        // 🔧 CORRECCIÓN: alianza SIEMPRE es "PUNTO CAMBIO SAS" (fijo)
        // alianza_oficina viene de la configuración del punto en BD
        alianza: "PUNTO CAMBIO SAS",
        alianza_oficina: selectedPoint?.servientrega_oficina_alianza || "QUITO_PLAZA DEL VALLE_PC",
        mail_remite: r.email?.trim() || "",
        // 💳 IMPORTANTE: Enviar punto_atencion_id para que el backend pueda descontar del saldo
        punto_atencion_id: selectedPoint?.id || undefined,
        // 💰 IMPORTANTE: Enviar todos los componentes de costo calculados por la tarifa
        // Esto permite que el backend calcule el total incluso si valor_total es 0
        flete: Number(resumenCostos?.flete || 0),
        valor_empaque: Number(resumenCostos?.valor_empaque || 0),
        seguro: Number(resumenCostos?.seguro || 0),
        tiva: Number(resumenCostos?.tiva || 0),
        gtotal: Number(resumenCostos?.gtotal || 0),
        total_transacion: Number(resumenCostos?.total_transacion || 0),
        // 💰 Enviar el total calculado del frontend (prioritario)
        valor_total: totalEstimado || 0,
      } as const;

      // 🔍 DEBUG: Ver valores del punto seleccionado
      devWarn("📋 Valores del punto seleccionado:", {
        punto_id: selectedPoint?.id,
        punto_nombre: selectedPoint?.nombre,
        servientrega_alianza: selectedPoint?.servientrega_alianza,
        servientrega_oficina_alianza: selectedPoint?.servientrega_oficina_alianza,
        servientrega_agencia_nombre: selectedPoint?.servientrega_agencia_nombre,
        servientrega_agencia_codigo: selectedPoint?.servientrega_agencia_codigo,
      });
      devWarn("📤 Payload GeneracionGuia (Production):", payload);

      const res = await axiosInstance.post(
        "/servientrega/generar-guia",
        payload
      );
      const data = res.data;

      // Normaliza respuesta para extraer guía y PDF Base64
      let guiaStr: string | undefined;
      let guia64: string | undefined;

      devWarn("📥 Respuesta del servidor:", data);

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
            } catch {
              // noop: fragmento no es JSON válido
            }
          }
        } catch {
          // noop: respuesta puede venir en formatos no JSON
        }
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

      devWarn("🎯 Extracción final:", { guiaStr, guia64 });

      if (guiaStr && guia64) {
        // 🧹 Limpiar base64: remover espacios en blanco, saltos de línea, caracteres especiales
        const base64Limpio = guia64
          .replace(/\s+/g, "") // Remover todos los espacios en blanco y saltos de línea
          .replace(/[^\w+/=]/g, "") // Remover caracteres inválidos en base64
          .trim();

        devWarn("🧹 Base64 original length:", guia64.length);
        devWarn("🧹 Base64 limpio length:", base64Limpio.length);
        devWarn(
          "🧹 Base64 limpio preview:",
          base64Limpio.substring(0, 100)
        );

        setGuia(guiaStr);
        setBase64(base64Limpio); // Usar base64 limpio

        // 💰 Mostrar valores finales del backend
        const valorFinal = data?.valorTotalGuia || data?.costo_total || 0;
        if (valorFinal > 0) {
          devWarn("💰 Valores finales del backend:", {
            valorTotalGuia: valorFinal,
            costo_envio: data?.costo_envio,
          });
        }

        toast.success(
          `✅ Guía generada: ${guiaStr} | Costo: $${Number(valorFinal).toFixed(
            2
          )}`
        );
        // 🔧 NO llamar a onSuccess aquí para que el usuario vea los botones
        // Se llamará cuando el usuario haga click en "Generar otra guía"
      } else {
        setError("No se pudo generar la guía. Verifica los datos.");
        toast.error(
          "No se pudo generar la guía. Faltan guia o guia_64 en la respuesta."
        );
        console.error("❌ Error: Respuesta incompleta", { data });
      }
    } catch (err: unknown) {
      setError("Ocurrió un error al generar la guía.");

      const maybeAxios = err as {
        response?: { data?: { error?: string } };
      };

      toast.error(
        maybeAxios?.response?.data?.error ||
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
    if (!base64) {
      toast.error("PDF no disponible");
      return;
    }

    try {
      const isBase64 = !/^https?:\/\//i.test(base64);
      let url: string;

      if (isBase64) {
        // ✅ Validar que sea base64 válido
        if (!/^[A-Za-z0-9+/=]*$/.test(base64)) {
          throw new Error("Base64 contiene caracteres inválidos");
        }

        // ✅ Verificar que empiece con JVBERi (header de PDF en base64)
        if (!base64.startsWith("JVBERi")) {
          throw new Error("Base64 no es un PDF válido (header incorrecto)");
        }

        // ✅ Validar que pueda decodificarse
        try {
          atob(base64.substring(0, 200));
        } catch {
          throw new Error("Base64 no puede ser decodificado");
        }

        // 🔧 Crear blob en lugar de data URL (para PDFs grandes)
        try {
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "application/pdf" });
          url = URL.createObjectURL(blob);

          devWarn("📄 PDF creado desde Blob:", {
            base64Length: base64.length,
            blobSize: blob.size,
            blobUrl: url.substring(0, 50),
          });
        } catch (blobErr) {
          console.warn(
            "⚠️ No se pudo crear Blob, intentando data URL:",
            blobErr
          );
          url = `data:application/pdf;base64,${base64}`;
        }
      } else {
        url = base64;
      }

      devWarn("📄 Intentando abrir PDF:", {
        isBase64,
        base64Length: base64.length,
        urlPreview: url.substring(0, 100),
      });

      // 🎯 Intentar abrir en ventana nueva
      const newWindow = window.open(url, "_blank");
      if (newWindow) {
        devWarn("✅ PDF abierto en ventana nueva");
      } else {
        // Si window.open falla, intentar descargar el archivo
        console.warn("⚠️ No se pudo abrir ventana, intentando descargar...");
        descargarPDF();
      }
    } catch (error) {
      console.error("❌ Error al abrir PDF:", error);
      toast.error(
        error instanceof Error
          ? `Error en PDF: ${error.message}`
          : "Error al abrir el PDF. El formato puede estar corrupto."
      );
    }
  };

  // ==========================
  // 📥 Descargar PDF como archivo
  // ==========================
  const descargarPDF = () => {
    if (!base64 || !guia) {
      toast.error("Datos insuficientes para descargar");
      return;
    }

    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `Guia_${guia}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`PDF descargado: Guia_${guia}.pdf`);
    } catch (error) {
      console.error("❌ Error al descargar PDF:", error);
      toast.error("Error al descargar el PDF");
    }
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
      const reciboData = ReceiptService.generateServientregaReceipt(
        {
          numero_guia: guia,
          nombre_producto: formData.nombre_producto,
          remitente: formData.remitente,
          destinatario: formData.destinatario,
          medidas: formData.medidas,
          observaciones, // <- seguro
        },
        formData.resumen_costos,
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
          tarifa: formData.resumen_costos,
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
    if (!guia || !formData.resumen_costos) {
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
        formData.resumen_costos,
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
    <Card className="w-full max-w-3xl mx-auto mt-4 sm:mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Confirmar y generar guía</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!guia ? (
          <>
            <p className="text-gray-700">
              Revisa el resumen antes de confirmar. Esta acción descontará saldo
              de Servientrega y registrará el ingreso en caja.
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
                {Number(formData.resumen_costos?.flete || 0).toFixed(2)}
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
              {/* Botones de PDF */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleVerPDF}
                  disabled={!base64}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                  size="sm"
                >
                  👁️ Ver PDF
                </Button>
                <Button
                  onClick={descargarPDF}
                  disabled={!base64}
                  className="w-full bg-cyan-600 text-white hover:bg-cyan-700"
                  size="sm"
                >
                  ⬇️ Descargar PDF
                </Button>
              </div>

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
