import { useState, useEffect } from "react";
import { Moneda } from "../types";
import { calcularMontoDetalladoDestino } from "../utils/currencyCalculations";

interface UseExchangeCalculationsProps {
  monedaOrigen?: Moneda;
  monedaDestino?: Moneda;
  tipoOperacion?: "COMPRA" | "VENTA";
}

export const useExchangeCalculations = ({
  monedaOrigen,
  monedaDestino,
  tipoOperacion = "COMPRA",
}: UseExchangeCalculationsProps = {}) => {
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState(0);

  // Estados para cálculos detallados
  const [rateBilletes, setRateBilletes] = useState("");
  const [rateMonedas, setRateMonedas] = useState("");
  const [amountBilletes, setAmountBilletes] = useState("");
  const [amountMonedas, setAmountMonedas] = useState("");
  const [calculosDetallados, setCalculosDetallados] = useState({
    billetes: { origen: 0, destino: 0, tasa: 0 },
    monedas: { origen: 0, destino: 0, tasa: 0 },
    totales: { origen: 0, destino: 0 },
  });

  // Cálculo simple (retrocompatibilidad)
  useEffect(() => {
    const rateValue = parseFloat(rate.replace(",", ".")) || 0;
    const amountValue = parseFloat(amount.replace(",", ".")) || 0;

    if (
      rate &&
      amount &&
      rateValue > 0 &&
      amountValue > 0 &&
      monedaOrigen &&
      monedaDestino
    ) {
      // Usar la nueva lógica de cálculo
      const comportamiento =
        tipoOperacion === "COMPRA"
          ? monedaOrigen.comportamiento_compra
          : monedaDestino.comportamiento_venta;

      if (comportamiento === "MULTIPLICA") {
        setDestinationAmount(amountValue * rateValue);
      } else {
        setDestinationAmount(amountValue / rateValue);
      }
    } else if (rate && amount && rateValue > 0 && amountValue > 0) {
      // Fallback al comportamiento anterior si no hay monedas definidas
      setDestinationAmount(amountValue * rateValue);
    } else {
      setDestinationAmount(0);
    }
  }, [amount, rate, monedaOrigen, monedaDestino, tipoOperacion]);

  // Cálculo detallado con billetes y monedas
  useEffect(() => {
    if (!monedaOrigen || !monedaDestino) {
      setCalculosDetallados({
        billetes: { origen: 0, destino: 0, tasa: 0 },
        monedas: { origen: 0, destino: 0, tasa: 0 },
        totales: { origen: 0, destino: 0 },
      });
      return;
    }

    const montoBilletes = parseFloat(amountBilletes.replace(",", ".")) || 0;
    const montoMonedas = parseFloat(amountMonedas.replace(",", ".")) || 0;
    const tasaBilletes = parseFloat(rateBilletes.replace(",", ".")) || 0;
    const tasaMonedas = parseFloat(rateMonedas.replace(",", ".")) || 0;

    if (
      (montoBilletes > 0 || montoMonedas > 0) &&
      (tasaBilletes > 0 || tasaMonedas > 0)
    ) {
      const calculos = calcularMontoDetalladoDestino(
        monedaOrigen,
        monedaDestino,
        tipoOperacion,
        montoBilletes,
        montoMonedas,
        tasaBilletes,
        tasaMonedas
      );
      setCalculosDetallados(calculos);
    } else {
      setCalculosDetallados({
        billetes: { origen: montoBilletes, destino: 0, tasa: tasaBilletes },
        monedas: { origen: montoMonedas, destino: 0, tasa: tasaMonedas },
        totales: { origen: montoBilletes + montoMonedas, destino: 0 },
      });
    }
  }, [
    amountBilletes,
    amountMonedas,
    rateBilletes,
    rateMonedas,
    monedaOrigen,
    monedaDestino,
    tipoOperacion,
  ]);

  // Útil si quieres saber cuándo ambos datos son válidos
  const isValid = () => {
    const rateValue = parseFloat(rate.replace(",", ".")) || 0;
    const amountValue = parseFloat(amount.replace(",", ".")) || 0;
    return rateValue > 0 && amountValue > 0;
  };

  const isValidDetallado = () => {
    const montoBilletes = parseFloat(amountBilletes.replace(",", ".")) || 0;
    const montoMonedas = parseFloat(amountMonedas.replace(",", ".")) || 0;
    const tasaBilletes = parseFloat(rateBilletes.replace(",", ".")) || 0;
    const tasaMonedas = parseFloat(rateMonedas.replace(",", ".")) || 0;

    return (
      (montoBilletes > 0 || montoMonedas > 0) &&
      (tasaBilletes > 0 || tasaMonedas > 0)
    );
  };

  return {
    // Cálculo simple (retrocompatibilidad)
    rate,
    setRate,
    amount,
    setAmount,
    destinationAmount,
    isValid: isValid(),

    // Cálculo detallado
    rateBilletes,
    setRateBilletes,
    rateMonedas,
    setRateMonedas,
    amountBilletes,
    setAmountBilletes,
    amountMonedas,
    setAmountMonedas,
    calculosDetallados,
    isValidDetallado: isValidDetallado(),
  };
};
