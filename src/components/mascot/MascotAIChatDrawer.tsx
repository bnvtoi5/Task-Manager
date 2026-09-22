import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  User,
  RefreshCw,
  Volume2,
  VolumeX,
  Copy,
  CheckCheck,
  Terminal,
  Square,
  Mic,
  MicOff,
  Headphones,
  ChevronRight,
  ChevronDown,
  Reply,
  CornerDownRight,
  Check,
  Sparkles,
  Settings,
  Key,
  Bot,
  Sliders,
} from 'lucide-react';
import {
  MascotChatMessage,
  MascotChatReplyContext,
  ActionProposal,
  MascotAISettings,
  DEFAULT_AI_SETTINGS,
  AI_SETTINGS_STORAGE_KEY,
  CHAT_HISTORY_STORAGE_KEY,
} from './mascotAITypes';
import { MascotPersona, getStoredPersonas } from './mascotPersonas';
import { buildContextPayload, sendMascotChatMessage } from './mascotAIService';
import { executeActionProposal, parseLocalAlarmComponents } from './mascotActionExecutor';
import { ActionConfirmationMenu } from './ActionConfirmationMenu';
import { MascotSettingsModal } from './MascotSettingsModal';
import { MascotVoiceModeOverlay } from './MascotVoiceModeOverlay';
import { MascotSpriteAvatar } from './MascotSpriteAvatar';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  SpeechRecognitionController,
} from './mascotVoiceService';
import { RichMarkdownRenderer } from './RichMarkdownRenderer';
import { useApp } from '../../context/AppContext';

interface MascotAIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mascotSpriteId: string;
}

export interface SlashCommand {
  cmd: string;
  label: string;
  desc: string;
  type: 'action' | 'input';
  template?: string;
  badge?: string;
}

export const ALL_SLASH_COMMANDS: SlashCommand[] = [
  {
    cmd: '/menu',
    label: 'Menu tác vụ & phím tắt',
    desc: 'Bảng menu tổng hợp các phím tắt, tác vụ và tính năng nhanh',
    type: 'action',
    badge: 'Phổ biến',
  },
  {
    cmd: '/tasks',
    label: 'Danh sách công việc',
    desc: 'Xem tất cả task đang có và trạng thái chuông báo thức',
    type: 'action',
  },
  {
    cmd: '/alarm',
    label: 'Công việc hẹn giờ',
    desc: 'Xem danh sách các công việc đang bật chuông hẹn giờ',
    type: 'action',
  },
  {
    cmd: '/voice',
    label: 'Đàm thoại giọng nói',
    desc: 'Mở chế độ đàm thoại trực tiếp toàn màn hình',
    type: 'action',
  },
  {
    cmd: '/create',
    label: 'Tạo công việc mới',
    desc: 'Điền nhanh mẫu câu tạo việc (vd: Tạo task Họp team)',
    type: 'input',
    template: 'Tạo task ',
  },
  {
    cmd: '/move',
    label: 'Chuyển phân chia',
    desc: 'Điền nhanh mẫu câu chuyển task sang division khác',
    type: 'input',
    template: 'Chuyển task sang division ',
  },
  {
    cmd: '/clear',
    label: 'Xóa lịch sử chat',
    desc: 'Dọn sạch toàn bộ tin nhắn chat để làm mới hội thoại',
    type: 'action',
  },
  {
    cmd: '/settings',
    label: 'Cài đặt Mascot',
    desc: 'Tùy chỉnh tính cách Mascot, Model AI và giọng đọc',
    type: 'action',
  },
  {
    cmd: '/help',
    label: 'Hướng dẫn sử dụng',
    desc: 'Xem các ví dụ ra lệnh chi tiết và mẹo tương tác',
    type: 'action',
  },
];

