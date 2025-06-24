
import { useState, useEffect } from 'react';

export const useExchangeCalculations = () => {
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState(0);

  useEffect(() => {
    if (rate && amount) {
      const rateValue = parseFloat(rate) || 0;
      const amountValue = parseFloat(amount) || 0;
      setDestinationAmount(amountValue * rateValue);
    } else {
      setDestinationAmount(0);
    }
  }, [amount, rate]);

  return {
    rate,
    setRate,
    amount,
    setAmount,
    destinationAmount
  };
};
