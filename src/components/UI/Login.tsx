import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Warehouse, Mail, Lock, ArrowRight, User as UserIcon } from 'lucide-react';
import { authService } from '../../services/authService';
import { useStore } from '../../store/useStore';

const Login = () => {
  const { setUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
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
      let user;
      if (isLogin) {
        user = await authService.login(email, password);
        toast.success(t('login_success'));
      } else {
        user = await authService.register(name, email, password);
        toast.success(t('registration_success'));
      }
      setUser(user);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Auth error:', err);
      const errorMessage = err?.message || t('invalid_credentials');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    const demoEmail = 'admin@storehouse.mk';
    const demoPassword = 'password123';
    
    try {
      const user = await authService.login(demoEmail, demoPassword);
      toast.success(t('login_success') + ' (Demo)');
      setUser(user);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error('Demo Auth error:', err);
      toast.error(err?.message || 'Demo Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-6 relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-float" style={{ animationDelay: '1.5s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

      <div className="w-full max-w-lg relative z-10">
        <div className="flex flex-col items-center mb-12">
          <div className="w-20 h-20 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-zinc-950 shadow-2xl shadow-emerald-500/20 mb-8 border-4 border-emerald-400/20 animate-float">
            <Warehouse size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-4 font-display uppercase italic">GastroPro</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-xs">{isLogin ? t('welcome_back') : t('create_account')}</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-3xl p-10 lg:p-14 rounded-[3.5rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-2 gap-4 mb-10">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex items-center justify-center gap-3 py-4 px-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all group"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
              Google
            </button>
            <button 
              onClick={handleDemoLogin}
              disabled={loading}
              className="flex items-center justify-center gap-3 py-4 px-6 bg-emerald-500 text-zinc-950 border border-emerald-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
            >
              Demo Login
            </button>
          </div>

          <div className="relative mb-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="px-4 bg-zinc-900 text-zinc-500 uppercase tracking-[0.4em] font-black">Најава преку е-пошта</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">{t('name')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input 
                    type="text" 
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 text-white font-bold transition-all placeholder:text-zinc-700" 
                    placeholder="Јован Јовановски"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="email" 
                  className="w-full pl-14 pr-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 text-white font-bold transition-all placeholder:text-zinc-700" 
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="password" 
                  className="w-full pl-14 pr-6 py-4 rounded-2xl bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 text-white font-bold transition-all placeholder:text-zinc-700" 
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
              className="w-full py-5 mt-4 bg-white text-zinc-950 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-2xl shadow-white/5 disabled:bg-zinc-700 disabled:text-zinc-400 group"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? t('login') : t('register')}
                  <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-zinc-800 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-zinc-400 font-extrabold uppercase tracking-widest text-xs hover:text-emerald-400 transition-colors"
            >
              {isLogin ? t('need_account') : t('already_have_account')}
            </button>
          </div>
          
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full -ml-16 -mt-16 blur-3xl"></div>
        </div>
        
        <p className="mt-8 text-center text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em] opacity-50">GastroPro System • v2.0.4 Premium Edition</p>
      </div>
    </div>
  );
};

export default Login;
