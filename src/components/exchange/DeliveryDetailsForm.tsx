import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CambioDivisa, DetalleDivisasSimple } from "../../types";
import CurrencyDetailForm from "./CurrencyDetailForm";

interface DeliveryDetailsFormProps {
  exchange: CambioDivisa;
  onSubmit: (details: any) => void;
  onCancel: () => void;
  isCompletion?: boolean;
}

const EPSILON = 0.005; // tolerancia para comparación de decimales

const DeliveryDetailsForm = ({
  exchange,
  onSubmit,
  onCancel,
  isCompletion = false,
}: DeliveryDetailsFormProps) => {
  const [metodoEntrega, setMetodoEntrega] = useState<
    "efectivo" | "transferencia"
  >("efectivo");
  const [transferenciaNumero, setTransferenciaNumero] = useState("");
  const [transferenciaBanco, setTransferenciaBanco] = useState("");
  const [transferenciaImagen, setTransferenciaImagen] = useState<File | null>(
    null
  );

  const montoAEntregar =
    (exchange.saldo_pendiente ?? 0) > 0
      ? Number(exchange.saldo_pendiente)
      : Number(exchange.monto_destino);

  // Detalles de divisas a entregar
  const [divisasRecibidas, setDivisasRecibidas] =
    useState<DetalleDivisasSimple>({
      billetes: 0,
      monedas: 0,
      total: montoAEntregar,
    });

  // Si cambia el saldo pendiente / monto destino, sincroniza el total por defecto
  useEffect(() => {
    setDivisasRecibidas((prev) => ({
      billetes: metodoEntrega === "transferencia" ? 0 : prev.billetes,
      monedas: metodoEntrega === "transferencia" ? 0 : prev.monedas,
      total:
        metodoEntrega === "transferencia"
          ? montoAEntregar
          : prev.total || montoAEntregar,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchange.saldo_pendiente, exchange.monto_destino]);

  // Si cambia el método de entrega, ajusta el detalle sin perder datos innecesariamente
  useEffect(() => {
    setDivisasRecibidas((prev) =>
      metodoEntrega === "transferencia"
        ? { billetes: 0, monedas: 0, total: montoAEntregar }
        : { ...prev, total: prev.total || montoAEntregar }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodoEntrega]);

  const handleSubmit = () => {
    if (metodoEntrega === "transferencia") {
      if (!transferenciaNumero.trim()) {
        toast.error("Debe ingresar el número de transferencia");
        return;
      }
      if (!transferenciaBanco.trim()) {
        toast.error("Debe ingresar el banco de la transferencia");
        return;
      }
    }

    // Igualdad con tolerancia para evitar errores por flotantes
    if (Math.abs(divisasRecibidas.total - montoAEntregar) > EPSILON) {
      toast.error("El total de divisas debe coincidir con el monto a entregar");
      return;
    }

    const details = {
      metodoEntrega,
      transferenciaNumero:
        metodoEntrega === "transferencia" ? transferenciaNumero : null,
      transferenciaBanco:
        metodoEntrega === "transferencia" ? transferenciaBanco : null,
      transferenciaImagen:
        metodoEntrega === "transferencia" ? transferenciaImagen : null,
      divisasRecibidas,
    };

    onSubmit(details);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isCompletion
              ? "Detalles de Entrega - Completación"
              : "Detalles de Entrega"}
          </CardTitle>
          <div className="text-sm text-gray-600">
            Monto a entregar: {montoAEntregar.toLocaleString()}{" "}
            {exchange.monedaDestino?.codigo}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Método de entrega */}
          <div>
            <Label className="text-base font-medium">Método de entrega</Label>
            <RadioGroup
              value={metodoEntrega}
              onValueChange={(value) =>
                setMetodoEntrega(value as "efectivo" | "transferencia")
              }
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="efectivo" id="efectivo" />
                <Label htmlFor="efectivo">Efectivo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="transferencia" id="transferencia" />
                <Label htmlFor="transferencia">Transferencia bancaria</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Campos de transferencia */}
          {metodoEntrega === "transferencia" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-800">
                Datos de la transferencia
              </h3>

              <div>
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  value={transferenciaBanco}
                  onChange={(e) => setTransferenciaBanco(e.target.value)}
                  placeholder="Nombre del banco"
                />
              </div>

              <div>
                <Label htmlFor="numero">Número de transferencia</Label>
                <Input
                  id="numero"
                  value={transferenciaNumero}
                  onChange={(e) => setTransferenciaNumero(e.target.value)}
                  placeholder="Número de referencia"
                />
              </div>

              <div>
                <Label htmlFor="comprobante">Comprobante (opcional)</Label>
                <Input
                  id="comprobante"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setTransferenciaImagen(e.target.files?.[0] || null)
                  }
                />
              </div>
            </div>
          )}

          {/* Detalles de divisas solo para efectivo */}
          {metodoEntrega === "efectivo" && exchange.monedaDestino && (
            <div>
              <Label className="text-base font-medium">
                Detalles de divisas a entregar
              </Label>
              <div className="mt-2">
                <CurrencyDetailForm
                  currency={exchange.monedaDestino}
                  title={`Detalles de ${exchange.monedaDestino.codigo} a entregar`}
                  onDetailData={setDivisasRecibidas}
                  initialData={divisasRecibidas}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Continuar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryDetailsForm;
