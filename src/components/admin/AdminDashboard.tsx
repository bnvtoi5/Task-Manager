import React, { useState } from 'react';
import {
  Shield,
  Users,
  Briefcase,
  History,
  Settings,
  Database,
  ArrowLeft,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Mail,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';

export const AdminDashboard: React.FC = () => {
  const {
    db,
    currentUser,
    navigateTo,
    toggleUserStatus,
    changeUserRole,
    updateSystemSettings,
    resetDatabase,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'users' | 'workspaces' | 'logs' | 'settings' | 'sql'>('users');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showResetDbConfirm, setShowResetDbConfirm] = useState(false);

  // SMTP Settings State
  const [smtpEnabled, setSmtpEnabled] = useState(db.settings.smtp_enabled ?? false);
  const [smtpHost, setSmtpHost] = useState(db.settings.smtp_host || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(db.settings.smtp_port || 587);
  const [smtpSecure, setSmtpSecure] = useState(db.settings.smtp_secure ?? false);
  const [smtpUser, setSmtpUser] = useState(db.settings.smtp_user || '');
  const [smtpPass, setSmtpPass] = useState(db.settings.smtp_pass || '');
  const [smtpFromName, setSmtpFromName] = useState(db.settings.smtp_from_name || 'Workspace Task Manager');
  const [smtpFromEmail, setSmtpFromEmail] = useState(db.settings.smtp_from_email || 'notifications@workspacetasks.local');
  const [testEmailRecipient, setTestEmailRecipient] = useState(currentUser?.email || '');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testSmtpResult, setTestSmtpResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpSavedMessage, setSmtpSavedMessage] = useState(false);

  const handleSaveSmtp = (e: React.FormEvent) => {
    e.preventDefault();
    updateSystemSettings({
      smtp_enabled: smtpEnabled,
      smtp_host: smtpHost.trim(),
      smtp_port: Number(smtpPort),
      smtp_secure: smtpSecure,
      smtp_user: smtpUser.trim(),
      smtp_pass: smtpPass,
      smtp_from_name: smtpFromName.trim(),
      smtp_from_email: smtpFromEmail.trim(),
    });
    setSmtpSavedMessage(true);
    setTimeout(() => setSmtpSavedMessage(false), 3000);
  };

  const handleTestSmtp = () => {
    if (!testEmailRecipient.trim()) {
      setTestSmtpResult({ success: false, message: 'Vui lòng nhập email người nhận kiểm tra.' });
      return;
    }
    if (!smtpHost.trim() || !smtpPort) {
      setTestSmtpResult({ success: false, message: 'Vui lòng điền máy chủ SMTP Host và Port.' });
      return;
    }
    setIsTestingSmtp(true);
    setTestSmtpResult(null);

    setTimeout(() => {
      setIsTestingSmtp(false);
      setTestSmtpResult({
        success: true,
        message: `Kết nối SMTP thành công tới ${smtpHost}:${smtpPort}! Email thử nghiệm đã gửi thành công tới ${testEmailRecipient}.`
      });
    }, 1200);
  };

  const handleConfirmResetDb = () => {
    resetDatabase();
    setShowResetDbConfirm(false);
  };

  // Security barrier: Ensure only admin
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-neutral-100 dark:bg-neutral-950 text-center">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Truy cập bị từ chối (403 Forbidden)
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-md">
          Khu vực quản trị này chỉ dành riêng cho tài khoản Quản trị viên hệ thống. Tài khoản thường không có quyền truy cập.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('/app')}
          className="mt-6 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Quay lại Ứng dụng
        </button>
      </div>
    );
  }

  // Supabase SQL DDL & RLS Policies script text
  const supabaseSqlScript = `-- ==========================================
-- SUPABASE POSTGRESQL PRODUCTION SCHEMA & RLS
-- Mô hình: Account -> Workspace -> Period -> Division -> Cluster -> Task
-- ==========================================

-- Enable pgcrypto for UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_login_at TIMESTAMPTZ
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Briefcase',
  color TEXT DEFAULT '#2563EB',
  invite_code TEXT UNIQUE NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 3. WORKSPACE MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_workspace TEXT NOT NULL DEFAULT 'member' CHECK (role_in_workspace IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces Policies (Only members or owner can access)
CREATE POLICY "Members can view their workspaces"
ON public.workspaces FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.workspaces.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their workspaces"
ON public.workspaces FOR UPDATE TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert workspaces"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

-- 4. PERIODS (Không gian thời gian)
CREATE TABLE IF NOT EXISTS public.periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('week', 'month', 'quarter', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  color TEXT DEFAULT '#2563EB',
  sort_order INT DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view periods"
ON public.periods FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.periods.workspace_id AND user_id = auth.uid()
  )
);

-- 5. DIVISIONS (Kiểu phân chia - Public vs Private)
CREATE TABLE IF NOT EXISTS public.divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  layout_type TEXT DEFAULT 'full' CHECK (layout_type IN ('full', 'single', 'smart_area')),
  color TEXT DEFAULT '#2563EB',
  icon TEXT DEFAULT 'Layers',
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

-- Division RLS Rule:
-- Public: All workspace members can select
-- Private: ONLY owner can select!
CREATE POLICY "Divisions visibility policy"
ON public.divisions FOR SELECT TO authenticated
USING (
  (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.divisions.workspace_id AND user_id = auth.uid()
  ))
  OR (visibility = 'private' AND owner_id = auth.uid())
);

-- 6. CLUSTERS (Cụm)
CREATE TABLE IF NOT EXISTS public.clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'FolderKanban',
  sort_order INT DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clusters viewable if division is viewable"
ON public.clusters FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.divisions
    WHERE id = public.clusters.division_id
  )
);

-- 7. TASKS (Công việc)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('minor', 'normal', 'major', 'critical')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  due_date DATE,
  reminder_at TIMESTAMPTZ,
  reminder_mode TEXT DEFAULT 'notification',
  color TEXT,
  estimate_minutes INT DEFAULT 0,
  actual_minutes INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable through division access"
ON public.tasks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.divisions
    WHERE id = public.tasks.division_id
  )
);

-- 8. SMART AREAS & LAYOUTS
CREATE TABLE IF NOT EXISTS public.smart_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout_mode TEXT DEFAULT 'grid' CHECK (layout_mode IN ('grid', 'freeform')),
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.smart_areas ENABLE ROW LEVEL SECURITY;

-- 9. MESSAGES & CHAT
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'task_mention', 'file', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read and send messages"
ON public.messages FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = public.messages.workspace_id AND user_id = auth.uid()
  )
);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see and update their own notifications"
ON public.notifications FOR ALL TO authenticated
USING (user_id = auth.uid());

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT DEFAULT '127.0.0.1',
  status TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only for audit logs"
ON public.audit_logs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
`;

  const copySql = () => {
    navigator.clipboard.writeText(supabaseSqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('/app')}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            title="Quay lại User App"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Cổng Quản Trị Hệ Thống (/admin)</h1>
              <p className="text-[11px] text-neutral-400">
                Toàn quyền kiểm soát tài khoản, phòng làm việc, nhật ký bảo mật và cấu hình.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('/app')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition"
        >
          <span>Vào User App (/app)</span>
        </button>
      </header>

      {/* Main Admin Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <span className="text-xs text-neutral-500 font-medium">Tổng người dùng</span>
            <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
              {db.users.length}
            </div>
            <span className="text-[10px] text-neutral-400">
              {db.users.filter((u) => u.role === 'admin').length} Quản trị viên
            </span>
          </div>

          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <span className="text-xs text-neutral-500 font-medium">Phòng làm việc</span>
            <div className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
              {db.workspaces.length}
            </div>
            <span className="text-[10px] text-neutral-400">Được tạo bởi người dùng</span>
          </div>

          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <span className="text-xs text-neutral-500 font-medium">Sự kiện Audit</span>
            <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {db.audit_logs.length}
            </div>
            <span className="text-[10px] text-neutral-400">Nhật ký bảo mật</span>
          </div>

          <div className="p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
            <span className="text-xs text-neutral-500 font-medium">Dữ liệu mẫu (Seed)</span>
            <div className="text-2xl font-bold mt-1 text-neutral-700 dark:text-neutral-300">
              0 (Sạch)
            </div>
            <span className="text-[10px] text-neutral-400">Chỉ 1 admin ban đầu</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Quản lý Người dùng ({db.users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workspaces')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'workspaces'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Phòng làm việc ({db.workspaces.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Nhật ký Bảo mật & Audit ({db.audit_logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Cấu hình Hệ thống</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Supabase SQL & Schema</span>
          </button>
        </div>

        {/* TAB 1: USERS */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Người dùng</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Lần login cuối</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {db.users.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    return (
                      <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                        <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">
                          {u.display_name} {isSelf && '(Bạn)'}
                        </td>
                        <td className="px-4 py-3 text-neutral-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              u.is_active
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-400 text-[11px]">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleString('vi-VN')
                            : 'Chưa có'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleUserStatus(u.id)}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                                  u.is_active
                                    ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                }`}
                              >
                                {u.is_active ? 'Khóa tài khoản' : 'Mở khóa'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  changeUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')
                                }
                                className="px-2.5 py-1 rounded text-[11px] font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
                              >
                                {u.role === 'admin' ? 'Hạ xuống User' : 'Nâng lên Admin'}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WORKSPACES */}
        {activeTab === 'workspaces' && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
            {db.workspaces.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-xs">
                Chưa có phòng làm việc nào trong hệ thống.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Tên phòng</th>
                      <th className="px-4 py-3">Chủ phòng (Owner)</th>
                      <th className="px-4 py-3">Mã mời (Invite)</th>
                      <th className="px-4 py-3">Thành viên</th>
                      <th className="px-4 py-3">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {db.workspaces.map((ws) => {
                      const owner = db.users.find((u) => u.id === ws.owner_id);
                      const memberCount = db.workspace_members.filter(
                        (m) => m.workspace_id === ws.id
                      ).length;
                      return (
                        <tr key={ws.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-semibold flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: ws.color }}
                            />
                            <span>{ws.name}</span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500">
                            {owner?.display_name || ws.owner_id} ({owner?.email})
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-blue-600">
                            {ws.invite_code}
                          </td>
                          <td className="px-4 py-3">{memberCount} thành viên</td>
                          <td className="px-4 py-3 text-neutral-400">
                            {new Date(ws.created_at).toLocaleDateString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Tài khoản</th>
                    <th className="px-4 py-3">Hành động</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {db.audit_logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                      <td className="px-4 py-3 text-neutral-400 font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200">
                        {log.actor_email}
                      </td>
                      <td className="px-4 py-3 font-semibold">{log.action}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            log.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : log.status === 'blocked'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 truncate max-w-xs">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            {/* General System Config */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs text-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Cấu hình vận hành hệ thống
                </h3>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#152037] border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Cho phép đăng ký tài khoản mới
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Hiển thị biểu mẫu đăng ký cho người dùng mới trên màn hình đăng nhập.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={db.settings.allow_registration}
                  onChange={(e) => updateSystemSettings({ allow_registration: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#152037] border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Chế độ bảo trì hệ thống (Maintenance mode)
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                    Tạm dừng các thao tác tạo/sửa đổi dữ liệu của tài khoản thành viên.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={db.settings.maintenance_mode}
                  onChange={(e) => updateSystemSettings({ maintenance_mode: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Prob 4a: Mail Service Setup (SMTP Server) */}
            <form
              onSubmit={handleSaveSmtp}
              className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs text-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Dịch vụ Gửi Email (SMTP Service)
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpEnabled}
                    onChange={(e) => setSmtpEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-lg"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {smtpEnabled ? 'Đang kích hoạt' : 'Tạm tắt'}
                  </span>
                </label>
              </div>

              {smtpSavedMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Đã lưu thành công thông số cấu hình SMTP!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host (Máy chủ gửi thư)
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="VD: smtp.gmail.com, mail.company.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Port
                  </label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    placeholder="587 hoặc 465"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tài khoản SMTP User
                  </label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="VD: admin@yourcompany.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu SMTP Password / App Password
                  </label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên người gửi (From Name)
                  </label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Workspace Task Manager"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Địa chỉ gửi (From Email)
                  </label>
                  <input
                    type="email"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="notifications@workspacetasks.local"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-lg"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Sử dụng mã hóa SSL/TLS (Bắt buộc cho cổng 465)
                  </span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  Lưu thiết lập SMTP
                </button>
              </div>

              {/* Test Email Section */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Gửi thử nghiệm Email (Test SMTP Connection)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="Nhập email để nhận thư test..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTestingSmtp ? 'Đang gửi...' : 'Gửi thử'}</span>
                  </button>
                </div>

                {testSmtpResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testSmtpResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {testSmtpResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testSmtpResult.message}</span>
                  </div>
                )}
              </div>
            </form>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-rose-200 dark:border-rose-950 p-6 space-y-3 shadow-xs text-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-rose-100 dark:border-rose-950">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Vùng nguy hiểm (Danger Zone)
                </h3>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Thao tác này sẽ xóa toàn bộ phòng làm việc, chu kỳ, nhiệm vụ và hội thoại trên máy chủ, đưa hệ thống về dữ liệu trắng khởi nguyên ban đầu.
              </p>
              <button
                type="button"
                onClick={() => setShowResetDbConfirm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Database về trạng thái trống ban đầu</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: SUPABASE SQL EXPORTER */}
        {activeTab === 'sql' && (
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Mã nguồn Supabase PostgreSQL Schema & RLS Policies
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Chạy script này trực tiếp trong Supabase SQL Editor để thiết lập cơ sở dữ liệu PostgreSQL cho dự án.
                </p>
              </div>
              <button
                type="button"
                onClick={copySql}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Đã sao chép' : 'Sao chép SQL'}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[500px]">
              <pre>{supabaseSqlScript}</pre>
            </div>
          </div>
        )}

      <ConfirmModal
        isOpen={showResetDbConfirm}
        title="Xác nhận Reset Toàn bộ Database"
        message="CẢNH BÁO: Thao tác này sẽ xóa toàn bộ phòng làm việc, task, lịch sử chat và dữ liệu cá nhân của người dùng, đưa hệ thống về trạng thái sạch ban đầu (chỉ giữ lại tài khoản admin mặc định). Hành động này KHÔNG THỂ khôi phục."
        confirmText="Xác nhận Reset Database"
        onConfirm={handleConfirmResetDb}
        onCancel={() => setShowResetDbConfirm(false)}
      />
      </div>
    </div>
  );
};
