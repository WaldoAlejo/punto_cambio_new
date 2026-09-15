import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCoinDenomination } from "@/utils/countDenominations";

interface Props {
  codigo: string;
  existing: number[];
  disabled?: boolean;
  onAdd: (denominacion: number) => void;
}

export function AddCoinDenomination({ codigo, existing, disabled, onAdd }: Props) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const amount = parseCoinDenomination(value);
    if (amount === null) {
      setError("Ingresa un valor entre 0,01 y 999999,99, con máximo dos decimales.");
      return;
    }
    if (existing.includes(amount)) {
      setError("Esta denominación ya aparece en el conteo. Ingresa su cantidad en la casilla existente.");
      return;
    }
    onAdd(amount);
    setValue("");
    setError("");
  };
  return <div className="mt-3 space-y-2">
    <Label htmlFor={id}>Agregar denominación de moneda ({codigo})</Label>
    <div className="flex flex-wrap gap-2">
      <Input id={id} className="w-44" inputMode="decimal" placeholder="Ej.: 0,25" value={value}
        disabled={disabled} aria-invalid={!!error} aria-describedby={`${id}-help`}
        onChange={e => { setValue(e.target.value); setError(""); }}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <Button type="button" variant="outline" disabled={disabled} onClick={add}>Agregar moneda</Button>
    </div>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">Valor de una pieza en {codigo}. Después ingresa cuántas tienes; se guardará con este conteo.</p>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
