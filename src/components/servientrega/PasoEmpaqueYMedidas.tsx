"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

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

  const handleMedidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMedidas((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmpaqueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmpaque((prev) => ({
      ...prev,
      [name]: name === "cantidad" ? parseInt(value) || 0 : value,
    }));
  };

  const toggleRecoleccion = () => {
    setMedidas((prev) => ({
      ...prev,
      recoleccion: !prev.recoleccion,
    }));
  };

  const handleContinue = () => {
    const { alto, ancho, largo, peso, valor_declarado, recoleccion } = medidas;

    if (
      !valor_declarado ||
      (requiereEmpaque && (!empaque.tipo_empaque || empaque.cantidad <= 0))
    ) {
      return;
    }

    const payload: {
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
    } = {
      medidas: {
        alto: esDocumento ? 0 : parseFloat(alto),
        ancho: esDocumento ? 0 : parseFloat(ancho),
        largo: esDocumento ? 0 : parseFloat(largo),
        peso: esDocumento ? 0 : parseFloat(peso),
        valor_declarado: parseFloat(valor_declarado),
        valor_seguro: parseFloat(valor_declarado),
        recoleccion,
      },
    };

    if (requiereEmpaque) {
      payload.empaque = {
        tipo_empaque: empaque.tipo_empaque,
        cantidad: empaque.cantidad,
        descripcion: empaque.descripcion,
      };
    }

    setLoading(true);
    onNext(payload);
  };

  return (
    <Card className="w-full max-w-xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Detalles del paquete - {nombreProducto}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!esDocumento && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alto">Alto (cm)</Label>
              <Input
                name="alto"
                value={medidas.alto}
                onChange={handleMedidaChange}
              />
            </div>
            <div>
              <Label htmlFor="ancho">Ancho (cm)</Label>
              <Input
                name="ancho"
                value={medidas.ancho}
                onChange={handleMedidaChange}
              />
            </div>
            <div>
              <Label htmlFor="largo">Largo (cm)</Label>
              <Input
                name="largo"
                value={medidas.largo}
                onChange={handleMedidaChange}
              />
            </div>
            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                name="peso"
                value={medidas.peso}
                onChange={handleMedidaChange}
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="valor_declarado">Valor declarado (USD)</Label>
          <Input
            name="valor_declarado"
            value={medidas.valor_declarado}
            onChange={handleMedidaChange}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="recoleccion"
            checked={medidas.recoleccion}
            onCheckedChange={toggleRecoleccion}
          />
          <Label htmlFor="recoleccion">¿Requiere recolección?</Label>
        </div>

        <div className="flex items-center justify-between">
          <Label>¿Requiere empaque y embalaje?</Label>
          <Switch
            checked={requiereEmpaque}
            onCheckedChange={setRequiereEmpaque}
          />
        </div>

        {requiereEmpaque && (
          <>
            <hr />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipo_empaque">Tipo de empaque</Label>
                <Input
                  name="tipo_empaque"
                  value={empaque.tipo_empaque}
                  onChange={handleEmpaqueChange}
                />
              </div>
              <div>
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input
                  name="cantidad"
                  type="number"
                  value={empaque.cantidad}
                  onChange={handleEmpaqueChange}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción del empaque</Label>
              <Input
                name="descripcion"
                value={empaque.descripcion}
                onChange={handleEmpaqueChange}
              />
            </div>
          </>
        )}

        <Button className="w-full" onClick={handleContinue} disabled={loading}>
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
