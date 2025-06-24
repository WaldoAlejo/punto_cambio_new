
import { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";
import { Moneda, CambioDivisa } from '../types';
import { currencyService } from '../services/currencyService';

export const useExchangeData = () => {
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);

  useEffect(() => {
    const fetchCurrencies = async () => {
      setIsLoadingCurrencies(true);
      try {
        const { currencies: fetchedCurrencies, error } = await currencyService.getAllCurrencies();
        
        if (error) {
          toast({
            title: "Error",
            description: "No se pudieron cargar las monedas: " + error,
            variant: "destructive",
          });
          setCurrencies([]);
        } else {
          setCurrencies(fetchedCurrencies || []);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Error de conexión al cargar las monedas.",
          variant: "destructive",
        });
        setCurrencies([]);
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    fetchCurrencies();
  }, []);

  const addExchange = (exchange: CambioDivisa) => {
    setExchanges(prev => [exchange, ...prev]);
  };

  return {
    exchanges,
    currencies,
    isLoadingCurrencies,
    addExchange
  };
};
