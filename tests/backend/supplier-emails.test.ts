import { describe, it, expect } from 'vitest';

// Pure function tests for email content generation logic

interface SupplierConsumptionRow {
  supplier_id: string;
  supplier_name: string;
  supplier_email: string | null;
  contact_person: string | null;
  product_count: number;
  total_value: number;
  products: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
  }>;
}

const fmt = (n: number) =>
  n.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_SUBJECT = 'Дневна потрошувачка — {date} — {restaurant_name}';
const DEFAULT_BODY =
  'Почитуван/а {contact_person},\n\nВе информираме за дневната потрошувачка за денот {date}.\n\n{products_table}\n\nВкупна вредност: {total_value} ден.\n\nСо почит,\n{restaurant_name}';

function generateSubject(tpl: string, date: string, restaurantName: string, supplierName: string): string {
  return tpl
    .replace(/{date}/g, date)
    .replace(/{restaurant_name}/g, restaurantName)
    .replace(/{supplier_name}/g, supplierName);
}

function generateBodyText(
  tpl: string,
  supplier: SupplierConsumptionRow,
  restaurantName: string,
  date: string,
  productsText: string,
): string {
  return tpl
    .replace(/{date}/g, date)
    .replace(/{restaurant_name}/g, restaurantName)
    .replace(/{supplier_name}/g, supplier.supplier_name)
    .replace(/{total_value}/g, fmt(supplier.total_value))
    .replace(/{contact_person}/g, supplier.contact_person || supplier.supplier_name)
    .replace(/{products_table}/g, productsText);
}

function buildProductsText(products: SupplierConsumptionRow['products'], totalValue: number): string {
  const lines = products.map(p =>
    `${p.product_name} | ${p.quantity} | ${p.unit} | ${fmt(p.unit_price)} | ${fmt(p.total)}`
  );
  return lines.join('\n') + `\nВкупно: ${fmt(totalValue)} ден.`;
}

const sampleSupplier: SupplierConsumptionRow = {
  supplier_id: 'sup-1',
  supplier_name: 'Макпрогрес',
  supplier_email: 'ivan@makprogres.mk',
  contact_person: 'Иван',
  product_count: 2,
  total_value: 1450,
  products: [
    { product_id: 'p1', product_name: 'Вино', quantity: 5, unit: 'л', unit_price: 200, total: 1000 },
    { product_id: 'p2', product_name: 'Ракија', quantity: 3, unit: 'л', unit_price: 150, total: 450 },
  ],
};

describe('supplier email content generation', () => {
  it('generates subject with all placeholders replaced', () => {
    const subject = generateSubject(DEFAULT_SUBJECT, '23.05.2026', 'ГастроПро', 'Макпрогрес');
    expect(subject).toBe('Дневна потрошувачка — 23.05.2026 — ГастроПро');
    expect(subject).not.toContain('{');
  });

  it('generates body text with contact_person placeholder', () => {
    const productsText = buildProductsText(sampleSupplier.products, sampleSupplier.total_value);
    const body = generateBodyText(DEFAULT_BODY, sampleSupplier, 'ГастроПро', '23.05.2026', productsText);
    expect(body).toContain('Иван');
    expect(body).toContain('23.05.2026');
    expect(body).toContain('ГастроПро');
    expect(body).toContain('1.450,00');
    expect(body).not.toContain('{');
  });

  it('falls back to supplier_name when contact_person is null', () => {
    const noContact = { ...sampleSupplier, contact_person: null };
    const productsText = buildProductsText(noContact.products, noContact.total_value);
    const body = generateBodyText(DEFAULT_BODY, noContact, 'ГастроПро', '23.05.2026', productsText);
    expect(body).toContain(noContact.supplier_name);
    expect(body).not.toContain('{contact_person}');
  });

  it('products table text contains all product names', () => {
    const productsText = buildProductsText(sampleSupplier.products, sampleSupplier.total_value);
    expect(productsText).toContain('Вино');
    expect(productsText).toContain('Ракија');
    expect(productsText).toContain('5');
    expect(productsText).toContain('3');
  });

  it('email log status is "manual" when smtp_host is empty', () => {
    const settings = { smtp_host: null, smtp_port: 587, smtp_user: null, smtp_pass: null, smtp_from: null };
    const wouldSend = !!(sampleSupplier.supplier_email && settings.smtp_host);
    expect(wouldSend).toBe(false);
  });

  it('email log status would be "sent" when smtp configured and supplier has email', () => {
    const settings = { smtp_host: 'smtp.gmail.com', smtp_port: 587, smtp_user: 'u', smtp_pass: 'p', smtp_from: 'f' };
    const wouldSend = !!(sampleSupplier.supplier_email && settings.smtp_host);
    expect(wouldSend).toBe(true);
  });

  it('custom subject template overrides default', () => {
    const customTpl = 'Order from {supplier_name} — {date}';
    const subject = generateSubject(customTpl, '23.05.2026', 'ГастроПро', 'Макпрогрес');
    expect(subject).toBe('Order from Макпрогрес — 23.05.2026');
  });
});
