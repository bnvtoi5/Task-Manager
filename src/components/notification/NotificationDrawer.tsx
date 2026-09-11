import React from 'react';
import { X, Bell, CheckCircle2, ArrowRightLeft, UserCheck, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const {
    db,
    currentUser,
    markNotificationRead,
    markAllNotificationsRead,
    unreadNotificationCount,
  } = useApp();

  if (!isOpen) return null;

  const notifications = currentUser
    ? db.notifications.filter((n) => n.user_id === currentUser.id)
    : [];

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <UserCheck className="w-4 h-4 text-indigo-500" />;
      case 'task_reminder':
        return <Bell className="w-4 h-4 text-amber-500" />;
      case 'cluster_moved':
        return <ArrowRightLeft className="w-4 h-4 text-emerald-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-96 bg-white dark:bg-[#111827] border-l border-slate-200/90 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-[#152037] backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            Thông báo
          </h3>
          {unreadNotificationCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white">
              {unreadNotificationCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadNotificationCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
            >
              Đã đọc tất cả
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs bg-slate-50/40 dark:bg-[#0c1220]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
            <p className="font-bold text-slate-700 dark:text-slate-300">Không có thông báo mới</p>
            <p className="text-[11px] mt-1 text-slate-400">
              Bạn sẽ nhận được thông báo khi được giao nhiệm vụ hoặc có chuông báo việc đến hạn.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={`p-3 rounded-xl border transition cursor-pointer ${
                n.is_read
                  ? 'bg-white dark:bg-[#1a263d]/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-slate-900 dark:text-slate-100 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs leading-snug">{n.title}</h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(n.created_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {n.body}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
