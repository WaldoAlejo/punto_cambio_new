import { useEffect, useMemo, useState } from "react";
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
  return Number.isFinite(num) && num > 0 ? num : 0;
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

  // Simbolo/código memorizado
  const simbolo = useMemo(
    () => currency?.simbolo || currency?.codigo || "",
    [currency?.simbolo, currency?.codigo]
  );

  // Sincroniza con initialData si cambia (y recalcula total de forma determinista)
  useEffect(() => {
    const merged: DetalleDivisasSimple = {
      ...emptyDetail,
      ...(initialData || {}),
    };
    const billetes = round2(merged.billetes || 0);
    const monedas = round2(merged.monedas || 0);
    const total = calcTotal(billetes, monedas);
    const next = { billetes, monedas, total };
    setDetail(next);
    onDetailData(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.billetes, initialData?.monedas]);

  // Si cambia la moneda y no hay initialData explícita, reinicia a vacío
  useEffect(() => {
    if (!initialData) {
      setDetail(emptyDetail);
      onDetailData(emptyDetail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency?.id]);

  const updateAndEmit = (partial: Partial<DetalleDivisasSimple>) => {
    const next: DetalleDivisasSimple = {
      ...detail,
      ...partial,
    };
    next.total = calcTotal(next.billetes, next.monedas);
    setDetail(next);
    onDetailData(next);
  };

  const handleBilletesChange = (value: string) => {
    const billetes = round2(parseMoney(value));
    updateAndEmit({ billetes });
  };

  const handleMonedasChange = (value: string) => {
    const monedas = round2(parseMoney(value));
    updateAndEmit({ monedas });
  };

  // Para que el input muestre vacío cuando sea 0 (mejor UX al limpiar)
  const fmtInput = (n: number) => (n === 0 ? "" : n.toString());

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billetes">💴 Billetes</Label>
              <Input
                id="billetes"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={fmtInput(detail.billetes)}
                onChange={(e) => handleBilletesChange(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monedas">🪙 Monedas</Label>
              <Input
                id="monedas"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={fmtInput(detail.monedas)}
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
