import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  DollarSign, 
  Clock, 
  User as UserIcon,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { Shift } from '../../types';
import { useStore } from '../../store/useStore';
import { format } from 'date-fns';
import { mk } from 'date-fns/locale';
import { toast } from 'sonner';
import ShiftReport, { ShiftReportData } from './ShiftReport';

const ShiftManagement: React.FC = () => {
  const { user } = useStore();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState<number>(0);
  const [endingCash, setEndingCash] = useState<number>(0);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [reportData, setReportData] = useState<ShiftReportData | null>(null);

  useEffect(() => {
    loadActiveShift();
  }, []);

  const loadActiveShift = async () => {
    setLoading(true);
    try {
      const shift = await shiftService.getActiveShift(user?.id || '');
      setActiveShift(shift || null);
    } catch (error) {
      console.error('Error loading shift:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async () => {
    if (!user) return;
    try {
      const newShift = await shiftService.openShift(user.id, user.name, startingCash);
      if (newShift) {
        setActiveShift(newShift);
        setShowOpenModal(false);
        toast.success('Смената е успешно отворена');
      }
    } catch {
      toast.error('Грешка при отворање на смена');
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      await shiftService.closeShift(activeShift.id, endingCash);
      const report = await shiftService.getShiftReport(activeShift.id);
      setActiveShift(null);
      setShowCloseModal(false);
      if (report) {
        setReportData(report);
      } else {
        toast.success('Смената е успешно затворена');
      }
    } catch {
      toast.error('Грешка при затворање на смена');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Управување со Смени</h1>
        <p className="text-gray-500">Отворете или затворете ја вашата работна смена</p>
      </div>

      {!activeShift ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Нема активна смена</h2>
          <p className="text-gray-500 mb-6">За да започнете со работа во POS системот, мора прво да отворите смена.</p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Play className="w-5 h-5 mr-2" />
            Отвори Смена
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-start">
            <CheckCircle2 className="w-6 h-6 text-green-600 mr-4 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">Активна Смена</h3>
              <p className="text-green-700">Смената е отворена на {format(new Date(activeShift.startTime), 'HH:mm, dd MMM yyyy', { locale: mk })}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center text-gray-500 mb-2">
                <UserIcon className="w-4 h-4 mr-2" />
                Корисник
              </div>
              <div className="text-xl font-bold">{activeShift.userName}</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center text-gray-500 mb-2">
                <DollarSign className="w-4 h-4 mr-2" />
                Почетен кеш
              </div>
              <div className="text-xl font-bold">{activeShift.startingCash.toLocaleString()} ден.</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center text-gray-500 mb-2">
                <DollarSign className="w-4 h-4 mr-2" />
                Вкупна продажба
              </div>
              <div className="text-xl font-bold text-primary">{activeShift.totalSales.toLocaleString()} ден.</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setShowCloseModal(true)}
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              <Square className="w-5 h-5 mr-2" />
              Затвори Смена
            </button>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Отвори Нова Смена</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Почетен износ во каса (ден.)
                </label>
                <input
                  type="number"
                  value={startingCash}
                  onChange={(e) => setStartingCash(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Внесете го износот на готовина кој е моментално присутен во касата.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Откажи
                </button>
                <button
                  onClick={handleOpenShift}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Потврди
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Report */}
      {reportData && (
        <ShiftReport data={reportData} onClose={() => setReportData(null)} />
      )}

      {/* Close Shift Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-red-600">Затвори Смена</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Почетен кеш:</span>
                  <span className="font-medium">{activeShift?.startingCash} ден.</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Вкупна продажба:</span>
                  <span className="font-medium">{activeShift?.totalSales} ден.</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                  <span>Очекуван износ:</span>
                  <span>{(activeShift?.startingCash || 0) + (activeShift?.totalSales || 0)} ден.</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Краен износ во каса (ден.)
                </label>
                <input
                  type="number"
                  value={endingCash}
                  onChange={(e) => setEndingCash(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Откажи
                </button>
                <button
                  onClick={handleCloseShift}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Затвори
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagement;
