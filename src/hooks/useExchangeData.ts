
import { useState, useEffect } from 'react';
import { Moneda, PuntoAtencion } from '../types';
import { currencyService } from '../services/currencyService';

export const useExchangeData = (selectedPoint: PuntoAtencion | null) => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        setIsLoading(true);
        const { currencies: fetchedCurrencies } = await currencyService.getAllCurrencies();
        
        // Filter only active currencies
        const activeCurrencies = fetchedCurrencies.filter(currency => currency.activo);
        setCurrencies(activeCurrencies);
        
      } catch (_error) {
        console.error('Error loading currencies');
        setCurrencies([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedPoint) {
      loadCurrencies();
    }
  }, [selectedPoint]);

  return {
    currencies,
    isLoading
  };
};
