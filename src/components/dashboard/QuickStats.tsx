import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickStatsProps {
  totalBalance: number;
  totalTransfers: number;
  activeUsers: number;
  dailyGrowth: number;
}

export const QuickStats = ({
  totalBalance,
  totalTransfers,
  activeUsers,
  dailyGrowth,
}: QuickStatsProps) => {
  const stats = [
    {
      title: "Balance Total",
      value: `$${totalBalance.toLocaleString()}`,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Transferencias",
      value: totalTransfers.toString(),
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Usuarios Activos",
      value: activeUsers.toString(),
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Crecimiento Diario",
      value: `${dailyGrowth > 0 ? "+" : ""}${dailyGrowth.toFixed(1)}%`,
      color: dailyGrowth >= 0 ? "text-green-600" : "text-red-600",
      bg: dailyGrowth >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className={`${stat.bg} border-0 shadow-sm`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-lg font-semibold ${stat.color}`}>
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
