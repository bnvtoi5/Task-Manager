import React, { useState, useRef } from 'react';
import {
  MoreVertical,
  Calendar,
  Bell,
  CheckSquare,
  Check,
  Edit2,
  ArrowRightLeft,
  Trash2,
  User,
  Clock,
  Send,
  Copy,
  Link as LinkIcon,
  Repeat,
} from 'lucide-react';
import { Task } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onSelect: (taskId: string, multi?: boolean) => void;
  onDoubleClick: (task: Task) => void;
  onEdit: (task: Task) => void;
  onMoveRequest: (task: Task) => void;
  currentClusterId?: string;
  onReorder?: (sourceTaskId: string, targetTaskId: string, position: 'before' | 'after') => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isSelected,
  onSelect,
  onDoubleClick,
  onEdit,
  onMoveRequest,
  currentClusterId,
  onReorder,
}) => {
  const {
    db,
    toggleTaskComplete,
    deleteTask,
    setStagedTaskForChat,
    setIsChatOpen,
    highlightedTaskId,
    reorderTaskInCluster,
    copyTasks,
  } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const assignee = task.assigned_to ? db.users.find((u) => u.id === task.assigned_to) : null;

  // Soft, refined priority config with gentle colors and subtle dots
  const priorityConfig = {
    low: {
      bg: 'bg-slate-100/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/40',
      dot: 'bg-slate-400',
      label: 'Thấp',
    },
    medium: {
      bg: 'bg-sky-50/60 dark:bg-sky-950/25 text-sky-600/90 dark:text-sky-300/90 border-sky-200/50 dark:border-sky-900/40',
      dot: 'bg-sky-400',
      label: 'Trung bình',
    },
    high: {
      bg: 'bg-amber-50/60 dark:bg-amber-950/25 text-amber-650 dark:text-amber-300/90 border-amber-200/50 dark:border-amber-900/40',
      dot: 'bg-amber-400',
      label: 'Ưu tiên cao',
    },
    urgent: {
      bg: 'bg-rose-50/60 dark:bg-rose-950/25 text-rose-600/90 dark:text-rose-300/90 border-rose-200/50 dark:border-rose-900/40',
      dot: 'bg-rose-400',
      label: 'Khẩn cấp',
    },
  }[task.priority] || {
    bg: 'bg-slate-100/60 text-slate-600 border-slate-200/60',
    dot: 'bg-slate-400',
    label: 'Thấp',
  };

  // Long press handler for multi-select
  const handleTouchStart = () => {
    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      onSelect(task.id, true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onSelect(task.id, true);
    } else {
      onSelect(task.id, false);
    }
  };

  // Drag and drop HTML5
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDropPosition(null);
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const isTopHalf = offset < rect.height / 2;
    setDropPosition(isTopHalf ? 'before' : 'after');
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropPosition(null);
  };

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceTaskId = e.dataTransfer.getData('text/plain');
    const pos = dropPosition || 'before';
    setDropPosition(null);

    if (sourceTaskId && sourceTaskId !== task.id) {
      if (onReorder) {
        onReorder(sourceTaskId, task.id, pos);
      } else {
        reorderTaskInCluster(currentClusterId || task.cluster_id, sourceTaskId, task.id, pos);
      }
    }
  };

  const completedChecklistCount = task.checklists?.filter((c) => c.completed).length || 0;
  const totalChecklists = task.checklists?.length || 0;

  // Format alarm time for display (e.g. "22:53")
  const displayAlarmTime = task.alarm_time
    ? task.alarm_time.length > 5
      ? task.alarm_time.slice(0, 5)
      : task.alarm_time
    : null;

  const isHighlighted = highlightedTaskId === task.id;

  return (
    <>
      <div
        id={`task-card-${task.id}`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleCardDragOver}
        onDragLeave={handleCardDragLeave}
        onDrop={handleCardDrop}
        onClick={handleClick}
        data-task-card="true"
        onDoubleClick={() => onDoubleClick(task)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        className={`group relative select-none w-full rounded-2xl p-3.5 transition-all duration-150 cursor-grab active:cursor-grabbing border ${
          isHighlighted
            ? 'ring-4 ring-indigo-500 shadow-2xl scale-[1.02] bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-600 animate-pulse'
            : isSelected
            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
            : 'bg-white dark:bg-[#131b2e] hover:bg-slate-50/70 dark:hover:bg-[#18233a] border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
        } ${task.is_completed ? 'opacity-70' : ''}`}
      >
        {/* Drop indicator line top */}
        {dropPosition === 'before' && (
          <div className="absolute -top-1.5 left-2 right-2 h-1 bg-indigo-500 rounded-full z-10 shadow-sm animate-pulse pointer-events-none" />
        )}
        {/* Drop indicator line bottom */}
        {dropPosition === 'after' && (
          <div className="absolute -bottom-1.5 left-2 right-2 h-1 bg-indigo-500 rounded-full z-10 shadow-sm animate-pulse pointer-events-none" />
        )}
        {/* Top row: Checkbox, Title & 3-dot Menu */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Rounded Checkbox */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleTaskComplete(task.id);
              }}
              className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                task.is_completed
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-900/60'
              }`}
              title={task.is_completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
            >
              {task.is_completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>

            <div className="min-w-0 flex-1">
              {/* Task Title: Impressive, clean, distinctive visual hierarchy */}
              <h4
                className={`text-[13.5px] sm:text-[14px] font-semibold leading-snug break-words tracking-tight transition-colors ${
                  task.is_completed
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                }`}
              >
                {task.title}
              </h4>

              {/* Description: Clear and legible, not eclipsed by large badges */}
              {task.description && (
                <p className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Badges row: Compact, gentle, harmonious */}
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {/* Priority micro-badge with colored dot */}
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium border ${priorityConfig.bg}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityConfig.dot}`} />
                  <span>{priorityConfig.label}</span>
                </span>

                {/* Inherited badge */}
                {task.is_inherited && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40"
                    title="Task này kế thừa từ task gốc, tự động đồng bộ khi task gốc thay đổi"
                  >
                    <LinkIcon className="w-2.5 h-2.5 text-purple-500" />
                    <span>Kế thừa</span>
                  </span>
                )}

                {/* Alarm / Due Time pill: Soft, non-aggressive, elegant font */}
                {task.alarm_enabled && (displayAlarmTime || task.display_due_text) ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium text-amber-700/90 dark:text-amber-300/90 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/50 dark:border-amber-800/40">
                    <Bell className="w-2.5 h-2.5 text-amber-500/90" />
                    <span>{displayAlarmTime || task.display_due_text}</span>
                    {task.alarm_repeat && task.alarm_repeat !== 'none' && (
                      <span className="flex items-center gap-0.5 text-[9.5px] text-amber-600 dark:text-amber-400 font-semibold border-l border-amber-300 dark:border-amber-700/60 pl-1 ml-0.5">
                        <Repeat className="w-2.5 h-2.5" />
                        {task.alarm_repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}
                      </span>
                    )}
                  </span>
                ) : task.display_due_text ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium text-amber-700/90 dark:text-amber-300/90 bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/50 dark:border-amber-800/40">
                    <Clock className="w-2.5 h-2.5 text-amber-500/80" />
                    <span>{task.display_due_text}</span>
                  </span>
                ) : task.due_date ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                    <Calendar className="w-2.5 h-2.5" />
                    <span>{new Date(task.due_date).toLocaleDateString('vi-VN')}</span>
                  </span>
                ) : null}

                {/* Checklist counter: compact micro-badge */}
                {totalChecklists > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium border ${
                      completedChecklistCount === totalChecklists
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                        : 'bg-slate-50/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/40'
                    }`}
                  >
                    <CheckSquare className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                    <span>
                      {completedChecklistCount}/{totalChecklists}
                    </span>
                  </span>
                )}

                {/* Tags */}
                {task.tags &&
                  task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/40"
                    >
                      #{tag}
                    </span>
                  ))}

                {/* Assignee (Người phụ trách): Prominent and refined */}
                {assignee ? (
                  <div
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium text-slate-700 dark:text-slate-300 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/40 shadow-2xs"
                    title={`Người phụ trách: ${assignee.display_name} (${assignee.email})`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-[8.5px] font-bold text-white flex items-center justify-center shrink-0">
                      {assignee.display_name ? assignee.display_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="truncate max-w-[85px]">{assignee.display_name}</span>
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700/60"
                    title="Chưa có người phụ trách"
                  >
                    <User className="w-2.5 h-2.5" />
                    <span>Chưa phân công</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3-Dot Menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Thao tác task"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl bg-white dark:bg-[#131b2e] border border-slate-200/90 dark:border-slate-800 shadow-xl py-1 text-xs animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onEdit(task);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Chỉnh sửa</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyTasks([task.id]);
                      setCopyFeedback(true);
                      setTimeout(() => {
                        setCopyFeedback(false);
                        setIsMenuOpen(false);
                      }, 500);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{copyFeedback ? 'Đã chép task!' : 'Sao chép Task'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      setStagedTaskForChat(task);
                      setIsChatOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-500" />
                    <span>Gửi qua Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onMoveRequest(task);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Chuyển cụm</span>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Xác nhận xóa công việc"
        message={`Bạn có chắc muốn xóa công việc "${task.title}" không?`}
        confirmText="Xác nhận xóa"
        onConfirm={() => deleteTask(task.id)}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </>
  );
};

