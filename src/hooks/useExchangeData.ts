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

    const loadExchanges = async (opts?: {
      date?: string;
      from?: string;
      to?: string;
    }) => {
      try {
        setError(null); // limpia error previo
        if (selectedPoint) {
          const { exchanges } = await exchangeService.getExchangesByPoint(
            selectedPoint.id,
            opts
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

  const removeExchange = (id: string) => {
    setExchanges((prev) => prev.filter((e) => e.id !== id));
  };

  return {
    currencies,
    exchanges,
    addExchange,
    removeExchange,
    isLoadingCurrencies,
    error, // NUEVO: para manejar errores en la UI
    // Permitir a consumidores recargar con rango de fechas
    reload: (opts?: { date?: string; from?: string; to?: string }) =>
      loadExchanges(opts),
  };
};
