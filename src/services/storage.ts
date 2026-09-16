import {
  UserProfile,
  Workspace,
  WorkspaceMember,
  Period,
  Division,
  Cluster,
  Task,
  SmartArea,
  SmartAreaItem,
  ChatMessage,
  ChatGroup,
  FileAttachment,
  AppNotification,
  ActivityLog,
  SystemAuditLog,
  SystemSetting,
  DatabaseSnapshot,
  BoardMode,
  RestorePoint,
} from '../types';

const STORAGE_KEY = 'wtm_database_v7';

export interface DatabaseState {
  users: UserProfile[];
  workspaces: Workspace[];
  workspace_members: WorkspaceMember[];
  periods: Period[];
  divisions: Division[];
  clusters: Cluster[];
  tasks: Task[];
  smart_areas: SmartArea[];
  smart_area_items: SmartAreaItem[];
  board_modes: BoardMode[];
  messages: ChatMessage[];
  chat_groups: ChatGroup[];
  attachments: FileAttachment[];
  notifications: AppNotification[];
  activity_logs: ActivityLog[];
  audit_logs: SystemAuditLog[];
  snapshots: DatabaseSnapshot[];
  restore_points?: RestorePoint[];
  settings: SystemSetting;
}

export const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-001',
  email: 'admin@system.local',
  display_name: 'Quản trị viên Hệ thống',
  password: '123',
  avatar_url: '',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_login_at: new Date().toISOString(),
};

const DEFAULT_SETTINGS: SystemSetting = {
  allow_registration: true,
  require_email_verification: false,
  max_workspaces_per_user: 10,
  default_user_role: 'user',
  maintenance_mode: false,
  auto_snapshot_frequency: 'daily',
};

export const DEFAULT_BOARD_MODES: BoardMode[] = [];

export function getInitialDatabase(): DatabaseState {
  // ZERO seed data besides default admin
  return {
    users: [DEFAULT_ADMIN],
    workspaces: [],
    workspace_members: [],
    periods: [],
    divisions: [],
    clusters: [],
    tasks: [],
    smart_areas: [],
    smart_area_items: [],
    board_modes: [],
    messages: [],
    chat_groups: [],
    attachments: [],
    notifications: [],
    activity_logs: [],
    snapshots: [],
    restore_points: [],
    audit_logs: [
      {
        id: 'audit-001',
        actor_email: 'system',
        action: 'Khởi tạo hệ thống sạch',
        ip_address: '127.0.0.1',
        status: 'success',
        details: 'Admin mặc định admin@system.local / mật khẩu 123 được khởi tạo an toàn.',
        created_at: new Date().toISOString(),
      },
    ],
    settings: DEFAULT_SETTINGS,
  };
}

export function loadDatabase(): DatabaseState {
  try {
    // Clear old versions if they exist to completely wipe previous test DB
    try {
      localStorage.removeItem('wtm_database_v6');
      localStorage.removeItem('wtm_clean_v6_applied');
      localStorage.removeItem('wtm_database_v5');
      localStorage.removeItem('wtm_clean_v5_applied');
      localStorage.removeItem('wtm_database_v4');
      localStorage.removeItem('wtm_database_v3');
      localStorage.removeItem('wtm_database_v2');
      localStorage.removeItem('wtm_database_v1');
    } catch {
      // ignore
    }

    const isCleaned = localStorage.getItem('wtm_clean_v7_applied');
    if (!isCleaned) {
      const freshDb = getInitialDatabase();
      saveDatabase(freshDb);
      localStorage.setItem('wtm_clean_v7_applied', 'true');
      return freshDb;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const freshDb = getInitialDatabase();
      saveDatabase(freshDb);
      return freshDb;
    }

    const parsed = JSON.parse(raw);
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = [DEFAULT_ADMIN];
    } else {
      const admin = parsed.users.find((u: UserProfile) => u.role === 'admin' || u.email === 'admin@system.local');
      if (admin && !admin.password) {
        admin.password = '123';
      }
    }
    if (!parsed.workspaces) parsed.workspaces = [];
    if (!parsed.workspace_members) parsed.workspace_members = [];
    if (!parsed.periods) parsed.periods = [];
    if (!parsed.divisions) parsed.divisions = [];
    if (!parsed.clusters) parsed.clusters = [];
    if (!parsed.tasks) parsed.tasks = [];
    if (!parsed.smart_areas) parsed.smart_areas = [];
    if (!parsed.smart_area_items) parsed.smart_area_items = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.chat_groups) parsed.chat_groups = [];
    if (!parsed.attachments) parsed.attachments = [];
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.activity_logs) parsed.activity_logs = [];
    if (!parsed.snapshots) parsed.snapshots = [];
    if (!parsed.restore_points) parsed.restore_points = [];
    if (!parsed.board_modes) parsed.board_modes = [];
    return parsed;
  } catch (err) {
    console.error('Error reading localStorage:', err);
    return getInitialDatabase();
  }
}

export function saveDatabase(db: DatabaseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Error saving localStorage:', err);
  }
}

export function resetToEmptyDatabase(): DatabaseState {
  const initial = getInitialDatabase();
  saveDatabase(initial);
  return initial;
}