export const MascotAIChatDrawer: React.FC<MascotAIChatDrawerProps> = ({
  isOpen,
  onClose,
  mascotSpriteId,
}) => {
  const app = useApp();

  // Settings state (Stored locally in localStorage)
  const [settings, setSettings] = useState<MascotAISettings>(() => {
    try {
      const saved = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (saved) return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_AI_SETTINGS;
  });

  // Personas (Loaded and editable locally)
  const [personas, setPersonas] = useState<MascotPersona[]>(() => getStoredPersonas());
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(settings.personaId || 'bunny');

  // Active persona object
  const activePersona =
    personas.find((p) => p.id === selectedPersonaId) || personas[0];

  // Chat messages
  const [messages, setMessages] = useState<MascotChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `Xin chào! Tôi là ${activePersona.name} (${activePersona.handle}). Tôi có thể giúp bạn quản lý công việc, tạo hoặc chuyển phân chia, đặt chuông báo thức hoặc trò chuyện cùng bạn.\n\n💡 *Gợi ý: Gõ /menu để xem danh sách lệnh nhanh bất kỳ lúc nào!*`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        quickActions: [
          { label: '📋 Danh sách việc', action: '/tasks' },
          { label: '⏰ Việc có hẹn giờ', action: '/alarm' },
          { label: '🎙️ Đàm thoại giọng nói', action: '/voice' },
          { label: '➕ Tạo task mới', action: 'Tạo task ', isTemplate: true },
          { label: '➡️ Chuyển phân chia', action: 'Chuyển task sang division ', isTemplate: true },
          { label: '❓ Hướng dẫn chi tiết', action: '/help' },
        ],
      },
    ];
  });

  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Voice & Speech recognition states
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [pendingApprovalMsgId, setPendingApprovalMsgId] = useState<string | null>(null);
  const [pendingApprovalQuestion, setPendingApprovalQuestion] = useState<string | null>(null);

  // UI Dialog states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<MascotChatReplyContext | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Proposal execution lock and states
  const [executingProposalIds, setExecutingProposalIds] = useState<Set<string>>(new Set());
  const executingRef = useRef<Set<string>>(new Set());

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recognizerRef = useRef<SpeechRecognitionController | null>(null);
  const isExplicitlyStoppedRef = useRef(false);
  const liveTranscriptRef = useRef('');
  const lastSentVoiceTextRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const handleSendMessageRef = useRef<((text?: string) => void) | null>(null);
  const handleStartListeningForApprovalRef = useRef<((id: string) => void) | null>(null);

  // Save settings locally
  const settingsRef = useRef<MascotAISettings>(settings);
  settingsRef.current = settings;

  useEffect(() => {
    try {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Synchronize settings in real time from localStorage across components & windows
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings((prev) => ({ ...prev, ...parsed }));
          if (parsed.personaId) {
            setSelectedPersonaId(parsed.personaId);
          }
        }
      } catch {}
    };

    handleSync();
    window.addEventListener('mascot_settings_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('mascot_settings_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [isOpen]);

  // Save chat history locally
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Safely scroll internal messages container to bottom without scrolling window/header
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Listen to open_mascot_settings global event
  useEffect(() => {
    const handleOpenSettings = () => {
      setIsSettingsOpen(true);
    };
    window.addEventListener('open_mascot_settings', handleOpenSettings);
    return () => window.removeEventListener('open_mascot_settings', handleOpenSettings);
  }, []);

  // Listen to open_mascot_voice_mode global event
  useEffect(() => {
    const handleOpenVoice = () => {
      setIsVoiceOverlayOpen(true);
    };
    window.addEventListener('open_mascot_voice_mode', handleOpenVoice);
    return () => window.removeEventListener('open_mascot_voice_mode', handleOpenVoice);
  }, []);

  // Escape key to close drawer or modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (replyingTo) {
          setReplyingTo(null);
        } else if (showSlashMenu) {
          setShowSlashMenu(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isVoiceOverlayOpen) {
          setIsVoiceOverlayOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showSlashMenu, isSettingsOpen, isVoiceOverlayOpen, replyingTo, onClose]);

  // Clean up speech and speech recognition on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      recognizerRef.current?.abort();
      abortControllerRef.current?.abort();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // STOP ALL: Abort AI generation and stop voice
  const handleStopAll = () => {
    isExplicitlyStoppedRef.current = true;
    abortControllerRef.current?.abort();
    stopSpeaking();
    try {
      recognizerRef.current?.abort();
    } catch (e) {}
    recognizerRef.current = null;

    setIsLoading(false);
    setIsSpeaking(false);
    setIsListening(false);
    setSpeakingMessageId(null);
    setLiveTranscript('');
    showToast('Đã dừng phản hồi');
  };

  // Text-to-Speech Play/Stop helper
  const handleToggleSpeak = (text: string, msgId?: string, onSpeechEnd?: () => void) => {
    if (isSpeaking && (!msgId || speakingMessageId === msgId)) {
      isExplicitlyStoppedRef.current = true;
      stopSpeaking();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    isExplicitlyStoppedRef.current = false;
    stopSpeaking();
    setIsSpeaking(true);
    setSpeakingMessageId(msgId || null);

    speakText(text, settings, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);

        if (onSpeechEnd) {
          onSpeechEnd();
          return;
        }

        // ONLY re-arm microphone if NOT explicitly stopped by user!
        if (
          !isExplicitlyStoppedRef.current &&
          (settings.continuousVoiceMode || isVoiceOverlayOpen)
        ) {
          handleStartListening();
        }
      },
      onError: () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
      },
    });
  };

  // Slash commands autocomplete filtering
  const slashQuery = inputVal.startsWith('/') ? inputVal.slice(1).trim().toLowerCase() : '';
  const filteredCommands = ALL_SLASH_COMMANDS.filter((c) => {
    if (!slashQuery) return true;
    const cmdName = c.cmd.slice(1).toLowerCase();
    return (
      cmdName.includes(slashQuery) ||
      c.label.toLowerCase().includes(slashQuery) ||
      c.desc.toLowerCase().includes(slashQuery)
    );
  });

  // Reset selected index when autocomplete query changes
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashQuery]);

  const handleSelectSlashCommand = (c: SlashCommand) => {
    setShowSlashMenu(false);
    if (c.type === 'action') {
      setInputVal('');
      handleSendMessage(c.cmd);
    } else {
      setInputVal(c.template || `${c.cmd} `);
      setTimeout(() => {
        inputRef.current?.focus();
        const len = (c.template || `${c.cmd} `).length;
        inputRef.current?.setSelectionRange(len, len);
      }, 50);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = filteredCommands[slashSelectedIndex] || filteredCommands[0];
        if (target) handleSelectSlashCommand(target);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = filteredCommands[slashSelectedIndex] || filteredCommands[0];
        if (target) handleSelectSlashCommand(target);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }
  };

  // Helper to format alarm display cleanly without timezone drift
  const formatAlarmText = (t: { alarm_enabled?: boolean; alarm_time?: string | null; alarm_at?: string | null }) => {
    if (!t.alarm_enabled) return '⏰ Không hẹn giờ';
    if (!t.alarm_at && !t.alarm_time) return '⏰ Báo thức: Đã bật';
    try {
      const { year, month, day, hours, minutes } = parseLocalAlarmComponents(t.alarm_time, t.alarm_at);
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      return `⏰ Báo thức: ${hh}:${mm} (${dStr}/${mStr}/${year})`;
    } catch {
      return `⏰ Báo thức: ${t.alarm_time || 'Đã bật'}`;
    }
  };

  // Build natural verbal prompt asking user to confirm proposal
  const buildSpokenProposalPrompt = (proposals: ActionProposal[]): string => {
    if (!proposals || proposals.length === 0) return '';
    if (proposals.length === 1) {
      const p = proposals[0];
      const d = p.details || {};
      const target = (p.target_name || d.name || d.title || '').trim();
      let actionDesc = '';
      switch (p.action) {
        case 'create_division':
          actionDesc = `tạo phân chia mới ${target ? `"${target}"` : ''}`;
          break;
        case 'delete_division':
          actionDesc = `xóa phân chia ${target ? `"${target}"` : ''}`;
          break;
        case 'update_division':
          actionDesc = `đổi tên phân chia ${target ? `"${target}"` : ''}`;
          break;
        case 'create_task':
          actionDesc = `tạo công việc ${target ? `"${target}"` : ''}`;
          break;
        case 'delete_task':
          actionDesc = `xóa công việc ${target ? `"${target}"` : ''}`;
          break;
        case 'update_task':
          actionDesc = `cập nhật công việc ${target ? `"${target}"` : ''}`;
          break;
        case 'move_task':
          actionDesc = `chuyển công việc ${target ? `"${target}"` : ''}`;
          break;
        case 'set_alarm':
          actionDesc = `hẹn giờ báo thức cho công việc ${target ? `"${target}"` : ''}`;
          break;
        case 'cancel_alarm':
          actionDesc = `tắt báo thức cho công việc ${target ? `"${target}"` : ''}`;
          break;
        case 'create_cluster':
          actionDesc = `tạo cụm mới ${target ? `"${target}"` : ''}`;
          break;
        case 'delete_cluster':
          actionDesc = `xóa cụm ${target ? `"${target}"` : ''}`;
          break;
        case 'create_board_mode':
          actionDesc = `tạo chế độ bảng ${target ? `"${target}"` : ''}`;
          break;
        case 'delete_board_mode':
          actionDesc = `xóa chế độ bảng ${target ? `"${target}"` : ''}`;
          break;
        case 'create_period':
          actionDesc = `tạo chu kỳ mới ${target ? `"${target}"` : ''}`;
          break;
        case 'delete_period':
          actionDesc = `xóa chu kỳ ${target ? `"${target}"` : ''}`;
          break;
        case 'create_workspace':
          actionDesc = `tạo phòng làm việc ${target ? `"${target}"` : ''}`;
          break;
        case 'delete_workspace':
          actionDesc = `xóa phòng làm việc ${target ? `"${target}"` : ''}`;
          break;
        default:
          actionDesc = p.summary || 'thực hiện thao tác này';
      }
      return `Xin hãy xác nhận hành động: ${actionDesc.trim()}. `;
    }

    // Multiple proposals: provide a clear, concise summary of all actions
    const hasBoardMode = proposals.find((p) => p.action === 'create_board_mode');
    const hasDivision = proposals.find((p) => p.action === 'create_division');
    const taskCount = proposals.filter((p) => p.action === 'create_task').length;

    const parts: string[] = [];
    if (hasDivision) {
      const dName = (hasDivision.target_name || hasDivision.details?.name || '').trim();
      parts.push(`tạo phân chia ${dName ? `"${dName}"` : 'mới'}`);
    }
    if (hasBoardMode) {
      const bmName = (hasBoardMode.target_name || hasBoardMode.details?.name || '').trim();
      parts.push(`tạo chế độ bảng ${bmName ? `"${bmName}"` : ''}`);
    }
    if (taskCount > 0) {
      parts.push(`tạo ${taskCount} công việc mới`);
    }
    if (parts.length > 0) {
      return `Xin hãy xác nhận hành động: ${parts.join(', ')}. `;
    }

    return `Xin hãy xác nhận ${proposals.length} hành động đề xuất. `;
  };

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    handleSendMessageRef.current = handleSendMessage;
    const text = (textToSend || inputVal).trim();
    if (!text || isLoading) return;

    // Deduplicate rapid voice recognition events within 2 seconds
    const now = Date.now();
    if (
      lastSentVoiceTextRef.current.text.toLowerCase() === text.toLowerCase() &&
      now - lastSentVoiceTextRef.current.time < 2000
    ) {
      return;
    }
    lastSentVoiceTextRef.current = { text, time: now };
    isExplicitlyStoppedRef.current = false;

    setInputVal('');
    setShowSlashMenu(false);

    // Handle slash commands immediately
    if (text === '/menu') {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `📋 **MENU TÁC VỤ & LỆNH NHANH**\n\nBạn có thể bấm vào các nút bên dưới hoặc gõ lệnh để thao tác nhanh:`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          quickActions: [
            { label: '📋 Danh sách việc', action: '/tasks' },
            { label: '⏰ Việc có hẹn giờ', action: '/alarm' },
            { label: '🎙️ Đàm thoại giọng nói', action: '/voice' },
            { label: '➕ Tạo task mới', action: 'Tạo task ', isTemplate: true },
            { label: '➡️ Chuyển phân chia', action: 'Chuyển task sang division ', isTemplate: true },
            { label: '⚙️ Cài đặt Mascot', action: '/settings' },
            { label: '🧹 Xóa lịch sử chat', action: '/clear' },
            { label: '❓ Hướng dẫn sử dụng', action: '/help' },
          ],
        },
      ]);
      return;
    }

    // Handle slash commands immediately
    if (text === '/clear') {
      stopSpeaking();
      setMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'Đã dọn dẹp sạch toàn bộ lịch sử trò chuyện. Bộ nhớ đã được giải phóng!',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      showToast('Đã xóa sạch lịch sử chat!');
      return;
    }

    if (text === '/voice') {
      setIsVoiceOverlayOpen(true);
      return;
    }

    if (text === '/settings' || text === '/mascot') {
      setIsSettingsOpen(true);
      return;
    }

    if (text === '/help') {
      const helpMsg: MascotChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `**HƯỚNG DẪN SỬ DỤNG TRỢ LÝ AI MASCOT**\n\n- **Các lệnh nhanh bằng gạch chéo (/):**\n  - \`/tasks\`: Xem danh sách việc và báo thức chi tiết\n  - \`/alarm\`: Xem các việc đang bật chuông hẹn giờ\n  - \`/settings\` hoặc \`/mascot\`: Tùy chỉnh tính cách mascot, model AI & API key\n  - \`/voice\`: Bật đàm thoại giọng nói toàn màn hình\n  - \`/clear\`: Dọn sạch tin nhắn chat\n\n- **Lệnh tương tác tự nhiên:**\n  - **Chào hỏi / Tâm sự**: "Chào bạn", "Hôm nay áp lực quá", "Làm sao tập trung hơn?"\n  - **Tìm kiếm công việc**: "tìm task báo cáo", "có việc nào liên quan tới kế toán không?" *(hệ thống sẽ duyệt toàn bộ và liệt kê tất cả kết quả phù hợp)*\n  - **Tạo việc**: "Tạo task Mua cà phê trong cụm 2" hoặc "Thêm task Họp giao ban lúc 09:00"\n  - **Đặt báo thức**: "Đặt báo thức cho task Họp lúc 07:00"\n  - **Chuyển cụm / Cập nhật**: "Chuyển task X sang cụm 2" hoặc "Sửa task X thành khẩn cấp"\n  - **Xóa việc**: "Xóa task X"\n\n*Mọi thao tác thay đổi dữ liệu đều hiển thị đề xuất xác nhận trước khi thực hiện.*`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, helpMsg]);
      return;
    }

    if (text === '/tasks') {
      const currentTasks = app.db.tasks.filter(
        (t) => (!app.activeWorkspace || t.workspace_id === app.activeWorkspace.id) && !t.is_archived
      );
      if (currentTasks.length === 0) {
        const content = `Phòng "${app.activeWorkspace?.name || 'hiện tại'}" chưa có công việc nào. Bạn có thể ra lệnh "Tạo task [tên việc]" để thêm mới!`;
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      let content = `📋 **DANH SÁCH CÔNG VIỆC TẠI ${app.activeWorkspace?.name || 'PHÒNG HIỆN TẠI'} (${currentTasks.length}):**\n\n`;
      currentTasks.slice(0, 15).forEach((t, idx) => {
        const statusText =
          t.status === 'done' ? '✅ Hoàn thành' : t.status === 'in_progress' ? '⚡ Đang làm' : '⏳ Chờ làm';
        const priorityText =
          t.priority === 'urgent'
            ? '🚨 Khẩn cấp'
            : t.priority === 'high'
            ? '🔴 Cao'
            : t.priority === 'low'
            ? '🟢 Thấp'
            : '🟡 Vừa';
        const divName = app.db.divisions.find((d) => d.id === t.division_id)?.name;
        const clusterName = app.db.clusters.find((c) => c.id === t.cluster_id)?.name;
        const loc = [divName, clusterName].filter(Boolean).join(' > ');

        content += `${idx + 1}. **${t.title}** [${statusText} | ${priorityText}]\n`;
        if (loc) content += `   📍 Vị trí: ${loc}\n`;
        content += `   ${formatAlarmText(t)}${t.due_date ? ` | 📅 Hạn: ${t.due_date}` : ''}\n\n`;
      });

      if (currentTasks.length > 15) {
        content += `*(Đang hiển thị 15 / ${currentTasks.length} công việc)*\n\n`;
      }
      content += `💡 *Gợi ý:* Bạn có thể tìm kiếm cụ thể bằng cách gõ: "tìm task [tên việc]" hoặc "đặt báo thức cho [tên việc] lúc 07:00".`;

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    if (text === '/alarm') {
      const alarmTasks = app.db.tasks.filter((t) => t.alarm_enabled && !t.is_archived);
      if (alarmTasks.length === 0) {
        const content =
          'Hiện tại chưa có công việc nào được hẹn giờ báo thức. Bạn có thể ra lệnh: "Đặt báo thức cho [tên task] lúc 07:00" nhé!';
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      let content = `⏰ **CÁC CÔNG VIỆC ĐANG CÓ HẸN GIỜ BÁO THỨC (${alarmTasks.length}):**\n\n`;
      alarmTasks.forEach((t, idx) => {
        const statusText =
          t.status === 'done' ? '✅ Hoàn thành' : t.status === 'in_progress' ? '⚡ Đang làm' : '⏳ Chờ làm';
        const divName = app.db.divisions.find((d) => d.id === t.division_id)?.name;
        const clusterName = app.db.clusters.find((c) => c.id === t.cluster_id)?.name;
        const loc = [divName, clusterName].filter(Boolean).join(' > ');

        content += `${idx + 1}. **${t.title}** [${statusText}]\n`;
        if (loc) content += `   📍 Vị trí: ${loc}\n`;
        content += `   ${formatAlarmText(t)}${
          t.alarm_repeat && t.alarm_repeat !== 'none'
            ? ` (Lặp lại: ${t.alarm_repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần'})`
            : ''
        }\n\n`;
      });

      content += `💡 *Gợi ý:* Để thay đổi giờ báo thức, bạn có thể nói: "Đặt lại báo thức cho [tên việc] lúc 08:30".`;

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    // Check for Voice / Text Approval or Rejection of pending proposals
    const trimmedInput = text.trim();
    const isApprovalCommand = /^(?:có\s+duyệt|duyệt|đồng\s*ý|xác\s*nhận|thực\s*hiện|chấp\s*nhận|ok\s*duyệt|ok|oke|okay|yes|approve|confirm|triển\s*khai|làm\s*đi|làm\s*luôn|chuẩn\s*rồi|được\s*rồi|ừ\s*duyệt|ừ|dạ\s*duyệt|dạ\s*có|có)(\s+hết|\s+tất\s*cả|\s+đi|\s+luôn|\s+nha|\s+nhé|\s+ạ)?[\.!]?$/i.test(trimmedInput);
    const isRejectionCommand = /^(?:không\s+duyệt|hủy|hủy\s*bỏ|từ\s*chối|bỏ\s*qua|không|thôi|đừng|đừng\s*làm|cancel|reject|dừng|bỏ)(\s+hết|\s+tất\s*cả|\s+đi|\s+nha|\s+nhé|\s+ạ)?[\.!]?$/i.test(trimmedInput);

    if (isApprovalCommand || isRejectionCommand) {
      const pendingMsg = [...messages].reverse().find((m) => m.proposals?.some((p) => !p.status || p.status === 'pending'));
      if (pendingMsg) {
        setPendingApprovalQuestion(null);
        setPendingApprovalMsgId(null);
        const userMsg: MascotChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);

        if (isApprovalCommand) {
          handleExecuteAllProposals(pendingMsg.id);
          const pendingCount = pendingMsg.proposals?.filter((p) => !p.status || p.status === 'pending').length || 1;
          const confirmReply = `✅ Đã duyệt và thực thi ${pendingCount} thao tác theo lệnh thoại của bạn!`;
          const botMsg: MascotChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: confirmReply,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, botMsg]);
          handleToggleSpeak('Đã duyệt và thực thi thành công!', botMsg.id);
          return;
        } else {
          handleRejectAllProposals(pendingMsg.id);
          const cancelReply = 'Đã hủy các đề xuất thao tác theo lệnh của bạn.';
          const botMsg: MascotChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: cancelReply,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, botMsg]);
          handleToggleSpeak('Đã hủy đề xuất theo ý bạn.', botMsg.id);
          return;
        }
      }
    }

    // Capture active reply context if any
    const activeReplyContext = replyingTo;
    setReplyingTo(null);

    // Add user message
    const userMsg: MascotChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      replyTo: activeReplyContext || undefined,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Setup abort controller with a 25-second safeguard timeout to prevent freezing
    abortControllerRef.current = new AbortController();
    const timeoutId = window.setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 25000);

    try {
      const context = buildContextPayload(
        app.db,
        app.activeWorkspace,
        app.activePeriod,
        app.activeDivision,
        app.activeBoardModeId
      );

      // Prepend quoted context if replying to a specific message
      let messageToSend = text;
      if (activeReplyContext) {
        const cleanSnippet = activeReplyContext.content.replace(/\n+/g, ' ').slice(0, 160);
        messageToSend = `[Đang trả lời tin nhắn của ${activeReplyContext.senderName || 'đối phương'}: "${cleanSnippet}..."]\n${text}`;
      }

      // Refresh settings directly from localStorage to ensure latest API key and provider
      let activeSettings = settingsRef.current || settings;
      try {
        const fresh = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
        if (fresh) {
          activeSettings = { ...activeSettings, ...JSON.parse(fresh) };
        }
      } catch {}

      const response = await sendMascotChatMessage({
        message: messageToSend,
        persona: activePersona,
        settings: activeSettings,
        context,
        chatHistory: messages,
        signal: abortControllerRef.current.signal,
      });

      const assistantMsg: MascotChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response.reply,
        proposals: response.proposals.map((p, i) => ({
          ...p,
          id: p.id || `prop-${Date.now()}-${i}`,
          status: 'pending',
        })),
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.modelUsed,
        fellBack: response.fellBack,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (response.systemFallbackNotice) {
        showToast(response.systemFallbackNotice);
      }

      // Check if this message has action proposals that require user confirmation
      const hasProposals = assistantMsg.proposals && assistantMsg.proposals.length > 0;
      if (hasProposals) {
        const spokenQuestion = buildSpokenProposalPrompt(assistantMsg.proposals!);
        setPendingApprovalMsgId(assistantMsg.id);
        setPendingApprovalQuestion(spokenQuestion);

        // Always verbally ask user to approve when proposals are generated!
        if (!response.aborted) {
          handleToggleSpeak(spokenQuestion, assistantMsg.id, () => {
            handleStartListeningForApprovalRef.current?.(assistantMsg.id);
          });
        }
      } else if ((settings.autoSpeak || isVoiceOverlayOpen) && response.reply && !response.aborted) {
        handleToggleSpeak(response.reply, assistantMsg.id);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const errMsg = err?.message || 'Không thể kết nối đến máy chủ AI';
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: `⚠️ [${activePersona.name}]: ${errMsg}. Bạn có thể bấm nút Cài đặt để kiểm tra API Key hoặc đổi sang Mascot / Nhà cung cấp AI khác nhé!`,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Voice speech recognition handlers
  const handleStartListening = () => {
    isExplicitlyStoppedRef.current = false;
    stopSpeaking();
    setIsSpeaking(false);
    setSpeakingMessageId(null);

    try {
      recognizerRef.current?.abort();
    } catch (e) {}

    // Select recognition language based on settings ('vi' -> 'vi-VN', 'en' -> 'en-US', 'auto' -> 'vi-VN')
    const recLang = settings.voiceLanguage === 'en' ? 'en-US' : 'vi-VN';

    const recognizer = createSpeechRecognizer({
      lang: recLang,
      continuous: true, // Continuous listening so brief pauses don't cut off!
      silenceTimeoutMs: 3500, // 3.5s natural speaking pause grace period -> comfortable, không bị chớp tắt!
      onStart: () => {
        setIsListening(true);
        liveTranscriptRef.current = '';
        setLiveTranscript('');
      },
      onResult: (transcript, isFinal) => {
        liveTranscriptRef.current = transcript;
        setLiveTranscript(transcript);
        setInputVal(transcript);

        // Directly send when speech recognition completes or silence grace timer expires!
        if (isFinal && transcript.trim()) {
          try {
            recognizer.abort();
          } catch (e) {}
          setIsListening(false);
          liveTranscriptRef.current = '';
          setLiveTranscript('');
          setInputVal('');
          handleSendMessage(transcript.trim());
        }
      },
      onError: (errMsg) => {
        setIsListening(false);
        showToast(errMsg);
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

  const handleStopListening = () => {
    isExplicitlyStoppedRef.current = true;
    try {
      recognizerRef.current?.stop();
    } catch (e) {}
    setIsListening(false);

    // If user tapped stop to end speech and there's text spoken, auto-send immediately!
    const textToSend = liveTranscriptRef.current.trim() || liveTranscript.trim() || inputVal.trim();
    if (textToSend) {
      liveTranscriptRef.current = '';
      setLiveTranscript('');
      setInputVal('');
      handleSendMessage(textToSend);
    }
  };

  // Execute a single proposal
  const handleExecuteSingleProposal = (messageId: string, proposalId: string) => {
    if (executingRef.current.has(proposalId)) return;

    const targetMsg = messages.find((m) => m.id === messageId);
    const targetProp = targetMsg?.proposals?.find((p) => p.id === proposalId);

    // If already executed or not found, do not re-run
    if (!targetProp || targetProp.status === 'executed') {
      return;
    }

    executingRef.current.add(proposalId);
    setExecutingProposalIds(new Set(executingRef.current));

    try {
      const res = executeActionProposal(targetProp, {
        createTask: app.createTask,
        updateTask: app.updateTask,
        deleteTask: app.deleteTask,
        createCluster: app.createCluster,
        updateCluster: app.updateCluster,
        deleteCluster: app.deleteCluster,
        createDivision: app.createDivision,
        updateDivision: app.updateDivision,
        deleteDivision: app.deleteDivision,
        createPeriod: app.createPeriod,
        updatePeriod: app.updatePeriod,
        deletePeriod: app.deletePeriod,
        createWorkspace: app.createWorkspace,
        updateWorkspace: app.updateWorkspace,
        deleteWorkspace: app.deleteWorkspace,
        createBoardMode: app.createBoardMode,
        updateBoardMode: app.updateBoardMode,
        deleteBoardMode: app.deleteBoardMode,
        setActiveWorkspaceId: app.setActiveWorkspaceId,
        setActiveDivisionId: app.setActiveDivisionId,
        setActivePeriodId: app.setActivePeriodId,
        setActiveBoardModeId: app.setActiveBoardModeId,
        activeWorkspace: app.activeWorkspace,
        activePeriod: app.activePeriod,
        activeDivision: app.activeDivision,
        activeBoardModeId: app.activeBoardModeId,
        db: app.db,
      });

      if (res.success) {
        showToast(`✓ Đã thực hiện: ${targetProp.summary}`);
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.id !== messageId || !msg.proposals) return msg;
            const updatedProposals = msg.proposals.map((prop) =>
              prop.id === proposalId ? { ...prop, status: 'executed' as const } : prop
            );
            return { ...msg, proposals: updatedProposals };
          })
        );
      } else {
        showToast(`✕ Thất bại: ${res.message}`);
      }
    } catch (err: any) {
      showToast(`✕ Lỗi khi thực hiện: ${err?.message || 'Không xác định'}`);
    } finally {
      executingRef.current.delete(proposalId);
      setExecutingProposalIds(new Set(executingRef.current));
    }
  };

  // Reject a single proposal
  const handleRejectSingleProposal = (messageId: string, proposalId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id !== messageId || !msg.proposals) return msg;
        const updated = msg.proposals.map((p) =>
          p.id === proposalId ? { ...p, status: 'rejected' as const } : p
        );
        return { ...msg, proposals: updated };
      })
    );
    showToast('Đã hủy thao tác đề xuất');
  };

  // Execute all proposals
  const handleExecuteAllProposals = (messageId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.proposals) return;

    const pendingProposals = targetMsg.proposals.filter(
      (p) => (!p.status || p.status === 'pending') && !executingRef.current.has(p.id)
    );

    if (pendingProposals.length === 0) return;

    pendingProposals.forEach((p) => executingRef.current.add(p.id));
    setExecutingProposalIds(new Set(executingRef.current));

    // Sort pending proposals so prerequisites run first: Workspaces -> Periods -> Divisions -> Board Modes -> Clusters -> Tasks -> Others
    const actionPriority: Record<string, number> = {
      create_workspace: 1,
      create_period: 2,
      create_division: 3,
      create_board_mode: 4,
      create_cluster: 5,
      create_task: 6,
    };

    const sortedProposals = [...pendingProposals].sort((a, b) => {
      const pA = actionPriority[a.action] || 10;
      const pB = actionPriority[b.action] || 10;
      return pA - pB;
    });

    let executedCount = 0;
    const executedIds = new Set<string>();
    const sharedContext: {
      lastCreatedWorkspaceId?: string;
      lastCreatedDivisionId?: string;
      lastCreatedPeriodId?: string;
      lastCreatedBoardModeId?: string;
      lastCreatedBoardModeName?: string;
      boardModeClusters?: Array<{ id: string; name: string }>;
      workspaceMap: Map<string, string>;
      divisionMap: Map<string, string>;
      boardModeMap: Map<string, string>;
    } = {
      workspaceMap: new Map(),
      divisionMap: new Map(),
      boardModeMap: new Map(),
    };

    try {
      sortedProposals.forEach((prop) => {
        const res = executeActionProposal(
          prop,
          {
            createTask: app.createTask,
            updateTask: app.updateTask,
            deleteTask: app.deleteTask,
            createCluster: app.createCluster,
            updateCluster: app.updateCluster,
            deleteCluster: app.deleteCluster,
            createDivision: app.createDivision,
            updateDivision: app.updateDivision,
            deleteDivision: app.deleteDivision,
            createPeriod: app.createPeriod,
            updatePeriod: app.updatePeriod,
            deletePeriod: app.deletePeriod,
            createWorkspace: app.createWorkspace,
            updateWorkspace: app.updateWorkspace,
            deleteWorkspace: app.deleteWorkspace,
            createBoardMode: app.createBoardMode,
            updateBoardMode: app.updateBoardMode,
            deleteBoardMode: app.deleteBoardMode,
            setActiveWorkspaceId: app.setActiveWorkspaceId,
            setActiveDivisionId: app.setActiveDivisionId,
            setActivePeriodId: app.setActivePeriodId,
            setActiveBoardModeId: app.setActiveBoardModeId,
            activeWorkspace: app.activeWorkspace,
            activePeriod: app.activePeriod,
            activeDivision: app.activeDivision,
            activeBoardModeId: app.activeBoardModeId,
            db: app.db,
          },
          sharedContext
        );

        if (res.success) {
          executedCount++;
          executedIds.add(prop.id);
        }
      });

      if (executedCount > 0) {
        showToast(`✓ Đã duyệt và thực hiện thành công ${executedCount} thao tác!`);
        setMessages((prevMessages) =>
          prevMessages.map((msg) => {
            if (msg.id !== messageId || !msg.proposals) return msg;
            const updated = msg.proposals.map((p) => {
              if (executedIds.has(p.id)) {
                return { ...p, status: 'executed' as const };
              }
              return p;
            });
            return { ...msg, proposals: updated };
          })
        );
      } else {
        showToast('Không có thao tác nào mới cần duyệt hoặc thao tác thất bại.');
      }
    } catch (err: any) {
      showToast(`✕ Lỗi khi thực hiện: ${err?.message || 'Không xác định'}`);
    } finally {
      if (pendingApprovalMsgId === messageId) {
        setPendingApprovalMsgId(null);
        setPendingApprovalQuestion(null);
      }
      pendingProposals.forEach((p) => executingRef.current.delete(p.id));
      setExecutingProposalIds(new Set(executingRef.current));
    }
  };

  // Reject all proposals
  const handleRejectAllProposals = (messageId: string) => {
    if (pendingApprovalMsgId === messageId) {
      setPendingApprovalMsgId(null);
      setPendingApprovalQuestion(null);
    }
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id !== messageId || !msg.proposals) return msg;
        const updated = msg.proposals.map((p) => ({
          ...p,
          status: 'rejected' as const,
        }));
        return { ...msg, proposals: updated };
      })
    );
    showToast('Đã hủy tất cả thao tác trong đề xuất.');
  };

  // Dedicated voice recognition handler when AI is awaiting user's verbal confirmation
  const handleStartListeningForApproval = (targetMsgId: string) => {
    isExplicitlyStoppedRef.current = false;
    stopSpeaking();
    setIsSpeaking(false);
    setSpeakingMessageId(null);

    try {
      recognizerRef.current?.abort();
    } catch (e) {}

    const recLang = settings.voiceLanguage === 'en' ? 'en-US' : 'vi-VN';
    const recognizer = createSpeechRecognizer({
      lang: recLang,
      continuous: true,
      silenceTimeoutMs: 5000,
      onStart: () => {
        setIsListening(true);
        setLiveTranscript('');
      },
      onResult: (resultText, isFinal) => {
        setLiveTranscript(resultText);
        const text = resultText.trim().toLowerCase();
        const isApprove = /^(?:ok|oke|okay|có\s+duyệt|duyệt|đồng\s*ý|xác\s*nhận|thực\s*hiện|chấp\s*nhận|ok\s*duyệt|yes|approve|confirm|triển\s*khai|làm\s*đi|làm\s*luôn|chuẩn\s*rồi|được\s*rồi|ừ\s*duyệt|ừ|dạ\s*duyệt|dạ\s*có|có)(\s+hết|\s+tất\s*cả|\s+đi|\s+luôn|\s+nha|\s+nhé|\s+ạ)?[\.!]?$/i.test(text);
        const isReject = /^(?:không|ko|k|không\s+duyệt|hủy|hủy\s*bỏ|từ\s*chối|bỏ\s*qua|thôi|đừng|đừng\s*làm|cancel|reject|dừng|bỏ)(\s+hết|\s+tất\s*cả|\s+đi|\s+nha|\s+nhé|\s+ạ)?[\.!]?$/i.test(text);

        if (isApprove || isReject) {
          try {
            recognizer.abort();
          } catch (e) {}
          setIsListening(false);
          setLiveTranscript('');
          setPendingApprovalQuestion(null);
          setPendingApprovalMsgId(null);

          if (isApprove) {
            handleExecuteAllProposals(targetMsgId);
            const confirmMsg = '✅ Đã xác nhận OK và thực thi thành công!';
            const botMsg: MascotChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: confirmMsg,
              timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages((prev) => [...prev, botMsg]);
            handleToggleSpeak('Đã xác nhận OK và thực thi thành công!', botMsg.id);
          } else {
            handleRejectAllProposals(targetMsgId);
            const cancelMsg = 'Đã chọn Không và hủy các đề xuất thao tác.';
            const botMsg: MascotChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: cancelMsg,
              timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages((prev) => [...prev, botMsg]);
            handleToggleSpeak('Đã hủy đề xuất', botMsg.id);
          }
        } else if (isFinal && text) {
          try {
            recognizer.abort();
          } catch (e) {}
          setIsListening(false);
          setLiveTranscript('');
          setPendingApprovalQuestion(null);
          setPendingApprovalMsgId(null);
          handleSendMessageRef.current?.(resultText);
        }
      },
      onError: () => {
        setIsListening(false);
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

  handleStartListeningForApprovalRef.current = handleStartListeningForApproval;

  // Copy text helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Đã sao chép nội dung tin nhắn!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Start replying to a message
  const handleStartReply = (msg: MascotChatMessage) => {
    const senderName = msg.role === 'user' ? 'Bạn' : activePersona.name;
    setReplyingTo({
      id: msg.id,
      role: msg.role,
      senderName,
      content: msg.content,
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Scroll to original message when clicking quote preview
  const handleScrollToMessage = (targetMsgId: string) => {
    const el = document.getElementById(`mascot-msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetMsgId);
      setTimeout(() => {
        setHighlightedMsgId((prev) => (prev === targetMsgId ? null : prev));
      }, 2000);
    } else {
      showToast('Tin nhắn gốc không còn trong lịch sử gần đây');
    }
  };

  if (!isOpen) return null;

  // ================= FULL CHAT DRAWER =================
  const drawerContent = (
    <div
      id="mascot-ai-chat-drawer-root"
      className="fixed inset-y-0 right-0 top-0 bottom-0 h-screen max-h-screen w-full sm:w-[500px] bg-white dark:bg-[#111723] shadow-2xl border-l border-slate-200 dark:border-slate-800 z-[9999] flex flex-col overflow-hidden antialiased animate-in slide-in-from-right duration-200 selection:bg-amber-500/25 dark:selection:bg-amber-400/30 selection:text-amber-950 dark:selection:text-amber-100"
    >
      {/* Toast popup */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white dark:bg-white dark:text-slate-900 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md z-50 animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}

      {/* TOP HEADER - Mascot Selector, Cài đặt, Thoại, Đóng */}
      <div className="shrink-0 w-full p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 min-w-0">
          {/* Quick Mascot Persona Switcher Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 rounded-2xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200/80 dark:border-slate-700/80 transition-all flex items-center gap-2 group cursor-pointer shadow-2xs hover:border-amber-300"
            title="Bấm để đổi nhân vật Mascot hoặc chỉnh API Key"
          >
            <div className="relative shrink-0 flex items-center justify-center">
              <MascotSpriteAvatar persona={activePersona} size={34} interactive={false} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                  isListening
                    ? 'bg-rose-500 animate-ping'
                    : isLoading
                    ? 'bg-amber-400 animate-spin'
                    : isSpeaking
                    ? 'bg-emerald-500 animate-bounce'
                    : 'bg-emerald-500'
                }`}
              />
            </div>
            <div className="text-left min-w-0 pr-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  {activePersona.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-amber-500 transition-transform" />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <span className="font-mono text-[9px] uppercase px-1 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300">
                  {settings.provider || 'GEMINI'}
                </span>
                <span>•</span>
                <span>
                  {isListening
                    ? '🎙️ Đang nghe...'
                    : isLoading
                    ? '⚡ Suy nghĩ...'
                    : isSpeaking
                    ? '🔊 Đang đọc...'
                    : 'Sẵn sàng'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Header Action buttons: Cài đặt, Thoại, Đóng */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Nút Cài đặt (Settings & API Key) */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-300 shadow-2xs"
            title="Cài đặt Mascot, API Key & Đổi nhân vật"
          >
            <Settings className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Cài đặt</span>
          </button>

          {/* Nút Thoại (Voice Mode) */}
          <button
            type="button"
            onClick={() => setIsVoiceOverlayOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-amber-200/80 dark:border-amber-800/40"
            title="Mở đàm thoại giọng nói (Voice Mode)"
          >
            <Headphones className="w-3.5 h-3.5 text-amber-500" />
            <span>Thoại</span>
          </button>

          {/* Nút Đóng */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition flex items-center justify-center cursor-pointer border border-transparent hover:border-rose-200"
            title="Đóng khung chat (Esc)"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CHAT MESSAGES LIST */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isCurrentlyPlaying = isSpeaking && speakingMessageId === msg.id;
          const isHighlighted = highlightedMsgId === msg.id;

          return (
            <div
              key={msg.id}
              id={`mascot-msg-${msg.id}`}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} group transition-all duration-300 ${
                isHighlighted ? 'scale-[1.01]' : ''
              }`}
            >
              {!isUser && (
                <div className="shrink-0 flex items-center justify-center mt-0.5 select-none">
                  <MascotSpriteAvatar persona={activePersona} size={32} interactive={false} />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed relative select-text transition-all duration-300 ${
                  isHighlighted
                    ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md'
                    : 'shadow-xs'
                } ${
                  isUser
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-tr-xs'
                    : 'bg-slate-100 dark:bg-[#1a2233] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 rounded-tl-xs'
                }`}
              >
                {/* Quoted Message Preview if this is a reply */}
                {msg.replyTo && (
                  <button
                    type="button"
                    onClick={() => handleScrollToMessage(msg.replyTo!.id)}
                    className={`w-full mb-2 p-1.5 px-2.5 rounded-xl text-left text-[11px] transition-all flex items-start gap-1.5 cursor-pointer border-l-2 select-none ${
                      isUser
                        ? 'bg-black/15 hover:bg-black/25 border-white/90 text-white/95'
                        : 'bg-slate-200/80 dark:bg-slate-800/90 hover:bg-slate-300/80 dark:hover:bg-slate-700/80 border-amber-500 dark:border-amber-400 text-slate-700 dark:text-slate-300'
                    }`}
                    title="Nhấp để nhảy đến tin nhắn gốc"
                  >
                    <CornerDownRight className="w-3 h-3 mt-0.5 shrink-0 opacity-70" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[10px] opacity-90 truncate">
                        {msg.replyTo.senderName || (msg.replyTo.role === 'user' ? 'Bạn' : activePersona.name)}
                      </div>
                      <div className="truncate opacity-80 text-[10px] italic">
                        {msg.replyTo.content.replace(/\n+/g, ' ')}
                      </div>
                    </div>
                  </button>
                )}

                {/* Message body - Rich Markdown with GFM tables & interactive code copy */}
                <div className="font-sans break-words select-text cursor-text">
                  <RichMarkdownRenderer content={msg.content} isUser={isUser} />
                </div>

                {/* Proposals Menu */}
                {msg.proposals && msg.proposals.length > 0 && (
                  <div className="mt-2 text-slate-900 dark:text-slate-100 select-text">
                    <ActionConfirmationMenu
                      proposals={msg.proposals}
                      isExecuting={executingProposalIds.size > 0}
                      onConfirmAll={() => handleExecuteAllProposals(msg.id)}
                      onExecuteAll={() => handleExecuteAllProposals(msg.id)}
                      onRejectAll={() => handleRejectAllProposals(msg.id)}
                      onExecuteSingle={(propId) =>
                        handleExecuteSingleProposal(msg.id, propId)
                      }
                      onRejectSingle={(propId) =>
                        handleRejectSingleProposal(msg.id, propId)
                      }
                    />
                  </div>
                )}

                {/* Quick Repair & Recovery buttons if API Key or Connection issue is present */}
                {!isUser &&
                  (msg.content.includes('API Key') ||
                    msg.content.includes('Cài đặt') ||
                    msg.content.includes('gián đoạn') ||
                    msg.content.includes('401') ||
                    msg.content.includes('405') ||
                    msg.content.includes('429') ||
                    msg.content.includes('hạn mức') ||
                    msg.content.includes('Lỗi:')) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 select-none">
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Key className="w-3 h-3" />
                        <span>⚙️ Cài đặt & Nhập API Key</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentIndex = personas.findIndex((p) => p.id === activePersona.id);
                          const nextPersona = personas[(currentIndex + 1) % personas.length];
                          if (nextPersona) {
                            setSelectedPersonaId(nextPersona.id);
                            const updated = { ...settings, personaId: nextPersona.id };
                            setSettings(updated);
                            try {
                              localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
                              window.dispatchEvent(new CustomEvent('mascot_settings_changed', { detail: updated }));
                            } catch {}
                            showToast(`Đã đổi sang: ${nextPersona.name}`);
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition active:scale-95 cursor-pointer"
                      >
                        <Bot className="w-3 h-3" />
                        <span>🎭 Đổi Mascot</span>
                      </button>
                    </div>
                  )}

                {/* Quick Actions (e.g. from /menu or suggestions) */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 select-none">
                    <div className="grid grid-cols-2 gap-1.5">
                      {msg.quickActions.map((qa, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (qa.isTemplate) {
                              setInputVal(qa.action);
                              setTimeout(() => {
                                inputRef.current?.focus();
                                const len = qa.action.length;
                                inputRef.current?.setSelectionRange(len, len);
                              }, 50);
                            } else {
                              handleSendMessage(qa.action);
                            }
                          }}
                          className="text-left px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800/90 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-amber-400 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300 transition-all flex items-center justify-between group/qa shadow-2xs cursor-pointer"
                        >
                          <span className="truncate">{qa.label}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400 group-hover/qa:text-amber-500 group-hover/qa:translate-x-0.5 transition-transform shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message footer: timestamp, model badge and buttons */}
                <div
                  className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] select-none ${
                    isUser ? 'text-amber-100' : 'text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.fellBack && msg.modelUsed && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-mono"
                        title={`Tự động failover sang mô hình dự phòng: ${msg.modelUsed}`}
                      >
                        ⚡ {msg.modelUsed}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Reply button */}
                    <button
                      type="button"
                      onClick={() => handleStartReply(msg)}
                      className={`p-1 rounded-md transition cursor-pointer ${
                        isUser
                          ? 'hover:text-white hover:bg-white/20'
                          : 'hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                      title="Trả lời tin nhắn này"
                    >
                      <Reply className="w-3 h-3" />
                    </button>

                    {/* TTS Speak / Stop Button for Assistant Messages */}
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(msg.content, msg.id)}
                        className={`p-1 rounded-md transition cursor-pointer ${
                          isCurrentlyPlaying
                            ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40'
                            : 'hover:text-amber-600 dark:hover:text-amber-400'
                        }`}
                        title={isCurrentlyPlaying ? 'Dừng đọc' : 'Đọc phản hồi này'}
                      >
                        {isCurrentlyPlaying ? (
                          <VolumeX className="w-3 h-3" />
                        ) : (
                          <Volume2 className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {/* Copy button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className={`p-1 rounded-md transition cursor-pointer ${
                        isUser
                          ? 'hover:text-white hover:bg-white/20'
                          : 'hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                      title="Sao chép toàn bộ tin nhắn"
                    >
                      {copiedId === msg.id ? (
                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0 mt-0.5 select-none">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live speech listening indicator banner */}
        {isListening && (
          <div className="flex gap-2.5 justify-start animate-in fade-in duration-150">
            <div className="w-7 h-7 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center text-sm shrink-0">
              <Mic className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-3 rounded-2xl rounded-tl-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <span className="font-semibold">Đang lắng nghe:</span>
              <span className="italic">&ldquo;{liveTranscript || 'Hãy nói...'}&rdquo;</span>
            </div>
          </div>
        )}

        {/* Loading / Thinking indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start animate-in fade-in duration-150">
            <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm shrink-0">
              {activePersona.emoji}
            </div>
            <div className="p-3 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-[#1a2233] text-xs text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>{activePersona.name} đang suy nghĩ và kiểm tra ngữ cảnh...</span>
            </div>
          </div>
        )}
      </div>

      {/* Slash command autocomplete popup */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="shrink-0 mx-3 mb-2 rounded-2xl bg-white/95 dark:bg-[#182030]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-2xl text-xs overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-amber-500" />
              <span>Gợi ý lệnh tự động</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span>Phím</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono">↓</kbd>
              <span>chọn,</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[9px] font-mono">Enter</kbd>
              <span>thực thi</span>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
            {filteredCommands.map((cmd, idx) => {
              const isSelected = idx === slashSelectedIndex;
              return (
                <button
                  key={cmd.cmd}
                  type="button"
                  onClick={() => handleSelectSlashCommand(cmd)}
                  onMouseEnter={() => setSlashSelectedIndex(idx)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-950 dark:text-amber-100 border border-amber-500/30'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {cmd.cmd}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                        <span>{cmd.label}</span>
                        {cmd.badge && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-normal">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {cmd.desc}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="shrink-0 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium pl-2">
                      <span>Chọn</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input area - Strictly minimal: Nút Thoại (Mic), Text Input, Nút Gửi */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111723]">
        {/* Reply Bar Preview */}
        {replyingTo && (
          <div className="px-3.5 py-2 bg-amber-50/95 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between gap-2 text-xs animate-in slide-in-from-bottom-2 duration-150 select-none">
            <div className="flex items-center gap-2 min-w-0">
              <Reply className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0 text-slate-700 dark:text-slate-200">
                <span className="font-semibold text-amber-700 dark:text-amber-300 mr-1.5 text-[11px]">
                  Trả lời {replyingTo.senderName}:
                </span>
                <span className="italic text-slate-500 dark:text-slate-400 text-[11px] truncate inline-block max-w-[240px] sm:max-w-[300px] align-bottom">
                  &ldquo;{replyingTo.content.replace(/\n+/g, ' ')}&rdquo;
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md transition cursor-pointer"
              title="Hủy trả lời (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* VOICE ACTION PROPOSAL CONFIRMATION BAR */}
        {pendingApprovalQuestion && (
          <div className="mx-3 mb-1.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400/70 dark:border-amber-700 shadow-md text-xs space-y-2 animate-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>AI đang hỏi bạn xác nhận:</span>
              </div>
              {isListening && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1 shrink-0 animate-pulse">
                  <Mic className="w-3 h-3 text-rose-600" />
                  <span>Đang nghe bạn nói &ldquo;OK&rdquo; / &ldquo;Không&rdquo;...</span>
                </span>
              )}
            </div>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-relaxed">
              {pendingApprovalQuestion}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (pendingApprovalMsgId) {
                    handleExecuteAllProposals(pendingApprovalMsgId);
                    setPendingApprovalQuestion(null);
                    setPendingApprovalMsgId(null);
                    handleToggleSpeak('Đã xác nhận OK và thực thi thành công!');
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>OK</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingApprovalMsgId) {
                    handleRejectAllProposals(pendingApprovalMsgId);
                    setPendingApprovalQuestion(null);
                    setPendingApprovalMsgId(null);
                    handleToggleSpeak('Đã hủy đề xuất');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-300 font-semibold text-xs transition cursor-pointer"
              >
                Không
              </button>
            </div>
          </div>
        )}

        {/* VOICE ACTIVE LISTENING BAR */}
        {isListening && (
          <div className="mx-3 mb-1 px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2 text-xs animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="font-semibold text-rose-700 dark:text-rose-300 truncate">
                {liveTranscript ? `"${liveTranscript}"` : 'Đang lắng nghe... Nói tự nhiên (không bị ngắt)'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleStopListening}
                className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition active:scale-95"
              >
                Xong nói
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStopListening();
                  setLiveTranscript('');
                  setInputVal('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Hủy ghi âm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* VOICE REVIEW & APPROVAL BAR */}
        {!isListening && liveTranscript && (
          <div className="mx-3 mb-1 px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between gap-2 text-xs shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 tracking-wider">
                  Duyệt lệnh giọng nói
                </span>
                <span className="block font-medium text-slate-900 dark:text-slate-100 truncate">
                  &ldquo;{liveTranscript}&rdquo;
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleStartListening}
                className="px-2.5 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition flex items-center gap-1 cursor-pointer"
                title="Nói thêm vào câu này"
              >
                <Mic className="w-3 h-3" />
                <span>Nói tiếp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const textToSend = liveTranscript.trim();
                  setLiveTranscript('');
                  setInputVal('');
                  if (textToSend) handleSendMessage(textToSend);
                }}
                className="px-3 py-1 rounded-xl text-[11px] font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                title="Duyệt và gửi lệnh này đến AI"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Duyệt & Gửi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLiveTranscript('');
                  setInputVal('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Hủy bỏ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 flex items-center gap-2"
        >
          {/* Nút Thoại (Microphone) */}
          <button
            type="button"
            onClick={() => {
              if (isListening) handleStopListening();
              else handleStartListening();
            }}
            className={`p-2.5 rounded-2xl transition active:scale-95 flex items-center justify-center shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/40'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={isListening ? 'Dừng lắng nghe' : 'Nói chuyện bằng Micro (Thoại)'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => {
                const val = e.target.value;
                setInputVal(val);
                setShowSlashMenu(val.startsWith('/'));
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={`Nhắn cho ${activePersona.name} (gõ /menu để xem lệnh)...`}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 pr-8"
              disabled={isLoading}
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  setShowSlashMenu(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Xóa chữ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Nút Gửi / Nút Dừng phản hồi khi đang bận */}
          {isLoading || isSpeaking ? (
            <button
              type="button"
              onClick={handleStopAll}
              className="p-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
              title="Dừng phản hồi"
              aria-label="Dừng"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
              title="Gửi tin nhắn"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* ================= UNIFIED SETTINGS MODAL ================= */}
      <MascotSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          setSelectedPersonaId(newSettings.personaId);
          window.dispatchEvent(new CustomEvent('mascot_settings_changed'));
        }}
        personas={personas}
        onUpdatePersonas={(newPersonas) => {
          setPersonas(newPersonas);
        }}
        selectedPersonaId={selectedPersonaId}
        onSelectPersona={(id) => {
          setSelectedPersonaId(id);
          setSettings((s) => ({ ...s, personaId: id }));
          window.dispatchEvent(new CustomEvent('mascot_settings_changed'));
        }}
        onShowToast={showToast}
      />

      {/* ================= VOICE MODE FULLSCREEN OVERLAY ================= */}
      <MascotVoiceModeOverlay
        isOpen={isVoiceOverlayOpen}
        onClose={() => setIsVoiceOverlayOpen(false)}
        activePersona={activePersona}
        settings={settings}
        isLoading={isLoading}
        isSpeaking={isSpeaking}
        isListening={isListening}
        currentTranscript={liveTranscript}
        lastAiResponse={
          [...messages].reverse().find((m) => m.role === 'assistant')?.content
        }
        pendingProposalQuestion={pendingApprovalQuestion}
        onApprovePendingProposals={() => {
          if (pendingApprovalMsgId) {
            handleExecuteAllProposals(pendingApprovalMsgId);
            setPendingApprovalQuestion(null);
            setPendingApprovalMsgId(null);
            handleToggleSpeak('Đã duyệt và thực thi thành công!');
          }
        }}
        onRejectPendingProposals={() => {
          if (pendingApprovalMsgId) {
            handleRejectAllProposals(pendingApprovalMsgId);
            setPendingApprovalQuestion(null);
            setPendingApprovalMsgId(null);
            handleToggleSpeak('Đã hủy đề xuất theo ý bạn.');
          }
        }}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        onStopAll={handleStopAll}
        onSelectLanguage={(lang) => {
          setSettings((s) => ({ ...s, voiceLanguage: lang }));
        }}
        onConfirmVoiceSend={(txt) => {
          setLiveTranscript('');
          setInputVal('');
          handleSendMessage(txt);
        }}
        onCancelVoice={() => {
          setLiveTranscript('');
          setInputVal('');
          handleStopListening();
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : drawerContent;
};
