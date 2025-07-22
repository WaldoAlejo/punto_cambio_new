"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Pais {
  codpais: number;
  pais: string;
  nombrecorto: string;
  phone_code: string;
}

interface Ciudad {
  ciudad: string;
  provincia: string;
}

interface PasoDestinatarioProps {
  onNext: (destinatario: any) => void;
}

export default function PasoDestinatario({ onNext }: PasoDestinatarioProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    codpais: 0,
    ciudad: "",
    provincia: "",
  });

  useEffect(() => {
    axios
      .post("/api/servientrega/paises")
      .then((res) => {
        setPaises((res.data as { fetch: Pais[] }).fetch || []);
      })
      .catch((err) => {
        console.error("Error al obtener países:", err);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePaisChange = (value: string) => {
    const codpais = parseInt(value);
    setForm((prev) => ({ ...prev, codpais, ciudad: "", provincia: "" }));
    axios
      .post("/api/servientrega/ciudades", { codpais })
      .then((res) => {
        setCiudades((res.data as { fetch: Ciudad[] }).fetch || []);
      })
      .catch((err) => {
        console.error("Error al obtener ciudades:", err);
      });
  };

  const handleCiudadChange = (value: string) => {
    const [ciudad, provincia] = value.split("|");
    setForm((prev) => ({ ...prev, ciudad, provincia }));
  };

  const handleContinue = () => {
    if (
      form.nombre &&
      form.direccion &&
      form.telefono &&
      form.codpais &&
      form.ciudad
    ) {
      setLoading(true);
      onNext(form);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle>Datos del Destinatario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Nombre</Label>
          <Input name="nombre" value={form.nombre} onChange={handleChange} />
        </div>
        <div>
          <Label>Dirección</Label>
          <Input
            name="direccion"
            value={form.direccion}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label>Teléfono</Label>
          <Input
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input name="email" value={form.email} onChange={handleChange} />
        </div>
        <div>
          <Label>País</Label>
          <Select onValueChange={handlePaisChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar país" />
            </SelectTrigger>
            <SelectContent>
              {paises.map((p) => (
                <SelectItem key={p.codpais} value={p.codpais.toString()}>
                  {p.pais}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.codpais > 0 && (
          <div>
            <Label>Ciudad y Provincia</Label>
            <Select onValueChange={handleCiudadChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ciudad" />
              </SelectTrigger>
              <SelectContent>
                {ciudades.map((c, i) => (
                  <SelectItem key={i} value={`${c.ciudad}|${c.provincia}`}>
                    {c.ciudad} - {c.provincia}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={handleContinue}
          disabled={loading || !form.ciudad}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
