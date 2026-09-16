import React, { useState } from 'react';
import { X, Plus, Trash2, Sliders, Palette } from 'lucide-react';
import { BoardMode, BoardModeCluster } from '../../types';

interface CreateBoardModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMode: (name: string, description: string, clusters: BoardModeCluster[]) => void;
}

const PRESET_COLORS = [
  '#6366F1', // Indigo
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#64748B', // Slate
];

export const CreateBoardModeModal: React.FC<CreateBoardModeModalProps> = ({
  isOpen,
  onClose,
  onCreateMode,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clusters, setClusters] = useState<Array<{ name: string; color: string }>>([]);

  if (!isOpen) return null;

  const handleAddCluster = () => {
    const nextColor = PRESET_COLORS[clusters.length % PRESET_COLORS.length];
    setClusters([...clusters, { name: `Cột ${clusters.length + 1}`, color: nextColor }]);
  };

  const handleRemoveCluster = (index: number) => {
    setClusters(clusters.filter((_, i) => i !== index));
  };

  const handleClusterNameChange = (index: number, val: string) => {
    const updated = [...clusters];
    updated[index].name = val;
    setClusters(updated);
  };

  const handleClusterColorChange = (index: number, color: string) => {
    const updated = [...clusters];
    updated[index].color = color;
    setClusters(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const validClusters: BoardModeCluster[] = clusters
      .filter((c) => c.name.trim().length > 0)
      .map((c, idx) => ({
        id: `cmc-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        name: c.name.trim(),
        color: c.color,
        sort_order: idx + 1,
      }));

    onCreateMode(name.trim(), description.trim(), validClusters);
    setName('');
    setDescription('');
    setClusters([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-[#111927] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#131d31]/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Tạo Chế độ Bảng Mới (Custom Mode)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tạo góc nhìn độc lập với các cụm/cột riêng. Vị trí kéo thả task trong chế độ này không ảnh hưởng chế độ khác.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tên Chế độ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Theo Sprint, Theo Bộ phận, Giai đoạn..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mô tả ngắn (tùy chọn)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Phân nhóm công việc theo các tuần Sprint phát triển"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Các Cụm / Cột trong Chế độ ({clusters.length})
              </label>
              <button
                type="button"
                onClick={handleAddCluster}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm cột
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {clusters.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Chưa có cụm/cột nào. Bạn có thể tạo chế độ bảng trước rồi thêm cột sau, hoặc nhấn <strong>&quot;Thêm cột&quot;</strong> ở trên.
                </div>
              ) : (
                clusters.map((cluster, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#141e30] border border-slate-200/80 dark:border-slate-800"
                  >
                    <span className="text-[11px] font-bold text-slate-400 w-4 text-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      required
                      value={cluster.name}
                      onChange={(e) => handleClusterNameChange(idx, e.target.value)}
                      placeholder="Tên cột..."
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0c1220] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.slice(0, 5).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleClusterColorChange(idx, color)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            cluster.color === color ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCluster(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition"
                      title="Xóa cột này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
            >
              Tạo Chế độ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
