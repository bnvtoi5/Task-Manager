import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  X,
  Clock,
  PlusCircle,
  Trash2,
  Edit3,
  Bell,
  BellOff,
  FolderPlus,
  Building2,
  Layout,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Sparkles,
  ArrowRightLeft,
  FolderKanban,
  Mic,
  MicOff,
} from 'lucide-react';
import { ActionProposal, MascotActionType } from './mascotAITypes';
import { parseLocalAlarmComponents } from './mascotActionExecutor';
import { createSpeechRecognizer, SpeechRecognitionController } from './mascotVoiceService';

export interface ActionConfirmationMenuProps {
  proposals: ActionProposal[];
  onConfirmAll?: () => void;
  onExecuteAll?: () => void;
  onRejectAll: () => void;
  onExecuteSingle: (proposalId: string) => void;
  onRejectSingle: (proposalId: string) => void;
  isExecuting?: boolean;
}

export const ActionConfirmationMenu: React.FC<ActionConfirmationMenuProps> = ({
  proposals,
  onConfirmAll,
  onExecuteAll,
  onRejectAll,
  onExecuteSingle,
  onRejectSingle,
  isExecuting = false,
}) => {
  if (!proposals || proposals.length === 0) return null;

  const handleAllConfirm = onConfirmAll || onExecuteAll || (() => {});

  const pendingCount = proposals.filter((p) => !p.status || p.status === 'pending').length;
  const executedCount = proposals.filter((p) => p.status === 'executed').length;

  // Voice approval state
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');
  const voiceRecognizerRef = useRef<SpeechRecognitionController | null>(null);

  const startVoiceApprovalListening = () => {
    try {
      voiceRecognizerRef.current?.abort();
    } catch (e) {}

    const recognizer = createSpeechRecognizer({
      lang: 'vi-VN',
      continuous: true,
      silenceTimeoutMs: 4000,
      onStart: () => {
        setIsVoiceListening(true);
        setVoiceHint('Đang nghe... Hãy nói "Duyệt" hoặc "Hủy"');
      },
      onResult: (transcript) => {
        const text = transcript.trim().toLowerCase();
        setVoiceHint(`Nghe được: "${transcript}"`);

        if (/^(duyệt|đồng ý|xác nhận|thực hiện|ok|chấp nhận|yes|approve|confirm)/i.test(text)) {
          setIsVoiceListening(false);
          setVoiceHint('✅ Đã nhận lệnh DUYỆT!');
          recognizer?.stop();
          handleAllConfirm();
        } else if (/^(hủy|từ chối|không duyệt|bỏ qua|cancel|reject)/i.test(text)) {
          setIsVoiceListening(false);
          setVoiceHint('✕ Đã nhận lệnh HỦY!');
          recognizer?.stop();
          onRejectAll();
        }
      },
      onError: (err) => {
        setIsVoiceListening(false);
        setVoiceHint('');
      },
      onEnd: () => {
        setIsVoiceListening(false);
      },
    });

    if (recognizer) {
      voiceRecognizerRef.current = recognizer;
      recognizer.start();
    }
  };

  const stopVoiceApprovalListening = () => {
    try {
      voiceRecognizerRef.current?.stop();
    } catch (e) {}
    setIsVoiceListening(false);
    setVoiceHint('');
  };

  useEffect(() => {
    return () => {
      try {
        voiceRecognizerRef.current?.abort();
      } catch (e) {}
    };
  }, []);

  const getActionBadge = (action: MascotActionType) => {
    switch (action) {
      case 'create_task':
        return {
          icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Tạo công việc',
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'update_task':
        return {
          icon: <Edit3 className="w-3.5 h-3.5 text-blue-500" />,
          label: 'Cập nhật việc',
          bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'delete_task':
        return {
          icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />,
          label: 'Xóa việc',
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      case 'move_task':
        return {
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-teal-500" />,
          label: 'Chuyển phân chia',
          bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        };
      case 'set_alarm':
        return {
          icon: <Bell className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Hẹn giờ báo thức',
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'cancel_alarm':
        return {
          icon: <BellOff className="w-3.5 h-3.5 text-rose-500" />,
          label: 'Tắt / Hủy báo thức',
          bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      case 'create_cluster':
        return {
          icon: <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />,
          label: 'Tạo cụm',
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        };
      case 'update_cluster':
      case 'delete_cluster':
        return {
          icon: <FolderPlus className="w-3.5 h-3.5 text-purple-500" />,
          label: 'Quản lý cụm',
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      case 'create_division':
      case 'update_division':
      case 'delete_division':
        return {
          icon: <Layout className="w-3.5 h-3.5 text-cyan-500" />,
          label: 'Phân chia (Division)',
          bg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
        };
      case 'create_board_mode':
      case 'update_board_mode':
      case 'delete_board_mode':
        return {
          icon: <Layout className="w-3.5 h-3.5 text-fuchsia-500" />,
          label: 'Chế độ bảng (Board Mode)',
          bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800',
        };
      case 'create_period':
      case 'update_period':
      case 'delete_period':
        return {
          icon: <Calendar className="w-3.5 h-3.5 text-sky-500" />,
          label: 'Chu kỳ (Period)',
          bg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        };
      case 'create_workspace':
      case 'update_workspace':
      case 'delete_workspace':
        return {
          icon: <Building2 className="w-3.5 h-3.5 text-violet-500" />,
          label: 'Phòng làm việc',
          bg: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
        };
      default:
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />,
          label: 'Thao tác khác',
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return { label: 'Khẩn cấp', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-800' };
      case 'high':
        return { label: 'Cao', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-300 dark:border-orange-800' };
      case 'low':
        return { label: 'Thấp', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
      default:
        return { label: 'Bình thường', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/30 dark:from-[#1b2230] dark:via-[#161c28] dark:to-[#121620] p-3.5 text-xs shadow-md space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-200/70 dark:border-slate-700/60 pb-2.5">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-[13px]">Bảng Duyệt Thao Tác</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
            {proposals.length} đề xuất
          </span>
        </div>
        {executedCount > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã xong {executedCount}/{proposals.length}
          </span>
        )}
      </div>

      {/* List of items */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {proposals.map((item, idx) => {
          const badge = getActionBadge(item.action);
          const isDone = item.status === 'executed';
          const isRejected = item.status === 'rejected';
          const d = item.details || {};

          return (
            <div
              key={item.id || idx}
              className={`p-3 rounded-xl border transition-all ${
                isDone
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80 opacity-90'
                  : isRejected
                  ? 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 line-through opacity-60'
                  : 'bg-white dark:bg-slate-800/95 border-slate-200/90 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 shadow-sm'
              }`}
            >
              {/* Item Top Row: Action badge, Title, and Action Buttons */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.bg}`}
                  >
                    {badge.icon}
                    <span>{badge.label}</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[200px] sm:max-w-[280px]">
                    {item.target_name || d.title || 'Thao tác mới'}
                  </span>
                </div>

                {/* Status indicator or action buttons */}
                <div className="shrink-0">
                  {isDone ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã duyệt</span>
                    </span>
                  ) : isRejected ? (
                    <span className="px-2 py-0.5 text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md">
                      Đã hủy
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isExecuting}
                        onClick={() => onExecuteSingle(item.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                        title="Duyệt và thực hiện ngay thao tác này"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Duyệt</span>
                      </button>
                      <button
                        type="button"
                        disabled={isExecuting}
                        onClick={() => onRejectSingle(item.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                        title="Hủy bỏ thao tác này"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Hierarchy confirmation grid: Phòng, Period, Division, Chế độ bảng, Cụm / Cột */}
              {(item.action === 'create_task' || (item.action === 'update_task' && (d.workspace_name || d.division_name || d.cluster_name || d.board_mode_name))) && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 p-2 rounded-lg bg-amber-50/60 dark:bg-slate-900/60 border border-amber-200/50 dark:border-slate-700/60 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">Phòng:</span>
                    <span className="font-semibold truncate text-slate-900 dark:text-slate-100">
                      {d.workspace_name || d.workspace_id || 'Mặc định'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">Period:</span>
                    <span className="font-semibold truncate text-slate-900 dark:text-slate-100">
                      {d.period_name || d.period_id || 'Mặc định'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Layout className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">Division:</span>
                    <span className="font-semibold truncate text-slate-900 dark:text-slate-100">
                      {d.division_name || d.division_id || 'Mặc định'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <FolderKanban className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">Chế độ:</span>
                    <span className="font-semibold truncate text-fuchsia-700 dark:text-fuchsia-300">
                      {d.board_mode_name || d.board_mode_id || 'Kanban'}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center gap-1 text-slate-700 dark:text-slate-300 pt-1 border-t border-amber-200/50 dark:border-slate-800">
                    <Layers className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">Cột / Cụm:</span>
                    <span className="font-semibold truncate text-slate-900 dark:text-slate-100">
                      {d.cluster_name || d.cluster_id || 'Mặc định'}
                      {typeof d.cluster_index === 'number' ? ` (Cột ${d.cluster_index})` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Summary description */}
              <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                {item.summary}
              </p>

              {/* Specific metadata chips (Priority, Due Date, Alarm) */}
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {d.priority && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      getPriorityBadge(d.priority).color
                    }`}
                  >
                    <span>Ưu tiên:</span>
                    <span>{getPriorityBadge(d.priority).label}</span>
                  </span>
                )}

                {d.due_date && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Hạn: {d.due_date}</span>
                  </span>
                )}

                {item.action === 'create_board_mode' && Array.isArray(d.clusters) && d.clusters.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-fuchsia-100/90 dark:bg-fuchsia-900/40 text-fuchsia-800 dark:text-fuchsia-200 text-[10px] font-semibold border border-fuchsia-300 dark:border-fuchsia-800 flex-wrap">
                    <Layout className="w-3 h-3 text-fuchsia-600 shrink-0" />
                    <span>
                      Các cột:{' '}
                      {d.clusters.map((c: any) => (typeof c === 'string' ? c : c.name)).join(' ➔ ')}
                    </span>
                  </div>
                )}

                {item.action === 'move_task' && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-100/90 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 text-[10px] font-semibold border border-teal-300 dark:border-teal-800 flex-wrap">
                    <ArrowRightLeft className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>
                      {d.old_division_name ? `${d.old_division_name} ➔ ` : ''}
                      {d.target_division_name || d.division_name || 'Phân chia mới'}
                      {d.target_board_mode_name || d.board_mode_name ? ` [Chế độ: ${d.target_board_mode_name || d.board_mode_name}]` : ''}
                      {d.target_cluster_name || d.cluster_name ? ` (Cột: ${d.target_cluster_name || d.cluster_name})` : ''}
                    </span>
                  </div>
                )}

                {item.action === 'cancel_alarm' && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100/90 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 text-[10px] font-semibold border border-rose-300 dark:border-rose-800">
                    <BellOff className="w-3 h-3 text-rose-600" />
                    <span>Tắt / Hủy chuông hẹn giờ</span>
                  </div>
                )}

                {item.action === 'set_alarm' && (d.alarm_time || d.alarm_at) && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-semibold border border-amber-300 dark:border-amber-800">
                    <Bell className="w-3 h-3 text-amber-600" />
                    <span>
                      Chuông reo:{' '}
                      {(() => {
                        try {
                          const { year, month, day, hours, minutes } = parseLocalAlarmComponents(d.alarm_time, d.alarm_at);
                          const hh = String(hours).padStart(2, '0');
                          const mm = String(minutes).padStart(2, '0');
                          const dStr = String(day).padStart(2, '0');
                          const mStr = String(month).padStart(2, '0');
                          return `${hh}:${mm} ngày ${dStr}/${mStr}/${year}`;
                        } catch {
                          return d.alarm_time || d.alarm_at || 'Đã hẹn giờ';
                        }
                      })()}
                    </span>
                    {d.alarm_repeat && d.alarm_repeat !== 'none' && (
                      <span className="ml-1 text-[9px] uppercase tracking-wider text-amber-600">
                        ({d.alarm_repeat})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Actions Footer (if there are still pending actions) */}
      {pendingCount > 0 && (
        <div className="space-y-2 pt-2.5 border-t border-amber-200/70 dark:border-slate-700/60">
          {/* Voice Command Hint / Listening feedback */}
          {voiceHint && (
            <div className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 animate-pulse">
              <Mic className="w-3 h-3 text-indigo-500" />
              <span>{voiceHint}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={isExecuting}
              onClick={onRejectAll}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] transition disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>

            {/* Voice Approve Trigger */}
            <button
              type="button"
              disabled={isExecuting}
              onClick={() => {
                if (isVoiceListening) stopVoiceApprovalListening();
                else startVoiceApprovalListening();
              }}
              className={`px-2.5 py-1.5 rounded-xl border font-bold text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isVoiceListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
              }`}
              title="Nói 'Duyệt' hoặc 'Hủy' để điều khiển bằng giọng nói"
            >
              {isVoiceListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isVoiceListening ? 'Đang nghe...' : 'Nói để duyệt'}</span>
            </button>

            <button
              type="button"
              disabled={isExecuting}
              onClick={handleAllConfirm}
              className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Duyệt tất cả ({pendingCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
