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
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

interface ProductoSeleccionado {
  nombre_producto: string;
  esDocumento: boolean;
}

interface PasoProductoProps {
  onNext: (producto: ProductoSeleccionado) => void;
}

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
  if (c.includes("DOC")) return DOC;
  if (c.includes("MERCANCIA") && c.includes("PREMIER")) return MERC;
  return "";
};

const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

export default function PasoProducto({ onNext }: PasoProductoProps) {
  const [productos, setProductos] = useState<{ nombre_producto: string }[]>([]);
  const [selectedProducto, setSelectedProducto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(true);

  const parseProductos = (data: unknown): string[] => {
    const pickNombre = (p: unknown): string => {
      if (typeof p === "string") return normalizarProducto(p);
      if (p && typeof p === "object") {
        const rec = p as Record<string, unknown>;
        const producto = rec["producto"];
        if (typeof producto === "string") return normalizarProducto(producto);
        const nombreProducto = rec["nombre_producto"];
        if (typeof nombreProducto === "string")
          return normalizarProducto(nombreProducto);
      }
      return "";
    };

    const asRecord =
      data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    if (asRecord && Array.isArray(asRecord["productos"])) {
      const productos = asRecord["productos"] as unknown[];
      return unique(
        productos
          .map((p) => pickNombre(p))
          .filter((x: string) => x === DOC || x === MERC)
      );
    }

    if (asRecord && Array.isArray(asRecord["fetch"])) {
      const fetch = asRecord["fetch"] as unknown[];
      return unique(
        fetch
          .map((p) => pickNombre(p))
          .filter((x: string) => x === DOC || x === MERC)
      );
    }

    if (Array.isArray(data)) {
      return unique(
        data
          .map((p) => pickNombre(p))
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
      const finales = normalizados.length > 0 ? normalizados : [MERC, DOC];

      setProductos(finales.map((n) => ({ nombre_producto: n })));
      setSelectedProducto((prev) =>
        prev && finales.includes(prev) ? prev : finales[0]
      );

      if (normalizados.length === 0) {
        toast.warning("Usando productos por defecto.");
      }
    } catch (err: unknown) {
      console.error("❌ Error al cargar productos:", err);
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
      toast.error("Selecciona un producto.");
      return;
    }
    setLoading(true);
    const nombre = clean(selectedProducto) === clean(DOC) ? DOC : MERC;
    const resultado: ProductoSeleccionado = {
      nombre_producto: nombre,
      esDocumento: nombre === DOC,
    };
    setTimeout(() => {
      setLoading(false);
      onNext(resultado);
    }, 200);
  };

  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-semibold">Tipo de Producto</h2>
      </div>

      {cargandoProductos ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : productos.length > 0 ? (
        <div className="space-y-3">
          <Select onValueChange={setSelectedProducto} value={selectedProducto}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Seleccionar producto" />
            </SelectTrigger>
            <SelectContent>
              {productos.map((p, i) => (
                <SelectItem key={i} value={p.nombre_producto} className="text-sm">
                  {p.nombre_producto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            disabled={!selectedProducto || loading}
            onClick={handleContinue}
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Continuar"
            )}
          </Button>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-2">No hay productos disponibles</p>
          <Button variant="outline" size="sm" onClick={fetchProductos}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
