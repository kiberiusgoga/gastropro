import React from 'react';
import { Restaurant } from '../types';
import { motion } from 'motion/react';
import { CreditCard, CheckCircle2, Zap, ShieldCheck, Globe } from 'lucide-react';

interface BillingViewProps {
  restaurant: Restaurant | null;
  onUpgrade: (plan: Restaurant['subscriptionPlan']) => void;
}

const BillingView: React.FC<BillingViewProps> = ({ restaurant, onUpgrade }) => {
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '0',
      features: [
        'До 15 маси',
        'Мени менаџмент',
        'Инвентар (основен)',
        '1 ресторан локација',
        'Стандардна поддршка'
      ],
      icon: ShieldCheck,
      color: 'text-zinc-500'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '2,400',
      features: [
        'Неограничени маси',
        'Напредна аналитика (D3)',
        'QR Мени за гости',
        'CRM & Лојалност',
        'До 3 локации',
        'Приоритетна поддршка'
      ],
      icon: Zap,
      color: 'text-emerald-600',
      recommended: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '5,900',
      features: [
        'Сè од Pro планот',
        'Неограничени локации',
        'API пристап',
        'Персонализиран брендинг',
        'Dedicated Account Manager',
        '24/7 Телефонска поддршка'
      ],
      icon: Globe,
      color: 'text-blue-600'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Претплата и План</h2>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Управувајте со вашиот SaaS пакет и наплата.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700">
          <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Моментален план:</span>
          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg font-black uppercase text-xs tracking-widest">
            {restaurant?.subscriptionPlan || 'Basic'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -5 }}
            className={`bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border shadow-sm relative overflow-hidden flex flex-col ${
              plan.recommended ? 'border-emerald-500 dark:border-emerald-600 ring-4 ring-emerald-500/10' : 'border-zinc-100 dark:border-zinc-800'
            }`}
          >
            {plan.recommended && (
              <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-1 rounded-bl-2xl font-black text-[10px] uppercase tracking-widest">
                Препорачано
              </div>
            )}

            <div className={`p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 w-fit mb-6 ${plan.color}`}>
              <plan.icon size={32} />
            </div>

            <h3 className="text-2xl font-black mb-2 text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-zinc-900 dark:text-zinc-100">{plan.price}</span>
              <span className="text-zinc-500 dark:text-zinc-400 font-bold">ден. / месец</span>
            </div>

            <div className="space-y-4 flex-1 mb-8">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            <button
              onClick={() => onUpgrade(plan.id as Restaurant['subscriptionPlan'])}
              disabled={restaurant?.subscriptionPlan === plan.id}
              className={`w-full py-4 rounded-2xl font-black transition-all ${
                restaurant?.subscriptionPlan === plan.id
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : plan.recommended
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
                  : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
              }`}
            >
              {restaurant?.subscriptionPlan === plan.id ? 'АКТИВЕН ПЛАН' : 'ИЗБЕРИ ПЛАН'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BillingView;
