import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Products from './Products';
import Categories from './Categories';
import Bundles from './Bundles';
import Invoices from './Invoices';
import PurchaseOrders from './PurchaseOrders';
import Inventory from './Inventory';
import InventoryCheck from './InventoryCheck';

type Tab = 'products' | 'categories' | 'bundles' | 'invoices' | 'purchase_orders' | 'movements' | 'inventory_checks';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'products',          labelKey: 'inv_tab_products' },
  { key: 'categories',        labelKey: 'inv_tab_categories' },
  { key: 'bundles',           labelKey: 'inv_tab_bundles' },
  { key: 'invoices',          labelKey: 'inv_tab_invoices' },
  { key: 'purchase_orders',   labelKey: 'inv_tab_purchase_orders' },
  { key: 'movements',         labelKey: 'inv_tab_movements' },
  { key: 'inventory_checks',  labelKey: 'inv_tab_inventory_checks' },
];

const InventoryShell = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('products');

  const renderContent = () => {
    switch (activeTab) {
      case 'products':         return <Products />;
      case 'categories':       return <Categories />;
      case 'bundles':          return <Bundles />;
      case 'invoices':         return <Invoices />;
      case 'purchase_orders':  return <PurchaseOrders />;
      case 'movements':        return <Inventory />;
      case 'inventory_checks': return <InventoryCheck />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="bg-white border border-slate-200 rounded-xl flex p-1 shadow-sm min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div>{renderContent()}</div>
    </div>
  );
};

export default InventoryShell;
