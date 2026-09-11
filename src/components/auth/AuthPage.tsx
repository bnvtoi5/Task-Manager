import React, { useState } from 'react';
import { Shield, CheckCircle2, ArrowRight, UserPlus, Lock, Mail, User, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AuthPage: React.FC = () => {
  const { login, signup, db } = useApp();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const res = login(email, password);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!displayName.trim()) {
      setErrorMsg('Vui lòng nhập tên hiển thị.');
      return;
    }

    const res = signup(email, displayName, password);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  // Quick fill default admin
  const handleQuickFillAdmin = () => {
    setEmail('admin@system.local');
    setPassword('Admin@123456');
    setTab('login');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 transition-colors">
      <div className="w-full max-w-md">
        {/* Brand / Logo Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-md mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Workspace Task Manager
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Hệ thống phân cấp: Account → Workspace → Period → Division → Cluster → Task
          </p>
        </div>

        {/* Auth Card (Fluent 2 Card Style) */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl p-6 transition-all">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl mb-5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition ${
                tab === 'login'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              disabled={!db.settings.allow_registration}
              onClick={() => {
                setTab('signup');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition ${
                tab === 'signup'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400">
              {successMsg}
            </div>
          )}

          {/* Form */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Email tài khoản
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <span>Đăng nhập</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Tên hiển thị của bạn
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Email đăng ký
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <span>Tạo tài khoản & Đăng nhập</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Default Admin Quick-Fill Banner */}
          <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-medium border border-purple-200 dark:border-purple-900 mb-2">
              <Shield className="w-3 h-3" />
              <span>Chỉ có 1 tài khoản Admin mặc định</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2.5">
              Hệ thống khởi động sạch, không có dữ liệu mẫu. Dùng admin để kiểm tra quyền quản trị:
            </p>
            <button
              type="button"
              onClick={handleQuickFillAdmin}
              className="w-full py-2 px-3 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Điền nhanh Admin (admin@system.local)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
