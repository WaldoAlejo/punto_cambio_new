import { useState, useEffect } from "react";
import { Moneda, PuntoAtencion, CambioDivisa } from "../types";
import { currencyService } from "../services/currencyService";
import { exchangeService } from "../services/exchangeService";

export const useExchangeData = (selectedPoint: PuntoAtencion | null) => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        setIsLoadingCurrencies(true);
        const { currencies: fetchedCurrencies } =
          await currencyService.getAllCurrencies();
        const activeCurrencies = fetchedCurrencies.filter(
          (currency) => currency.activo
        );
        setCurrencies(activeCurrencies);
      } catch {
        console.error("Error loading currencies");
        setCurrencies([]);
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    const loadExchanges = async () => {
      try {
        if (selectedPoint) {
          const { exchanges } = await exchangeService.getExchangesByPoint(
            selectedPoint.id
          );
          setExchanges(exchanges);
        }
      } catch {
        console.error("Error loading exchanges");
        setExchanges([]);
      }
    };

    if (selectedPoint) {
      loadCurrencies();
      loadExchanges();
    }
  }, [selectedPoint]);

  const addExchange = (nuevo: CambioDivisa) => {
    setExchanges((prev) => [nuevo, ...prev]);
  };

  return {
    currencies,
    exchanges,
    addExchange,
    isLoadingCurrencies,
  };
};
