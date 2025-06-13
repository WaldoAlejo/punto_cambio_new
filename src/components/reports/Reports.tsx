
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, PuntoAtencion } from '../../types';

interface ReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const Reports = ({ user, selectedPoint }: ReportsProps) => {
  const [reportType, setReportType] = useState('exchanges');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);

  // Mock data
  const mockPoints: PuntoAtencion[] = [
    {
      id: '1',
      nombre: 'Punto Centro',
      direccion: 'Av. Principal 123',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-555-0001',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      saldos: []
    },
    {
      id: '2', 
      nombre: 'Punto Norte',
      direccion: 'CC El Recreo',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-555-0002',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      saldos: []
    }
  ];

  const mockUsers: User[] = [
    {
      id: '1',
      username: 'operador1',
      nombre: 'Juan Pérez',
      correo: 'juan@example.com',
      rol: 'OPERADOR',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      username: 'operador2', 
      nombre: 'María García',
      correo: 'maria@example.com',
      rol: 'OPERADOR',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const generateMockData = () => {
    if (reportType === 'exchanges') {
      return [
        { point: mockPoints[0].nombre, user: mockUsers[0].nombre, exchanges: 15, amount: 45000 },
        { point: mockPoints[1].nombre, user: mockUsers[1].nombre, exchanges: 12, amount: 38000 },
      ];
    }
    return [];
  };

  useEffect(() => {
    setReportData(generateMockData());
  }, [reportType]);

  const generateReport = () => {
    if (!dateFrom || !dateTo) {
      return;
    }
    setReportData(generateMockData());
  };

  const chartData = reportData.map(item => ({
    name: item.point,
    valor: item.amount || item.transfers || item.balance
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.nombre}` : 'Panel Administrativo'}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Reporte</CardTitle>
          <CardDescription>Configura los parámetros del reporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
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
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={generateReport} className="w-full">
                Generar Reporte
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
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

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del Reporte</CardTitle>
        </CardHeader>
        <CardContent>
          {reportData.length === 0 ? (
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
                {reportData.map((item, index) => (
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
    </div>
  );
};

export default Reports;
