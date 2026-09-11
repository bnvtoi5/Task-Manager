import React, { useState } from 'react';
import {
  MoreVertical,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Trash2,
  Edit2,
  FolderKanban
} from 'lucide-react';
import { Cluster, Task } from '../../types';
import { useApp } from '../../context/AppContext';
import { TaskCard } from '../task/TaskCard';
import { ConfirmModal } from '../common/ConfirmModal';

interface ClusterColumnProps {
  cluster: Cluster;
  onAddTask: (clusterId: string) => void;
  onEditTask: (task: Task) => void;
  onDoubleClickTask: (task: Task) => void;
  onMoveSingleTask: (task: Task) => void;
  onEditCluster: (cluster: Cluster) => void;
  className?: string;
  style?: React.CSSProperties;
  taskLayout?: 'stack' | 'grid2' | 'grid3';
}

export const ClusterColumn: React.FC<ClusterColumnProps> = ({
  cluster,
  onAddTask,
  onEditTask,
  onDoubleClickTask,
  onMoveSingleTask,
  onEditCluster,
  className,
  style,
  taskLayout = 'stack',
}) => {
  const {
    db,
    selectedTaskIds,
    selectTask,
    toggleSelectAllInCluster,
    toggleClusterCollapse,
    deleteCluster,
    moveTaskCluster,
    searchQuery,
    filterAssignee,
    filterPriority,
    filterStatus,
  } = useApp();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Filter tasks in cluster
  const tasks = db.tasks.filter((t) => {
    if (t.cluster_id !== cluster.id || t.is_archived) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    // Filter Assignee
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned') {
        if (t.assigned_to) return false;
      } else {
        if (t.assigned_to !== filterAssignee) return false;
      }
    }

    // Filter Priority
    if (filterPriority !== 'all' && t.priority !== filterPriority) {
      return false;
    }

    // Filter Status
    if (filterStatus !== 'all' && t.status !== filterStatus) {
      return false;
    }

    return true;
  });

  // Drop handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      moveTaskCluster(taskId, cluster.id);
    }
  };

  const allClusterTasks = db.tasks.filter((t) => t.cluster_id === cluster.id && !t.is_archived);
  const isAllSelected =
    allClusterTasks.length > 0 &&
    allClusterTasks.every((t) => selectedTaskIds.includes(t.id));

  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={style}
        className={`${className || 'w-80 shrink-0 max-h-full'} flex flex-col rounded-2xl transition-all duration-150 border ${
          isDragOver
            ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
            : 'bg-slate-100/90 dark:bg-[#0e1626]/90 border-slate-200/90 dark:border-slate-800'
        }`}
      >
        {/* Cluster Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-[#121b2d]/40 rounded-t-2xl">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => toggleClusterCollapse(cluster.id)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title={cluster.is_collapsed ? 'Mở rộng cụm' : 'Thu gọn cụm'}
            >
              {cluster.is_collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cluster.color || '#4F46E5' }}
            />

            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {cluster.name}
            </h3>

            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-white dark:bg-[#131b2e] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
              {tasks.length}
            </span>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1">
            {/* Select all in cluster button */}
            {allClusterTasks.length > 0 && (
              <button
                type="button"
                onClick={() => toggleSelectAllInCluster(cluster.id)}
                className={`p-1 rounded-lg transition ${
                  isAllSelected
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
                title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả trong cụm'}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            )}

            {/* Add Task button */}
            <button
              type="button"
              onClick={() => onAddTask(cluster.id)}
              className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition"
              title="Thêm task mới vào cụm này"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* 3-dot Cluster Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-xl bg-white dark:bg-[#131b2e] border border-slate-200/90 dark:border-slate-800 shadow-xl py-1 text-xs animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onEditCluster(cluster);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Sửa cụm</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa cụm</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cluster Description if any */}
        {cluster.description && !cluster.is_collapsed && (
          <div className="px-3.5 pt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
            {cluster.description}
          </div>
        )}

        {/* Tasks List */}
        {!cluster.is_collapsed && (
          <div
            className={`flex-1 overflow-y-auto p-3.5 min-h-[140px] ${
              taskLayout === 'grid2'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0'
                : taskLayout === 'grid3'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 space-y-0'
                : 'space-y-2.5'
            }`}
          >
            {tasks.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-28 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-3 text-center bg-white/30 dark:bg-slate-900/30">
                <FolderKanban className="w-6 h-6 text-slate-400 mb-1" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có công việc nào</p>
                <button
                  type="button"
                  onClick={() => onAddTask(cluster.id)}
                  className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Thêm công việc
                </button>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskIds.includes(task.id)}
                  onSelect={selectTask}
                  onDoubleClick={onDoubleClickTask}
                  onEdit={onEditTask}
                  onMoveRequest={onMoveSingleTask}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* In-app Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Xác nhận xóa cụm công việc"
        message={`Bạn có chắc muốn xóa cụm "${cluster.name}" cùng tất cả các công việc bên trong không? Thao tác này không thể hoàn tác.`}
        confirmText="Xác nhận xóa"
        onConfirm={() => deleteCluster(cluster.id)}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </>
  );
};
