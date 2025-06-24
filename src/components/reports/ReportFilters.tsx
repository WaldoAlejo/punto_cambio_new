import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportFiltersProps {
  reportType: "exchanges" | "transfers" | "balances" | "users" | "summary";
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
  onGenerateReport,
}: ReportFiltersProps) => {
  const colorMap = useMemo(
    () => ({
      exchanges: "text-blue-600",
      transfers: "text-red-600",
      balances: "text-green-600",
      users: "text-indigo-600",
      summary: "text-yellow-600",
    }),
    []
  );

  const buttonColorMap = useMemo(
    () => ({
      exchanges: "bg-blue-600 hover:bg-blue-700 text-white",
      transfers: "bg-red-600 hover:bg-red-700 text-white",
      balances: "bg-green-600 hover:bg-green-700 text-white",
      users: "bg-indigo-600 hover:bg-indigo-700 text-white",
      summary: "bg-yellow-600 hover:bg-yellow-700 text-white",
    }),
    []
  );

  const titleText = useMemo(() => {
    switch (reportType) {
      case "exchanges":
        return "Filtros de Cambios";
      case "transfers":
        return "Filtros de Transferencias";
      case "balances":
        return "Filtros de Saldos";
      case "users":
        return "Filtros de Usuarios";
      case "summary":
        return "Filtros de Resumen";
      default:
        return "Filtros del Reporte";
    }
  }, [reportType]);

  return (
    <div className="space-y-4 border p-4 rounded-lg shadow-sm bg-white">
      <h2 className={`text-lg font-bold ${colorMap[reportType]}`}>
        {titleText}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <Label>Tipo de Reporte</Label>
          <Select value={reportType} onValueChange={onReportTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exchanges">Cambios</SelectItem>
              <SelectItem value="transfers">Transferencias</SelectItem>
              <SelectItem value="balances">Saldos</SelectItem>
              <SelectItem value="users">Usuarios</SelectItem>
              <SelectItem value="summary">Resumen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Desde</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>

        <div>
          <Label>Hasta</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>

      <div className="pt-4">
        <Button
          onClick={onGenerateReport}
          className={buttonColorMap[reportType]}
        >
          Generar Reporte
        </Button>
      </div>
    </div>
  );
};

export default ReportFilters;
