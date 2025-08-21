import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Por favor ingrese usuario y contraseña");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(username, password);

      if (result?.success) {
        toast.success("¡Bienvenido! Inicio de sesión exitoso");
      } else {
        toast.error(result?.error || "Usuario o contraseña incorrectos");
      }
    } catch {
      toast.error("No se pudo conectar al servidor. Intente de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold">
            Sistema de Cambio
          </CardTitle>
          <CardDescription className="text-sm">
            Ingrese sus credenciales para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="username" className="text-sm font-medium">
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
                className="h-10"
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="h-10"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 mt-4"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
