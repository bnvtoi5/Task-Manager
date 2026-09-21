import { ActionProposal } from './mascotAITypes';
import { Task, Workspace, Division, Cluster, Period } from '../../types';
import { DatabaseState } from '../../services/storage';

export interface ExecuteActionResult {
  success: boolean;
  message: string;
}

// Track recently executed proposal IDs with timestamp to prevent duplicate executions
const executedProposalIdsMap = new Map<string, number>();

// Track recent task creations (signature -> timestamp) to prevent identical duplicate tasks created within 5 seconds
const recentCreatedTasksMap = new Map<string, number>();

/**
 * Intelligently resolve the target cluster and mode_clusters
 * Supports:
 * 1. Explicit cluster_index (e.g. 2 for "cụm 2" / "cột 2")
 * 2. Phrasing containing "cụm N" / "cột N" in cluster_name, summary, or targetName
 * 3. Exact or fuzzy match on cluster name
 * 4. Direct cluster_id matching
 * 5. Auto-creates missing clusters up to N if user specifies "cụm 2" in a division with only 1 cluster
 */
export interface ResolvedClusterResult {
  clusterId: string;
  clusterName: string;
  boardModeId?: string;
  boardModeName?: string;
  modeClustersData?: Record<string, string>;
}

function resolveTargetCluster(
  divisionId: string,
  details: Record<string, any>,
  summary: string,
  targetName: string,
  appOps: {
    db: DatabaseState;
    createCluster: (data: any) => Cluster;
    activeBoardModeId?: string;
  },
  executionContext?: ProposalExecutionContext
): ResolvedClusterResult {
  // 1. Existing Kanban clusters for this division
  let divClusters = appOps.db.clusters
    .filter((c) => c.division_id === divisionId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // 2. All board modes available for this division (including presets)
  const divBoardModes = (appOps.db.board_modes || []).filter(
    (m) => m.division_id === divisionId || m.is_preset
  );

  // Helper string cleaner
  const cleanStr = (s: string) =>
    (s || '')
      .toLowerCase()
      .trim()
      .replace(/^["'“”]|["'“”]$/g, '')
      .replace(/^(?:cụm|cột|cột\s*thứ|cụm\s*thứ)\s*/i, '');

  const rawTargetQuery = (
    details.cluster_name ||
    details.target_cluster_name ||
    details.cluster_id ||
    ''
  ).toString().trim();
  const qNorm = cleanStr(rawTargetQuery);
  const fullContextText = `${rawTargetQuery} ${summary || ''} ${targetName || ''}`.toLowerCase();

  // Scan if target matches a column in ANY Board Mode of this division
  let matchedBoardMode: any = undefined;
  let matchedModeCol: { id: string; name: string } | undefined = undefined;

  // Check specified board_mode_id first if passed in details
  if (details.board_mode_id) {
    matchedBoardMode = (appOps.db.board_modes || []).find((m) => m.id === details.board_mode_id);
  }

  // If query string exists, match against all Board Modes of this division
  if (qNorm) {
    for (const bm of divBoardModes) {
      const col = (bm.clusters || []).find((c: any) => {
        const cNorm = cleanStr(c.name);
        return cNorm === qNorm || cNorm.includes(qNorm) || qNorm.includes(cNorm);
      });
      if (col) {
        matchedBoardMode = bm;
        matchedModeCol = col;
        break;
      }
    }
  }

  // Also check if fullContextText contains any column name of any board mode in this division
  if (!matchedModeCol) {
    for (const bm of divBoardModes) {
      for (const col of bm.clusters || []) {
        const cNorm = cleanStr(col.name);
        if (cNorm.length >= 2 && fullContextText.includes(cNorm)) {
          matchedBoardMode = bm;
          matchedModeCol = col;
          break;
        }
      }
      if (matchedModeCol) break;
    }
  }

  // If still no matched board mode, use executionContext, appOps.activeBoardModeId, or default division board mode
  const activeBoardModeId =
    (matchedBoardMode ? matchedBoardMode.id : undefined) ||
    details.board_mode_id ||
    executionContext?.lastCreatedBoardModeId ||
    appOps.activeBoardModeId ||
    (divBoardModes.length > 0 ? divBoardModes[0].id : 'kanban');

  if (!matchedBoardMode && activeBoardModeId && activeBoardModeId !== 'kanban') {
    matchedBoardMode = (appOps.db.board_modes || []).find((m) => m.id === activeBoardModeId);
  }

  const isKanban = !activeBoardModeId || activeBoardModeId === 'kanban';

  // Clusters of the active board mode
  let activeModeClusters: Array<{ id: string; name: string }> = [];
  if (matchedBoardMode && matchedBoardMode.clusters && matchedBoardMode.clusters.length > 0) {
    activeModeClusters = matchedBoardMode.clusters;
  } else if (!isKanban && activeBoardModeId) {
    if (executionContext?.lastCreatedBoardModeId === activeBoardModeId && executionContext.boardModeClusters) {
      activeModeClusters = executionContext.boardModeClusters;
    } else {
      const mode = (appOps.db.board_modes || []).find((m) => m.id === activeBoardModeId);
      if (mode && mode.clusters && mode.clusters.length > 0) {
        activeModeClusters = mode.clusters;
      }
    }
  }

  const effectiveModeName = matchedBoardMode?.name || (isKanban ? 'Kanban' : 'Chế độ bảng');

  // If we already matched the exact column in a Board Mode
  if (matchedModeCol && matchedBoardMode) {
    const fallbackDivClu =
      divClusters.find((c) => cleanStr(c.name) === cleanStr(matchedModeCol!.name)) ||
      divClusters.find(
        (c) => cleanStr(c.name).includes(cleanStr(matchedModeCol!.name)) || cleanStr(matchedModeCol!.name).includes(cleanStr(c.name))
      ) ||
      divClusters[0];

    return {
      clusterId: fallbackDivClu ? fallbackDivClu.id : matchedModeCol.id,
      clusterName: matchedModeCol.name,
      boardModeId: matchedBoardMode.id,
      boardModeName: matchedBoardMode.name,
      modeClustersData: { [matchedBoardMode.id]: matchedModeCol.id },
    };
  }

  // Primary list visible to user on their current board
  const visibleClusters = activeModeClusters.length > 0 ? activeModeClusters : divClusters;

  // Determine if a numeric cluster index was requested:
  let targetIndex: number | null = null;
  if (typeof details.cluster_index === 'number' && details.cluster_index > 0) {
    targetIndex = details.cluster_index;
  } else {
    const textToCheck = `${details.cluster_name || ''} ${details.cluster_id || ''} ${summary || ''} ${targetName || ''}`;
    const match = textToCheck.match(/(?:cụm|cột)\s*(?:thứ\s*)?([0-9]+)/i);
    if (match) {
      targetIndex = parseInt(match[1], 10);
    }
  }

  // If index N was requested (e.g. Cụm 2 / Cột 2)
  if (targetIndex !== null && targetIndex > 0) {
    const zeroBasedIdx = targetIndex - 1;

    // In visibleClusters:
    if (visibleClusters[zeroBasedIdx]) {
      const chosen = visibleClusters[zeroBasedIdx];
      const fallbackDivCluId = divClusters[zeroBasedIdx]?.id || divClusters[0]?.id || chosen.id;
      return {
        clusterId: isKanban ? chosen.id : fallbackDivCluId,
        clusterName: chosen.name,
        boardModeId: matchedBoardMode?.id || (isKanban ? 'kanban' : activeBoardModeId),
        boardModeName: effectiveModeName,
        modeClustersData: !isKanban && activeBoardModeId ? { [activeBoardModeId]: chosen.id } : undefined,
      };
    }

    // In divClusters:
    if (divClusters[zeroBasedIdx]) {
      const chosen = divClusters[zeroBasedIdx];
      return {
        clusterId: chosen.id,
        clusterName: chosen.name,
        boardModeId: matchedBoardMode?.id || (isKanban ? 'kanban' : activeBoardModeId),
        boardModeName: effectiveModeName,
        modeClustersData: !isKanban && activeBoardModeId && activeModeClusters[zeroBasedIdx]
          ? { [activeBoardModeId]: activeModeClusters[zeroBasedIdx].id }
          : undefined,
      };
    }

    // If targetIndex > current count (e.g. user asks for Cụm 2, but only 1 cluster exists):
    while (divClusters.length < targetIndex) {
      const nextIdx = divClusters.length + 1;
      const created = appOps.createCluster({
        division_id: divisionId,
        name: `Cụm ${nextIdx}`,
        description: '',
        color: nextIdx === 2 ? '#3B82F6' : nextIdx === 3 ? '#10B981' : '#F59E0B',
        icon: 'Folder',
        sort_order: nextIdx,
        is_collapsed: false,
      });
      divClusters.push(created);
    }
    const chosen = divClusters[zeroBasedIdx];
    return {
      clusterId: chosen.id,
      clusterName: chosen.name,
      boardModeId: matchedBoardMode?.id || (isKanban ? 'kanban' : activeBoardModeId),
      boardModeName: effectiveModeName,
      modeClustersData: !isKanban && activeBoardModeId && activeModeClusters[zeroBasedIdx]
        ? { [activeBoardModeId]: activeModeClusters[zeroBasedIdx].id }
        : undefined,
    };
  }

  // If no number, check if details.cluster_id directly matches
  if (details.cluster_id) {
    const directMatch =
      visibleClusters.find((c) => c.id === details.cluster_id) ||
      divClusters.find((c) => c.id === details.cluster_id) ||
      appOps.db.clusters.find((c) => c.id === details.cluster_id);
    if (directMatch) {
      const fallbackDivCluId = divClusters[0]?.id || directMatch.id;
      return {
        clusterId: isKanban ? directMatch.id : fallbackDivCluId,
        clusterName: directMatch.name,
        boardModeId: matchedBoardMode?.id || (isKanban ? 'kanban' : activeBoardModeId),
        boardModeName: effectiveModeName,
        modeClustersData: !isKanban && activeBoardModeId ? { [activeBoardModeId]: directMatch.id } : undefined,
      };
    }
  }

  // Check if details.cluster_name matches by name in visibleClusters or divClusters
  if (details.cluster_name) {
    const cNameLower = details.cluster_name.trim().toLowerCase();
    const nameMatch =
      visibleClusters.find((c) => c.name.toLowerCase().includes(cNameLower) || cNameLower.includes(c.name.toLowerCase())) ||
      divClusters.find((c) => c.name.toLowerCase().includes(cNameLower) || cNameLower.includes(c.name.toLowerCase()));
    if (nameMatch) {
      const fallbackDivCluId = divClusters[0]?.id || nameMatch.id;
      return {
        clusterId: isKanban ? nameMatch.id : fallbackDivCluId,
        clusterName: nameMatch.name,
        boardModeId: matchedBoardMode?.id || (isKanban ? 'kanban' : activeBoardModeId),
        boardModeName: effectiveModeName,
        modeClustersData: !isKanban && activeBoardModeId ? { [activeBoardModeId]: nameMatch.id } : undefined,
      };
    }
  }

  // Fallback to 1st visible cluster
  const fallback = visibleClusters[0] || divClusters[0] || appOps.db.clusters[0];
  const fallbackId = fallback?.id || `clu-default-${divisionId}`;
  return {
    clusterId: fallbackId,
    clusterName: fallback?.name || 'Cụm 1',
    boardModeId: matchedBoardMode?.id || (isKanban ? 'kanban' : activeBoardModeId),
    boardModeName: effectiveModeName,
    modeClustersData: !isKanban && activeBoardModeId && activeModeClusters[0]
      ? { [activeBoardModeId]: activeModeClusters[0].id }
      : undefined,
  };
}

/**
 * Helper to parse local alarm date/time components without timezone shifts.
 * Handles both ISO strings ("2026-09-19T08:00:00.000Z" or "2026-09-19T08:00:00")
 * and Vietnamese display strings ("08:00 ngày 19/09/2026", "8h sáng mai", "15:30").
 * Always prioritizes the human-intended local time digits without UTC shifting.
 */
export function parseLocalAlarmComponents(
  rawAlarmTime?: string | null,
  rawAlarmAt?: string | null
): { year: number; month: number; day: number; hours: number; minutes: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12
  let day = now.getDate();
  let hours = 8;
  let minutes = 0;
  let hasExplicitTime = false;
  let hasExplicitDate = false;

  const timeStr = (rawAlarmTime || '').trim();
  const atStr = (rawAlarmAt || '').trim();

  // 1. Priority 1: Check if rawAlarmTime has explicit time like "08:00", "8h", "8h30", "15:30"
  if (timeStr) {
    const isPM = /(?:tối|chiều|pm)\b/i.test(timeStr);
    const isAM = /(?:sáng|am)\b/i.test(timeStr);

    const timeMatch = timeStr.match(/(\d{1,2})[:h](\d{1,2})|(\d{1,2})\s*h/i);
    if (timeMatch) {
      if (timeMatch[3]) {
        hours = parseInt(timeMatch[3], 10);
        minutes = 0;
      } else {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2] || '0', 10);
      }
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
      hasExplicitTime = true;
    }

    // Check for Vietnamese date DD/MM/YYYY or DD-MM-YYYY in timeStr
    const vnDateMatch = timeStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (vnDateMatch) {
      day = parseInt(vnDateMatch[1], 10);
      month = parseInt(vnDateMatch[2], 10);
      year = parseInt(vnDateMatch[3], 10);
      hasExplicitDate = true;
    } else if (/(?:ngày\s+mai|sáng\s+mai|tối\s+mai|chiều\s+mai|hôm\s+sau)\b/i.test(timeStr)) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      year = tomorrow.getFullYear();
      month = tomorrow.getMonth() + 1;
      day = tomorrow.getDate();
      hasExplicitDate = true;
    }
  }

  // 2. Priority 2: Extract date/time from rawAlarmAt if not yet found
  if (atStr) {
    const isoMatch = atStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      if (!hasExplicitDate) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10);
        day = parseInt(isoMatch[3], 10);
        hasExplicitDate = true;
      }
      if (!hasExplicitTime && isoMatch[4] !== undefined) {
        hours = parseInt(isoMatch[4], 10);
        minutes = parseInt(isoMatch[5] || '0', 10);
        hasExplicitTime = true;
      }
    }
  }

  // 3. If still no date, and specified time has already passed today, default to tomorrow
  if (!hasExplicitDate) {
    const testDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (testDate.getTime() <= now.getTime()) {
      testDate.setDate(testDate.getDate() + 1);
      year = testDate.getFullYear();
      month = testDate.getMonth() + 1;
      day = testDate.getDate();
    }
  }

  return { year, month, day, hours, minutes };
}

