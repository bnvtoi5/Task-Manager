import React, { useState } from 'react';
import { Clipboard, ClipboardPaste, X, Link as LinkIcon, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const FloatingClipboardBar: React.FC = () => {
  const {
    copiedTaskIds,
    clearCopiedTasks,
    pasteTasks,
    showToast,
    db,
    activeDivision,
    activeClusterId,
    selectedTaskIds,
  } = useApp();

  const [isInherit, setIsInherit] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (copiedTaskIds.length === 0) return null;

  // Candidate clusters in current division (or fallback to all workspace clusters)
  const availableClusters = db.clusters
    .filter((c) => (activeDivision ? c.division_id === activeDivision.id : true))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Determine current target cluster
  const currentTargetCluster =
    availableClusters.find((c) => c.id === selectedClusterId) ||
    availableClusters.find((c) => c.id === activeClusterId) ||
    availableClusters[0];

  const handlePaste = () => {
    if (!currentTargetCluster) {
      showToast('Vui lòng chọn một cụm để dán công việc');
      return;
    }

    pasteTasks(currentTargetCluster.id, {
      inherit: isInherit,
      clearClipboard: false,
    });

    showToast(
      `Đã dán ${copiedTaskIds.length} công việc vào cụm "${currentTargetCluster.name}"${
        isInherit ? ' (có liên kết kế thừa)' : ''
      }`
    );
  };

  // If bulk selection is active, push clipboard bar slightly higher so both are cleanly visible
  const bottomClass = selectedTaskIds.length > 0 ? 'bottom-20' : 'bottom-6';

  return (
    <div
      data-clipboard-bar="true"
      className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2.5 bg-neutral-900/95 dark:bg-neutral-800/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-emerald-500/40 animate-in slide-in-from-bottom-5 duration-200`}
    >
      {/* Clipboard Icon & Count */}
      <div className="flex items-center gap-2 pr-2.5 border-r border-neutral-700/80 text-xs font-medium text-neutral-300">
        <div className="relative">
          <Clipboard className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-500 text-neutral-950 font-bold text-[9px] rounded-full flex items-center justify-center">
            {copiedTaskIds.length}
          </span>
        </div>
        <span className="hidden sm:inline">Bộ nhớ tạm:</span>
        <strong className="text-emerald-300 font-semibold">{copiedTaskIds.length} task</strong>
      </div>

      {/* Target Cluster Selector */}
      {availableClusters.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-700 dark:hover:bg-neutral-600 rounded-lg transition text-neutral-200 cursor-pointer max-w-[150px] truncate"
            title="Chọn cụm để dán task"
          >
            <span className="truncate">{currentTargetCluster?.name || 'Chọn cụm'}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
          </button>

          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute bottom-full mb-1.5 left-0 z-20 w-48 max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-xl py-1 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Dán vào cụm:
                </div>
                {availableClusters.map((clu) => {
                  const isSelected = clu.id === currentTargetCluster?.id;
                  return (
                    <button
                      key={clu.id}
                      type="button"
                      onClick={() => {
                        setSelectedClusterId(clu.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="truncate">{clu.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Inherit Toggle Option */}
      <button
        type="button"
        onClick={() => setIsInherit((v) => !v)}
        className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition cursor-pointer border ${
          isInherit
            ? 'bg-purple-950/60 text-purple-300 border-purple-500/50 font-medium'
            : 'bg-neutral-800 dark:bg-neutral-700 text-neutral-400 border-transparent hover:text-neutral-200'
        }`}
        title="Kế thừa: Task mới sẽ tự động đồng bộ khi task gốc được chỉnh sửa"
      >
        <LinkIcon className="w-3 h-3" />
        <span className="hidden md:inline">Kế thừa</span>
      </button>

      {/* Paste Button */}
      <button
        type="button"
        onClick={handlePaste}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg transition shadow-md cursor-pointer"
        title="Dán tất cả công việc đã chép vào cụm được chọn"
      >
        <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
        <span>Dán ngay</span>
      </button>

      {/* Clear Clipboard Button */}
      <button
        type="button"
        onClick={() => {
          clearCopiedTasks();
          showToast('Đã xóa bộ nhớ tạm');
        }}
        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
        title="Bỏ sao chép / Đóng bộ nhớ tạm"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
