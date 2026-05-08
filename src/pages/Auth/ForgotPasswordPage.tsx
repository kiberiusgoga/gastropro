import React, { useState } from 'react';
import { toast } from 'sonner';
import { Warehouse, Mail, ArrowLeft } from 'lucide-react';
import apiClient from '../../lib/apiClient';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch {
      // Always show success — anti-enumeration
      setSubmitted(true);
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
          {submitted ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tight">Проверете го вашиот inbox</h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                Ако постои акаунт со таа email адреса, ќе добиете email со инструкции за ресетирање на лозинката.
              </p>
              <button
                onClick={() => { window.location.pathname = '/'; }}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-400 transition-colors mx-auto"
              >
                <ArrowLeft size={14} />
                Назад на најава
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Заборавена лозинка</h2>
              <p className="text-zinc-500 text-sm mb-8">Внесете ја вашата email адреса и ќе ви испратиме линк за ресетирање.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      type="email"
                      className="w-full pl-14 pr-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 text-white font-bold transition-all placeholder:text-zinc-700"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    'Испрати линк за ресетирање'
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

export default ForgotPasswordPage;
