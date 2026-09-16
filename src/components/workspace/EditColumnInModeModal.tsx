import React, { useState, useEffect } from 'react';
import { X, Edit2, Check } from 'lucide-react';

interface EditColumnInModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: { id: string; name: string; color?: string } | null;
  modeName: string;
  onSave: (columnId: string, name: string, color: string) => void;
}

const COLOR_PALETTE = [
  '#6366F1', // Indigo
  '#3B82F6', // Blue
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#84CC16', // Lime
  '#F59E0B', // Amber
  '#F97316', // Orange
  '#EF4444', // Rose/Red
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#64748B', // Slate
];

export const EditColumnInModeModal: React.FC<EditColumnInModeModalProps> = ({
  isOpen,
  onClose,
  column,
  modeName,
  onSave,
}) => {
  const [columnName, setColumnName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366F1');

  useEffect(() => {
    if (column) {
      setColumnName(column.name || '');
      setSelectedColor(column.color || '#6366F1');
    }
  }, [column]);

  if (!isOpen || !column) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!columnName.trim()) return;
    onSave(column.id, columnName.trim(), selectedColor);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#121a2d] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#141f36]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Chỉnh sửa cụm (cột)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chế độ bảng: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{modeName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tên cụm (cột) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              placeholder="VD: Cần làm, Đang làm, Hoàn thành..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e1626] text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Màu sắc phân biệt
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''
                  }`}
                >
                  {selectedColor === color && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!columnName.trim()}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
