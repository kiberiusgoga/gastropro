import type { Response } from 'express';

// Per-restaurant set of open SSE response streams
const clients = new Map<string, Set<Response>>();

export const sseAdd = (restaurantId: string, res: Response) => {
  if (!clients.has(restaurantId)) clients.set(restaurantId, new Set());
  clients.get(restaurantId)!.add(res);
};

export const sseRemove = (restaurantId: string, res: Response) => {
  clients.get(restaurantId)?.delete(res);
};

export const sseBroadcast = (restaurantId: string, event: string, data: object) => {
  const bucket = clients.get(restaurantId);
  if (!bucket?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of bucket) {
    try { res.write(payload); } catch { bucket.delete(res); }
  }
};
