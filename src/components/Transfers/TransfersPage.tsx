import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../lib/apiClient';
import { TransferForm } from './TransferForm';
import { TransferHistory } from './TransferHistory';

interface Warehouse {
  id: string;
  name: string;
  is_main: boolean;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  active: boolean;
}

const TransfersPage: React.FC = () => {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    Promise.all([
      apiClient.get('/warehouses'),
      apiClient.get('/products'),
    ]).then(([wRes, pRes]) => {
      setWarehouses(wRes.data);
      const allProducts: Product[] = pRes.data;
      setProducts(allProducts.filter((p) => p.active !== false));
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif italic text-2xl text-cream mb-1">{t('transfers_page_title')}</h1>
        <p className="text-cream-muted text-sm">{t('transfers_page_subtitle')}</p>
      </div>

      <TransferForm
        warehouses={warehouses}
        products={products}
        onSuccess={() => setRefreshTrigger((n) => n + 1)}
      />

      <TransferHistory refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default TransfersPage;
