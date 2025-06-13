
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportFiltersProps {
  reportType: string;
  dateFrom: string;
  dateTo: string;
  onReportTypeChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onGenerateReport: () => void;
}

const ReportFilters = ({
  reportType,
  dateFrom,
  dateTo,
  onReportTypeChange,
  onDateFromChange,
  onDateToChange,
  onGenerateReport
}: ReportFiltersProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros de Reporte</CardTitle>
        <CardDescription>Configura los parámetros del reporte</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Reporte</Label>
            <Select value={reportType} onValueChange={onReportTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exchanges">Cambios de Divisa</SelectItem>
                <SelectItem value="transfers">Transferencias</SelectItem>
                <SelectItem value="balances">Saldos</SelectItem>
                <SelectItem value="users">Actividad de Usuarios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha Desde</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha Hasta</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={onGenerateReport} className="w-full">
              Generar Reporte
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportFilters;