/**
 * Normalizes alarm parameters to ensure both a valid ISO alarm_at (for background timer)
 * and a human-readable alarm_time (for display) are always created and synchronized.
 * Strictly operates in local clock time to eliminate timezone drift (+7h, etc.).
 */
export function normalizeAlarmPayload(
  rawAlarmTime?: string | null,
  rawAlarmAt?: string | null,
  rawRepeat?: 'none' | 'daily' | 'weekly'
): { alarm_enabled: boolean; alarm_at: string; alarm_time: string; alarm_repeat: 'none' | 'daily' | 'weekly' } {
  const { year, month, day, hours, minutes } = parseLocalAlarmComponents(rawAlarmTime, rawAlarmAt);

  // Construct explicitly in local browser time
  const targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const mStr = String(month).padStart(2, '0');

  return {
    alarm_enabled: true,
    alarm_at: targetDate.toISOString(),
    alarm_time: `${hh}:${mm} ngày ${dStr}/${mStr}/${year}`,
    alarm_repeat: rawRepeat || 'none',
  };
}

export interface ProposalExecutionContext {
  lastCreatedWorkspaceId?: string;
  lastCreatedDivisionId?: string;
  lastCreatedPeriodId?: string;
  lastCreatedBoardModeId?: string;
  boardModeClusters?: Array<{ id: string; name: string }>;
  workspaceMap?: Map<string, string>;
  divisionMap?: Map<string, string>;
}

