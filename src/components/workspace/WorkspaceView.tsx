import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Layers,
  Calendar,
  Briefcase,
  Globe,
  Lock,
  Columns3,
  Maximize2,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Grid,
  List,
  Sliders,
  Trash2,
  LayoutGrid,
  CheckCircle2,
  Mic,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Task, Cluster, TaskPriority, BoardMode } from '../../types';
import { ClusterColumn } from '../cluster/ClusterColumn';
import { TaskEditorModal } from '../task/TaskEditorModal';
import { BulkActionBar } from '../task/BulkActionBar';
import { FloatingClipboardBar } from '../task/FloatingClipboardBar';
import { BulkMoveModal } from '../task/ActionModals';
import { CreateBoardModeModal } from './CreateBoardModeModal';
import { AddColumnToModeModal } from './AddColumnToModeModal';
import { EditColumnInModeModal } from './EditColumnInModeModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { VoiceTaskCreatorModal } from '../task/VoiceTaskCreatorModal';
import { getWeekdayClusterId, getPriorityClusterId } from '../../utils/boardModeUtils';

interface WorkspaceViewProps {
  onOpenWorkspaceModal: (mode: 'create' | 'join') => void;
  onOpenPeriodModal: () => void;
  onOpenDivisionModal: () => void;
  onOpenClusterModal: (cluster?: Cluster | null) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  onOpenWorkspaceModal,
  onOpenPeriodModal,
  onOpenDivisionModal,
  onOpenClusterModal,
}) => {
  const {
    db,
    currentUser,
    activeWorkspace,
    activePeriod,
    activeDivision,
    activeClusterId,
    setActiveClusterId,
    viewMode,
    setViewMode,
    selectedTaskIds,
    clearTaskSelection,
    activeBoardModeId,
    setActiveBoardModeId,
    createBoardMode,
    deleteBoardMode,
    addColumnToBoardMode,
    updateBoardModeColumn,
    deleteBoardModeColumn,
    deleteCluster,
    moveTaskInMode,
    reorderTaskInMode,
    collapsedClusterIds,
    copyTasks,
    duplicateTasks,
    pasteTasks,
    copiedTaskIds,
    showToast,
  } = useApp();

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [targetClusterIdForNewTask, setTargetClusterIdForNewTask] = useState<string | undefined>(undefined);
  const [isCreateModeModalOpen, setIsCreateModeModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [columnToEditInMode, setColumnToEditInMode] = useState<{ id: string; name: string; color?: string } | null>(null);
  const [modeToDelete, setModeToDelete] = useState<BoardMode | null>(null);
  const [isDeleteModeConfirmOpen, setIsDeleteModeConfirmOpen] = useState(false);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [singleTaskMove, setSingleTaskMove] = useState<Task | null>(null);

  // Single cluster design mode state (size + task layout)
  const [singleClusterWidth, setSingleClusterWidth] = useState<'md' | 'lg' | 'xl' | 'full'>(() => {
    return (localStorage.getItem('wtm_sc_width') as 'md' | 'lg' | 'xl' | 'full') || 'xl';
  });
  const [singleTaskLayout, setSingleTaskLayout] = useState<'stack' | 'grid2' | 'grid3'>(() => {
    return (localStorage.getItem('wtm_sc_layout') as 'stack' | 'grid2' | 'grid3') || 'grid2';
  });

  const handleSetWidth = (w: 'md' | 'lg' | 'xl' | 'full') => {
    setSingleClusterWidth(w);
    localStorage.setItem('wtm_sc_width', w);
  };

  const handleSetLayout = (l: 'stack' | 'grid2' | 'grid3') => {
    setSingleTaskLayout(l);
    localStorage.setItem('wtm_sc_layout', l);
  };

  // Windows Explorer-like deselect on click outside
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (selectedTaskIds.length === 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest('[data-task-card]') ||
        target.closest('[data-bulk-bar]') ||
        target.closest('.fixed.z-50') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea')
      ) {
        return;
      }

      clearTaskSelection();
    };

    window.addEventListener('mousedown', handleGlobalMouseDown);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown);
  }, [selectedTaskIds, clearTaskSelection]);

  // Available Board Modes for the active division (Presets + Custom modes of this division)
  const availableBoardModes = useMemo(() => {
    const all = db.board_modes || [];
    return all.filter(
      (m) => m.is_preset || (activeDivision && m.division_id === activeDivision.id)
    );
  }, [db.board_modes, activeDivision]);

  // Active Board Mode
  const activeBoardMode = useMemo(() => {
    if (availableBoardModes.length === 0) return null;
    return (
      availableBoardModes.find((m) => m.id === activeBoardModeId) ||
      availableBoardModes[0] ||
      null
    );
  }, [availableBoardModes, activeBoardModeId]);

  // Clusters to display in active mode
  const activeClusters: Cluster[] = useMemo(() => {
    if (!activeDivision || !activeBoardMode) return [];
    if (activeBoardMode.id === 'kanban') {
      const divClusters = db.clusters
        .filter((c) => c.division_id === activeDivision.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          ...c,
          is_collapsed: !!c.is_collapsed || collapsedClusterIds.includes(c.id),
        }));
      return divClusters;
    }

    return (activeBoardMode.clusters || []).map((c, idx) => ({
      id: c.id,
      division_id: activeDivision.id,
      name: c.name,
      description: '',
      color: c.color || '#6366F1',
      icon: (c as any).icon || 'folder',
      sort_order: c.sort_order || idx + 1,
      is_collapsed: !!c.is_collapsed || collapsedClusterIds.includes(c.id),
      created_by: currentUser?.id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }, [activeDivision, activeBoardMode, db.clusters, currentUser, collapsedClusterIds]);

  // Tasks in this division mapped to their clusters in the active mode
  const tasksByClusterId: Record<string, Task[]> = useMemo(() => {
    if (!activeDivision || !activeBoardMode) return {};
    const divisionTasks = db.tasks.filter(
      (t) => t.division_id === activeDivision.id && !t.is_archived
    );

    const mapping: Record<string, Task[]> = {};
    activeClusters.forEach((c) => {
      mapping[c.id] = [];
    });

    const isKanban = activeBoardMode.id === 'kanban';
    const isWeekday = activeBoardMode.id === 'weekday';
    const isPriority = activeBoardMode.id === 'priority';
    const fallbackClusterId = activeClusters[0]?.id;

    divisionTasks.forEach((t) => {
      let targetClusterId: string | undefined;

      if (t.mode_clusters && t.mode_clusters[activeBoardMode.id]) {
        targetClusterId = t.mode_clusters[activeBoardMode.id];
      } else if (isKanban) {
        targetClusterId = t.cluster_id;
      } else if (isWeekday) {
        targetClusterId = getWeekdayClusterId(t.due_date);
      } else if (isPriority) {
        targetClusterId = getPriorityClusterId(t.priority);
      } else if (t.cluster_id && mapping[t.cluster_id]) {
        targetClusterId = t.cluster_id;
      } else {
        targetClusterId = fallbackClusterId;
      }

      if (targetClusterId && mapping[targetClusterId]) {
        mapping[targetClusterId].push(t);
      } else if (fallbackClusterId && mapping[fallbackClusterId]) {
        mapping[fallbackClusterId].push(t);
      }
    });

    return mapping;
  }, [activeDivision, db.tasks, activeClusters, activeBoardMode]);

  // Active cluster for Single mode
  const selectedClusterIndex = activeClusters.findIndex((c) => c.id === activeClusterId);
  const effectiveIndex = selectedClusterIndex >= 0 ? selectedClusterIndex : 0;
  const selectedCluster = activeClusters[effectiveIndex] || null;

  // Single view cluster navigation
  const handleNavigateCluster = (direction: -1 | 1) => {
    if (activeClusters.length === 0) return;
    const nextIndex = (effectiveIndex + direction + activeClusters.length) % activeClusters.length;
    setActiveClusterId(activeClusters[nextIndex].id);
  };

  // Keyboard navigation for single view
  useEffect(() => {
    if (viewMode !== 'single') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft') {
        handleNavigateCluster(-1);
      } else if (e.key === 'ArrowRight') {
        handleNavigateCluster(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, effectiveIndex, activeClusters]);

  // Global Keyboard Shortcuts (Ctrl+C: Copy, Ctrl+V: Paste, Ctrl+D: Duplicate)
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      // Ctrl+C or Cmd+C: Copy selected tasks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          copyTasks(selectedTaskIds);
          showToast(`Đã sao chép ${selectedTaskIds.length} công việc vào bộ nhớ tạm (Ctrl+C)`);
        }
      }

      // Ctrl+V or Cmd+V: Paste copied tasks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedTaskIds.length > 0) {
          e.preventDefault();
          const targetClusterId = activeClusterId || activeClusters[0]?.id;
          if (targetClusterId) {
            const targetClu = activeClusters.find((c) => c.id === targetClusterId);
            pasteTasks(targetClusterId, { inherit: false });
            showToast(
              `Đã dán ${copiedTaskIds.length} công việc vào cụm "${targetClu?.name || 'mục tiêu'}" (Ctrl+V)`
            );
          }
        }
      }

      // Ctrl+D or Cmd+D: Duplicate selected tasks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          duplicateTasks(selectedTaskIds);
          showToast(`Đã nhân bản ${selectedTaskIds.length} công việc (Ctrl+D)`);
          clearTaskSelection();
        }
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [
    selectedTaskIds,
    copiedTaskIds,
    activeClusterId,
    activeClusters,
    copyTasks,
    pasteTasks,
    duplicateTasks,
    clearTaskSelection,
    showToast,
  ]);

  // Task Handlers
  const [isVoiceTaskModalOpen, setIsVoiceTaskModalOpen] = useState(false);
  const [voiceTaskTargetClusterId, setVoiceTaskTargetClusterId] = useState<string | undefined>(undefined);

  const handleOpenVoiceTaskCreator = (clusterId?: string) => {
    setVoiceTaskTargetClusterId(clusterId);
    setIsVoiceTaskModalOpen(true);
  };

  const handleOpenDetailedFromVoice = (prefilled: Partial<Task>) => {
    setTaskToEdit(prefilled as Task);
    setTargetClusterIdForNewTask(prefilled.cluster_id);
    setIsTaskModalOpen(true);
  };

  const handleAddTask = (clusterId: string) => {
    setTaskToEdit(null);
    setTargetClusterIdForNewTask(clusterId);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setTargetClusterIdForNewTask(task.cluster_id);
    setIsTaskModalOpen(true);
  };

  const handleDoubleClickTask = (task: Task) => {
    handleEditTask(task);
  };

  const handleMoveSingleTask = (task: Task) => {
    setSingleTaskMove(task);
    setIsBulkMoveOpen(true);
  };

  const handleOpenAddCluster = () => {
    if (!activeBoardMode) {
      setIsCreateModeModalOpen(true);
      return;
    }
    if (activeBoardMode.id === 'kanban') {
      onOpenClusterModal(null);
    } else {
      setIsAddColumnModalOpen(true);
    }
  };

  const handleEditClusterOrColumn = (cluster: Cluster) => {
    if (!activeBoardMode) return;
    if (activeBoardMode.id === 'kanban') {
      onOpenClusterModal(cluster);
    } else {
      setColumnToEditInMode({
        id: cluster.id,
        name: cluster.name,
        color: cluster.color,
      });
    }
  };

  const handleDeleteClusterOrColumn = (clusterId: string) => {
    if (!activeBoardMode) return;
    if (activeBoardMode.id === 'kanban') {
      deleteCluster(clusterId);
    } else {
      deleteBoardModeColumn(activeBoardMode.id, clusterId);
    }
  };

  const handleDropTaskInCurrentMode = (taskId: string, targetClusterId: string) => {
    if (!activeBoardMode) return;
    moveTaskInMode(taskId, activeBoardMode.id, targetClusterId);
  };

  const handleReorderTaskInCurrentMode = (
    sourceTaskId: string,
    targetTaskId: string,
    position: 'before' | 'after',
    clusterId: string
  ) => {
    if (!activeBoardMode) return;
    reorderTaskInMode(sourceTaskId, targetTaskId, position, activeBoardMode.id, clusterId);
  };

  // EMPTY STATE 1: No active workspace
  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#0c1220]">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
          <Briefcase className="w-8 h-8" />
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            1. Tạo hoặc chọn Phòng
          </span>
          <span>›</span>
          <span className="text-slate-400">2. Period</span>
          <span>›</span>
          <span className="text-slate-400">3. Phân chia</span>
          <span>›</span>
          <span className="text-slate-400">4. Chế độ bảng</span>
          <span>›</span>
          <span className="text-slate-400">5. Cụm & Việc</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Chào mừng bạn đến với Hệ thống Quản lý Task
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Hiện tại bạn chưa chọn hoặc chưa có phòng làm việc nào. Hãy tạo phòng làm việc đầu tiên hoặc tham gia bằng mã mời để bắt đầu quy trình quản lý: <strong>Phòng → Period → Division → Chế độ bảng → Cụm</strong>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => onOpenWorkspaceModal('create')}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
          >
            + Tạo phòng làm việc
          </button>
          <button
            type="button"
            onClick={() => onOpenWorkspaceModal('join')}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl shadow-xs transition"
          >
            Tham gia bằng mã
          </button>
        </div>
      </div>
    );
  }

  // EMPTY STATE 2: Workspace has no periods
  if (!activePeriod) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#0c1220]">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
          <Calendar className="w-8 h-8" />
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 1. Phòng: {activeWorkspace.name}
          </span>
          <span>›</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            2. Tạo Period
          </span>
          <span>›</span>
          <span className="text-slate-400">3. Phân chia</span>
          <span>›</span>
          <span className="text-slate-400">4. Chế độ bảng</span>
          <span>›</span>
          <span className="text-slate-400">5. Cụm & Việc</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Chưa có Period (Thời gian) nào trong phòng {activeWorkspace.name}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Period là đơn vị thời gian cấp cao (ví dụ: &quot;Tháng 10/2026&quot;, &quot;Sprint 14&quot;, &quot;Quý 4&quot;). Hãy tạo Period trước để làm cơ sở phân chia công việc.
        </p>
        <button
          type="button"
          onClick={onOpenPeriodModal}
          className="mt-6 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
        >
          + Tạo Period mới
        </button>
      </div>
    );
  }

  // EMPTY STATE 3: Period has no divisions
  if (!activeDivision) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#0c1220]">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-4 shadow-xs">
          <Layers className="w-8 h-8" />
        </div>

        {/* Stepper */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 1. Phòng: {activeWorkspace.name}
          </span>
          <span>›</span>
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 2. Period: {activePeriod.name}
          </span>
          <span>›</span>
          <span className="font-bold text-sky-600 dark:text-sky-400">
            3. Tạo Phân chia (Division)
          </span>
          <span>›</span>
          <span className="text-slate-400">4. Chế độ bảng</span>
          <span>›</span>
          <span className="text-slate-400">5. Cụm & Việc</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Chưa có Phân chia (Division) trong {activePeriod.name}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Division giúp bạn quản lý các khu vực làm việc (ví dụ: &quot;Marketing&quot;, &quot;Phát triển sản phẩm&quot; hoặc phân chia Cá nhân riêng tư).
        </p>
        <button
          type="button"
          onClick={onOpenDivisionModal}
          className="mt-6 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
        >
          + Tạo Division mới
        </button>
      </div>
    );
  }

  // EMPTY STATE 4: Division has no board modes (Step 4 in Room > Period > Division > Board Mode > Cluster)
  if (!activeBoardMode || availableBoardModes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#0c1220] overflow-y-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-xs">
          <LayoutGrid className="w-8 h-8" />
        </div>

        {/* Stepper indicator */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 1. Phòng: {activeWorkspace.name}
          </span>
          <span>›</span>
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 2. Period: {activePeriod.name}
          </span>
          <span>›</span>
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 3. Phân chia: {activeDivision.name}
          </span>
          <span>›</span>
          <span className="font-bold text-amber-600 dark:text-amber-400">
            4. Chọn Chế độ bảng
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Chưa có Chế độ Bảng nào trong {activeDivision.name}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Chế độ bảng thiết lập các cụm (cột) phân loại việc. Hãy chọn nhanh một mẫu cấu trúc sẵn có bên dưới hoặc tự tạo chế độ bảng tùy chỉnh:
        </p>

        {/* Quick starter templates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl w-full mt-6 text-left">
          {/* Option 1: Kanban 3 Cột */}
          <div
            onClick={() => {
              createBoardMode('Kanban tiến độ', 'Theo dõi luồng công việc từ Cần làm đến Hoàn thành', [
                { id: `c-${Date.now()}-todo`, name: 'Cần làm', color: '#6366F1', sort_order: 1 },
                { id: `c-${Date.now()}-doing`, name: 'Đang làm', color: '#F59E0B', sort_order: 2 },
                { id: `c-${Date.now()}-done`, name: 'Hoàn thành', color: '#10B981', sort_order: 3 },
              ]);
            }}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition shadow-xs hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                Kanban Tiến độ
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                Khuyên dùng
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              3 cụm cơ bản: Cần làm, Đang làm, Hoàn thành.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              <span>Khởi tạo ngay</span>
              <span>→</span>
            </div>
          </div>

          {/* Option 2: 7 Days Week */}
          <div
            onClick={() => {
              createBoardMode('Kế hoạch tuần', 'Phân bổ và thực hiện công việc theo các ngày trong tuần', [
                { id: `c-${Date.now()}-mon`, name: 'Thứ Hai', color: '#3B82F6', sort_order: 1 },
                { id: `c-${Date.now()}-tue`, name: 'Thứ Ba', color: '#06B6D4', sort_order: 2 },
                { id: `c-${Date.now()}-wed`, name: 'Thứ Tư', color: '#10B981', sort_order: 3 },
                { id: `c-${Date.now()}-thu`, name: 'Thứ Năm', color: '#F59E0B', sort_order: 4 },
                { id: `c-${Date.now()}-fri`, name: 'Thứ Sáu', color: '#EC4899', sort_order: 5 },
                { id: `c-${Date.now()}-sat`, name: 'Thứ Bảy', color: '#8B5CF6', sort_order: 6 },
                { id: `c-${Date.now()}-sun`, name: 'Chủ Nhật', color: '#64748B', sort_order: 7 },
              ]);
            }}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition shadow-xs hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                Kế hoạch 7 Ngày
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300">
                Tuần lễ
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              7 cụm từ Thứ Hai đến Chủ Nhật để lập lịch hàng ngày.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              <span>Khởi tạo ngay</span>
              <span>→</span>
            </div>
          </div>

          {/* Option 3: Eisenhower Matrix */}
          <div
            onClick={() => {
              createBoardMode('Ma trận Eisenhower', 'Phân loại công việc theo mức độ khẩn cấp và quan trọng', [
                { id: `c-${Date.now()}-p1`, name: 'Khẩn & Quan trọng', color: '#EF4444', sort_order: 1 },
                { id: `c-${Date.now()}-p2`, name: 'Quan trọng', color: '#F59E0B', sort_order: 2 },
                { id: `c-${Date.now()}-p3`, name: 'Khẩn cấp', color: '#3B82F6', sort_order: 3 },
                { id: `c-${Date.now()}-p4`, name: 'Việc phụ', color: '#64748B', sort_order: 4 },
              ]);
            }}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition shadow-xs hover:shadow-md group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                Ma trận Eisenhower
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300">
                Ưu tiên
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              4 cụm phân cấp mức độ ưu tiên và hành động.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              <span>Khởi tạo ngay</span>
              <span>→</span>
            </div>
          </div>
        </div>

        {/* Custom board mode button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setIsCreateModeModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>+ Tự tạo Chế độ Bảng tùy biến</span>
          </button>
        </div>

        {/* Modal if user clicks custom */}
        <CreateBoardModeModal
          isOpen={isCreateModeModalOpen}
          onClose={() => setIsCreateModeModalOpen(false)}
          onCreateMode={(name, description, clusters) => {
            createBoardMode(name, description, clusters);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/60 dark:bg-[#0a0f1d]">
      {/* Top Workspace Header Bar */}
      <div className="flex flex-col gap-2.5 px-4 sm:px-6 py-2.5 bg-white/95 dark:bg-[#0e1626]/95 border-b border-slate-200/90 dark:border-slate-800 backdrop-blur-xs shrink-0">
        {/* Row 1: Breadcrumb + Mode Selector (PC pills / Mobile dropdown) + Layout Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb Hierarchy */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {activePeriod.name}
              </span>
              <span>/</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                {activeDivision.visibility === 'public' ? (
                  <span title="Công khai" className="shrink-0 flex items-center">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  </span>
                ) : (
                  <span title="Riêng tư" className="shrink-0 flex items-center">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                  </span>
                )}
                <span className="truncate">{activeDivision.name}</span>
              </span>
            </div>
          </div>

          {/* View Mode Switcher: Toàn cảnh vs Từng cụm vs Smart Area (Available in ALL Modes) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'full'
                    ? 'bg-white dark:bg-[#152037] text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Xem tất cả các cụm (Full View)"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Toàn cảnh</span>
                <span className="sm:hidden">Đầy đủ</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'single'
                    ? 'bg-white dark:bg-[#152037] text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Xem từng cụm (Single View)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Từng cụm</span>
                <span className="sm:hidden">Đơn</span>
              </button>
            </div>

            {/* Action Buttons: Voice Task & Add Cluster */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenVoiceTaskCreator()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                title="Tạo công việc bằng giọng nói (Voice-to-Text)"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Nói để tạo việc</span>
                <span className="sm:hidden">Thoại</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddCluster}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                title="Thêm cụm (cột) mới vào bảng"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm cụm</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Chế độ Bảng (Board Mode Selector) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          {!activeBoardMode ? (
            <div className="flex items-center justify-between gap-2 w-full py-0.5">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <FolderKanban className="w-4 h-4 text-indigo-500" />
                <span>Chưa có chế độ bảng nào trong phân chia này.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo Chế độ Bảng</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile / Android Dropdown */}
              <div className="sm:hidden flex items-center gap-1.5 w-full">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  Chế độ:
                </span>
                <select
                  value={activeBoardMode.id}
                  onChange={(e) => setActiveBoardModeId(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {availableBoardModes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.is_preset ? '' : '(Tự tạo)'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreateModeModalOpen(true)}
                  className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 shrink-0 transition"
                  title="Tạo chế độ mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={activeBoardMode.is_preset}
                  onClick={() => {
                    if (!activeBoardMode.is_preset) {
                      setModeToDelete(activeBoardMode);
                      setIsDeleteModeConfirmOpen(true);
                    }
                  }}
                  className={`p-1.5 rounded-lg border shrink-0 transition ${
                    activeBoardMode.is_preset
                      ? 'text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-40'
                      : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                  }`}
                  title={activeBoardMode.is_preset ? 'Chế độ mặc định không thể xóa' : `Xóa chế độ đang chọn (${activeBoardMode.name})`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* PC / Wide Screen: Segmented Mode Switcher */}
              <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
                  Chế độ bảng:
                </span>
                {availableBoardModes.map((m) => {
                  const isActive = activeBoardMode.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveBoardModeId(m.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-[#131e33] text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{m.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {m.clusters?.length || activeClusters.length} cột
                      </span>
                    </button>
                  );
                })}

                {/* Nút Tạo chế độ mới (icon only, không có chữ mô tả) */}
                <button
                  type="button"
                  onClick={() => setIsCreateModeModalOpen(true)}
                  className="p-1.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                  title="Tạo chế độ mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {/* Nút Thùng rác xóa chế độ đang chọn (ngay kế bên nút tạo chế độ mới, icon only, không có chữ mô tả) */}
                <button
                  type="button"
                  disabled={activeBoardMode.is_preset}
                  onClick={() => {
                    if (!activeBoardMode.is_preset) {
                      setModeToDelete(activeBoardMode);
                      setIsDeleteModeConfirmOpen(true);
                    }
                  }}
                  className={`p-1.5 rounded-xl border transition ${
                    activeBoardMode.is_preset
                      ? 'text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-40'
                      : 'text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 shadow-2xs'
                  }`}
                  title={activeBoardMode.is_preset ? 'Chế độ mặc định không thể xóa' : `Xóa chế độ đang chọn (${activeBoardMode.name})`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="hidden sm:block text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {activeBoardMode.description}
              </div>
            </>
          )}
        </div>
      </div>

      {/* VIEW CONTENT BASED ON VIEW MODE */}
      <div className="flex-1 overflow-hidden">
        {!activeBoardMode ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
              <FolderKanban className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Chưa có chế độ bảng nào trong {activeDivision.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
              Bạn có thể tự tạo chế độ bảng đầu tiên (ví dụ: Kanban tiến độ, Phân loại công việc...) và các cụm cột theo nhu cầu làm việc.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModeModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tạo Chế độ Bảng Mới</span>
            </button>
          </div>
        ) : activeClusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <FolderKanban className="w-12 h-12 text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Chưa có Cụm nào trong chế độ {activeBoardMode.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Hãy tạo cụm đầu tiên để bắt đầu quản lý và phân loại task.
            </p>
            <button
              type="button"
              onClick={handleOpenAddCluster}
              className="mt-4 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              + Tạo Cụm mới
            </button>
          </div>
        ) : viewMode === 'single' ? (
          /* Single Cluster View with Left/Right Navigation & Design Customization */
          <div className="flex flex-col h-full overflow-hidden p-3 sm:p-5 bg-slate-50/50 dark:bg-[#090e1a]">
            {/* Cluster Navigation Header (Dropdown + Left/Right arrows + Design Toolbar) */}
            <div
              className={`flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0 mx-auto w-full transition-all duration-300 ${
                singleClusterWidth === 'md'
                  ? 'max-w-3xl'
                  : singleClusterWidth === 'lg'
                  ? 'max-w-5xl'
                  : singleClusterWidth === 'xl'
                  ? 'max-w-7xl'
                  : 'max-w-full px-2'
              }`}
            >
              <div className="flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigateCluster(-1)}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200 dark:border-slate-700"
                  title="Cụm trước (Phím mũi tên Trái ←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Cụm ({effectiveIndex + 1}/{activeClusters.length}):
                  </span>
                  <select
                    value={selectedCluster?.id || ''}
                    onChange={(e) => setActiveClusterId(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    {activeClusters.map((c, idx) => (
                      <option key={c.id} value={c.id}>
                        {idx + 1}. {c.name} ({tasksByClusterId[c.id]?.length || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigateCluster(1)}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200 dark:border-slate-700"
                  title="Cụm sau (Phím mũi tên Phải →)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Design Controls: Width + Layout */}
              <div className="flex items-center gap-2 relative">
                {/* Width selector pills */}
                <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-[#131d31] border border-slate-300/70 dark:border-slate-800 text-[11px]">
                  <span className="px-2 text-slate-500 dark:text-slate-400 font-medium">Khổ:</span>
                  <button
                    type="button"
                    onClick={() => handleSetWidth('md')}
                    className={`px-2 py-1 rounded-lg font-medium transition ${
                      singleClusterWidth === 'md'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Gọn
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetWidth('lg')}
                    className={`px-2 py-1 rounded-lg font-medium transition ${
                      singleClusterWidth === 'lg'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Rộng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetWidth('xl')}
                    className={`px-2 py-1 rounded-lg font-medium transition ${
                      singleClusterWidth === 'xl'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Cực đại
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetWidth('full')}
                    className={`px-2 py-1 rounded-lg font-medium transition ${
                      singleClusterWidth === 'full'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Tràn màn hình
                  </button>
                </div>

                {/* Task layout selector pills */}
                <div className="flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-[#131d31] border border-slate-300/70 dark:border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSetLayout('stack')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition ${
                      singleTaskLayout === 'stack'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                    title="Xếp 1 cột dọc truyền thống"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">1 cột</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetLayout('grid2')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition ${
                      singleTaskLayout === 'grid2'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                    title="Lưới 2 cột cho màn hình rộng"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">2 cột</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetLayout('grid3')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition ${
                      singleTaskLayout === 'grid3'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                    title="Lưới 3 cột siêu rộng"
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">3 cột</span>
                  </button>
                </div>
              </div>
            </div>

            {selectedCluster && (
              <div
                className={`flex-1 mx-auto w-full h-full overflow-hidden flex flex-col transition-all duration-300 ${
                  singleClusterWidth === 'md'
                    ? 'max-w-3xl'
                    : singleClusterWidth === 'lg'
                    ? 'max-w-5xl'
                    : singleClusterWidth === 'xl'
                    ? 'max-w-7xl'
                    : 'max-w-full'
                }`}
              >
                <ClusterColumn
                  cluster={selectedCluster}
                  explicitTasks={tasksByClusterId[selectedCluster.id] || []}
                  modeId={activeBoardMode.id}
                  onDropTaskInMode={handleDropTaskInCurrentMode}
                  onReorderTaskInMode={handleReorderTaskInCurrentMode}
                  allowDelete={true}
                  allowEdit={true}
                  onAddTask={handleAddTask}
                  onVoiceAddTask={handleOpenVoiceTaskCreator}
                  onEditTask={handleEditTask}
                  onDoubleClickTask={handleDoubleClickTask}
                  onMoveSingleTask={handleMoveSingleTask}
                  onEditCluster={handleEditClusterOrColumn}
                  onDeleteCluster={handleDeleteClusterOrColumn}
                  taskLayout={singleTaskLayout}
                  className="shadow-md border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/90 dark:bg-[#101827]/90"
                />
              </div>
            )}
          </div>
        ) : (
          /* Full View: All clusters of current mode side by side */
          <div className="flex items-start gap-4 p-4 sm:p-6 h-full overflow-x-auto overflow-y-hidden bg-slate-50/50 dark:bg-[#090e1a]">
            {activeClusters.map((cluster) => (
              <ClusterColumn
                key={cluster.id}
                cluster={cluster}
                explicitTasks={tasksByClusterId[cluster.id] || []}
                modeId={activeBoardMode.id}
                onDropTaskInMode={handleDropTaskInCurrentMode}
                onReorderTaskInMode={handleReorderTaskInCurrentMode}
                allowDelete={true}
                allowEdit={true}
                onAddTask={handleAddTask}
                onVoiceAddTask={handleOpenVoiceTaskCreator}
                onEditTask={handleEditTask}
                onDoubleClickTask={handleDoubleClickTask}
                onMoveSingleTask={handleMoveSingleTask}
                onEditCluster={handleEditClusterOrColumn}
                onDeleteCluster={handleDeleteClusterOrColumn}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk Action Bar when tasks are selected */}
      {selectedTaskIds.length > 0 && (
        <BulkActionBar
          onOpenBulkMove={() => setIsBulkMoveOpen(true)}
        />
      )}

      {/* Floating Clipboard Bar for copied tasks */}
      <FloatingClipboardBar />

      {/* Task Creation & Editing Modal */}
      <TaskEditorModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        targetClusterId={targetClusterIdForNewTask}
        selectedClusterId={selectedCluster?.id || activeClusterId || undefined}
        activeBoardModeId={activeBoardMode?.id || ''}
      />

      {/* Bulk / Single Move Modal */}
      <BulkMoveModal
        isOpen={isBulkMoveOpen}
        onClose={() => {
          setIsBulkMoveOpen(false);
          setSingleTaskMove(null);
        }}
        clusters={activeClusters}
        taskIdsToMove={singleTaskMove ? [singleTaskMove.id] : selectedTaskIds}
        modeId={activeBoardMode?.id || ''}
      />

      {/* Create Board Mode Modal */}
      <CreateBoardModeModal
        isOpen={isCreateModeModalOpen}
        onClose={() => setIsCreateModeModalOpen(false)}
        onCreateMode={(name, description, clusters) => {
          createBoardMode(name, description, clusters);
        }}
      />

      {/* Add Column/Cluster to Current Mode Modal */}
      <AddColumnToModeModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
        modeName={activeBoardMode?.name || ''}
        onAddColumn={(name, color) => {
          if (activeBoardMode) {
            addColumnToBoardMode(activeBoardMode.id, name, color);
          }
        }}
      />

      {/* Edit Column/Cluster Modal in Current Mode */}
      <EditColumnInModeModal
        isOpen={!!columnToEditInMode}
        onClose={() => setColumnToEditInMode(null)}
        column={columnToEditInMode}
        modeName={activeBoardMode?.name || ''}
        onSave={(colId, name, color) => {
          if (activeBoardMode) {
            updateBoardModeColumn(activeBoardMode.id, colId, name, color);
          }
          setColumnToEditInMode(null);
        }}
      />

      {/* Confirm Delete Board Mode Modal */}
      <ConfirmModal
        isOpen={isDeleteModeConfirmOpen}
        title="Xác nhận xóa chế độ bảng"
        message={`Bạn có chắc muốn xóa chế độ bảng "${modeToDelete?.name}" không? Toàn bộ công việc vẫn được lưu giữ an toàn, chỉ chế độ hiển thị này bị xóa.`}
        confirmText="Xác nhận xóa"
        onConfirm={() => {
          if (modeToDelete) {
            deleteBoardMode(modeToDelete.id);
            setModeToDelete(null);
          }
          setIsDeleteModeConfirmOpen(false);
        }}
        onCancel={() => {
          setIsDeleteModeConfirmOpen(false);
          setModeToDelete(null);
        }}
      />

      {/* Voice Task Creator Modal */}
      <VoiceTaskCreatorModal
        isOpen={isVoiceTaskModalOpen}
        onClose={() => setIsVoiceTaskModalOpen(false)}
        initialClusterId={voiceTaskTargetClusterId}
        onOpenDetailedEditor={handleOpenDetailedFromVoice}
      />
    </div>
  );
};
