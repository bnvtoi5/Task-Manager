import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  UserProfile,
  UserRole,
  Workspace,
  WorkspaceMember,
  Period,
  Division,
  Cluster,
  Task,
  TaskPriority,
  SmartArea,
  SmartAreaItem,
  ChatMessage,
  FileAttachment,
  AppNotification,
  ActivityLog,
  SystemAuditLog,
  SystemSetting,
  DivisionVisibility,
  DivisionLayoutType,
  AppTheme,
  ChatGroup,
  DatabaseSnapshot,
  BoardMode,
  BoardModeCluster,
  RestorePoint,
  TaskChecklistItem,
  SessionDisplacedNotice,
} from '../types';
import { loadDatabase, saveDatabase, DatabaseState, resetToEmptyDatabase } from '../services/storage';
import { playAlarmSound, sendBrowserNotification } from '../services/alarm';
import { subscribeToFirestore, saveToFirestore } from '../services/firebase';
import { getWeekdayClusterId, getPriorityClusterId } from '../utils/boardModeUtils';
import { getClientDeviceInfo } from '../utils/device';

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
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  cycleTheme: () => void;
  toggleTheme: () => void;
  navigateTo: (route: AppRoute) => void;

  // Single active session displaced notification
  sessionNotice: SessionDisplacedNotice;
  dismissSessionNotice: () => void;

  // Custom Board Modes (Perspectives)
  activeBoardModeId: string;
  setActiveBoardModeId: (id: string) => void;
  createBoardMode: (
    name: string,
    description?: string,
    clusters?: BoardModeCluster[],
    targetDivisionId?: string
  ) => BoardMode;
  updateBoardMode: (modeId: string, updates: Partial<BoardMode>) => void;
  deleteBoardMode: (modeId: string) => void;
  addColumnToBoardMode: (modeId: string, columnName: string, color?: string) => void;
  updateBoardModeColumn: (modeId: string, columnId: string, name: string, color: string) => void;
  deleteBoardModeColumn: (modeId: string, columnId: string) => void;
  moveTaskInMode: (taskId: string, modeId: string, targetClusterId: string) => void;
  reorderTaskInMode: (sourceTaskId: string, targetTaskId: string, position: 'before' | 'after', modeId: string, targetClusterId: string) => void;

  // Firebase Cloud Sync
  firebaseStatus: 'connecting' | 'connected' | 'error';
  firebaseError: string | null;

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
  toggleSelectAllInCluster: (clusterId: string, taskIds?: string[]) => void;

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
  createDivision: (
    data: Omit<Division, 'id' | 'owner_id' | 'created_at' | 'updated_at'>
  ) => Division;
  updateDivision: (id: string, updates: Partial<Division>) => void;
  deleteDivision: (id: string) => void;

  // Cluster CRUD
  createCluster: (data: Omit<Cluster, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Cluster;
  updateCluster: (id: string, updates: Partial<Cluster>) => void;
  deleteCluster: (id: string) => void;
  reorderClusters: (divisionId: string, orderedIds: string[]) => void;
  toggleClusterCollapse: (clusterId: string) => void;
  collapsedClusterIds: string[];

  // Task CRUD & Interactions
  createTask: (data: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTaskCluster: (taskId: string, targetClusterId: string) => void;
  reorderTaskInCluster: (clusterId: string, sourceTaskId: string, targetTaskId: string, position?: 'before' | 'after') => void;
  moveTaskToEndOfCluster: (taskId: string, targetClusterId: string) => void;
  bulkMoveTasks: (taskIds: string[], targetClusterId: string, modeId?: string) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  bulkRemindTasks: (taskIds: string[], reminderNote?: string) => void;
  toggleTaskComplete: (taskId: string) => void;

  // Division multi-select & Copy/Paste
  selectedDivisionIds: string[];
  selectDivision: (id: string, multi?: boolean) => void;
  clearDivisionSelection: () => void;
  copiedDivisionIds: string[];
  copyDivisions: (divisionIds: string[]) => void;
  pasteDivisions: (targetPeriodId: string, options?: { inheritTasks?: boolean }) => void;

  // Task Copy/Paste & Duplicate
  copiedTaskIds: string[];
  copyTasks: (taskIds: string[]) => void;
  duplicateTasks: (taskIds: string[], targetClusterId?: string) => Task[];
  pasteTasks: (targetClusterId: string, options?: { inherit?: boolean; clearClipboard?: boolean }) => Task[];
  clearCopiedTasks: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Smart Area
  updateSmartAreaItemPosition: (smartAreaId: string, clusterId: string, x: number, y: number, width?: number, height?: number) => void;

  // Chat & Attachments
  activeChatGroupId: string | null;
  setActiveChatGroupId: (id: string | null) => void;
  createChatGroup: (name: string, category?: string, description?: string, iconColor?: string) => ChatGroup;
  deleteChatGroup: (id: string) => void;
  sendMessage: (content: string, taskId?: string | null, attachments?: FileAttachment[], receiverId?: string | null, groupId?: string | null) => void;
  deleteMessage: (id: string) => void;

  // Snapshots & Rollback
  recordRollbackCheckpoint: (name: string, description?: string, actionType?: string, customDbState?: DatabaseState) => RestorePoint;
  executeRollback: (pointOrSnapshotId: string, mode?: 'full' | 'selective', selectedDivisionIds?: string[]) => { success: boolean; message: string };
  clearAllRollbackPoints: () => void;
  createSnapshot: (name?: string, description?: string, autoGenerated?: boolean, divisionIdsToSave?: string[]) => DatabaseSnapshot;
  rollbackSnapshot: (snapshotId: string) => boolean;
  rollbackDivisionFromSnapshot: (snapshotId: string, divisionId: string) => { success: boolean; message: string };
  rollbackDivisionsFromSnapshot: (snapshotId: string, divisionIds: string[]) => { success: boolean; message: string };
  revertFromRestorePoint: (restorePointId: string) => { success: boolean; message: string };
  deleteRestorePoint: (restorePointId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  setSnapshotFrequency: (freq: 'daily' | '12h' | '6h' | 'hourly' | 'manual') => void;
  setAutoSnapshotExcludedDivisions: (excludedDivisionIds: string[]) => void;
  importSnapshotFromFile: (fileContent: string) => { success: boolean; message: string };

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
  const [firebaseStatus, setFirebaseStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const isIncomingRemoteUpdate = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single active session notice state
  const [sessionNotice, setSessionNotice] = useState<SessionDisplacedNotice>({
    isOpen: false,
  });
  const dismissSessionNotice = () => {
    setSessionNotice((prev) => ({ ...prev, isOpen: false }));
  };

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Check if there was a saved session
    const savedUserId = localStorage.getItem('wtm_session_user');
    const savedToken = localStorage.getItem('wtm_session_token');
    if (savedUserId) {
      const found = db.users.find((u) => u.id === savedUserId && u.is_active);
      if (found) {
        // If user record already has a session token and local token exists and mismatches, displace
        if (found.current_session_token && savedToken && found.current_session_token !== savedToken) {
          localStorage.removeItem('wtm_session_user');
          localStorage.removeItem('wtm_session_token');
          localStorage.removeItem('wtm_session_device');
          return null;
        }
        return found;
      }
    }
    return null;
  });

  const currentUserRef = useRef<UserProfile | null>(currentUser);
  currentUserRef.current = currentUser;

  // Function to kick out this machine when another machine logs into the same account
  const triggerDisplacedLogout = (reason?: string, newDevice?: string, loggedInAt?: string) => {
    console.warn('[Session Security] Đã ngắt kết nối phiên làm việc do đăng nhập trên thiết bị khác:', { reason, newDevice, loggedInAt });
    const userEmail = currentUserRef.current?.email || '';

    // Clear any pending debounced auto-save write to prevent overwriting remote database
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setSessionNotice({
      isOpen: true,
      userEmail,
      newDevice: newDevice || 'Thiết bị khác',
      loggedInAt: loggedInAt || new Date().toISOString(),
    });

    logAudit(
      userEmail || 'system',
      'Bị ngắt phiên đăng nhập',
      '127.0.0.1',
      'blocked',
      `Tài khoản vừa được đăng nhập trên một thiết bị khác (${newDevice || 'Thiết bị mới'}). Phiên làm việc trên máy này đã tự động kết thúc để tránh xung đột dữ liệu.`
    );

    localStorage.removeItem('wtm_session_user');
    localStorage.removeItem('wtm_session_token');
    localStorage.removeItem('wtm_session_device');
    setCurrentUser(null);
    setActiveWorkspaceId(null);
    setActivePeriodId(null);
    setActiveDivisionId(null);
    setActiveClusterId(null);
    setCurrentRoute('/login');
  };

  // Real-time synchronization with Firebase Firestore
  useEffect(() => {
    const unsubscribe = subscribeToFirestore(
      (remoteDb) => {
        isIncomingRemoteUpdate.current = true;
        setDb(remoteDb);
        // Also update local cache
        saveDatabase(remoteDb);

        // Security check: Check if current user on this machine was kicked out by another machine
        const localUserId = localStorage.getItem('wtm_session_user');
        const localToken = localStorage.getItem('wtm_session_token');
        if (localUserId && localToken && remoteDb.users) {
          const remoteUser = remoteDb.users.find((u) => u.id === localUserId);
          if (
            remoteUser &&
            remoteUser.current_session_token &&
            remoteUser.current_session_token !== localToken
          ) {
            triggerDisplacedLogout(
              'remote_takeover',
              remoteUser.last_login_device,
              remoteUser.last_login_at
            );
          }
        }

        setTimeout(() => {
          isIncomingRemoteUpdate.current = false;
        }, 150);
      },
      (status, errorMsg) => {
        setFirebaseStatus(status);
        if (errorMsg) {
          setFirebaseError(errorMsg);
        } else {
          setFirebaseError(null);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Heartbeat check: actively verify with server every 3.5s & on window focus to kick out instantly
  useEffect(() => {
    if (!currentUser) return;
    const localToken = localStorage.getItem('wtm_session_token');
    if (!localToken) return;

    let isMounted = true;

    const checkSessionWithServer = async () => {
      try {
        const res = await fetch(
          `/api/auth/check-session?userId=${encodeURIComponent(currentUser.id)}&sessionToken=${encodeURIComponent(localToken)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data && data.valid === false && data.reason === 'displaced') {
          triggerDisplacedLogout('server_check', data.newDevice, data.loggedInAt);
        }
      } catch {
        // Network lag; safely ignore
      }
    };

    const interval = setInterval(checkSessionWithServer, 3500);

    const handleFocus = () => {
      checkSessionWithServer();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentUser]);

  // Sync session across browser tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'wtm_session_user' || e.key === 'wtm_session_token') {
        const currentLocalUserId = localStorage.getItem('wtm_session_user');
        const currentLocalToken = localStorage.getItem('wtm_session_token');
        if (!currentLocalUserId || !currentLocalToken) {
          if (currentUserRef.current) {
            setCurrentUser(null);
            setCurrentRoute('/login');
          }
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Register existing session with server on initial mount
  useEffect(() => {
    if (currentUser) {
      const localToken = localStorage.getItem('wtm_session_token');
      if (localToken) {
        fetch('/api/auth/register-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            email: currentUser.email,
            sessionToken: localToken,
            device: localStorage.getItem('wtm_session_device') || getClientDeviceInfo(),
          }),
        }).catch(() => {});
      }
    }
  }, []);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    return currentUser ? (currentUser.role === 'admin' ? '/admin' : '/app') : '/login';
  });

  const [theme, setThemeState] = useState<AppTheme>(() => {
    // Migration: switch default to requested sepia warm-book paper theme
    const themeVersion = localStorage.getItem('wtm_theme_version');
    if (themeVersion !== 'sepia_v1') {
      localStorage.setItem('wtm_theme_version', 'sepia_v1');
      localStorage.setItem('wtm_theme', 'warm-book');
      return 'warm-book';
    }
    return (localStorage.getItem('wtm_theme') as AppTheme) || 'warm-book';
  });

  // Hierarchy Selection State
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [activeDivisionId, setActiveDivisionId] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DivisionLayoutType>('full');
  const [divisionBoardModes, setDivisionBoardModes] = useState<Record<string, string>>({});
  const [collapsedClusterIds, setCollapsedClusterIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wtm_collapsed_cluster_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Multi-select & Copy/Paste states
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [copiedTaskIds, setCopiedTaskIds] = useState<string[]>([]);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<string[]>([]);
  const [copiedDivisionIds, setCopiedDivisionIds] = useState<string[]>([]);
  const [activeChatGroupId, setActiveChatGroupId] = useState<string | null>(null);

  // Global Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

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

        // Calculate next recurring alarm if daily or weekly
        const repeat = targetTask.alarm_repeat;
        let nextAlarmAt: string | null = null;
        let willTriggerAgain = false;
        const currentAlarmMs = new Date(targetTask.alarm_at!).getTime();

        if (repeat === 'daily') {
          nextAlarmAt = new Date(currentAlarmMs + 86400000).toISOString();
          willTriggerAgain = true;
        } else if (repeat === 'weekly') {
          nextAlarmAt = new Date(currentAlarmMs + 7 * 86400000).toISOString();
          willTriggerAgain = true;
        }

        setDb((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => {
            if (t.id === targetTask.id) {
              return {
                ...t,
                alarm_at: willTriggerAgain && nextAlarmAt ? nextAlarmAt : t.alarm_at,
                alarm_triggered: willTriggerAgain ? false : true,
              };
            }
            // If child inherited task, follow parent alarm
            if (t.parent_task_id === targetTask.id && t.is_inherited) {
              return {
                ...t,
                alarm_at: willTriggerAgain && nextAlarmAt ? nextAlarmAt : t.alarm_at,
                alarm_triggered: willTriggerAgain ? false : true,
              };
            }
            return t;
          }),
          notifications: [
            {
              id: `notif-${Date.now()}`,
              user_id: targetTask.assigned_to || targetTask.created_by,
              workspace_id: targetTask.workspace_id,
              task_id: targetTask.id,
              type: 'task_reminder',
              title: `Báo thức công việc: ${targetTask.title}`,
              body: targetTask.display_due_text
                ? `Hạn chót: ${targetTask.display_due_text}${willTriggerAgain ? ' (Đã lên lịch lặp lại)' : ''}`
                : 'Đã đến giờ thực hiện task.',
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

  // Sync to localStorage and Firestore
  useEffect(() => {
    // Always persist to local cache immediately
    saveDatabase(db);

    // If change was incoming from remote Firestore snapshot, don't echo back
    if (isIncomingRemoteUpdate.current) {
      return;
    }

    // Debounce write to Firestore to optimize quota and avoid rate limits (1500ms batching)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveToFirestore(db).catch((err) => {
        console.warn('Không thể đồng bộ lên Firestore:', err);
      });
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [db]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('wtm_session_user', currentUser.id);
    } else {
      localStorage.removeItem('wtm_session_user');
    }
  }, [currentUser]);

  const applyThemeToDOM = (t: AppTheme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-warm-book', 'theme-pure-black', 'theme-neon');
    if (t === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (t === 'neon') {
      root.classList.add('dark', 'theme-neon');
      root.style.colorScheme = 'dark';
    } else if (t === 'warm-book') {
      root.classList.add('theme-warm-book');
      root.style.colorScheme = 'light';
    } else {
      root.style.colorScheme = 'light';
    }
  };

  useEffect(() => {
    localStorage.setItem('wtm_theme', theme);
    applyThemeToDOM(theme);
  }, [theme]);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
  };

  const THEMES: AppTheme[] = ['light', 'dark', 'warm-book', 'neon'];
  const cycleTheme = () => {
    setThemeState((prev) => {
      const idx = THEMES.indexOf(prev);
      return THEMES[(idx + 1) % THEMES.length];
    });
  };
  const toggleTheme = cycleTheme;

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
  const login = (email: string, password?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        (cleanEmail === 'admin' && (u.role === 'admin' || u.email.startsWith('admin')))
    );
    if (!user) {
      logAudit(email, 'Đăng nhập thất bại', '127.0.0.1', 'failed', 'Tài khoản không tồn tại.');
      return { success: false, message: 'Email hoặc tài khoản không tồn tại trong hệ thống.' };
    }
    if (!user.is_active) {
      logAudit(email, 'Đăng nhập bị từ chối', '127.0.0.1', 'blocked', 'Tài khoản đã bị khóa bởi admin.');
      return { success: false, message: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.' };
    }
    if (password && user.password && user.password !== password) {
      logAudit(email, 'Đăng nhập thất bại - Sai mật khẩu', '127.0.0.1', 'failed', 'Mật khẩu không đúng');
      return { success: false, message: 'Mật khẩu không chính xác.' };
    }

    // Dismiss any old displaced notice if user logs in
    setSessionNotice({ isOpen: false });

    // Generate unique session token for single-session enforcement
    const sessionToken =
      'sess_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substring(2, 10) +
      '_' +
      Math.random().toString(36).substring(2, 8);
    const deviceInfo = getClientDeviceInfo();

    const updatedUser: UserProfile = {
      ...user,
      last_login_at: new Date().toISOString(),
      current_session_token: sessionToken,
      last_login_device: deviceInfo,
    };

    localStorage.setItem('wtm_session_user', updatedUser.id);
    localStorage.setItem('wtm_session_token', sessionToken);
    localStorage.setItem('wtm_session_device', deviceInfo);

    // Register active session on server immediately
    fetch('/api/auth/register-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: updatedUser.id,
        email: updatedUser.email,
        sessionToken,
        device: deviceInfo,
      }),
    }).catch(() => {});

    setDb((prev) => {
      const updated = {
        ...prev,
        users: prev.users.map((u) => (u.id === user.id ? updatedUser : u)),
      };
      saveDatabase(updated);
      saveToFirestore(updated, true).catch(() => {}); // Write immediately to Firestore so other machines are kicked out in <500ms
      return updated;
    });
    setCurrentUser(updatedUser);

    logAudit(
      email,
      'Đăng nhập thành công',
      '127.0.0.1',
      'success',
      `Đăng nhập với vai trò ${user.role} trên ${deviceInfo}. Phiên cũ trên thiết bị khác sẽ tự động ngắt kết nối.`
    );

    if (user.role === 'admin') {
      setCurrentRoute('/admin');
    } else {
      setCurrentRoute('/app');
    }
    return { success: true, message: 'Đăng nhập thành công!', role: user.role };
  };

  const signup = (email: string, displayName: string, password?: string) => {
    if (!db.settings.allow_registration) {
      return { success: false, message: 'Hệ thống hiện đang tạm ngưng tiếp nhận đăng ký tài khoản mới.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    const exists = db.users.some((u) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, message: 'Email này đã được sử dụng. Vui lòng đăng nhập.' };
    }

    setSessionNotice({ isOpen: false });

    const sessionToken =
      'sess_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substring(2, 10) +
      '_' +
      Math.random().toString(36).substring(2, 8);
    const deviceInfo = getClientDeviceInfo();

    const newUser: UserProfile = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      display_name: displayName.trim(),
      password: password || '123456',
      avatar_url: '',
      role: 'user', // Default is always regular user
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      current_session_token: sessionToken,
      last_login_device: deviceInfo,
    };

    localStorage.setItem('wtm_session_user', newUser.id);
    localStorage.setItem('wtm_session_token', sessionToken);
    localStorage.setItem('wtm_session_device', deviceInfo);

    fetch('/api/auth/register-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: newUser.id,
        email: newUser.email,
        sessionToken,
        device: deviceInfo,
      }),
    }).catch(() => {});

    setDb((prev) => {
      const updated = {
        ...prev,
        users: [...prev.users, newUser],
      };
      saveDatabase(updated);
      saveToFirestore(updated, true).catch(() => {});
      return updated;
    });
    setCurrentUser(newUser);
    setCurrentRoute('/app');

    logAudit(newUser.email, 'Đăng ký tài khoản mới', '127.0.0.1', 'success', `Tạo tài khoản user thường trên ${deviceInfo}.`);
    return { success: true, message: 'Đăng ký thành công! Chào mừng bạn.' };
  };

  const logout = () => {
    const localToken = localStorage.getItem('wtm_session_token');
    if (currentUser && localToken) {
      fetch('/api/auth/invalidate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          sessionToken: localToken,
        }),
      }).catch(() => {});
    }

    if (currentUser) {
      logAudit(currentUser.email, 'Đăng xuất', '127.0.0.1', 'success', 'Người dùng đăng xuất phiên làm việc.');
    }
    localStorage.removeItem('wtm_session_user');
    localStorage.removeItem('wtm_session_token');
    localStorage.removeItem('wtm_session_device');
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
    if (first) return first;

    return null;
  }, [activeWorkspace, activePeriodId, db.periods]);

  const activeDivision = useMemo(() => {
    if (!currentUser || !activeWorkspace || !activePeriod) return null;
    const wsId = activeWorkspace.id;
    const pId = activePeriod.id;
    // Divisions for active workspace & period: either public, or owned by currentUser
    const allowedDivisions = db.divisions.filter(
      (d) =>
        d.workspace_id === wsId &&
        (!d.period_id || d.period_id === pId) &&
        (d.visibility === 'public' || d.owner_id === currentUser.id)
    );

    if (activeDivisionId) {
      const d = allowedDivisions.find((x) => x.id === activeDivisionId);
      if (d) return d;
    }

    if (allowedDivisions.length > 0) {
      return allowedDivisions[0];
    }

    return null;
  }, [activeWorkspace, activePeriod, activeDivisionId, currentUser, db.divisions]);

  // Active Board Mode scoped per Division
  const activeBoardModeId = useMemo(() => {
    const divId = activeDivision?.id;
    if (!divId) return '';
    if (divisionBoardModes[divId]) {
      const exists = (db.board_modes || []).some(
        (m) => m.id === divisionBoardModes[divId] && m.division_id === divId
      );
      if (exists) return divisionBoardModes[divId];
    }
    const divModes = (db.board_modes || []).filter((m) => m.division_id === divId);
    if (divModes.length > 0) {
      return divModes[0].id;
    }
    return '';
  }, [activeDivision?.id, divisionBoardModes, db.board_modes]);

  const setActiveBoardModeId = (id: string) => {
    const divId = activeDivision?.id;
    if (divId) {
      setDivisionBoardModes((prev) => ({
        ...prev,
        [divId]: id,
      }));
    }
  };

  // Only sync viewMode when division ID actually changes to another division, preventing drag & drop from resetting user's view
  const previousDivisionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeDivision && activeDivision.id !== previousDivisionIdRef.current) {
      previousDivisionIdRef.current = activeDivision.id;
      if (activeDivision.layout_type) {
        const rawType = activeDivision.layout_type as string;
        setViewMode(rawType === 'smart_area' ? 'full' : (rawType as DivisionLayoutType));
      }
    }
  }, [activeDivision?.id]);

  // Workspaces CRUD
  const createWorkspace = (name: string, description = '', icon = 'Briefcase', color = '#2563EB') => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'workspace';
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now();

    const newWs: Workspace = {
      id: `ws-${timestamp}`,
      owner_id: currentUser.id,
      name: name.trim(),
      slug: `${slug}-${timestamp.toString().slice(-4)}`,
      description: description.trim(),
      icon,
      color,
      invite_code: inviteCode,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newMember: WorkspaceMember = {
      id: `wsm-${timestamp}`,
      workspace_id: newWs.id,
      user_id: currentUser.id,
      role_in_workspace: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    };

    // Auto-create default initial Period for the new workspace
    const newPeriod: Period = {
      id: `p-${timestamp}`,
      workspace_id: newWs.id,
      name: 'Chu kỳ 1',
      type: 'month',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(timestamp + 30 * 86400000).toISOString().split('T')[0],
      timezone: 'Asia/Ho_Chi_Minh',
      color: '#3b82f6',
      sort_order: 1,
      is_archived: false,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-create default Division for the new workspace
    const newDivision: Division = {
      id: `div-${timestamp}`,
      workspace_id: newWs.id,
      period_id: newPeriod.id,
      owner_id: currentUser.id,
      name: 'Chung',
      description: 'Phân chia mặc định',
      visibility: 'public',
      layout_type: 'full',
      color: '#3B82F6',
      icon: 'Layers',
      sort_order: 1,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-create default Clusters for this division
    const defaultClusters: Cluster[] = [
      {
        id: `clu-${timestamp}-1`,
        division_id: newDivision.id,
        name: 'Cụm 1',
        description: 'Chờ xử lý',
        color: '#6366F1',
        icon: 'folder',
        sort_order: 1,
        is_collapsed: false,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `clu-${timestamp}-2`,
        division_id: newDivision.id,
        name: 'Cụm 2',
        description: 'Đang thực hiện',
        color: '#3B82F6',
        icon: 'folder',
        sort_order: 2,
        is_collapsed: false,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `clu-${timestamp}-3`,
        division_id: newDivision.id,
        name: 'Cụm 3',
        description: 'Hoàn thành',
        color: '#10B981',
        icon: 'folder',
        sort_order: 3,
        is_collapsed: false,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    setDb((prev) => {
      const updated: DatabaseState = {
        ...prev,
        workspaces: [...prev.workspaces, newWs],
        workspace_members: [...prev.workspace_members, newMember],
        periods: [...prev.periods, newPeriod],
        divisions: [...prev.divisions, newDivision],
        clusters: [...prev.clusters, ...defaultClusters],
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    setActiveWorkspaceId(newWs.id);
    setActivePeriodId(newPeriod.id);
    setActiveDivisionId(newDivision.id);
    setActiveClusterId(null);
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

  // Automatic Rollback Checkpoint Engine
  const recordRollbackCheckpoint = (
    name: string,
    description?: string,
    actionType: string = 'general',
    customDbState?: DatabaseState
  ): RestorePoint => {
    const baseState = customDbState || db;
    const wsId = activeWorkspaceId;
    const ws = baseState.workspaces.find((w) => w.id === wsId);

    // CRITICAL: Scope strictly to the CURRENT workspace/room (phòng hiện tại)
    // NEVER save or include other rooms' data in the rollback checkpoint!
    const workspaceDivisions = (baseState.divisions || []).filter((d) => !wsId || d.workspace_id === wsId);
    const allowedDivisions = workspaceDivisions.filter((d) => {
      if (d.visibility === 'public') return true;
      if (d.visibility === 'private' && currentUser && d.owner_id === currentUser.id) return true;
      return false;
    });

    const targetDivisionIdSet = new Set(allowedDivisions.map((d) => d.id));
    const periodIdSet = new Set(allowedDivisions.map((d) => d.period_id).filter(Boolean));
    const savedPeriods = (baseState.periods || []).filter(
      (p) => periodIdSet.has(p.id) || (wsId && p.workspace_id === wsId)
    );
    const savedClusters = (baseState.clusters || []).filter((c) => targetDivisionIdSet.has(c.division_id));
    const savedClusterIdSet = new Set(savedClusters.map((c) => c.id));
    const savedTasks = (baseState.tasks || []).filter((t) => targetDivisionIdSet.has(t.division_id));
    const savedBoardModes = (baseState.board_modes || []).filter(
      (m) => m.division_id && targetDivisionIdSet.has(m.division_id)
    );
    const savedSmartAreaItems = (baseState.smart_area_items || []).filter((item) =>
      savedClusterIdSet.has(item.cluster_id)
    );
    const savedWorkspaces = wsId ? baseState.workspaces.filter((w) => w.id === wsId) : baseState.workspaces;

    const scopedStateToSave: DatabaseState = {
      ...baseState,
      workspaces: savedWorkspaces,
      periods: savedPeriods,
      divisions: allowedDivisions,
      clusters: savedClusters,
      tasks: savedTasks,
      board_modes: savedBoardModes,
      smart_area_items: savedSmartAreaItems,
    };

    const tasksCount = savedTasks.length;
    const divisionsCount = allowedDivisions.length;
    const clustersCount = savedClusters.length;

    const newPoint: RestorePoint = {
      id: `rb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workspace_id: wsId || null,
      name,
      description:
        description ||
        `Trạng thái tự động trước thao tác (${tasksCount} công việc, ${divisionsCount} phân chia tại ${ws?.name || 'phòng hiện tại'})`,
      action_type: actionType,
      created_by: currentUser?.id || 'system',
      created_by_name: currentUser?.display_name || 'Hệ thống',
      created_at: new Date().toISOString(),
      stats: {
        tasks_count: tasksCount,
        clusters_count: clustersCount,
        divisions_count: divisionsCount,
      },
      data_state: JSON.stringify(scopedStateToSave),
    };

    setDb((prev) => {
      const prevPoints = prev.restore_points || [];
      const updatedPoints = [newPoint, ...prevPoints.slice(0, 59)];
      const updated: DatabaseState = {
        ...prev,
        restore_points: updatedPoints,
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    return newPoint;
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
  const createDivision = (
    data: Omit<Division, 'id' | 'owner_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const timestamp = Date.now();
    const newDivId = `div-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Resolve workspace_id
    const targetWsId = data.workspace_id || activeWorkspaceId || db.workspaces[0]?.id || 'ws-default';
    
    // Resolve period_id for this workspace
    let targetPeriodId = data.period_id;
    const wsPeriod = db.periods.find((p) => p.workspace_id === targetWsId && !p.is_archived);
    let autoPeriodToCreate: Period | null = null;

    if (!targetPeriodId || !db.periods.some((p) => p.id === targetPeriodId && p.workspace_id === targetWsId)) {
      if (wsPeriod) {
        targetPeriodId = wsPeriod.id;
      } else {
        targetPeriodId = `p-${timestamp}`;
        autoPeriodToCreate = {
          id: targetPeriodId,
          workspace_id: targetWsId,
          name: 'Chu kỳ 1',
          type: 'month',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(timestamp + 30 * 86400000).toISOString().split('T')[0],
          timezone: 'Asia/Ho_Chi_Minh',
          color: '#3b82f6',
          sort_order: 1,
          is_archived: false,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    }

    const newDiv: Division = {
      ...data,
      id: newDivId,
      workspace_id: targetWsId,
      period_id: targetPeriodId,
      owner_id: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Auto-create 3 default clusters for this division
    const defaultClusters: Cluster[] = [
      {
        id: `clu-${timestamp}-1`,
        division_id: newDivId,
        name: 'Cụm 1',
        description: 'Chờ xử lý',
        color: '#6366F1',
        icon: 'folder',
        sort_order: 1,
        is_collapsed: false,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `clu-${timestamp}-2`,
        division_id: newDivId,
        name: 'Cụm 2',
        description: 'Đang thực hiện',
        color: '#3B82F6',
        icon: 'folder',
        sort_order: 2,
        is_collapsed: false,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `clu-${timestamp}-3`,
        division_id: newDivId,
        name: 'Cụm 3',
        description: 'Hoàn thành',
        color: '#10B981',
        icon: 'folder',
        sort_order: 3,
        is_collapsed: false,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    setDb((prev) => {
      const updated: DatabaseState = {
        ...prev,
        periods: autoPeriodToCreate ? [...prev.periods, autoPeriodToCreate] : prev.periods,
        divisions: [...prev.divisions, newDiv],
        clusters: [...prev.clusters, ...defaultClusters],
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    setActiveWorkspaceId(targetWsId);
    setActivePeriodId(targetPeriodId);
    setActiveDivisionId(newDiv.id);
    setActiveClusterId(null);
    logActivity(newDiv.workspace_id, 'Tạo Division', 'division', newDiv.id, {
      name: newDiv.name,
      visibility: newDiv.visibility,
    });
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
      board_modes: (prev.board_modes || []).filter((m) => m.division_id !== id),
    }));
    setDivisionBoardModes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
    setCollapsedClusterIds((prev) => {
      const next = prev.includes(clusterId)
        ? prev.filter((id) => id !== clusterId)
        : [...prev, clusterId];
      try {
        localStorage.setItem('wtm_collapsed_cluster_ids', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    setDb((prev) => {
      const updatedClusters = prev.clusters.map((c) =>
        c.id === clusterId ? { ...c, is_collapsed: !c.is_collapsed } : c
      );
      const updatedBoardModes = (prev.board_modes || []).map((bm) => ({
        ...bm,
        clusters: (bm.clusters || []).map((c) =>
          c.id === clusterId ? { ...c, is_collapsed: !c.is_collapsed } : c
        ),
      }));
      return {
        ...prev,
        clusters: updatedClusters,
        board_modes: updatedBoardModes,
      };
    });
  };

  // Tasks CRUD
  const createTask = (data: Omit<Task, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const wsId = data.workspace_id || activeWorkspace?.id || activeWorkspaceId || db.workspaces[0]?.id || 'ws-default';
    const divId = data.division_id || activeDivision?.id || db.divisions.find((d) => d.workspace_id === wsId)?.id || `div-default-${wsId}`;
    const perId = data.period_id || activePeriod?.id || db.periods.find((p) => p.workspace_id === wsId)?.id || `per-default-${wsId}`;

    let cluId = data.cluster_id;
    if (!cluId) {
      const existingClu = db.clusters.find((c) => c.division_id === divId);
      cluId = existingClu ? existingClu.id : `clu-default-${divId}`;
    }

    // Auto-resolve and preserve mode_clusters for all relevant Board Modes
    const initialModeClusters: Record<string, string> = { ...(data.mode_clusters || {}) };
    const divBoardModes = (db.board_modes || []).filter(
      (m) => m.division_id === divId || m.is_preset
    );

    for (const bm of divBoardModes) {
      if (!initialModeClusters[bm.id]) {
        const colMatch = (bm.clusters || []).find((c) => c.id === cluId);
        if (colMatch) {
          initialModeClusters[bm.id] = colMatch.id;
        } else {
          const cluObj = db.clusters.find((c) => c.id === cluId);
          if (cluObj) {
            const nameMatch = (bm.clusters || []).find(
              (c) => c.name.toLowerCase() === cluObj.name.toLowerCase()
            );
            if (nameMatch) {
              initialModeClusters[bm.id] = nameMatch.id;
            }
          }
        }
      }
    }

    // Ensure cluster_id points to a valid division cluster if cluId was a mode-specific column
    let canonicalCluId = cluId;
    const isCluInDb = db.clusters.some((c) => c.id === cluId && c.division_id === divId);
    if (!isCluInDb) {
      const existingDivClu = db.clusters.find((c) => c.division_id === divId);
      if (existingDivClu) {
        canonicalCluId = existingDivClu.id;
      }
    }

    const newTask: Task = {
      ...data,
      workspace_id: wsId,
      period_id: perId,
      division_id: divId,
      cluster_id: canonicalCluId,
      mode_clusters: initialModeClusters,
      id: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setDb((prev) => {
      // Check for rapid accidental duplicate task creation (same title, workspace, and cluster created < 3s ago)
      const existingRecent = prev.tasks.find(
        (t) =>
          t.title.trim().toLowerCase() === newTask.title.trim().toLowerCase() &&
          t.workspace_id === wsId &&
          t.cluster_id === cluId &&
          Date.now() - new Date(t.created_at).getTime() < 3000
      );
      if (existingRecent) {
        return prev;
      }

      let newDivisions = prev.divisions;
      if (!newDivisions.some((d) => d.id === divId)) {
        const fallbackDiv: Division = {
          id: divId,
          workspace_id: wsId,
          period_id: perId,
          name: 'Phân chia chung',
          description: 'Phân chia tự động tạo',
          visibility: 'public',
          layout_type: 'full',
          color: '#4F46E5',
          icon: 'Layers',
          sort_order: 0,
          is_default: true,
          owner_id: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        newDivisions = [...newDivisions, fallbackDiv];
      }

      let newClusters = prev.clusters;
      if (!newClusters.some((c) => c.id === cluId)) {
        const fallbackClu: Cluster = {
          id: cluId,
          division_id: divId,
          name: 'Cụm 1',
          description: '',
          color: '#6366F1',
          icon: 'Folder',
          sort_order: 0,
          is_collapsed: false,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        newClusters = [...newClusters, fallbackClu];
      }

      const updated = {
        ...prev,
        divisions: newDivisions,
        clusters: newClusters,
        tasks: [...prev.tasks, newTask],
      };
      saveDatabase(updated);
      saveToFirestore(updated);
      return updated;
    });

    const currentDiv = db.divisions.find((d) => d.id === newTask.division_id);
    logActivity(newTask.workspace_id, 'Tạo Task', 'task', newTask.id, {
      title: newTask.title,
      division_id: newTask.division_id,
      is_private: currentDiv?.visibility === 'private',
      division_owner_id: currentDiv?.owner_id,
    });

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
    setDb((prev) => {
      const existing = prev.tasks.find((t) => t.id === id);
      if (!existing) return prev;

      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };

      // Collect field updates to sync to child tasks with inheritance turned on
      const syncKeys: (keyof Task)[] = [
        'title',
        'description',
        'priority',
        'severity',
        'status',
        'due_date',
        'display_due_text',
        'alarm_enabled',
        'alarm_at',
        'alarm_time',
        'alarm_repeat',
        'checklists',
        'tags',
        'color',
        'estimate_minutes',
        'actual_minutes',
        'is_completed',
        'is_archived',
      ];
      const diff: Partial<Task> = {};
      for (const k of syncKeys) {
        if (k in updates) {
          (diff as any)[k] = updates[k];
        }
      }

      return {
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (t.id === id) {
            return updated;
          }
          // If t inherits from this task and inheritance is active, sync content (keeping its own division, cluster, sort_order)
          if (t.parent_task_id === id && t.is_inherited) {
            return {
              ...t,
              ...diff,
              updated_at: new Date().toISOString(),
            };
          }
          return t;
        }),
      };
    });
  };

  const reorderTaskInCluster = (
    clusterId: string,
    sourceTaskId: string,
    targetTaskId: string,
    position: 'before' | 'after' = 'before'
  ) => {
    setDb((prev) => {
      const targetCluster = prev.clusters.find((c) => c.id === clusterId);
      if (!targetCluster) return prev;

      const clusterTasks = prev.tasks
        .filter((t) => t.cluster_id === clusterId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const sourceIdx = clusterTasks.findIndex((t) => t.id === sourceTaskId);
      const targetIdx = clusterTasks.findIndex((t) => t.id === targetTaskId);

      if (sourceIdx === -1) {
        // Task is coming from another cluster
        const movedTask = prev.tasks.find((t) => t.id === sourceTaskId);
        if (!movedTask) return prev;

        const updatedMovedTask: Task = {
          ...movedTask,
          cluster_id: clusterId,
          division_id: targetCluster.division_id,
          updated_at: new Date().toISOString(),
        };

        const otherTasks = clusterTasks.filter((t) => t.id !== sourceTaskId);
        const insertIdx = targetIdx === -1 ? otherTasks.length : position === 'after' ? targetIdx + 1 : targetIdx;
        otherTasks.splice(insertIdx, 0, updatedMovedTask);

        const newOrderMap = new Map(otherTasks.map((t, idx) => [t.id, idx]));
        return {
          ...prev,
          tasks: prev.tasks.map((t) => {
            if (t.id === sourceTaskId) {
              return { ...updatedMovedTask, sort_order: newOrderMap.get(t.id) ?? 0 };
            }
            if (newOrderMap.has(t.id)) {
              return { ...t, sort_order: newOrderMap.get(t.id)! };
            }
            return t;
          }),
        };
      }

      // Reordering within same cluster
      const reordered = [...clusterTasks];
      const [removed] = reordered.splice(sourceIdx, 1);
      const newTargetIdx = reordered.findIndex((t) => t.id === targetTaskId);
      const insertIdx = newTargetIdx === -1 ? reordered.length : position === 'after' ? newTargetIdx + 1 : newTargetIdx;
      reordered.splice(insertIdx, 0, removed);

      const orderMap = new Map(reordered.map((t, idx) => [t.id, idx]));
      return {
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (orderMap.has(t.id)) {
            return { ...t, sort_order: orderMap.get(t.id)! };
          }
          return t;
        }),
      };
    });
  };

  const moveTaskToEndOfCluster = (taskId: string, targetClusterId: string) => {
    setDb((prev) => {
      const targetCluster = prev.clusters.find((c) => c.id === targetClusterId);
      if (!targetCluster) return prev;

      const clusterTasks = prev.tasks
        .filter((t) => t.cluster_id === targetClusterId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const maxOrder = clusterTasks.length > 0 ? Math.max(...clusterTasks.map((t) => t.sort_order ?? 0)) + 1 : 0;

      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                cluster_id: targetClusterId,
                division_id: targetCluster.division_id,
                sort_order: maxOrder,
                updated_at: new Date().toISOString(),
              }
            : t
        ),
      };
    });
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

    const currentDiv = db.divisions.find((d) => d.id === task.division_id);
    logActivity(task.workspace_id, 'Di chuyển Task', 'task', taskId, {
      from: task.cluster_id,
      to: targetClusterId,
      division_id: task.division_id,
      is_private: currentDiv?.visibility === 'private',
      division_owner_id: currentDiv?.owner_id,
    });
  };

  const bulkMoveTasks = (taskIds: string[], targetClusterId: string, modeId?: string) => {
    if (!taskIds.length || !targetClusterId) return;
    const currentMode = modeId || activeBoardModeId || '';

    setDb((prev) => {
      const targetCluster = prev.clusters.find((c) => c.id === targetClusterId);
      const targetDivisionId = targetCluster?.division_id || activeDivision?.id;

      const updatedTasks = prev.tasks.map((t) => {
        if (!taskIds.includes(t.id)) return t;

        const updatedTask = {
          ...t,
          cluster_id: targetClusterId,
          updated_at: new Date().toISOString(),
        };

        if (targetDivisionId) {
          updatedTask.division_id = targetDivisionId;
        }

        if (currentMode === 'priority') {
          let p: TaskPriority = 'medium';
          if (targetClusterId === 'pr-urgent') p = 'urgent';
          else if (targetClusterId === 'pr-high') p = 'high';
          else if (targetClusterId === 'pr-medium') p = 'medium';
          else if (targetClusterId === 'pr-low') p = 'low';

          updatedTask.priority = p;
          updatedTask.mode_clusters = {
            ...(updatedTask.mode_clusters || {}),
            priority: targetClusterId,
          };
        } else if (currentMode === 'weekday') {
          updatedTask.mode_clusters = {
            ...(updatedTask.mode_clusters || {}),
            weekday: targetClusterId,
          };
        } else if (currentMode) {
          updatedTask.mode_clusters = {
            ...(updatedTask.mode_clusters || {}),
            [currentMode]: targetClusterId,
          };
        }

        return updatedTask;
      });

      const updated = {
        ...prev,
        tasks: updatedTasks,
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

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

  const toggleSelectAllInCluster = (clusterId: string, taskIds?: string[]) => {
    let targetIds: string[];
    if (taskIds && taskIds.length > 0) {
      targetIds = taskIds;
    } else {
      const clusterTasks = db.tasks.filter((t) => t.cluster_id === clusterId && !t.is_archived);
      targetIds = clusterTasks.map((t) => t.id);
    }
    const allSelected = targetIds.length > 0 && targetIds.every((id) => selectedTaskIds.includes(id));

    if (allSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !targetIds.includes(id)));
    } else {
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...targetIds])));
    }
  };

  // Custom Board Modes (Perspectives)
  const createBoardMode = (
    name: string,
    description = '',
    clusters: BoardModeCluster[] = [],
    targetDivisionId?: string
  ) => {
    const divId = targetDivisionId || activeDivision?.id;
    if (!divId) {
      throw new Error('Chưa chọn Division. Bắt buộc phải có Division để tạo chế độ bảng.');
    }
    const timestamp = Date.now();
    const finalClusters: BoardModeCluster[] =
      clusters.length > 0
        ? clusters.map((c, idx) => ({
            id: c.id || `c-${timestamp}-${idx + 1}`,
            name: c.name || `Cột ${idx + 1}`,
            color: c.color || (idx === 0 ? '#6366F1' : idx === 1 ? '#F59E0B' : idx === 2 ? '#8B5CF6' : '#10B981'),
            sort_order: c.sort_order ?? idx + 1,
          }))
        : [
            { id: `c-${timestamp}-1`, name: 'Cần làm', color: '#6366F1', sort_order: 1 },
            { id: `c-${timestamp}-2`, name: 'Đang làm', color: '#F59E0B', sort_order: 2 },
            { id: `c-${timestamp}-3`, name: 'Kiểm thử', color: '#8B5CF6', sort_order: 3 },
            { id: `c-${timestamp}-4`, name: 'Hoàn thành', color: '#10B981', sort_order: 4 },
          ];

    const newMode: BoardMode = {
      id: `bm-${timestamp}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: description.trim(),
      is_preset: false,
      division_id: divId,
      clusters: finalClusters,
    };

    setDb((prev) => {
      const updated = {
        ...prev,
        board_modes: [...(prev.board_modes || []), newMode],
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    setActiveBoardModeId(newMode.id);
    return newMode;
  };

  const updateBoardMode = (modeId: string, updates: Partial<BoardMode>) => {
    setDb((prev) => ({
      ...prev,
      board_modes: (prev.board_modes || []).map((m) =>
        m.id === modeId ? { ...m, ...updates } : m
      ),
    }));
  };

  const deleteBoardMode = (modeId: string) => {
    setDb((prev) => ({
      ...prev,
      board_modes: (prev.board_modes || []).filter((m) => m.id !== modeId),
    }));
    if (activeBoardModeId === modeId) {
      const remaining = (db.board_modes || []).filter(
        (m) => m.id !== modeId && activeDivision && m.division_id === activeDivision.id
      );
      setActiveBoardModeId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const updateBoardModeColumn = (modeId: string, columnId: string, name: string, color: string) => {
    setDb((prev) => ({
      ...prev,
      board_modes: (prev.board_modes || []).map((m) => {
        if (m.id === modeId) {
          return {
            ...m,
            clusters: (m.clusters || []).map((c) =>
              c.id === columnId ? { ...c, name: name.trim(), color } : c
            ),
          };
        }
        return m;
      }),
    }));
  };

  const deleteBoardModeColumn = (modeId: string, columnId: string) => {
    setDb((prev) => ({
      ...prev,
      board_modes: (prev.board_modes || []).map((m) => {
        if (m.id === modeId) {
          return {
            ...m,
            clusters: (m.clusters || []).filter((c) => c.id !== columnId),
          };
        }
        return m;
      }),
    }));
  };

  const addColumnToBoardMode = (modeId: string, columnName: string, color = '#6366F1') => {
    setDb((prev) => {
      const modes = prev.board_modes || [];
      return {
        ...prev,
        board_modes: modes.map((m) => {
          if (m.id === modeId) {
            const newCluster: BoardModeCluster = {
              id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: columnName.trim(),
              color,
              sort_order: (m.clusters?.length || 0) + 1,
            };
            return {
              ...m,
              clusters: [...(m.clusters || []), newCluster],
            };
          }
          return m;
        }),
      };
    });
  };

  const reorderTaskInMode = (
    sourceTaskId: string,
    targetTaskId: string,
    position: 'before' | 'after',
    modeId: string,
    targetClusterId: string
  ) => {
    setDb((prev) => {
      const sourceTask = prev.tasks.find((t) => t.id === sourceTaskId);
      if (!sourceTask) return prev;

      const isKanban = modeId === 'kanban';
      const targetCluster = prev.clusters.find((c) => c.id === targetClusterId);

      // Get all tasks in this target cluster for this mode (excluding sourceTask)
      const otherTasksInCluster = prev.tasks
        .filter((t) => {
          if (t.id === sourceTaskId || t.is_archived) return false;
          if (t.division_id !== sourceTask.division_id) return false;

          let inCluster = false;
          if (t.mode_clusters && t.mode_clusters[modeId]) {
            inCluster = t.mode_clusters[modeId] === targetClusterId;
          } else if (isKanban) {
            inCluster = t.cluster_id === targetClusterId;
          } else if (modeId === 'weekday') {
            inCluster = getWeekdayClusterId(t.due_date) === targetClusterId;
          } else if (modeId === 'priority') {
            inCluster = getPriorityClusterId(t.priority) === targetClusterId;
          } else {
            const currentMode = prev.board_modes?.find((m) => m.id === modeId);
            inCluster = currentMode?.clusters?.[0]?.id === targetClusterId;
          }
          return inCluster;
        })
        .sort((a, b) => {
          const orderA = (modeId && a.mode_sort_orders?.[modeId] !== undefined)
            ? a.mode_sort_orders[modeId]
            : (a.sort_order ?? 0);
          const orderB = (modeId && b.mode_sort_orders?.[modeId] !== undefined)
            ? b.mode_sort_orders[modeId]
            : (b.sort_order ?? 0);
          return orderA - orderB;
        });

      // Determine insertion index
      let insertIdx = otherTasksInCluster.length;
      if (targetTaskId) {
        const targetIdx = otherTasksInCluster.findIndex((t) => t.id === targetTaskId);
        if (targetIdx !== -1) {
          insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
        }
      }

      const updatedModeClusters = {
        ...(sourceTask.mode_clusters || {}),
        [modeId]: targetClusterId,
      };

      let updatedPriority = sourceTask.priority;
      if (modeId === 'priority') {
        if (targetClusterId === 'pr-urgent') updatedPriority = 'urgent';
        else if (targetClusterId === 'pr-high') updatedPriority = 'high';
        else if (targetClusterId === 'pr-medium') updatedPriority = 'medium';
        else if (targetClusterId === 'pr-low') updatedPriority = 'low';
      }

      const updatedSourceTask: Task = {
        ...sourceTask,
        cluster_id: isKanban && targetCluster ? targetClusterId : sourceTask.cluster_id,
        division_id: isKanban && targetCluster ? targetCluster.division_id : sourceTask.division_id,
        priority: updatedPriority,
        mode_clusters: updatedModeClusters,
        updated_at: new Date().toISOString(),
      };

      otherTasksInCluster.splice(insertIdx, 0, updatedSourceTask);

      // Normalize sort orders cleanly
      const orderMap = new Map<string, number>();
      otherTasksInCluster.forEach((t, idx) => {
        orderMap.set(t.id, idx);
      });

      return {
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (orderMap.has(t.id)) {
            const newOrder = orderMap.get(t.id)!;
            const newModeSortOrders = {
              ...(t.mode_sort_orders || {}),
              [modeId]: newOrder,
            };
            if (t.id === sourceTaskId) {
              return {
                ...updatedSourceTask,
                sort_order: isKanban ? newOrder : t.sort_order,
                mode_sort_orders: newModeSortOrders,
              };
            }
            return {
              ...t,
              sort_order: isKanban ? newOrder : t.sort_order,
              mode_sort_orders: newModeSortOrders,
            };
          }
          return t;
        }),
      };
    });
  };

  const moveTaskInMode = (taskId: string, modeId: string, targetClusterId: string) => {
    reorderTaskInMode(taskId, '', 'after', modeId, targetClusterId);
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

  // Division Selection & Copy/Paste
  const selectDivision = (id: string, multi = false) => {
    if (!multi) {
      setSelectedDivisionIds([id]);
    } else {
      setSelectedDivisionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  const clearDivisionSelection = () => {
    setSelectedDivisionIds([]);
  };

  const copyDivisions = (divisionIds: string[]) => {
    setCopiedDivisionIds(divisionIds);
  };

  const pasteDivisions = (targetPeriodId: string, options = { inheritTasks: false }) => {
    if (copiedDivisionIds.length === 0) return;
    const targetPeriod = db.periods.find((p) => p.id === targetPeriodId);
    if (!targetPeriod) return;

    setDb((prev) => {
      const newDivisions: Division[] = [];
      const newClusters: Cluster[] = [];
      const newTasks: Task[] = [];

      copiedDivisionIds.forEach((divId) => {
        const sourceDiv = prev.divisions.find((d) => d.id === divId);
        if (!sourceDiv) return;

        const newDivId = `div-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const clonedDiv: Division = {
          ...sourceDiv,
          id: newDivId,
          period_id: targetPeriodId,
          workspace_id: targetPeriod.workspace_id,
          name: `${sourceDiv.name} (Bản sao)`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        newDivisions.push(clonedDiv);

        // Copy clusters
        const sourceClusters = prev.clusters.filter((c) => c.division_id === divId);
        sourceClusters.forEach((cl) => {
          const newClusterId = `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const clonedCluster: Cluster = {
            ...cl,
            id: newClusterId,
            division_id: newDivId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          newClusters.push(clonedCluster);

          // Copy tasks
          const sourceTasks = prev.tasks.filter((t) => t.cluster_id === cl.id);
          sourceTasks.forEach((tsk) => {
            const newTaskId = `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const clonedTask: Task = {
              ...tsk,
              id: newTaskId,
              workspace_id: targetPeriod.workspace_id,
              period_id: targetPeriodId,
              division_id: newDivId,
              cluster_id: newClusterId,
              parent_task_id: options.inheritTasks ? tsk.id : undefined,
              is_inherited: !!options.inheritTasks,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            newTasks.push(clonedTask);
          });
        });
      });

      return {
        ...prev,
        divisions: [...prev.divisions, ...newDivisions],
        clusters: [...prev.clusters, ...newClusters],
        tasks: [...prev.tasks, ...newTasks],
      };
    });

    logActivity(targetPeriod.workspace_id, 'Dán Division', 'division', targetPeriodId, {
      count: copiedDivisionIds.length,
      inherit: options.inheritTasks,
    });
  };

  // Task Copy/Paste & Duplicate
  const copyTasks = (taskIds: string[]) => {
    if (!taskIds || taskIds.length === 0) return;
    setCopiedTaskIds(taskIds);

    // Also write structured text summary to system clipboard for convenience
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        const matching = db.tasks.filter((t) => taskIds.includes(t.id));
        if (matching.length > 0) {
          const text = matching
            .map((t, idx) => {
              const checkCount = t.checklists?.length
                ? ` [${t.checklists.filter((c) => c.completed).length}/${t.checklists.length} việc]`
                : '';
              const prio = t.priority ? ` (${t.priority.toUpperCase()})` : '';
              return `${idx + 1}. ${t.title}${prio}${checkCount}${t.description ? `\n   ${t.description}` : ''}`;
            })
            .join('\n\n');
          navigator.clipboard.writeText(text).catch(() => {});
        }
      }
    } catch {
      // Ignore clipboard write errors
    }
  };

  const clearCopiedTasks = () => {
    setCopiedTaskIds([]);
  };

  const duplicateTasks = (taskIds: string[], targetClusterId?: string): Task[] => {
    if (!taskIds || taskIds.length === 0) return [];
    const createdTasks: Task[] = [];
    let activityWsId = activeWorkspaceId || activeWorkspace?.id;

    setDb((prev) => {
      const newTasks: Task[] = [];

      taskIds.forEach((tId) => {
        const sourceTask = prev.tasks.find((t) => t.id === tId);
        if (!sourceTask) return;

        const effectiveClusterId = targetClusterId || sourceTask.cluster_id;
        const targetCluster = prev.clusters.find((c) => c.id === effectiveClusterId);
        const effectiveDivisionId = targetCluster?.division_id || sourceTask.division_id;
        const targetDiv = prev.divisions.find((d) => d.id === effectiveDivisionId);
        const effectiveWorkspaceId = targetDiv?.workspace_id || sourceTask.workspace_id;
        activityWsId = effectiveWorkspaceId;

        // Position: place right after sourceTask if in same cluster, else at end of cluster
        let newSortOrder = (sourceTask.sort_order ?? 0) + 1;
        if (targetClusterId && targetClusterId !== sourceTask.cluster_id) {
          const destTasks = prev.tasks.filter((t) => t.cluster_id === targetClusterId && !t.is_archived);
          const maxSort = destTasks.length > 0 ? Math.max(...destTasks.map((t) => t.sort_order ?? 0)) : 0;
          newSortOrder = maxSort + 1;
        }

        const newTaskId = `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        // Deep clone checklists with unique IDs
        const clonedChecklists: TaskChecklistItem[] = (sourceTask.checklists || []).map((item) => ({
          id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          text: item.text,
          completed: item.completed,
        }));

        const baseTitle = sourceTask.title.includes('(Bản sao)')
          ? sourceTask.title
          : `${sourceTask.title} (Bản sao)`;

        const clonedTask: Task = {
          ...sourceTask,
          id: newTaskId,
          workspace_id: effectiveWorkspaceId,
          period_id: targetDiv?.period_id || sourceTask.period_id,
          division_id: effectiveDivisionId,
          cluster_id: effectiveClusterId,
          sort_order: newSortOrder,
          title: baseTitle,
          checklists: clonedChecklists,
          tags: [...(sourceTask.tags || [])],
          alarm_triggered: false,
          parent_task_id: undefined,
          is_inherited: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        newTasks.push(clonedTask);
        createdTasks.push(clonedTask);
      });

      const updated = {
        ...prev,
        tasks: [...prev.tasks, ...newTasks],
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    if (activityWsId) {
      logActivity(activityWsId, 'Nhân bản Task', 'task', targetClusterId || 'current', {
        count: createdTasks.length,
      });
    }

    return createdTasks;
  };

  const pasteTasks = (
    targetClusterId: string,
    options: { inherit?: boolean; clearClipboard?: boolean } = { inherit: false, clearClipboard: false }
  ): Task[] => {
    if (copiedTaskIds.length === 0) return [];

    let targetCluster = db.clusters.find((c) => c.id === targetClusterId);
    let targetDivisionId = targetCluster?.division_id || activeDivision?.id;
    let targetWorkspaceId = activeWorkspace?.id || activeWorkspaceId || db.workspaces[0]?.id;
    let targetPeriodId = activePeriod?.id || activeDivision?.period_id || db.periods[0]?.id;

    if (!targetCluster && activeBoardModeId) {
      const mode = (db.board_modes || []).find((m) => m.id === activeBoardModeId);
      const modeCol = mode?.clusters?.find((c) => c.id === targetClusterId);
      if (modeCol) {
        targetDivisionId = mode.division_id || activeDivision?.id;
      }
    }

    if (!targetDivisionId && activeDivision) {
      targetDivisionId = activeDivision.id;
    }
    const targetDiv = db.divisions.find((d) => d.id === targetDivisionId);
    if (targetDiv) {
      targetWorkspaceId = targetDiv.workspace_id;
      targetPeriodId = targetDiv.period_id;
    }

    const createdTasks: Task[] = [];

    setDb((prev) => {
      const existingClusterTasks = prev.tasks.filter((t) => t.cluster_id === targetClusterId && !t.is_archived);
      let maxSort = existingClusterTasks.length > 0 ? Math.max(...existingClusterTasks.map((t) => t.sort_order ?? 0)) : 0;

      copiedTaskIds.forEach((tId) => {
        const sourceTask = prev.tasks.find((t) => t.id === tId);
        if (!sourceTask) return;

        maxSort += 1;
        const newTaskId = `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const clonedChecklists: TaskChecklistItem[] = (sourceTask.checklists || []).map((item) => ({
          id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          text: item.text,
          completed: item.completed,
        }));

        const updatedModeClusters = {
          ...(sourceTask.mode_clusters || {}),
        };
        if (activeBoardModeId) {
          updatedModeClusters[activeBoardModeId] = targetClusterId;
        }

        const titleText = options.inherit
          ? sourceTask.title
          : (sourceTask.title.includes('(Sao chép)') || sourceTask.title.includes('(Bản sao)')
              ? sourceTask.title
              : `${sourceTask.title} (Sao chép)`);

        const clonedTask: Task = {
          ...sourceTask,
          id: newTaskId,
          workspace_id: targetWorkspaceId || sourceTask.workspace_id,
          period_id: targetPeriodId || sourceTask.period_id,
          division_id: targetDivisionId || sourceTask.division_id,
          cluster_id: targetClusterId,
          sort_order: maxSort,
          parent_task_id: options.inherit ? sourceTask.id : undefined,
          is_inherited: !!options.inherit,
          title: titleText,
          checklists: clonedChecklists,
          tags: [...(sourceTask.tags || [])],
          alarm_triggered: false,
          mode_clusters: updatedModeClusters,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        createdTasks.push(clonedTask);
      });

      const updated = {
        ...prev,
        tasks: [...prev.tasks, ...createdTasks],
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    if (options.clearClipboard) {
      setCopiedTaskIds([]);
    }

    if (targetWorkspaceId) {
      logActivity(targetWorkspaceId, 'Dán Task', 'task', targetClusterId, {
        count: createdTasks.length,
        inherit: !!options.inherit,
      });
    }

    return createdTasks;
  };

  // Chat Groups
  const createChatGroup = (name: string, category?: string, description?: string, iconColor?: string) => {
    if (!currentUser) throw new Error('Yêu cầu đăng nhập');
    const newGroup: ChatGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspace_id: activeWorkspaceId || '',
      name: name.trim(),
      category: category?.trim() || 'Hạng mục chung',
      description: description?.trim(),
      icon_color: iconColor || '#3b82f6',
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
    };
    setDb((prev) => ({
      ...prev,
      chat_groups: [...(prev.chat_groups || []), newGroup],
    }));
    return newGroup;
  };

  const deleteChatGroup = (id: string) => {
    setDb((prev) => ({
      ...prev,
      chat_groups: (prev.chat_groups || []).filter((g) => g.id !== id),
      messages: prev.messages.filter((m) => m.group_id !== id),
    }));
    if (activeChatGroupId === id) {
      setActiveChatGroupId(null);
    }
  };

  // Database Snapshots & Rollback
  const createSnapshot = (
    name?: string,
    description?: string,
    autoGenerated = false,
    divisionIdsToSave?: string[]
  ) => {
    const wsId = activeWorkspaceId || db.workspaces[0]?.id || null;
    const defaultName =
      name ||
      `Bản sao lưu ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

    // Get all divisions for this room
    const workspaceDivisions = db.divisions.filter((d) => !wsId || d.workspace_id === wsId);

    // Allowed divisions for current user:
    // 1. All public divisions in this workspace
    // 2. All private divisions owned by current user (NEVER take private divisions of other users)
    const allowedDivisions = workspaceDivisions.filter((d) => {
      if (d.visibility === 'public') return true;
      if (d.visibility === 'private' && currentUser && d.owner_id === currentUser.id) return true;
      return false;
    });

    let targetDivisions: Division[];
    if (divisionIdsToSave && divisionIdsToSave.length > 0) {
      // User explicitly selected divisions to save (constrained strictly to allowed divisions)
      const allowedSet = new Set(allowedDivisions.map((d) => d.id));
      targetDivisions = allowedDivisions.filter((d) => divisionIdsToSave.includes(d.id) && allowedSet.has(d.id));
    } else if (autoGenerated) {
      // Auto snapshot mode: all allowed divisions except user-excluded ones
      const excludedSet = new Set(db.settings?.auto_snapshot_excluded_division_ids || []);
      targetDivisions = allowedDivisions.filter((d) => !excludedSet.has(d.id));
    } else {
      // Default: all allowed divisions (public + own private)
      targetDivisions = allowedDivisions;
    }

    const targetDivisionIdSet = new Set(targetDivisions.map((d) => d.id));

    // Save periods associated with these divisions
    const periodIdSet = new Set(targetDivisions.map((d) => d.period_id).filter(Boolean));
    const savedPeriods = db.periods.filter((p) => periodIdSet.has(p.id) || (wsId && p.workspace_id === wsId));

    // Filter clusters, tasks, modes strictly to target divisions
    const savedClusters = db.clusters.filter((c) => targetDivisionIdSet.has(c.division_id));
    const savedClusterIdSet = new Set(savedClusters.map((c) => c.id));
    const savedTasks = db.tasks.filter((t) => targetDivisionIdSet.has(t.division_id));
    const savedBoardModes = (db.board_modes || []).filter(
      (m) => m.division_id && targetDivisionIdSet.has(m.division_id)
    );
    const savedSmartAreaItems = (db.smart_area_items || []).filter((item) =>
      savedClusterIdSet.has(item.cluster_id)
    );

    const savedWorkspaces = wsId ? db.workspaces.filter((w) => w.id === wsId) : db.workspaces;

    const savedState: DatabaseState = {
      ...db,
      workspaces: savedWorkspaces,
      periods: savedPeriods,
      divisions: targetDivisions,
      clusters: savedClusters,
      tasks: savedTasks,
      board_modes: savedBoardModes,
      smart_area_items: savedSmartAreaItems,
    };

    const snapshot: DatabaseSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspace_id: wsId,
      name: defaultName,
      description:
        description ||
        (autoGenerated ? 'Sao lưu tự động theo lịch định kỳ' : 'Sao lưu thủ công của người dùng'),
      created_by: currentUser?.id || 'system',
      created_by_name: currentUser?.display_name || 'Hệ thống',
      created_at: new Date().toISOString(),
      auto_generated: autoGenerated,
      saved_division_ids: targetDivisions.map((d) => d.id),
      saved_division_names: targetDivisions.map((d) => d.name),
      stats: {
        workspaces_count: wsId ? 1 : db.workspaces.length,
        periods_count: db.periods.filter((p) => !wsId || p.workspace_id === wsId).length,
        divisions_count: targetDivisions.length,
        clusters_count: savedClusters.length,
        tasks_count: savedTasks.length,
        completed_tasks_count: savedTasks.filter((t) => t.is_completed).length,
      },
      data_state: JSON.stringify(savedState),
    };

    setDb((prev) => {
      const allSnapshots = [snapshot, ...(prev.snapshots || []).slice(0, 49)];
      const updated = {
        ...prev,
        snapshots: allSnapshots,
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });

    return snapshot;
  };

  // Universal Rollback Engine
  const executeRollback = (
    pointOrSnapshotId: string,
    mode: 'full' | 'selective' = 'full',
    selectedDivisionIds?: string[]
  ): { success: boolean; message: string } => {
    const restorePoint = (db.restore_points || []).find((r) => r.id === pointOrSnapshotId);
    const snapshot = (db.snapshots || []).find((s) => s.id === pointOrSnapshotId);
    const source = restorePoint || snapshot;

    if (!source) {
      return { success: false, message: 'Không tìm thấy điểm rollback hoặc bản sao lưu.' };
    }

    try {
      const parsed = JSON.parse(source.data_state) as DatabaseState;
      const targetWsId = source.workspace_id || activeWorkspaceId;
      const targetWs = (db.workspaces || []).find((w) => w.id === targetWsId);
      const targetWsName = targetWs?.name || 'phòng hiện tại';

      // Automatically create a SAFETY Checkpoint of current DB before applying rollback, scoped strictly to targetWsId!
      const currentWsDivs = (db.divisions || []).filter((d) => !targetWsId || d.workspace_id === targetWsId);
      const currentWsDivIdSet = new Set(currentWsDivs.map((d) => d.id));
      const currentWsClusters = (db.clusters || []).filter((c) => currentWsDivIdSet.has(c.division_id));
      const currentWsClusterIdSet = new Set(currentWsClusters.map((c) => c.id));
      const currentWsTasks = (db.tasks || []).filter((t) => currentWsDivIdSet.has(t.division_id));
      const currentWsPeriods = (db.periods || []).filter((p) => !targetWsId || p.workspace_id === targetWsId);
      const currentWsBoardModes = (db.board_modes || []).filter((m) => m.division_id && currentWsDivIdSet.has(m.division_id));
      const currentWsSmartAreas = (db.smart_area_items || []).filter((item) => currentWsClusterIdSet.has(item.cluster_id));

      const scopedSafetyDb: DatabaseState = {
        ...db,
        workspaces: targetWsId ? (db.workspaces || []).filter((w) => w.id === targetWsId) : db.workspaces,
        periods: currentWsPeriods,
        divisions: currentWsDivs,
        clusters: currentWsClusters,
        tasks: currentWsTasks,
        board_modes: currentWsBoardModes,
        smart_area_items: currentWsSmartAreas,
      };

      const safetyPoint: RestorePoint = {
        id: `rb-safety-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        workspace_id: targetWsId || null,
        name: `Điểm an toàn trước khi Rollback về "${source.name}"`,
        description: `Tự động lưu trạng thái phòng ${targetWsName} trước khi khôi phục để bạn có thể hoàn tác bất cứ lúc nào`,
        action_type: 'safety',
        created_by: currentUser?.id || 'system',
        created_by_name: currentUser?.display_name || 'Hệ thống',
        created_at: new Date().toISOString(),
        stats: {
          tasks_count: currentWsTasks.length,
          clusters_count: currentWsClusters.length,
          divisions_count: currentWsDivs.length,
        },
        data_state: JSON.stringify(scopedSafetyDb),
      };

      const updatedRestorePoints = [safetyPoint, ...(db.restore_points || [])].slice(0, 60);

      // CRITICAL: KEEP ALL OTHER ROOMS (PHÒNG KHÁC) 100% UNTOUCHED!
      // Other rooms' divisions, clusters, tasks, periods, board modes will NEVER be modified or erased!
      const isOtherDivision = (d: Division) => Boolean(targetWsId && d.workspace_id && d.workspace_id !== targetWsId);
      const otherDivisions = (db.divisions || []).filter(isOtherDivision);
      const otherDivisionIdSet = new Set(otherDivisions.map((d) => d.id));
      const otherClusters = (db.clusters || []).filter((c) => otherDivisionIdSet.has(c.division_id));
      const otherClusterIdSet = new Set(otherClusters.map((c) => c.id));
      const otherTasks = (db.tasks || []).filter((t) => otherDivisionIdSet.has(t.division_id));
      const otherPeriods = (db.periods || []).filter((p) => Boolean(targetWsId && p.workspace_id && p.workspace_id !== targetWsId));
      const otherBoardModes = (db.board_modes || []).filter((m) => m.division_id && otherDivisionIdSet.has(m.division_id));
      const otherSmartAreaItems = (db.smart_area_items || []).filter((item) => otherClusterIdSet.has(item.cluster_id));

      if (mode === 'full') {
        // Also preserve private divisions owned by other users in THIS room (targetWsId)
        // so Alice's rollback does not delete Bob's private divisions
        const otherUsersPrivateDivsInThisRoom = (db.divisions || []).filter(
          (d) =>
            (!targetWsId || d.workspace_id === targetWsId) &&
            d.visibility === 'private' &&
            currentUser &&
            d.owner_id !== currentUser.id
        );
        const otherUsersPrivateDivIdSet = new Set(otherUsersPrivateDivsInThisRoom.map((d) => d.id));
        const otherUsersPrivateClusters = (db.clusters || []).filter((c) =>
          otherUsersPrivateDivIdSet.has(c.division_id)
        );
        const otherUsersPrivateClusterIdSet = new Set(otherUsersPrivateClusters.map((c) => c.id));
        const otherUsersPrivateTasks = (db.tasks || []).filter((t) =>
          otherUsersPrivateDivIdSet.has(t.division_id)
        );
        const otherUsersPrivateBoardModes = (db.board_modes || []).filter(
          (m) => m.division_id && otherUsersPrivateDivIdSet.has(m.division_id)
        );
        const otherUsersPrivateSmartAreaItems = (db.smart_area_items || []).filter((item) =>
          otherUsersPrivateClusterIdSet.has(item.cluster_id)
        );

        // Divisions to restore for targetWsId from parsed data:
        // Must match targetWsId (or if source/parsed has no workspace_id, assign targetWsId)
        // Only public divisions OR current user's private divisions
        const parsedTargetDivs = (parsed.divisions || [])
          .filter((d) => {
            if (targetWsId && d.workspace_id && d.workspace_id !== targetWsId) return false;
            if (d.visibility === 'private' && currentUser && d.owner_id !== currentUser.id) return false;
            return true;
          })
          .map((d) => ({
            ...d,
            workspace_id: d.workspace_id || targetWsId || undefined,
          }));

        const parsedTargetDivIdSet = new Set(parsedTargetDivs.map((d) => d.id));
        const parsedTargetClusters = (parsed.clusters || []).filter((c) =>
          parsedTargetDivIdSet.has(c.division_id)
        );
        const parsedTargetClusterIdSet = new Set(parsedTargetClusters.map((c) => c.id));
        const parsedTargetTasks = (parsed.tasks || []).filter((t) => parsedTargetDivIdSet.has(t.division_id));
        const parsedTargetBoardModes = (parsed.board_modes || []).filter(
          (m) => m.division_id && parsedTargetDivIdSet.has(m.division_id)
        );
        const parsedTargetSmartAreaItems = (parsed.smart_area_items || []).filter((item) =>
          parsedTargetClusterIdSet.has(item.cluster_id)
        );

        // Periods to restore for targetWsId
        const parsedTargetPeriods = (parsed.periods || [])
          .filter((p) => !targetWsId || !p.workspace_id || p.workspace_id === targetWsId)
          .map((p) => ({
            ...p,
            workspace_id: p.workspace_id || targetWsId || undefined,
          }));

        // Merge: keep all other rooms + keep colleagues' private divisions in this room + restore target divs/tasks/periods
        const finalDivisions = [...otherDivisions, ...otherUsersPrivateDivsInThisRoom, ...parsedTargetDivs];
        const finalClusters = [...otherClusters, ...otherUsersPrivateClusters, ...parsedTargetClusters];
        const finalTasks = [...otherTasks, ...otherUsersPrivateTasks, ...parsedTargetTasks];
        const finalBoardModes = [...otherBoardModes, ...otherUsersPrivateBoardModes, ...parsedTargetBoardModes];
        const finalSmartAreaItems = [
          ...otherSmartAreaItems,
          ...otherUsersPrivateSmartAreaItems,
          ...parsedTargetSmartAreaItems,
        ];

        const otherPeriodIdSet = new Set(otherPeriods.map((p) => p.id));
        const finalPeriods = [...otherPeriods, ...parsedTargetPeriods.filter((p) => !otherPeriodIdSet.has(p.id))];

        const restoredState: DatabaseState = {
          ...db,
          users: db.users, // preserve accounts
          settings: db.settings,
          restore_points: updatedRestorePoints,
          snapshots: db.snapshots, // preserve all snapshots
          workspaces: db.workspaces, // preserve all workspaces
          workspace_members: db.workspace_members,
          periods: finalPeriods,
          divisions: finalDivisions,
          clusters: finalClusters,
          tasks: finalTasks,
          smart_areas: db.smart_areas,
          smart_area_items: finalSmartAreaItems,
          board_modes: finalBoardModes,
        };

        setDb(restoredState);
        saveDatabase(restoredState);
        saveToFirestore(restoredState).catch(() => {});

        // Adjust active workspace/period/division pointers if needed
        if (targetWsId) {
          setActiveWorkspaceId(targetWsId);
        }
        if (parsedTargetDivs.length > 0) {
          const firstDiv = parsedTargetDivs[0];
          setActiveDivisionId(firstDiv.id);
          if (firstDiv.period_id) {
            setActivePeriodId(firstDiv.period_id);
          }
        }

        logActivity(targetWsId || undefined, 'Khôi phục Toàn bộ (Rollback)', 'workspace', source.id, {
          source_name: source.name,
          mode: 'full',
          workspace_name: targetWsName,
          tasks_restored: parsedTargetTasks.length,
          divisions_restored: parsedTargetDivs.length,
        });

        return {
          success: true,
          message: `Khôi phục (Rollback) thành công cho phòng "${targetWsName}" về bản "${source.name}"! (${parsedTargetDivs.length} phân chia, ${parsedTargetTasks.length} việc). Các phòng ban khác vẫn được giữ nguyên vẹn 100%.`,
        };
      } else {
        // Selective rollback for divisions in targetWsId
        if (!selectedDivisionIds || selectedDivisionIds.length === 0) {
          return { success: false, message: 'Vui lòng chọn ít nhất 1 phân chia để khôi phục.' };
        }

        const targetDivs = (parsed.divisions || [])
          .filter((d) => selectedDivisionIds.includes(d.id))
          .map((d) => ({
            ...d,
            workspace_id: d.workspace_id || targetWsId || undefined,
          }));

        if (targetDivs.length === 0) {
          return { success: false, message: 'Các phân chia đã chọn không tồn tại trong bản lưu này.' };
        }

        const validDivisionIdSet = new Set(targetDivs.map((d) => d.id));
        const restoredClusters = (parsed.clusters || []).filter((c) => validDivisionIdSet.has(c.division_id));
        const restoredTasks = (parsed.tasks || []).filter((t) => validDivisionIdSet.has(t.division_id));
        const restoredClusterIds = new Set(restoredClusters.map((c) => c.id));
        const restoredBoardModes = (parsed.board_modes || []).filter(
          (m) => m.division_id && validDivisionIdSet.has(m.division_id)
        );
        const restoredSmartAreaItems = (parsed.smart_area_items || []).filter((item) =>
          restoredClusterIds.has(item.cluster_id)
        );

        // Keep all existing divisions that are NOT in validDivisionIdSet (including all other rooms AND other divisions of this room)
        const unaffectedDivisions = db.divisions.filter((d) => !validDivisionIdSet.has(d.id));
        const unaffectedClusters = db.clusters.filter((c) => !validDivisionIdSet.has(c.division_id));
        const unaffectedTasks = db.tasks.filter((t) => !validDivisionIdSet.has(t.division_id));
        const unaffectedBoardModes = (db.board_modes || []).filter(
          (m) => !m.division_id || !validDivisionIdSet.has(m.division_id)
        );
        const unaffectedSmartAreaItems = (db.smart_area_items || []).filter(
          (item) => !restoredClusterIds.has(item.cluster_id)
        );

        // Bring over any periods referenced by restored targetDivs if missing
        const referencedPeriodIds = new Set(targetDivs.map((d) => d.period_id).filter(Boolean));
        const existingPeriodIds = new Set(db.periods.map((p) => p.id));
        const missingPeriods = (parsed.periods || [])
          .filter((p) => referencedPeriodIds.has(p.id) && !existingPeriodIds.has(p.id))
          .map((p) => ({
            ...p,
            workspace_id: p.workspace_id || targetWsId || undefined,
          }));

        const updatedState: DatabaseState = {
          ...db,
          divisions: [...unaffectedDivisions, ...targetDivs],
          clusters: [...unaffectedClusters, ...restoredClusters],
          tasks: [...unaffectedTasks, ...restoredTasks],
          board_modes: [...unaffectedBoardModes, ...restoredBoardModes],
          smart_area_items: [...unaffectedSmartAreaItems, ...restoredSmartAreaItems],
          periods: [...db.periods, ...missingPeriods],
          restore_points: updatedRestorePoints,
        };

        setDb(updatedState);
        saveDatabase(updatedState);
        saveToFirestore(updatedState).catch(() => {});

        if (targetDivs[0]) {
          setActiveDivisionId(targetDivs[0].id);
          if (targetDivs[0].period_id) setActivePeriodId(targetDivs[0].period_id);
          if (targetDivs[0].workspace_id) setActiveWorkspaceId(targetDivs[0].workspace_id);
        }

        logActivity(targetWsId || undefined, 'Khôi phục Phân chia (Rollback)', 'workspace', source.id, {
          source_name: source.name,
          mode: 'selective',
          divisions_restored: targetDivs.length,
          division_names: targetDivs.map((d) => d.name).join(', '),
        });

        return {
          success: true,
          message: `Đã khôi phục thành công ${targetDivs.length} phân chia (${targetDivs.map((d) => d.name).join(', ')}) tại phòng "${targetWsName}"! Các phòng ban khác không bị ảnh hưởng.`,
        };
      }
    } catch (err: any) {
      console.error('Lỗi khi khôi phục dữ liệu:', err);
      return { success: false, message: `Lỗi khi thực hiện rollback: ${err?.message || 'Dữ liệu không hợp lệ'}` };
    }
  };

  const rollbackSnapshot = (snapshotId: string) => {
    return executeRollback(snapshotId, 'full').success;
  };

  const rollbackDivisionsFromSnapshot = (
    snapshotId: string,
    divisionIds: string[]
  ): { success: boolean; message: string } => {
    return executeRollback(snapshotId, 'selective', divisionIds);
  };

  const rollbackDivisionFromSnapshot = (
    snapshotId: string,
    divisionId: string
  ): { success: boolean; message: string } => {
    return executeRollback(snapshotId, 'selective', [divisionId]);
  };

  const revertFromRestorePoint = (restorePointId: string): { success: boolean; message: string } => {
    return executeRollback(restorePointId, 'full');
  };

  const deleteRestorePoint = (restorePointId: string) => {
    setDb((prev) => {
      const updated = {
        ...prev,
        restore_points: (prev.restore_points || []).filter((r) => r.id !== restorePointId),
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });
  };

  const clearAllRollbackPoints = () => {
    setDb((prev) => {
      const updated = {
        ...prev,
        restore_points: [],
      };
      saveDatabase(updated);
      saveToFirestore(updated).catch(() => {});
      return updated;
    });
  };

  const deleteSnapshot = (snapshotId: string) => {
    setDb((prev) => ({
      ...prev,
      snapshots: (prev.snapshots || []).filter((s) => s.id !== snapshotId),
    }));
  };

  const setSnapshotFrequency = (frequency: 'daily' | '12h' | '6h' | 'hourly' | 'manual') => {
    setDb((prev) => {
      const updated = {
        ...prev,
        settings: {
          ...prev.settings,
          auto_snapshot_frequency: frequency,
        },
      };
      saveDatabase(updated);
      saveToFirestore(updated);
      return updated;
    });
  };

  const setAutoSnapshotExcludedDivisions = (excludedDivisionIds: string[]) => {
    setDb((prev) => {
      const updated = {
        ...prev,
        settings: {
          ...prev.settings,
          auto_snapshot_excluded_division_ids: excludedDivisionIds,
        },
      };
      saveDatabase(updated);
      saveToFirestore(updated);
      return updated;
    });
  };

  // Automatic Snapshot Engine based on Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+7)
  useEffect(() => {
    const checkAutoSnapshot = () => {
      const freq = db.settings?.auto_snapshot_frequency || 'daily';
      if (freq === 'manual') return;
      if (!db.workspaces || db.workspaces.length === 0) return;

      const now = new Date();
      // Format current date and hour in Vietnam Timezone
      const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
      const vnHourStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false });
      const vnHour = parseInt(vnHourStr, 10);

      let slotKey = '';
      let slotLabel = '';
      if (freq === 'daily') {
        slotKey = `daily-${vnDateStr}`;
        slotLabel = `Hàng ngày ${vnHourStr}:00 (Giờ VN - ${vnDateStr})`;
      } else if (freq === '12h') {
        const slot = vnHour < 12 ? 'am' : 'pm';
        slotKey = `12h-${vnDateStr}-${slot}`;
        slotLabel = `Mỗi 12h [khung ${slot === 'am' ? '00:00 - 12:00' : '12:00 - 24:00'}] (Giờ VN - ${vnDateStr})`;
      } else if (freq === '6h') {
        const slot = Math.floor(vnHour / 6);
        slotKey = `6h-${vnDateStr}-slot${slot}`;
        slotLabel = `Mỗi 6h [khung ${slot * 6}h - ${(slot + 1) * 6}h] (Giờ VN - ${vnDateStr})`;
      } else if (freq === 'hourly') {
        slotKey = `hourly-${vnDateStr}-${vnHour}`;
        slotLabel = `Mỗi 1h [${vnHour}:00] (Giờ VN - ${vnDateStr})`;
      }

      if (!slotKey) return;
      if (db.settings?.last_auto_snapshot_at === slotKey) {
        return; // Slot already recorded
      }

      // Mark slot in settings
      setDb((prev) => {
        const updated = {
          ...prev,
          settings: {
            ...prev.settings,
            last_auto_snapshot_at: slotKey,
          },
        };
        saveDatabase(updated);
        saveToFirestore(updated).catch(() => {});
        return updated;
      });

      // Capture snapshot
      createSnapshot(
        `Tự động: ${slotLabel}`,
        `Sao lưu tự động theo thiết lập (${freq}) múi giờ Việt Nam (UTC+7)`,
        true
      );
    };

    // Check auto snapshot every 5 minutes to avoid burning CPU and DB reads
    const timer = setInterval(checkAutoSnapshot, 300000);
    const initialTimer = setTimeout(checkAutoSnapshot, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(initialTimer);
    };
  }, [db.settings?.auto_snapshot_frequency, db.settings?.last_auto_snapshot_at, db.workspaces?.length]);

  const importSnapshotFromFile = (fileContent: string) => {
    try {
      const parsed = JSON.parse(fileContent);
      let restoredState: DatabaseState;

      if (parsed.data_state && parsed.stats) {
        restoredState = JSON.parse(parsed.data_state) as DatabaseState;
      } else if (parsed.users && parsed.tasks) {
        restoredState = parsed as DatabaseState;
      } else {
        return { success: false, message: 'Định dạng file không hợp lệ.' };
      }

      restoredState.snapshots = [
        ...(db.snapshots || []),
        {
          id: `snap-import-${Date.now()}`,
          name: `Nhập từ file (${new Date().toLocaleDateString('vi-VN')})`,
          description: 'Phiên bản nhập từ file máy tính',
          created_by: currentUser?.id || 'user',
          created_by_name: currentUser?.display_name || 'Người dùng',
          created_at: new Date().toISOString(),
          stats: {
            workspaces_count: restoredState.workspaces?.length || 0,
            periods_count: restoredState.periods?.length || 0,
            divisions_count: restoredState.divisions?.length || 0,
            clusters_count: restoredState.clusters?.length || 0,
            tasks_count: restoredState.tasks?.length || 0,
            completed_tasks_count: restoredState.tasks?.filter((t) => t.is_completed).length || 0,
          },
          data_state: JSON.stringify(restoredState),
        },
      ];

      setDb(restoredState);
      saveDatabase(restoredState);
      saveToFirestore(restoredState);
      return { success: true, message: 'Khôi phục dữ liệu từ file thành công!' };
    } catch (err: any) {
      return { success: false, message: 'Lỗi đọc file: ' + (err.message || 'File không hợp lệ') };
    }
  };

  // Chat & Messaging
  const sendMessage = (
    content: string,
    taskId: string | null = null,
    attachments: FileAttachment[] = [],
    receiverId: string | null = null,
    groupId: string | null = null
  ) => {
    if (!currentUser || !activeWorkspace) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      workspace_id: activeWorkspace.id,
      sender_id: currentUser.id,
      receiver_id: receiverId || null,
      group_id: groupId || activeChatGroupId || null,
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
      receiverId ? 'Gửi tin nhắn riêng' : groupId ? 'Gửi tin nhắn nhóm hạng mục' : 'Gửi tin nhắn chat',
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
    saveDatabase(fresh);
    saveToFirestore(fresh, true).catch(() => {});
    localStorage.removeItem('wtm_session_user');
    localStorage.removeItem('wtm_session_token');
    localStorage.removeItem('wtm_session_device');
    setCurrentUser(null);
    setActiveWorkspaceId(null);
    setActivePeriodId(null);
    setActiveDivisionId(null);
    setActiveClusterId(null);
    setCurrentRoute('/login');
  };

  return (
    <AppContext.Provider
      value={{
        db,
        currentUser,
        currentRoute,
        theme,
        setTheme,
        cycleTheme,
        toggleTheme,
        navigateTo,

        sessionNotice,
        dismissSessionNotice,

        firebaseStatus,
        firebaseError,

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

        selectedDivisionIds,
        selectDivision,
        clearDivisionSelection,
        copiedDivisionIds,
        copyDivisions,
        pasteDivisions,

        copiedTaskIds,
        copyTasks,
        duplicateTasks,
        pasteTasks,
        clearCopiedTasks,
        toastMessage,
        showToast,

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

        activeChatGroupId,
        setActiveChatGroupId,
        createChatGroup,
        deleteChatGroup,

        recordRollbackCheckpoint,
        executeRollback,
        clearAllRollbackPoints,
        createSnapshot,
        rollbackSnapshot,
        rollbackDivisionFromSnapshot,
        rollbackDivisionsFromSnapshot,
        revertFromRestorePoint,
        deleteRestorePoint,
        deleteSnapshot,
        setSnapshotFrequency,
        setAutoSnapshotExcludedDivisions,
        importSnapshotFromFile,

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
        collapsedClusterIds,

        createTask,
        updateTask,
        deleteTask,
        moveTaskCluster,
        reorderTaskInCluster,
        moveTaskToEndOfCluster,
        bulkMoveTasks,
        bulkDeleteTasks,
        bulkRemindTasks,
        toggleTaskComplete,

        // Custom Board Modes
        activeBoardModeId,
        setActiveBoardModeId,
        createBoardMode,
        updateBoardMode,
        deleteBoardMode,
        addColumnToBoardMode,
        updateBoardModeColumn,
        deleteBoardModeColumn,
        moveTaskInMode,
        reorderTaskInMode,

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
