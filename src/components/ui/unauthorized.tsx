import { ShieldX, ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface UnauthorizedProps {
  message?: string;
  onGoBack?: () => void;
}

export const Unauthorized = ({
  message = "No tienes permisos para acceder a esta sección",
  onGoBack,
}: UnauthorizedProps) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-800">
            Acceso Denegado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">{message}</p>
          {onGoBack && (
            <Button onClick={onGoBack} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
