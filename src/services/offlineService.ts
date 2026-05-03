import Dexie, { Table as DexieTable } from 'dexie';
import { Order, Payment } from '../types';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface QueuedOrder {
  localId: string;
  isLocal: boolean;      // true = never reached server, needs full create+close
  order: Order;
  payments: Omit<Payment, 'id'>[];
  shiftId: string;
  queuedAt: string;
  attempts: number;
}

class OfflineDB extends Dexie {
  queue!: DexieTable<QueuedOrder, string>;

  constructor() {
    super('GastroProOfflineDB');
    this.version(1).stores({ queue: 'localId, queuedAt' });
  }
}

const db = new OfflineDB();

// ─── Service ──────────────────────────────────────────────────────────────────

export const offlineService = {
  enqueue: (
    order: Order,
    payments: Omit<Payment, 'id'>[],
    shiftId: string,
    isLocal: boolean,
  ): Promise<string> =>
    db.queue.put({
      localId: order.id,
      isLocal,
      order,
      payments,
      shiftId,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    }),

  getPending: (): Promise<QueuedOrder[]> => db.queue.toArray(),

  dequeue: (localId: string): Promise<void> => db.queue.delete(localId),

  pendingCount: (): Promise<number> => db.queue.count(),

  incrementAttempts: async (localId: string): Promise<void> => {
    const item = await db.queue.get(localId);
    if (item) await db.queue.put({ ...item, attempts: item.attempts + 1 });
  },
};
