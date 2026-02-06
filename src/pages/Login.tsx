import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, User, Lock, ShieldCheck } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState(""); // solo error global
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const usernameRef = useRef<HTMLInputElement>(null);

  // Validación en tiempo real
  const usernameError = !username.trim() ? "El usuario es obligatorio" : "";
  const passwordError = !password.trim()
    ? "La contraseña es obligatoria"
    : password.length < 6
    ? "La contraseña debe tener al menos 6 caracteres"
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameError || passwordError) {
      setGlobalError(""); // No mostrar error global si error local
      return;
    }

    setGlobalError("");
    setIsLoading(true);

    try {
      const result = await login(username, password);

      if (result.success) {
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido al sistema`,
        });
        navigate("/dashboard");
      } else {
        const errorMessage = result.error || "Error al iniciar sesión";
        setGlobalError(errorMessage);
        toast({
          title: "Error de autenticación",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch {
      setGlobalError("Error de conexión con el servidor");
      toast({
        title: "Error de conexión",
        description:
          "No se pudo conectar con el servidor. Verifique su conexión.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C21807]/90 via-[#FFD600]/70 to-[#0D47A1]/80 p-3 sm:p-4 md:p-6 transition-all duration-300">
      <div className="backdrop-blur-xl bg-white/70 rounded-3xl shadow-2xl ring-2 ring-[#C21807]/10 hover:ring-[#C21807]/30 transition-all w-full max-w-lg">
        <Card className="bg-transparent shadow-none border-none">
          <CardHeader className="space-y-3">
            {/* LOGO SI EXISTE, SINO ICON */}
            <div className="flex justify-center mb-2">
              {/* Cambia por <img src="/logo.svg" ... /> si tienes logo SVG */}
              <ShieldCheck className="w-12 h-12 text-[#C21807]" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl text-center font-bold text-[#C21807] tracking-tight drop-shadow">
              Casas de Cambios
            </CardTitle>
            <CardDescription className="text-center text-sm sm:text-base text-[#0D47A1]/80">
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Usuario */}
              <div>
                <Label
                  htmlFor="username"
                  className="text-[#0D47A1] font-semibold"
                >
                  Usuario
                </Label>
                <div className="relative mt-1">
                  <Input
                    ref={usernameRef}
                    id="username"
                    type="text"
                    autoFocus
                    placeholder="Ingresa tu usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className={`
                      rounded-xl pl-10 pr-3 py-2 shadow-inner border-2 focus:border-[#C21807] transition-all
                      ${usernameError ? "border-red-500" : "border-gray-200"}
                    `}
                    autoComplete="username"
                    aria-invalid={!!usernameError}
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                {usernameError && (
                  <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                )}
              </div>
              {/* Contraseña */}
              <div>
                <Label
                  htmlFor="password"
                  className="text-[#0D47A1] font-semibold"
                >
                  Contraseña
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className={`
                      rounded-xl pl-10 pr-10 py-2 shadow-inner border-2 focus:border-[#C21807] transition-all
                      ${passwordError ? "border-red-500" : "border-gray-200"}
                    `}
                    autoComplete="current-password"
                    aria-invalid={!!passwordError}
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    disabled={isLoading}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                )}
              </div>

              {/* Mensaje de error global */}
              {globalError && !usernameError && !passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{globalError}</AlertDescription>
                </Alert>
              )}

              {/* Botón login */}
              <Button
                type="submit"
                className={`
                  w-full py-3 text-base rounded-xl font-bold tracking-wide
                  bg-[#C21807] hover:bg-[#a71507] active:scale-95
                  transition-all duration-150
                  shadow-lg shadow-[#FFD600]/20
                  flex items-center justify-center
                `}
                disabled={
                  isLoading ||
                  !username.trim() ||
                  !password.trim() ||
                  !!usernameError ||
                  !!passwordError
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>

            {/* Credenciales de prueba */}
            <div className="mt-7 p-3 bg-[#FFD600]/20 rounded-lg shadow-inner">
              <div className="text-center text-xs text-[#0D47A1]">
                <p className="font-semibold mb-1">Credenciales de prueba:</p>
                <div className="flex flex-col items-center space-y-0.5">
                  <span>
                    <span className="font-medium">Usuario:</span> admin
                  </span>
                  <span>
                    <span className="font-medium">Contraseña:</span> admin123
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
