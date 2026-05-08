import React, { useState } from 'react';
import { toast } from 'sonner';
import { Warehouse, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import apiClient from '../../lib/apiClient';

const token = new URLSearchParams(window.location.search).get('token');

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full" />
        <div className="w-full max-w-lg relative z-10">
          <div className="flex flex-col items-center mb-12">
            <div className="w-20 h-20 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-zinc-950 shadow-2xl shadow-emerald-500/20 mb-8 border-4 border-emerald-400/20">
              <Warehouse size={40} strokeWidth={2.5} />
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter mb-4 font-display uppercase italic">GastroPro</h1>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur-3xl p-10 lg:p-14 rounded-[3.5rem] border border-zinc-800 shadow-2xl text-center">
            <p className="text-red-400 font-bold mb-6">Невалиден или истечен линк за ресетирање.</p>
            <button
              onClick={() => { window.location.pathname = '/'; }}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-400 transition-colors mx-auto"
            >
              <ArrowLeft size={14} />
              Назад на најава
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Лозинката мора да содржи најмалку 8 знаци.');
      return;
    }
    if (password !== confirm) {
      toast.error('Лозинките не се совпаѓаат.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'INVALID_RESET_TOKEN') {
        toast.error('Линкот е невалиден или веќе употребен. Побарајте нов.');
      } else {
        toast.error('Нешто тргна наопаку. Обидете се повторно.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />

      <div className="w-full max-w-lg relative z-10">
        <div className="flex flex-col items-center mb-12">
          <div className="w-20 h-20 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-zinc-950 shadow-2xl shadow-emerald-500/20 mb-8 border-4 border-emerald-400/20">
            <Warehouse size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-4 font-display uppercase italic">GastroPro</h1>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-3xl p-10 lg:p-14 rounded-[3.5rem] border border-zinc-800 shadow-2xl">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tight">Лозинката е сменета</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                Вашата лозинка беше успешно ресетирана. Сите активни сесии беа одјавени.
              </p>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-400 transition-colors mx-auto"
              >
                <ArrowLeft size={14} />
                Најави се
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Нова лозинка</h2>
              <p className="text-zinc-500 text-sm mb-8">Внесете нова лозинка. Сите активни сесии ќе бидат одјавени.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Нова лозинка</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      type="password"
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 text-white font-bold transition-all placeholder:text-zinc-700"
                      placeholder="Мин. 8 знаци"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Потврди лозинка</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      type="password"
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 text-white font-bold transition-all placeholder:text-zinc-700"
                      placeholder="Повтори ја лозинката"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-white text-zinc-950 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-2xl shadow-white/5 disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-4 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Зачувај нова лозинка'
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button
                  onClick={() => { window.location.pathname = '/'; }}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-400 transition-colors mx-auto"
                >
                  <ArrowLeft size={14} />
                  Назад на најава
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
