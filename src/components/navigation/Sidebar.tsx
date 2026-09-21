import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Plus,
  Globe,
  Lock,
  Users,
  History,
  Settings,
  X,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Edit2,
  Trash2,
  FolderKanban
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Period, Division } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';

interface SidebarProps {
  onOpenPeriodModal: (period?: Period | null) => void;
  onOpenDivisionModal: (division?: Division | null) => void;
  onOpenMembersModal: () => void;
  onOpenActivityLogsModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenPeriodModal,
  onOpenDivisionModal,
  onOpenMembersModal,
  onOpenActivityLogsModal,
}) => {
  const {
    db,
    currentUser,
    activeWorkspace,
    activePeriod,
    activeDivision,
    setActivePeriodId,
    setActiveDivisionId,
    deletePeriod,
    deleteDivision,
    isSidebarOpen,
    setIsSidebarOpen,
    viewMode,
    setViewMode,
  } = useApp();

  const [periodMenuId, setPeriodMenuId] = useState<string | null>(null);
  const [divisionMenuId, setDivisionMenuId] = useState<string | null>(null);

  // In-app delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'period' | 'division';
    id: string;
    name: string;
  } | null>(null);

  // Periods in active workspace
  const periods = activeWorkspace
    ? db.periods.filter((p) => p.workspace_id === activeWorkspace.id && !p.is_archived)
    : [];

  // Divisions in active period (public OR owned by current user)
  const divisions = activePeriod && currentUser
    ? db.divisions.filter(
        (d) =>
          d.period_id === activePeriod.id &&
          (d.visibility === 'public' || d.owner_id === currentUser.id)
      )
    : [];

  // Close mobile drawer on navigation
  const handleItemClick = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'period') {
      deletePeriod(deleteTarget.id);
    } else {
      deleteDivision(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-35 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container with smooth width transition */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-40 flex flex-col bg-slate-50/95 dark:bg-[#0c1220] border-r border-slate-200/90 dark:border-slate-800 transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isSidebarOpen
            ? 'w-64 translate-x-0 opacity-100 shadow-xl lg:shadow-none'
            : '-translate-x-full lg:translate-x-0 w-0 opacity-0 border-r-0 pointer-events-none'
        }`}
      >
        {/* Sidebar Header with collapse button */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-200/90 dark:border-slate-800 shrink-0 min-w-[16rem]">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Cấu trúc & Cấp bậc
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Thu hẹp danh mục"
          >
            <ChevronLeft className="w-4 h-4 hidden lg:block" />
            <X className="w-4 h-4 lg:hidden" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs min-w-[16rem]">
          {/* SECTION 1: PERIODS (KHÔNG GIAN THỜI GIAN) */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Period (Thời gian)</span>
              </div>
              {activeWorkspace && (
                <button
                  type="button"
                  onClick={() => onOpenPeriodModal(null)}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                  title="Thêm Period mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {periods.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                Chưa có Period nào.{' '}
                <button
                  onClick={() => onOpenPeriodModal(null)}
                  className="text-indigo-600 dark:text-indigo-400 underline font-normal"
                >
                  Tạo ngay
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {periods.map((p) => {
                  const isActive = activePeriod?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
                      }`}
                      onClick={() => {
                        setActivePeriodId(p.id);
                        handleItemClick();
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || '#4F46E5' }}
                        />
                        <span className="truncate">{p.name}</span>
                      </div>

                      {/* 3-dot dropdown for Period */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPeriodMenuId(periodMenuId === p.id ? null : p.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {periodMenuId === p.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPeriodMenuId(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs font-normal">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPeriodMenuId(null);
                                  onOpenPeriodModal(p);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                              >
                                <Edit2 className="w-3 h-3 text-indigo-500" />
                                <span>Sửa Period</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPeriodMenuId(null);
                                  setDeleteTarget({ type: 'period', id: p.id, name: p.name });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa Period</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: DIVISIONS (PHÂN CHIA) */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                <Layers className="w-3.5 h-3.5 text-sky-500" />
                <span>Division (Phân chia)</span>
              </div>
              {activePeriod && (
                <button
                  type="button"
                  onClick={() => onOpenDivisionModal(null)}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                  title="Thêm Division mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {divisions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                Chưa có Division nào.{' '}
                {activePeriod && (
                  <button
                    onClick={() => onOpenDivisionModal(null)}
                    className="text-indigo-600 dark:text-indigo-400 underline font-normal"
                  >
                    Tạo ngay
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {divisions.map((d) => {
                  const isActive = activeDivision?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
                      }`}
                      onClick={() => {
                        setActiveDivisionId(d.id);
                        handleItemClick();
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {d.visibility === 'public' ? (
                          <span title="Công khai" className="shrink-0 flex items-center">
                            <Globe className="w-3 h-3 text-emerald-500" />
                          </span>
                        ) : (
                          <span title="Riêng tư" className="shrink-0 flex items-center">
                            <Lock className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                        <span className="truncate">{d.name}</span>
                      </div>

                      {/* 3-dot dropdown for Division */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDivisionMenuId(divisionMenuId === d.id ? null : d.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {divisionMenuId === d.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDivisionMenuId(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs font-normal">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDivisionMenuId(null);
                                  onOpenDivisionModal(d);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                              >
                                <Edit2 className="w-3 h-3 text-indigo-500" />
                                <span>Sửa Division</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDivisionMenuId(null);
                                  setDeleteTarget({ type: 'division', id: d.id, name: d.name });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa Division</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: WORKSPACE TOOLS */}
          <div>
            <div className="px-2 mb-2 font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
              Công cụ Phòng
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onOpenMembersModal();
                  handleItemClick();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition"
              >
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Thành viên phòng</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenActivityLogsModal();
                  handleItemClick();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition"
              >
                <History className="w-3.5 h-3.5 text-amber-500" />
                <span>Nhật ký hoạt động</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Workspace Badge & Footer */}
        {activeWorkspace && (
          <div className="p-3 border-t border-slate-200/90 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-[#101726]">
            <div className="flex items-center justify-between">
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                {activeWorkspace.name}
              </span>
              <span className="font-mono bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                {activeWorkspace.invite_code}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* In-app Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'period' ? 'Xác nhận xóa Period' : 'Xác nhận xóa Division'}
        message={`Bạn có chắc chắn muốn xóa "${deleteTarget?.name}" không? Tất cả các cụm và công việc trực thuộc sẽ bị xóa theo.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
