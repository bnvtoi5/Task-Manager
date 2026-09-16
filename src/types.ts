export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  password?: string;
  avatar_url?: string;
  status_message?: string;
  bio?: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role_in_workspace: WorkspaceMemberRole;
  status: 'active' | 'invited' | 'suspended';
  joined_at: string;
  user?: UserProfile;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  invite_code: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type PeriodType = 'week' | 'month' | 'quarter' | 'custom';

export interface Period {
  id: string;
  workspace_id: string;
  name: string;
  type: PeriodType;
  start_date: string;
  end_date: string;
  timezone: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type DivisionVisibility = 'public' | 'private';
export type DivisionLayoutType = 'full' | 'single';

export interface BoardModeCluster {
  id: string;
  name: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_collapsed?: boolean;
}

export interface BoardMode {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  is_preset?: boolean;
  division_id?: string;
  clusters: BoardModeCluster[];
}

export interface Division {
  id: string;
  period_id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  description?: string;
  visibility: DivisionVisibility;
  layout_type: DivisionLayoutType;
  color: string;
  icon: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cluster {
  id: string;
  division_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sort_order: number;
  is_collapsed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskSeverity = 'minor' | 'normal' | 'major' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  workspace_id: string;
  period_id: string;
  division_id: string;
  cluster_id: string;
  created_by: string;
  assigned_to?: string | null;
  title: string;
  description?: string;
  priority: TaskPriority;
  severity: TaskSeverity;
  status: TaskStatus;
  due_date?: string | null;
  display_due_text?: string;
  alarm_enabled?: boolean;
  alarm_at?: string | null;
  alarm_time?: string | null;
  alarm_repeat?: 'none' | 'daily' | 'weekly';
  alarm_triggered?: boolean;
  reminder_at?: string | null;
  reminder_mode?: 'toast' | 'notification' | 'all';
  parent_task_id?: string | null;
  is_inherited?: boolean;
  checklists?: TaskChecklistItem[];
  tags?: string[];
  color?: string;
  estimate_minutes?: number;
  actual_minutes?: number;
  sort_order: number;
  is_completed: boolean;
  is_archived: boolean;
  is_private: boolean;
  mode_clusters?: Record<string, string>; // modeId -> clusterId (independent per mode)
  mode_sort_orders?: Record<string, number>; // modeId -> sort_order (independent per mode)
  created_at: string;
  updated_at: string;
}

export interface SmartArea {
  id: string;
  division_id: string;
  owner_id: string;
  name: string;
  layout_mode: 'grid' | 'freeform';
  canvas_width?: number;
  canvas_height?: number;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmartAreaItem {
  id: string;
  smart_area_id: string;
  cluster_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order_index: number;
  is_visible: boolean;
}

export interface ChatGroup {
  id: string;
  workspace_id: string;
  name: string;
  category?: string;
  description?: string;
  icon_color?: string;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  group_id?: string | null;
  sender_id: string;
  receiver_id?: string | null;
  task_id?: string | null;
  content: string;
  message_type: 'text' | 'task_mention' | 'file' | 'system';
  reply_to_id?: string | null;
  created_at: string;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  message_id?: string;
  task_id?: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  preview_url: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  task_id?: string | null;
  message_id?: string | null;
  type: 'task_assigned' | 'task_reminder' | 'cluster_moved' | 'chat_mention' | 'system';
  title: string;
  body: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id?: string | null;
  actor_id: string;
  actor_name: string;
  action_type: string;
  entity_type: 'workspace' | 'period' | 'division' | 'cluster' | 'task' | 'member' | 'chat';
  entity_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface SystemAuditLog {
  id: string;
  actor_email: string;
  action: string;
  ip_address: string;
  status: 'success' | 'failed' | 'blocked';
  details: string;
  created_at: string;
}

export interface SystemSetting {
  allow_registration: boolean;
  require_email_verification: boolean;
  max_workspaces_per_user: number;
  default_user_role: UserRole;
  maintenance_mode: boolean;
  auto_snapshot_frequency?: 'daily' | '12h' | '6h' | 'hourly' | 'manual';
  last_auto_snapshot_at?: string;
  auto_snapshot_excluded_division_ids?: string[];
  smtp_enabled?: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from_name?: string;
  smtp_from_email?: string;
}

export interface DatabaseSnapshot {
  id: string;
  workspace_id?: string | null;
  name: string;
  description?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  auto_generated?: boolean;
  saved_division_ids?: string[];
  saved_division_names?: string[];
  stats: {
    workspaces_count: number;
    periods_count: number;
    divisions_count: number;
    clusters_count: number;
    tasks_count: number;
    completed_tasks_count: number;
  };
  data_state: string; // JSON stringify of DatabaseState
}

export interface RestorePoint {
  id: string;
  workspace_id?: string | null;
  name: string;
  description?: string;
  action_type?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  affected_divisions?: {
    id: string;
    name: string;
    visibility: 'public' | 'private';
    clusters_count: number;
    tasks_count: number;
  }[];
  stats?: {
    tasks_count: number;
    clusters_count: number;
    divisions_count: number;
  };
  data_state: string; // JSON stringify of DatabaseState
}

export type AppTheme = 'light' | 'dark' | 'warm-book' | 'neon';

