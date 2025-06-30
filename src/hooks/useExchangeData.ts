import { useState, useEffect } from "react";
import { Moneda, PuntoAtencion, CambioDivisa } from "../types";
import { currencyService } from "../services/currencyService";
import { exchangeService } from "../services/exchangeService";

export const useExchangeData = (selectedPoint: PuntoAtencion | null) => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [error, setError] = useState<string | null>(null); // NUEVO

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        setIsLoadingCurrencies(true);
        setError(null); // limpia error previo
        const { currencies: fetchedCurrencies } =
          await currencyService.getAllCurrencies();
        const activeCurrencies = fetchedCurrencies.filter(
          (currency) => currency.activo
        );
        setCurrencies(activeCurrencies);
      } catch (err) {
        console.error("Error loading currencies", err);
        setCurrencies([]);
        setError("Error al cargar monedas. Intente de nuevo más tarde.");
      } finally {
        setIsLoadingCurrencies(false);
      }
    };

    const loadExchanges = async () => {
      try {
        setError(null); // limpia error previo
        if (selectedPoint) {
          const { exchanges } = await exchangeService.getExchangesByPoint(
            selectedPoint.id
          );
          setExchanges(exchanges);
        }
      } catch (err) {
        console.error("Error loading exchanges", err);
        setExchanges([]);
        setError("Error al cargar el historial de cambios.");
      }
    };

    if (selectedPoint) {
      loadCurrencies();
      loadExchanges();
    } else {
      // Limpia datos si no hay punto seleccionado
      setCurrencies([]);
      setExchanges([]);
      setError(null);
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
    error, // NUEVO: para manejar errores en la UI
  };
};
