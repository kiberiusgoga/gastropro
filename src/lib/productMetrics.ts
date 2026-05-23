export type MarginTier = 'high' | 'medium' | 'low' | 'critical';

export function computeMarginPercent(sellingPrice: number, purchasePrice: number): number | null {
  if (sellingPrice <= 0) return null;
  return Math.round(((sellingPrice - purchasePrice) / sellingPrice) * 100 * 10) / 10;
}

export function getProductType(sellingPrice: number): 'sellable' | 'ingredient' {
  return sellingPrice > 0 ? 'sellable' : 'ingredient';
}

export function getMarginTier(percent: number | null): MarginTier | null {
  if (percent === null || percent === undefined) return null;
  if (percent >= 60) return 'high';
  if (percent >= 30) return 'medium';
  if (percent >= 10) return 'low';
  return 'critical';
}
