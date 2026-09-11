import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  UserProfile,
  UserRole,
  Workspace,
  WorkspaceMember,
  Period,
  Division,
  Cluster,
  Task,
  SmartArea,
  SmartAreaItem,
  ChatMessage,
  FileAttachment,
  AppNotification,
  ActivityLog,
  SystemAuditLog,
  SystemSetting,
  DivisionVisibility,
  DivisionLayoutType
} from '../types';
import { loadDatabase, saveDatabase, DatabaseState, resetToEmptyDatabase } from '../services/storage';
import { playAlarmSound, sendBrowserNotification } from '../services/alarm';

export type AppRoute =
  | '/login'
  | '/app'
  | '/admin'
  | '/admin/users'
  | '/admin/workspaces'
  | '/admin/logs'
  | '/admin/settings';

interface AppContextType {
  db: DatabaseState;
  currentUser: UserProfile | null;
  currentRoute: AppRoute;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  navigateTo: (route: AppRoute) => void;

  // Active Context Hierarchy
  activeWorkspace: Workspace | null;
  activePeriod: Period | null;
  activeDivision: Division | null;
  activeClusterId: string | null; // For single cluster view
  viewMode: DivisionLayoutType;
  setViewMode: (mode: DivisionLayoutType) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setActivePeriodId: (id: string | null) => void;
  setActiveDivisionId: (id: string | null) => void;
  setActiveClusterId: (id: string | null) => void;

  // Multi-select Task State
  selectedTaskIds: string[];
  selectTask: (id: string, multi?: boolean) => void;
  clearTaskSelection: () => void;
  toggleSelectAllInCluster: (clusterId: string) => void;

  // Filter & Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterAssignee: string;
  setFilterAssignee: (a: string) => void;
  filterPriority: string;
  setFilterPriority: (p: string) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;

