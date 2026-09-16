import React, { useState, useEffect } from 'react';
import {
  X,
  Briefcase,
  Calendar,
  Layers,
  FolderKanban,
  Globe,
  Lock,
  Copy,
  Check,
  UserPlus,
  Trash2
} from 'lucide-react';
import {
  Workspace,
  Period,
  Division,
  Cluster,
  PeriodType,
  DivisionVisibility,
  DivisionLayoutType,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';

// 1. Workspace Modal (Create OR Join by code)
interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'join';
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  mode: initialMode = 'create',
}) => {
  const { createWorkspace, joinWorkspaceByCode } = useApp();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialMode);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [inviteCode, setInviteCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setActiveTab(initialMode);
    setName('');
    setDescription('');
    setInviteCode('');
    setErrorMsg('');
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      createWorkspace(name.trim(), description.trim(), 'Briefcase', color);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo phòng làm việc');
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    const res = joinWorkspaceByCode(inviteCode.trim());
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setErrorMsg('');
              }}
              className={`text-xs font-bold pb-1 border-b-2 transition ${
                activeTab === 'create'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tạo phòng làm việc mới
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('join');
                setErrorMsg('');
              }}
              className={`text-xs font-bold pb-1 border-b-2 transition ${
                activeTab === 'join'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Tham gia bằng mã mời
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        {activeTab === 'create' ? (
          <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên phòng làm việc <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Phòng Kỹ thuật, Team Sản phẩm..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mô tả ngắn
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mục đích và phạm vi hoạt động của phòng..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Màu sắc nhận diện
              </label>
              <div className="flex items-center gap-2">
                {['#4F46E5', '#0284C7', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  )
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
              >
                Tạo phòng
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nhập mã mời của phòng (Invite Code) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="VD: WS-XYZ123"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 font-mono tracking-widest text-center uppercase font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                autoFocus
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Hỏi chủ phòng hoặc đồng nghiệp để nhận mã mời 8 ký tự.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
              >
                Tham gia ngay
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// 2. Period Modal (Create / Edit + Deletion)
interface PeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodToEdit?: Period | null;
}

export const PeriodModal: React.FC<PeriodModalProps> = ({
  isOpen,
  onClose,
  periodToEdit,
}) => {
  const { activeWorkspace, createPeriod, updatePeriod, deletePeriod } = useApp();
  const [name, setName] = useState('');
  const [type, setType] = useState<PeriodType>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (periodToEdit) {
      setName(periodToEdit.name);
      setType(periodToEdit.type);
      setStartDate(periodToEdit.start_date || '');
      setEndDate(periodToEdit.end_date || '');
      setColor(periodToEdit.color || '#4F46E5');
    } else {
      setName('');
      setType('week');
      setStartDate(new Date().toISOString().split('T')[0]);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setEndDate(nextWeek.toISOString().split('T')[0]);
      setColor('#4F46E5');
    }
  }, [periodToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (periodToEdit) {
      updatePeriod(periodToEdit.id, {
        name: name.trim(),
        type,
        start_date: startDate,
        end_date: endDate,
        color,
      });
    } else {
      if (!activeWorkspace) return;
      createPeriod({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        type,
        start_date: startDate,
        end_date: endDate,
        timezone: 'Asia/Ho_Chi_Minh',
        color,
        sort_order: 0,
        is_archived: false,
      });
    }
    onClose();
  };

  const handleConfirmDelete = () => {
    if (periodToEdit) {
      deletePeriod(periodToEdit.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {periodToEdit ? 'Chỉnh sửa Thời gian (Period)' : 'Tạo Period mới'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên Period <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Sprint 12, Tháng 9/2026, Quý 3..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kiểu chu kỳ
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PeriodType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="week">Theo tuần (Week)</option>
                <option value="month">Theo tháng (Month)</option>
                <option value="quarter">Theo quý (Quarter)</option>
                <option value="custom">Tùy biến (Custom)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ngày kết thúc
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              {/* Deletion button if editing */}
              {periodToEdit ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3 py-1.5 rounded-xl transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Period</span>
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  {periodToEdit ? 'Lưu thay đổi' : 'Tạo Period'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Xác nhận xóa Period"
        message={`Bạn có chắc muốn xóa Period "${periodToEdit?.name}" không? Tất cả các phân chia (division), cụm (cluster) và công việc bên trong sẽ bị xóa.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

// 3. Division Modal (Create / Edit + Deletion)
interface DivisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  divisionToEdit?: Division | null;
}

export const DivisionModal: React.FC<DivisionModalProps> = ({
  isOpen,
  onClose,
  divisionToEdit,
}) => {
  const { activeWorkspace, activePeriod, createDivision, updateDivision, deleteDivision } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<DivisionVisibility>('public');
  const [color, setColor] = useState('#4F46E5');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (divisionToEdit) {
      setName(divisionToEdit.name);
      setDescription(divisionToEdit.description || '');
      setVisibility(divisionToEdit.visibility);
      setColor(divisionToEdit.color || '#4F46E5');
    } else {
      setName('');
      setDescription('');
      setVisibility('public');
      setColor('#4F46E5');
    }
  }, [divisionToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (divisionToEdit) {
      updateDivision(divisionToEdit.id, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        color,
      });
    } else {
      if (!activeWorkspace || !activePeriod) return;
      createDivision({
        period_id: activePeriod.id,
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        description: description.trim(),
        visibility,
        layout_type: 'full',
        color,
        icon: 'Layers',
        sort_order: 0,
        is_default: false,
      });
    }
    onClose();
  };

  const handleConfirmDelete = () => {
    if (divisionToEdit) {
      deleteDivision(divisionToEdit.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {divisionToEdit ? 'Chỉnh sửa Phân chia (Division)' : 'Tạo Division mới'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên Division <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Frontend Team, Nhiệm vụ cá nhân, Backend Core..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mô tả
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả phạm vi hoặc phân công của division này..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none transition"
              />
            </div>

            {/* Visibility Selector: Public vs Private */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Chế độ hiển thị (Visibility)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition ${
                    visibility === 'public'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152037] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="text-indigo-600"
                    />
                    <Globe className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold">Công khai</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 pl-6 leading-tight">
                    Tất cả thành viên trong phòng đều thấy và làm việc.
                  </p>
                </label>

                <label
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition ${
                    visibility === 'private'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#152037] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                      className="text-amber-600"
                    />
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span className="font-bold">Riêng tư</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 pl-6 leading-tight">
                    Chỉ một mình bạn thấy được phân chia này.
                  </p>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              {/* Deletion button if editing */}
              {divisionToEdit ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3 py-1.5 rounded-xl transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Division</span>
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  {divisionToEdit ? 'Lưu thay đổi' : 'Tạo Division'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Xác nhận xóa Division"
        message={`Bạn có chắc muốn xóa Division "${divisionToEdit?.name}" không? Tất cả các cụm (cluster) và công việc bên trong sẽ bị xóa.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

// 4. Cluster Modal (Create / Edit + Deletion)
interface ClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterToEdit?: Cluster | null;
}

export const ClusterModal: React.FC<ClusterModalProps> = ({
  isOpen,
  onClose,
  clusterToEdit,
}) => {
  const { activeDivision, createCluster, updateCluster, deleteCluster } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (clusterToEdit) {
      setName(clusterToEdit.name);
      setDescription(clusterToEdit.description || '');
      setColor(clusterToEdit.color || '#4F46E5');
    } else {
      setName('');
      setDescription('');
      setColor('#4F46E5');
    }
  }, [clusterToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (clusterToEdit) {
      updateCluster(clusterToEdit.id, {
        name: name.trim(),
        description: description.trim(),
        color,
      });
    } else {
      if (!activeDivision) return;
      createCluster({
        division_id: activeDivision.id,
        name: name.trim(),
        description: description.trim(),
        color,
        icon: 'FolderKanban',
        sort_order: 0,
        is_collapsed: false,
      });
    }
    onClose();
  };

  const handleConfirmDelete = () => {
    if (clusterToEdit) {
      deleteCluster(clusterToEdit.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {clusterToEdit ? 'Chỉnh sửa Cụm (Cluster)' : 'Tạo Cụm mới'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên Cụm <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Cần làm (Backlog), Đang xử lý, Hoàn thành..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mô tả ngắn
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mục tiêu hoặc tiêu chí của cụm công việc này..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Màu đại diện
              </label>
              <div className="flex items-center gap-2">
                {['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'].map(
                  (c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        color === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  )
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              {/* Deletion button if editing */}
              {clusterToEdit ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3 py-1.5 rounded-xl transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa Cụm</span>
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                >
                  {clusterToEdit ? 'Lưu thay đổi' : 'Tạo Cụm'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Xác nhận xóa Cụm (Cluster)"
        message={`Bạn có chắc muốn xóa Cụm "${clusterToEdit?.name}" không? Tất cả các công việc (tasks) trong cụm này sẽ bị xóa vĩnh viễn.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

// 5. Invite Modal
interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode?: string;
  workspaceName?: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  inviteCode = '',
  workspaceName = '',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Mời thành viên vào phòng
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Chia sẻ mã mời này cho đồng nghiệp để họ tham gia vào phòng làm việc{' '}
            <strong className="text-slate-900 dark:text-slate-100">{workspaceName}</strong>.
          </p>

          <div className="p-4 bg-slate-50 dark:bg-[#1a263d] rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Mã mời (Invite Code)
              </span>
              <div className="text-2xl font-bold tracking-widest text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                {inviteCode}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Thành viên sau khi đăng nhập chọn mục <strong>Tham gia bằng mã</strong> và nhập mã trên để được cấp quyền truy cập ngay lập tức.
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
