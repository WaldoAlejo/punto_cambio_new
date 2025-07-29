"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  nombreProducto: string;
  esDocumento: boolean;
  onNext: (data: {
    medidas: {
      alto: number;
      ancho: number;
      largo: number;
      peso: number;
      valor_declarado: number;
      valor_seguro: number;
      recoleccion: boolean;
    };
    empaque?: {
      tipo_empaque: string;
      cantidad: number;
      descripcion: string;
    };
  }) => void;
}

export default function PasoEmpaqueYMedidas({
  nombreProducto,
  esDocumento,
  onNext,
}: Props) {
  const [loading, setLoading] = useState(false);

  const [medidas, setMedidas] = useState({
    alto: "",
    ancho: "",
    largo: "",
    peso: "",
    valor_declarado: "",
    recoleccion: false,
  });

  const [requiereEmpaque, setRequiereEmpaque] = useState(true);
  const [empaque, setEmpaque] = useState({
    tipo_empaque: "",
    cantidad: 1,
    descripcion: "",
  });

  // ✅ Autoformato de valor declarado
  useEffect(() => {
    if (parseFloat(medidas.valor_declarado) < 0) {
      setMedidas((prev) => ({ ...prev, valor_declarado: "0" }));
    }
  }, [medidas.valor_declarado]);

  const handleMedidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (["alto", "ancho", "largo", "peso", "valor_declarado"].includes(name)) {
      if (!/^\d*\.?\d*$/.test(value)) return; // solo números y decimales
    }
    setMedidas((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmpaqueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmpaque((prev) => ({
      ...prev,
      [name]: name === "cantidad" ? Math.max(1, parseInt(value) || 0) : value,
    }));
  };

  const toggleRecoleccion = () => {
    setMedidas((prev) => ({ ...prev, recoleccion: !prev.recoleccion }));
  };

  const handleContinue = () => {
    const { alto, ancho, largo, peso, valor_declarado, recoleccion } = medidas;

    // ✅ Validaciones obligatorias
    if (!valor_declarado || parseFloat(valor_declarado) <= 0) {
      toast.error("Debes ingresar un valor declarado válido.");
      return;
    }
    if (!esDocumento && (!alto || !ancho || !largo || !peso)) {
      toast.error("Debes ingresar todas las medidas y el peso.");
      return;
    }
    if (requiereEmpaque && (!empaque.tipo_empaque || empaque.cantidad <= 0)) {
      toast.error("Debes completar la información del empaque.");
      return;
    }

    const payload = {
      medidas: {
        alto: esDocumento ? 0 : parseFloat(alto),
        ancho: esDocumento ? 0 : parseFloat(ancho),
        largo: esDocumento ? 0 : parseFloat(largo),
        peso: esDocumento ? 0 : parseFloat(peso),
        valor_declarado: parseFloat(valor_declarado),
        valor_seguro: parseFloat(valor_declarado) * 1, // Seguro igual al valor declarado
        recoleccion,
      },
      empaque: requiereEmpaque
        ? {
            tipo_empaque: empaque.tipo_empaque,
            cantidad: empaque.cantidad,
            descripcion: empaque.descripcion,
          }
        : undefined,
    };

    setLoading(true);
    onNext(payload);
  };

  return (
    <Card className="w-full max-w-xl mx-auto mt-6 shadow-lg border rounded-xl">
      <CardHeader>
        <CardTitle>Detalles del paquete - {nombreProducto}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 📦 Medidas */}
        {!esDocumento && (
          <div className="grid grid-cols-2 gap-4">
            {["alto", "ancho", "largo", "peso"].map((campo) => (
              <div key={campo}>
                <Label htmlFor={campo} className="font-medium capitalize">
                  {campo} {campo === "peso" ? "(kg)" : "(cm)"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  name={campo}
                  placeholder={`Ingrese ${campo}`}
                  value={(medidas as any)[campo]}
                  onChange={handleMedidaChange}
                  type="number"
                  min="0"
                  step="0.1"
                />
              </div>
            ))}
          </div>
        )}

        {/* 💵 Valor declarado */}
        <div>
          <Label htmlFor="valor_declarado" className="font-medium">
            Valor declarado (USD) <span className="text-red-500">*</span>
          </Label>
          <Input
            name="valor_declarado"
            placeholder="Ej: 50.00"
            value={medidas.valor_declarado}
            onChange={handleMedidaChange}
            type="number"
            min="0"
            step="0.01"
          />
        </div>

        {/* ✅ Seguro automático */}
        {medidas.valor_declarado && (
          <div className="text-sm text-gray-600">
            Seguro calculado automáticamente:{" "}
            <span className="font-semibold text-green-600">
              ${parseFloat(medidas.valor_declarado || "0").toFixed(2)}
            </span>
          </div>
        )}

        {/* 🔄 Recolección */}
        <div className="flex items-center gap-3 mt-3">
          <Checkbox
            id="recoleccion"
            checked={medidas.recoleccion}
            onCheckedChange={toggleRecoleccion}
          />
          <Label htmlFor="recoleccion">¿Requiere recolección?</Label>
        </div>

        {/* 📦 Empaque */}
        <div className="flex items-center justify-between mt-4">
          <Label className="font-medium">¿Requiere empaque y embalaje?</Label>
          <Switch
            checked={requiereEmpaque}
            onCheckedChange={setRequiereEmpaque}
          />
        </div>

        {requiereEmpaque && (
          <>
            <hr className="my-4" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo_empaque">
                  Tipo de empaque <span className="text-red-500">*</span>
                </Label>
                <Input
                  name="tipo_empaque"
                  placeholder="Caja, sobre, bolsa..."
                  value={empaque.tipo_empaque}
                  onChange={handleEmpaqueChange}
                />
              </div>
              <div>
                <Label htmlFor="cantidad">
                  Cantidad <span className="text-red-500">*</span>
                </Label>
                <Input
                  name="cantidad"
                  type="number"
                  min="1"
                  value={empaque.cantidad}
                  onChange={handleEmpaqueChange}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción del empaque</Label>
              <Input
                name="descripcion"
                placeholder="Opcional"
                value={empaque.descripcion}
                onChange={handleEmpaqueChange}
              />
            </div>
          </>
        )}

        {/* Botón continuar */}
        <Button
          className="w-full mt-5"
          onClick={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
