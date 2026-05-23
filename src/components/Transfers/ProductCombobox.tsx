import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unit: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const inputCls = 'w-full bg-warm-input border border-warm-line rounded-btn px-3 py-1.5 text-cream text-sm placeholder:text-cream-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20';

export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  products,
  value,
  onChange,
  placeholder = 'Пребарај производ...',
  disabled = false,
}) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = products.find((p) => p.id === value);
  const filtered = search.trim()
    ? products.filter((p) => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    : products;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((o) => !o)}
        className="w-full bg-warm-input border border-warm-line rounded-btn px-4 py-2.5 text-left text-cream flex items-center justify-between hover:border-warm-line/80 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        <span className={selected ? 'text-cream' : 'text-cream-faint text-sm'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={16} className={`text-cream-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-warm-line rounded-card shadow-card-lg max-h-72 overflow-hidden">
          <div className="p-2 border-b border-warm-line">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пиши за филтрирање..."
              className={inputCls}
            />
          </div>
          <div className="overflow-y-auto max-h-56">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-cream-muted text-sm">Нема резултати</div>
            ) : (
              filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onChange(product.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-4 py-2.5 text-left text-cream hover:bg-surface-2 flex items-center justify-between transition-colors ${value === product.id ? 'bg-accent/10' : ''}`}
                >
                  <span className="text-sm">{product.name}</span>
                  <span className="text-cream-faint text-xs ml-2 shrink-0">{product.unit}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCombobox;
