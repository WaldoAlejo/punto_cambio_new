
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Settings, Users, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { User } from '../../types';

interface TimeManagementProps {
  user: User;
}

interface ConfiguracionHorario {
  punto_atencion_id: string;
  hora_entrada_esperada: string;
  hora_salida_esperada: string;
  tiempo_almuerzo_minutos: number;
}

interface RegistroJornada {
  id: string;
  usuario_nombre: string;
  punto_atencion_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_almuerzo?: string;
  hora_regreso?: string;
  hora_salida?: string;
  total_horas: string;
  estado: string;
}

const TimeManagement = ({ user }: TimeManagementProps) => {
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionHorario[]>([]);
  const [registros, setRegistros] = useState<RegistroJornada[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date());
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<string>('todos');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>('todos');

  // Mock data para configuraciones
  const puntosAtencion = [
    { id: '1', nombre: 'Punto Centro' },
    { id: '2', nombre: 'Punto Norte' },
    { id: '3', nombre: 'Punto Sur' }
  ];

  const usuarios = [
    { id: '1', nombre: 'Juan Operador', punto: 'Punto Centro' },
    { id: '2', nombre: 'María Cajera', punto: 'Punto Norte' },
    { id: '3', nombre: 'Carlos Vendedor', punto: 'Punto Sur' }
  ];

  useEffect(() => {
    cargarConfiguraciones();
    cargarRegistros();
  }, [fechaSeleccionada, puntoSeleccionado, usuarioSeleccionado]);

  const cargarConfiguraciones = () => {
    // Mock data - configuraciones por defecto
    const configMock: ConfiguracionHorario[] = [
      {
        punto_atencion_id: '1',
        hora_entrada_esperada: '08:00',
        hora_salida_esperada: '17:00',
        tiempo_almuerzo_minutos: 60
      },
      {
        punto_atencion_id: '2',
        hora_entrada_esperada: '09:00',
        hora_salida_esperada: '18:00',
        tiempo_almuerzo_minutos: 60
      },
      {
        punto_atencion_id: '3',
        hora_entrada_esperada: '08:30',
        hora_salida_esperada: '17:30',
        tiempo_almuerzo_minutos: 60
      }
    ];
    setConfiguraciones(configMock);
  };

  const cargarRegistros = () => {
    // Mock data - registros de ejemplo
    const registrosMock: RegistroJornada[] = [
      {
        id: '1',
        usuario_nombre: 'Juan Operador',
        punto_atencion_nombre: 'Punto Centro',
        fecha: new Date().toISOString().split('T')[0],
        hora_inicio: '08:15',
        hora_almuerzo: '12:30',
        hora_regreso: '13:30',
        hora_salida: '17:10',
        total_horas: '8h 25m',
        estado: 'COMPLETADO'
      },
      {
        id: '2',
        usuario_nombre: 'María Cajera',
        punto_atencion_nombre: 'Punto Norte',
        fecha: new Date().toISOString().split('T')[0],
        hora_inicio: '09:05',
        hora_almuerzo: '13:00',
        hora_regreso: '14:00',
        hora_salida: '',
        total_horas: '5h 55m',
        estado: 'TRABAJANDO'
      }
    ];
    setRegistros(registrosMock);
  };

  const actualizarConfiguracion = (puntoId: string, campo: string, valor: string | number) => {
    setConfiguraciones(prev => 
      prev.map(config => 
        config.punto_atencion_id === puntoId 
          ? { ...config, [campo]: valor }
          : config
      )
    );
  };

  const guardarConfiguraciones = () => {
    // En producción esto se guardaría en la base de datos
    localStorage.setItem('configuraciones_horario', JSON.stringify(configuraciones));
    toast({
      title: "Configuraciones guardadas",
      description: "Los horarios han sido actualizados correctamente",
    });
  };

  const exportarReporte = () => {
    // Mock de exportación - en producción generaría un archivo Excel/PDF
    const datos = registros.map(registro => ({
      Usuario: registro.usuario_nombre,
      Punto: registro.punto_atencion_nombre,
      Fecha: registro.fecha,
      Entrada: registro.hora_inicio,
      Almuerzo: registro.hora_almuerzo || '-',
      Regreso: registro.hora_regreso || '-',
      Salida: registro.hora_salida || '-',
      'Total Horas': registro.total_horas
    }));

    console.log('Exportando reporte:', datos);
    toast({
      title: "Reporte exportado",
      description: "El reporte de horarios se ha generado correctamente",
    });
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'COMPLETADO':
        return <Badge variant="default" className="bg-green-500">Completado</Badge>;
      case 'TRABAJANDO':
        return <Badge variant="secondary">Trabajando</Badge>;
      case 'ALMUERZO':
        return <Badge variant="destructive">En almuerzo</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Horarios</h1>
          <p className="text-gray-600">Configuración y seguimiento de jornadas laborales</p>
        </div>
        <Button onClick={exportarReporte} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar Reporte
        </Button>
      </div>

      {/* Configuración de horarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Horarios por Punto
          </CardTitle>
          <CardDescription>
            Define los horarios esperados para cada punto de atención
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {configuraciones.map(config => {
              const punto = puntosAtencion.find(p => p.id === config.punto_atencion_id);
              return (
                <div key={config.punto_atencion_id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">{punto?.nombre}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Hora de Entrada</Label>
                      <Input
                        type="time"
                        value={config.hora_entrada_esperada}
                        onChange={(e) => actualizarConfiguracion(config.punto_atencion_id, 'hora_entrada_esperada', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Hora de Salida</Label>
                      <Input
                        type="time"
                        value={config.hora_salida_esperada}
                        onChange={(e) => actualizarConfiguracion(config.punto_atencion_id, 'hora_salida_esperada', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Tiempo de Almuerzo (minutos)</Label>
                      <Input
                        type="number"
                        value={config.tiempo_almuerzo_minutos}
                        onChange={(e) => actualizarConfiguracion(config.punto_atencion_id, 'tiempo_almuerzo_minutos', parseInt(e.target.value))}
                        min="30"
                        max="120"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <Button onClick={guardarConfiguraciones} className="w-full md:w-auto">
              Guardar Configuraciones
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros para registros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Registros de Jornadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaSeleccionada?.toLocaleDateString('es-ES') || "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={fechaSeleccionada}
                    onSelect={setFechaSeleccionada}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Punto de Atención</Label>
              <Select value={puntoSeleccionado} onValueChange={setPuntoSeleccionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los puntos</SelectItem>
                  {puntosAtencion.map(punto => (
                    <SelectItem key={punto.id} value={punto.id}>
                      {punto.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Usuario</Label>
              <Select value={usuarioSeleccionado} onValueChange={setUsuarioSeleccionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {usuarios.map(usuario => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabla de registros */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Almuerzo</TableHead>
                  <TableHead>Regreso</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Total Horas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registros.map(registro => (
                  <TableRow key={registro.id}>
                    <TableCell className="font-medium">{registro.usuario_nombre}</TableCell>
                    <TableCell>{registro.punto_atencion_nombre}</TableCell>
                    <TableCell className="font-mono">{registro.hora_inicio}</TableCell>
                    <TableCell className="font-mono">{registro.hora_almuerzo || '-'}</TableCell>
                    <TableCell className="font-mono">{registro.hora_regreso || '-'}</TableCell>
                    <TableCell className="font-mono">{registro.hora_salida || '-'}</TableCell>
                    <TableCell className="font-mono font-bold">{registro.total_horas}</TableCell>
                    <TableCell>{getEstadoBadge(registro.estado)}</TableCell>
                  </TableRow>
                ))}
                {registros.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      No hay registros para los filtros seleccionados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeManagement;
