
import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Moneda } from '../../types';

interface CurrencySearchSelectProps {
  currencies: Moneda[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

const CurrencySearchSelect = ({ 
  currencies, 
  value, 
  onValueChange, 
  placeholder = "Seleccionar moneda",
  label = "Moneda" 
}: CurrencySearchSelectProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCurrencies = currencies.filter(currency =>
    currency.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar moneda..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 mb-2"
        />
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {filteredCurrencies.length === 0 && searchTerm ? (
            <div className="p-2 text-sm text-gray-500">
              No se encontraron monedas
            </div>
          ) : (
            filteredCurrencies.map(currency => (
              <SelectItem key={currency.id} value={currency.id}>
                {currency.codigo} - {currency.nombre}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CurrencySearchSelect;
