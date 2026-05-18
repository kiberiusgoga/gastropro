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
      color: 'text-cream-muted'
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
      color: 'text-accent-light',
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
      color: 'text-blue-400'
    }
  ];

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="bg-surface p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-warm-line shadow-card">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-accent/10 text-accent-light rounded-2xl">
            <CreditCard size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-cream">Претплата и План</h2>
            <p className="text-cream-faint font-medium">Управувајте со вашиот SaaS пакет и наплата.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-surface-2 rounded-2xl border border-warm-line">
          <span className="text-sm font-bold text-cream-faint uppercase tracking-widest">Моментален план:</span>
          <span className="px-3 py-1 bg-emerald-900/20 text-emerald-400 rounded-lg font-black uppercase text-xs tracking-widest">
            {restaurant?.subscriptionPlan || 'Basic'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -5 }}
            className={`bg-surface p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-card relative overflow-hidden flex flex-col ${
              plan.recommended ? 'border-accent/50 ring-4 ring-accent/10' : 'border-warm-line'
            }`}
          >
            {plan.recommended && (
              <div className="absolute top-0 right-0 bg-accent text-[#faf5ee] px-6 py-1 rounded-bl-2xl font-black text-[10px] uppercase tracking-widest">
                Препорачано
              </div>
            )}

            <div className={`p-4 rounded-2xl bg-surface-2 w-fit mb-6 ${plan.color}`}>
              <plan.icon size={32} />
            </div>

            <h3 className="text-2xl font-black mb-2 text-cream">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-cream">{plan.price}</span>
              <span className="text-cream-faint font-bold">ден. / месец</span>
            </div>

            <div className="space-y-4 flex-1 mb-8">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium text-cream-muted">
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            <button
              onClick={() => onUpgrade(plan.id as Restaurant['subscriptionPlan'])}
              disabled={restaurant?.subscriptionPlan === plan.id}
              className={`w-full py-4 rounded-2xl font-black transition-all ${
                restaurant?.subscriptionPlan === plan.id
                  ? 'bg-surface-2 text-cream-faint cursor-not-allowed'
                  : plan.recommended
                  ? 'bg-accent text-[#faf5ee] hover:brightness-110 shadow-card'
                  : 'bg-surface-2 border border-warm-line text-cream hover:bg-warm-input'
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
