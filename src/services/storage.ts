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
  FileAttachment,
  AppNotification,
  ActivityLog,
  SystemAuditLog,
  SystemSetting
} from '../types';

const STORAGE_KEY = 'wtm_database_v2';

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
  messages: ChatMessage[];
  attachments: FileAttachment[];
  notifications: AppNotification[];
  activity_logs: ActivityLog[];
  audit_logs: SystemAuditLog[];
  settings: SystemSetting;
}

export const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-001',
  email: 'admin@system.local',
  display_name: 'Quản trị viên Hệ thống',
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
};

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
    messages: [],
    attachments: [],
    notifications: [],
    activity_logs: [],
    audit_logs: [
      {
        id: 'audit-001',
        actor_email: 'system',
        action: 'Khởi tạo hệ thống từ database sạch',
        ip_address: '127.0.0.1',
        status: 'success',
        details: 'Admin mặc định admin@system.local được khởi tạo. Không có sample data.',
        created_at: new Date().toISOString(),
      },
    ],
    settings: DEFAULT_SETTINGS,
  };
}

export function loadDatabase(): DatabaseState {
  try {
    // Check if user requested wipe: check v2 storage key
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Find if there was an existing admin from previous key to preserve credentials
      let preservedAdmin = DEFAULT_ADMIN;
      try {
        const oldRaw = localStorage.getItem('wtm_database_v1');
        if (oldRaw) {
          const parsedOld = JSON.parse(oldRaw);
          const foundAdmin = parsedOld.users?.find((u: UserProfile) => u.role === 'admin' && u.is_active);
          if (foundAdmin) {
            preservedAdmin = foundAdmin;
          }
          localStorage.removeItem('wtm_database_v1');
        }
      } catch {
        // ignore
      }

      const freshDb = getInitialDatabase();
      freshDb.users = [preservedAdmin];
      saveDatabase(freshDb);
      // Auto-set session to admin if no session or stale session
      localStorage.setItem('wtm_session_user', preservedAdmin.id);
      return freshDb;
    }

    const parsed = JSON.parse(raw);
    // Guarantee only admin users exist if user requested clean db
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = [DEFAULT_ADMIN];
    }
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
