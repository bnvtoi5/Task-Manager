import React, { useState } from 'react';
import {
  Menu,
  Search,
  SlidersHorizontal,
  Bell,
  MessageSquare,
  Sun,
  Moon,
  Shield,
  LogOut,
  ChevronDown,
  Plus,
  UserPlus,
  User,
  Briefcase,
  Check,
  X,
  Trash2,
  Cloud
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { ProfileEditModal } from '../profile/ProfileEditModal';

interface TopBarProps {
  onOpenWorkspaceModal: (mode: 'create' | 'join') => void;
  onOpenInviteModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenWorkspaceModal,
  onOpenInviteModal,
}) => {
  const {
    db,
    currentUser,
    activeWorkspace,
    setActiveWorkspaceId,
    deleteWorkspace,
    theme,
    toggleTheme,
    navigateTo,
    logout,
    searchQuery,
    setSearchQuery,
    filterAssignee,
    setFilterAssignee,
    filterPriority,
    setFilterPriority,
    filterStatus,
    setFilterStatus,
    setIsChatOpen,
    setIsNotificationOpen,
    unreadNotificationCount,
    isSidebarOpen,
    setIsSidebarOpen,
    firebaseStatus,
    firebaseError,
  } = useApp();

  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // In-app workspace deletion state
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; name: string } | null>(null);

  // User's workspaces
  const userWorkspaces = currentUser
    ? db.workspaces.filter((w) => {
        if (w.is_archived) return false;
        return (
          w.owner_id === currentUser.id ||
          db.workspace_members.some((m) => m.workspace_id === w.id && m.user_id === currentUser.id)
        );
      })
    : [];

  // Workspace members for filter
  const workspaceMembers = activeWorkspace
    ? db.workspace_members
        .filter((m) => m.workspace_id === activeWorkspace.id && m.status === 'active')
        .map((m) => db.users.find((u) => u.id === m.user_id))
        .filter(Boolean)
    : [];

  const hasActiveFilters =
    filterAssignee !== 'all' || filterPriority !== 'all' || filterStatus !== 'all';

  const handleConfirmDeleteWorkspace = () => {
    if (workspaceToDelete) {
      deleteWorkspace(workspaceToDelete.id);
      setWorkspaceToDelete(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-white/95 dark:bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 transition-colors">
        {/* Left: 3-bar hamburger & Workspace Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Menu toggle: 3-bar hamburger for both mobile and desktop */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title={isSidebarOpen ? 'Thu hẹp thanh danh mục bên trái' : 'Mở rộng thanh danh mục bên trái'}
            aria-label="Thu hẹp hoặc mở rộng danh mục"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Workspace Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsWsDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: activeWorkspace?.color || '#4F46E5' }}
              >
                {activeWorkspace?.name ? activeWorkspace.name.charAt(0).toUpperCase() : 'W'}
              </div>
              <span className="truncate max-w-[130px] sm:max-w-[200px]">
                {activeWorkspace ? activeWorkspace.name : 'Chọn phòng làm việc'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isWsDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[65]" onClick={() => setIsWsDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-[70] w-72 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-2xl py-2 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Phòng làm việc của bạn
                  </div>

                  <div className="max-h-60 overflow-y-auto px-1.5 space-y-1">
                    {userWorkspaces.length === 0 ? (
                      <div className="px-3 py-3 text-slate-400 text-center italic">
                        Chưa tham gia phòng nào
                      </div>
                    ) : (
                      userWorkspaces.map((ws) => {
                        const isSelected = activeWorkspace?.id === ws.id;
                        const isOwner = ws.owner_id === currentUser?.id || currentUser?.role === 'admin';
                        return (
                          <div
                            key={ws.id}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveWorkspaceId(ws.id);
                                setIsWsDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 truncate flex-1 text-left"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: ws.color }}
                              />
                              <span className="truncate">{ws.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />}
                            </button>

                            {/* Delete workspace button for owner / admin */}
                            {isOwner && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWorkspaceToDelete({ id: ws.id, name: ws.name });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition shrink-0 ml-1"
                                title="Xóa phòng làm việc này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsWsDropdownOpen(false);
                      onOpenWorkspaceModal('create');
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition text-left"
                  >
                    <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Tạo phòng mới</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsWsDropdownOpen(false);
                      onOpenWorkspaceModal('join');
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition text-left"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Tham gia bằng mã</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center: Search & Filter bar (Desktop) */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm công việc, mô tả..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterPopoverOpen((v) => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                hasActiveFilters
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Lọc công việc theo tiêu chí"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Lọc</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              )}
            </button>

            {isFilterPopoverOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsFilterPopoverOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-30 w-72 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-2xl p-4 text-xs space-y-3.5 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 font-bold">
                    <span>Bộ lọc nâng cao</span>
                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setFilterAssignee('all');
                          setFilterPriority('all');
                          setFilterStatus('all');
                        }}
                        className="text-[11px] text-indigo-600 hover:underline font-normal"
                      >
                        Đặt lại
                      </button>
                    )}
                  </div>

                  {/* Filter by Assignee */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Người phụ trách
                    </label>
                    <select
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="all">Tất cả người làm</option>
                      <option value="unassigned">Chưa giao ai</option>
                      {workspaceMembers.map((m) => m && (
                        <option key={m.id} value={m.id}>
                          {m.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Priority */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Mức ưu tiên
                    </label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="all">Tất cả mức</option>
                      <option value="urgent">Khẩn cấp (Urgent)</option>
                      <option value="high">Cao (High)</option>
                      <option value="medium">Trung bình (Medium)</option>
                      <option value="low">Thấp (Low)</option>
                    </select>
                  </div>

                  {/* Filter by Status */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Trạng thái
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="todo">Cần làm (Todo)</option>
                      <option value="in_progress">Đang làm (In Progress)</option>
                      <option value="review">Đang duyệt (Review)</option>
                      <option value="done">Hoàn thành (Done)</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions, Theme, Chat, Notifications & User */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Invite Code Button */}
          {activeWorkspace && (
            <button
              type="button"
              onClick={onOpenInviteModal}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Mời bạn</span>
            </button>
          )}

          {/* Firebase Cloud Sync Status */}
          <div
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition cursor-default ${
              firebaseStatus === 'connected'
                ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : firebaseStatus === 'connecting'
                ? 'border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                : 'border-rose-200 dark:border-rose-800/80 bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}
            title={
              firebaseStatus === 'connected'
                ? 'Đã kết nối Firebase Firestore: my-workplace-app (Đồng bộ thời gian thực)'
                : firebaseStatus === 'connecting'
                ? 'Đang kết nối tới Firestore...'
                : `Lỗi kết nối Firebase: ${firebaseError || 'Kiểm tra cài đặt Firestore'}`
            }
          >
            <Cloud className={`w-3.5 h-3.5 ${firebaseStatus === 'connected' ? 'text-emerald-500' : firebaseStatus === 'connecting' ? 'text-amber-500' : 'text-rose-500'}`} />
            <span>
              {firebaseStatus === 'connected'
                ? 'Cloud DB'
                : firebaseStatus === 'connecting'
                ? 'Đang kết nối'
                : 'Offline DB'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                firebaseStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : firebaseStatus === 'connecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
          </div>

          {/* Chat Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition relative"
            title="Trò chuyện phòng làm việc"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(true)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition relative"
            title="Thông báo"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            )}
          </button>

          {/* Theme Toggle - Free switch between Light and Dark mode */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* User Profile & Role Dropdown */}
          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setIsUserDropdownOpen((v) => !v)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.display_name}
                  className="w-7 h-7 rounded-full object-cover shadow-xs border border-indigo-200 dark:border-indigo-800"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser?.display_name ? currentUser.display_name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden xl:block text-left text-xs leading-tight">
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">
                  {currentUser?.display_name}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentUser?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                </div>
              </div>
            </button>

            {isUserDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[65]" onClick={() => setIsUserDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-[70] w-56 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-2xl py-2 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {currentUser?.display_name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        currentUser?.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Vai trò: {currentUser?.role === 'admin' ? 'Admin' : 'Thành viên'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-semibold transition cursor-pointer"
                  >
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>Hồ sơ & Đổi Avatar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toggleTheme();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left font-semibold transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {theme === 'light' ? (
                        <Moon className="w-4 h-4 text-slate-600" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-400" />
                      )}
                      <span>Giao diện</span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      {theme === 'light' ? 'Chế độ Sáng' : 'Chế độ Tối'}
                    </span>
                  </button>

                  {currentUser?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        navigateTo('/admin');
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-left font-semibold"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Quản trị Hệ thống (/admin)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* In-app Workspace Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={workspaceToDelete !== null}
        title="Xác nhận xóa phòng làm việc"
        message={`Bạn có chắc muốn xóa phòng làm việc "${workspaceToDelete?.name}" không? Tất cả các giai đoạn, phân chia, cụm và công việc bên trong sẽ bị xóa vĩnh viễn.`}
        confirmText="Xác nhận xóa"
        onConfirm={handleConfirmDeleteWorkspace}
        onCancel={() => setWorkspaceToDelete(null)}
      />
    </>
  );
};
