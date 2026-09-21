import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthPage } from './components/auth/AuthPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TopBar } from './components/navigation/TopBar';
import { Sidebar } from './components/navigation/Sidebar';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { NotificationDrawer } from './components/notification/NotificationDrawer';
import { FilePreviewModal } from './components/preview/FilePreviewModal';
import { AlarmBanner } from './components/alarm/AlarmBanner';
import {
  WorkspaceModal,
  PeriodModal,
  DivisionModal,
  ClusterModal,
  InviteModal,
} from './components/modals/EntityModals';
import { MembersModal, ActivityLogsModal } from './components/modals/RoomModals';
import { PageMascotCompanion } from './components/mascot/PageMascotCompanion';
import { Period, Division, Cluster } from './types';

const MainAppContent: React.FC = () => {
  const {
    currentUser,
    currentRoute,
    isChatOpen,
    setIsChatOpen,
    isNotificationOpen,
    setIsNotificationOpen,
    activeWorkspace,
    activeAlarmTask,
    dismissAlarm,
    snoozeAlarm,
    toastMessage,
  } = useApp();

  // Modals state
  const [workspaceModalMode, setWorkspaceModalMode] = useState<'create' | 'join' | null>(null);
  const [periodToEdit, setPeriodToEdit] = useState<Period | null | undefined>(undefined);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);

  const [divisionToEdit, setDivisionToEdit] = useState<Division | null | undefined>(undefined);
  const [isDivisionModalOpen, setIsDivisionModalOpen] = useState(false);

  const [clusterToEdit, setClusterToEdit] = useState<Cluster | null | undefined>(undefined);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  // Route 1: Not authenticated or /login route -> Render AuthPage
  if (!currentUser || currentRoute === '/login') {
    return <AuthPage />;
  }

  // Route 2: /admin route -> Render AdminDashboard (with role-guard check inside)
  if (currentRoute === '/admin') {
    return <AdminDashboard />;
  }

  // Route 3: /app route -> Main Workspace Task Manager
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 font-sans text-neutral-900 dark:text-neutral-100 antialiased select-none">
      {/* TopBar Header */}
      <TopBar
        onOpenWorkspaceModal={(mode) => setWorkspaceModalMode(mode)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
      />

      {/* Main App Body with Sidebar and Workspace Canvas */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Hierarchy Sidebar */}
        <Sidebar
          onOpenPeriodModal={(period) => {
            setPeriodToEdit(period);
            setIsPeriodModalOpen(true);
          }}
          onOpenDivisionModal={(division) => {
            setDivisionToEdit(division);
            setIsDivisionModalOpen(true);
          }}
          onOpenMembersModal={() => setIsMembersModalOpen(true)}
          onOpenActivityLogsModal={() => setIsLogsModalOpen(true)}
        />

        {/* Workspace Main View */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <WorkspaceView
            onOpenWorkspaceModal={(mode) => setWorkspaceModalMode(mode)}
            onOpenPeriodModal={() => {
              setPeriodToEdit(null);
              setIsPeriodModalOpen(true);
            }}
            onOpenDivisionModal={() => {
              setDivisionToEdit(null);
              setIsDivisionModalOpen(true);
            }}
            onOpenClusterModal={(cluster) => {
              setClusterToEdit(cluster);
              setIsClusterModalOpen(true);
            }}
          />
        </main>
      </div>

      {/* Real-time Alarm / Reminder Banner */}
      <AlarmBanner
        task={activeAlarmTask}
        onDismiss={dismissAlarm}
        onSnooze={snoozeAlarm}
        onViewTask={(task) => {
          dismissAlarm();
        }}
      />

      {/* Right Slide Drawers */}
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <NotificationDrawer isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />

      {/* Entity Modals */}
      <WorkspaceModal
        isOpen={workspaceModalMode !== null}
        onClose={() => setWorkspaceModalMode(null)}
        mode={workspaceModalMode || 'create'}
      />

      <PeriodModal
        isOpen={isPeriodModalOpen}
        onClose={() => {
          setIsPeriodModalOpen(false);
          setPeriodToEdit(undefined);
        }}
        periodToEdit={periodToEdit}
      />

      <DivisionModal
        isOpen={isDivisionModalOpen}
        onClose={() => {
          setIsDivisionModalOpen(false);
          setDivisionToEdit(undefined);
        }}
        divisionToEdit={divisionToEdit}
      />

      <ClusterModal
        isOpen={isClusterModalOpen}
        onClose={() => {
          setIsClusterModalOpen(false);
          setClusterToEdit(undefined);
        }}
        clusterToEdit={clusterToEdit}
      />

      {activeWorkspace && (
        <InviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          inviteCode={activeWorkspace.invite_code}
          workspaceName={activeWorkspace.name}
        />
      )}

      <MembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
      />

      <ActivityLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
      />

      {/* Preview File / Media Modal */}
      <FilePreviewModal />

      {/* Interactive Page Mascot Companion */}
      <PageMascotCompanion />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-neutral-900/90 dark:bg-neutral-800/95 text-white shadow-2xl border border-emerald-500/40 backdrop-blur-md text-xs font-medium animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
