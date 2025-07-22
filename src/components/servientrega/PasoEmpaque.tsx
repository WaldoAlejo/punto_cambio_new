"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export interface EmpaqueFormData {
  tipo_empaque: string;
  cantidad: number;
  descripcion: string;
}

interface PasoEmpaqueProps {
  onNext: (empaque: EmpaqueFormData) => void;
}

export default function PasoEmpaque({ onNext }: PasoEmpaqueProps) {
  const [form, setForm] = useState<EmpaqueFormData>({
    tipo_empaque: "",
    cantidad: 1,
    descripcion: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "cantidad" ? parseInt(value) || 0 : value,
    }));
  };

  const handleContinue = () => {
    if (!form.tipo_empaque || form.cantidad <= 0) return;
    onNext(form);
  };

  return (
    <Card className="w-full max-w-lg mx-auto mt-6">
      <CardHeader>
        <CardTitle>Empaque requerido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="tipo_empaque">Tipo de empaque</Label>
          <Input
            name="tipo_empaque"
            value={form.tipo_empaque}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input
            name="cantidad"
            type="number"
            value={form.cantidad}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label htmlFor="descripcion">Descripción</Label>
          <Input
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
          />
        </div>
        <Button className="w-full" onClick={handleContinue}>
          Continuar
        </Button>
      </CardContent>
    </Card>
  );
}
