import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportItem {
  point: string;
  user?: string;
  exchanges?: number;
  amount?: number;
  transfers?: number;
  balance?: number;
}

interface ReportTableProps {
  data: ReportItem[];
  reportType: "exchanges" | "transfers" | "balances";
}

const colorMap: Record<ReportTableProps["reportType"], string> = {
  exchanges: "text-blue-600 font-semibold",
  transfers: "text-red-600 font-semibold",
  balances: "text-green-600 font-semibold",
};

const ReportTable = ({ data, reportType }: ReportTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={colorMap[reportType]}>
          Datos del Reporte
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay datos para mostrar. Configura los filtros y genera el
            reporte.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead>
                {reportType === "exchanges" && <TableHead>Usuario</TableHead>}
                {reportType === "exchanges" && (
                  <>
                    <TableHead>Cambios</TableHead>
                    <TableHead>Monto Total</TableHead>
                  </>
                )}
                {reportType === "transfers" && (
                  <>
                    <TableHead>Transferencias</TableHead>
                    <TableHead>Monto Total</TableHead>
                  </>
                )}
                {reportType === "balances" && <TableHead>Saldo</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.point}</TableCell>
                  {reportType === "exchanges" && (
                    <TableCell>{item.user || "-"}</TableCell>
                  )}
                  {reportType === "exchanges" && (
                    <>
                      <TableCell>{item.exchanges ?? 0}</TableCell>
                      <TableCell className={colorMap[reportType]}>
                        ${item.amount?.toLocaleString() ?? "0"}
                      </TableCell>
                    </>
                  )}
                  {reportType === "transfers" && (
                    <>
                      <TableCell>{item.transfers ?? 0}</TableCell>
                      <TableCell className={colorMap[reportType]}>
                        ${item.amount?.toLocaleString() ?? "0"}
                      </TableCell>
                    </>
                  )}
                  {reportType === "balances" && (
                    <TableCell className={colorMap[reportType]}>
                      ${item.balance?.toLocaleString() ?? "0"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportTable;
