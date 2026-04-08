"use client";

import React, { useEffect, useMemo, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Wallet, Calculator, Package, User, MapPin, Box } from "lucide-react";
import TarifaModal from "./TarifaModal";

interface Remitente { identificacion?: string; nombre?: string; direccion?: string; telefono?: string; email?: string; ciudad?: string; provincia?: string; }
interface Destinatario extends Remitente { codpais?: number; pais?: string; }
interface Medidas { alto: number; ancho: number; largo: number; peso: number; valor_declarado: number; valor_seguro?: number; }
interface FormDataGuia {
  remitente: Remitente; destinatario: Destinatario; medidas: Medidas;
  punto_atencion_id?: string | number; nombre_producto?: string;
  requiere_empaque?: boolean; contenido?: string;
  retiro_oficina?: boolean; nombre_agencia_retiro_oficina?: string;
}

interface PasoResumenProps {
  formData: FormDataGuia;
  onBack: () => void;
  onConfirm: (tarifaData: TarifaResponseUI) => void;
}

interface TarifaResponseUI {
  flete: number; valor_declarado: number; valor_empaque: number; seguro?: number;
  tiempo: string | null; peso_vol?: number; tiva?: number; gtotal?: number; total_transacion?: number;
}

const mapProducto = (nombre?: string): "DOCUMENTO UNITARIO" | "MERCANCIA PREMIER" => {
  return (nombre || "").toUpperCase().includes("DOC") ? "DOCUMENTO UNITARIO" : "MERCANCIA PREMIER";
};

const calcPesoVol = ({ alto = 0, ancho = 0, largo = 0 }: Partial<Medidas>) => {
  return alto > 0 && ancho > 0 && largo > 0 ? (alto * ancho * largo) / 5000 : 0;
};

