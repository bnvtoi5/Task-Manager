import React from 'react';
import { Bell, Clock, X, Check, ArrowRight } from 'lucide-react';
import { Task } from '../../types';

interface AlarmBannerProps {
  task: Task | null;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
  onViewTask: (task: Task) => void;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({
  task,
  onDismiss,
  onSnooze,
  onViewTask,
}) => {
  if (!task) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top duration-300">
      <div className="bg-white dark:bg-[#131b2e] border-2 border-amber-400 dark:border-amber-500 rounded-2xl shadow-2xl p-4 text-slate-900 dark:text-slate-100 ring-4 ring-amber-400/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 animate-bounce">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                BÁO THỨC CÔNG VIỆC
              </span>
              <h4 className="text-sm font-bold truncate max-w-[200px] leading-tight">
                {task.title}
              </h4>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {task.display_due_text && (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Hạn chót: {task.display_due_text}</span>
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => onSnooze(5)}
            className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-[11px]"
          >
            Báo lại 5 phút
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Đã xong
            </button>
            <button
              type="button"
              onClick={() => onViewTask(task)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 shadow-xs transition"
            >
              <span>Xem task</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
