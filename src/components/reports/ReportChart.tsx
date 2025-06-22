import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ReportItem {
  point: string;
  amount?: number;
  transfers?: number;
  balance?: number;
}

interface ReportChartProps {
  data: ReportItem[];
}

const ReportChart = ({ data }: ReportChartProps) => {
  const chartData = data.map((item) => ({
    name: item.point,
    valor: item.amount ?? item.transfers ?? item.balance ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="valor" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ReportChart;
