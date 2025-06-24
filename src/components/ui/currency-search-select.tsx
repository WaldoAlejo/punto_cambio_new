
import { useState, useRef, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search, Check } from "lucide-react";
import { Moneda } from '../../types';

interface CurrencySearchSelectProps {
  currencies: Moneda[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

const CurrencySearchSelect = ({ 
  currencies, 
  value, 
  onValueChange, 
  placeholder = "Seleccionar moneda",
  label = "Moneda",
  disabled = false
}: CurrencySearchSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCurrency = currencies.find(c => c.id === value);

  const filteredCurrencies = currencies.filter(currency =>
    currency.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && searchInputRef.current && !disabled) {
      searchInputRef.current.focus();
    }
  }, [isOpen, disabled]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredCurrencies.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCurrencies.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredCurrencies[highlightedIndex]) {
          onValueChange(filteredCurrencies[highlightedIndex].id);
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleCurrencySelect = (currency: Moneda) => {
    if (disabled) return;
    onValueChange(currency.id);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setSearchTerm(e.target.value);
    setHighlightedIndex(-1);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative" ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          className={`w-full justify-between h-10 px-3 py-2 text-left font-normal ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
        >
          <span className={selectedCurrency ? "text-foreground" : "text-muted-foreground"}>
            {selectedCurrency 
              ? `${selectedCurrency.codigo} - ${selectedCurrency.nombre}`
              : placeholder
            }
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </Button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar moneda..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Currency List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredCurrencies.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  No se encontraron monedas
                </div>
              ) : (
                filteredCurrencies.map((currency, index) => (
                  <button
                    key={currency.id}
                    type="button"
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors duration-150 border-none bg-transparent cursor-pointer flex items-center justify-between ${
                      index === highlightedIndex ? 'bg-blue-50' : ''
                    } ${
                      currency.id === value ? 'bg-blue-100 text-blue-700' : ''
                    }`}
                    onClick={() => handleCurrencySelect(currency)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{currency.codigo}</span>
                      <span className="text-gray-600 text-xs">{currency.nombre}</span>
                    </div>
                    {currency.id === value && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrencySearchSelect;
