"use client";

import React, { useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText, Download, Printer, RotateCcw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { FormDataGuia } from "@/types/servientrega";
import type { PuntoAtencion } from "@/types";
import { ReceiptService } from "@/services/receiptService";

interface PasoConfirmarEnvioProps {
  formData: FormDataGuia;
  selectedPoint: PuntoAtencion | null;
  onReset: () => void;
  onSuccess?: () => void;
}

export default function PasoConfirmarEnvio({ formData, selectedPoint, onReset, onSuccess }: PasoConfirmarEnvioProps) {
  const [loading, setLoading] = useState(false);
  const [guia, setGuia] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reciboGenerado, setReciboGenerado] = useState(false);

  const totalEstimado = Number(formData.resumen_costos?.total ?? formData.resumen_costos?.gtotal ?? 0);

  const validarSaldo = async () => {
    try {
      const { data } = await axiosInstance.get(`/servientrega/saldo/validar/${formData?.punto_atencion_id || ""}?monto=${totalEstimado}`);
      if (data?.estado !== "OK") {
        toast.error(data?.mensaje || "Saldo insuficiente.");
        return false;
      }
      return true;
    } catch { toast.error("Error validando saldo."); return false; }
  };

  const abrirModal = async () => { if (await validarSaldo()) setConfirmOpen(true); };

  const handleGenerarGuia = async () => {
    setLoading(true);
    try {
      const r = formData.remitente, d = formData.destinatario, m = formData.medidas;
      if (!r || !d || !m) { toast.error("Datos incompletos"); return; }

      const payload = {
        tipo: "GeneracionGuia",
        nombre_producto: (formData.nombre_producto || "").toUpperCase().includes("DOC") ? "DOCUMENTO UNITARIO" : "MERCANCIA PREMIER",
        ciudad_origen: `${(r.ciudad || "").toUpperCase()}-${(r.provincia || "").toUpperCase()}`,
        cedula_remitente: r.identificacion || r.cedula || "",
        nombre_remitente: r.nombre || "", direccion_remitente: r.direccion || "", telefono_remitente: r.telefono || "",
        cedula_destinatario: d.identificacion || d.cedula || "",
        nombre_destinatario: d.nombre || "", direccion_destinatario: d.direccion || "", telefono_destinatario: d.telefono || "",
        ciudad_destinatario: `${(d.ciudad || "").toUpperCase()}-${(d.provincia || "").toUpperCase()}`,
        pais_destinatario: (d.pais || "ECUADOR").toUpperCase(),
        contenido: ((m.contenido || "").trim() || "DOCUMENTO").toUpperCase(),
        retiro_oficina: formData.retiro_oficina ? "SI" : "NO",
        nombre_agencia_retiro_oficina: formData.retiro_oficina ? formData.nombre_agencia_retiro_oficina || "" : "",
        valor_declarado: Number(m.valor_declarado || 0), valor_asegurado: Number(m.valor_seguro || 0),
        peso_fisico: Number(m.peso || 0), alto: Number(m.alto || 0), ancho: Number(m.ancho || 0), largo: Number(m.largo || 0),
        piezas: Number(m.piezas || 1), tipo_guia: "1", alianza: "PUNTO CAMBIO SAS",
        punto_atencion_id: selectedPoint?.id, valor_total: totalEstimado,
      };

      const { data } = await axiosInstance.post("/servientrega/generar-guia", payload);
      const guiaStr = data?.guia || data?.fetch?.guia;
      const guia64 = data?.guia_64 || data?.fetch?.guia_64;

      if (guiaStr && guia64) {
        setGuia(guiaStr);
        setBase64(guia64.replace(/\s+/g, "").replace(/[^\w+/=]/g, "").trim());
        toast.success(`Guía ${guiaStr} generada`);
      } else { toast.error("Error generando guía"); }
    } catch { toast.error("Error al generar guía"); }
    finally { setLoading(false); setConfirmOpen(false); }
  };

  const verPDF = () => {
    if (!base64) { toast.error("PDF no disponible"); return; }
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch { toast.error("Error abriendo PDF"); }
  };

  const descargarPDF = () => {
    if (!base64 || !guia) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `Guia_${guia}.pdf`; link.click();
    URL.revokeObjectURL(url);
    toast.success("PDF descargado");
  };

  const generarRecibo = async () => {
    if (!guia) return;
    try {
      const recibo = ReceiptService.generateServientregaReceipt(
        { numero_guia: guia, nombre_producto: formData.nombre_producto, remitente: formData.remitente, destinatario: formData.destinatario, medidas: formData.medidas },
        formData.resumen_costos, selectedPoint?.nombre || "Punto", "Usuario"
      );
      await axiosInstance.post("/servientrega/recibos", { numero_recibo: recibo.numeroRecibo, referencia_id: guia, punto_atencion_id: formData.punto_atencion_id, datos_operacion: { guia: { numero_guia: guia }, tarifa: formData.resumen_costos } });
      ReceiptService.showReceiptInCurrentWindow(recibo);
      setReciboGenerado(true);
      toast.success("Recibo generado");
    } catch { toast.error("Error generando recibo"); }
  };

  if (guia) {
    return (
      <div className="w-full max-w-sm mx-auto p-4 text-center">
        <div className="mb-4">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <h2 className="text-lg font-semibold">¡Guía Generada!</h2>
          <p className="text-2xl font-bold text-blue-600">{guia}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button variant="outline" size="sm" onClick={verPDF} className="h-9 text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Ver PDF</Button>
          <Button variant="outline" size="sm" onClick={descargarPDF} className="h-9 text-xs"><Download className="h-3.5 w-3.5 mr-1" />Descargar</Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={generarRecibo} disabled={reciboGenerado} className="h-9 text-xs"><FileText className="h-3.5 w-3.5 mr-1" />{reciboGenerado ? "Recibo OK" : "Recibo"}</Button>
          <Button variant="outline" size="sm" onClick={() => { onReset(); onSuccess?.(); }} className="h-9 text-xs"><RotateCcw className="h-3.5 w-3.5 mr-1" />Nueva</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <div className="text-center mb-4">
        <h2 className="text-base font-semibold mb-1">Confirmar Envío</h2>
        <p className="text-xs text-gray-500">Revisa los datos antes de generar</p>
      </div>

      <div className="border rounded-md p-3 mb-4 space-y-2 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Producto:</span><span className="font-medium">{formData.nombre_producto}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Remitente:</span><span className="font-medium truncate max-w-[50%]">{formData.remitente?.nombre}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Destinatario:</span><span className="font-medium truncate max-w-[50%]">{formData.destinatario?.nombre}</span></div>
        <Separator />
        <div className="flex justify-between text-sm"><span className="font-semibold">Total:</span><span className="font-bold text-blue-600">${totalEstimado.toFixed(2)}</span></div>
      </div>

      <Button onClick={abrirModal} disabled={loading} size="sm" className="w-full bg-green-600 hover:bg-green-700">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar Guía"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">¿Generar guía?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Se descontará ${totalEstimado.toFixed(2)} del saldo de Servientrega.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerarGuia} disabled={loading} className="h-8 text-xs bg-green-600">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
