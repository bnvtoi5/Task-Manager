import React, { useState, useEffect } from 'react';
import {
  Plus,
  Layers,
  Calendar,
  Briefcase,
  Globe,
  Lock,
  LayoutGrid,
  Columns3,
  Maximize2,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  SlidersHorizontal,
  Grid,
  List
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Task, Cluster, DivisionLayoutType } from '../../types';
import { ClusterColumn } from '../cluster/ClusterColumn';
import { SmartAreaView } from '../smart_area/SmartAreaView';
import { TaskEditorModal } from '../task/TaskEditorModal';
import { BulkActionBar } from '../task/BulkActionBar';
import { BulkMoveModal } from '../task/ActionModals';

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
  } = useApp();

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [targetClusterIdForNewTask, setTargetClusterIdForNewTask] = useState<string | undefined>(undefined);

  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);

  // Single task action modal helpers
  const [singleTaskMove, setSingleTaskMove] = useState<Task | null>(null);

  // Single cluster design mode state (size + task layout)
  const [singleClusterWidth, setSingleClusterWidth] = useState<'md' | 'lg' | 'xl' | 'full'>(() => {
    return (localStorage.getItem('wtm_sc_width') as 'md' | 'lg' | 'xl' | 'full') || 'xl';
  });
  const [singleTaskLayout, setSingleTaskLayout] = useState<'stack' | 'grid2' | 'grid3'>(() => {
    return (localStorage.getItem('wtm_sc_layout') as 'stack' | 'grid2' | 'grid3') || 'grid2';
  });
  const [isDesignPopoverOpen, setIsDesignPopoverOpen] = useState(false);

  const handleSetWidth = (w: 'md' | 'lg' | 'xl' | 'full') => {
    setSingleClusterWidth(w);
    localStorage.setItem('wtm_sc_width', w);
  };

  const handleSetLayout = (l: 'stack' | 'grid2' | 'grid3') => {
    setSingleTaskLayout(l);
    localStorage.setItem('wtm_sc_layout', l);
  };

  // Clusters for active division
  const clusters = activeDivision
    ? db.clusters
        .filter((c) => c.division_id === activeDivision.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // Active cluster for Single mode
  const selectedClusterIndex = clusters.findIndex((c) => c.id === activeClusterId);
  const effectiveIndex = selectedClusterIndex >= 0 ? selectedClusterIndex : 0;
  const selectedCluster = clusters[effectiveIndex] || null;

  // Single view cluster navigation
  const handleNavigateCluster = (direction: -1 | 1) => {
    if (clusters.length === 0) return;
    const nextIndex = (effectiveIndex + direction + clusters.length) % clusters.length;
    setActiveClusterId(clusters[nextIndex].id);
  };

  // Keyboard navigation for single view
  useEffect(() => {
    if (viewMode !== 'single') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
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
  }, [viewMode, effectiveIndex, clusters]);

  // Task Handlers
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

  // EMPTY STATE 1: No active workspace
  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-[#0c1220]">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-xs">
          <Briefcase className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Chào mừng bạn đến với Hệ thống Quản lý Task
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Hiện tại bạn chưa chọn hoặc chưa có phòng làm việc nào. Hãy tạo phòng làm việc đầu tiên hoặc tham gia bằng mã mời để bắt đầu quản lý công việc phân cấp.
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Chưa có Period (Thời gian) nào trong phòng này
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
          Period là đơn vị thời gian cấp cao (ví dụ: &quot;Tháng 10/2026&quot;, &quot;Sprint 14&quot;, &quot;Quý 4&quot;). Hãy tạo Period để bắt đầu phân chia công việc.
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/60 dark:bg-[#0a0f1d]">
      {/* Top Workspace Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white/95 dark:bg-[#0e1626]/95 border-b border-slate-200/90 dark:border-slate-800 backdrop-blur-xs shrink-0">
        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {activePeriod.name}
            </span>
            <span>/</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              {activeDivision.visibility === 'public' ? (
                <Globe className="w-3.5 h-3.5 text-emerald-500" title="Công khai" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-500" title="Riêng tư" />
              )}
              <span className="truncate">{activeDivision.name}</span>
            </span>
          </div>
        </div>

        {/* View mode buttons & actions */}
        <div className="flex items-center gap-2">
          {/* View Mode Switcher: Full vs Single vs Smart Area */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-semibold border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('full')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === 'full'
                  ? 'bg-white dark:bg-[#152037] text-indigo-600 dark:text-indigo-400 shadow-xs'
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
                  ? 'bg-white dark:bg-[#152037] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Xem từng cụm (Single View)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Từng cụm</span>
              <span className="sm:hidden">Đơn</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('smart_area')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === 'smart_area'
                  ? 'bg-white dark:bg-[#152037] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Smart Area Canvas"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Smart Area</span>
              <span className="sm:hidden">Smart</span>
            </button>
          </div>

          {/* Add Cluster button */}
          <button
            type="button"
            onClick={() => onOpenClusterModal(null)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Thêm cụm</span>
          </button>
        </div>
      </div>

      {/* VIEW CONTENT BASED ON VIEW MODE */}
      <div className="flex-1 overflow-hidden">
        {clusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <FolderKanban className="w-12 h-12 text-slate-400 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Chưa có Cụm (Cluster) nào trong phân chia này
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Hãy tạo cụm đầu tiên (ví dụ: &quot;Backlog&quot;, &quot;Đang làm&quot;, &quot;Hoàn tất&quot;) để bắt đầu quản lý task.
            </p>
            <button
              type="button"
              onClick={() => onOpenClusterModal(null)}
              className="mt-4 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              + Tạo Cụm mới
            </button>
          </div>
        ) : viewMode === 'smart_area' ? (
          <SmartAreaView
            clusters={clusters}
            onAddTask={handleAddTask}
            onEditTask={handleEditTask}
            onDoubleClickTask={handleDoubleClickTask}
            onMoveSingleTask={handleMoveSingleTask}
            onEditCluster={onOpenClusterModal}
            onAddCluster={() => onOpenClusterModal(null)}
          />
        ) : viewMode === 'single' ? (
          /* Single Cluster View with Prob 6 Left/Right Navigation & Design Customization */
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
                {/* Previous cluster arrow */}
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
                    Cụm ({effectiveIndex + 1}/{clusters.length}):
                  </span>
                  <select
                    value={selectedCluster?.id || ''}
                    onChange={(e) => setActiveClusterId(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    {clusters.map((c, idx) => (
                      <option key={c.id} value={c.id}>
                        {idx + 1}. {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Next cluster arrow */}
                <button
                  type="button"
                  onClick={() => handleNavigateCluster(1)}
                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200 dark:border-slate-700"
                  title="Cụm sau (Phím mũi tên Phải →)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Design Mode & Controls */}
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
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                  onDoubleClickTask={handleDoubleClickTask}
                  onMoveSingleTask={handleMoveSingleTask}
                  onEditCluster={onOpenClusterModal}
                  taskLayout={singleTaskLayout}
                  className="shadow-md border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/90 dark:bg-[#101827]/90"
                />
              </div>
            )}
          </div>
        ) : (
          /* Full View: All clusters side by side (Horizontal scrollable Kanban) */
          <div className="flex items-start gap-4 p-4 sm:p-6 h-full overflow-x-auto overflow-y-hidden bg-slate-50/50 dark:bg-[#090e1a]">
            {clusters.map((cluster) => (
              <ClusterColumn
                key={cluster.id}
                cluster={cluster}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDoubleClickTask={handleDoubleClickTask}
                onMoveSingleTask={handleMoveSingleTask}
                onEditCluster={onOpenClusterModal}
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

      {/* Task Creation & Editing Modal */}
      <TaskEditorModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        targetClusterId={targetClusterIdForNewTask}
      />

      {/* Bulk / Single Move Modal */}
      <BulkMoveModal
        isOpen={isBulkMoveOpen}
        onClose={() => {
          setIsBulkMoveOpen(false);
          setSingleTaskMove(null);
        }}
        clusters={clusters}
        taskIdsToMove={singleTaskMove ? [singleTaskMove.id] : selectedTaskIds}
      />
    </div>
  );
};
