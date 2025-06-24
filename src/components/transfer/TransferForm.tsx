import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  User,
  PuntoAtencion,
  Moneda,
  Transferencia,
  ResponsableMovilizacion,
} from "../../types";
import { ReceiptService } from "../../services/receiptService";
import { transferService } from "../../services/transferService";
import CurrencySearchSelect from "../ui/currency-search-select";

interface TransferFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies: Moneda[];
  points: PuntoAtencion[];
  onTransferCreated: (transfer: Transferencia) => void;
}

const TransferForm = ({
  user,
  selectedPoint,
  currencies,
  points,
  onTransferCreated,
}: TransferFormProps) => {
  const [formData, setFormData] = useState({
    type: "",
    toPointId: "",
    currencyId: "",
    amount: "",
    notes: "",
    billetes: "",
    monedas: "",
  });

  const [responsable, setResponsable] = useState<ResponsableMovilizacion>({
    nombre: "",
    documento: "",
    cedula: "",
    telefono: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('=== TRANSFER FORM SUBMIT ===');
    console.log("Iniciando proceso de creación de transferencia...");
    console.log("Datos del formulario:", {
      formData,
      responsable,
      selectedPoint,
      user,
    });

    // Validaciones mejoradas
    if (!formData.type) {
      toast({
        title: "Error",
        description: "Debe seleccionar el tipo de transferencia",
        variant: "destructive",
      });
      return;
    }

    if (!formData.currencyId) {
      toast({
        title: "Error",
        description: "Debe seleccionar la moneda",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser mayor a 0",
        variant: "destructive",
      });
      return;
    }

    // Validar punto de destino para tipos que lo requieren
    if (
      [
        "ENTRE_PUNTOS",
        "DEPOSITO_MATRIZ",
        "RETIRO_GERENCIA",
        "DEPOSITO_GERENCIA",
      ].includes(formData.type) &&
      !formData.toPointId
    ) {
      toast({
        title: "Error",
        description: "Debe seleccionar el punto de destino",
        variant: "destructive",
      });
      return;
    }

    // Validar responsable para transferencias entre puntos
    if (
      formData.type === "ENTRE_PUNTOS" &&
      (!responsable.nombre.trim() || !responsable.cedula.trim())
    ) {
      toast({
        title: "Error",
        description: "Debe completar los datos del responsable de movilización",
        variant: "destructive",
      });
      return;
    }

    // Validar detalle de divisas
    const billetes = parseFloat(formData.billetes) || 0;
    const monedas = parseFloat(formData.monedas) || 0;
    const total = billetes + monedas;
    const amount = parseFloat(formData.amount);

    if (Math.abs(total - amount) > 0.01) {
      toast({
        title: "Error",
        description:
          "El total de billetes y monedas debe coincidir con el monto total",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    console.log('🚀 Enviando transferencia al servidor...');

    try {
      let destinoId = "";
      let origenId: string | null = null;

      // Determinar origen y destino según tipo de transferencia
      switch (formData.type) {
        case "ENTRE_PUNTOS":
          origenId = selectedPoint?.id || null;
          destinoId = formData.toPointId;
          break;
        case "DEPOSITO_MATRIZ":
          origenId = null; // Matriz no tiene punto de origen específico
          destinoId = formData.toPointId;
          break;
        case "RETIRO_GERENCIA":
        case "DEPOSITO_GERENCIA":
          origenId = selectedPoint?.id || null;
          destinoId = formData.toPointId;
          break;
        default:
          console.error('Tipo de transferencia no válido:', formData.type);
          toast({
            title: "Error",
            description: "Tipo de transferencia no válido",
            variant: "destructive",
          });
          return;
      }

      const transferData = {
        origen_id: origenId,
        destino_id: destinoId,
        moneda_id: formData.currencyId,
        monto: amount,
        tipo_transferencia: formData.type as
          | "ENTRE_PUNTOS"
          | "DEPOSITO_MATRIZ"
          | "RETIRO_GERENCIA"
          | "DEPOSITO_GERENCIA",
        descripcion: formData.notes.trim() || null,
        detalle_divisas: { billetes, monedas, total },
        responsable_movilizacion:
          formData.type === "ENTRE_PUNTOS" ? {
            nombre: responsable.nombre.trim(),
            documento: responsable.documento.trim() || responsable.cedula.trim(),
            cedula: responsable.cedula.trim(),
            telefono: responsable.telefono.trim() || undefined,
          } : undefined,
      };

      console.log("📤 Datos finales enviados:", JSON.stringify(transferData, null, 2));

      const { transfer, error } = await transferService.createTransfer(transferData);

      if (error) {
        console.error("❌ Error del servicio:", error);
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }

      if (!transfer) {
        console.error("❌ No se recibió la transferencia creada");
        toast({
          title: "Error",
          description: "No se pudo crear la transferencia",
          variant: "destructive",
        });
        return;
      }

      console.log("✅ Transferencia procesada exitosamente:", transfer);
      
      // Notificar al componente padre
      onTransferCreated(transfer);

      // Generar recibo
      try {
        const numeroRecibo = ReceiptService.generateReceiptNumber("TRANSFERENCIA");
        const receiptData = ReceiptService.generateTransferReceipt(
          { ...transfer, numero_recibo: numeroRecibo },
          selectedPoint?.nombre || "Sistema",
          user.nombre
        );
        ReceiptService.printReceipt(receiptData, 2);
        console.log('📄 Recibo generado exitosamente');
      } catch (receiptError) {
        console.error('⚠️ Error generando recibo (no crítico):', receiptError);
      }

      // Limpiar formulario
      setFormData({
        type: "",
        toPointId: "",
        currencyId: "",
        amount: "",
        notes: "",
        billetes: "",
        monedas: "",
      });
      setResponsable({ nombre: "", documento: "", cedula: "", telefono: "" });

      toast({
        title: "✅ Transferencia creada",
        description: "La transferencia ha sido guardada exitosamente en la base de datos y está pendiente de aprobación",
      });

    } catch (error) {
      console.error("❌ Error inesperado en handleSubmit:", error);
      toast({
        title: "Error",
        description: "Error inesperado al procesar la transferencia",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailablePoints = () => {
    return points.filter((p) => p.id !== selectedPoint?.id);
  };

  const getDestinationLabel = () => {
    switch (formData.type) {
      case "ENTRE_PUNTOS":
        return "Punto de Destino";
      case "DEPOSITO_MATRIZ":
        return "Punto que Recibe el Depósito";
      case "RETIRO_GERENCIA":
        return "Punto de Destino del Retiro";
      case "DEPOSITO_GERENCIA":
        return "Punto de Destino del Depósito";
      default:
        return "Punto de Destino";
    }
  };

  const shouldShowDestinationSelect = () => {
    return [
      "ENTRE_PUNTOS",
      "DEPOSITO_MATRIZ",
      "RETIRO_GERENCIA",
      "DEPOSITO_GERENCIA",
    ].includes(formData.type);
  };

  const getTransferOptions = () => {
    if (user.rol === "OPERADOR" || user.rol === "CONCESION") {
      return [
        { value: "ENTRE_PUNTOS", label: "Transferencia entre Puntos" },
        { value: "DEPOSITO_MATRIZ", label: "Solicitar Depósito de Matriz" },
        { value: "RETIRO_GERENCIA", label: "Retiro de Gerencia" },
        { value: "DEPOSITO_GERENCIA", label: "Depósito de Gerencia" },
      ];
    }
    if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
      return [
        { value: "DEPOSITO_MATRIZ", label: "Depósito de Matriz" },
        { value: "ENTRE_PUNTOS", label: "Transferencia entre Puntos" },
        { value: "RETIRO_GERENCIA", label: "Retiro de Gerencia" },
        { value: "DEPOSITO_GERENCIA", label: "Depósito de Gerencia" },
      ];
    }
    return [];
  };

  const calculateTotal = () => {
    const billetes = parseFloat(formData.billetes) || 0;
    const monedas = parseFloat(formData.monedas) || 0;
    return billetes + monedas;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Transferencia</CardTitle>
        <CardDescription>
          {user.rol === "ADMIN" || user.rol === "SUPER_USUARIO"
            ? "Realizar una nueva transferencia"
            : "Solicitar una nueva transferencia"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Transferencia</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, type: value, toPointId: "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {getTransferOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {shouldShowDestinationSelect() && (
            <div className="space-y-2">
              <Label>{getDestinationLabel()}</Label>
              <Select
                value={formData.toPointId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, toPointId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailablePoints().map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <CurrencySearchSelect
            currencies={currencies}
            value={formData.currencyId}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, currencyId: value }))
            }
            placeholder="Seleccionar moneda"
            label="Moneda"
          />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Billetes</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.billetes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, billetes: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Monedas</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.monedas}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, monedas: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                {calculateTotal().toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Monto Total</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="0.00"
            />
          </div>

          {formData.type === "ENTRE_PUNTOS" && (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-gray-800">
                Responsable de Movilización
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={responsable.nombre}
                    onChange={(e) =>
                      setResponsable((prev) => ({
                        ...prev,
                        nombre: e.target.value,
                      }))
                    }
                    placeholder="Nombre del responsable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cédula</Label>
                  <Input
                    value={responsable.cedula}
                    onChange={(e) =>
                      setResponsable((prev) => ({
                        ...prev,
                        cedula: e.target.value,
                        documento: e.target.value,
                      }))
                    }
                    placeholder="Número de cédula"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={responsable.telefono}
                  onChange={(e) =>
                    setResponsable((prev) => ({
                      ...prev,
                      telefono: e.target.value,
                    }))
                  }
                  placeholder="Número de teléfono"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas (Opcional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Comentarios adicionales..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Procesando...
              </>
            ) : (
              <>
                {user.rol === "ADMIN" || user.rol === "SUPER_USUARIO"
                  ? "Realizar Transferencia"
                  : "Solicitar Transferencia"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransferForm;
