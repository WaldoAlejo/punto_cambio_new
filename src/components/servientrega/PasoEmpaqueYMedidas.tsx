"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/services/axiosInstance";
import type { Empaque, Medidas } from "@/types/servientrega";

interface PasoEmpaqueYMedidasProps {
  nombre_producto: string;
  esDocumento: boolean;
  paisDestino: string;
  ciudadDestino: string;
  provinciaDestino: string;
  paisOrigen: string;
  ciudadOrigen: string;
  provinciaOrigen: string;
  onNext: (data: { medidas: Medidas; empaque?: Empaque }) => void;
}

interface EmpaqueApi {
  articulo: string;
  valorventa: string;
}

export default function PasoEmpaqueYMedidas({
  nombre_producto,
  esDocumento,
  paisDestino,
  esInternacional: _esInternacional,
  onNext,
}: PasoEmpaqueYMedidasProps & { esInternacional?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [empaques, setEmpaques] = useState<EmpaqueApi[]>([]);
  const [loadingEmpaques, setLoadingEmpaques] = useState(true);

  const [medidas, setMedidas] = useState<Medidas>({
    alto: 0, ancho: 0, largo: 0, peso: 0, valor_declarado: 0, valor_seguro: 0, recoleccion: false, contenido: "",
  });

  const [requiereEmpaque, setRequiereEmpaque] = useState(false);
  const [manualSeguro, setManualSeguro] = useState(false);

  const [empaque, setEmpaque] = useState<Empaque>({
    tipo_empaque: "", cantidad: 1, descripcion: "", costo_unitario: 0, costo_total: 0,
  });

  const esInternacional = (paisDestino || "").toUpperCase() !== "ECUADOR" || _esInternacional;
  const PESO_MIN_DOCUMENTO = 0.5;

  useEffect(() => {
    axiosInstance.post("/servientrega/empaques", {}).then(({ data }) => {
      setEmpaques(data?.fetch || []);
      setLoadingEmpaques(false);
    }).catch(() => setLoadingEmpaques(false));
  }, []);

  useEffect(() => {
    if (esDocumento) {
      setRequiereEmpaque(false);
      setEmpaque({ tipo_empaque: "", cantidad: 0, descripcion: "", costo_unitario: 0, costo_total: 0 });
      setMedidas((p) => ({ ...p, alto: 0, ancho: 0, largo: 0, peso: Math.max(p.peso || 0, PESO_MIN_DOCUMENTO) }));
      return;
    }
    if (!esDocumento && esInternacional && empaques.length > 0) {
      setRequiereEmpaque(true);
      const defaultEmp = empaques.find((e) => e.articulo.toUpperCase().includes("SOBRE")) || empaques[0];
      if (defaultEmp) {
        const costo = parseFloat(defaultEmp.valorventa) || 0;
        setEmpaque({ tipo_empaque: defaultEmp.articulo, cantidad: 1, descripcion: `${defaultEmp.articulo} ($${costo.toFixed(2)})`, costo_unitario: costo, costo_total: costo });
      }
    }
  }, [esDocumento, esInternacional, empaques]);

  useEffect(() => {
    setEmpaque((p) => ({ ...p, costo_total: (p.costo_unitario || 0) * (p.cantidad || 0) }));
  }, [empaque.cantidad, empaque.costo_unitario]);

  const handleMedidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value === "") setMedidas((p) => ({ ...p, [name]: 0 }));
    else { const n = parseFloat(value); if (!isNaN(n)) setMedidas((p) => ({ ...p, [name]: n })); }
  };

  const handleEmpaqueSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const emp = empaques.find((x) => x.articulo === e.target.value);
    if (emp) {
      const costo = parseFloat(emp.valorventa) || 0;
      setEmpaque({ tipo_empaque: emp.articulo, cantidad: 1, descripcion: `${emp.articulo} ($${costo.toFixed(2)})`, costo_unitario: costo, costo_total: costo });
    }
  };

  const validar = () => {
    if (!medidas.contenido?.trim()) { toast.error("Describe el contenido."); return false; }
    if (esDocumento) return true;
    if (esInternacional && (!requiereEmpaque || !empaque.tipo_empaque)) { toast.error("Empaque obligatorio internacional."); return false; }
    if (!requiereEmpaque && (!medidas.alto || !medidas.ancho || !medidas.largo || !medidas.peso)) { toast.error("Ingresa medidas y peso."); return false; }
    if (requiereEmpaque && !empaque.tipo_empaque) { toast.error("Selecciona empaque."); return false; }
    return true;
  };

  const handleContinue = () => {
    if (!validar()) return;
    setLoading(true);
    const final: Medidas = {
      alto: esDocumento ? 0 : requiereEmpaque ? 0 : medidas.alto,
      ancho: esDocumento ? 0 : requiereEmpaque ? 0 : medidas.ancho,
      largo: esDocumento ? 0 : requiereEmpaque ? 0 : medidas.largo,
      peso: esDocumento ? Math.max(medidas.peso || 0, PESO_MIN_DOCUMENTO) : requiereEmpaque ? 0 : medidas.peso,
      valor_declarado: medidas.valor_declarado || 0,
      valor_seguro: manualSeguro ? medidas.valor_seguro : 0,
      recoleccion: !!medidas.recoleccion,
      contenido: (medidas.contenido || "").trim(),
    };
    onNext({ medidas: final, empaque: requiereEmpaque ? empaque : undefined });
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-semibold">Detalles del Paquete</h2>
      </div>

      <div className="space-y-3">
        {/* Contenido siempre visible */}
        <Input name="contenido" placeholder="Contenido del paquete *" value={medidas.contenido} onChange={(e) => setMedidas((p) => ({ ...p, contenido: e.target.value }))} className="h-9 text-sm" />

        {/* Documento: solo peso */}
        {esDocumento && (
          <Input name="peso" type="number" placeholder={`Peso mínimo ${PESO_MIN_DOCUMENTO}kg`} value={medidas.peso || ""} onChange={handleMedidaChange} className="h-9 text-sm" />
        )}

        {/* Mercancía: empaque o medidas */}
        {!esDocumento && (
          <>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs">¿Requiere empaque?</span>
              <Switch checked={requiereEmpaque} onCheckedChange={setRequiereEmpaque} disabled={esInternacional} className="scale-75" />
            </div>

            {requiereEmpaque ? (
              <div className="space-y-2">
                <select className="w-full border rounded h-9 px-2 text-xs" value={empaque.tipo_empaque} onChange={handleEmpaqueSelect} disabled={loadingEmpaques}>
                  <option value="">{loadingEmpaques ? "Cargando..." : "Seleccionar empaque"}</option>
                  {empaques.slice(0, 5).map((e, i) => (
                    <option key={i} value={e.articulo}>{e.articulo} (${e.valorventa})</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" value={empaque.cantidad} onChange={(e) => setEmpaque((p) => ({ ...p, cantidad: Math.max(parseInt(e.target.value) || 1, 1) }))} className="h-8 text-xs w-20" />
                  <span className="text-xs text-green-600 font-medium">Total: ${empaque.costo_total.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {["alto", "ancho", "largo", "peso"].map((c) => (
                  <Input key={c} name={c} type="number" placeholder={c === "peso" ? "kg" : "cm"} value={medidas[c as keyof Medidas] as number || ""} onChange={handleMedidaChange} className="h-9 text-xs text-center" />
                ))}
              </div>
            )}
          </>
        )}

        {/* Valor y seguro */}
        <div className="grid grid-cols-2 gap-2">
          <Input name="valor_declarado" type="number" placeholder="Valor declarado" value={medidas.valor_declarado || ""} onChange={handleMedidaChange} className="h-9 text-xs" />
          <div className="flex items-center gap-2">
            <Switch checked={manualSeguro} onCheckedChange={setManualSeguro} className="scale-75" />
            <span className="text-[10px]">Seguro</span>
          </div>
        </div>
        {manualSeguro && (
          <Input name="valor_seguro" type="number" placeholder="Valor seguro" value={medidas.valor_seguro || ""} onChange={handleMedidaChange} className="h-9 text-xs" />
        )}

        <Button onClick={handleContinue} disabled={loading} size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
