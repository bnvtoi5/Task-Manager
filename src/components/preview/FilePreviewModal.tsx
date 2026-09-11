import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const FilePreviewModal: React.FC = () => {
  const { previewAttachment, setPreviewAttachment } = useApp();

  if (!previewAttachment) return null;

  const isImage = previewAttachment.mime_type.startsWith('image/');
  const isPdf =
    previewAttachment.mime_type === 'application/pdf' ||
    previewAttachment.file_name.toLowerCase().endsWith('.pdf');

  const handleClose = () => {
    setPreviewAttachment(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#131d31]">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {previewAttachment.file_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {(previewAttachment.file_size / 1024).toFixed(1)} KB • {previewAttachment.mime_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={previewAttachment.preview_url}
              download={previewAttachment.file_name}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải xuống</span>
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/70 dark:bg-[#0b0f19]">
          {isImage ? (
            <img
              src={previewAttachment.preview_url}
              alt={previewAttachment.file_name}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-xs"
              referrerPolicy="no-referrer"
            />
          ) : isPdf ? (
            <div className="w-full h-[65vh] flex flex-col items-center justify-center bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
              <FileText className="w-16 h-16 text-rose-500 mb-3" />
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Tài liệu PDF: {previewAttachment.file_name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Tài liệu hỗ trợ đầy đủ font chữ tiếng Việt (Unicode). Bạn có thể mở trực tiếp hoặc tải về máy.
              </p>
              <div className="mt-5 flex gap-3">
                <a
                  href={previewAttachment.preview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mở tệp PDF
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="w-16 h-16 text-slate-400 mb-3" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Không có bản xem trước trực tiếp cho định dạng này.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tên tệp: {previewAttachment.file_name}. Vui lòng tải về máy để mở.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
