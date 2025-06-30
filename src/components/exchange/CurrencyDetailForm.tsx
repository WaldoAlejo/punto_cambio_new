import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetalleDivisasSimple, Moneda } from "../../types";

interface CurrencyDetailFormProps {
  currency: Moneda;
  title: string;
  onDetailData: (data: DetalleDivisasSimple) => void;
  initialData?: DetalleDivisasSimple;
}

const emptyDetail: DetalleDivisasSimple = { billetes: 0, monedas: 0, total: 0 };

const CurrencyDetailForm = ({
  currency,
  title,
  onDetailData,
  initialData,
}: CurrencyDetailFormProps) => {
  // Blindaje: siempre todos los campos definidos
  const [detail, setDetail] = useState<DetalleDivisasSimple>({
    ...emptyDetail,
    ...initialData,
  });

  const calculateTotal = (billetes: number, monedas: number) => {
    const total = (billetes || 0) + (monedas || 0);
    // Evita devolver NaN
    return isNaN(total) ? 0 : total;
  };

  const handleBilletesChange = (value: string) => {
    const billetes = parseFloat(value.replace(",", ".")) || 0;
    const total = calculateTotal(billetes, detail.monedas);
    const newDetail = { billetes, monedas: detail.monedas, total };
    setDetail(newDetail);
    onDetailData(newDetail);
  };

  const handleMonedasChange = (value: string) => {
    const monedas = parseFloat(value.replace(",", ".")) || 0;
    const total = calculateTotal(detail.billetes, monedas);
    const newDetail = { billetes: detail.billetes, monedas, total };
    setDetail(newDetail);
    onDetailData(newDetail);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Detalle de {currency.codigo} - {currency.nombre}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Billetes</Label>
              <Input
                type="number"
                step="0.01"
                value={detail.billetes === 0 ? "" : detail.billetes}
                onChange={(e) => handleBilletesChange(e.target.value)}
                placeholder="0.00"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Monedas</Label>
              <Input
                type="number"
                step="0.01"
                value={detail.monedas === 0 ? "" : detail.monedas}
                onChange={(e) => handleMonedasChange(e.target.value)}
                placeholder="0.00"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                {isNaN(detail.total) ? "0.00" : detail.total.toFixed(2)}{" "}
                {currency.simbolo}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyDetailForm;
