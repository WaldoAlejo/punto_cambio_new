
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { Saldo } from "@/types";

interface BalanceCardProps {
  balance: Saldo;
}

export const BalanceCard = ({ balance }: BalanceCardProps) => {
  const getBalanceColor = (amount: number) => {
    if (amount < 1000) return "destructive";
    if (amount < 5000) return "outline";
    return "default";
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {balance.moneda?.nombre || 'Moneda desconocida'}
        </CardTitle>
        <Coins className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">
              {balance.moneda?.simbolo || '$'}{balance.cantidad.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {balance.billetes} billetes • {balance.monedas_fisicas} monedas
            </p>
          </div>
          <Badge variant={getBalanceColor(balance.cantidad)}>
            {balance.moneda?.codigo || 'UNK'}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Actualizado: {new Date(balance.updated_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};
