
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetalleDivisasSimple, Moneda } from '../../types';

interface CurrencyDetailFormProps {
  currency: Moneda;
  title: string;
  onDetailData: (data: DetalleDivisasSimple) => void;
  initialData?: DetalleDivisasSimple;
}

const CurrencyDetailForm = ({ currency, title, onDetailData, initialData }: CurrencyDetailFormProps) => {
  const [detail, setDetail] = useState<DetalleDivisasSimple>(
    initialData || {
      billetes: 0,
      monedas: 0,
      total: 0
    }
  );

  const calculateTotal = (billetes: number, monedas: number) => {
    return billetes + monedas;
  };

  const handleBilletesChange = (value: string) => {
    const billetes = parseFloat(value) || 0;
    const total = calculateTotal(billetes, detail.monedas);
    const newDetail = { billetes, monedas: detail.monedas, total };
    setDetail(newDetail);
    onDetailData(newDetail);
  };

  const handleMonedasChange = (value: string) => {
    const monedas = parseFloat(value) || 0;
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
                value={detail.billetes || ''}
                onChange={(e) => handleBilletesChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Monedas</Label>
              <Input
                type="number"
                step="0.01"
                value={detail.monedas || ''}
                onChange={(e) => handleMonedasChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                {detail.total.toFixed(2)} {currency.simbolo}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyDetailForm;
