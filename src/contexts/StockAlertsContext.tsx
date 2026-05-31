import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../lib/apiClient';
import { useStore } from '../store/useStore';

interface AlertItem {
  id: string;
  name: string;
  unit: string;
  min_stock: number;
  quantity: number;
  warehouse_id: string;
  warehouse_name: string;
}

interface AlertsData {
  out_of_stock: AlertItem[];
  low_stock: AlertItem[];
}

interface StockAlertsState {
  outOfStockCount: number;
  lowStockCount: number;
  alerts: AlertsData;
}

const defaultState: StockAlertsState = {
  outOfStockCount: 0,
  lowStockCount: 0,
  alerts: { out_of_stock: [], low_stock: [] },
};

const StockAlertsContext = createContext<StockAlertsState>(defaultState);

export const StockAlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useStore();
  const [state, setState] = useState<StockAlertsState>(defaultState);

  useEffect(() => {
    if (!user) {
      setState(defaultState);
      return;
    }

    let cancelled = false;

    const load = () => {
      apiClient.get<AlertsData>('/stock/alerts')
        .then(res => {
          if (!cancelled) {
            setState({
              outOfStockCount: res.data.out_of_stock.length,
              lowStockCount: res.data.low_stock.length,
              alerts: res.data,
            });
          }
        })
        .catch((err) => {
          if (err?.response?.status !== 401) console.error('StockAlerts fetch error:', err);
        });
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  return (
    <StockAlertsContext.Provider value={state}>
      {children}
    </StockAlertsContext.Provider>
  );
};

export const useStockAlerts = () => useContext(StockAlertsContext);
