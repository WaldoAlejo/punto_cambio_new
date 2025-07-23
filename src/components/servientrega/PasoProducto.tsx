"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProductoSeleccionado {
  nombre: string;
  esDocumento: boolean;
}

interface PasoProductoProps {
  onNext: (producto: ProductoSeleccionado) => void;
}

export default function PasoProducto({ onNext }: PasoProductoProps) {
  const [productos, setProductos] = useState<string[]>([]);
  const [selectedProducto, setSelectedProducto] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const response = await axios.post<{
          fetch: { producto: string }[];
        }>("/api/servientrega/productos");

        const lista = Array.isArray(response.data.fetch)
          ? response.data.fetch
          : [];

        const nombres = lista.map((p) => p.producto?.trim()).filter(Boolean);
        setProductos(nombres);
      } catch (err) {
        console.error("Error al cargar productos:", err);
      }
    };

    fetchProductos();
  }, []);

  const handleContinue = () => {
    if (selectedProducto) {
      const producto: ProductoSeleccionado = {
        nombre: selectedProducto,
        esDocumento: selectedProducto.toUpperCase().includes("DOCUMENTO"),
      };
      onNext(producto);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle>Seleccionar tipo de producto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={setSelectedProducto}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar producto" />
          </SelectTrigger>
          <SelectContent>
            {productos.map((p, i) => (
              <SelectItem key={i} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          disabled={!selectedProducto || loading}
          onClick={handleContinue}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
