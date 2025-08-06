"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/services/axiosInstance";
import { Separator } from "@/components/ui/separator";
import type { Empaque, Medidas } from "@/types/servientrega";

// Tipado del prop
interface PasoEmpaqueYMedidasProps {
  nombre_producto: string;
  esDocumento: boolean;
  paisDestino: string;
  ciudadDestino: string;
  provinciaDestino: string;
  // Datos del remitente (origen)
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
  ciudadDestino,
  provinciaDestino,
  paisOrigen,
  ciudadOrigen,
  provinciaOrigen,
  onNext,
}: PasoEmpaqueYMedidasProps) {
  const [loading, setLoading] = useState(false);
  const [empaques, setEmpaques] = useState<EmpaqueApi[]>([]);
  const [loadingEmpaques, setLoadingEmpaques] = useState(true);

  const [medidas, setMedidas] = useState<Medidas>({
    alto: 0,
    ancho: 0,
    largo: 0,
    peso: 0,
    valor_declarado: 0,
    valor_seguro: 0,
    recoleccion: false,
  });

  // Empaque desactivado por defecto
  const [requiereEmpaque, setRequiereEmpaque] = useState(false);
  const [manualSeguro, setManualSeguro] = useState(false);

  const [empaque, setEmpaque] = useState<Empaque>({
    tipo_empaque: "",
    cantidad: 1,
    descripcion: "",
    costo_unitario: 0,
    costo_total: 0,
  });

  const esInternacional = paisDestino?.toUpperCase() !== "ECUADOR";

  // Cargar empaques disponibles
  useEffect(() => {
    const fetchEmpaques = async () => {
      try {
        setLoadingEmpaques(true);
        const { data } = await axiosInstance.post("/servientrega/empaques", {});
        setEmpaques(data?.fetch || []);
      } catch {
        toast.error("Error al obtener la lista de empaques.");
      } finally {
        setLoadingEmpaques(false);
      }
    };
    fetchEmpaques();
  }, []);

  // Lógica por tipo producto/internacional
  useEffect(() => {
    if (esDocumento) {
      setRequiereEmpaque(false);
      setEmpaque({
        tipo_empaque: "",
        cantidad: 0,
        descripcion: "",
        costo_unitario: 0,
        costo_total: 0,
      });
      setMedidas((prev) => ({
        ...prev,
        alto: 0,
        ancho: 0,
        largo: 0,
        peso: 0,
      }));
    } else if (esInternacional && empaques.length > 0) {
      // Empaque obligatorio internacional
      setRequiereEmpaque(true);
      const defaultEmpaque =
        empaques.find((emp) => emp.articulo.toUpperCase().includes("SOBRE")) ||
        empaques[0];
      if (defaultEmpaque) {
        const costoUnitario = parseFloat(defaultEmpaque.valorventa) || 0;
        setEmpaque({
          tipo_empaque: defaultEmpaque.articulo,
          cantidad: 1,
          descripcion: `${defaultEmpaque.articulo} ($${costoUnitario.toFixed(
            2
          )})`,
          costo_unitario: costoUnitario,
          costo_total: costoUnitario,
        });
      }
    }
  }, [esDocumento, esInternacional, empaques]);

  // Cálculo dinámico del empaque
  useEffect(() => {
    setEmpaque((prev) => ({
      ...prev,
      costo_total: prev.costo_unitario * prev.cantidad,
    }));
  }, [empaque.cantidad, empaque.costo_unitario]);

  // Helper para mostrar valores en inputs (vacío si es 0)
  const getDisplayValue = (value: number): string => {
    return value === 0 ? "" : value.toString();
  };

  // Inputs
  const handleMedidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      // Si el campo está vacío, mantenerlo como 0 internamente
      if (value === "") {
        setMedidas((prev) => ({ ...prev, [name]: 0 }));
      } else {
        const numericValue = parseFloat(value);
        if (!isNaN(numericValue)) {
          setMedidas((prev) => ({ ...prev, [name]: numericValue }));
        }
      }
    } else {
      setMedidas((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEmpaqueSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    const empaqueData = empaques.find((emp) => emp.articulo === selected);
    if (empaqueData) {
      const costoUnitario = parseFloat(empaqueData.valorventa) || 0;
      setEmpaque({
        tipo_empaque: empaqueData.articulo,
        cantidad: 1,
        descripcion: `${empaqueData.articulo} ($${costoUnitario.toFixed(2)})`,
        costo_unitario: costoUnitario,
        costo_total: costoUnitario,
      });
    }
  };

  const handleContinue = () => {
    if (!medidas.valor_declarado || medidas.valor_declarado <= 0) {
      toast.error("Debes ingresar un valor declarado válido.");
      return;
    }
    if (!esDocumento && !requiereEmpaque) {
      if (!medidas.alto || !medidas.ancho || !medidas.largo || !medidas.peso) {
        toast.error("Debes ingresar todas las medidas y el peso.");
        return;
      }
    }
    setLoading(true);
    onNext({
      medidas: {
        alto: esDocumento || requiereEmpaque ? 0 : medidas.alto,
        ancho: esDocumento || requiereEmpaque ? 0 : medidas.ancho,
        largo: esDocumento || requiereEmpaque ? 0 : medidas.largo,
        peso: esDocumento || requiereEmpaque ? 0 : medidas.peso,
        valor_declarado: medidas.valor_declarado,
        valor_seguro: manualSeguro ? medidas.valor_seguro : 0,
        recoleccion: !!medidas.recoleccion,
      },
      empaque: requiereEmpaque ? empaque : undefined,
    });
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Detalles del paquete - {nombre_producto || "N/A"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Switch empaque */}
        {!esDocumento && (
          <div className="flex items-center justify-between">
            <Label className="font-medium">
              ¿Requiere empaque y embalaje?
              {esInternacional && (
                <span className="text-red-500 ml-1">
                  (Obligatorio internacional)
                </span>
              )}
            </Label>
            <Switch
              checked={requiereEmpaque}
              onCheckedChange={setRequiereEmpaque}
              disabled={esInternacional}
            />
          </div>
        )}

        {/* Empaque */}
        {requiereEmpaque && !esDocumento && (
          <>
            <div>
              <Label>Tipo de empaque</Label>
              <select
                className="w-full border rounded p-2 mt-1"
                value={empaque.tipo_empaque}
                onChange={handleEmpaqueSelect}
              >
                <option value="">-- Seleccione un empaque --</option>
                {empaques.map((emp, idx) => (
                  <option key={idx} value={emp.articulo}>
                    {emp.articulo} (${emp.valorventa})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  value={empaque.cantidad}
                  onChange={(e) =>
                    setEmpaque((prev) => ({
                      ...prev,
                      cantidad: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-sm">Costo total empaque:</span>
                <span className="font-bold text-green-600">
                  ${empaque.costo_total.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Medidas solo si no hay empaque y no es documento */}
        {!requiereEmpaque && !esDocumento && (
          <div className="grid grid-cols-2 gap-4">
            {["alto", "ancho", "largo", "peso"].map((campo) => (
              <div key={campo}>
                <Label className="capitalize">
                  {campo} {campo === "peso" ? "(kg)" : "(cm)"}
                </Label>
                <Input
                  name={campo}
                  type="number"
                  value={getDisplayValue((medidas as any)[campo])}
                  onChange={handleMedidaChange}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        )}

        {/* Valor mercancía y seguro */}
        <Separator />
        <div>
          <Label>Valor declarado de la mercancía (USD)</Label>
          <Input
            name="valor_declarado"
            type="number"
            value={getDisplayValue(medidas.valor_declarado)}
            onChange={handleMedidaChange}
            placeholder="0.00"
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <Label>¿Ingresar seguro manual?</Label>
          <Switch checked={manualSeguro} onCheckedChange={setManualSeguro} />
        </div>
        {manualSeguro && (
          <div>
            <Label>Valor del seguro (USD)</Label>
            <Input
              name="valor_seguro"
              type="number"
              value={getDisplayValue(medidas.valor_seguro)}
              onChange={handleMedidaChange}
              placeholder="0.00"
            />
          </div>
        )}

        {/* Botón */}
        <Button
          className="w-full mt-4"
          onClick={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
