export interface VatBreakdown {
  gross: number;
  net: number;
  vat: number;
  vat_rate: number;
}

/**
 * Calculate VAT breakdown for a price.
 * @param price The price to break down
 * @param vatRate The VAT rate as decimal (0.10 = 10%)
 * @param priceIncludesVat If TRUE, price is gross. If FALSE, price is net.
 */
export function calculateVat(
  price: number,
  vatRate: number,
  priceIncludesVat: boolean,
): VatBreakdown {
  if (vatRate < 0 || vatRate > 1) {
    throw new Error(`Invalid VAT rate: ${vatRate}. Must be between 0 and 1.`);
  }

  let gross: number;
  let net: number;

  if (priceIncludesVat) {
    gross = price;
    net = price / (1 + vatRate);
  } else {
    net = price;
    gross = price * (1 + vatRate);
  }

  const vat = gross - net;

  return {
    gross: Math.round(gross * 100) / 100,
    net: Math.round(net * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    vat_rate: vatRate,
  };
}

/**
 * Aggregate VAT breakdowns by rate. Used for Z-report grouping.
 * Returns map of vat_rate -> { gross, net, vat, count } totals.
 */
export function aggregateVatByRate(
  items: Array<{ price: number; vat_rate: number; quantity: number }>,
  priceIncludesVat: boolean,
): Map<number, { gross: number; net: number; vat: number; count: number }> {
  const totals = new Map<number, { gross: number; net: number; vat: number; count: number }>();

  for (const item of items) {
    const lineTotal = item.price * item.quantity;
    const breakdown = calculateVat(lineTotal, item.vat_rate, priceIncludesVat);

    const existing = totals.get(item.vat_rate) ?? { gross: 0, net: 0, vat: 0, count: 0 };
    totals.set(item.vat_rate, {
      gross: Math.round((existing.gross + breakdown.gross) * 100) / 100,
      net: Math.round((existing.net + breakdown.net) * 100) / 100,
      vat: Math.round((existing.vat + breakdown.vat) * 100) / 100,
      count: existing.count + item.quantity,
    });
  }

  return totals;
}
