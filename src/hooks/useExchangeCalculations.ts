import { useState, useEffect } from "react";

export const useExchangeCalculations = () => {
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState(0);

  useEffect(() => {
    // Limpieza para evitar que la UI muestre "NaN" en algún error de parseo
    const rateValue = parseFloat(rate.replace(",", ".")) || 0;
    const amountValue = parseFloat(amount.replace(",", ".")) || 0;
    if (rate && amount && rateValue > 0 && amountValue > 0) {
      setDestinationAmount(amountValue * rateValue);
    } else {
      setDestinationAmount(0);
    }
  }, [amount, rate]);

  // Útil si quieres saber cuándo ambos datos son válidos
  const isValid = () => {
    const rateValue = parseFloat(rate.replace(",", ".")) || 0;
    const amountValue = parseFloat(amount.replace(",", ".")) || 0;
    return rateValue > 0 && amountValue > 0;
  };

  return {
    rate,
    setRate,
    amount,
    setAmount,
    destinationAmount,
    isValid: isValid(),
  };
};
