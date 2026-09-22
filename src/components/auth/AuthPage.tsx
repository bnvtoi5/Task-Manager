import React, { useState } from 'react';
import {
  Shield,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  Lock,
  Mail,
  User,
  Sparkles,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  MonitorCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SessionDisplacedModal } from './SessionDisplacedModal';

export const AuthPage: React.FC = () => {
  const { login, signup, db, sessionNotice, dismissSessionNotice } = useApp();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [roleMode, setRoleMode] = useState<'user' | 'admin'>('user');
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

  const fillQuickAccount = (type: 'admin' | 'user') => {
    setTab('login');
    setErrorMsg('');
    setSuccessMsg('');
    if (type === 'admin') {
      setRoleMode('admin');
      setEmail('admin');
      setPassword('123456');
    } else {
      setRoleMode('user');
      const regularUser = db.users.find((u) => u.role !== 'admin');
      setEmail(regularUser?.email || 'user@workspace.local');
      setPassword('123456');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 transition-colors">
      {/* Session displaced modal when kicked out */}
      <SessionDisplacedModal notice={sessionNotice} onClose={dismissSessionNotice} />

      <div className="w-full max-w-md">
        {/* Brand / Logo Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white shadow-md mb-2.5">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
            Workspace Task Manager
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Hệ thống phân quyền & Quản lý tiến độ công việc tập trung
          </p>
        </div>

        {/* Security Notice Banner: Single Session Protection */}
        <div className="mb-4 p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
          <MonitorCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold">Bảo mật phiên đơn lẻ:</strong> Khi tài khoản đăng nhập trên thiết bị hoặc trình duyệt khác, phiên đang chạy sẽ tự động đăng xuất ngay lập tức để chống ghi đè dữ liệu.
          </div>
        </div>

        {/* Displaced Banner if notice active */}
        {sessionNotice.isOpen && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold">Phiên vừa bị ngắt:</span> Tài khoản của bạn vừa đăng nhập trên máy khác ({sessionNotice.newDevice || 'Thiết bị mới'}). Hãy đăng nhập lại nếu bạn muốn tiếp tục làm việc trên máy này.
            </div>
          </div>
        )}

        {/* Auth Card (Fluent 2 Card Style) */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl p-6 transition-all">
          {/* Role Separation Selector: Tách quyền đăng nhập */}
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
              Tách quyền đăng nhập
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRoleMode('user');
                  if (email === 'admin') setEmail('');
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                  roleMode === 'user'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${roleMode === 'user' ? 'bg-blue-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}>
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Thành viên</div>
                  <div className="text-[10px] font-normal text-neutral-400 dark:text-neutral-500">Người dùng thường</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRoleMode('admin');
                  if (!email || email.includes('@')) setEmail('admin');
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                  roleMode === 'admin'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${roleMode === 'admin' ? 'bg-amber-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Quản trị viên</div>
                  <div className="text-[10px] font-normal text-neutral-400 dark:text-neutral-500">Admin toàn quyền</div>
                </div>
              </button>
            </div>
          </div>

          {/* Login / Register Tabs */}
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
                  {roleMode === 'admin' ? 'Tài khoản Quản trị viên' : 'Email hoặc Tên đăng nhập'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={roleMode === 'admin' ? 'admin' : 'user@example.com'}
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
                className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  roleMode === 'admin'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <span>{roleMode === 'admin' ? 'Đăng nhập Quản trị viên' : 'Đăng nhập Thành viên'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* One-click quick presets for testing separation */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-2">
                  Hoặc chọn nhanh tài khoản mẫu:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('admin')}
                    className="flex-1 py-1.5 px-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-[11px] font-medium transition cursor-pointer"
                  >
                    🛡️ Admin (admin/123456)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('user')}
                    className="flex-1 py-1.5 px-2.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-950/40 text-[11px] font-medium transition cursor-pointer"
                  >
                    👤 User (user/123456)
                  </button>
                </div>
              </div>
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
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Tạo tài khoản & Đăng nhập</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
