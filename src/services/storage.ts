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

const STORAGE_KEY = 'wtm_database_v4';

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

export const DEFAULT_BOARD_MODES: BoardMode[] = [
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Chế độ bảng công việc phân cấp cơ bản theo tiến trình',
    icon: 'FolderKanban',
    is_preset: true,
    clusters: [
      { id: 'kb-todo', name: 'Cần làm', color: '#6366F1', sort_order: 1 },
      { id: 'kb-inprogress', name: 'Đang làm', color: '#F59E0B', sort_order: 2 },
      { id: 'kb-done', name: 'Hoàn thành', color: '#10B981', sort_order: 3 },
    ],
  },
  {
    id: 'weekday',
    name: 'Theo ngày (Weekday)',
    description: 'Chế độ phân chia công việc theo các ngày trong tuần từ Thứ 2 đến Chủ nhật',
    icon: 'Calendar',
    is_preset: true,
    clusters: [
      { id: 'wd-mon', name: 'Thứ 2', color: '#3B82F6', sort_order: 1 },
      { id: 'wd-tue', name: 'Thứ 3', color: '#6366F1', sort_order: 2 },
      { id: 'wd-wed', name: 'Thứ 4', color: '#8B5CF6', sort_order: 3 },
      { id: 'wd-thu', name: 'Thứ 5', color: '#EC4899', sort_order: 4 },
      { id: 'wd-fri', name: 'Thứ 6', color: '#F59E0B', sort_order: 5 },
      { id: 'wd-sat', name: 'Thứ 7', color: '#10B981', sort_order: 6 },
      { id: 'wd-sun', name: 'Chủ nhật', color: '#EF4444', sort_order: 7 },
    ],
  },
  {
    id: 'priority',
    name: 'Mức ưu tiên',
    description: 'Chế độ phân loại công việc theo mức độ cấp bách và tầm quan trọng',
    icon: 'Sparkles',
    is_preset: true,
    clusters: [
      { id: 'pr-urgent', name: 'Khẩn cấp', color: '#EF4444', sort_order: 1 },
      { id: 'pr-high', name: 'Ưu tiên cao', color: '#F59E0B', sort_order: 2 },
      { id: 'pr-medium', name: 'Trung bình', color: '#3B82F6', sort_order: 3 },
      { id: 'pr-low', name: 'Thấp', color: '#64748B', sort_order: 4 },
    ],
  },
];

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
    board_modes: DEFAULT_BOARD_MODES,
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
    if (!parsed.chat_groups) parsed.chat_groups = [];
    if (!parsed.snapshots) parsed.snapshots = [];
    if (!parsed.restore_points) parsed.restore_points = [];
    if (!parsed.board_modes || parsed.board_modes.length === 0) {
      parsed.board_modes = DEFAULT_BOARD_MODES;
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
