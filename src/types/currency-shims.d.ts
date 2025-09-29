// types/currency-shims.d.ts
declare module "currency-codes" {
  const api: {
    codes(): string[];
    code(code: string):
      | {
          code: string;
          currency: string;
          number: string;
          digits: number;
          countries: string[];
        }
      | undefined;
  };
  export = api;
}

declare module "currency-symbol-map" {
  function getSymbolFromCurrency(code: string): string | undefined;
  export = getSymbolFromCurrency;
}
