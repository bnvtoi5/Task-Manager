import React from 'react';
import { ShieldAlert, Laptop, Clock, ArrowRight, X } from 'lucide-react';
import { SessionDisplacedNotice } from '../../types';

interface SessionDisplacedModalProps {
  notice: SessionDisplacedNotice;
  onClose: () => void;
}

export const SessionDisplacedModal: React.FC<SessionDisplacedModalProps> = ({
  notice,
  onClose,
}) => {
  if (!notice.isOpen) return null;

  const formattedTime = notice.loggedInAt
    ? new Date(notice.loggedInAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'Vừa xong';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header accent strip */}
        <div className="h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />

        <div className="p-6">
          {/* Close icon */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon and title */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
                Phiên đăng nhập đã kết thúc
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Phát hiện đăng nhập trên thiết bị hoặc trình duyệt khác
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
            Tài khoản <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">{notice.userEmail || 'của bạn'}</strong> vừa được đăng nhập thành công ở một nơi khác.
            Để đảm bảo an toàn và <strong className="text-amber-700 dark:text-amber-300 font-medium">tránh xung đột dữ liệu</strong>, phiên làm việc trên máy này đã tự động ngắt kết nối.
          </div>

          {/* Device and Time Info Box */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-2 mb-5">
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <Laptop className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-neutral-500 dark:text-neutral-400">Thiết bị mới:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                {notice.newDevice || 'Trình duyệt khác'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-neutral-500 dark:text-neutral-400">Thời gian:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-100">
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Đã hiểu & Đăng nhập lại</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
