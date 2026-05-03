import apiClient from '../lib/apiClient';
import { Printer, Order, OrderItem } from '../types';

// ─── Receipt CSS (80mm thermal roll) ─────────────────────────────────────────

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    background: #fff;
    width: 80mm;
    padding: 3mm 4mm;
  }
  .c  { text-align: center; }
  .r  { text-align: right; }
  .b  { font-weight: bold; }
  .lg { font-size: 16px; }
  .xl { font-size: 20px; font-weight: 900; }
  .sep { border-top: 1px dashed #000; margin: 5px 0; }
  .sep2 { border-top: 2px solid #000; margin: 5px 0; }
  .row { display: flex; }
  .row .nm  { flex: 1; min-width: 0; overflow: hidden; }
  .row .qty { width: 24px; text-align: right; flex-shrink: 0; }
  .row .pr  { width: 56px; text-align: right; flex-shrink: 0; }
  @media print {
    body { margin: 0; }
    @page { margin: 0; size: 80mm auto; }
  }
`;

// ─── HTML builders ────────────────────────────────────────────────────────────

function e(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDen(n: number): string {
  return n.toLocaleString('mk-MK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildReceiptHtml(order: Order): string {
  const total   = order.totalAmount;
  const tax     = total * 0.18;
  const base    = total - tax;
  const dateStr = new Date(order.createdAt).toLocaleString('mk-MK', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const rows = order.items.map(i => `
    <div class="row">
      <span class="nm">${e(i.name)}</span>
      <span class="qty">${i.quantity}x</span>
      <span class="pr">${fmtDen(i.price * i.quantity)}</span>
    </div>
  `).join('');

  const discountRow = order.discountAmount
    ? `<div class="row"><span class="nm">Попуст (${e(order.discountName ?? '')})</span><span class="pr">-${fmtDen(order.discountAmount)}</span></div>`
    : '';

  return `
    <div class="c b lg">GASTRO PRO</div>
    <div class="c" style="font-size:10px">ДДВ Број: MK4030000000000</div>
    <div class="sep"></div>
    <div class="row"><span class="nm">${dateStr}</span><span class="r">#${order.id.slice(-6).toUpperCase()}</span></div>
    <div>${order.tableId ? `Маса: ${e(order.tableId)}` : (order.orderType === 'takeaway' ? 'За носење' : 'Достава')}</div>
    <div class="sep"></div>
    <div class="row b" style="font-size:10px">
      <span class="nm">АРТИКАЛ</span><span class="qty">КОЛ</span><span class="pr">ЦЕНА</span>
    </div>
    <div class="sep"></div>
    ${rows}
    ${discountRow}
    <div class="sep2"></div>
    <div class="row b xl"><span class="nm">ВКУПНО:</span><span class="pr">${fmtDen(total)}</span></div>
    <div class="row" style="font-size:10px; margin-top:4px">
      <span class="nm">Основица (82%):</span><span class="pr">${fmtDen(base)}</span>
    </div>
    <div class="row" style="font-size:10px">
      <span class="nm">ДДВ 18%:</span><span class="pr">${fmtDen(tax)}</span>
    </div>
    <br>
    <div class="c b">БЛАГОДАРИМЕ НА ПОСЕТАТА!</div>
    <div class="c" style="font-size:10px; margin-top:4px">━━━━━━━━━━━━━━━━━━━━━━</div>
    <div class="c" style="font-size:10px">ФИСКАЛНА СМЕТКА</div>
    <br><br>
  `;
}

function buildKitchenHtml(
  order: Order,
  items: OrderItem[],
  station: string,
  tableLabel: string,
): string {
  const timeStr = new Date().toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' });

  const rows = items.map(i => `
    <div style="margin: 8px 0">
      <div class="row">
        <span class="xl" style="min-width:32px">${i.quantity}x</span>
        <span class="b lg" style="margin-left:6px; flex:1">${e(i.name)}</span>
      </div>
      ${i.note ? `<div style="font-size:11px; font-style:italic; padding-left:38px; margin-top:2px">! ${e(i.note)}</div>` : ''}
    </div>
  `).join('');

  return `
    <div class="c xl">${e(tableLabel)}</div>
    <div class="c b lg">${e(station.toUpperCase())}</div>
    <div class="c" style="font-size:10px">#${order.id.slice(-4).toUpperCase()} · ${timeStr}</div>
    <div class="sep2" style="margin-top:8px"></div>
    ${rows}
    <div class="sep"></div>
    <br>
  `;
}

// ─── Window.open print ────────────────────────────────────────────────────────

function openPrintWindow(bodyHtml: string, title: string): void {
  const win = window.open('', '_blank', 'width=380,height=650');
  if (!win) {
    console.error('[Print] Popup blocked — allow popups for this site');
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>${BASE_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 350);
}

// ─── ESC/POS via backend TCP ──────────────────────────────────────────────────

async function sendToNetworkPrinter(
  printer: Printer,
  type: string,
  content: Record<string, unknown>,
): Promise<boolean> {
  try {
    await apiClient.post('/print-jobs', { printer_id: printer.id, type, content });
    return true;
  } catch (err) {
    console.error('[Print] Network printer failed, falling back to browser', err);
    return false;
  }
}

// ─── Printer mapper ───────────────────────────────────────────────────────────

function mapPrinter(r: any): Printer {
  return {
    id: r.id,
    restaurantId: r.restaurant_id,
    name: r.name,
    type: r.type,
    connectionType: r.connection_type,
    ipAddress: r.ip_address,
    port: r.port,
    active: r.active,
    station: r.station,
  };
}

// ─── PrintService ─────────────────────────────────────────────────────────────

class PrintService {
  async getPrinters(restaurantId?: string): Promise<Printer[]> {
    try {
      const res = await apiClient.get('/printers');
      return res.data.map(mapPrinter);
    } catch {
      return [];
    }
  }

  async printKitchenTickets(order: Order): Promise<void> {
    const printers = await this.getPrinters(order.restaurantId);
    const active   = printers.filter(p => p.active && (p.type === 'kitchen' || p.type === 'bar'));

    // Group items by preparation station
    const byStation: Record<string, OrderItem[]> = {};
    for (const item of order.items) {
      const s = item.preparationStation ?? 'kitchen';
      (byStation[s] ??= []).push(item);
    }

    const tableLabel =
      order.orderType === 'dine_in'  ? `МАСА ${order.tableId ?? '?'}` :
      order.orderType === 'takeaway' ? 'ЗА НОСЕЊЕ' : 'ДОСТАВА';

    if (order.items.length === 0) return;

    if (Object.keys(byStation).length === 0) {
      openPrintWindow(buildKitchenHtml(order, order.items, 'кујна', tableLabel), 'Кујнски бон');
      return;
    }

    for (const [station, items] of Object.entries(byStation)) {
      const printer =
        active.find(p => p.station === station) ??
        active.find(p => p.type === 'kitchen');

      if (printer?.connectionType === 'network') {
        const ok = await sendToNetworkPrinter(printer, 'kitchen_ticket', {
          order, items, station, tableLabel,
        });
        if (!ok) openPrintWindow(buildKitchenHtml(order, items, station, tableLabel), 'Кујнски бон');
      } else {
        openPrintWindow(buildKitchenHtml(order, items, station, tableLabel), 'Кујнски бон');
      }
    }
  }

  async printCustomerReceipt(order: Order): Promise<void> {
    const printers = await this.getPrinters(order.restaurantId);
    const printer  = printers.find(p => p.active && p.type === 'receipt');

    if (printer?.connectionType === 'network') {
      const ok = await sendToNetworkPrinter(printer, 'customer_receipt', { order });
      if (!ok) openPrintWindow(buildReceiptHtml(order), 'Сметка');
    } else {
      openPrintWindow(buildReceiptHtml(order), 'Сметка');
    }
  }
}

export const printService = new PrintService();
