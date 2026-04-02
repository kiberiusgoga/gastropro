import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, 
  LayoutGrid, 
  Utensils, 
  Users, 
  Printer as PrinterIcon, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Plus,
  Trash2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { restaurantService } from '../../services/restaurantService';
import { useStore } from '../../store/useStore';
import { Restaurant } from '../../types';
import { onboardingService } from '../../services/onboardingService';
import { toast } from 'sonner';

interface SetupStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const steps: SetupStep[] = [
  { id: 1, title: 'Ресторан', description: 'Основни информации за вашиот бизнис', icon: Store },
  { id: 2, title: 'Маси', description: 'Дефинирајте го распоредот на маси', icon: LayoutGrid },
  { id: 3, title: 'Категории', description: 'Групирајте ги вашите артикли', icon: LayoutGrid },
  { id: 4, title: 'Мени', description: 'Додадете ги вашите артикли', icon: Utensils },
  { id: 5, title: 'Вработени', description: 'Додадете го вашиот тим', icon: Users },
  { id: 6, title: 'Принтери', description: 'Конфигурирајте печатење', icon: PrinterIcon },
  { id: 7, title: 'Завршување', description: 'Преглед и активирање', icon: CheckCircle2 },
];

const RestaurantSetupWizard = () => {
  const { user, setRestaurant } = useStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [restaurantData, setRestaurantData] = useState({
    name: '',
    address: '',
    subscriptionPlan: 'pro' as Restaurant['subscriptionPlan'],
    settings: {
      currency: 'MKD',
      timezone: 'Europe/Skopje'
    }
  });

  const [createdRestaurant, setCreatedRestaurant] = useState<Restaurant | null>(null);

  // Manual Entry States
  const [tables, setTables] = useState<{ number: number; capacity: number; zone: string }[]>([]);
  const [categories, setCategories] = useState<{ name: string; sortOrder: number }[]>([]);
  const [menuItems, setMenuItems] = useState<{ name: string; price: number; menuCategoryId: string; preparationStation: string }[]>([]);
  const [employees, setEmployees] = useState<{ name: string; email: string; role: string }[]>([]);
  const [printers, setPrinters] = useState<{ name: string; type: string; station?: string }[]>([]);

  const handleCreateRestaurant = async () => {
    if (!user) return;
    
    try {
      const result = await restaurantService.create({
        ...restaurantData,
        ownerId: user.id,
      });
      
      if (result) {
        setCreatedRestaurant(result as Restaurant);
        setRestaurant(result as Restaurant);
        toast.success('Ресторанот е успешно креиран!');
        setCurrentStep(2);
      }
    } catch {
      toast.error('Грешка при креирање на ресторан');
    }
  };

  const handleGenerateDemoData = async () => {
    if (!createdRestaurant || !user) return;
    
    setIsGeneratingDemo(true);
    try {
      const success = await onboardingService.generateDemoData();
      if (success) {
        toast.success('Демо податоците се успешно генерирани!');
        setCurrentStep(7);
      } else {
        toast.error('Грешка при генерирање демо податоци');
      }
    } catch {
      toast.error('Грешка при генерирање демо податоци');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const handleFinishSetup = async () => {
    if (!createdRestaurant) return;
    
    setIsGeneratingDemo(true);
    try {
      const success = await onboardingService.saveManualData({
        tables,
        categories,
        menuItems,
        employees,
        printers
      });
      
      if (success) {
        toast.success('Поставувањето е успешно завршено!');
        window.location.reload(); // Refresh to enter the app
      } else {
        toast.error('Грешка при зачувување на податоците');
      }
    } catch {
      toast.error('Грешка при зачувување на податоците');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Име на ресторан</label>
                <input 
                  type="text"
                  value={restaurantData.name}
                  onChange={(e) => setRestaurantData({ ...restaurantData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Внесете го името на вашиот ресторан"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Адреса</label>
                <input 
                  type="text"
                  value={restaurantData.address}
                  onChange={(e) => setRestaurantData({ ...restaurantData, address: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Внесете ја адресата"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">План на претплата</label>
                <div className="grid grid-cols-3 gap-4">
                  {(['basic', 'pro', 'enterprise'] as const).map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setRestaurantData({ ...restaurantData, subscriptionPlan: plan })}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        restaurantData.subscriptionPlan === plan 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-slate-100 hover:border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="block font-bold uppercase text-xs mb-1">{plan}</span>
                      <span className="text-sm">
                        {plan === 'basic' ? 'Основа' : plan === 'pro' ? 'Про' : 'Елит'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleCreateRestaurant}
              disabled={!restaurantData.name || !restaurantData.address}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              Креирај ресторан <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 2: // Tables
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900">Брз почеток?</h4>
                  <p className="text-sm text-blue-700">Генерирајте демо податоци за сите чекори одеднаш.</p>
                </div>
              </div>
              <button 
                onClick={handleGenerateDemoData}
                disabled={isGeneratingDemo}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                {isGeneratingDemo ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} Генерирај
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Листа на маси</h3>
                <button 
                  onClick={() => setTables([...tables, { number: tables.length + 1, capacity: 4, zone: 'Главна' }])}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {tables.map((table, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-600">
                      {table.number}
                    </div>
                    <input 
                      type="number"
                      value={table.capacity}
                      onChange={(e) => {
                        const newTables = [...tables];
                        newTables[index].capacity = parseInt(e.target.value);
                        setTables(newTables);
                      }}
                      className="w-20 px-3 py-1.5 rounded-lg border border-slate-200"
                      placeholder="Капацитет"
                    />
                    <input 
                      type="text"
                      value={table.zone}
                      onChange={(e) => {
                        const newTables = [...tables];
                        newTables[index].zone = e.target.value;
                        setTables(newTables);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200"
                      placeholder="Зона"
                    />
                    <button 
                      onClick={() => setTables(tables.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {tables.length === 0 && (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    Нема додадено маси
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(3)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Следен чекор <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 3: // Menu Categories
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Категории на мени</h3>
                <button 
                  onClick={() => setCategories([...categories, { name: '', sortOrder: categories.length + 1 }])}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {categories.map((cat, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100">
                    <input 
                      type="text"
                      value={cat.name}
                      onChange={(e) => {
                        const newCats = [...categories];
                        newCats[index].name = e.target.value;
                        setCategories(newCats);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200"
                      placeholder="Име на категорија (пр. Пијалоци)"
                    />
                    <button 
                      onClick={() => setCategories(categories.filter((_, i) => i !== index))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    Нема додадено категории
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(4)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Следен чекор <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 4: // Menu Items
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Артикли во мени</h3>
                <button 
                  onClick={() => setMenuItems([...menuItems, { name: '', price: 0, menuCategoryId: categories[0]?.name || '', preparationStation: 'kitchen' }])}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {menuItems.map((item, index) => (
                  <div key={index} className="space-y-2 bg-white p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <input 
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...menuItems];
                          newItems[index].name = e.target.value;
                          setMenuItems(newItems);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200"
                        placeholder="Име на артикл"
                      />
                      <input 
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const newItems = [...menuItems];
                          newItems[index].price = parseFloat(e.target.value);
                          setMenuItems(newItems);
                        }}
                        className="w-24 px-3 py-1.5 rounded-lg border border-slate-200"
                        placeholder="Цена"
                      />
                      <button 
                        onClick={() => setMenuItems(menuItems.filter((_, i) => i !== index))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <select 
                        value={item.menuCategoryId}
                        onChange={(e) => {
                          const newItems = [...menuItems];
                          newItems[index].menuCategoryId = e.target.value;
                          setMenuItems(newItems);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="">Избери категорија</option>
                        {categories.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                      </select>
                      <select 
                        value={item.preparationStation}
                        onChange={(e) => {
                          const newItems = [...menuItems];
                          newItems[index].preparationStation = e.target.value;
                          setMenuItems(newItems);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="kitchen">Кујна</option>
                        <option value="bar">Шанк</option>
                        <option value="grill">Скара</option>
                      </select>
                    </div>
                  </div>
                ))}
                {menuItems.length === 0 && (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    Нема додадено артикли
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(5)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Следен чекор <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 5: // Employees
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Вработени</h3>
                <button 
                  onClick={() => setEmployees([...employees, { name: '', email: '', role: 'Waiter' }])}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {employees.map((emp, index) => (
                  <div key={index} className="space-y-2 bg-white p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <input 
                        type="text"
                        value={emp.name}
                        onChange={(e) => {
                          const newEmps = [...employees];
                          newEmps[index].name = e.target.value;
                          setEmployees(newEmps);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200"
                        placeholder="Име и презиме"
                      />
                      <select 
                        value={emp.role}
                        onChange={(e) => {
                          const newEmps = [...employees];
                          newEmps[index].role = e.target.value;
                          setEmployees(newEmps);
                        }}
                        className="w-32 px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="Waiter">Келнер</option>
                        <option value="Chef">Готвач</option>
                        <option value="Manager">Менаџер</option>
                        <option value="Cashier">Касиер</option>
                      </select>
                      <button 
                        onClick={() => setEmployees(employees.filter((_, i) => i !== index))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <input 
                      type="email"
                      value={emp.email}
                      onChange={(e) => {
                        const newEmps = [...employees];
                        newEmps[index].email = e.target.value;
                        setEmployees(newEmps);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200"
                      placeholder="Е-маил адреса"
                    />
                  </div>
                ))}
                {employees.length === 0 && (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    Нема додадено вработени
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(6)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Следен чекор <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 6: // Printers
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Принтери</h3>
                <button 
                  onClick={() => setPrinters([...printers, { name: '', type: 'kitchen', station: 'kitchen' }])}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {printers.map((printer, index) => (
                  <div key={index} className="space-y-2 bg-white p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <input 
                        type="text"
                        value={printer.name}
                        onChange={(e) => {
                          const newPrinters = [...printers];
                          newPrinters[index].name = e.target.value;
                          setPrinters(newPrinters);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200"
                        placeholder="Име на принтер (пр. Кујна 1)"
                      />
                      <select 
                        value={printer.type}
                        onChange={(e) => {
                          const newPrinters = [...printers];
                          newPrinters[index].type = e.target.value;
                          setPrinters(newPrinters);
                        }}
                        className="w-32 px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="kitchen">Кујна</option>
                        <option value="bar">Шанк</option>
                        <option value="receipt">Сметка</option>
                      </select>
                      <button 
                        onClick={() => setPrinters(printers.filter((_, i) => i !== index))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {printer.type !== 'receipt' && (
                      <select 
                        value={printer.station}
                        onChange={(e) => {
                          const newPrinters = [...printers];
                          newPrinters[index].station = e.target.value;
                          setPrinters(newPrinters);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
                      >
                        <option value="kitchen">Кујна</option>
                        <option value="bar">Шанк</option>
                        <option value="grill">Скара</option>
                      </select>
                    )}
                  </div>
                ))}
                {printers.length === 0 && (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                    Нема додадено принтери
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(7)}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Заврши поставување <ChevronRight size={20} />
            </button>
          </motion.div>
        );

      case 7:
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 py-8"
          >
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={60} />
              </div>
              <h2 className="text-3xl font-black text-slate-900">Спремни сте!</h2>
              <p className="text-slate-600 text-lg">
                Вашиот ресторан е успешно поставен и подготвен за работа.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-sm mx-auto text-left space-y-3">
              <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Преглед на поставување:</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="text-green-500" /> {tables.length || 5} Маси
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="text-green-500" /> {categories.length || 6} Категории
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="text-green-500" /> {menuItems.length || 12} Артикли
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="text-green-500" /> {employees.length || 3} Вработени
                </li>
              </ul>
            </div>

            <button
              onClick={handleFinishSetup}
              disabled={isGeneratingDemo}
              className="w-full max-w-sm py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
            >
              {isGeneratingDemo ? <Loader2 className="animate-spin" size={20} /> : 'Влези во апликацијата'}
            </button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="bg-slate-900 p-8 md:w-80 text-white flex flex-col">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Store size={24} />
            </div>
            <span className="font-black text-xl tracking-tight">StoreHouse</span>
          </div>

          <div className="flex-1 space-y-6">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-4 transition-all ${
                    isActive ? 'opacity-100' : isCompleted ? 'opacity-60' : 'opacity-30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isActive ? 'bg-blue-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Чекор {step.id}</p>
                    <p className={`font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>{step.title}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800">
            <p className="text-xs text-slate-500 leading-relaxed">
              Поставете го вашиот ресторан за само неколку минути.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 md:p-12">
          <div className="max-w-lg mx-auto h-full flex flex-col">
            <div className="mb-12">
              <h1 className="text-3xl font-black text-slate-900 mb-2">
                {steps.find(s => s.id === currentStep)?.title}
              </h1>
              <p className="text-slate-500">
                {steps.find(s => s.id === currentStep)?.description}
              </p>
            </div>

            <div className="flex-1">
              <AnimatePresence mode="wait">
                {renderStep()}
              </AnimatePresence>
            </div>

            {currentStep > 1 && currentStep < 7 && (
              <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
                <button 
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex items-center gap-2 text-slate-500 font-semibold hover:text-slate-900 transition-all"
                >
                  <ChevronLeft size={20} /> Назад
                </button>
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div 
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        currentStep === i + 1 ? 'w-8 bg-blue-500' : 'w-2 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantSetupWizard;
