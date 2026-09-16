import React from 'react';
import { X, Users, History, Shield, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembersModal: React.FC<MembersModalProps> = ({ isOpen, onClose }) => {
  const { db, activeWorkspace, currentUser } = useApp();

  if (!isOpen || !activeWorkspace) return null;

  const members = db.workspace_members
    .filter((m) => m.workspace_id === activeWorkspace.id)
    .map((m) => ({
      ...m,
      user: db.users.find((u) => u.id === m.user_id),
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Thành viên phòng: {activeWorkspace.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto space-y-2.5">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#1a263d] text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {m.user?.display_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {m.user?.display_name} {m.user_id === currentUser?.id && '(Bạn)'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{m.user?.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    m.role_in_workspace === 'owner'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : m.role_in_workspace === 'admin'
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {m.role_in_workspace}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

interface ActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({ isOpen, onClose }) => {
  const { db, activeWorkspace, currentUser } = useApp();

  if (!isOpen || !activeWorkspace) return null;

  const logs = db.activity_logs
    .filter((l) => {
      if (l.workspace_id !== activeWorkspace.id) return false;

      // Privacy check: Never share activity logs of private divisions with other users
      let divisionId = l.metadata?.division_id;
      if (!divisionId && l.entity_type === 'division') {
        divisionId = l.entity_id;
      }
      if (!divisionId && l.entity_type === 'task') {
        const task = db.tasks.find((t) => t.id === l.entity_id);
        if (task) divisionId = task.division_id;
      }

      if (divisionId) {
        const division = db.divisions.find((d) => d.id === divisionId);
        if (division && division.visibility === 'private' && division.owner_id !== currentUser?.id) {
          return false;
        }
      }

      if (l.metadata?.is_private && l.metadata?.division_owner_id && l.metadata.division_owner_id !== currentUser?.id) {
        return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Nhật ký hoạt động phòng: {activeWorkspace.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto space-y-2 text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              Chưa có nhật ký hoạt động nào được ghi lại.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#1a263d]"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {log.actor_name}:{' '}
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {log.action_type}
                    </span>
                  </div>
                  {log.metadata && (
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(log.created_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
