import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

interface ReportItem {
  point: string;
  amount?: number;
  transfers?: number;
  balance?: number;
}

interface ReportChartProps {
  data: ReportItem[];
  reportType: "exchanges" | "transfers" | "balances";
}

const ReportChart = ({ data, reportType }: ReportChartProps) => {
  const chartData = data.map((item) => {
    let valor = 0;
    if (reportType === "exchanges") {
      valor = item.amount ?? 0;
    } else if (reportType === "transfers") {
      valor = item.transfers ?? 0;
    } else if (reportType === "balances") {
      valor = item.balance ?? 0;
    }

    return {
      name: item.point,
      valor,
    };
  });

  const isMonetary = reportType === "exchanges" || reportType === "balances";

  const labelMap: Record<typeof reportType, string> = {
    exchanges: "Monto Total ($)",
    transfers: "Cantidad de Transferencias",
    balances: "Saldo Total ($)",
  };

  const colorMap: Record<typeof reportType, string> = {
    exchanges: "#3b82f6",
    transfers: "#ef4444",
    balances: "#10b981",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            No hay datos para mostrar en el gráfico.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                tickFormatter={(value) =>
                  isMonetary ? `$${value.toLocaleString()}` : value
                }
              >
                <Label
                  value={labelMap[reportType]}
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: "middle" }}
                />
              </YAxis>
              <Tooltip
                formatter={(value: number) =>
                  isMonetary ? `$${value.toLocaleString()}` : value
                }
                labelFormatter={(label: string) => `Punto: ${label}`}
              />
              <Bar dataKey="valor" fill={colorMap[reportType]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportChart;
