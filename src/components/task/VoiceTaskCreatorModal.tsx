import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  X,
  Sparkles,
  CheckCircle2,
  Calendar,
  Bell,
  ArrowRight,
  FolderKanban,
  Edit3,
  Volume2,
  Layers,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TaskPriority, BoardModeCluster, Task } from '../../types';
import {
  createSpeechRecognizer,
  isSpeechRecognitionAvailable,
  SpeechRecognitionController,
} from '../mascot/mascotVoiceService';

interface VoiceTaskCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClusterId?: string;
  onOpenDetailedEditor?: (prefilled: Partial<Task>) => void;
}

export const VoiceTaskCreatorModal: React.FC<VoiceTaskCreatorModalProps> = ({
  isOpen,
  onClose,
  initialClusterId,
  onOpenDetailedEditor,
}) => {
  const {
    db,
    activeWorkspace,
    activePeriod,
    activeDivision,
    activeBoardModeId,
    createTask,
    showToast,
  } = useApp();

  // Active Board Mode and its columns
  const activeBoardMode = useMemo(() => {
    if (!db.board_modes) return null;
    return (
      db.board_modes.find((m) => m.id === activeBoardModeId) ||
      db.board_modes.find((m) => m.division_id === activeDivision?.id) ||
      db.board_modes[0] ||
      null
    );
  }, [db.board_modes, activeBoardModeId, activeDivision]);

  // Available clusters for the current view
  const availableClusters = useMemo(() => {
    if (activeBoardMode && activeBoardMode.clusters && activeBoardMode.clusters.length > 0) {
      return activeBoardMode.clusters;
    }
    if (activeDivision) {
      return db.clusters.filter((c) => c.division_id === activeDivision.id);
    }
    return [];
  }, [activeBoardMode, activeDivision, db.clusters]);

  // Target cluster ID
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');

  useEffect(() => {
    if (initialClusterId && availableClusters.some((c) => c.id === initialClusterId)) {
      setSelectedClusterId(initialClusterId);
    } else if (availableClusters.length > 0) {
      setSelectedClusterId(availableClusters[0].id);
    }
  }, [initialClusterId, availableClusters]);

  // Voice & Recognition State
  const [isListening, setIsListening] = useState(false);
  const [rawTranscript, setRawTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState<'vi' | 'en'>('vi');
  const [isSupported, setIsSupported] = useState(true);

  // Parsed Task Fields (Editable by user)
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [alarmTime, setAlarmTime] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');

  // Recognizer ref
  const recognizerRef = useRef<SpeechRecognitionController | null>(null);

  // Check speech recognition support
  useEffect(() => {
    setIsSupported(isSpeechRecognitionAvailable());
  }, []);

  // Natural Language Parser for Voice Input
  const parseVoiceInput = (text: string) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // 1. Detect approval command if user speaks confirmation
    const isApprovalCommand = /^(duyệt|đồng ý|xác nhận|tạo việc|tạo task|thực hiện|chấp nhận|xong|ok tạo)$/i.test(
      cleanText.replace(/[\.\!\?]/g, '').trim()
    );
    if (isApprovalCommand && taskTitle.trim()) {
      handleApproveAndCreate();
      return;
    }

    let extractedTitle = cleanText;
    let detectedPriority: TaskPriority = taskPriority;
    let detectedClusterId = selectedClusterId;
    let detectedAlarm = alarmTime;
    let detectedAlarmEnabled = alarmEnabled;
    let detectedDesc = taskDescription;

    // Detect Priority
    if (/(?:ưu tiên|mức)?\s*(?:khẩn cấp|tối khẩn|gấp nhất|urgent)/i.test(cleanText)) {
      detectedPriority = 'urgent';
      extractedTitle = extractedTitle.replace(/(?:ưu tiên|mức)?\s*(?:khẩn cấp|tối khẩn|gấp nhất|urgent)/gi, '');
    } else if (/(?:ưu tiên|mức)?\s*(?:cao|rất quan trọng|gấp|high)/i.test(cleanText)) {
      detectedPriority = 'high';
      extractedTitle = extractedTitle.replace(/(?:ưu tiên|mức)?\s*(?:cao|rất quan trọng|gấp|high)/gi, '');
    } else if (/(?:ưu tiên|mức)?\s*(?:thấp|không vội|low)/i.test(cleanText)) {
      detectedPriority = 'low';
      extractedTitle = extractedTitle.replace(/(?:ưu tiên|mức)?\s*(?:thấp|không vội|low)/gi, '');
    } else if (/(?:ưu tiên|mức)?\s*(?:trung bình|bình thường|medium)/i.test(cleanText)) {
      detectedPriority = 'medium';
      extractedTitle = extractedTitle.replace(/(?:ưu tiên|mức)?\s*(?:trung bình|bình thường|medium)/gi, '');
    }

    // Detect Target Cluster/Column from active clusters
    for (const cluster of availableClusters) {
      const escaped = cluster.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const clusterPattern = new RegExp(`(?:vào|ở|sang|tại|cột|cụm)\\s+(${escaped})`, 'i');
      if (clusterPattern.test(cleanText)) {
        detectedClusterId = cluster.id;
        extractedTitle = extractedTitle.replace(clusterPattern, '');
        break;
      }
    }

    // Match column by index (e.g. "cột 1", "cụm 2")
    const indexMatch = cleanText.match(/(?:cột|cụm)\s+(\d+)/i);
    if (indexMatch && indexMatch[1]) {
      const idx = parseInt(indexMatch[1], 10) - 1;
      if (idx >= 0 && idx < availableClusters.length) {
        detectedClusterId = availableClusters[idx].id;
        extractedTitle = extractedTitle.replace(/(?:vào|ở|sang|tại)?\s*(?:cột|cụm)\s+\d+/gi, '');
      }
    }

    // Detect Alarm time: e.g. "hẹn giờ 08:30" or "nhắc lúc 9 giờ"
    const alarmMatch = cleanText.match(/(?:hẹn giờ|báo thức|nhắc lúc|nhắc nhở)\s+(?:vào lúc\s+)?(\d{1,2})(?::(\d{2})|\s*giờ(?:\s*(\d{1,2}))?)/i);
    if (alarmMatch) {
      const hours = parseInt(alarmMatch[1], 10);
      const minutes = parseInt(alarmMatch[2] || alarmMatch[3] || '0', 10);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        detectedAlarm = `${hh}:${mm}`;
        detectedAlarmEnabled = true;
        extractedTitle = extractedTitle.replace(/(?:hẹn giờ|báo thức|nhắc lúc|nhắc nhở)\s+(?:vào lúc\s+)?\d{1,2}(?::\d{2}|\s*giờ(?:\s*\d{1,2})?)/gi, '');
      }
    }

    // Clean up title (remove trailing/leading keywords like "tạo task", "thêm việc")
    extractedTitle = extractedTitle
      .replace(/^(?:tạo task|tạo việc|thêm task|thêm việc|việc cần làm là|nhiệm vụ)\s+/gi, '')
      .replace(/[,\.;]+$/, '')
      .trim();

    if (extractedTitle) {
      // Capitalize first letter
      setTaskTitle(extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1));
    }
    setTaskPriority(detectedPriority);
    setSelectedClusterId(detectedClusterId);
    if (detectedAlarm) {
      setAlarmTime(detectedAlarm);
      setAlarmEnabled(detectedAlarmEnabled);
    }
  };

  // Start Speech Recognition
  const handleStartListening = () => {
    if (!isSupported) {
      showToast('Trình duyệt của bạn chưa hỗ trợ Web Speech API.');
      return;
    }

    try {
      recognizerRef.current?.abort();
    } catch (e) {}

    const recognizer = createSpeechRecognizer({
      lang: voiceLanguage === 'en' ? 'en-US' : 'vi-VN',
      continuous: true, // Continuous listening so brief pauses don't cut off!
      silenceTimeoutMs: 3500, // 3.5s grace period of silence
      onStart: () => {
        setIsListening(true);
      },
      onResult: (transcript, isFinal) => {
        setRawTranscript(transcript);
        parseVoiceInput(transcript);
      },
      onError: (err) => {
        setIsListening(false);
        showToast(err);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (recognizer) {
      recognizerRef.current = recognizer;
      recognizer.start();
    }
  };

  // Stop Speech Recognition
  const handleStopListening = () => {
    try {
      recognizerRef.current?.stop();
    } catch (e) {}
    setIsListening(false);
  };

  // Toggle listening
  const handleToggleListening = () => {
    if (isListening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  // Auto-start listening when modal opens
  useEffect(() => {
    if (isOpen) {
      setTaskTitle('');
      setRawTranscript('');
      setAlarmTime('');
      setAlarmEnabled(false);
      setTaskPriority('medium');
      setTaskDescription('');
      setTimeout(() => {
        handleStartListening();
      }, 300);
    } else {
      try {
        recognizerRef.current?.abort();
      } catch (e) {}
      setIsListening(false);
    }
    return () => {
      try {
        recognizerRef.current?.abort();
      } catch (e) {}
    };
  }, [isOpen]);

  // Handle Approve & Create Task
  const handleApproveAndCreate = () => {
    if (!taskTitle.trim()) {
      showToast('Vui lòng nói hoặc nhập tiêu đề công việc.');
      return;
    }

    if (!activeWorkspace || !activePeriod || !activeDivision) {
      showToast('Thiếu thông tin phân cấp Workspace/Period/Division.');
      return;
    }

    const clusterId = selectedClusterId || (availableClusters[0] ? availableClusters[0].id : '');
    if (!clusterId) {
      showToast('Vui lòng chọn cụm (cột) để đặt công việc.');
      return;
    }

    const clusterObj = availableClusters.find((c) => c.id === clusterId);

    // Build mode_clusters mapping so the task is placed correctly in the active board mode
    const modeClusters: Record<string, string> = {};
    if (activeBoardMode) {
      modeClusters[activeBoardMode.id] = clusterId;
    }

    createTask({
      workspace_id: activeWorkspace.id,
      period_id: activePeriod.id,
      division_id: activeDivision.id,
      cluster_id: clusterId,
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      priority: taskPriority,
      severity: 'normal',
      status: 'todo',
      is_completed: false,
      is_archived: false,
      is_private: false,
      sort_order: Date.now(),
      alarm_enabled: alarmEnabled && !!alarmTime,
      alarm_time: alarmEnabled && alarmTime ? alarmTime : undefined,
      mode_clusters: modeClusters,
    });

    handleStopListening();
    showToast(`Đã tạo công việc "${taskTitle.trim()}" vào cột "${clusterObj?.name || 'Cụm'}" thành công!`);
    onClose();
  };

  // Open Detailed Editor with pre-filled fields
  const handleOpenDetailed = () => {
    handleStopListening();
    if (onOpenDetailedEditor) {
      onOpenDetailedEditor({
        title: taskTitle.trim(),
        cluster_id: selectedClusterId,
        priority: taskPriority,
        description: taskDescription.trim(),
        alarm_enabled: alarmEnabled,
        alarm_time: alarmTime,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Tạo công việc bằng Giọng nói</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Voice-to-Text
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {activeDivision?.name || 'Phân chia'} • {activeBoardMode?.name || 'Bảng'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switch */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => {
                  setVoiceLanguage('vi');
                  if (isListening) {
                    handleStopListening();
                    setTimeout(handleStartListening, 200);
                  }
                }}
                className={`px-2 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 ${
                  voiceLanguage === 'vi'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
                title="Nhận diện Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span>Việt</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoiceLanguage('en');
                  if (isListening) {
                    handleStopListening();
                    setTimeout(handleStartListening, 200);
                  }
                }}
                className={`px-2 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 ${
                  voiceLanguage === 'en'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
                title="Nhận diện English"
              >
                <span>🇬🇧</span>
                <span>Eng</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Visualizer & Listening Orb */}
        <div className="px-6 pt-5 pb-4 flex flex-col items-center justify-center text-center bg-gradient-to-b from-indigo-50/40 to-transparent dark:from-indigo-950/20 dark:to-transparent border-b border-slate-100 dark:border-slate-800/80">
          <div className="relative flex items-center justify-center my-2">
            {isListening && (
              <>
                <div className="absolute w-28 h-28 rounded-full bg-rose-500/20 animate-ping" />
                <div className="absolute w-24 h-24 rounded-full bg-rose-500/30 animate-pulse" />
              </>
            )}

            <button
              type="button"
              onClick={handleToggleListening}
              className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95 ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-rose-500/40 ring-4 ring-rose-300 dark:ring-rose-900/60 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30'
              }`}
              title={isListening ? 'Bấm để dừng nói' : 'Bấm để bắt đầu nói'}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <div className="mt-2 text-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                isListening
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
              {isListening ? 'Đang lắng nghe... Nói tự nhiên, dừng lại không bị ngắt' : 'Đã tạm dừng nói'}
            </span>
          </div>

          {/* Real-time speech transcript feedback */}
          <div className="mt-3 w-full bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 min-h-[52px] flex items-center justify-center text-center shadow-2xs">
            {rawTranscript ? (
              <p className="text-xs text-slate-800 dark:text-slate-200 italic font-medium leading-relaxed">
                &ldquo;{rawTranscript}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Thử nói: &ldquo;Hoàn thành tài liệu dự án ưu tiên cao vào Đang làm hẹn giờ 9h&rdquo;</span>
              </p>
            )}
          </div>
        </div>

        {/* Task Fields Approval Form (Review & Edit before creation) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Duyệt thông tin công việc</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Có thể sửa văn bản trực tiếp
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tiêu đề công việc <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Nhập hoặc nói tên công việc..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Grid: Target Column + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Target Column / Cluster */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Cột / Cụm mục tiêu
              </label>
              <select
                value={selectedClusterId}
                onChange={(e) => setSelectedClusterId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {availableClusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mức độ ưu tiên
              </label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="low">🟢 Thấp (Low)</option>
                <option value="medium">🟡 Vừa (Medium)</option>
                <option value="high">🔴 Cao (High)</option>
                <option value="urgent">🚨 Khẩn cấp (Urgent)</option>
              </select>
            </div>
          </div>

          {/* Alarm / Reminder (Optional) */}
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                  Hẹn giờ báo thức
                </span>
                <span className="block text-[11px] text-amber-700 dark:text-amber-400 truncate">
                  Tự động reo chuông khi đến giờ
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={alarmTime}
                onChange={(e) => {
                  setAlarmTime(e.target.value);
                  if (e.target.value) setAlarmEnabled(true);
                }}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => setAlarmEnabled(!alarmEnabled)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  alarmEnabled && alarmTime
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {alarmEnabled && alarmTime ? 'Bật' : 'Tắt'}
              </button>
            </div>
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ghi chú mô tả (Tùy chọn)
            </label>
            <textarea
              rows={2}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Nói thêm chi tiết hoặc gõ ghi chú..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Voice Command Confirmation Hint */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 text-[11px] text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>
              <strong>Mẹo duyệt nhanh:</strong> Bạn có thể nói &ldquo;<strong>Duyệt</strong>&rdquo; hoặc &ldquo;<strong>Tạo việc</strong>&rdquo; để tự động xác nhận lưu ngay!
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleListening}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                isListening
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300'
                  : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? 'Dừng nói' : 'Nói tiếp'}</span>
            </button>

            {onOpenDetailedEditor && (
              <button
                type="button"
                onClick={handleOpenDetailed}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                title="Mở toàn bộ giao diện chỉnh sửa"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở form chi tiết</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleApproveAndCreate}
              disabled={!taskTitle.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 rounded-xl shadow-md transition-all active:scale-98 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Duyệt & Tạo việc ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