export default function PasoResumen({ formData, onBack, onConfirm }: PasoResumenProps) {
  const { remitente, destinatario, medidas, punto_atencion_id } = formData;
  const [tarifa, setTarifa] = useState<TarifaResponseUI | null>(null);
  const [tarifaCruda, setTarifaCruda] = useState<unknown>(null);
  const [loadingTarifa, setLoadingTarifa] = useState(false);
  const [saldo, setSaldo] = useState<{ disponible: number; estado: "OK" | "SALDO_BAJO" | "ERROR"; mensaje?: string } | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [showTarifaModal, setShowTarifaModal] = useState(false);

  const pesoFisico = Number(medidas?.peso || 0);
  const pesoVolumetrico = useMemo(() => Number(tarifa?.peso_vol || calcPesoVol(medidas)), [tarifa?.peso_vol, medidas]);
  const pesoFacturable = Math.max(pesoFisico, pesoVolumetrico);

  const total = useMemo(() => {
    if (!tarifa) return 0;
    return tarifa.total_transacion || tarifa.gtotal || (tarifa.flete + (tarifa.valor_empaque || 0) + (tarifa.seguro || 0) + (tarifa.tiva || 0));
  }, [tarifa]);

  const saldoSuficiente = saldo ? saldo.disponible >= total : false;

  const obtenerSaldo = async () => {
    if (!punto_atencion_id) return;
    setLoadingSaldo(true);
    try {
      const { data } = await axiosInstance.get(`/servientrega/saldo/${punto_atencion_id}`);
      const disponible = Number(data.disponible || 0);
      setSaldo({ disponible, estado: disponible < 2 ? "SALDO_BAJO" : "OK", mensaje: disponible < 2 ? "Saldo bajo" : undefined });
    } catch {
      setSaldo({ disponible: 0, estado: "ERROR", mensaje: "Error al consultar saldo" });
    } finally { setLoadingSaldo(false); }
  };

  const fetchTarifa = async () => {
    if (!remitente || !destinatario || !medidas) { toast.error("Faltan datos."); return; }
    setLoadingTarifa(true);
    try {
      const isIntl = (destinatario?.pais || "ECUADOR").toUpperCase() !== "ECUADOR";
      const payload: Record<string, string> = {
        tipo: "obtener_tarifa_nacional",
        ciu_ori: (remitente?.ciudad || "").toUpperCase(),
        provincia_ori: (remitente?.provincia || "").toUpperCase(),
        ciu_des: (destinatario?.ciudad || "").toUpperCase(),
        provincia_des: (destinatario?.provincia || "").toUpperCase(),
        valor_seguro: String(medidas?.valor_seguro ?? "0"),
        valor_declarado: String(medidas?.valor_declarado ?? "0"),
        peso: String(pesoFacturable),
        alto: String(medidas?.alto ?? 0),
        ancho: String(medidas?.ancho ?? 0),
        largo: String(medidas?.largo ?? 0),
        recoleccion: "NO",
        nombre_producto: mapProducto(formData?.nombre_producto),
      };
      if (formData.requiere_empaque) payload.empaque = "AISLANTE DE HUMEDAD";
      if (isIntl) { payload.pais_ori = remitente?.pais || "ECUADOR"; payload.pais_des = destinatario?.pais || "ECUADOR"; payload.codigo_postal_ori = "170150"; payload.codigo_postal_des = "110111"; }

      const res = await axiosInstance.post("/servientrega/tarifa", payload);
      const raw = Array.isArray(res.data) ? res.data[0] : res.data;
      setTarifaCruda(raw);
      if (!raw || raw.flete === undefined) { toast.error("No se pudo calcular tarifa."); setTarifa(null); return; }

      setTarifa({
        flete: Number(raw.flete || 0), valor_declarado: Number(raw.valor_declarado || 0), valor_empaque: Number(raw.valor_empaque || 0),
        seguro: Number(raw.prima || raw.seguro || 0), tiempo: raw.tiempo || "1-2 días", peso_vol: Number(raw.peso_vol || calcPesoVol(medidas)),
        tiva: Number(raw.tiva || 0), gtotal: Number(raw.gtotal || 0), total_transacion: Number(raw.total_transacion || 0),
      });
    } catch { toast.error("Error al calcular tarifa."); setTarifa(null); }
    finally { setLoadingTarifa(false); }
  };

  const validarSaldo = async () => {
    if (!punto_atencion_id || !tarifa) { toast.error("Faltan datos."); return; }
    try {
      const { data } = await axiosInstance.get(`/servientrega/saldo/validar/${punto_atencion_id}?monto=${total}`);
      if (data?.estado === "OK") { onConfirm(tarifa); }
      else { toast.error(data?.mensaje || "Saldo insuficiente."); }
    } catch { toast.error("Error validando saldo."); }
  };

  useEffect(() => { fetchTarifa(); obtenerSaldo(); }, [formData]);

  const InfoRow = ({ label, value, icon: Icon }: { label: string; value?: string | number; icon?: React.ElementType }) => (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-gray-500 flex items-center gap-1">{Icon && <Icon className="h-3 w-3" />} {label}</span>
      <span className="font-medium truncate max-w-[60%]">{value || "-"}</span>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {/* Saldo */}
      <div className={`rounded-lg border p-3 mb-4 ${saldo?.estado === "SALDO_BAJO" ? "bg-yellow-50 border-yellow-200" : saldo?.estado === "ERROR" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Wallet className={`h-4 w-4 ${saldo?.estado === "SALDO_BAJO" ? "text-yellow-600" : saldo?.estado === "ERROR" ? "text-red-600" : "text-green-600"}`} />
            <span className="text-sm font-medium">Saldo</span>
          </div>
          {loadingSaldo && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-lg font-bold ${saldo?.estado === "SALDO_BAJO" ? "text-yellow-600" : saldo?.estado === "ERROR" ? "text-red-600" : "text-green-600"}`}>${saldo?.disponible?.toFixed(2) || "0.00"}</span>
          <div className="text-right">
            <span className="text-xs text-gray-500">Costo: </span>
            <span className={`text-sm font-semibold ${saldoSuficiente ? "text-green-600" : "text-red-600"}`}>${total.toFixed(2)}</span>
          </div>
        </div>
        {saldo?.mensaje && <p className="text-[10px] mt-1 text-yellow-600">{saldo.mensaje}</p>}
      </div>

      {/* Secciones compactas */}
      <div className="space-y-3">
        {/* Producto */}
        <div className="border rounded-md p-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Producto</span>
          </div>
          <InfoRow label="Tipo" value={mapProducto(formData?.nombre_producto)} />
          <InfoRow label="Contenido" value={formData?.contenido || mapProducto(formData?.nombre_producto)} />
        </div>

        {/* Remitente y Destinatario en grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="border rounded-md p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <User className="h-3 w-3 text-blue-600" />
              <span className="text-[10px] font-semibold uppercase">Remitente</span>
            </div>
            <p className="text-[10px] font-medium truncate">{remitente?.nombre}</p>
            <p className="text-[10px] text-gray-500 truncate">{remitente?.ciudad}</p>
          </div>
          <div className="border rounded-md p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MapPin className="h-3 w-3 text-blue-600" />
              <span className="text-[10px] font-semibold uppercase">Destinatario</span>
            </div>
            <p className="text-[10px] font-medium truncate">{destinatario?.nombre}</p>
            <p className="text-[10px] text-gray-500 truncate">{destinatario?.ciudad}</p>
          </div>
        </div>

        {/* Retiro en oficina */}
        {formData?.retiro_oficina && (
          <div className="border rounded-md p-2.5 bg-blue-50/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Box className="h-3 w-3 text-blue-600" />
              <span className="text-[10px] font-semibold">Retiro en Oficina</span>
            </div>
            <p className="text-[10px] truncate">{formData?.nombre_agencia_retiro_oficina}</p>
          </div>
        )}

        {/* Medidas */}
        <div className="border rounded-md p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">Medidas</span>
            <span className="text-[10px] text-gray-500">{pesoFacturable.toFixed(1)}kg</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="bg-gray-50 rounded py-1"><span className="text-gray-400">A</span> {medidas?.alto}</div>
            <div className="bg-gray-50 rounded py-1"><span className="text-gray-400">An</span> {medidas?.ancho}</div>
            <div className="bg-gray-50 rounded py-1"><span className="text-gray-400">L</span> {medidas?.largo}</div>
          </div>
        </div>

        {/* Costos */}
        <div className="border rounded-md p-3 bg-blue-50/30">
          <div className="flex items-center gap-1.5 mb-2">
            <Calculator className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Costos</span>
          </div>
          {tarifa ? (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Flete</span><span>${tarifa.flete.toFixed(2)}</span></div>
                {tarifa.valor_empaque > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Empaque</span><span>${tarifa.valor_empaque.toFixed(2)}</span></div>}
                {tarifa.seguro > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">Seguro</span><span>${tarifa.seguro.toFixed(2)}</span></div>}
                {tarifa.tiva > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500">IVA</span><span>${tarifa.tiva.toFixed(2)}</span></div>}
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Total</span>
                <span className="text-lg font-bold text-blue-600">${total.toFixed(2)}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTarifaModal(true)} className="w-full h-7 text-[10px] mt-2">
                Ver detalles
              </Button>
            </>
          ) : (
            <div className="text-center py-2">
              {loadingTarifa ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <span className="text-xs text-gray-500">Calculando...</span>}
            </div>
          )}
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={onBack} className="flex-1">Atrás</Button>
        <Button size="sm" onClick={validarSaldo} disabled={loadingTarifa || !tarifa} className="flex-1 bg-green-600 hover:bg-green-700">
          Confirmar
        </Button>
      </div>

      <TarifaModal isOpen={showTarifaModal} onClose={() => setShowTarifaModal(false)} tarifa={tarifaCruda} onConfirm={() => setShowTarifaModal(false)} loading={false} saldoDisponible={saldo?.disponible} puntoAtencionNombre={String(punto_atencion_id ?? "")} />
    </div>
  );
}
