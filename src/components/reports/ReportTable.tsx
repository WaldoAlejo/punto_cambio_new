
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportTableProps {
  data: any[];
  reportType: string;
}

const ReportTable = ({ data, reportType }: ReportTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del Reporte</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay datos para mostrar. Configura los filtros y genera el reporte.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Punto</TableHead>
                <TableHead>Usuario</TableHead>
                {reportType === 'exchanges' && (
                  <>
                    <TableHead>Cambios</TableHead>
                    <TableHead>Monto Total</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.point}</TableCell>
                  <TableCell>{item.user}</TableCell>
                  {reportType === 'exchanges' && (
                    <>
                      <TableCell>{item.exchanges}</TableCell>
                      <TableCell>${item.amount?.toLocaleString()}</TableCell>
                    </>
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
