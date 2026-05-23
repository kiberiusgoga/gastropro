import React from 'react';

type MarginTier = 'high' | 'medium' | 'low' | 'critical';

const TIER_COLORS: Record<MarginTier, string> = {
  high:     'bg-emerald-500/15 text-emerald-300',
  medium:   'bg-amber-500/15 text-amber-300',
  low:      'bg-orange-500/15 text-orange-300',
  critical: 'bg-rose-500/15 text-rose-300',
};

function getTier(percent: number): MarginTier {
  if (percent >= 60) return 'high';
  if (percent >= 30) return 'medium';
  if (percent >= 10) return 'low';
  return 'critical';
}

interface Props {
  percent: number | null | undefined;
  className?: string;
}

export function MarginBadge({ percent, className = '' }: Props) {
  if (percent === null || percent === undefined) {
    return <span className={`text-cream-faint ${className}`}>—</span>;
  }
  const num = Number(percent);
  if (isNaN(num)) return <span className={`text-cream-faint ${className}`}>—</span>;
  const tier = getTier(num);
  return (
    <span className={`${TIER_COLORS[tier]} px-2 py-0.5 rounded-md text-xs font-medium inline-block ${className}`}>
      {num.toFixed(1)}%
    </span>
  );
}
