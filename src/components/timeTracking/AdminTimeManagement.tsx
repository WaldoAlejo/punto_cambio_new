import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, PuntoAtencion } from "../../types";
import ActivePointsReport from "../admin/ActivePointsReport";
import TimeReports from "./TimeReports";

interface AdminTimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const AdminTimeManagement = ({
  user,
  selectedPoint,
}: AdminTimeManagementProps) => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Gestión de Horarios
        </h1>
        <p className="text-gray-600">
          Panel administrativo para monitorear horarios y actividad de usuarios
        </p>
      </div>

      <Tabs defaultValue="active-users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active-users">Usuarios Activos</TabsTrigger>
          <TabsTrigger value="time-reports">Reportes de Horarios</TabsTrigger>
        </TabsList>

        <TabsContent value="active-users">
          <ActivePointsReport user={user} />
        </TabsContent>

        <TabsContent value="time-reports">
          {/* Cambiar user por _user para coincidir con props */}
          <TimeReports _user={user} selectedPoint={selectedPoint} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTimeManagement;
