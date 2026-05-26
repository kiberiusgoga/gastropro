export interface InvoiceLineItem {
  quantity: number;
  unit_price: number;
  vat_rate?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  vat_amount: number;
  total_amount: number;
}

export function computeInvoiceTotals(items: InvoiceLineItem[], vatRate: number): InvoiceTotals {
  const subtotal = Math.round(
    items.reduce((s, it) => s + it.quantity * it.unit_price, 0) * 100,
  ) / 100;
  const vat_amount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total_amount = Math.round((subtotal + vat_amount) * 100) / 100;
  return { subtotal, vat_amount, total_amount };
}

export function formatInvoiceNumber(year: number, sequential: number): string {
  return `NF-${year}-${sequential.toString().padStart(4, '0')}`;
}

export function computeDueDate(issueDateIso: string, paymentTermsDays: number): string {
  const d = new Date(issueDateIso);
  d.setDate(d.getDate() + paymentTermsDays);
  return d.toISOString().split('T')[0];
}

export function getDisplayStatus(
  status: string,
  dueDateIso: string,
  now = new Date(),
): string {
  if (status === 'pending' && new Date(dueDateIso) < now) return 'overdue';
  return status;
}

export function validateTin(tin: string): boolean {
  return /^\d{13}$/.test(tin);
}
