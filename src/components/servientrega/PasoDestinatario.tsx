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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

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

interface Agencia {
  nombre: string;
  tipo_cs: string;
  direccion: string;
  ciudad: string;
}

interface PasoDestinatarioProps {
  onNext: (destinatario: any) => void;
}

export default function PasoDestinatario({ onNext }: PasoDestinatarioProps) {
  const [paises, setPaises] = useState<Pais[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [mostrarAgencias, setMostrarAgencias] = useState(false);
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    identificacion: "",
    codpais: 0,
    ciudad: "",
    provincia: "",
  });

  useEffect(() => {
    axios
      .post("/api/servientrega/paises")
      .then((res) => {
        const data = res.data as { fetch: Pais[] };
        setPaises(data.fetch || []);
      })
      .catch((err) => console.error("Error al obtener países:", err));
  }, []);

  const handlePaisChange = (value: string) => {
    const codpais = parseInt(value);
    setForm((prev) => ({ ...prev, codpais, ciudad: "", provincia: "" }));

    axios
      .post("/api/servientrega/ciudades", { codpais })
      .then((res) => {
        const data = res.data as { fetch: { city: string }[] };
        const lista = Array.isArray(data.fetch) ? data.fetch : [];
        const transformadas: Ciudad[] = lista.map((item) => {
          const [ciudad, provincia] = item.city.split("-");
          return {
            ciudad: ciudad?.trim() ?? "",
            provincia: provincia?.trim() ?? "",
          };
        });
        setCiudades(transformadas);
      })
      .catch((err) => console.error("Error al obtener ciudades:", err));
  };

  const handleCiudadChange = (value: string) => {
    const [ciudad, provincia] = value.split("|");
    setForm((prev) => ({ ...prev, ciudad, provincia }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = async (checked: boolean) => {
    setMostrarAgencias(checked);
    if (checked && agencias.length === 0) {
      try {
        const res = await axios.post("/api/servientrega/agencias", {
          tipo: "obtener_agencias_aliadas",
          usuingreso: "PRUEBA",
          contrasenha: "s12345ABCDe",
        });

        const data = res.data as { fetch: any[] };
        const lista = Array.isArray(data.fetch) ? data.fetch : [];
        const transformadas: Agencia[] = lista.map((a: any) => ({
          nombre: String(Object.values(a)[0] ?? ""),
          tipo_cs: String(a.tipo_cs?.trim() ?? ""),
          direccion: String(a.direccion?.trim() ?? ""),
          ciudad: String(a.ciudad?.trim() ?? ""),
        }));
        setAgencias(transformadas);
      } catch (error) {
        console.error("Error al cargar agencias:", error);
      }
    }
  };

  const handleContinue = () => {
    if (
      !form.nombre ||
      !form.direccion ||
      !form.telefono ||
      !form.codpais ||
      !form.ciudad
    ) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }

    if (!/^(09\d{8}|0[2-7]\d{7,8})$/.test(form.telefono)) {
      toast.error("Número de teléfono inválido.");
      return;
    }

    if (
      form.codpais === 593 &&
      form.identificacion &&
      !/^[0-9]{10}$/.test(form.identificacion)
    ) {
      toast.error("Cédula inválida.");
      return;
    }

    const destinatarioFinal = {
      ...form,
      entrega_en_oficina: mostrarAgencias,
      agencia_seleccionada: mostrarAgencias ? agenciaSeleccionada : null,
    };

    setLoading(true);
    onNext(destinatarioFinal);
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle>Datos del Destinatario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          name="nombre"
          placeholder="Nombre"
          value={form.nombre}
          onChange={handleChange}
        />
        <Input
          name="direccion"
          placeholder="Dirección"
          value={form.direccion}
          onChange={handleChange}
        />
        <Input
          name="telefono"
          placeholder="Teléfono"
          value={form.telefono}
          onChange={handleChange}
        />
        <Input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />
        <Input
          name="identificacion"
          placeholder="Identificación"
          value={form.identificacion}
          onChange={handleChange}
        />

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

        {form.codpais > 0 && (
          <>
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
          </>
        )}

        <div className="flex items-center gap-2 mt-2">
          <Checkbox
            checked={mostrarAgencias}
            onCheckedChange={handleCheckboxChange}
          />
          <Label>¿Entrega en oficina?</Label>
        </div>

        {mostrarAgencias && (
          <div>
            <Label>Seleccionar agencia</Label>
            <Select onValueChange={setAgenciaSeleccionada}>
              <SelectTrigger>
                <SelectValue placeholder="Agencia de retiro" />
              </SelectTrigger>
              <SelectContent>
                {agencias.map((a, i) => (
                  <SelectItem key={i} value={a.nombre}>
                    {a.nombre} - {a.ciudad} ({a.tipo_cs})
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
