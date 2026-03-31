import React, { useState, useRef } from 'react';
import { Search, MapPin, Navigation, Fuel, Utensils, Hotel, AlertTriangle, Sparkles, Lock, Crown, BarChart3, Truck } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Autocomplete } from '@react-google-maps/api';
import { motion, AnimatePresence } from 'motion/react';
import { FeatureFlags } from '../../types';

interface TripPlannerProps {
  onPlanTrip: (origin: string, destination: string) => void;
  onSearchAlongRoute: (category: string) => void;
  tripAdvice?: string;
  isSearching?: boolean;
  featureFlags: FeatureFlags | null;
}

const TripPlanner: React.FC<TripPlannerProps> = ({ 
  onPlanTrip, 
  onSearchAlongRoute, 
  tripAdvice, 
  isSearching,
  featureFlags 
}) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const handlePlanTrip = () => {
    if (origin && destination) {
      onPlanTrip(origin, destination);
    }
  };

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
    onSearchAlongRoute(category);
  };

  const analyticsEnabled = featureFlags?.analytics_enabled ?? false;
  const deliveryEnabled = featureFlags?.delivery_enabled ?? false;
  const isPro = analyticsEnabled || deliveryEnabled;

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-80 lg:w-96 shrink-0 shadow-xl z-10 overflow-y-auto">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Navigation size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">RoadTrip Architect</h1>
        </div>

        <div className="space-y-4">
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
              <MapPin size={18} />
            </div>
            <Autocomplete
              onLoad={(autocomplete) => (originAutocompleteRef.current = autocomplete)}
              onPlaceChanged={() => {
                const place = originAutocompleteRef.current?.getPlace();
                if (place?.formatted_address) setOrigin(place.formatted_address);
              }}
            >
              <input
                type="text"
                placeholder="Почетна точка"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-sm font-medium"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </Autocomplete>
          </div>

          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
              <Navigation size={18} />
            </div>
            <Autocomplete
              onLoad={(autocomplete) => (destinationAutocompleteRef.current = autocomplete)}
              onPlaceChanged={() => {
                const place = destinationAutocompleteRef.current?.getPlace();
                if (place?.formatted_address) setDestination(place.formatted_address);
              }}
            >
              <input
                type="text"
                placeholder="Дестинација"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-sm font-medium"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </Autocomplete>
          </div>

          <button
            onClick={handlePlanTrip}
            disabled={!origin || !destination}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Search size={18} />
            ПЛАНИРАЈ РУТА
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">ПРЕБАРАЈ ПО ДОЛЖИНА НА ПАТОТ</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleCategoryClick('gas_station')}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                activeCategory === 'gas_station' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              <Fuel size={20} />
              <span className="text-[10px] font-bold uppercase">Гориво</span>
            </button>
            <button
              onClick={() => handleCategoryClick('restaurant')}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                activeCategory === 'restaurant' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              <Utensils size={20} />
              <span className="text-[10px] font-bold uppercase">Храна</span>
            </button>
            <button
              onClick={() => handleCategoryClick('lodging')}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                activeCategory === 'lodging' ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              <Hotel size={20} />
              <span className="text-[10px] font-bold uppercase">Престој</span>
            </button>
          </div>
        </div>

        {/* Premium Features Section */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            ПРЕМИУМ МОДУЛИ
            {!isPro && <Lock size={12} className="text-slate-300" />}
          </h2>
          
          <div className="space-y-2">
            <div className={cn(
              "flex items-center justify-between p-3 rounded-xl border transition-all",
              analyticsEnabled ? "bg-white border-slate-100 text-slate-700" : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
            )}>
              <div className="flex items-center gap-3">
                <BarChart3 size={18} />
                <span className="text-xs font-bold">Аналитика на трошоци</span>
              </div>
              {!analyticsEnabled && <Lock size={14} />}
            </div>
            
            <div className={cn(
              "flex items-center justify-between p-3 rounded-xl border transition-all",
              deliveryEnabled ? "bg-white border-slate-100 text-slate-700" : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
            )}>
              <div className="flex items-center gap-3">
                <Truck size={18} />
                <span className="text-xs font-bold">Оптимизација на логистика</span>
              </div>
              {!deliveryEnabled && <Lock size={14} />}
            </div>
          </div>

          {!isPro && (
            <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={16} className="text-amber-400 fill-current" />
                <span className="text-xs font-black uppercase tracking-wider">Upgrade to Pro</span>
              </div>
              <p className="text-[10px] opacity-80 leading-relaxed mb-3">
                Отклучете напредна аналитика и логистички алатки за вашето следно патување.
              </p>
              <button className="w-full py-2 bg-white text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors">
                Види Планови
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {tripAdvice && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <Sparkles size={40} />
              </div>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                СОВЕТ ОД АРХИТЕКТОТ
              </h3>
              <div className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                {tripAdvice}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isSearching && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <div className="mt-auto p-6 border-t border-slate-100">
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <p className="text-[10px] font-medium text-amber-800 leading-tight">
            Секогаш проверувајте ги локалните услови на патот и цените пред да тргнете.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TripPlanner;
