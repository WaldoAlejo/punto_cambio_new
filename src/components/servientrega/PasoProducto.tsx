"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
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
import { toast } from "sonner";

interface ProductoSeleccionado {
  nombre_producto: string; // "MERCANCIA PREMIER" | "DOCUMENTO UNITARIO"
  esDocumento: boolean;
}

interface PasoProductoProps {
  onNext: (producto: ProductoSeleccionado) => void;
}

// ===== Helpers =====
const clean = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const DOC = "DOCUMENTO UNITARIO";
const MERC = "MERCANCIA PREMIER";

const normalizarProducto = (raw?: string): "" | typeof DOC | typeof MERC => {
  const c = clean(raw || "");
  if (!c) return "";
  if (c.includes("DOC")) return DOC; // DOCUMENTO, DOCUMENTOS, DOCUMENTO UNITARIO, etc.
  if (c.includes("MERCANCIA") && c.includes("PREMIER")) return MERC;
  return ""; // Ignora INTERNACIONAL, INDUSTRIAL, etc.
};

const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

export default function PasoProducto({ onNext }: PasoProductoProps) {
  const [productos, setProductos] = useState<{ nombre_producto: string }[]>([]);
  const [selectedProducto, setSelectedProducto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(true);

  const parseProductos = (data: any): string[] => {
    // Soporta múltiples formatos del backend
    // 1) data.productos -> [{ nombre_producto }]
    if (Array.isArray(data?.productos)) {
      return unique(
        data.productos
          .map((p: any) => normalizarProducto(p?.nombre_producto))
          .filter((x: string) => x === DOC || x === MERC)
      );
    }

    // 2) data.fetch -> [{ producto }] / [{ nombre_producto }] / strings
    if (Array.isArray(data?.fetch)) {
      return unique(
        data.fetch
          .map((p: any) => {
            if (typeof p === "string") return normalizarProducto(p);
            if (p?.producto) return normalizarProducto(p.producto);
            if (p?.nombre_producto)
              return normalizarProducto(p.nombre_producto);
            return "";
          })
          .filter((x: string) => x === DOC || x === MERC)
      );
    }

    // 3) data como array crudo
    if (Array.isArray(data)) {
      return unique(
        data
          .map((p: any) => {
            if (typeof p === "string") return normalizarProducto(p);
            if (p?.producto) return normalizarProducto(p.producto);
            if (p?.nombre_producto)
              return normalizarProducto(p.nombre_producto);
            return "";
          })
          .filter((x: string) => x === DOC || x === MERC)
      );
    }

    return [];
  };

  const fetchProductos = async () => {
    try {
      setCargandoProductos(true);
      const response = await axiosInstance.post("/servientrega/productos");
      const normalizados = parseProductos(response.data);

      // Fallback seguro si el WS trae cosas raras: siempre nuestras 2 opciones
      const finales = normalizados.length > 0 ? normalizados : [MERC, DOC];

      setProductos(finales.map((n) => ({ nombre_producto: n })));
      setSelectedProducto((prev) =>
        prev && finales.includes(prev) ? prev : finales[0]
      );

      if (normalizados.length === 0) {
        toast.warning("Usando productos por defecto.");
      } else {
        toast.success(`${finales.length} producto(s) cargado(s)`);
      }
    } catch (err: any) {
      console.error("❌ Error al cargar productos:", err);
      const errorMessage =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        "Error desconocido";
      toast.error(`Error al cargar productos: ${errorMessage}`);

      const fallback = [MERC, DOC];
      setProductos(fallback.map((n) => ({ nombre_producto: n })));
      setSelectedProducto(fallback[0]);
      toast.info("Se cargaron productos por defecto.");
    } finally {
      setCargandoProductos(false);
    }
  };

  useEffect(() => {
    fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    if (!selectedProducto) {
      toast.error("Debes seleccionar un producto antes de continuar.");
      return;
    }
    setLoading(true);

    const nombre = clean(selectedProducto) === clean(DOC) ? DOC : MERC;

    const resultado: ProductoSeleccionado = {
      nombre_producto: nombre, // garantizado: "MERCANCIA PREMIER" | "DOCUMENTO UNITARIO"
      esDocumento: nombre === DOC,
    };

    setTimeout(() => {
      setLoading(false);
      onNext(resultado);
    }, 200);
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle>Seleccionar tipo de producto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargandoProductos ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : productos.length > 0 ? (
          <>
            <Select
              onValueChange={setSelectedProducto}
              value={selectedProducto}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {productos.map((p, i) => (
                  <SelectItem key={i} value={p.nombre_producto}>
                    {p.nombre_producto}
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
          </>
        ) : (
          <div className="text-center text-gray-500">
            No hay productos disponibles.
            <Button variant="outline" className="mt-3" onClick={fetchProductos}>
              Reintentar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
