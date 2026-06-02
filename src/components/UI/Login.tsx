import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Warehouse, Mail, Lock, ArrowRight } from 'lucide-react';
import { authService } from '../../services/authService';
import { useStore } from '../../store/useStore';

interface LoginProps {
  onNewRestaurant?: () => void;
}

const Login = ({ onNewRestaurant }: LoginProps) => {
  const { setUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const user = await authService.loginWithGoogle();
      toast.success(t('login_success'));
      setUser(user);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Google Auth error:', err);
      toast.error(t('login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await authService.login(email, password);
      toast.success(t('login_success'));
      setUser(user);
    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = err?.message || t('invalid_credentials');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base p-6 relative overflow-hidden">
      {/* Warm ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/8 blur-[120px] rounded-full animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full animate-float" style={{ animationDelay: '1.5s' }} />

      <div className="w-full max-w-lg relative z-10">
        <div className="flex flex-col items-center mb-12">
          <div className="w-20 h-20 bg-accent rounded-[2.5rem] flex items-center justify-center text-[#faf5ee] shadow-2xl shadow-card mb-8 border-4 border-accent/20 animate-float">
            <Warehouse size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-bold text-cream tracking-tight mb-4 font-serif italic">GastroPro</h1>
          <p className="text-cream-faint font-bold uppercase tracking-[0.3em] text-xs">{t('welcome_back')}</p>
        </div>

        <div className="bg-surface/80 backdrop-blur-3xl p-10 lg:p-14 rounded-[3.5rem] border border-warm-line shadow-card-lg relative overflow-hidden">
          <div className="grid grid-cols-2 gap-4 mb-10">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex items-center justify-center gap-3 py-4 px-6 bg-surface-2/50 border border-warm-line rounded-2xl font-black text-xs uppercase tracking-widest text-cream-muted hover:bg-surface-2 hover:text-cream transition-all group"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
              Google
            </button>
            {import.meta.env.DEV ? (
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const user = await authService.login('admin@gastropro.mk', 'admin123');
                    toast.success(t('login_success') + ' (Demo)');
                    setUser(user);
                  } catch (error: unknown) {
                    const err = error as Error;
                    toast.error(err?.message || 'Demo Login failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex items-center justify-center gap-3 py-4 px-6 bg-accent text-[#faf5ee] border border-accent/80 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all shadow-card whitespace-nowrap"
              >
                Demo Login
              </button>
            ) : null}
          </div>

          <div className="relative mb-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-line" />
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="px-4 bg-surface text-cream-faint uppercase tracking-[0.4em] font-black">Најава преку е-пошта</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-cream-faint uppercase tracking-widest ml-4">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
                <input
                  type="email"
                  className="w-full pl-14 pr-6 py-4 rounded-2xl bg-warm-input border border-warm-line focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/50 text-cream font-bold transition-all placeholder:text-cream-faint"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-cream-faint uppercase tracking-widest ml-4">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-cream-faint" size={18} />
                <input
                  type="password"
                  className="w-full pl-14 pr-6 py-4 rounded-2xl bg-warm-input border border-warm-line focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/50 text-cream font-bold transition-all placeholder:text-cream-faint"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 mt-4 bg-cream text-[#1a1612] rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-card-lg disabled:bg-surface-2 disabled:text-cream-faint group"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-[#1a1612] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {t('login')}
                  <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => { window.location.href = '/forgot-password'; }}
              className="text-cream-faint font-bold uppercase tracking-widest text-[10px] hover:text-accent-light transition-colors"
            >
              Заборавена лозинка?
            </button>
          </div>

          <div className="mt-6 pt-8 border-t border-warm-line text-center">
            <button
              type="button"
              onClick={onNewRestaurant}
              className="text-cream-muted font-extrabold uppercase tracking-widest text-xs hover:text-accent-light transition-colors"
            >
              {t('need_account')}
            </button>
          </div>

          <div className="absolute top-0 left-0 w-32 h-32 bg-accent/5 rounded-full -ml-16 -mt-16 blur-3xl" />
        </div>

        <p className="mt-8 text-center text-[10px] font-black text-cream-faint uppercase tracking-[0.5em] opacity-50">GastroPro System • v2.0.4 Premium Edition</p>
      </div>
    </div>
  );
};

export default Login;
