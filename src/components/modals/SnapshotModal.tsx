import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  History,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Database,
  ShieldCheck,
  Check,
  Sliders,
  Lock,
  Globe,
  Search,
  CheckSquare,
  Square,
  Undo2,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DatabaseSnapshot, Division, RestorePoint } from '../../types';
import { DatabaseState } from '../../services/storage';

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnapshotModal: React.FC<SnapshotModalProps> = ({ isOpen, onClose }) => {
  const {
    db,
    currentUser,
    activeWorkspace,
    activeDivision,
    createSnapshot,
    rollbackDivisionsFromSnapshot,
    revertFromRestorePoint,
    deleteRestorePoint,
    deleteSnapshot,
    setSnapshotFrequency,
    setAutoSnapshotExcludedDivisions,
    importSnapshotFromFile,
  } = useApp();

  const currentWorkspaceId = activeWorkspace?.id;

  const [activeTab, setActiveTab] = useState<'snapshots' | 'restore_points' | 'io' | 'settings'>('snapshots');
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotDesc, setNewSnapshotDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDivisionsToCreate, setSelectedDivisionsToCreate] = useState<string[]>([]);
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const [snapshotTypeFilter, setSnapshotTypeFilter] = useState<'all' | 'manual' | 'auto'>('all');

  // Rollback dialog state
  const [selectedSnapshotForRollback, setSelectedSnapshotForRollback] = useState<DatabaseSnapshot | null>(null);
  const [selectedDivisionIdsToRollback, setSelectedDivisionIdsToRollback] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [restorePointToRevert, setRestorePointToRevert] = useState<RestorePoint | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current user is member or owner or admin of the room
  const isRoomMember = useMemo(() => {
    if (!currentUser || !activeWorkspace) return false;
    if (currentUser.role === 'admin') return true;
    if (activeWorkspace.owner_id === currentUser.id) return true;
    return (activeWorkspace.members || []).some((m) => m.user_id === currentUser.id);
  }, [currentUser, activeWorkspace]);

  // Filter snapshots strictly for CURRENT ROOM/WORKSPACE and authenticated room membership
  const snapshots = useMemo(() => {
    if (!currentWorkspaceId || !isRoomMember) return [];
    return (db.snapshots || []).filter((s) => s.workspace_id === currentWorkspaceId);
  }, [db.snapshots, currentWorkspaceId, isRoomMember]);

  // Filter restore points strictly for CURRENT ROOM/WORKSPACE
  const restorePoints = useMemo(() => {
    if (!currentWorkspaceId || !isRoomMember) return [];
    return (db.restore_points || []).filter((rp) => rp.workspace_id === currentWorkspaceId);
  }, [db.restore_points, currentWorkspaceId, isRoomMember]);

  const currentFrequency = db.settings?.auto_snapshot_frequency || 'daily';
  const excludedAutoDivisionIds = db.settings?.auto_snapshot_excluded_division_ids || [];

  // All divisions in current room
  const roomDivisions = useMemo(() => {
    return db.divisions.filter((d) => !currentWorkspaceId || d.workspace_id === currentWorkspaceId);
  }, [db.divisions, currentWorkspaceId]);

  // Eligible divisions that the current user is permitted to interact with (public + own private)
  const eligibleDivisions = useMemo(() => {
    return roomDivisions.map((div) => {
      const isPrivate = div.visibility === 'private';
      const isOwner = !isPrivate || div.owner_id === currentUser?.id;
      const clustersCount = db.clusters.filter((c) => c.division_id === div.id).length;
      const tasksCount = db.tasks.filter((t) => t.division_id === div.id).length;
      const ownerUser = db.users.find((u) => u.id === div.owner_id);
      return {
        ...div,
        isPrivate,
        canSelect: isOwner,
        ownerName: ownerUser?.display_name || div.owner_id,
        clustersCount,
        tasksCount,
      };
    });
  }, [roomDivisions, db.clusters, db.tasks, db.users, currentUser]);

  // Initialize selected divisions for manual creation when form opens
  const handleOpenCreate = () => {
    const defaultIds = eligibleDivisions.filter((d) => d.canSelect).map((d) => d.id);
    setSelectedDivisionsToCreate(defaultIds);
    setNewSnapshotName('');
    setNewSnapshotDesc('');
    setIsCreating(true);
  };

  const handleToggleDivisionCreate = (divId: string) => {
    setSelectedDivisionsToCreate((prev) =>
      prev.includes(divId) ? prev.filter((id) => id !== divId) : [...prev, divId]
    );
  };

  const handleSelectAllDivisionsToCreate = () => {
    const allIds = eligibleDivisions.filter((d) => d.canSelect).map((d) => d.id);
    setSelectedDivisionsToCreate(allIds);
  };

  const handleDeselectAllDivisionsToCreate = () => {
    setSelectedDivisionsToCreate([]);
  };

  // Filtered snapshots list
  const filteredSnapshots = useMemo(() => {
    return snapshots
      .filter((snap) => {
        // Type filter: all / manual / auto
        const isAuto = snap.description?.includes('Tự động') || snap.auto_generated;
        if (snapshotTypeFilter === 'auto') {
          if (!isAuto) return false;
        } else if (snapshotTypeFilter === 'manual') {
          if (isAuto) return false;
        }

        // Search text
        if (snapshotSearch.trim()) {
          const q = snapshotSearch.toLowerCase().trim();
          const matchName = snap.name?.toLowerCase().includes(q);
          const matchDesc = snap.description?.toLowerCase().includes(q);
          const matchAuthor = snap.created_by_name?.toLowerCase().includes(q);
          const matchDivs = snap.saved_division_names?.some((n) => n.toLowerCase().includes(q));
          return matchName || matchDesc || matchAuthor || matchDivs;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [snapshots, snapshotTypeFilter, snapshotSearch]);

  // Parsed divisions for the snapshot currently opened for rollback
  const parsedSnapshotState = useMemo<DatabaseState | null>(() => {
    if (!selectedSnapshotForRollback) return null;
    try {
      return JSON.parse(selectedSnapshotForRollback.data_state) as DatabaseState;
    } catch {
      return null;
    }
  }, [selectedSnapshotForRollback]);

  const availableDivisionsInSnapshot = useMemo(() => {
    if (!parsedSnapshotState) return [];
    return (parsedSnapshotState.divisions || []).map((div) => {
      const snapClusters = (parsedSnapshotState.clusters || []).filter((c) => c.division_id === div.id);
      const snapTasks = (parsedSnapshotState.tasks || []).filter((t) => t.division_id === div.id);
      const isPrivate = div.visibility === 'private';
      const isOwner = !isPrivate || div.owner_id === currentUser?.id;

      // Current counterpart in active DB
      const currentDiv = db.divisions.find((d) => d.id === div.id);
      const currentClusters = db.clusters.filter((c) => c.division_id === div.id);
      const currentTasks = db.tasks.filter((t) => t.division_id === div.id);
      const ownerUser = db.users.find((u) => u.id === div.owner_id);

      return {
        ...div,
        clusterCount: snapClusters.length,
        taskCount: snapTasks.length,
        isPrivate,
        isOwner,
        canRollback: isOwner,
        ownerName: ownerUser?.display_name || div.owner_id,
        currentExists: !!currentDiv,
        currentClustersCount: currentClusters.length,
        currentTasksCount: currentTasks.length,
      };
    });
  }, [parsedSnapshotState, db.divisions, db.clusters, db.tasks, db.users, currentUser]);

  // Open rollback modal
  const handleOpenRollbackModal = (snap: DatabaseSnapshot) => {
    setSelectedSnapshotForRollback(snap);
    try {
      const parsed = JSON.parse(snap.data_state) as DatabaseState;
      const divs = parsed.divisions || [];
      const allowedDivs = divs.filter(
        (d) => d.visibility !== 'private' || d.owner_id === currentUser?.id
      );
      const activeMatch = allowedDivs.find((d) => d.id === activeDivision?.id);
      if (activeMatch) {
        setSelectedDivisionIdsToRollback([activeMatch.id]);
      } else if (allowedDivs.length > 0) {
        setSelectedDivisionIdsToRollback([allowedDivs[0].id]);
      } else {
        setSelectedDivisionIdsToRollback([]);
      }
    } catch {
      setSelectedDivisionIdsToRollback([]);
    }
  };

  const handleToggleDivisionSelect = (divisionId: string) => {
    setSelectedDivisionIdsToRollback((prev) =>
      prev.includes(divisionId) ? prev.filter((id) => id !== divisionId) : [...prev, divisionId]
    );
  };

  const handleSelectAllPermittedDivisions = () => {
    const permittedIds = availableDivisionsInSnapshot.filter((d) => d.canRollback).map((d) => d.id);
    setSelectedDivisionIdsToRollback(permittedIds);
  };

  const handleDeselectAllDivisions = () => {
    setSelectedDivisionIdsToRollback([]);
  };

  const handleExecuteRollbackDivision = () => {
    if (!selectedSnapshotForRollback || selectedDivisionIdsToRollback.length === 0) return;
    const res = rollbackDivisionsFromSnapshot(selectedSnapshotForRollback.id, selectedDivisionIdsToRollback);
    if (res.success) {
      showNotice('success', res.message);
      setSelectedSnapshotForRollback(null);
    } else {
      showNotice('error', res.message);
    }
  };

  const handleExecuteRevert = (rp: RestorePoint) => {
    const res = revertFromRestorePoint(rp.id);
    if (res.success) {
      showNotice('success', res.message);
      setRestorePointToRevert(null);
    } else {
      showNotice('error', res.message);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapshotName.trim()) return;
    if (selectedDivisionsToCreate.length === 0) {
      showNotice('error', 'Vui lòng chọn ít nhất 1 phân chia để lưu vào bản sao lưu này.');
      return;
    }
    createSnapshot(newSnapshotName.trim(), newSnapshotDesc.trim() || undefined, false, selectedDivisionsToCreate);
    setNewSnapshotName('');
    setNewSnapshotDesc('');
    setIsCreating(false);
    setSnapshotTypeFilter('all');
    setSnapshotSearch('');
    showNotice('success', `Đã lưu bản sao lưu mới với ${selectedDivisionsToCreate.length} phân chia đã chọn!`);
  };

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    downloadAnchor.setAttribute('download', `workplace_${activeWorkspace?.name || 'backup'}_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('success', 'Đã tải file sao lưu JSON về máy tính!');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importSnapshotFromFile(content);
        if (res.success) {
          showNotice('success', res.message);
        } else {
          showNotice('error', res.message);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Toggle exclusion for auto snapshot
  const handleToggleAutoExcludeDivision = (divId: string) => {
    let nextExcluded: string[];
    if (excludedAutoDivisionIds.includes(divId)) {
      nextExcluded = excludedAutoDivisionIds.filter((id) => id !== divId);
    } else {
      nextExcluded = [...excludedAutoDivisionIds, divId];
    }
    setAutoSnapshotExcludedDivisions(nextExcluded);
  };

  const handleSelectAllAutoDivisions = () => {
    // Empty exclusion list means all are included
    setAutoSnapshotExcludedDivisions([]);
    showNotice('success', 'Đã tích chọn tất cả phân chia cho chế độ tự động sao lưu.');
  };

  const handleDeselectAllAutoDivisions = () => {
    // Add all eligible division ids to excluded list
    const allIds = eligibleDivisions.filter((d) => d.canSelect).map((d) => d.id);
    setAutoSnapshotExcludedDivisions(allIds);
    showNotice('success', 'Đã bỏ chọn tất cả phân chia trong chế độ tự động sao lưu.');
  };

  const handleTriggerTestAutoSnapshot = () => {
    const snap = createSnapshot(undefined, 'Sao lưu tự động thử nghiệm theo cấu hình phân chia', true);
    showNotice(
      'success',
      `Đã tạo bản sao lưu tự động thử nghiệm "${snap.name}" với ${snap.stats.divisions_count} phân chia!`
    );
  };

  const hasSelectedPublicDivision = availableDivisionsInSnapshot.some(
    (d) => selectedDivisionIdsToRollback.includes(d.id) && !d.isPrivate
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-[#0a101d]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Sao lưu & Rollback
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Phòng: {activeWorkspace?.name || 'Hiện tại'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý độc lập theo phòng • Tùy chọn phân chia khi lưu • Tự động hoàn tác an toàn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === 'snapshots'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Bản sao lưu phòng ({snapshots.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore_points')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'restore_points'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Điểm hoàn tác chung ({restorePoints.length})</span>
            {restorePoints.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Cài đặt tự động & Phân chia
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('io')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition ${
              activeTab === 'io'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Xuất / Nhập File
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm bản sao lưu trong phòng..."
                      value={snapshotSearch}
                      onChange={(e) => setSnapshotSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Filter chips: Tất cả / Thủ công / Tự động */}
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'Tất cả' },
                        { id: 'manual', label: 'Thủ công' },
                        { id: 'auto', label: 'Tự động' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSnapshotTypeFilter(f.id)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                          snapshotTypeFilter === f.id
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!isCreating && (
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs shrink-0 self-start md:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo bản sao lưu mới</span>
                  </button>
                )}
              </div>

              {/* Create Snapshot Form with Division Selection */}
              {isCreating && (
                <form
                  onSubmit={handleCreate}
                  className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3.5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-2">
                    <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Tạo bản sao lưu mới cho phòng &quot;{activeWorkspace?.name}&quot;</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tên bản sao lưu <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="VD: Trước khi dọn dẹp phân chia..."
                        value={newSnapshotName}
                        onChange={(e) => setNewSnapshotName(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Ghi chú thêm (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        placeholder="VD: Đã hoàn tất sprint tháng 9..."
                        value={newSnapshotDesc}
                        onChange={(e) => setNewSnapshotDesc(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </div>

                  {/* Division Selection in Create Form */}
                  <div className="space-y-2 pt-1 border-t border-indigo-100/80 dark:border-indigo-900/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Chọn các Phân chia (Division) muốn lưu vào bản này:</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                          ({selectedDivisionsToCreate.length}/{eligibleDivisions.filter((d) => d.canSelect).length})
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllDivisionsToCreate}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllDivisionsToCreate}
                          className="text-[11px] font-bold text-slate-500 hover:underline"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {eligibleDivisions.map((div) => {
                        const isSelected = selectedDivisionsToCreate.includes(div.id);
                        return (
                          <div
                            key={div.id}
                            onClick={() => {
                              if (div.canSelect) {
                                handleToggleDivisionCreate(div.id);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-xs transition flex items-center justify-between gap-2 ${
                              !div.canSelect
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                : isSelected
                                ? 'border-indigo-600 bg-white dark:bg-[#111927] text-indigo-950 dark:text-indigo-100 shadow-2xs cursor-pointer'
                                : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/70 dark:bg-slate-900/60 cursor-pointer text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: div.color || '#6366F1' }}
                              />
                              <div className="min-w-0 flex-1 truncate">
                                <div className="font-bold truncate">{div.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {div.clustersCount} cụm • {div.tasksCount} việc
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {div.isPrivate ? (
                                <span className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Riêng tư
                                </span>
                              ) : (
                                <span className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Chung
                                </span>
                              )}
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <Square className={`w-4 h-4 ${!div.canSelect ? 'text-slate-300' : 'text-slate-400'}`} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Bản sao lưu sẽ được lưu riêng cho phòng &quot;{activeWorkspace?.name}&quot;.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={selectedDivisionsToCreate.length === 0}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition shadow-xs"
                      >
                        Lưu bản sao lưu ({selectedDivisionsToCreate.length} phân chia)
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Snapshots list */}
              {filteredSnapshots.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <Database className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Không có bản sao lưu nào trong phòng này phù hợp bộ lọc.</p>
                  <p className="text-[11px] mt-1">Mỗi phòng sẽ lưu giữ các bản sao lưu riêng biệt của chính phòng đó.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSnapshots.map((snap) => {
                    const isAuto = snap.description?.includes('Tự động') || snap.auto_generated;
                    const isSafety = snap.name?.includes('Trước khi khôi phục') || snap.description?.includes('bảo vệ');
                    const isMySnapshot = snap.created_by === currentUser?.id;
                    return (
                      <div
                        key={snap.id}
                        className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111927] hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {snap.name}
                            </span>
                            {isAuto ? (
                              <span className="text-[9.5px] px-2 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                Tự động
                              </span>
                            ) : (
                              <span className="text-[9.5px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Thủ công
                              </span>
                            )}
                          </div>
                          {snap.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {snap.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[10.5px] text-slate-400 dark:text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(snap.created_at).toLocaleString('vi-VN')}
                            </span>
                            <span>Người tạo: {snap.created_by_name || 'Hệ thống'}</span>
                            {snap.stats && (
                              <span className="text-indigo-500 dark:text-indigo-400 font-medium">
                                {snap.stats.divisions_count} phân chia • {snap.stats.clusters_count} cụm • {snap.stats.tasks_count} việc
                              </span>
                            )}
                          </div>
                          {/* Saved division names badges */}
                          {snap.saved_division_names && snap.saved_division_names.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              <span className="text-[10px] text-slate-400">Đã lưu:</span>
                              {snap.saved_division_names.map((name, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenRollbackModal(snap)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition shadow-2xs"
                            title="Lựa chọn phân chia để khôi phục từ bản này"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Khôi phục...</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSnapshot(snap.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                            title="Xóa bản lưu này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Shared Restore Points Tab */}
          {activeTab === 'restore_points' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-2.5 text-xs text-indigo-950 dark:text-indigo-200">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Lịch sử hoàn tác chung cho các thành viên phòng &quot;{activeWorkspace?.name}&quot;:</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Mỗi khi ai đó trong phòng thực hiện Rollback, hệ thống sẽ tự động sao lưu lại trạng thái trước đó thành một <strong>Điểm hoàn tác chung (Restore Point)</strong> tại đây. Bất kỳ thành viên nào cũng có thể bấm <strong>&quot;Hoàn tác&quot;</strong> để đưa phân chia trở về trạng thái cũ nếu không thích bản rollback đó.
                  </p>
                </div>
              </div>

              {restorePoints.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  <Undo2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Chưa có điểm hoàn tác nào trong phòng này.</p>
                  <p className="text-[11px] mt-1">Khi bất kỳ thành viên nào rollback phân chia, điểm hoàn tác sẽ tự động xuất hiện tại đây.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {restorePoints.map((rp) => (
                    <div
                      key={rp.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] hover:border-slate-300 dark:hover:border-slate-700 transition space-y-2.5 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {rp.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Restore Point
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(rp.created_at).toLocaleString('vi-VN')}
                            </span>
                            <span>Thực hiện bởi: <strong className="text-slate-700 dark:text-slate-300">{rp.created_by_name}</strong></span>
                            {rp.description && <span>• {rp.description}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => setRestorePointToRevert(rp)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                            title="Đưa dữ liệu trở lại trạng thái trước khi rollback"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Hoàn tác lại (Revert)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRestorePoint(rp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                            title="Xóa điểm hoàn tác này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Affected divisions */}
                      {rp.affected_divisions && rp.affected_divisions.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-slate-500">Phân chia bị thay đổi:</span>
                          {rp.affected_divisions.map((div) => (
                            <span
                              key={div.id}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#6366F1' }}
                              />
                              {div.name}
                              {div.visibility === 'private' ? (
                                <Lock className="w-2.5 h-2.5 text-amber-500" />
                              ) : (
                                <Globe className="w-2.5 h-2.5 text-emerald-500" />
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings & Auto Snapshot Division Selection */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* Frequency Selection */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>1. Tần suất tự động sao lưu</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Thiết lập chu kỳ chạy tự động trong nền cho phòng &quot;{activeWorkspace?.name}&quot;, lưu giữ tối đa 50 bản chụp gần nhất.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {[
                    { id: 'daily', label: 'Hàng ngày (Mặc định)', desc: 'Tự động sao lưu mỗi 24 giờ một lần' },
                    { id: '12h', label: 'Mỗi 12 giờ', desc: 'Sao lưu 2 lần/ngày sáng & tối' },
                    { id: '6h', label: 'Mỗi 6 giờ', desc: 'Dành cho đội ngũ thao tác liên tục' },
                    { id: 'manual', label: 'Chỉ thủ công', desc: 'Chỉ lưu khi bạn nhấn nút Tạo' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSnapshotFrequency(item.id as any);
                        showNotice('success', `Đã cập nhật tần suất: ${item.label}`);
                      }}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition ${
                        currentFrequency === item.id
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                          currentFrequency === item.id
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {currentFrequency === item.id && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Division Selection */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>2. Cấu hình Phân chia tự động sao lưu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllAutoDivisions}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Tích chọn tất cả (Mặc định)
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllAutoDivisions}
                      className="text-[11px] font-bold text-slate-500 hover:underline"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Mặc định hệ thống tự động tích chọn <strong>tất cả phân chia Chung</strong> và <strong>phân chia Cá nhân của bạn</strong>. Bạn có thể bỏ tích chọn bất kỳ phân chia nào bạn không thích để hệ thống loại ra khỏi bản sao lưu tự động.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {eligibleDivisions.map((div) => {
                    const isExcluded = excludedAutoDivisionIds.includes(div.id);
                    const isChecked = !isExcluded;
                    return (
                      <div
                        key={div.id}
                        onClick={() => {
                          if (div.canSelect) {
                            handleToggleAutoExcludeDivision(div.id);
                          }
                        }}
                        className={`p-3 rounded-xl border text-xs transition flex items-center justify-between gap-2.5 ${
                          !div.canSelect
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                            : isChecked
                            ? 'border-indigo-500/80 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 cursor-pointer shadow-2xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: div.color || '#6366F1' }}
                          />
                          <div className="min-w-0 flex-1 truncate">
                            <div className="font-bold truncate text-slate-900 dark:text-slate-100">
                              {div.name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {div.clustersCount} cụm • {div.tasksCount} việc
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {div.isPrivate ? (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Cá nhân
                            </span>
                          ) : (
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Chung
                            </span>
                          )}
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Hiện có <strong>{eligibleDivisions.filter((d) => !excludedAutoDivisionIds.includes(d.id)).length}</strong> phân chia được đưa vào sao lưu tự động.
                  </span>
                  <button
                    type="button"
                    onClick={handleTriggerTestAutoSnapshot}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Chạy thử sao lưu tự động ngay</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export / Import File Tab */}
          {activeTab === 'io' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Download className="w-4 h-4 text-indigo-500" />
                  <span>Xuất toàn bộ dữ liệu phòng (Export Backup)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tải về một file <code>.json</code> chứa toàn bộ các phân chia, cụm, công việc và cấu hình của phòng &quot;{activeWorkspace?.name}&quot; để lưu trữ an toàn ngoại tuyến.
                </p>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="mt-2 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file backup phòng (.json)</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  <span>Nhập dữ liệu từ file backup (Import)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Khôi phục hoặc gộp dữ liệu từ một file JSON đã sao lưu trước đây. Hệ thống sẽ tự động tạo một điểm an toàn trước khi nạp.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".json,application/json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn file JSON để nạp</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a101d]/50 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Phòng: {activeWorkspace?.name || 'Hiện tại'} • Điểm hoàn tác lưu riêng biệt theo phòng</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Confirmation & Granular Division Selection Modal for Rollback */}
      {selectedSnapshotForRollback && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <RotateCcw className="w-5 h-5" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Lựa chọn chi tiết Phân chia (Division) muốn khôi phục
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshotForRollback(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Bản sao lưu: <strong className="text-slate-900 dark:text-slate-100">&quot;{selectedSnapshotForRollback.name}&quot;</strong>
              </p>
              <p className="text-[11px] text-slate-500">
                Thời gian ghi lại: {new Date(selectedSnapshotForRollback.created_at).toLocaleString('vi-VN')} • Người tạo: {selectedSnapshotForRollback.created_by_name || 'Hệ thống'}
              </p>
            </div>

            {/* Division Multi-Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Chọn phân chia cần rollback ({selectedDivisionIdsToRollback.length}/{availableDivisionsInSnapshot.filter((d) => d.canRollback).length}):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllPermittedDivisions}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllDivisions}
                    className="text-[11px] font-bold text-slate-500 hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {availableDivisionsInSnapshot.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  Bản sao lưu này không chứa phân chia nào.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {availableDivisionsInSnapshot.map((div) => {
                    const isSelected = selectedDivisionIdsToRollback.includes(div.id);
                    return (
                      <div
                        key={div.id}
                        onClick={() => {
                          if (div.canRollback) {
                            handleToggleDivisionSelect(div.id);
                          }
                        }}
                        className={`p-3 rounded-xl border text-xs transition flex items-start justify-between gap-3 ${
                          !div.canRollback
                            ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
                            : isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 cursor-pointer shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer bg-white dark:bg-[#131d2e]'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: div.color || '#6366F1' }}
                            />
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {div.name}
                            </span>
                            {div.isPrivate ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Lock className="w-2.5 h-2.5" />
                                Riêng tư ({div.ownerName})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <Globe className="w-2.5 h-2.5" />
                                Chung (Public)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Bản lưu: <strong>{div.clusterCount} cụm</strong>, <strong>{div.taskCount} việc</strong></span>
                            <span>•</span>
                            <span>Hiện tại: {div.currentExists ? `${div.currentClustersCount} cụm, ${div.currentTasksCount} việc` : 'Đã bị xóa'}</span>
                          </div>

                          {!div.canRollback && (
                            <p className="text-[11px] text-rose-500 font-medium">
                              🔒 Phân chia riêng tư của người khác — Chỉ chủ sở hữu ({div.ownerName}) mới có quyền khôi phục.
                            </p>
                          )}
                        </div>

                        <div className="mt-1">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className={`w-5 h-5 ${!div.canRollback ? 'text-slate-300 dark:text-slate-700' : 'text-slate-400'}`} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Impact Notice */}
            {hasSelectedPublicDivision && (
              <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Lưu ý ảnh hưởng chung giữa các tài khoản trong phòng:</span>
                </div>
                <p>
                  Bạn đang chọn khôi phục phân chia <strong>Chung (Public)</strong>. Thao tác này sẽ cập nhật dữ liệu cho tất cả các tài khoản trong phòng này. Hệ thống sẽ tự động tạo một <strong>Điểm hoàn tác chung (Restore Point)</strong> để các thành viên khác có thể hoàn tác lại bất kỳ lúc nào nếu không đồng ý.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 text-[11px] text-indigo-900 dark:text-indigo-200">
              🛡️ <strong>Chỉ rollback các phân chia được tích chọn</strong>. Tất cả các phân chia khác của bạn và của mọi người giữ nguyên vẹn 100%.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedSnapshotForRollback(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={selectedDivisionIdsToRollback.length === 0}
                onClick={handleExecuteRollbackDivision}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition shadow-xs"
              >
                Khôi phục {selectedDivisionIdsToRollback.length} phân chia đã chọn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Reverting a Shared Restore Point */}
      {restorePointToRevert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Undo2 className="w-5 h-5" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Xác nhận Hoàn tác lại (Revert)
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bạn có chắc muốn hoàn tác lại trạng thái trước khi rollback không?
              <br />
              Điểm hoàn tác: <strong className="text-slate-900 dark:text-slate-100">&quot;{restorePointToRevert.name}&quot;</strong>
              <br />
              <span className="text-[11px] text-slate-500">
                Được tạo lúc {new Date(restorePointToRevert.created_at).toLocaleString('vi-VN')} khi {restorePointToRevert.created_by_name} thực hiện rollback.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRestorePointToRevert(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRevert(restorePointToRevert)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
              >
                Xác nhận hoàn tác
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
