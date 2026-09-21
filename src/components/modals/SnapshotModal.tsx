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
  Zap,
  ArrowRight,
  RefreshCw,
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
    deleteSnapshot,
    setSnapshotFrequency,
    setAutoSnapshotExcludedDivisions,
    importSnapshotFromFile,
    recordRollbackCheckpoint,
    executeRollback,
    deleteRestorePoint,
    clearAllRollbackPoints,
  } = useApp();

  const currentWorkspaceId = activeWorkspace?.id;

  // Default tab is 'rollback' as requested by user!
  const [activeTab, setActiveTab] = useState<'rollback' | 'snapshots' | 'io' | 'settings'>('rollback');
  const [rollbackScope, setRollbackScope] = useState<'all' | 'workspace'>(
    currentWorkspaceId ? 'workspace' : 'all'
  );
  const [rollbackSearch, setRollbackSearch] = useState('');

  // Manual Rollback Checkpoint Creation Form
  const [isCreatingManualPoint, setIsCreatingManualPoint] = useState(false);
  const [manualPointName, setManualPointName] = useState('');
  const [manualPointDesc, setManualPointDesc] = useState('');

  // Rollback confirmation dialog state
  const [pointToRollbackFull, setPointToRollbackFull] = useState<RestorePoint | DatabaseSnapshot | null>(null);
  const [pointToRollbackSelective, setPointToRollbackSelective] = useState<RestorePoint | DatabaseSnapshot | null>(null);
  const [selectedDivisionIdsToRollback, setSelectedDivisionIdsToRollback] = useState<string[]>([]);
  const [isClearingAllPoints, setIsClearingAllPoints] = useState(false);

  // Snapshot creation state
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [newSnapshotDesc, setNewSnapshotDesc] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [selectedDivisionsToCreate, setSelectedDivisionsToCreate] = useState<string[]>([]);
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const [snapshotTypeFilter, setSnapshotTypeFilter] = useState<'all' | 'manual' | 'auto'>('all');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Check if current user is member or owner or admin of the room
  const isRoomMember = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (!activeWorkspace) return true;
    if (activeWorkspace.owner_id === currentUser.id) return true;
    return (db.workspace_members || []).some(
      (m) => m.workspace_id === activeWorkspace.id && m.user_id === currentUser.id
    );
  }, [currentUser, activeWorkspace, db.workspace_members]);

  // All restore points
  const allRestorePoints = useMemo(() => {
    return db.restore_points || [];
  }, [db.restore_points]);

  // Filtered restore points
  const workspacePointsCount = useMemo(() => {
    return allRestorePoints.filter(
      (rp) => !currentWorkspaceId || !rp.workspace_id || rp.workspace_id === currentWorkspaceId
    ).length;
  }, [allRestorePoints, currentWorkspaceId]);

  const filteredRestorePoints = useMemo(() => {
    return allRestorePoints.filter((rp) => {
      // Scope filter
      if (rollbackScope === 'workspace' && currentWorkspaceId) {
        if (rp.workspace_id && rp.workspace_id !== currentWorkspaceId) return false;
      }
      // Search text
      if (rollbackSearch.trim()) {
        const query = rollbackSearch.toLowerCase().trim();
        const matchName = rp.name?.toLowerCase().includes(query);
        const matchDesc = rp.description?.toLowerCase().includes(query);
        const matchUser = rp.created_by_name?.toLowerCase().includes(query);
        if (!matchName && !matchDesc && !matchUser) return false;
      }
      return true;
    });
  }, [allRestorePoints, rollbackScope, currentWorkspaceId, rollbackSearch]);

  // Snapshots list
  const snapshots = useMemo(() => {
    return db.snapshots || [];
  }, [db.snapshots]);

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter((snap) => {
      if (rollbackScope === 'workspace' && currentWorkspaceId) {
        if (snap.workspace_id && snap.workspace_id !== currentWorkspaceId) return false;
      }
      const isAuto = snap.description?.includes('Tự động') || snap.auto_generated;
      if (snapshotTypeFilter === 'auto' && !isAuto) return false;
      if (snapshotTypeFilter === 'manual' && isAuto) return false;

      if (snapshotSearch.trim()) {
        const q = snapshotSearch.toLowerCase().trim();
        const matchName = snap.name.toLowerCase().includes(q);
        const matchDesc = snap.description?.toLowerCase().includes(q);
        const matchUser = snap.created_by_name?.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchUser) return false;
      }
      return true;
    });
  }, [snapshots, rollbackScope, currentWorkspaceId, snapshotTypeFilter, snapshotSearch]);

  // Eligible divisions for snapshot creation:
  // User explicitly wants:
  // "snapshot là lưu các division public và tất cả division private (private chỉ tạo thuộc về acc đó, ko lấy của acc khác)"
  const eligibleDivisions = useMemo(() => {
    return db.divisions
      .filter((d) => {
        if (currentWorkspaceId && d.workspace_id && d.workspace_id !== currentWorkspaceId) return false;
        if (d.visibility === 'public') return true;
        if (d.visibility === 'private' && currentUser && d.owner_id === currentUser.id) return true;
        return false;
      })
      .map((div) => {
        const isPrivate = div.visibility === 'private';
        const clustersCount = db.clusters.filter((c) => c.division_id === div.id).length;
        const tasksCount = db.tasks.filter((t) => t.division_id === div.id).length;
        const ownerUser = db.users.find((u) => u.id === div.owner_id);
        return {
          ...div,
          isPrivate,
          canSelect: true,
          ownerName: ownerUser?.display_name || div.owner_id,
          clustersCount,
          tasksCount,
        };
      });
  }, [db.divisions, currentWorkspaceId, currentUser, db.clusters, db.tasks, db.users]);

  // Auto pre-select all eligible divisions when opening create snapshot form
  useEffect(() => {
    if (isCreatingSnapshot && selectedDivisionsToCreate.length === 0 && eligibleDivisions.length > 0) {
      setSelectedDivisionsToCreate(eligibleDivisions.map((d) => d.id));
    }
  }, [isCreatingSnapshot, eligibleDivisions]);

  const currentFrequency = db.settings?.auto_snapshot_frequency || 'daily';
  const excludedAutoDivisionIds = db.settings?.auto_snapshot_excluded_division_ids || [];

  // Parse source for selective rollback
  const divisionsInSelectiveSource = useMemo(() => {
    if (!pointToRollbackSelective) return [];
    try {
      const parsed = JSON.parse(pointToRollbackSelective.data_state) as DatabaseState;
      const divs = parsed.divisions || [];
      const targetWsId = pointToRollbackSelective.workspace_id || currentWorkspaceId;
      return divs
        .filter((d) => {
          if (targetWsId && d.workspace_id && d.workspace_id !== targetWsId) return false;
          if (d.visibility === 'public') return true;
          if (d.visibility === 'private' && currentUser && d.owner_id === currentUser.id) return true;
          return false;
        })
        .map((d) => {
          const clustersCount = (parsed.clusters || []).filter((c) => c.division_id === d.id).length;
          const tasksCount = (parsed.tasks || []).filter((t) => t.division_id === d.id).length;
          const isPrivate = d.visibility === 'private';
          return {
            ...d,
            clustersCount,
            tasksCount,
            isPrivate,
            canRollback: true,
          };
        });
    } catch {
      return [];
    }
  }, [pointToRollbackSelective, currentUser, currentWorkspaceId]);

  // Open selective rollback
  const handleOpenSelectiveRollback = (item: RestorePoint | DatabaseSnapshot) => {
    setPointToRollbackSelective(item);
    try {
      const parsed = JSON.parse(item.data_state) as DatabaseState;
      const divs = parsed.divisions || [];
      const targetWsId = item.workspace_id || currentWorkspaceId;
      const permitted = divs.filter((d) => {
        if (targetWsId && d.workspace_id && d.workspace_id !== targetWsId) return false;
        return (
          d.visibility === 'public' ||
          (d.visibility === 'private' && currentUser && d.owner_id === currentUser.id)
        );
      });
      if (permitted.length > 0) {
        setSelectedDivisionIdsToRollback(permitted.map((d) => d.id));
      } else {
        setSelectedDivisionIdsToRollback([]);
      }
    } catch {
      setSelectedDivisionIdsToRollback([]);
    }
  };

  // Execute full rollback
  const handleConfirmFullRollback = () => {
    if (!pointToRollbackFull) return;
    const res = executeRollback(pointToRollbackFull.id, 'full');
    if (res.success) {
      showNotice('success', res.message);
      setPointToRollbackFull(null);
    } else {
      showNotice('error', res.message);
    }
  };

  // Execute selective rollback
  const handleConfirmSelectiveRollback = () => {
    if (!pointToRollbackSelective || selectedDivisionIdsToRollback.length === 0) return;
    const res = executeRollback(pointToRollbackSelective.id, 'selective', selectedDivisionIdsToRollback);
    if (res.success) {
      showNotice('success', res.message);
      setPointToRollbackSelective(null);
    } else {
      showNotice('error', res.message);
    }
  };

  // Create manual checkpoint
  const handleCreateManualPoint = (e: React.FormEvent) => {
    e.preventDefault();
    const name = manualPointName.trim() || `Điểm lưu thủ công ${new Date().toLocaleTimeString('vi-VN')}`;
    const desc = manualPointDesc.trim() || 'Tạo bởi người dùng';
    const point = recordRollbackCheckpoint(name, desc, 'general');
    setManualPointName('');
    setManualPointDesc('');
    setIsCreatingManualPoint(false);
    showNotice('success', `Đã lưu điểm Rollback: "${point.name}"!`);
  };

  // Create snapshot
  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapshotName.trim()) return;
    if (selectedDivisionsToCreate.length === 0) {
      showNotice('error', 'Vui lòng chọn ít nhất 1 phân chia để lưu vào bản sao lưu này.');
      return;
    }
    const snap = createSnapshot(
      newSnapshotName.trim(),
      newSnapshotDesc.trim() || undefined,
      false,
      selectedDivisionsToCreate
    );
    setNewSnapshotName('');
    setNewSnapshotDesc('');
    setIsCreatingSnapshot(false);
    showNotice('success', `Đã lưu bản sao lưu "${snap.name}" với ${selectedDivisionsToCreate.length} phân chia!`);
  };

  // Clear all rollback points
  const handleConfirmClearAllPoints = () => {
    clearAllRollbackPoints();
    setIsClearingAllPoints(false);
    showNotice('success', 'Đã dọn dẹp sạch toàn bộ các điểm Rollback cũ!');
  };

  // JSON Export / Import
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    downloadAnchor.setAttribute('download', `taskmanager_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('success', 'Đã xuất file sao lưu JSON thành công!');
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

  const getActionBadge = (actionType?: string) => {
    switch (actionType) {
      case 'delete_task':
        return { label: 'Xóa việc', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
      case 'bulk_action':
        return { label: 'Hàng loạt', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      case 'delete_division':
        return { label: 'Xóa phân chia', color: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800' };
      case 'delete_cluster':
        return { label: 'Xóa cụm cột', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800' };
      case 'delete_period':
        return { label: 'Xóa giai đoạn', color: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800' };
      case 'delete_workspace':
        return { label: 'Xóa phòng', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
      case 'move_task':
        return { label: 'Di chuyển việc', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'safety':
        return { label: 'Điểm an toàn', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      case 'manual_snapshot':
        return { label: 'Bản sao lưu', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' };
      default:
        return { label: 'Điểm lưu', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Vừa xong';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-4xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-[#0a101d]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Trung tâm Rollback & Khôi phục Dữ liệu
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Phòng: {activeWorkspace?.name || 'Tất cả'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Điểm Rollback tạo thủ công & Bản sao lưu tự động theo giờ Việt Nam • Hoàn tác toàn bộ hoặc chọn lọc an toàn
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('rollback')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'rollback'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Điểm Rollback & Hoàn tác ({allRestorePoints.length})</span>
            {allRestorePoints.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold">
                {allRestorePoints.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'snapshots'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-500" />
            <span>Bản sao lưu (Snapshots) ({snapshots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('io')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'io'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>Xuất / Nhập JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Cài đặt tự động</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: ROLLBACK & RESTORE POINTS */}
          {activeTab === 'rollback' && (
            <div className="space-y-4">
              {/* Top Action Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                {/* Search & Scope */}
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={rollbackSearch}
                      onChange={(e) => setRollbackSearch(e.target.value)}
                      placeholder="Tìm điểm rollback theo tên, người tạo..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Scope filter */}
                  <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => setRollbackScope('workspace')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        rollbackScope === 'workspace'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Phòng hiện tại ({workspacePointsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRollbackScope('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        rollbackScope === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Tất cả phòng ({allRestorePoints.length})
                    </button>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCreatingManualPoint((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lưu điểm ngay</span>
                  </button>

                  {allRestorePoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsClearingAllPoints(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition border border-rose-200 dark:border-rose-900"
                      title="Xóa tất cả điểm rollback cũ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Dọn sạch</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Checkpoint Form */}
              {isCreatingManualPoint && (
                <form
                  onSubmit={handleCreateManualPoint}
                  className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Lưu điểm Rollback tức thì cho toàn bộ trạng thái hiện tại
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingManualPoint(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={manualPointName}
                      onChange={(e) => setManualPointName(e.target.value)}
                      placeholder="Tên điểm lưu (VD: Trước khi chỉnh sửa lớn)"
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={manualPointDesc}
                      onChange={(e) => setManualPointDesc(e.target.value)}
                      placeholder="Ghi chú thêm (tùy chọn)"
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingManualPoint(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                    >
                      Xác nhận lưu
                    </button>
                  </div>
                </form>
              )}

              {/* List of Rollback Checkpoints */}
              {filteredRestorePoints.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 mx-auto flex items-center justify-center mb-3">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Chưa có điểm Rollback nào được ghi nhận
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                    Hệ thống sẽ <strong>tự động tạo 1 điểm Rollback</strong> mỗi khi bạn xóa công việc, xóa phân chia, di chuyển hàng loạt, hoặc bạn có thể bấm nút <strong>&quot;Lưu điểm ngay&quot;</strong> ở góc trên bất cứ lúc nào!
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingManualPoint(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo điểm Rollback đầu tiên ngay</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRestorePoints.map((rp) => {
                    const badge = getActionBadge(rp.action_type);
                    const pointWs = rp.workspace_id ? db.workspaces.find((w) => w.id === rp.workspace_id) : null;
                    return (
                      <div
                        key={rp.id}
                        className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-indigo-300 dark:hover:border-indigo-800/80 transition-all shadow-xs space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}
                              >
                                {badge.label}
                              </span>
                              {pointWs ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                                  Phòng: {pointWs.name}
                                </span>
                              ) : rp.workspace_id ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                                  Phòng này
                                </span>
                              ) : null}
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {rp.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <strong className="text-slate-700 dark:text-slate-300">
                                  {formatRelativeTime(rp.created_at)}
                                </strong>
                                ({new Date(rp.created_at).toLocaleTimeString('vi-VN')} {new Date(rp.created_at).toLocaleDateString('vi-VN')})
                              </span>
                              <span>
                                Bởi: <strong className="text-slate-700 dark:text-slate-300">{rp.created_by_name || 'Hệ thống'}</strong>
                              </span>
                              {rp.stats && (
                                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                  • {rp.stats.tasks_count} việc, {rp.stats.clusters_count} cụm, {rp.stats.divisions_count} phân chia
                                </span>
                              )}
                            </div>

                            {rp.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                                {rp.description}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {/* Full Rollback */}
                            <button
                              type="button"
                              onClick={() => setPointToRollbackFull(rp)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                              title="Khôi phục toàn bộ dữ liệu về trạng thái này"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Rollback ngay</span>
                            </button>

                            {/* Selective Rollback */}
                            <button
                              type="button"
                              onClick={() => handleOpenSelectiveRollback(rp)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition"
                              title="Chỉ khôi phục một số phân chia đã chọn"
                            >
                              <Layers className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="hidden sm:inline">Chọn phân chia</span>
                            </button>

                            {/* Delete point */}
                            <button
                              type="button"
                              onClick={() => deleteRestorePoint(rp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                              title="Xóa điểm hoàn tác này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Affected divisions info */}
                        {rp.affected_divisions && rp.affected_divisions.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-400">Phân chia liên quan:</span>
                            {rp.affected_divisions.map((div) => (
                              <span
                                key={div.id}
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                              >
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL SNAPSHOTS */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={snapshotSearch}
                    onChange={(e) => setSnapshotSearch(e.target.value)}
                    placeholder="Tìm kiếm bản sao lưu..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={snapshotTypeFilter}
                    onChange={(e) => setSnapshotTypeFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  >
                    <option value="all">Tất cả bản sao lưu</option>
                    <option value="manual">Chỉ bản thủ công</option>
                    <option value="auto">Chỉ bản tự động</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDivisionsToCreate(eligibleDivisions.filter((d) => d.canSelect).map((d) => d.id));
                      setIsCreatingSnapshot((v) => !v);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo bản sao lưu</span>
                  </button>
                </div>
              </div>

              {/* Snapshot Creation Form */}
              {isCreatingSnapshot && (
                <form
                  onSubmit={handleCreateSnapshot}
                  className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-indigo-500" />
                      Tạo bản sao lưu mới cho phòng làm việc
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSnapshot(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newSnapshotName}
                      onChange={(e) => setNewSnapshotName(e.target.value)}
                      placeholder="Tên bản sao lưu (VD: Phiên bản hoàn thành sprint 1)"
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newSnapshotDesc}
                      onChange={(e) => setNewSnapshotDesc(e.target.value)}
                      placeholder="Ghi chú chi tiết (tùy chọn)"
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>

                  {/* Division multi-select */}
                  <div className="pt-2 border-t border-indigo-200/70 dark:border-indigo-900/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                        Chọn phân chia lưu kèm ({selectedDivisionsToCreate.length}/{eligibleDivisions.length}):
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedDivisionsToCreate(eligibleDivisions.filter((d) => d.canSelect).map((d) => d.id))}
                          className="text-indigo-600 hover:underline font-bold"
                        >
                          Chọn tất cả
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDivisionsToCreate([])}
                          className="text-slate-500 hover:underline"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    {eligibleDivisions.length === 0 ? (
                      <div className="p-3 text-center bg-white/70 dark:bg-slate-900/60 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-400">
                        Chưa có Phân chia (Division) nào trong phòng này. Bạn cần tạo ít nhất 1 Phân chia trước khi tạo bản sao lưu.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {eligibleDivisions.map((div) => {
                          const isSelected = selectedDivisionsToCreate.includes(div.id);
                          return (
                            <div
                              key={div.id}
                              onClick={() => {
                                setSelectedDivisionsToCreate((prev) =>
                                  prev.includes(div.id) ? prev.filter((id) => id !== div.id) : [...prev, div.id]
                                );
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                                isSelected
                                  ? 'border-indigo-500 bg-white dark:bg-slate-800 text-indigo-950 dark:text-indigo-200 ring-1 ring-indigo-500/20 shadow-xs'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded text-indigo-600"
                                />
                                <span className="font-semibold truncate">{div.name}</span>
                                {div.isPrivate ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                                    Riêng tư của tôi
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                    Chung (Public)
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                {div.tasksCount} việc
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSnapshot(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={!newSnapshotName.trim() || selectedDivisionsToCreate.length === 0}
                      className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs"
                    >
                      Lưu bản sao lưu
                    </button>
                  </div>
                </form>
              )}

              {/* Snapshots list */}
              {filteredSnapshots.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <p className="text-xs text-slate-400">Chưa có bản sao lưu thủ công nào.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSnapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {snap.name}
                            </span>
                            {snap.auto_generated && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Tự động
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>{new Date(snap.created_at).toLocaleString('vi-VN')}</span>
                            <span>• Bởi: {snap.created_by_name}</span>
                            <span>• {snap.stats.divisions_count} phân chia, {snap.stats.tasks_count} việc</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPointToRollbackFull(snap)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rollback</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSelectiveRollback(snap)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition"
                          >
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Chọn phân chia</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSnapshot(snap.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: JSON BACKUP / RESTORE */}
          {activeTab === 'io' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Export Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Download className="w-4 h-4 text-indigo-500" />
                    <span>Xuất dữ liệu toàn bộ (Export JSON)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tải toàn bộ cơ sở dữ liệu hiện tại (bao gồm các phòng, công việc, tin nhắn, phân chia) về máy tính dưới dạng file .json để lưu trữ an toàn.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải file backup JSON</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Upload className="w-4 h-4 text-emerald-500" />
                    <span>Nhập dữ liệu từ file JSON (Import)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Khôi phục cơ sở dữ liệu từ file backup .json đã tải về trước đây. Trước khi ghi đè, hệ thống sẽ tự động lưu lại một điểm Rollback an toàn.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Chọn file JSON để khôi phục</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111927] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>Tần suất tự động chụp bản sao lưu</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {[
                    { id: 'daily', label: 'Hàng ngày theo Giờ Việt Nam (UTC+7)', desc: 'Tự động lưu và reset mỗi ngày theo múi giờ Việt Nam' },
                    { id: '12h', label: 'Mỗi 12 giờ (Giờ Việt Nam)', desc: 'Tự động chụp lúc 00:00 & 12:00 trưa theo giờ Việt Nam' },
                    { id: '6h', label: 'Mỗi 6 giờ (Giờ Việt Nam)', desc: 'Tự động chụp lúc 00:00, 06:00, 12:00, 18:00 theo giờ Việt Nam' },
                    { id: 'hourly', label: 'Mỗi 1 giờ (Giờ Việt Nam)', desc: 'Tự động chụp đầu mỗi giờ theo giờ Việt Nam' },
                    { id: 'manual', label: 'Chỉ thủ công', desc: 'Chỉ lưu khi bạn nhấn nút tạo điểm hoặc sao lưu' },
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
            </div>
          )}
        </div>

        {/* DIALOG: CONFIRM FULL ROLLBACK */}
        {pointToRollbackFull && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Xác nhận Rollback (Khôi phục toàn bộ)
                  </h4>
                  <p className="text-xs text-slate-500">Khôi phục về: &quot;{pointToRollbackFull.name}&quot;</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phòng áp dụng:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {pointToRollbackFull.workspace_id
                      ? db.workspaces.find((w) => w.id === pointToRollbackFull.workspace_id)?.name ||
                        activeWorkspace?.name ||
                        'Phòng này'
                      : activeWorkspace?.name || 'Phòng hiện tại'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Thời điểm lưu:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(pointToRollbackFull.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Người thực hiện lưu:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {pointToRollbackFull.created_by_name}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Cô lập dữ liệu: Các phòng ban khác được bảo toàn 100%. Hệ thống sẽ tự động lưu điểm an toàn của phòng này trước khi khôi phục.</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPointToRollbackFull(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFullRollback}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xác nhận Rollback ngay</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG: SELECTIVE ROLLBACK */}
        {pointToRollbackSelective && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-800">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Rollback có chọn lọc theo Phân chia
                    </h4>
                    <p className="text-xs text-slate-500">
                      Chỉ khôi phục phân chia bạn chọn, giữ nguyên các phân chia khác
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPointToRollbackSelective(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Chọn phân chia ({selectedDivisionIdsToRollback.length}/{divisionsInSelectiveSource.length}):
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDivisionIdsToRollback(
                          divisionsInSelectiveSource.filter((d) => d.canRollback).map((d) => d.id)
                        )
                      }
                      className="text-indigo-600 hover:underline font-bold"
                    >
                      Chọn tất cả
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDivisionIdsToRollback([])}
                      className="text-slate-500 hover:underline"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {divisionsInSelectiveSource.length === 0 ? (
                  <div className="p-3 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
                    Bản lưu này không chứa phân chia hợp lệ nào (Public hoặc Riêng tư của tài khoản bạn) để khôi phục.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {divisionsInSelectiveSource.map((div) => {
                      const isSelected = selectedDivisionIdsToRollback.includes(div.id);
                      return (
                        <div
                          key={div.id}
                          onClick={() => {
                            if (!div.canRollback) return;
                            setSelectedDivisionIdsToRollback((prev) =>
                              prev.includes(div.id) ? prev.filter((id) => id !== div.id) : [...prev, div.id]
                            );
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                          } ${!div.canRollback ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!div.canRollback}
                              onChange={() => {}}
                              className="rounded text-indigo-600"
                            />
                            <span className="font-semibold truncate">{div.name}</span>
                            {div.isPrivate && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Riêng tư của tôi
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {div.tasksCount} việc • {div.clustersCount} cụm
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPointToRollbackSelective(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelectiveRollback}
                  disabled={selectedDivisionIdsToRollback.length === 0}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  Khôi phục các phân chia đã chọn
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG: CLEAR ALL RESTORE POINTS */}
        {isClearingAllPoints && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-800">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Dọn sạch điểm Rollback
                  </h4>
                  <p className="text-xs text-slate-500">Xóa toàn bộ {allRestorePoints.length} điểm hoàn tác cũ?</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Thao tác này sẽ giải phóng bộ nhớ lưu trữ các điểm checkpoint cũ. Dữ liệu công việc hiện tại sẽ không bị ảnh hưởng.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClearingAllPoints(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAllPoints}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
                >
                  Xác nhận xóa hết
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
