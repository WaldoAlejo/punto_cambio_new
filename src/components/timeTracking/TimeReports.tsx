
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Download, Filter } from "lucide-react";
import { User, PuntoAtencion } from '../../types';

interface TimeReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface TimeRecord {
  id: string;
  usuario: string;
  punto: string;
  fecha: string;
  hora_entrada: string;
  hora_salida?: string;
  horas_trabajadas?: number;
  salidas_espontaneas: number;
}

const TimeReports = ({ user, selectedPoint }: TimeReportsProps) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPoint2, setSelectedPoint2] = useState('');
  const [records, setRecords] = useState<TimeRecord[]>([]);

  // Mock data
  const mockRecords: TimeRecord[] = [
    {
      id: '1',
      usuario: 'Juan Pérez',
      punto: 'Punto Centro',
      fecha: '2024-06-14',
      hora_entrada: '08:15',
      hora_salida: '17:30',
      horas_trabajadas: 9.25,
      salidas_espontaneas: 2
    },
    {
      id: '2',
      usuario: 'María González',
      punto: 'Punto Norte',
      fecha: '2024-06-14',
      hora_entrada: '09:00',
      horas_trabajadas: 0,
      salidas_espontaneas: 1
    },
    {
      id: '3',
      usuario: 'Carlos López',
      punto: 'Punto Sur',
      fecha: '2024-06-13',
      hora_entrada: '08:00',
      hora_salida: '18:00',
      horas_trabajadas: 10,
      salidas_espontaneas: 0
    }
  ];

  const mockUsers = [
    { id: '1', nombre: 'Juan Pérez' },
    { id: '2', nombre: 'María González' },
    { id: '3', nombre: 'Carlos López' }
  ];

  const mockPoints = [
    { id: '1', nombre: 'Punto Centro' },
    { id: '2', nombre: 'Punto Norte' },
    { id: '3', nombre: 'Punto Sur' }
  ];

  useEffect(() => {
    setRecords(mockRecords);
  }, []);

  const handleFilter = () => {
    let filteredRecords = mockRecords;

    if (dateFrom) {
      filteredRecords = filteredRecords.filter(record => record.fecha >= dateFrom);
    }

    if (dateTo) {
      filteredRecords = filteredRecords.filter(record => record.fecha <= dateTo);
    }

    if (selectedUser) {
      filteredRecords = filteredRecords.filter(record => record.usuario === selectedUser);
    }

    if (selectedPoint2) {
      filteredRecords = filteredRecords.filter(record => record.punto === selectedPoint2);
    }

    setRecords(filteredRecords);
  };

  const exportToExcel = () => {
    console.log('Exportando reportes de horarios a Excel:', records);
    // Aquí se implementaría la exportación real
  };

  const getTotalHours = () => {
    return records.reduce((total, record) => total + (record.horas_trabajadas || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Reporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

            <div className="space-y-2">
              <Label>Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los usuarios</SelectItem>
                  {mockUsers.map(user => (
                    <SelectItem key={user.id} value={user.nombre}>
                      {user.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Punto de Atención</Label>
              <Select value={selectedPoint2} onValueChange={setSelectedPoint2}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los puntos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los puntos</SelectItem>
                  {mockPoints.map(point => (
                    <SelectItem key={point.id} value={point.nombre}>
                      {point.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleFilter} className="w-full">
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{records.length}</div>
            <p className="text-sm text-gray-600">Registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{getTotalHours().toFixed(1)}</div>
            <p className="text-sm text-gray-600">Horas Trabajadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {records.filter(r => !r.hora_salida).length}
            </div>
            <p className="text-sm text-gray-600">Usuarios Activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {records.reduce((total, record) => total + record.salidas_espontaneas, 0)}
            </div>
            <p className="text-sm text-gray-600">Salidas Espontáneas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de reportes */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Reporte de Horarios
            </CardTitle>
            <Button onClick={exportToExcel} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Salidas Esp.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.usuario}</TableCell>
                    <TableCell>{record.punto}</TableCell>
                    <TableCell>{new Date(record.fecha).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">{record.hora_entrada}</TableCell>
                    <TableCell className="font-mono">
                      {record.hora_salida || (
                        <span className="text-green-600 font-semibold">Trabajando</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.horas_trabajadas ? `${record.horas_trabajadas.toFixed(1)}h` : '--'}
                    </TableCell>
                    <TableCell className="text-center">{record.salidas_espontaneas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {records.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay registros para mostrar. Ajusta los filtros y vuelve a intentar.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeReports;
