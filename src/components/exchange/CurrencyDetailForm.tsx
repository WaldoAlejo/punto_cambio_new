import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DetalleDivisasSimple, Moneda } from "../../types";

interface CurrencyDetailFormProps {
  currency: Moneda;
  title: string;
  onDetailData: (data: DetalleDivisasSimple) => void;
  initialData?: DetalleDivisasSimple;
}

const emptyDetail: DetalleDivisasSimple = { billetes: 0, monedas: 0, total: 0 };

// Redondea a 2 decimales para evitar flotantes raros
const round2 = (n: number) => Math.round((isNaN(n) ? 0 : n) * 100) / 100;

// Acepta coma o punto y hace clamp a [0, ∞)
const parseMoney = (value: string) => {
  const num = parseFloat((value || "").replace(",", "."));
  return num > 0 ? num : 0;
};

const calcTotal = (billetes: number, monedas: number) =>
  round2((billetes || 0) + (monedas || 0));

const CurrencyDetailForm = ({
  currency,
  title,
  onDetailData,
  initialData,
}: CurrencyDetailFormProps) => {
  const [detail, setDetail] = useState<DetalleDivisasSimple>({
    ...emptyDetail,
    ...initialData,
  });

  // Sincroniza con initialData si cambia
  useEffect(() => {
    const merged = { ...emptyDetail, ...initialData };
    merged.billetes = round2(merged.billetes || 0);
    merged.monedas = round2(merged.monedas || 0);
    merged.total = calcTotal(merged.billetes, merged.monedas);
    setDetail(merged);
    onDetailData(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.billetes, initialData?.monedas]);

  const handleBilletesChange = (value: string) => {
    const billetes = round2(parseMoney(value));
    const total = calcTotal(billetes, detail.monedas);
    const newDetail = { billetes, monedas: detail.monedas, total };
    setDetail(newDetail);
    onDetailData(newDetail);
  };

  const handleMonedasChange = (value: string) => {
    const monedas = round2(parseMoney(value));
    const total = calcTotal(detail.billetes, monedas);
    const newDetail = { billetes: detail.billetes, monedas, total };
    setDetail(newDetail);
    onDetailData(newDetail);
  };

  const simbolo = currency?.simbolo || currency?.codigo || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Detalle de {currency?.codigo} - {currency?.nombre}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>💴 Billetes</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={detail.billetes === 0 ? "" : detail.billetes.toString()}
                onChange={(e) => handleBilletesChange(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>🪙 Monedas</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={detail.monedas === 0 ? "" : detail.monedas.toString()}
                onChange={(e) => handleMonedasChange(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>💰 Total</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                {isNaN(detail.total) ? "0.00" : detail.total.toFixed(2)}{" "}
                {simbolo}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyDetailForm;
