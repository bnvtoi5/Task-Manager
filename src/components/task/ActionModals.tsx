import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, FolderKanban } from 'lucide-react';
import { Cluster } from '../../types';
import { useApp } from '../../context/AppContext';

interface BulkMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: Cluster[];
  taskIdsToMove: string[];
  modeId?: string;
}

export const BulkMoveModal: React.FC<BulkMoveModalProps> = ({
  isOpen,
  onClose,
  clusters,
  taskIdsToMove,
  modeId,
}) => {
  const { bulkMoveTasks } = useApp();
  const [targetClusterId, setTargetClusterId] = useState(clusters[0]?.id || '');

  useEffect(() => {
    if (isOpen && clusters.length > 0) {
      if (!clusters.some((c) => c.id === targetClusterId)) {
        setTargetClusterId(clusters[0].id);
      }
    }
  }, [isOpen, clusters, targetClusterId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClusterId) return;
    bulkMoveTasks(taskIdsToMove, targetClusterId, modeId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Chuyển {taskIdsToMove.length} công việc sang Cụm khác
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cập nhật cụm hiển thị tức thì trên bảng hiện tại
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Chọn Cụm / Cột đích đến
            </label>
            <select
              value={targetClusterId}
              onChange={(e) => setTargetClusterId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a263d] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!targetClusterId}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl shadow-xs transition"
            >
              Xác nhận chuyển
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
