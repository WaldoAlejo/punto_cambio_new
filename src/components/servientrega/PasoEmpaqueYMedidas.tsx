"use client";

import React, { useEffect, useState } from "react";
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
  nombre_producto: string; // "MERCANCIA PREMIER" | "DOCUMENTOS"
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
  paisDestino: _paisDestino,
  ciudadDestino: _ciudadDestino,
  provinciaDestino: _provinciaDestino,
  paisOrigen: _paisOrigen,
  ciudadOrigen: _ciudadOrigen,
  provinciaOrigen: _provinciaOrigen,
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
    valor_declarado: 0, // ahora puede quedarse en 0
    valor_seguro: 0,
    recoleccion: false,
    contenido: "",
  });

  // Empaque desactivado por defecto (en internacional se fuerza a true)
  const [requiereEmpaque, setRequiereEmpaque] = useState(false);
  const [manualSeguro, setManualSeguro] = useState(false);

  const [empaque, setEmpaque] = useState<Empaque>({
    tipo_empaque: "",
    cantidad: 1,
    descripcion: "",
    costo_unitario: 0,
    costo_total: 0,
  });

  const esInternacional = (_paisDestino || "").toUpperCase() !== "ECUADOR";
  const PESO_MIN_DOCUMENTO = 0.5;

  // ==============
  // Cargar empaques
  // ==============
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

  // ============================================================
  // Reglas por producto y tipo de envío (DOC / MERCANCÍA / INTL)
  // ============================================================
  useEffect(() => {
    if (esDocumento) {
      // Documento: sin medidas y con peso mínimo 0.5
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
        peso: Math.max(prev.peso || 0, PESO_MIN_DOCUMENTO),
      }));
      return;
    }

    // Mercancía internacional: empaque obligatorio
    if (!esDocumento && esInternacional && empaques.length > 0) {
      setRequiereEmpaque(true);
      const defaultEmpaque =
        empaques.find((emp) =>
          (emp.articulo || "").toUpperCase().includes("SOBRE")
        ) || empaques[0];
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

  // ==========================
  // Recalcular costo de empaque
  // ==========================
  useEffect(() => {
    setEmpaque((prev) => ({
      ...prev,
      costo_total: (prev.costo_unitario || 0) * (prev.cantidad || 0),
    }));
  }, [empaque.cantidad, empaque.costo_unitario]);

  // ==========================
  // Helpers de inputs y cambios
  // ==========================
  const getDisplayValue = (value: number): string =>
    value === 0 ? "" : String(value);

  const handleMedidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "number") {
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

  // ============
  // Validaciones
  // ============
  const validar = () => {
    if (!medidas.contenido || !medidas.contenido.trim()) {
      toast.error("Debes describir el contenido del paquete.");
      return false;
    }

    // 🔓 Valor declarado ya NO es obligatorio
    if (!medidas.valor_declarado || medidas.valor_declarado <= 0) {
      toast.error("Debes ingresar un valor declarado válido.");
      return false;
    }

    if (esDocumento) {
      return true;
    }

    if (esInternacional) {
      // Mercancía internacional: empaque obligatorio
      if (!requiereEmpaque) {
        toast.error("Para envíos internacionales, el empaque es obligatorio.");
        return false;
      }
      if (!empaque.tipo_empaque) {
        toast.error("Selecciona un tipo de empaque.");
        return false;
      }
      return true;
    }

    // Nacional con mercancía:
    if (!requiereEmpaque) {
      if (!medidas.alto || !medidas.ancho || !medidas.largo || !medidas.peso) {
        toast.error("Debes ingresar alto, ancho, largo y peso.");
        return false;
      }
    } else {
      if (!empaque.tipo_empaque) {
        toast.error("Selecciona un tipo de empaque.");
        return false;
      }
    }

    return true;
  };

  // =========
  // Continuar
  // =========
  const handleContinue = () => {
    if (!validar()) return;

    setLoading(true);
    try {
      // Forzar reglas finales antes de pasar al siguiente paso
      const finalMedidas: Medidas = {
        alto: esDocumento ? 0 : requiereEmpaque ? 0 : medidas.alto,
        ancho: esDocumento ? 0 : requiereEmpaque ? 0 : medidas.ancho,
        largo: esDocumento ? 0 : requiereEmpaque ? 0 : medidas.largo,
        peso: esDocumento
          ? Math.max(medidas.peso || 0, PESO_MIN_DOCUMENTO)
          : requiereEmpaque
          ? 0
          : medidas.peso,
        // ✅ valor declarado puede ser 0
        valor_declarado: medidas.valor_declarado || 0,
        valor_seguro: manualSeguro ? medidas.valor_seguro : 0,
        recoleccion: !!medidas.recoleccion,
        contenido: (medidas.contenido || "").trim(),
      };

      onNext({
        medidas: finalMedidas,
        empaque: requiereEmpaque ? empaque : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>
          Detalles del paquete —{" "}
          {nombre_producto ||
            (esDocumento ? "DOCUMENTOS" : "MERCANCIA PREMIER")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Switch empaque (no aplica a DOCUMENTOS) */}
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
              disabled={esInternacional} // en internacional siempre true
            />
          </div>
        )}

        {/* Selector de empaques */}
        {requiereEmpaque && !esDocumento && (
          <>
            <div>
              <Label>Tipo de empaque</Label>
              <select
                className="w-full border rounded p-2 mt-1"
                value={empaque.tipo_empaque}
                onChange={handleEmpaqueSelect}
                disabled={loadingEmpaques}
              >
                <option value="">
                  {loadingEmpaques
                    ? "Cargando empaques..."
                    : "-- Seleccione un empaque --"}
                </option>
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
                      cantidad: Math.max(parseInt(e.target.value) || 1, 1),
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

        {/* Medidas (solo mercancía nacional sin empaque) */}
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
                  value={getDisplayValue(
                    medidas[campo as keyof typeof medidas] as number
                  )}
                  onChange={handleMedidaChange}
                  placeholder="0"
                  min="0"
                />
              </div>
            ))}
          </div>
        )}

        {/* Valor mercancía y seguro */}
        <Separator />
        <div>
          {/* 🔓 sin asterisco, ya no es obligatorio */}
          <Label>Valor declarado de la mercancía (USD)</Label>
          <Input
            name="valor_declarado"
            type="number"
            value={getDisplayValue(medidas.valor_declarado)}
            onChange={handleMedidaChange}
            placeholder="0.00"
            min="0"
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
              min="0"
            />
          </div>
        )}

        {/* Contenido del paquete */}
        <Separator />
        <div>
          <Label>Contenido del paquete *</Label>
          <Input
            name="contenido"
            type="text"
            value={medidas.contenido}
            onChange={(e) =>
              setMedidas((prev) => ({ ...prev, contenido: e.target.value }))
            }
            placeholder="Describe el contenido del paquete"
            required
          />
        </div>

        {/* Botón */}
        <Button
          className="w-full mt-4"
          onClick={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Continuar
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