export function executeActionProposal(
  proposal: ActionProposal,
  appOps: {
    createTask: (data: any) => Task;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    createCluster: (data: any) => Cluster;
    updateCluster: (id: string, updates: Partial<Cluster>) => void;
    deleteCluster: (id: string) => void;
    createDivision: (data: any) => Division;
    updateDivision: (id: string, updates: Partial<Division>) => void;
    deleteDivision: (id: string) => void;
    createPeriod: (data: any) => Period;
    updatePeriod: (id: string, updates: Partial<Period>) => void;
    deletePeriod: (id: string) => void;
    createWorkspace: (name: string, description?: string, icon?: string, color?: string) => Workspace;
    updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
    deleteWorkspace: (id: string) => void;
    createBoardMode?: (name: string, description?: string, clusters?: any[], targetDivisionId?: string) => any;
    updateBoardMode?: (modeId: string, updates: any) => void;
    deleteBoardMode?: (modeId: string) => void;
    setActiveWorkspaceId?: (id: string) => void;
    setActiveDivisionId?: (id: string) => void;
    setActivePeriodId?: (id: string) => void;
    setActiveBoardModeId?: (id: string) => void;
    activeWorkspace: Workspace | null;
    activePeriod?: Period | null;
    activeDivision: Division | null;
    activeBoardModeId?: string;
    db: DatabaseState;
  },
  executionContext?: ProposalExecutionContext
): ExecuteActionResult {
  try {
    const { action, details, target_name } = proposal;

    // Idempotency check: if proposal was already executed recently, do not re-run
    if (proposal.id && executedProposalIdsMap.has(proposal.id)) {
      const lastTime = executedProposalIdsMap.get(proposal.id) || 0;
      if (Date.now() - lastTime < 60000) {
        return {
          success: true,
          message: `Thao tác đã được thực hiện trước đó: "${proposal.summary}"`,
        };
      }
    }

    switch (action) {
      case 'create_task': {
        let workspaceId = details.workspace_id;
        if (!workspaceId || workspaceId === 'auto' || workspaceId === 'current') {
          if (details.workspace_name) {
            const ws = appOps.db.workspaces.find((w) => w.name.toLowerCase().includes(details.workspace_name.toLowerCase()));
            if (ws) workspaceId = ws.id;
          }
          if (!workspaceId && executionContext?.lastCreatedWorkspaceId) {
            workspaceId = executionContext.lastCreatedWorkspaceId;
          }
          if (!workspaceId) {
            workspaceId = appOps.activeWorkspace?.id || appOps.db.workspaces[0]?.id;
          }
        }

        let divisionId = details.division_id;
        if (!divisionId || divisionId === 'auto' || divisionId === 'current') {
          if (details.division_name) {
            const div = appOps.db.divisions.find(
              (d) => (!workspaceId || d.workspace_id === workspaceId) && d.name.toLowerCase().includes(details.division_name.toLowerCase())
            );
            if (div) divisionId = div.id;
          }
          if (!divisionId && executionContext?.lastCreatedDivisionId) {
            divisionId = executionContext.lastCreatedDivisionId;
          }
          if (!divisionId) {
            const wsDivs = appOps.db.divisions.filter((d) => d.workspace_id === workspaceId);
            divisionId = (appOps.activeDivision?.workspace_id === workspaceId ? appOps.activeDivision?.id : null) || wsDivs[0]?.id || appOps.db.divisions[0]?.id;
          }
        }
        
        const divObj = appOps.db.divisions.find((d) => d.id === divisionId);

        let periodId =
          details.period_id ||
          divObj?.period_id ||
          executionContext?.lastCreatedPeriodId ||
          appOps.activePeriod?.id ||
          appOps.db.periods.find((p) => !workspaceId || p.workspace_id === workspaceId)?.id ||
          appOps.db.periods[0]?.id ||
          'p-default';

        if (!workspaceId || !divisionId) {
          return {
            success: false,
            message: 'Thiếu thông tin phòng hoặc phân chia để tạo task.',
          };
        }

        const resolved = resolveTargetCluster(
          divisionId,
          details,
          proposal.summary,
          target_name,
          appOps,
          executionContext
        );
        const clusterId = resolved.clusterId;

        if (!clusterId) {
          return {
            success: false,
            message: 'Không xác định được cụm/cột để đặt công việc.',
          };
        }

        // Keep details synchronized with resolved Board Mode & Column
        if (resolved.boardModeId) details.board_mode_id = resolved.boardModeId;
        if (resolved.boardModeName) details.board_mode_name = resolved.boardModeName;
        if (resolved.clusterName) details.cluster_name = resolved.clusterName;

        const taskTitle = (details.title || target_name || 'Nhiệm vụ mới').trim();
        const taskSignature = `${workspaceId}_${divisionId}_${clusterId}_${taskTitle.toLowerCase()}`;
        const now = Date.now();
        const lastCreatedTime = recentCreatedTasksMap.get(taskSignature);
        if (lastCreatedTime && now - lastCreatedTime < 8000) {
          // Task already created within the last 8 seconds!
          if (proposal.id) executedProposalIdsMap.set(proposal.id, now);
          return {
            success: true,
            message: `Công việc "${taskTitle}" đã được tạo thành công!`,
          };
        }

        recentCreatedTasksMap.set(taskSignature, now);

        const hasAlarm = Boolean(details.alarm_enabled || details.alarm_time || details.alarm_at);
        const alarmInfo = hasAlarm
          ? normalizeAlarmPayload(details.alarm_time, details.alarm_at, details.alarm_repeat)
          : null;

        appOps.createTask({
          title: taskTitle,
          description: details.description || '',
          priority: details.priority || 'medium',
          severity: 'normal',
          status: details.status || 'todo',
          workspace_id: workspaceId,
          period_id: periodId,
          division_id: divisionId,
          cluster_id: clusterId,
          mode_clusters: resolved.modeClustersData,
          sort_order: Date.now(),
          is_completed: details.status === 'done',
          is_archived: false,
          is_private: false,
          due_date: details.due_date || null,
          alarm_enabled: hasAlarm,
          alarm_time: alarmInfo?.alarm_time || null,
          alarm_at: alarmInfo?.alarm_at || null,
          alarm_repeat: alarmInfo?.alarm_repeat || 'none',
          alarm_triggered: false,
        });

        if (proposal.id) executedProposalIdsMap.set(proposal.id, now);

        return {
          success: true,
          message: `Đã tạo thành công công việc: "${taskTitle}" tại Chế độ: ${resolved.boardModeName || 'Kanban'} > Cột: ${resolved.clusterName}${
            alarmInfo ? ` (Hẹn giờ: ${alarmInfo.alarm_time})` : ''
          }`,
        };
      }

      case 'update_task': {
        const taskId = details.task_id;
        if (!taskId) {
          return { success: false, message: 'Không tìm thấy ID công việc cần cập nhật.' };
        }
        const updates: Partial<Task> = {};
        if (details.title) updates.title = details.title;
        if (details.description !== undefined) updates.description = details.description;
        if (details.priority) updates.priority = details.priority;
        if (details.status) {
          updates.status = details.status;
          updates.is_completed = details.status === 'done';
        }
        if (details.due_date !== undefined) updates.due_date = details.due_date;

        const currentTask = appOps.db.tasks.find((t) => t.id === taskId);
        const targetDivId = details.target_division_id || details.division_id;
        if (targetDivId && currentTask && targetDivId !== currentTask.division_id) {
          const targetDiv = appOps.db.divisions.find((d) => d.id === targetDivId);
          if (targetDiv) {
            updates.division_id = targetDiv.id;
            updates.period_id = targetDiv.period_id;
            updates.workspace_id = targetDiv.workspace_id;
          }
        }

        if (details.cluster_id || details.cluster_name || details.cluster_index !== undefined) {
          const divisionId = updates.division_id || details.division_id || currentTask?.division_id || appOps.activeDivision?.id || '';
          const resolved = resolveTargetCluster(divisionId, details, proposal.summary, target_name, appOps, executionContext);
          updates.cluster_id = resolved.clusterId;
          if (resolved.modeClustersData) {
            updates.mode_clusters = {
              ...(currentTask?.mode_clusters || {}),
              ...resolved.modeClustersData,
            };
          }
          if (resolved.boardModeId) details.board_mode_id = resolved.boardModeId;
          if (resolved.boardModeName) details.board_mode_name = resolved.boardModeName;
          if (resolved.clusterName) details.cluster_name = resolved.clusterName;
        }

        if (details.alarm_enabled !== undefined || details.alarm_time || details.alarm_at) {
          if (details.alarm_enabled === false) {
            updates.alarm_enabled = false;
          } else {
            const alarmData = normalizeAlarmPayload(details.alarm_time, details.alarm_at, details.alarm_repeat);
            updates.alarm_enabled = true;
            updates.alarm_time = alarmData.alarm_time;
            updates.alarm_at = alarmData.alarm_at;
            updates.alarm_repeat = alarmData.alarm_repeat;
            updates.alarm_triggered = false;
          }
        }

        appOps.updateTask(taskId, updates);
        return {
          success: true,
          message: `Đã cập nhật công việc: "${target_name || taskId}"`,
        };
      }

      case 'delete_task': {
        const taskId = details.task_id;
        if (!taskId) {
          return { success: false, message: 'Không tìm thấy ID công việc để xóa.' };
        }
        appOps.deleteTask(taskId);
        return {
          success: true,
          message: `Đã xóa công việc: "${target_name || taskId}"`,
        };
      }

      case 'set_alarm': {
        let taskId = details.task_id;
        if (!taskId && target_name) {
          const tLower = target_name.toLowerCase().trim();
          const clean = tLower.replace(/^["'“”]|["'“”]$/g, '').replace(/^(?:task|công\s*việc|việc)\s*/i, '').trim();
          const found = appOps.db.tasks.find(
            (t) =>
              t.id === target_name ||
              t.title.toLowerCase() === clean ||
              t.title.toLowerCase().includes(clean) ||
              clean.includes(t.title.toLowerCase())
          );
          if (found) taskId = found.id;
        }

        if (!taskId) {
          return { success: false, message: 'Không tìm thấy ID công việc để đặt báo thức.' };
        }

        if (details.alarm_enabled === false) {
          appOps.updateTask(taskId, {
            alarm_enabled: false,
            alarm_time: null,
            alarm_at: null,
            alarm_triggered: false,
          });
          if (typeof (appOps as any).dismissAlarm === 'function') {
            (appOps as any).dismissAlarm();
          }
          return {
            success: true,
            message: `Đã tắt/hủy báo thức cho "${target_name || 'công việc'}"`,
          };
        }

        const alarmData = normalizeAlarmPayload(details.alarm_time, details.alarm_at, details.alarm_repeat);

        appOps.updateTask(taskId, {
          alarm_enabled: true,
          alarm_time: alarmData.alarm_time,
          alarm_at: alarmData.alarm_at,
          alarm_repeat: alarmData.alarm_repeat,
          alarm_triggered: false,
        });

        return {
          success: true,
          message: `Đã hẹn giờ báo thức lúc ${alarmData.alarm_time} cho "${target_name || 'công việc'}"`,
        };
      }

      case 'cancel_alarm': {
        let taskId = details.task_id;
        if (!taskId && target_name) {
          const tLower = target_name.toLowerCase().trim();
          const clean = tLower.replace(/^["'“”]|["'“”]$/g, '').replace(/^(?:task|công\s*việc|việc)\s*/i, '').trim();
          const found = appOps.db.tasks.find(
            (t) =>
              t.id === target_name ||
              t.title.toLowerCase() === clean ||
              t.title.toLowerCase().includes(clean) ||
              clean.includes(t.title.toLowerCase())
          );
          if (found) taskId = found.id;
        }

        // If still not found and only 1 active task has alarm_enabled
        if (!taskId) {
          const tasksWithAlarm = appOps.db.tasks.filter((t) => t.alarm_enabled && !t.is_archived);
          if (tasksWithAlarm.length === 1) {
            taskId = tasksWithAlarm[0].id;
          }
        }

        if (!taskId) {
          return { success: false, message: 'Không tìm thấy ID hoặc tên công việc để tắt/hủy báo thức.' };
        }

        const taskObj = appOps.db.tasks.find((t) => t.id === taskId);

        appOps.updateTask(taskId, {
          alarm_enabled: false,
          alarm_time: null,
          alarm_at: null,
          alarm_triggered: false,
        });

        if (typeof (appOps as any).dismissAlarm === 'function') {
          (appOps as any).dismissAlarm();
        }

        return {
          success: true,
          message: `Đã tắt/hủy báo thức cho công việc "${taskObj?.title || target_name || taskId}"`,
        };
      }

      case 'move_task': {
        let taskId = details.task_id;
        if (!taskId && target_name) {
          const tLower = target_name.toLowerCase().trim();
          const clean = tLower.replace(/^["'“”]|["'“”]$/g, '').replace(/^(?:task|công\s*việc|việc)\s*/i, '').trim();
          const found = appOps.db.tasks.find(
            (t) =>
              t.id === target_name ||
              t.title.toLowerCase() === clean ||
              t.title.toLowerCase().includes(clean) ||
              clean.includes(t.title.toLowerCase())
          );
          if (found) taskId = found.id;
        }

        if (!taskId) {
          return { success: false, message: 'Không tìm thấy ID hoặc tên công việc để di chuyển.' };
        }

        const taskObj = appOps.db.tasks.find((t) => t.id === taskId);
        if (!taskObj) {
          return { success: false, message: `Không tìm thấy dữ liệu công việc "${target_name || taskId}".` };
        }

        // Find destination division
        const targetDivSearch = (
          details.target_division_id ||
          details.target_division_name ||
          details.division_id ||
          details.division_name ||
          ''
        )
          .toString()
          .toLowerCase()
          .trim();

        let targetDivision: Division | undefined = undefined;

        if (details.target_division_id) {
          targetDivision = appOps.db.divisions.find((d) => d.id === details.target_division_id);
        }

        if (!targetDivision && targetDivSearch) {
          const clean = targetDivSearch.replace(/^["'“”]|["'“”]$/g, '');
          const stripped = clean.replace(/^(?:division|phân\s*chia|divi|div)\s*/i, '').trim();

          targetDivision =
            appOps.db.divisions.find((d) => d.id === clean || d.id.toLowerCase() === clean) ||
            appOps.db.divisions.find((d) => d.name.toLowerCase() === clean) ||
            (stripped
              ? appOps.db.divisions.find(
                  (d) =>
                    d.name.toLowerCase() === stripped ||
                    d.name.toLowerCase() === `division ${stripped}` ||
                    d.name.toLowerCase() === `divi ${stripped}` ||
                    d.name.toLowerCase() === `phân chia ${stripped}` ||
                    d.name.toLowerCase().endsWith(` ${stripped}`)
                )
              : undefined);

          if (!targetDivision && stripped) {
            const num = parseInt(stripped, 10);
            if (!isNaN(num) && num > 0) {
              // Priority 1: Divisions in same period as task
              const periodDivs = appOps.db.divisions.filter((d) => d.period_id === taskObj.period_id);
              if (periodDivs[num - 1]) {
                targetDivision = periodDivs[num - 1];
              } else {
                // Priority 2: Divisions in same workspace
                const wsDivs = appOps.db.divisions.filter((d) => d.workspace_id === taskObj.workspace_id);
                if (wsDivs[num - 1]) {
                  targetDivision = wsDivs[num - 1];
                } else if (appOps.db.divisions[num - 1]) {
                  targetDivision = appOps.db.divisions[num - 1];
                }
              }
            }
          }

          if (!targetDivision) {
            targetDivision = appOps.db.divisions.find(
              (d) => d.name.toLowerCase().includes(clean) || clean.includes(d.name.toLowerCase())
            );
          }
        }

        // If target division still not resolved, but user said "sang divi khác", pick another division in the same period/workspace
        if (!targetDivision) {
          const siblingDivisions = appOps.db.divisions.filter(
            (d) =>
              d.id !== taskObj.division_id &&
              (d.period_id === taskObj.period_id || d.workspace_id === taskObj.workspace_id)
          );
          if (siblingDivisions.length > 0) {
            targetDivision = siblingDivisions[0];
          }
        }

        if (!targetDivision) {
          return {
            success: false,
            message: `Không tìm thấy phân chia (division) đích phù hợp để di chuyển công việc.`,
          };
        }

        // Resolve destination column/cluster and board mode accurately
        const resolvedTarget = resolveTargetCluster(
          targetDivision.id,
          {
            cluster_id: details.target_cluster_id || details.cluster_id,
            cluster_name: details.target_cluster_name || details.cluster_name,
            cluster_index: details.cluster_index,
            board_mode_id: details.target_board_mode_id || details.board_mode_id,
          },
          proposal.summary,
          target_name,
          appOps,
          executionContext
        );

        const finalClusterId = resolvedTarget.clusterId;
        const finalClusterName = resolvedTarget.clusterName;
        if (resolvedTarget.boardModeId) {
          details.target_board_mode_id = resolvedTarget.boardModeId;
          details.board_mode_id = resolvedTarget.boardModeId;
        }
        if (resolvedTarget.boardModeName) {
          details.target_board_mode_name = resolvedTarget.boardModeName;
          details.board_mode_name = resolvedTarget.boardModeName;
        }
        details.target_cluster_name = finalClusterName;
        details.cluster_name = finalClusterName;

        const oldDivObj = appOps.db.divisions.find((d) => d.id === taskObj.division_id);
        const oldDivName = oldDivObj?.name || 'Phân chia hiện tại';

        const taskUpdates: Partial<Task> = {
          division_id: targetDivision.id,
          period_id: targetDivision.period_id,
          workspace_id: targetDivision.workspace_id,
          cluster_id: finalClusterId,
          ...(resolvedTarget.modeClustersData
            ? {
                mode_clusters: {
                  ...(taskObj.mode_clusters || {}),
                  ...resolvedTarget.modeClustersData,
                },
              }
            : {}),
        };

        appOps.updateTask(taskId, taskUpdates);

        return {
          success: true,
          message: `Đã di chuyển công việc "${taskObj.title}" từ "${oldDivName}" sang "${targetDivision.name}" [Chế độ: ${resolvedTarget.boardModeName || 'Kanban'}] (Cột: ${finalClusterName})`,
        };
      }

      case 'create_cluster': {
        const divisionId =
          details.division_id || appOps.activeDivision?.id || appOps.db.divisions[0]?.id;
        if (!divisionId) {
          return { success: false, message: 'Chưa xác định được phân chia chứa cụm này.' };
        }

        appOps.createCluster({
          name: details.name || target_name || 'Cụm mới',
          description: details.description || '',
          color: details.color || '#6366f1',
          icon: 'Folder',
          division_id: divisionId,
          sort_order: Date.now(),
          is_collapsed: false,
        });

        return {
          success: true,
          message: `Đã tạo cụm việc mới: "${details.name || target_name}"`,
        };
      }

      case 'update_cluster': {
        const clusterId = details.cluster_id;
        if (!clusterId) {
          return { success: false, message: 'Không tìm thấy ID cụm cần sửa.' };
        }
        appOps.updateCluster(clusterId, {
          name: details.name || target_name,
          color: details.color,
          description: details.description,
        });
        return {
          success: true,
          message: `Đã cập nhật cụm: "${target_name || clusterId}"`,
        };
      }

      case 'delete_cluster': {
        const clusterId = details.cluster_id;
        if (!clusterId) {
          return { success: false, message: 'Không tìm thấy ID cụm cần xóa.' };
        }
        appOps.deleteCluster(clusterId);
        return {
          success: true,
          message: `Đã xóa cụm: "${target_name || clusterId}"`,
        };
      }

      case 'create_division': {
        let workspaceId = details.workspace_id;
        
        if (!workspaceId || workspaceId === 'auto' || workspaceId === 'current') {
          if (details.workspace_name) {
            const ws = appOps.db.workspaces.find((w) => w.name.toLowerCase().includes(details.workspace_name.toLowerCase()));
            if (ws) workspaceId = ws.id;
          }
          if (!workspaceId && executionContext?.lastCreatedWorkspaceId) {
            workspaceId = executionContext.lastCreatedWorkspaceId;
          }
          if (!workspaceId) {
            workspaceId = appOps.activeWorkspace?.id || appOps.db.workspaces[appOps.db.workspaces.length - 1]?.id || 'ws-default';
          }
        } else {
          // Check if workspaceId is actually a name or ID
          const direct = appOps.db.workspaces.find((w) => w.id === workspaceId);
          if (!direct) {
            const byName = appOps.db.workspaces.find((w) => w.name.toLowerCase().includes(workspaceId.toLowerCase()));
            if (byName) {
              workspaceId = byName.id;
            } else if (executionContext?.lastCreatedWorkspaceId) {
              workspaceId = executionContext.lastCreatedWorkspaceId;
            } else {
              workspaceId = appOps.activeWorkspace?.id || appOps.db.workspaces[0]?.id;
            }
          }
        }

        if (!workspaceId) {
          return { success: false, message: 'Chưa có phòng làm việc hiện tại.' };
        }

        let periodId = details.period_id;
        if (!periodId || !appOps.db.periods.some((p) => p.id === periodId && p.workspace_id === workspaceId)) {
          const wsPeriod = appOps.db.periods.find((p) => p.workspace_id === workspaceId && !p.is_archived);
          if (wsPeriod) {
            periodId = wsPeriod.id;
          } else if (executionContext?.lastCreatedPeriodId) {
            periodId = executionContext.lastCreatedPeriodId;
          }
        }

        const divName = details.name || target_name || 'Phân chia mới';
        const createdDiv = appOps.createDivision({
          name: divName,
          description: details.description || '',
          workspace_id: workspaceId,
          period_id: periodId,
          visibility: details.visibility || 'public',
          layout_type: details.layout_type || 'full',
          color: details.color || '#3b82f6',
          icon: details.icon || 'Layout',
          sort_order: Date.now(),
          is_default: false,
        });

        if (executionContext && createdDiv) {
          executionContext.lastCreatedDivisionId = createdDiv.id;
          if (executionContext.divisionMap) {
            executionContext.divisionMap.set(divName.toLowerCase(), createdDiv.id);
          }
        }

        if (appOps.setActiveDivisionId && createdDiv) {
          appOps.setActiveDivisionId(createdDiv.id);
        }

        return {
          success: true,
          message: `Đã tạo phân chia mới: "${divName}"`,
        };
      }

      case 'update_division': {
        const divisionId = details.division_id;
        if (!divisionId) {
          return { success: false, message: 'Không tìm thấy ID phân chia cần sửa.' };
        }
        appOps.updateDivision(divisionId, {
          name: details.name || target_name,
        });
        return {
          success: true,
          message: `Đã cập nhật phân chia: "${target_name || divisionId}"`,
        };
      }

      case 'delete_division': {
        const divisionId = details.division_id;
        if (!divisionId) {
          return { success: false, message: 'Không tìm thấy ID phân chia cần xóa.' };
        }
        appOps.deleteDivision(divisionId);
        return {
          success: true,
          message: `Đã xóa phân chia: "${target_name || divisionId}"`,
        };
      }

      case 'create_period': {
        let workspaceId = details.workspace_id;
        if (!workspaceId || workspaceId === 'auto') {
          if (details.workspace_name) {
            const ws = appOps.db.workspaces.find((w) => w.name.toLowerCase().includes(details.workspace_name.toLowerCase()));
            if (ws) workspaceId = ws.id;
          }
          if (!workspaceId && executionContext?.lastCreatedWorkspaceId) {
            workspaceId = executionContext.lastCreatedWorkspaceId;
          }
          if (!workspaceId) {
            workspaceId = appOps.activeWorkspace?.id || appOps.db.workspaces[0]?.id;
          }
        }

        if (!workspaceId) {
          return { success: false, message: 'Chưa có phòng làm việc hiện tại.' };
        }
        const name = details.name || target_name || 'Period mới';
        const newPeriod = appOps.createPeriod({
          name,
          workspace_id: workspaceId,
          type: details.type || 'month',
          start_date: details.start_date || new Date().toISOString().split('T')[0],
          end_date: details.end_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          timezone: 'Asia/Ho_Chi_Minh',
          color: details.color || '#3b82f6',
          sort_order: Date.now(),
          is_archived: false,
        });

        if (executionContext && newPeriod) {
          executionContext.lastCreatedPeriodId = newPeriod.id;
        }
        if (appOps.setActivePeriodId && newPeriod) {
          appOps.setActivePeriodId(newPeriod.id);
        }

        return {
          success: true,
          message: `Đã tạo chu kỳ (Period) mới: "${name}"`,
        };
      }

      case 'update_period': {
        let periodId = details.period_id;
        const targetSearch = (periodId || details.name || target_name || '').toLowerCase().trim();
        if (!periodId || !appOps.db.periods.some((p) => p.id === periodId)) {
          const clean = targetSearch.replace(/^["'“”]|["'“”]$/g, '');
          const stripped = clean.replace(/^(?:period|chu\s*kỳ|giai\s*đoạn)\s*/i, '').trim();

          const found =
            appOps.db.periods.find((p) => p.id === clean || p.id.toLowerCase() === clean) ||
            appOps.db.periods.find((p) => p.name.toLowerCase() === clean) ||
            (stripped
              ? appOps.db.periods.find(
                  (p) =>
                    p.name.toLowerCase() === stripped ||
                    p.name.toLowerCase() === `period ${stripped}` ||
                    p.name.toLowerCase() === `chu kỳ ${stripped}` ||
                    p.name.toLowerCase().endsWith(` ${stripped}`)
                )
              : null) ||
            appOps.db.periods.find((p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()));

          if (found) {
            periodId = found.id;
          } else {
            const num = parseInt(stripped || clean, 10);
            if (!isNaN(num) && num > 0 && num <= appOps.db.periods.length) {
              periodId = appOps.db.periods[num - 1].id;
            }
          }
        }
        if (!periodId) {
          return { success: false, message: 'Không tìm thấy ID hoặc tên chu kỳ (Period) cần sửa.' };
        }
        appOps.updatePeriod(periodId, {
          name: details.name || target_name,
          color: details.color,
        });
        return {
          success: true,
          message: `Đã cập nhật chu kỳ (Period): "${details.name || target_name || periodId}"`,
        };
      }

      case 'delete_period': {
        let periodId = details.period_id;
        const targetSearch = (periodId || details.name || target_name || '').toLowerCase().trim();
        if (!periodId || !appOps.db.periods.some((p) => p.id === periodId)) {
          const clean = targetSearch.replace(/^["'“”]|["'“”]$/g, '');
          const stripped = clean.replace(/^(?:period|chu\s*kỳ|giai\s*đoạn)\s*/i, '').trim();

          const found =
            appOps.db.periods.find((p) => p.id === clean || p.id.toLowerCase() === clean) ||
            appOps.db.periods.find((p) => p.name.toLowerCase() === clean) ||
            (stripped
              ? appOps.db.periods.find(
                  (p) =>
                    p.name.toLowerCase() === stripped ||
                    p.name.toLowerCase() === `period ${stripped}` ||
                    p.name.toLowerCase() === `chu kỳ ${stripped}` ||
                    p.name.toLowerCase().endsWith(` ${stripped}`)
                )
              : null) ||
            appOps.db.periods.find((p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()));

          if (found) {
            periodId = found.id;
          } else {
            const num = parseInt(stripped || clean, 10);
            if (!isNaN(num) && num > 0 && num <= appOps.db.periods.length) {
              periodId = appOps.db.periods[num - 1].id;
            }
          }
        }
        if (!periodId) {
          return { success: false, message: 'Không tìm thấy ID hoặc tên chu kỳ (Period) cần xóa.' };
        }
        const periodName = appOps.db.periods.find((p) => p.id === periodId)?.name || target_name || periodId;
        appOps.deletePeriod(periodId);
        return {
          success: true,
          message: `Đã xóa hẳn chu kỳ (Period): "${periodName}" cùng toàn bộ phân chia và công việc trực thuộc.`,
        };
      }

      case 'create_workspace': {
        const name = details.name || target_name || 'Phòng làm việc mới';
        const newWs = appOps.createWorkspace(
          name,
          details.description || '',
          details.icon || 'Briefcase',
          details.color || '#6366f1'
        );
        if (executionContext && newWs) {
          executionContext.lastCreatedWorkspaceId = newWs.id;
          if (executionContext.workspaceMap) {
            executionContext.workspaceMap.set(name.toLowerCase(), newWs.id);
          }
        }
        if (appOps.setActiveWorkspaceId && newWs) {
          appOps.setActiveWorkspaceId(newWs.id);
        }
        return {
          success: true,
          message: `Đã tạo phòng làm việc mới: "${name}"`,
        };
      }

      case 'update_workspace': {
        const workspaceId = details.workspace_id || appOps.activeWorkspace?.id;
        if (!workspaceId) {
          return { success: false, message: 'Không tìm thấy ID phòng cần sửa.' };
        }
        appOps.updateWorkspace(workspaceId, {
          name: details.name || target_name,
          description: details.description,
        });
        return {
          success: true,
          message: `Đã cập nhật phòng: "${target_name || workspaceId}"`,
        };
      }

      case 'delete_workspace': {
        const workspaceId = details.workspace_id;
        if (!workspaceId) {
          return { success: false, message: 'Không tìm thấy ID phòng cần xóa.' };
        }
        appOps.deleteWorkspace(workspaceId);
        return {
          success: true,
          message: `Đã xóa phòng: "${target_name || workspaceId}"`,
        };
      }

      case 'create_board_mode': {
        if (!appOps.createBoardMode) {
          return { success: false, message: 'Chức năng tạo chế độ bảng không khả dụng.' };
        }
        let divisionId = details.division_id;
        if (!divisionId || divisionId === 'auto' || divisionId === 'current') {
          if (details.division_name) {
            const div = appOps.db.divisions.find((d) => d.name.toLowerCase().includes(details.division_name.toLowerCase()));
            if (div) divisionId = div.id;
          }
          if (!divisionId && executionContext?.lastCreatedDivisionId) {
            divisionId = executionContext.lastCreatedDivisionId;
          }
          if (!divisionId) {
            divisionId = appOps.activeDivision?.id || appOps.db.divisions[0]?.id;
          }
        }

        if (!divisionId) {
          return { success: false, message: 'Chưa có Phân chia (Division) để gắn Chế độ bảng.' };
        }

        const modeName = details.name || target_name || 'Kanban Tiến độ';
        const rawClusters = details.clusters;
        let finalClusters: any[] = [];
        const timestamp = Date.now();
        if (Array.isArray(rawClusters) && rawClusters.length > 0) {
          finalClusters = rawClusters.map((c: any, idx: number) => {
            if (typeof c === 'string') {
              return {
                id: `c-${timestamp}-${idx + 1}`,
                name: c,
                color: idx === 0 ? '#6366F1' : idx === 1 ? '#F59E0B' : idx === 2 ? '#8B5CF6' : '#10B981',
                sort_order: idx + 1,
              };
            }
            return {
              id: c.id || `c-${timestamp}-${idx + 1}`,
              name: c.name || `Cột ${idx + 1}`,
              color: c.color || (idx === 0 ? '#6366F1' : idx === 1 ? '#F59E0B' : idx === 2 ? '#8B5CF6' : '#10B981'),
              sort_order: c.sort_order ?? idx + 1,
            };
          });
        } else {
          finalClusters = [
            { id: `c-${timestamp}-1`, name: 'Cần làm', color: '#6366F1', sort_order: 1 },
            { id: `c-${timestamp}-2`, name: 'Đang làm', color: '#F59E0B', sort_order: 2 },
            { id: `c-${timestamp}-3`, name: 'Kiểm thử', color: '#8B5CF6', sort_order: 3 },
            { id: `c-${timestamp}-4`, name: 'Hoàn thành', color: '#10B981', sort_order: 4 },
          ];
        }

        const newMode = appOps.createBoardMode(
          modeName,
          details.description || '',
          finalClusters,
          divisionId
        );

        if (executionContext && newMode) {
          executionContext.lastCreatedBoardModeId = newMode.id;
          executionContext.boardModeClusters = newMode.clusters;
        }
        if (appOps.setActiveBoardModeId && newMode) {
          appOps.setActiveBoardModeId(newMode.id);
        }

        return {
          success: true,
          message: `Đã tạo Chế độ bảng mới: "${modeName}" với ${finalClusters.length} cụm cột theo dõi.`,
        };
      }

      case 'update_board_mode': {
        if (!appOps.updateBoardMode) {
          return { success: false, message: 'Chức năng cập nhật chế độ bảng không khả dụng.' };
        }
        const modeId = details.board_mode_id || details.mode_id || appOps.activeBoardModeId;
        if (!modeId) {
          return { success: false, message: 'Không tìm thấy ID chế độ bảng cần sửa.' };
        }
        appOps.updateBoardMode(modeId, {
          name: details.name || target_name,
          description: details.description,
        });
        return {
          success: true,
          message: `Đã cập nhật Chế độ bảng: "${details.name || target_name || modeId}"`,
        };
      }

      case 'delete_board_mode': {
        if (!appOps.deleteBoardMode) {
          return { success: false, message: 'Chức năng xóa chế độ bảng không khả dụng.' };
        }
        const modeId = details.board_mode_id || details.mode_id;
        if (!modeId) {
          return { success: false, message: 'Không tìm thấy ID chế độ bảng cần xóa.' };
        }
        appOps.deleteBoardMode(modeId);
        return {
          success: true,
          message: `Đã xóa Chế độ bảng: "${target_name || modeId}"`,
        };
      }

      default:
        return {
          success: false,
          message: `Hành động chưa được hỗ trợ: ${action}`,
        };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi thực thi: ${err.message || 'Không thể thực hiện'}`,
    };
  }
}
