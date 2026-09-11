import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { Cluster } from '../../types';
import { useApp } from '../../context/AppContext';

interface BulkMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: Cluster[];
  taskIdsToMove: string[];
}

export const BulkMoveModal: React.FC<BulkMoveModalProps> = ({
  isOpen,
  onClose,
  clusters,
  taskIdsToMove,
}) => {
  const { bulkMoveTasks } = useApp();
  const [targetClusterId, setTargetClusterId] = useState(clusters[0]?.id || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClusterId) return;
    bulkMoveTasks(taskIdsToMove, targetClusterId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Chuyển {taskIdsToMove.length} task sang Cụm khác
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Chọn Cụm đích
            </label>
            <select
              value={targetClusterId}
              onChange={(e) => setTargetClusterId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500"
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Xác nhận chuyển
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