  // UI Drawer states
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isNotificationOpen: boolean;
  setIsNotificationOpen: (open: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;

  // Staged task for chat
  stagedTaskForChat: Task | null;
  setStagedTaskForChat: (task: Task | null) => void;

  // Alarm state
  activeAlarmTask: Task | null;
  dismissAlarm: () => void;
  snoozeAlarm: (minutes: number) => void;

  // Preview modal
  previewAttachment: FileAttachment | null;
  setPreviewAttachment: (att: FileAttachment | null) => void;

  // Auth & Profile Operations
  login: (email: string, password?: string) => { success: boolean; message: string; role?: UserRole };
  signup: (email: string, displayName: string, password?: string) => { success: boolean; message: string };
  logout: () => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;

  // Task highlight & locate
  highlightedTaskId: string | null;
  locateTaskInWorkspace: (taskId: string) => void;

  // Workspace CRUD
  createWorkspace: (name: string, description?: string, icon?: string, color?: string) => Workspace;
  joinWorkspaceByCode: (inviteCode: string) => { success: boolean; message: string };
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  archiveWorkspace: (id: string) => void;

  // Period CRUD
  createPeriod: (data: Omit<Period, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Period;
  updatePeriod: (id: string, updates: Partial<Period>) => void;
  deletePeriod: (id: string) => void;

  // Division CRUD
  createDivision: (data: Omit<Division, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => Division;
  updateDivision: (id: string, updates: Partial<Division>) => void;
  deleteDivision: (id: string) => void;

  // Cluster CRUD
  createCluster: (data: Omit<Cluster, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Cluster;
  updateCluster: (id: string, updates: Partial<Cluster>) => void;
  deleteCluster: (id: string) => void;
  reorderClusters: (divisionId: string, orderedIds: string[]) => void;
  toggleClusterCollapse: (clusterId: string) => void;

  // Task CRUD & Interactions
  createTask: (data: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTaskCluster: (taskId: string, targetClusterId: string) => void;
  bulkMoveTasks: (taskIds: string[], targetClusterId: string) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  bulkRemindTasks: (taskIds: string[], reminderNote?: string) => void;
  toggleTaskComplete: (taskId: string) => void;

  // Smart Area
  updateSmartAreaItemPosition: (smartAreaId: string, clusterId: string, x: number, y: number, width?: number, height?: number) => void;

  // Chat & Attachments
  sendMessage: (content: string, taskId?: string | null, attachments?: FileAttachment[], receiverId?: string | null) => void;
  deleteMessage: (id: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationCount: number;

  // Admin Controls
  toggleUserStatus: (userId: string) => void;
  changeUserRole: (userId: string, newRole: UserRole) => void;
  updateSystemSettings: (newSettings: Partial<SystemSetting>) => void;
  resetDatabase: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<DatabaseState>(() => loadDatabase());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Check if there was a saved session
    const savedUserId = localStorage.getItem('wtm_session_user');
    if (savedUserId) {
      const found = db.users.find((u) => u.id === savedUserId && u.is_active);
      return found || null;
    }
    return null;
  });

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    return currentUser ? (currentUser.role === 'admin' ? '/admin' : '/app') : '/login';
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('wtm_theme') as 'light' | 'dark') || 'light';
  });

  // Hierarchy Selection State
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [activeDivisionId, setActiveDivisionId] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DivisionLayoutType>('full');

  // Task multi-selection
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [previewAttachment, setPreviewAttachment] = useState<FileAttachment | null>(null);
  const [stagedTaskForChat, setStagedTaskForChat] = useState<Task | null>(null);
  const [activeAlarmTask, setActiveAlarmTask] = useState<Task | null>(null);

  // Background Alarm Checker (Every 4 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const alarmTasks = db.tasks.filter((t) => {
        if (!t.alarm_enabled || !t.alarm_at || t.alarm_triggered || t.is_completed || t.is_archived) {
          return false;
        }
        const alarmTime = new Date(t.alarm_at).getTime();
        return !isNaN(alarmTime) && alarmTime <= now;
      });

      if (alarmTasks.length > 0) {
        const targetTask = alarmTasks[0];
        setActiveAlarmTask(targetTask);
        playAlarmSound();
        sendBrowserNotification(
          `Báo thức: ${targetTask.title}`,
          targetTask.display_due_text ? `Hạn chót: ${targetTask.display_due_text}` : 'Đã đến giờ hẹn công việc!'
        );

        // Mark as triggered so it won't fire continuously
        setDb((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === targetTask.id ? { ...t, alarm_triggered: true } : t)),
          notifications: [
            {
              id: `notif-${Date.now()}`,
              user_id: targetTask.assigned_to || targetTask.created_by,
              workspace_id: targetTask.workspace_id,
              task_id: targetTask.id,
              type: 'task_reminder',
              title: `Báo thức công việc: ${targetTask.title}`,
              body: targetTask.display_due_text ? `Hạn chót: ${targetTask.display_due_text}` : 'Đã đến giờ thực hiện task.',
              is_read: false,
              created_at: new Date().toISOString(),
            },
            ...prev.notifications,
          ],
        }));
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [db.tasks]);

  const dismissAlarm = () => {
    setActiveAlarmTask(null);
  };

  const snoozeAlarm = (minutes: number) => {
    if (!activeAlarmTask) return;
    const newAlarmTime = new Date(Date.now() + minutes * 60000).toISOString();
    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === activeAlarmTask.id
          ? {
              ...t,
              alarm_at: newAlarmTime,
              alarm_triggered: false,
              display_due_text: t.display_due_text || `Báo lại (+${minutes}p)`,
            }
          : t
      ),
    }));
    setActiveAlarmTask(null);
  };

  // Sync to localStorage
  useEffect(() => {
    saveDatabase(db);
  }, [db]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('wtm_session_user', currentUser.id);
    } else {
      localStorage.removeItem('wtm_session_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('wtm_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('wtm_theme', next);
      const root = document.documentElement;
      if (next === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
      return next;
    });
  };

  // Navigation Guard
  const navigateTo = (route: AppRoute) => {
    if (route.startsWith('/admin')) {
      if (!currentUser || currentUser.role !== 'admin') {
        // Access Denied handling
        logAudit(
          currentUser?.email || 'anonymous',
          'Truy cập trái phép Admin Route',
          '127.0.0.1',
          'blocked',
          `Bị chặn truy cập ${route} do không có quyền admin.`
        );
        alert('Truy cập bị từ chối: Chỉ Quản trị viên (Admin) mới có quyền truy cập trang này.');
        setCurrentRoute(currentUser ? '/app' : '/login');
        return;
      }
    }
    setCurrentRoute(route);
  };

  // Helper to log audit
  const logAudit = (
    actorEmail: string,
    action: string,
    ip: string,
    status: 'success' | 'failed' | 'blocked',
    details: string
  ) => {
    const newAudit: SystemAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor_email: actorEmail,
      action,
      ip_address: ip,
      status,
      details,
      created_at: new Date().toISOString(),
    };
    setDb((prev) => ({ ...prev, audit_logs: [newAudit, ...prev.audit_logs] }));
  };

  // Helper to log activity
  const logActivity = (
    workspaceId: string | undefined,
    actionType: string,
    entityType: ActivityLog['entity_type'],
    entityId: string,
    metadata?: Record<string, any>
  ) => {
    if (!currentUser) return;
    const log: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspace_id: workspaceId,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: new Date().toISOString(),
    };
    setDb((prev) => ({ ...prev, activity_logs: [log, ...prev.activity_logs] }));
  };

  // Auth Operations
  const login = (email: string, _password?: string) => {
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      logAudit(email, 'Đăng nhập thất bại', '127.0.0.1', 'failed', 'Tài khoản không tồn tại.');
      return { success: false, message: 'Email không tồn tại trong hệ thống.' };
    }
    if (!user.is_active) {
      logAudit(email, 'Đăng nhập bị từ chối', '127.0.0.1', 'blocked', 'Tài khoản đã bị khóa bởi admin.');
      return { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.' };
    }

    const updatedUser = { ...user, last_login_at: new Date().toISOString() };
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === user.id ? updatedUser : u)),
    }));
    setCurrentUser(updatedUser);

    logAudit(email, 'Đăng nhập thành công', '127.0.0.1', 'success', `Đăng nhập với vai trò ${user.role}.`);

    if (user.role === 'admin') {
      setCurrentRoute('/admin');
    } else {
      setCurrentRoute('/app');
    }
    return { success: true, message: 'Đăng nhập thành công!', role: user.role };
  };

  const signup = (email: string, displayName: string, _password?: string) => {
    if (!db.settings.allow_registration) {
      return { success: false, message: 'Hệ thống hiện đang tạm ngưng tiếp nhận đăng ký tài khoản mới.' };
    }
    const exists = db.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return { success: false, message: 'Email này đã được sử dụng. Vui lòng đăng nhập.' };
    }

    const newUser: UserProfile = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: email.trim().toLowerCase(),
      display_name: displayName.trim(),
      role: 'user', // Default is always regular user
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
    setCurrentUser(newUser);
    setCurrentRoute('/app');

    logAudit(newUser.email, 'Đăng ký tài khoản mới', '127.0.0.1', 'success', 'Tạo tài khoản user thường.');
    return { success: true, message: 'Đăng ký thành công! Chào mừng bạn.' };
  };

  const logout = () => {
    if (currentUser) {
      logAudit(currentUser.email, 'Đăng xuất', '127.0.0.1', 'success', 'Người dùng đăng xuất phiên làm việc.');
    }
    setCurrentUser(null);
    setActiveWorkspaceId(null);
    setActivePeriodId(null);
    setActiveDivisionId(null);
    setActiveClusterId(null);
    setCurrentRoute('/login');
  };

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    setCurrentUser(updatedUser);
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    }));
    logAudit(currentUser.email, 'Cập nhật hồ sơ cá nhân', '127.0.0.1', 'success', 'Cập nhật avatar/tên/thông tin');
  };

  // Task highlight & locate
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const locateTaskInWorkspace = (taskId: string) => {
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (currentRoute !== '/app') {
      setCurrentRoute('/app');
    }

    if (task.workspace_id && task.workspace_id !== activeWorkspaceId) {
      setActiveWorkspaceId(task.workspace_id);
    }

    if (task.division_id && task.division_id !== activeDivisionId) {
      setActiveDivisionId(task.division_id);
      const div = db.divisions.find((d) => d.id === task.division_id);
      if (div && div.period_id) {
        setActivePeriodId(div.period_id);
      }
    }

    if (task.cluster_id) {
      setActiveClusterId(task.cluster_id);
    }

    setHighlightedTaskId(taskId);

    // On mobile / narrow screens, auto-close chat so the user immediately sees the highlighted task
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsChatOpen(false);
    }

    setTimeout(() => {
      const el = document.getElementById(`task-card-${taskId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);

    setTimeout(() => {
      setHighlightedTaskId((prev) => (prev === taskId ? null : prev));
    }, 5000);
  };

  // Resolved active records
  const activeWorkspace = useMemo(() => {
    if (activeWorkspaceId) {
      const found = db.workspaces.find((w) => w.id === activeWorkspaceId && !w.is_archived);
      if (found) return found;
    }
    if (!currentUser) return null;
    // Fallback: First accessible workspace
    const first = db.workspaces.find((w) => {
      if (w.is_archived) return false;
      return (
        w.owner_id === currentUser.id ||
        db.workspace_members.some((m) => m.workspace_id === w.id && m.user_id === currentUser.id)
      );
    });
    return first || null;
  }, [activeWorkspaceId, db.workspaces, currentUser, db.workspace_members]);

  const activePeriod = useMemo(() => {
    if (!activeWorkspace) return null;
    if (activePeriodId) {
      const p = db.periods.find((x) => x.id === activePeriodId && x.workspace_id === activeWorkspace.id && !x.is_archived);
      if (p) return p;
    }
    // Fallback to first non-archived period in workspace
    const first = db.periods.find((x) => x.workspace_id === activeWorkspace.id && !x.is_archived);
    return first || null;
  }, [activeWorkspace, activePeriodId, db.periods]);

  const activeDivision = useMemo(() => {
    if (!activePeriod || !currentUser) return null;
    // Divisions for active period: either public, or owned by currentUser
    const allowedDivisions = db.divisions.filter(
      (d) =>
        d.period_id === activePeriod.id &&
        (d.visibility === 'public' || d.owner_id === currentUser.id)
    );

    if (activeDivisionId) {
      const d = allowedDivisions.find((x) => x.id === activeDivisionId);
      if (d) return d;
    }
    return allowedDivisions[0] || null;
  }, [activePeriod, activeDivisionId, currentUser, db.divisions]);

  // Keep viewMode synced when activeDivision changes
  useEffect(() => {
    if (activeDivision) {
      setViewMode(activeDivision.layout_type || 'full');
    }
  }, [activeDivision]);

  // Workspaces CRUD
  const createWorkspace = (name: string, description = '', icon = 'Briefcase', color = '#2563EB') => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'workspace';
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newWs: Workspace = {
      id: `ws-${Date.now()}`,
      owner_id: currentUser.id,
      name: name.trim(),
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      description: description.trim(),
      icon,
      color,
      invite_code: inviteCode,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newMember: WorkspaceMember = {
      id: `wsm-${Date.now()}`,
      workspace_id: newWs.id,
      user_id: currentUser.id,
      role_in_workspace: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      workspaces: [...prev.workspaces, newWs],
      workspace_members: [...prev.workspace_members, newMember],
    }));

    setActiveWorkspaceId(newWs.id);
    logActivity(newWs.id, 'Tạo Workspace', 'workspace', newWs.id, { name: newWs.name });
    return newWs;
  };

  const joinWorkspaceByCode = (inviteCode: string) => {
    if (!currentUser) return { success: false, message: 'Vui lòng đăng nhập' };
    const code = inviteCode.trim().toUpperCase();
    const ws = db.workspaces.find((w) => w.invite_code.toUpperCase() === code && !w.is_archived);
    if (!ws) {
      return { success: false, message: 'Mã mời không tồn tại hoặc đã hết hạn.' };
    }
    const alreadyMember = db.workspace_members.some((m) => m.workspace_id === ws.id && m.user_id === currentUser.id);
    if (alreadyMember) {
      setActiveWorkspaceId(ws.id);
      return { success: true, message: `Bạn đã là thành viên của ${ws.name}.` };
    }

    const member: WorkspaceMember = {
      id: `wsm-${Date.now()}`,
      workspace_id: ws.id,
      user_id: currentUser.id,
      role_in_workspace: 'member',
      status: 'active',
      joined_at: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      workspace_members: [...prev.workspace_members, member],
    }));

    setActiveWorkspaceId(ws.id);
    logActivity(ws.id, 'Tham gia phòng làm việc', 'member', currentUser.id);
    return { success: true, message: `Tham gia phòng làm việc "${ws.name}" thành công!` };
  };

  const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
    setDb((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((w) => (w.id === id ? { ...w, ...updates, updated_at: new Date().toISOString() } : w)),
    }));
    logActivity(id, 'Cập nhật Workspace', 'workspace', id, updates);
  };

  const archiveWorkspace = (id: string) => {
    setDb((prev) => ({
      ...prev,
      workspaces: prev.workspaces.map((w) => (w.id === id ? { ...w, is_archived: true, updated_at: new Date().toISOString() } : w)),
    }));
    if (activeWorkspaceId === id) setActiveWorkspaceId(null);
    logActivity(id, 'Lưu trữ Workspace', 'workspace', id);
  };

  const deleteWorkspace = (id: string) => {
    setDb((prev) => ({
      ...prev,
      workspaces: prev.workspaces.filter((w) => w.id !== id),
      workspace_members: prev.workspace_members.filter((m) => m.workspace_id !== id),
      periods: prev.periods.filter((p) => p.workspace_id !== id),
      divisions: prev.divisions.filter((d) => d.workspace_id !== id),
      clusters: prev.clusters.filter((c) => {
        const div = prev.divisions.find((d) => d.id === c.division_id);
        return div ? div.workspace_id !== id : true;
      }),
      tasks: prev.tasks.filter((t) => t.workspace_id !== id),
      messages: prev.messages.filter((m) => m.workspace_id !== id),
      notifications: prev.notifications.filter((n) => n.workspace_id !== id),
      activity_logs: prev.activity_logs.filter((l) => l.workspace_id !== id),
    }));
    if (activeWorkspaceId === id) setActiveWorkspaceId(null);
  };

  // Periods CRUD
  const createPeriod = (data: Omit<Period, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const newPeriod: Period = {
      ...data,
      id: `per-${Date.now()}`,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      periods: [...prev.periods, newPeriod],
    }));
    setActivePeriodId(newPeriod.id);
    logActivity(newPeriod.workspace_id, 'Tạo Period', 'period', newPeriod.id, { name: newPeriod.name });
    return newPeriod;
  };

  const updatePeriod = (id: string, updates: Partial<Period>) => {
    setDb((prev) => ({
      ...prev,
      periods: prev.periods.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p)),
    }));
  };

  const deletePeriod = (id: string) => {
    setDb((prev) => ({
      ...prev,
      periods: prev.periods.filter((p) => p.id !== id),
      divisions: prev.divisions.filter((d) => d.period_id !== id),
      tasks: prev.tasks.filter((t) => t.period_id !== id),
    }));
    if (activePeriodId === id) setActivePeriodId(null);
  };

  // Divisions CRUD
  const createDivision = (data: Omit<Division, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const newDiv: Division = {
      ...data,
      id: `div-${Date.now()}`,
      owner_id: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      divisions: [...prev.divisions, newDiv],
    }));
    setActiveDivisionId(newDiv.id);
    logActivity(newDiv.workspace_id, 'Tạo Division', 'division', newDiv.id, { name: newDiv.name, visibility: newDiv.visibility });
    return newDiv;
  };

  const updateDivision = (id: string, updates: Partial<Division>) => {
    setDb((prev) => ({
      ...prev,
      divisions: prev.divisions.map((d) => (d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d)),
    }));
  };

  const deleteDivision = (id: string) => {
    setDb((prev) => ({
      ...prev,
      divisions: prev.divisions.filter((d) => d.id !== id),
      clusters: prev.clusters.filter((c) => c.division_id !== id),
      tasks: prev.tasks.filter((t) => t.division_id !== id),
    }));
    if (activeDivisionId === id) setActiveDivisionId(null);
  };

  // Clusters CRUD
  const createCluster = (data: Omit<Cluster, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const newClus: Cluster = {
      ...data,
      id: `clu-${Date.now()}`,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      clusters: [...prev.clusters, newClus],
    }));
    return newClus;
  };

  const updateCluster = (id: string, updates: Partial<Cluster>) => {
    setDb((prev) => ({
      ...prev,
      clusters: prev.clusters.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c)),
    }));
  };

  const deleteCluster = (id: string) => {
    setDb((prev) => ({
      ...prev,
      clusters: prev.clusters.filter((c) => c.id !== id),
      tasks: prev.tasks.filter((t) => t.cluster_id !== id),
      smart_area_items: prev.smart_area_items.filter((item) => item.cluster_id !== id),
    }));
    if (activeClusterId === id) setActiveClusterId(null);
  };

  const reorderClusters = (divisionId: string, orderedIds: string[]) => {
    setDb((prev) => {
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
      return {
        ...prev,
        clusters: prev.clusters.map((c) => {
          if (c.division_id === divisionId && orderMap.has(c.id)) {
            return { ...c, sort_order: orderMap.get(c.id)! };
          }
          return c;
        }),
      };
    });
  };

  const toggleClusterCollapse = (clusterId: string) => {
    setDb((prev) => ({
      ...prev,
      clusters: prev.clusters.map((c) => (c.id === clusterId ? { ...c, is_collapsed: !c.is_collapsed } : c)),
    }));
  };

  // Tasks CRUD
  const createTask = (data: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const newTask: Task = {
      ...data,
      id: `tsk-${Date.now()}`,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }));
    logActivity(newTask.workspace_id, 'Tạo Task', 'task', newTask.id, { title: newTask.title });

    // Notify assignee if different
    if (newTask.assigned_to && newTask.assigned_to !== currentUser.id) {
      addNotification({
        user_id: newTask.assigned_to,
        workspace_id: newTask.workspace_id,
        task_id: newTask.id,
        type: 'task_assigned',
        title: 'Task mới được giao',
        body: `${currentUser.display_name} đã giao task "${newTask.title}" cho bạn.`,
      });
    }

    return newTask;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t)),
    }));
  };

  const deleteTask = (id: string) => {
    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
    setSelectedTaskIds((prev) => prev.filter((x) => x !== id));
  };

  const moveTaskCluster = (taskId: string, targetClusterId: string) => {
    const task = db.tasks.find((t) => t.id === taskId);
    const targetCluster = db.clusters.find((c) => c.id === targetClusterId);
    if (!task || !targetCluster) return;

    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              cluster_id: targetClusterId,
              division_id: targetCluster.division_id,
              updated_at: new Date().toISOString(),
            }
          : t
      ),
    }));

    logActivity(task.workspace_id, 'Di chuyển Task', 'task', taskId, {
      from: task.cluster_id,
      to: targetClusterId,
    });
  };

  const bulkMoveTasks = (taskIds: string[], targetClusterId: string) => {
    const targetCluster = db.clusters.find((c) => c.id === targetClusterId);
    if (!targetCluster) return;

    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        taskIds.includes(t.id)
          ? {
              ...t,
              cluster_id: targetClusterId,
              division_id: targetCluster.division_id,
              updated_at: new Date().toISOString(),
            }
          : t
      ),
    }));
    setSelectedTaskIds([]);
  };

  const bulkDeleteTasks = (taskIds: string[]) => {
    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => !taskIds.includes(t.id)),
    }));
    setSelectedTaskIds([]);
  };

  const bulkRemindTasks = (taskIds: string[], reminderNote = 'Nhắc nhở công việc') => {
    if (!currentUser) return;
    taskIds.forEach((tId) => {
      const task = db.tasks.find((t) => t.id === tId);
      if (task) {
        // If assigned, send notification to assignee, else to creator
        const recipient = task.assigned_to || task.created_by;
        addNotification({
          user_id: recipient,
          workspace_id: task.workspace_id,
          task_id: task.id,
          type: 'task_reminder',
          title: `Nhắc việc: ${task.title}`,
          body: `${currentUser.display_name}: ${reminderNote}`,
        });
      }
    });
    setSelectedTaskIds([]);
  };

  const toggleTaskComplete = (taskId: string) => {
    setDb((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              is_completed: !t.is_completed,
              status: !t.is_completed ? 'done' : 'todo',
              updated_at: new Date().toISOString(),
            }
          : t
      ),
    }));
  };

  // Multi-select Task helpers
  const selectTask = (id: string, multi = false) => {
    if (!multi) {
      setSelectedTaskIds([id]);
    } else {
      setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const clearTaskSelection = () => setSelectedTaskIds([]);

  const toggleSelectAllInCluster = (clusterId: string) => {
    const clusterTasks = db.tasks.filter((t) => t.cluster_id === clusterId && !t.is_archived);
    const clusterTaskIds = clusterTasks.map((t) => t.id);
    const allSelected = clusterTaskIds.every((id) => selectedTaskIds.includes(id));

    if (allSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !clusterTaskIds.includes(id)));
    } else {
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...clusterTaskIds])));
    }
  };

  // Smart Area
  const updateSmartAreaItemPosition = (
    smartAreaId: string,
    clusterId: string,
    x: number,
    y: number,
    width = 320,
    height = 420
  ) => {
    setDb((prev) => {
      const existing = prev.smart_area_items.find(
        (item) => item.smart_area_id === smartAreaId && item.cluster_id === clusterId
      );
      if (existing) {
        return {
          ...prev,
          smart_area_items: prev.smart_area_items.map((item) =>
            item.id === existing.id ? { ...item, x, y, width, height } : item
          ),
        };
      } else {
        const newItem: SmartAreaItem = {
          id: `sai-${Date.now()}`,
          smart_area_id: smartAreaId,
          cluster_id: clusterId,
          x,
          y,
          width,
          height,
          order_index: prev.smart_area_items.length,
          is_visible: true,
        };
        return {
          ...prev,
          smart_area_items: [...prev.smart_area_items, newItem],
        };
      }
    });
  };

  // Chat & Messaging
  const sendMessage = (
    content: string,
    taskId: string | null = null,
    attachments: FileAttachment[] = [],
    receiverId: string | null = null
  ) => {
    if (!currentUser || !activeWorkspace) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      workspace_id: activeWorkspace.id,
      sender_id: currentUser.id,
      receiver_id: receiverId || null,
      content: content.trim(),
      task_id: taskId,
      message_type: taskId ? 'task_mention' : attachments.length > 0 ? 'file' : 'text',
      created_at: new Date().toISOString(),
      attachments,
    };

    setDb((prev) => ({
      ...prev,
      messages: [...prev.messages, newMsg],
      attachments: [...prev.attachments, ...attachments],
    }));

    logActivity(
      activeWorkspace.id,
      receiverId ? 'Gửi tin nhắn riêng' : 'Gửi tin nhắn chat',
      'chat',
      newMsg.id
    );
  };

  const deleteMessage = (id: string) => {
    setDb((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => m.id !== id),
    }));
  };

  // Notifications
  const addNotification = (notif: Omit<AppNotification, 'id' | 'is_read' | 'created_at'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications],
    }));
  };

  const markNotificationRead = (id: string) => {
    setDb((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ),
    }));
  };

  const markAllNotificationsRead = () => {
    if (!currentUser) return;
    setDb((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.user_id === currentUser.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ),
    }));
  };

  const unreadNotificationCount = useMemo(() => {
    if (!currentUser) return 0;
    return db.notifications.filter((n) => n.user_id === currentUser.id && !n.is_read).length;
  }, [currentUser, db.notifications]);

  // Admin Controls
  const toggleUserStatus = (userId: string) => {
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id === userId) {
          const nextActive = !u.is_active;
          logAudit(
            currentUser?.email || 'admin',
            nextActive ? 'Kích hoạt tài khoản' : 'Khóa tài khoản',
            '127.0.0.1',
            'success',
            `Cập nhật trạng thái người dùng ${u.email} thành ${nextActive ? 'Hoạt động' : 'Đã khóa'}`
          );
          return { ...u, is_active: nextActive, updated_at: new Date().toISOString() };
        }
        return u;
      }),
    }));
  };

  const changeUserRole = (userId: string, newRole: UserRole) => {
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id === userId) {
          logAudit(
            currentUser?.email || 'admin',
            'Đổi quyền người dùng',
            '127.0.0.1',
            'success',
            `Đổi quyền của ${u.email} từ ${u.role} sang ${newRole}`
          );
          return { ...u, role: newRole, updated_at: new Date().toISOString() };
        }
        return u;
      }),
    }));
  };

  const updateSystemSettings = (newSettings: Partial<SystemSetting>) => {
    setDb((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings },
    }));
    logAudit(
      currentUser?.email || 'admin',
      'Cập nhật cấu hình hệ thống',
      '127.0.0.1',
      'success',
      JSON.stringify(newSettings)
    );
  };

  const resetDatabase = () => {
    const fresh = resetToEmptyDatabase();
    setDb(fresh);
    setCurrentUser(null);
    setCurrentRoute('/login');
  };

  return (
    <AppContext.Provider
      value={{
        db,
        currentUser,
        currentRoute,
        theme,
        toggleTheme,
        navigateTo,

        activeWorkspace,
        activePeriod,
        activeDivision,
        activeClusterId,
        viewMode,
        setViewMode,
        setActiveWorkspaceId,
        setActivePeriodId,
        setActiveDivisionId,
        setActiveClusterId,

        selectedTaskIds,
        selectTask,
        clearTaskSelection,
        toggleSelectAllInCluster,

        searchQuery,
        setSearchQuery,
        filterAssignee,
        setFilterAssignee,
        filterPriority,
        setFilterPriority,
        filterStatus,
        setFilterStatus,

        isChatOpen,
        setIsChatOpen,
        isNotificationOpen,
        setIsNotificationOpen,
        isSidebarOpen,
        setIsSidebarOpen,

        stagedTaskForChat,
        setStagedTaskForChat,
        activeAlarmTask,
        dismissAlarm,
        snoozeAlarm,

        previewAttachment,
        setPreviewAttachment,

        login,
        signup,
        logout,
        updateUserProfile,

        highlightedTaskId,
        locateTaskInWorkspace,

        createWorkspace,
        joinWorkspaceByCode,
        updateWorkspace,
        deleteWorkspace,
        archiveWorkspace,

        createPeriod,
        updatePeriod,
        deletePeriod,

        createDivision,
        updateDivision,
        deleteDivision,

        createCluster,
        updateCluster,
        deleteCluster,
        reorderClusters,
        toggleClusterCollapse,

        createTask,
        updateTask,
        deleteTask,
        moveTaskCluster,
        bulkMoveTasks,
        bulkDeleteTasks,
        bulkRemindTasks,
        toggleTaskComplete,

        updateSmartAreaItemPosition,

        sendMessage,
        deleteMessage,

        markNotificationRead,
        markAllNotificationsRead,
        unreadNotificationCount,

        toggleUserStatus,
        changeUserRole,
        updateSystemSettings,
        resetDatabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
