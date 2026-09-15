type Currency = { moneda_id: string; codigo: string; nombre?: string; cantidad?: number };

export function openingCurrencyName(codigo: string, currencies: Currency[]): string {
  return currencies.find(currency => currency.codigo === codigo)?.nombre ||
    ({ USD: "Dólar estadounidense", EUR: "Euro" } as Record<string, string>)[codigo] || codigo;
}

export function openingCurrencyVisible(currency: Currency, pointCurrencies: string[] | null,
  required: string[], counted: string[], showOther: boolean): boolean {
  return showOther || pointCurrencies === null || pointCurrencies.includes(currency.moneda_id) ||
    required.includes(currency.codigo) || counted.includes(currency.moneda_id) || Number(currency.cantidad || 0) !== 0;
}
