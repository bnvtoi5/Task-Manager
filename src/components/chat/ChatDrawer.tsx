import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  Paperclip,
  Smile,
  Hash,
  AtSign,
  FileText,
  Trash2,
  CheckCheck,
  Briefcase,
  ChevronLeft,
  Search,
  MessageSquare,
  Users,
  User,
  ExternalLink,
  Target,
  Sparkles,
  Lock,
  Info,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  FolderPlus,
  Tag,
  Layers,
  MessageCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FileAttachment, Task, UserProfile } from '../../types';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👏', '✅', '🚀', '🎉', '💡'];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose }) => {
  const {
    db,
    activeWorkspace,
    currentUser,
    sendMessage,
    deleteMessage,
    setPreviewAttachment,
    stagedTaskForChat,
    setStagedTaskForChat,
    locateTaskInWorkspace,
    activeChatGroupId,
    setActiveChatGroupId,
    createChatGroup,
    deleteChatGroup,
  } = useApp();

  // Tab: 'room' (Phòng làm việc) vs 'groups' (Nhóm & Chủ đề) vs 'direct' (Tin nhắn riêng 1-1)
  const [chatTab, setChatTab] = useState<'room' | 'groups' | 'direct'>('room');
  // Selected user for direct 1-1 chat
  const [activeDirectUserId, setActiveDirectUserId] = useState<string | null>(null);
  // Search query for contacts in direct messages
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Groups & Category Management state
  const [selectedGroupCategory, setSelectedGroupCategory] = useState<string>('all');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('Hạng mục chung');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#6366f1');

  const [input, setInput] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync stagedTaskForChat from external clicks
  useEffect(() => {
    if (stagedTaskForChat) {
      setSelectedTaskId(stagedTaskForChat.id);
      // Switch to room or ensure task is ready
      if (chatTab === 'direct' && activeDirectUserId) {
        // verify if target user is in same workspace
        const isInRoom = db.workspace_members.some(
          (m) => m.workspace_id === activeWorkspace?.id && m.user_id === activeDirectUserId
        );
        if (!isInRoom) {
          setChatTab('room');
        }
      }
    }
  }, [stagedTaskForChat, activeWorkspace, activeDirectUserId, chatTab, db.workspace_members]);

  // Active workspace members IDs
  const workspaceMemberIds = useMemo(() => {
    if (!activeWorkspace) return [];
    return db.workspace_members
      .filter((m) => m.workspace_id === activeWorkspace.id)
      .map((m) => m.user_id);
  }, [activeWorkspace, db.workspace_members]);

  // Is target user for direct chat in same workspace?
  const isTargetInSameWorkspace = useMemo(() => {
    if (!activeDirectUserId) return false;
    return workspaceMemberIds.includes(activeDirectUserId);
  }, [activeDirectUserId, workspaceMemberIds]);

  // Target direct user profile
  const activeDirectUser = useMemo(() => {
    if (!activeDirectUserId) return null;
    return db.users.find((u) => u.id === activeDirectUserId) || null;
  }, [activeDirectUserId, db.users]);

  // Groups in active workspace
  const workspaceChatGroups = useMemo(() => {
    if (!activeWorkspace) return [];
    return (db.chat_groups || []).filter(
      (g) => g.workspace_id === activeWorkspace.id || !g.workspace_id
    );
  }, [activeWorkspace, db.chat_groups]);

  // Active group
  const activeChatGroup = useMemo(() => {
    if (!activeChatGroupId) return null;
    return (db.chat_groups || []).find((g) => g.id === activeChatGroupId) || null;
  }, [activeChatGroupId, db.chat_groups]);

  // Messages for active group
  const groupMessages = useMemo(() => {
    if (!activeChatGroupId) return [];
    return db.messages.filter((m) => m.group_id === activeChatGroupId);
  }, [activeChatGroupId, db.messages]);

  // Messages for room (general workspace messages without group or receiver)
  const roomMessages = useMemo(() => {
    if (!activeWorkspace) return [];
    return db.messages.filter(
      (m) => m.workspace_id === activeWorkspace.id && !m.receiver_id && !m.group_id
    );
  }, [activeWorkspace, db.messages]);

  // Messages for direct chat
  const directMessages = useMemo(() => {
    if (!currentUser || !activeDirectUserId) return [];
    return db.messages.filter(
      (m) =>
        (m.sender_id === currentUser.id && m.receiver_id === activeDirectUserId) ||
        (m.sender_id === activeDirectUserId && m.receiver_id === currentUser.id)
    );
  }, [currentUser, activeDirectUserId, db.messages]);

  // Displayed messages depending on current view
  const currentMessages =
    chatTab === 'room'
      ? roomMessages
      : chatTab === 'groups'
      ? groupMessages
      : directMessages;

  // Available tasks in active workspace for #mention
  const workspaceTasks = useMemo(() => {
    if (!activeWorkspace) return [];
    return db.tasks.filter((t) => t.workspace_id === activeWorkspace.id && !t.is_archived);
  }, [activeWorkspace, db.tasks]);

  // Members in active workspace
  const workspaceMembers = useMemo(() => {
    return workspaceMemberIds
      .map((uid) => db.users.find((u) => u.id === uid))
      .filter((u): u is UserProfile => Boolean(u));
  }, [workspaceMemberIds, db.users]);

  // Other users list for direct chat
  const directUserContacts = useMemo(() => {
    if (!currentUser) return [];
    return db.users
      .filter((u) => u.id !== currentUser.id)
      .filter((u) => {
        if (!contactSearchQuery.trim()) return true;
        const q = contactSearchQuery.toLowerCase();
        return (
          u.display_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.bio && u.bio.toLowerCase().includes(q))
        );
      })
      .map((u) => {
        const inSameRoom = workspaceMemberIds.includes(u.id);
        // Find latest message between currentUser and u
        const userMsgs = db.messages.filter(
          (m) =>
            (m.sender_id === currentUser.id && m.receiver_id === u.id) ||
            (m.sender_id === u.id && m.receiver_id === currentUser.id)
        );
        const lastMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : null;
        return {
          user: u,
          inSameRoom,
          lastMsg,
        };
      })
      .sort((a, b) => {
        // Prioritize inSameRoom first, then latest message
        if (a.inSameRoom !== b.inSameRoom) {
          return a.inSameRoom ? -1 : 1;
        }
        if (a.lastMsg && b.lastMsg) {
          return new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime();
        }
        if (a.lastMsg) return -1;
        if (b.lastMsg) return 1;
        return a.user.display_name.localeCompare(b.user.display_name);
      });
  }, [currentUser, db.users, db.messages, workspaceMemberIds, contactSearchQuery]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, currentMessages.length, chatTab, activeDirectUserId]);

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0 && !selectedTaskId) return;

    if (chatTab === 'direct' && !activeDirectUserId) return;

    // Check task sharing rule for direct chat
    let taskIdToSend = selectedTaskId;
    if (chatTab === 'direct' && !isTargetInSameWorkspace && taskIdToSend) {
      setTaskNotice('Chỉ thành viên cùng phòng làm việc mới nhận được công việc!');
      taskIdToSend = null;
    }

    const receiverId = chatTab === 'direct' ? activeDirectUserId : null;
    const groupId = chatTab === 'groups' ? activeChatGroupId : null;

    sendMessage(input, taskIdToSend, attachedFiles, receiverId, groupId);
    setInput('');
    setSelectedTaskId(null);
    setStagedTaskForChat(null);
    setAttachedFiles([]);
    setShowTaskPicker(false);
    setShowMemberPicker(false);
    setShowEmojiPicker(false);
    setTaskNotice(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: FileAttachment[] = [];
    Array.from(files).forEach((file: File) => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const previewUrl = URL.createObjectURL(file);

      newAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        file_name: file.name,
        mime_type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        file_size: file.size,
        preview_url: previewUrl,
        created_at: new Date().toISOString(),
      });
    });

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
  };

  const handleTaskPickerClick = () => {
    if (chatTab === 'direct' && !isTargetInSameWorkspace) {
      setTaskNotice('Người này ở ngoài phòng làm việc. Chỉ có thể gửi văn bản và tệp!');
      setTimeout(() => setTaskNotice(null), 4000);
      return;
    }
    setShowTaskPicker((v) => !v);
    setShowMemberPicker(false);
    setShowEmojiPicker(false);
  };

  const handleLocateTask = (taskId: string) => {
    locateTaskInWorkspace(taskId);
  };

  const currentMentionedTask = selectedTaskId
    ? db.tasks.find((t) => t.id === selectedTaskId)
    : null;

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-full sm:w-[460px] md:w-[500px] bg-white dark:bg-[#0e1626] border-l border-slate-200/90 dark:border-slate-800 shadow-2xl transition-all duration-300">
        {/* Header with Navigation Tabs */}
        <div className="p-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#121c2e] shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Trung tâm Trò chuyện</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Đang kết nối" />
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                  {activeWorkspace ? activeWorkspace.name : 'Chưa chọn phòng'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Mode Tabs: Phòng làm việc vs Nhóm & Chủ đề vs Nhắn tin riêng */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/80 dark:bg-[#0a0f1d] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setChatTab('room');
                setSelectedTaskId(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition cursor-pointer ${
                chatTab === 'room'
                  ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="truncate">Phòng ({workspaceMembers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChatTab('groups');
                setSelectedTaskId(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition cursor-pointer ${
                chatTab === 'groups'
                  ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span className="truncate">Nhóm ({workspaceChatGroups.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChatTab('direct');
                setSelectedTaskId(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition cursor-pointer ${
                chatTab === 'direct'
                  ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="truncate">Nhắn 1-1</span>
              {activeDirectUser && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* BODY AREA */}
        {chatTab === 'direct' && !activeDirectUserId ? (
          /* Contact List for 1-1 Chat */
          <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/50 dark:bg-[#090e1a]">
            {/* Search contacts */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  placeholder="Tìm bạn bè, thành viên trao đổi..."
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* Contacts list */}
            <div className="flex-1 p-2 space-y-1 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Chọn người để nhắn tin riêng:
              </div>

              {directUserContacts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Không tìm thấy liên hệ nào phù hợp
                </div>
              ) : (
                directUserContacts.map(({ user, inSameRoom, lastMsg }) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setActiveDirectUserId(user.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#131d31] transition text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-800/80 cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">
                          {user.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0e1626]" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          {user.display_name}
                        </span>
                        {inSameRoom ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                            Cùng phòng
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                            Bạn bè
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {lastMsg ? (
                          <span>
                            {lastMsg.sender_id === currentUser?.id ? 'Bạn: ' : ''}
                            {lastMsg.content || (lastMsg.attachments?.length ? 'Đã gửi tệp' : 'Đã gửi công việc')}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">{user.email}</span>
                        )}
                      </p>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : chatTab === 'groups' && !activeChatGroupId ? (
          /* Groups List & Category Management */
          <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/50 dark:bg-[#090e1a]">
            {/* Search & Add Group Button */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    placeholder="Tìm nhóm chat, chủ đề thảo luận..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                {!isCreatingGroup && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(true)}
                    className="p-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
                    title="Tạo nhóm chat mới"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Tạo nhóm</span>
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'Hạng mục chung', label: 'Chung' },
                  { id: 'Khẩn cấp & Sự cố', label: 'Khẩn cấp' },
                  { id: 'Kế hoạch tuần', label: 'Kế hoạch' },
                  { id: 'Kỹ thuật & Bug', label: 'Kỹ thuật' },
                  { id: 'Thiết kế UI/UX', label: 'Thiết kế' },
                  { id: 'Bàn giao & Nghiệm thu', label: 'Bàn giao' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedGroupCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition cursor-pointer ${
                      selectedGroupCategory === cat.id
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Create Group Form */}
            {isCreatingGroup && (
              <div className="p-3.5 m-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-indigo-500" />
                    <span>Tạo nhóm trò chuyện theo chủ đề</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Tên nhóm chat:
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="VD: Họp giao ban, Bug khẩn cấp, Ý tưởng v2..."
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Hạng mục phân loại:
                    </label>
                    <select
                      value={newGroupCategory}
                      onChange={(e) => setNewGroupCategory(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="Hạng mục chung">Hạng mục chung</option>
                      <option value="Khẩn cấp & Sự cố">Khẩn cấp & Sự cố</option>
                      <option value="Kế hoạch tuần">Kế hoạch tuần</option>
                      <option value="Kỹ thuật & Bug">Kỹ thuật & Bug</option>
                      <option value="Thiết kế UI/UX">Thiết kế UI/UX</option>
                      <option value="Bàn giao & Nghiệm thu">Bàn giao & Nghiệm thu</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Màu đại diện:
                    </label>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setNewGroupColor(col)}
                          className={`w-5 h-5 rounded-full transition ${
                            newGroupColor === col ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-80'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Mô tả mục đích nhóm (tùy chọn)..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(false)}
                    className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newGroupName.trim()) return;
                      createChatGroup(
                        newGroupName.trim(),
                        newGroupCategory,
                        newGroupDesc.trim() || undefined,
                        newGroupColor
                      );
                      setNewGroupName('');
                      setNewGroupDesc('');
                      setIsCreatingGroup(false);
                    }}
                    className="px-3.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                  >
                    Tạo nhóm ngay
                  </button>
                </div>
              </div>
            )}

            {/* Groups list */}
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
              {workspaceChatGroups
                .filter((g) => {
                  if (selectedGroupCategory !== 'all' && g.category !== selectedGroupCategory) {
                    return false;
                  }
                  if (groupSearchQuery.trim()) {
                    const q = groupSearchQuery.toLowerCase();
                    return (
                      g.name.toLowerCase().includes(q) ||
                      (g.description && g.description.toLowerCase().includes(q)) ||
                      (g.category && g.category.toLowerCase().includes(q))
                    );
                  }
                  return true;
                })
                .map((g) => {
                  const msgsInGroup = db.messages.filter((m) => m.group_id === g.id);
                  const lastMsg = msgsInGroup[msgsInGroup.length - 1];

                  return (
                    <div
                      key={g.id}
                      onClick={() => setActiveChatGroupId(g.id)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#111927] hover:bg-indigo-50/40 dark:hover:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 transition text-left cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                          style={{ backgroundColor: (g as any).color || '#6366f1' }}
                        >
                          <Hash className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {g.name}
                            </span>
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded-md font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                              {g.category || 'Chung'}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {lastMsg ? (
                              <span>
                                {lastMsg.sender_id === currentUser?.id ? 'Bạn: ' : ''}
                                {lastMsg.content || (lastMsg.attachments?.length ? 'Đã gửi tệp' : 'Đã gắn task')}
                              </span>
                            ) : (
                              <span>{g.description || 'Chưa có tin nhắn nào trong nhóm'}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {msgsInGroup.length} tin
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    </div>
                  );
                })}

              {workspaceChatGroups.length === 0 && !isCreatingGroup && (
                <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                  <Hash className="w-8 h-8 mx-auto opacity-40 text-indigo-500" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Chưa có nhóm thảo luận theo chủ đề nào
                  </p>
                  <p className="text-[11px] max-w-xs mx-auto text-slate-400">
                    Phân chia các kênh chat thành từng hạng mục như Họp, Khẩn cấp, Nghiệm thu để nhóm làm việc hiệu quả hơn.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo nhóm chat đầu tiên</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Active Chat Thread (Room, Active Group, or Specific Direct Contact) */
          <>
            {/* Direct Chat Active Header */}
            {chatTab === 'direct' && activeDirectUser && (
              <div className="px-3.5 py-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveDirectUserId(null)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Quay lại danh sách liên hệ"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    {activeDirectUser.avatar_url ? (
                      <img
                        src={activeDirectUser.avatar_url}
                        alt={activeDirectUser.display_name}
                        className="w-7 h-7 rounded-full object-cover border border-indigo-200 dark:border-indigo-800"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                        {activeDirectUser.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-[#0e1626]" />
                  </div>

                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{activeDirectUser.display_name}</span>
                      {isTargetInSameWorkspace ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                          Chung phòng
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          Ngoài phòng
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {isTargetInSameWorkspace
                        ? 'Có thể gửi văn bản, tệp & công việc chung'
                        : 'Chỉ gửi được văn bản & tệp đính kèm'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveDirectUserId(null)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  Đổi người
                </button>
              </div>
            )}

            {/* Group Active Header */}
            {chatTab === 'groups' && activeChatGroup && (
              <div className="px-3.5 py-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveChatGroupId(null)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Quay lại danh sách nhóm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                    style={{ backgroundColor: (activeChatGroup as any).color || '#6366f1' }}
                  >
                    <Hash className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                      <span className="truncate">{activeChatGroup.name}</span>
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium shrink-0">
                        {activeChatGroup.category || 'Chung'}
                      </span>
                    </div>
                    {activeChatGroup.description && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {activeChatGroup.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveChatGroupId(null)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    Đổi nhóm
                  </button>
                  {(activeChatGroup.created_by === currentUser?.id || currentUser?.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa nhóm chat "${activeChatGroup.name}"?`)) {
                          deleteChatGroup(activeChatGroup.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Xóa nhóm này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40 dark:bg-[#0a0f1d]/70 text-xs">
              {currentMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-2">
                    <Smile className="w-6 h-6 opacity-80" />
                  </div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {chatTab === 'room'
                      ? 'Chưa có tin nhắn trong phòng này'
                      : chatTab === 'groups'
                      ? `Chưa có tin nhắn trong nhóm #${activeChatGroup?.name || ''}`
                      : `Bắt đầu cuộc trò chuyện với ${activeDirectUser?.display_name}`}
                  </p>
                  <p className="text-[11px] mt-1 text-slate-400 max-w-[260px]">
                    {chatTab === 'room'
                      ? 'Trao đổi tiến độ, chia sẻ tài liệu và liên kết công việc trực quan (#).'
                      : chatTab === 'groups'
                      ? 'Thảo luận chuyên sâu theo từng chủ đề hoặc hạng mục cụ thể.'
                      : isTargetInSameWorkspace
                      ? 'Vì cùng phòng làm việc, bạn có thể trao đổi tin nhắn, gửi tệp và đính kèm công việc.'
                      : 'Người này là bạn bè ngoài phòng. Bạn có thể gửi tin nhắn và gửi kèm tệp.'}
                  </p>
                </div>
              ) : (
                currentMessages.map((msg) => {
                  const sender = db.users.find((u) => u.id === msg.sender_id);
                  const isMe = msg.sender_id === currentUser?.id;
                  const taskInMsg = msg.task_id ? db.tasks.find((t) => t.id === msg.task_id) : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}
                    >
                      {/* Avatar for non-me messages */}
                      {!isMe && (
                        <div className="shrink-0 mt-0.5">
                          {sender?.avatar_url ? (
                            <img
                              src={sender.avatar_url}
                              alt={sender.display_name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {sender ? sender.display_name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[82%]`}>
                        {/* Sender display name and timestamp */}
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                          {!isMe && (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {sender ? sender.display_name : 'Người dùng'}
                            </span>
                          )}
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`rounded-2xl p-3 shadow-xs relative leading-relaxed ${
                            isMe
                              ? 'bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-br-xs'
                              : 'bg-white dark:bg-[#162135] text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/90 dark:border-slate-800'
                          }`}
                        >
                          {/* Interactive Linked Task Card in Message */}
                          {taskInMsg && (
                            <div
                              onClick={() => handleLocateTask(taskInMsg.id)}
                              className={`mb-2.5 p-2.5 rounded-xl border transition cursor-pointer group/task ${
                                isMe
                                  ? 'bg-white/10 hover:bg-white/20 border-white/25 text-white'
                                  : 'bg-slate-50 hover:bg-indigo-50/70 dark:bg-[#101828] dark:hover:bg-[#141f35] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                              }`}
                              title="Nhấp để định vị vị trí công việc trong khu vực"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-85">
                                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Công việc liên kết:</span>
                                </div>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                                    taskInMsg.priority === 'urgent'
                                      ? 'bg-rose-500 text-white'
                                      : taskInMsg.priority === 'high'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-indigo-500 text-white'
                                  }`}
                                >
                                  {taskInMsg.priority}
                                </span>
                              </div>

                              <div className="font-bold text-xs line-clamp-1 mb-1 group-hover/task:underline">
                                {taskInMsg.title}
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mb-1.5">
                                <div
                                  className="bg-emerald-400 h-full rounded-full transition-all"
                                  style={{
                                    width: `${
                                      (taskInMsg as any).progress ??
                                      (taskInMsg.status === 'done'
                                        ? 100
                                        : taskInMsg.status === 'in_progress'
                                        ? 50
                                        : 0)
                                    }%`,
                                  }}
                                />
                              </div>

                              {/* Action button to Jump & Highlight Task */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLocateTask(taskInMsg.id);
                                }}
                                className={`w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-bold transition ${
                                  isMe
                                    ? 'bg-white/20 hover:bg-white/30 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                }`}
                              >
                                <Target className="w-3.5 h-3.5" />
                                <span>🎯 Đến vị trí công việc</span>
                              </button>
                            </div>
                          )}

                          {/* Text Content */}
                          {msg.content && (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}

                          {/* File Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {msg.attachments.map((att) => {
                                const isImage = att.mime_type.startsWith('image/');
                                return (
                                  <div key={att.id}>
                                    {isImage ? (
                                      <div
                                        onClick={() => setPreviewAttachment(att)}
                                        className="rounded-xl overflow-hidden cursor-pointer border border-black/10 dark:border-white/10 group/img relative"
                                      >
                                        <img
                                          src={att.preview_url}
                                          alt={att.file_name}
                                          className="w-full max-h-48 object-cover group-hover/img:scale-105 transition duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white text-[11px] font-semibold">
                                          Xem ảnh phóng to
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewAttachment(att)}
                                        className={`flex items-center gap-2 p-2 rounded-xl text-[11px] w-full text-left transition ${
                                          isMe
                                            ? 'bg-white/15 hover:bg-white/25 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200'
                                        }`}
                                      >
                                        <FileText className="w-4 h-4 shrink-0 text-indigo-400" />
                                        <span className="truncate flex-1 font-medium">{att.file_name}</span>
                                        <span className="opacity-75 text-[10px] shrink-0">
                                          {(att.file_size / 1024).toFixed(0)}KB
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Actions / delete */}
                        {isMe && (
                          <div className="flex items-center gap-2 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => deleteMessage(msg.id)}
                              className="text-[10px] text-rose-500 hover:underline"
                            >
                              Xóa
                            </button>
                            <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                              <CheckCheck className="w-3 h-3" />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Emoji Bar */}
            {showEmojiPicker && (
              <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex items-center gap-2 overflow-x-auto">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInput((prev) => `${prev} ${emoji}`);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1 text-base hover:scale-125 transition cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Task Selector Popover (#) */}
            {showTaskPicker && (
              <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131d31] max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between px-1 mb-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Chọn công việc liên kết gửi đi:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTaskPicker(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {workspaceTasks.length === 0 ? (
                  <div className="text-slate-400 text-xs p-2 italic">Không có công việc nào</div>
                ) : (
                  workspaceTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTaskId(t.id);
                        setShowTaskPicker(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {t.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2 capitalize">
                        {t.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Member Mention Selector Popover (@) */}
            {showMemberPicker && (
              <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131d31] max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between px-1 mb-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Nhắc thành viên (@):
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMemberPicker(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {workspaceMembers.map(
                  (m) =>
                    m && (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setInput((prev) => `${prev} @${m.display_name} `);
                          setShowMemberPicker(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-800 dark:text-slate-200 truncate transition cursor-pointer"
                      >
                        @{m.display_name}
                      </button>
                    )
                )}
              </div>
            )}

            {/* Notification notice if task sharing not permitted */}
            {taskNotice && (
              <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/60 border-t border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0 text-amber-500" />
                <span>{taskNotice}</span>
              </div>
            )}

            {/* Mention & Staged Task & Attachment Indicators */}
            {(currentMentionedTask || attachedFiles.length > 0) && (
              <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-indigo-50/60 dark:bg-indigo-950/40 flex flex-wrap gap-1.5 items-center">
                {currentMentionedTask && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800 shadow-xs">
                    <Hash className="w-3 h-3 text-indigo-500" />
                    <span className="truncate max-w-[160px]">{currentMentionedTask.title}</span>
                    <X
                      className="w-3.5 h-3.5 cursor-pointer hover:text-rose-500 transition"
                      onClick={() => {
                        setSelectedTaskId(null);
                        setStagedTaskForChat(null);
                      }}
                    />
                  </span>
                )}

                {attachedFiles.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium border border-slate-300 dark:border-slate-700 shadow-xs"
                  >
                    <Paperclip className="w-3 h-3 text-slate-500" />
                    <span className="truncate max-w-[110px]">{f.file_name}</span>
                    <X
                      className="w-3.5 h-3.5 cursor-pointer hover:text-rose-500 transition"
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    />
                  </span>
                ))}
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shrink-0"
            >
              {/* Action tool buttons */}
              <div className="flex items-center justify-between mb-2 text-slate-400">
                <div className="flex items-center gap-1">
                  {/* Task picker button (#) */}
                  <button
                    type="button"
                    onClick={handleTaskPickerClick}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      chatTab === 'direct' && !isTargetInSameWorkspace
                        ? 'opacity-40 cursor-not-allowed hover:bg-transparent'
                        : 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={
                      chatTab === 'direct' && !isTargetInSameWorkspace
                        ? 'Chỉ thành viên chung phòng mới có thể gửi công việc'
                        : 'Liên kết & gửi công việc (#)'
                    }
                  >
                    <Hash className="w-4 h-4" />
                  </button>

                  {/* Mention button (@) */}
                  {(chatTab === 'room' || chatTab === 'groups') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMemberPicker((v) => !v);
                        setShowTaskPicker(false);
                        setShowEmojiPicker(false);
                      }}
                      className="p-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Nhắc thành viên (@)"
                    >
                      <AtSign className="w-4 h-4" />
                    </button>
                  )}

                  {/* File upload button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Đính kèm tài liệu / hình ảnh (hỗ trợ tiếng Việt)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Quick emoji button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker((v) => !v);
                      setShowTaskPicker(false);
                      setShowMemberPicker(false);
                    }}
                    className="p-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Chèn biểu tượng cảm xúc"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {chatTab === 'direct' && !isTargetInSameWorkspace && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Không chung phòng</span>
                  </span>
                )}
              </div>

              {/* Input text + Send */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    chatTab === 'room'
                      ? 'Nhập tin nhắn trao đổi trong phòng...'
                      : chatTab === 'groups'
                      ? `Nhắn tin trong nhóm #${activeChatGroup?.name || ''}...`
                      : `Nhắn tin cho ${activeDirectUser?.display_name}...`
                  }
                  className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#152037] text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                />
                <button
                  type="submit"
                  disabled={!input.trim() && attachedFiles.length === 0 && !selectedTaskId}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition shrink-0 cursor-pointer"
                  title="Gửi tin nhắn"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
};
