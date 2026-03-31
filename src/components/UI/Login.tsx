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
      if (err.code === 'auth/operation-not-allowed') {
        toast.error('Firebase Auth is not enabled. Please enable Email/Password in Firebase Console.');
      } else if (err.code === 'auth/user-not-found') {
        toast.error('Demo account not found. Please register first.');
      } else {
        toast.error(err?.message || 'Demo Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20 mb-6">
            <Warehouse size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">StoreHouse MK</h1>
          <p className="text-slate-500 font-medium">{isLogin ? t('welcome_back') : t('create_account')}</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
              Google
            </button>
            <button 
              onClick={handleDemoLogin}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 border border-blue-100 rounded-xl font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Demo Login
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-400 uppercase tracking-wider font-medium">Or use email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="label">{t('name')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    className="input pl-10" 
                    placeholder="Јован Јовановски"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  className="input pl-10" 
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  className="input pl-10" 
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
              className="btn btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2 text-lg"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? t('login') : t('register')}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-4">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 font-semibold hover:underline block w-full"
            >
              {isLogin ? t('need_account') : t('already_have_account')}
            </button>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Note: Email/Password login requires manual activation in the Firebase Console. 
              If you see "operation-not-allowed", please enable it in the Auth settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
