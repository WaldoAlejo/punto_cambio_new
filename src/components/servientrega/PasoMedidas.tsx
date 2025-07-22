"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface MedidasPayload {
  alto: number;
  ancho: number;
  largo: number;
  peso: number;
  valor_declarado: number;
  valor_seguro: number;
  recoleccion: boolean;
}

export interface PasoMedidasProps {
  nombreProducto: string;
  onNext: (data: MedidasPayload) => void;
}

export default function PasoMedidas({
  nombreProducto,
  onNext,
}: PasoMedidasProps) {
  const [form, setForm] = useState({
    alto: "",
    ancho: "",
    largo: "",
    peso: "",
    valor_declarado: "",
    seguro: false,
    recoleccion: false,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: string): void => {
    setForm((prev) => ({ ...prev, [name]: !prev[name as keyof typeof prev] }));
  };

  const handleContinue = () => {
    const { alto, ancho, largo, peso, valor_declarado, seguro, recoleccion } =
      form;

    if (!alto || !ancho || !largo || !peso || !valor_declarado) return;

    setLoading(true);

    const payload: MedidasPayload = {
      alto: parseFloat(alto),
      ancho: parseFloat(ancho),
      largo: parseFloat(largo),
      peso: parseFloat(peso),
      valor_declarado: parseFloat(valor_declarado),
      valor_seguro: seguro ? parseFloat(valor_declarado) : 0,
      recoleccion,
    };

    onNext(payload);
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6">
      <CardHeader>
        <CardTitle>Medidas del paquete para: {nombreProducto}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="alto">Alto (cm)</Label>
            <Input name="alto" value={form.alto} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="ancho">Ancho (cm)</Label>
            <Input name="ancho" value={form.ancho} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="largo">Largo (cm)</Label>
            <Input name="largo" value={form.largo} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="peso">Peso (kg)</Label>
            <Input name="peso" value={form.peso} onChange={handleChange} />
          </div>
        </div>

        <div>
          <Label htmlFor="valor_declarado">Valor declarado (USD)</Label>
          <Input
            name="valor_declarado"
            value={form.valor_declarado}
            onChange={handleChange}
          />
        </div>

        <div className="flex items-center space-x-4">
          <Checkbox
            id="seguro"
            checked={form.seguro}
            onCheckedChange={() => handleCheckboxChange("seguro")}
          />
          <Label htmlFor="seguro">¿Requiere seguro?</Label>
        </div>

        <div className="flex items-center space-x-4">
          <Checkbox
            id="recoleccion"
            checked={form.recoleccion}
            onCheckedChange={() => handleCheckboxChange("recoleccion")}
          />
          <Label htmlFor="recoleccion">¿Requiere recolección?</Label>
        </div>

        <Button className="w-full" onClick={handleContinue} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Cargando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
