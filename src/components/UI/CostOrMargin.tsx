import React from 'react';
import { MarginBadge } from './MarginBadge';

interface Props {
  purchaseCost: number;
  marginPercent: number | null | undefined;
  productType: 'sellable' | 'ingredient' | undefined;
}

export function CostOrMargin({ purchaseCost, marginPercent, productType }: Props) {
  if (productType === 'sellable') {
    return <MarginBadge percent={marginPercent} />;
  }
  const cost = Number(purchaseCost);
  return (
    <span className="text-cream-muted text-sm tabular-nums">
      {isNaN(cost) ? '—' : cost.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ден.
    </span>
  );
}
