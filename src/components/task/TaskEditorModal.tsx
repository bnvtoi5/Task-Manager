import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Bell,
  User,
  Clock,
  Trash2,
  Send,
  CheckSquare,
  Square,
  Tag,
  Plus,
  Layers,
  Check,
  AlertCircle
} from 'lucide-react';
import { Task, TaskPriority, TaskSeverity, TaskStatus, TaskChecklistItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface TaskEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  targetClusterId?: string;
}

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  targetClusterId,
}) => {
  const {
    db,
    activeWorkspace,
    activePeriod,
    activeDivision,
    createTask,
    updateTask,
    deleteTask,
    setStagedTaskForChat,
    setIsChatOpen,
  } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [severity, setSeverity] = useState<TaskSeverity>('normal');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [displayDueText, setDisplayDueText] = useState('');
  const [clusterId, setClusterId] = useState(targetClusterId || '');
  const [isCompleted, setIsCompleted] = useState(false);

  // Alarm settings
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmAt, setAlarmAt] = useState('');

  // Checklists
  const [checklists, setChecklists] = useState<TaskChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState('');

  // Delete confirm modal
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Active division clusters
  const divisionClusters = db.clusters.filter(
    (c) => c.division_id === (taskToEdit ? taskToEdit.division_id : activeDivision?.id)
  );

  // Available users in system and current workspace
  const availableUsers = React.useMemo(() => {
    if (!activeWorkspace) return db.users.filter((u) => u.is_active);
    const memberUserIds = new Set(
      db.workspace_members
        .filter((m) => m.workspace_id === activeWorkspace.id && m.status === 'active')
        .map((m) => m.user_id)
    );
    memberUserIds.add(activeWorkspace.owner_id);
    const matched = db.users.filter(
      (u) => u.is_active && (memberUserIds.has(u.id) || u.role === 'admin')
    );
    return matched.length > 0 ? matched : db.users.filter((u) => u.is_active);
  }, [activeWorkspace, db.workspace_members, db.users]);

  // Format local ISO for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority || 'medium');
      setSeverity(taskToEdit.severity || 'normal');
      setStatus(taskToEdit.status || 'todo');
      setIsCompleted(taskToEdit.is_completed || false);
      setAssignedTo(taskToEdit.assigned_to || '');
      setDueDate(taskToEdit.due_date || '');
      setDisplayDueText(taskToEdit.display_due_text || '');
      setClusterId(taskToEdit.cluster_id || '');
      setAlarmEnabled(taskToEdit.alarm_enabled || false);
      setAlarmAt(formatDateTimeLocal(taskToEdit.alarm_at));
      setChecklists(taskToEdit.checklists || []);
      setTags(taskToEdit.tags || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setSeverity('normal');
      setStatus('todo');
      setIsCompleted(false);
      setAssignedTo('');
      setDueDate('');
      setDisplayDueText('');
      setClusterId(targetClusterId || divisionClusters[0]?.id || '');
      setAlarmEnabled(false);
      // Default alarm: 1 hour from now
      const defaultAlarm = new Date(Date.now() + 60 * 60 * 1000);
      setAlarmAt(formatDateTimeLocal(defaultAlarm.toISOString()));
      setChecklists([]);
      setTags([]);
    }
  }, [taskToEdit, targetClusterId, isOpen]);

  if (!isOpen) return null;

  // Toggle complete state
  const handleToggleComplete = () => {
    const nextVal = !isCompleted;
    setIsCompleted(nextVal);
    setStatus(nextVal ? 'done' : 'todo');
  };

  // Add checklist item
  const handleAddChecklist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChecklistText.trim()) return;
    const newItem: TaskChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: newChecklistText.trim(),
      completed: false,
    };
    setChecklists([...checklists, newItem]);
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklists(checklists.map((c) => (c.id === id ? { ...c, completed: !c.completed } : c)));
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklists(checklists.filter((c) => c.id !== id));
  };

  // Add Tag
  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTagText.trim().replace(/^#/, '');
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setNewTagText('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Share via chat
  const handleShareToChat = () => {
    if (taskToEdit) {
      setStagedTaskForChat(taskToEdit);
      setIsChatOpen(true);
      onClose();
    }
  };

  // Delete task
  const handleDeleteTask = () => {
    if (taskToEdit) {
      deleteTask(taskToEdit.id);
      onClose();
    }
  };

  // Save changes
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!clusterId) {
      alert('Vui lòng chọn Cụm (Cluster) cho công việc!');
      return;
    }

    const isoAlarm = alarmEnabled && alarmAt ? new Date(alarmAt).toISOString() : null;

    if (taskToEdit) {
      updateTask(taskToEdit.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        severity,
        status: isCompleted ? 'done' : status,
        is_completed: isCompleted,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        display_due_text: displayDueText.trim() || null,
        alarm_enabled: alarmEnabled,
        alarm_at: isoAlarm,
        alarm_triggered: alarmEnabled ? false : taskToEdit.alarm_triggered,
        checklists,
        tags,
        cluster_id: clusterId,
      });
    } else {
      if (!activeWorkspace || !activePeriod || !activeDivision) {
        alert('Thiếu thông tin phòng làm việc hoặc phân chia.');
        return;
      }

      createTask({
        workspace_id: activeWorkspace.id,
        period_id: activePeriod.id,
        division_id: activeDivision.id,
        cluster_id: clusterId,
        assigned_to: assignedTo || null,
        title: title.trim(),
        description: description.trim(),
        priority,
        severity,
        status: isCompleted ? 'done' : status,
        is_completed: isCompleted,
        due_date: dueDate || null,
        display_due_text: displayDueText.trim() || null,
        alarm_enabled: alarmEnabled,
        alarm_at: isoAlarm,
        alarm_triggered: false,
        checklists,
        tags,
        sort_order: 0,
        is_archived: false,
        is_private: false,
      });
    }

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
        <div
          className="w-full max-w-xl bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#131d31] shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`flex items-center gap-2 font-bold text-xs tracking-wider uppercase transition ${
                  isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-200 hover:text-indigo-600'
                }`}
                title="Đánh dấu hoàn thành"
              >
                {isCompleted ? (
                  <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                )}
                <span>Chi tiết công việc</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {taskToEdit && (
                <>
                  <button
                    type="button"
                    onClick={handleShareToChat}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition"
                    title="Ghim task vào khung chat để gửi cho bạn bè"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi qua Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    title="Xóa công việc này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Tiêu đề công việc <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Viết báo cáo tuần, Thiết kế landing page..."
                required
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
              />
            </div>

            {/* Cluster & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Cluster Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Khu vực / Cột
                </label>
                <div className="relative">
                  <select
                    value={clusterId}
                    onChange={(e) => setClusterId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                  >
                    {divisionClusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Mức độ ưu tiên
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-semibold text-center">
                  {(
                    [
                      { id: 'low', label: 'Thấp' },
                      { id: 'medium', label: 'Trung bình' },
                      { id: 'high', label: 'Ưu tiên cao' },
                      { id: 'urgent', label: 'Khẩn cấp' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPriority(item.id)}
                      className={`py-1 rounded-lg transition ${
                        priority === item.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Assignee Row */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>Người phụ trách (Assignee)</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
              >
                <option value="">-- Chưa gán người phụ trách --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} {u.role === 'admin' ? '(Quản trị)' : `(${u.email})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Alarm Box (Matching image.png yellow highlight) */}
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Báo thức & Nhắc nhở công việc (Alarm)</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-900 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={alarmEnabled}
                    onChange={(e) => setAlarmEnabled(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <span>Bật báo thức</span>
                </label>
              </div>

              {alarmEnabled && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300 shrink-0">
                      Thời gian báo thức (Giờ & Ngày):
                    </span>
                    <input
                      type="datetime-local"
                      value={alarmAt}
                      onChange={(e) => setAlarmAt(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    ⚡ Khi đến giờ hẹn, ứng dụng sẽ phát chuông báo, gửi thông báo Web và gửi Email (nếu đã bật trong Cài đặt).
                  </p>
                </div>
              )}
            </div>

            {/* Display Due Text on card */}
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Hạn chót hiển thị trên thẻ (VD: 16:00, Chiều nay)</span>
              </label>
              <input
                type="text"
                value={displayDueText}
                onChange={(e) => setDisplayDueText(e.target.value)}
                placeholder="VD: 15:30 hoặc Hôm nay"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Ghi chú & Mô tả chi tiết
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Thêm mô tả, tài liệu tham khảo hoặc lưu ý quan trọng..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
              />
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Danh sách việc nhỏ (Checklist)</span>
                </label>
                {checklists.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {checklists.filter((c) => c.completed).length}/{checklists.length} việc
                  </span>
                )}
              </div>

              {/* Checklist items */}
              {checklists.length > 0 && (
                <div className="space-y-1.5 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  {checklists.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleChecklistItem(item.id)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {item.completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span
                          className={`break-all ${
                            item.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add checklist input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklist();
                    }
                  }}
                  placeholder="Thêm mục checklist mới..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddChecklist()}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition shrink-0"
                >
                  + Thêm
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Thẻ phân loại (Tags)</span>
              </label>

              {/* Tag Badges */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/80 badge-nowrap"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-rose-500 transition ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add tag input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Nhập tên thẻ (VD: Quan trọng, Báo cáo)..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition shrink-0"
                >
                  + Thêm thẻ
                </button>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#131d31] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition"
            >
              {taskToEdit ? 'Lưu thay đổi' : 'Tạo công việc'}
            </button>
          </div>
        </div>
      </div>

      {/* In-app Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Xác nhận xóa công việc"
        message={`Bạn có chắc chắn muốn xóa công việc "${title}" không? Thao tác này không thể hoàn tác.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleDeleteTask}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </>
  );
};
