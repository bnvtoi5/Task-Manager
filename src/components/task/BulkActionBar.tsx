import React, { useState } from 'react';
import { ArrowRightLeft, Trash2, X, CheckCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface BulkActionBarProps {
  onOpenBulkMove: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  onOpenBulkMove,
}) => {
  const { selectedTaskIds, clearTaskSelection, bulkDeleteTasks } = useApp();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  if (selectedTaskIds.length === 0) return null;

  return (
    <>
      <div
        data-bulk-bar="true"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 bg-neutral-900/90 dark:bg-neutral-800/95 text-white backdrop-blur-md rounded-2xl shadow-xl border border-neutral-700/60 animate-in slide-in-from-bottom-5 duration-200"
      >
        {/* Selection counter */}
        <div className="flex items-center gap-2 pr-2 border-r border-neutral-700 text-xs font-medium text-neutral-300">
          <CheckCheck className="w-4 h-4 text-blue-400" />
          <span>Đã chọn {selectedTaskIds.length} task</span>
        </div>

        {/* Actions: Chuyển cụm, Xóa */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenBulkMove}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-700 dark:hover:bg-neutral-600 rounded-lg transition cursor-pointer"
            title="Chuyển cụm hàng loạt"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>Chuyển cụm</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg transition shadow-xs cursor-pointer"
            title="Xóa các task đã chọn"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa</span>
          </button>
        </div>

        {/* Clear selection */}
        <button
          type="button"
          onClick={clearTaskSelection}
          className="p-1.5 ml-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
          title="Bỏ chọn tất cả"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title="Xác nhận xóa công việc đã chọn"
        message={`Bạn có chắc chắn muốn xóa ${selectedTaskIds.length} công việc đã chọn? Thao tác này sẽ xóa các công việc khỏi cụm.`}
        confirmText={`Xóa ${selectedTaskIds.length} công việc`}
        cancelText="Hủy bỏ"
        isDangerous
        onConfirm={() => {
          bulkDeleteTasks(selectedTaskIds);
          setIsConfirmModalOpen(false);
        }}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </>
  );
};

