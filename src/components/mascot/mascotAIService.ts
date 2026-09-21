import { ActionProposal, MascotAISettings, MascotChatMessage } from './mascotAITypes';
import { MascotPersona } from './mascotPersonas';
import { Task, Cluster, Division, Workspace, Period } from '../../types';
import { DatabaseState } from '../../services/storage';
import { normalizeAlarmPayload } from './mascotActionExecutor';

export interface MascotContextPayload {
  current_time: string;
  active_workspace: { id: string; name: string } | null;
  active_period: { id: string; name: string; workspace_id?: string } | null;
  active_division: { id: string; name: string; period_id?: string; workspace_id?: string } | null;
  active_board_mode?: { id: string; name: string };
  active_division_has_board_mode: boolean;
  active_division_board_modes: Array<{ id: string; name: string; clusters: string[] }>;
  board_modes: Array<{ id: string; name: string; division_id?: string; clusters: Array<{ id: string; name: string }> }>;
  active_clusters?: Array<{
    index: number;
    id: string;
    name: string;
    division_id?: string;
    aliases: string[];
  }>;
  workspaces: Array<{ id: string; name: string }>;
  periods: Array<{
    id: string;
    name: string;
    workspace_id: string;
    index?: number;
    division_count?: number;
    task_count?: number;
  }>;
  divisions: Array<{ id: string; name: string; period_id: string; workspace_id: string }>;
  clusters: Array<{ id: string; name: string; division_id: string; sort_order?: number }>;
  tasks: Array<{
    id: string;
    title: string;
    cluster_id: string;
    division_id: string;
    workspace_id?: string;
    workspace_name?: string;
    division_name?: string;
    cluster_name?: string;
    priority: string;
    status: string;
    due_date?: string | null;
    alarm_enabled?: boolean;
    alarm_time?: string | null;
    alarm_at?: string | null;
    alarm_repeat?: 'none' | 'daily' | 'weekly';
  }>;
}

export function buildContextPayload(
  db: DatabaseState,
  activeWorkspace: Workspace | null,
  activePeriod: Period | null,
  activeDivision: Division | null,
  activeBoardModeId?: string
): MascotContextPayload {
  const currentWsId = activeWorkspace?.id;

  const filteredPeriods = db.periods
    .filter((p) => !currentWsId || p.workspace_id === currentWsId)
    .map((p, idx) => {
      const pDivs = db.divisions.filter((d) => d.period_id === p.id);
      const pTasks = db.tasks.filter((t) => t.period_id === p.id && !t.is_archived);
      return {
        id: p.id,
        name: p.name,
        workspace_id: p.workspace_id,
        index: idx + 1,
        division_count: pDivs.length,
        task_count: pTasks.length,
      };
    });

  const currentPeriodId = activePeriod?.id || filteredPeriods[0]?.id;

  const filteredDivisions = db.divisions
    .filter(
      (d) =>
        (!currentWsId || d.workspace_id === currentWsId) &&
        (!currentPeriodId || d.period_id === currentPeriodId)
    )
    .map((d) => ({
      id: d.id,
      name: d.name,
      period_id: d.period_id,
      workspace_id: d.workspace_id,
    }));

  const allWorkspaceDivisions = db.divisions
    .filter((d) => !currentWsId || d.workspace_id === currentWsId)
    .map((d) => ({
      id: d.id,
      name: d.name,
      period_id: d.period_id,
      workspace_id: d.workspace_id,
    }));

  const effectiveDiv =
    activeDivision ||
    filteredDivisions.find((d) => d.id === activeDivision?.id) ||
    filteredDivisions[0] ||
    db.divisions[0] ||
    null;
  const effectiveDivId = effectiveDiv?.id;

  const divIds = new Set(filteredDivisions.map((d) => d.id));

  // Determine active board mode and visible clusters on screen
  const allBoardModes = db.board_modes || [];
  const availableBoardModes = allBoardModes.filter(
    (m) => m.is_preset || (effectiveDivId && m.division_id === effectiveDivId)
  );
  const activeBoardMode =
    availableBoardModes.find((m) => m.id === activeBoardModeId) ||
    availableBoardModes[0] ||
    null;

  const isKanban = !activeBoardMode || activeBoardMode.id === 'kanban';

  // Clusters for active division in Kanban
  const divClusters = db.clusters
    .filter((c) => !effectiveDivId || c.division_id === effectiveDivId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  let visibleBoardClusters: Array<{ id: string; name: string; division_id?: string }> = [];
  if (isKanban || !activeBoardMode?.clusters || activeBoardMode.clusters.length === 0) {
    visibleBoardClusters = divClusters.map((c) => ({
      id: c.id,
      name: c.name,
      division_id: c.division_id,
    }));
  } else {
    visibleBoardClusters = (activeBoardMode.clusters || []).map((c) => ({
      id: c.id,
      name: c.name,
      division_id: effectiveDivId || '',
    }));
  }

  // Active clusters with 1-based index (Index 1 = Cụm 1/Cột 1, Index 2 = Cụm 2/Cột 2)
  const activeClustersWithIndex = visibleBoardClusters.map((c, idx) => ({
    index: idx + 1,
    id: c.id,
    name: c.name || `Cụm ${idx + 1}`,
    division_id: c.division_id || effectiveDivId || '',
    aliases: [
      `cụm ${idx + 1}`,
      `cột ${idx + 1}`,
      `cụm thứ ${idx + 1}`,
      `cột thứ ${idx + 1}`,
      (c.name || '').toLowerCase().trim(),
    ],
  }));

  const filteredClusters = db.clusters
    .filter((c) => divIds.size === 0 || divIds.has(c.division_id))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((c) => ({
      id: c.id,
      name: c.name,
      division_id: c.division_id,
      sort_order: c.sort_order,
    }));

  const workspaceMap = new Map(db.workspaces.map((w) => [w.id, w.name]));
  const divisionMap = new Map(db.divisions.map((d) => [d.id, d.name]));
  const clusterMap = new Map(db.clusters.map((c) => [c.id, c.name]));

  // Include active tasks from current workspace first, followed by others, up to 150 tasks
  const allUnarchivedTasks = db.tasks.filter((t) => !t.is_archived);
  const sortedTasks = [...allUnarchivedTasks].sort((a, b) => {
    const aCurrent = a.workspace_id === currentWsId;
    const bCurrent = b.workspace_id === currentWsId;
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
  });

  const filteredTasks = sortedTasks.slice(0, 150).map((t) => ({
    id: t.id,
    title: t.title,
    cluster_id: t.cluster_id,
    division_id: t.division_id,
    workspace_id: t.workspace_id,
    workspace_name: workspaceMap.get(t.workspace_id) || '',
    division_name: divisionMap.get(t.division_id) || '',
    cluster_name: clusterMap.get(t.cluster_id) || '',
    priority: t.priority,
    status: t.status,
    due_date: t.due_date,
    alarm_enabled: t.alarm_enabled,
    alarm_time: t.alarm_time,
    alarm_at: t.alarm_at,
    alarm_repeat: t.alarm_repeat,
  }));

  return {
    current_time: new Date().toLocaleString('vi-VN'),
    active_workspace: activeWorkspace
      ? { id: activeWorkspace.id, name: activeWorkspace.name }
      : db.workspaces[0]
      ? { id: db.workspaces[0].id, name: db.workspaces[0].name }
      : null,
    active_period: activePeriod
      ? { id: activePeriod.id, name: activePeriod.name }
      : filteredPeriods[0]
      ? { id: filteredPeriods[0].id, name: filteredPeriods[0].name }
      : null,
    active_division: effectiveDiv
      ? { id: effectiveDiv.id, name: effectiveDiv.name }
      : null,
    active_board_mode: activeBoardMode
      ? { id: activeBoardMode.id, name: activeBoardMode.name }
      : { id: 'kanban', name: 'Kanban' },
    active_division_has_board_mode: (db.board_modes || []).some(
      (m) => effectiveDivId && m.division_id === effectiveDivId
    ),
    active_division_board_modes: (db.board_modes || [])
      .filter((m) => effectiveDivId && m.division_id === effectiveDivId)
      .map((m) => ({
        id: m.id,
        name: m.name,
        clusters: (m.clusters || []).map((c) => c.name),
      })),
    board_modes: (db.board_modes || []).map((m) => ({
      id: m.id,
      name: m.name,
      division_id: m.division_id,
      clusters: (m.clusters || []).map((c) => ({ id: c.id, name: c.name })),
    })),
    active_clusters: activeClustersWithIndex,
    workspaces: db.workspaces.map((w) => ({ id: w.id, name: w.name })),
    periods: filteredPeriods,
    divisions:
      allWorkspaceDivisions.length > 0
        ? allWorkspaceDivisions
        : filteredDivisions.length > 0
        ? filteredDivisions
        : db.divisions.map((d) => ({
            id: d.id,
            name: d.name,
            period_id: d.period_id,
            workspace_id: d.workspace_id,
          })),
    clusters: filteredClusters,
    tasks: filteredTasks,
  };
}

/**
 * Local rule-based fallback parser when offline or when no API key is provided
 */
export function parseLocalIntent(
  text: string,
  context: MascotContextPayload,
  persona: MascotPersona
): { reply: string; proposals: ActionProposal[] } {
  const effectiveText = text
    .replace(/^(?:kêu\s+(?:nó|em|bạn)|bảo\s+(?:nó|em|bạn)|nhờ\s+(?:mascot|ai|em|bạn)|hãy|làm\s+ơn|yêu\s+cầu|giúp\s+(?:mình|tôi))\s+/i, '')
    .trim();
  const lower = effectiveText.toLowerCase().trim();
  const proposals: ActionProposal[] = [];

  const hasActionKeyword =
    /(?:tạo|thêm|xóa|sửa|cập\s*nhật|đặt\s*báo\s*thức|tắt\s*báo\s*thức|hủy\s*báo\s*thức|tắt\s*chuông|hủy\s*chuông|hủy\s*hẹn\s*giờ|tắt\s*hẹn\s*giờ|chuyển|di\s*chuyển|dời|đưa|đổi|move)\b/i.test(
      lower
    );

  // Check if this is a conversational question, casual greeting, or thinking out loud (Branch 1)
  const isQuestionOrChat =
    !hasActionKeyword &&
    (lower.endsWith('?') ||
      lower.endsWith('nhỉ') ||
      lower.endsWith('không') ||
      lower.startsWith('chào') ||
      lower.startsWith('hi ') ||
      lower.startsWith('hello') ||
      lower.includes('thế nào') ||
      lower.includes('như thế nào') ||
      lower.includes('là gì') ||
      lower.includes('có nên') ||
      lower.includes('tại sao') ||
      lower.includes('giải thích') ||
      lower.includes('hôm nay mệt') ||
      lower.includes('áp lực') ||
      lower.includes('buồn quá'));

  if (isQuestionOrChat) {
    // Branch 1: Return persona conversation without creating proposals
    if (lower.includes('mệt') || lower.includes('áp lực') || lower.includes('buồn')) {
      return {
        reply: `Tôi hiểu cảm giác này của bạn. Hãy tạm buông chuột, hít thở sâu 3 nhịp và uống một ngụm nước ấm nhé. Khi nào sẵn sàng, tôi sẽ cùng bạn gỡ rối từng đầu việc một.`,
        proposals: [],
      };
    }
    if (lower.startsWith('chào') || lower.startsWith('hi') || lower.startsWith('hello')) {
      return {
        reply: `Chào bạn! Tôi là ${persona.name} (${persona.tagline}). Hôm nay bạn cần tôi lắng nghe, tâm sự hay hỗ trợ sắp xếp công việc nào?`,
        proposals: [],
      };
    }
    return {
      reply: `Tôi là ${persona.name}. Cứ chia sẻ thoải mái hoặc đặt câu hỏi, tôi luôn ở đây để đồng hành cùng bạn. Khi nào bạn cần ra lệnh tạo/sửa việc cụ thể, tôi sẽ lập đề xuất để bạn duyệt nhé!`,
      proposals: [],
    };
  }

  // Branch 2: Search & Retrieval (Find tasks / periods / divisions / list tasks)
  // Branch 2.1: Period Search & List
  const isPeriodSearch =
    /(?:tìm|tra\s*cứu|kiếm|search|danh\s*sách|xem|liệt\s*kê|list|show)\s+(?:các\s+)?(?:chu\s*kỳ|period|giai\s*đoạn)\b/i.test(text) ||
    /^(?:chu\s*kỳ|period|giai\s*đoạn)\s*(?:nào|gì)?\??$/i.test(text) ||
    /(?:có\s+(?:những\s+)?(?:chu\s*kỳ|period|giai\s*đoạn)\s+nào)/i.test(text);

  if (isPeriodSearch) {
    const pMatch = text.match(/(?:chu\s*kỳ|period|giai\s*đoạn)\s*["'“]?([^"'\n?]+?)["'”]?\s*\??$/i);
    const rawTarget = pMatch ? pMatch[1].trim().toLowerCase() : '';
    let foundPeriods = context.periods;
    if (rawTarget && !['nào', 'gì', 'các', 'danh sách', 'hiện có'].includes(rawTarget)) {
      foundPeriods = foundPeriods.filter(
        (p) =>
          p.name.toLowerCase().includes(rawTarget) ||
          p.id.toLowerCase().includes(rawTarget) ||
          (p.index && String(p.index) === rawTarget) ||
          `period ${p.index}` === rawTarget ||
          `chu kỳ ${p.index}` === rawTarget
      );
    }

    if (foundPeriods.length > 0) {
      let reply = `📅 **DANH SÁCH ${foundPeriods.length} CHU KỲ (PERIOD) TRONG PHÒNG:**\n\n`;
      foundPeriods.forEach((p, idx) => {
        const isCurrent = context.active_period?.id === p.id ? ' ⭐ *(Đang chọn)*' : '';
        reply += `${idx + 1}. **${p.name}**${isCurrent}\n`;
        reply += `   🆔 ID: \`${p.id}\` | 📂 Phân chia: ${p.division_count || 0} | 📋 Công việc: ${p.task_count || 0}\n\n`;
      });
      reply += `💡 *Gợi ý thao tác:* "Xóa hẳn ${foundPeriods[0].name}", "Tạo period mới [tên]", hoặc "Sửa tên ${foundPeriods[0].name}".`;
      return { reply, proposals: [] };
    } else {
      return {
        reply: `Không tìm thấy chu kỳ (Period) nào phù hợp với từ khóa "${rawTarget}". Bạn có thể tạo chu kỳ mới bằng cách yêu cầu: "Tạo period [tên]".`,
        proposals: [],
      };
    }
  }

  // Branch 2.2: Division Search & List
  const isDivisionSearch =
    /(?:tìm|tra\s*cứu|kiếm|search|danh\s*sách|xem|liệt\s*kê|list|show)\s+(?:các\s+)?(?:phân\s*chia|division|nhóm\s*việc)\b/i.test(text) ||
    /^(?:phân\s*chia|division|nhóm\s*việc)\s*(?:nào|gì)?\??$/i.test(text);

  if (isDivisionSearch) {
    const dMatch = text.match(/(?:phân\s*chia|division|nhóm\s*việc)\s*["'“]?([^"'\n?]+?)["'”]?\s*\??$/i);
    const rawTarget = dMatch ? dMatch[1].trim().toLowerCase() : '';
    let foundDivs = context.divisions;
    if (rawTarget && !['nào', 'gì', 'các', 'danh sách', 'hiện có'].includes(rawTarget)) {
      foundDivs = foundDivs.filter(
        (d) => d.name.toLowerCase().includes(rawTarget) || d.id.toLowerCase().includes(rawTarget)
      );
    }
    if (foundDivs.length > 0) {
      let reply = `🗂️ **DANH SÁCH ${foundDivs.length} PHÂN CHIA (DIVISION):**\n\n`;
      foundDivs.forEach((d, idx) => {
        const isCurrent = context.active_division?.id === d.id ? ' ⭐ *(Đang chọn)*' : '';
        reply += `${idx + 1}. **${d.name}**${isCurrent}\n`;
        reply += `   🆔 ID: \`${d.id}\`\n\n`;
      });
      reply += `💡 *Gợi ý thao tác:* "Xóa division [tên]" hoặc "Tạo division mới [tên]".`;
      return { reply, proposals: [] };
    } else {
      return {
        reply: `Không tìm thấy phân chia (Division) nào phù hợp với từ khóa "${rawTarget}". Bạn có thể ra lệnh: "Tạo division mới [tên]".`,
        proposals: [],
      };
    }
  }

  // Branch 2.3: Task Search & Retrieval (Find tasks / List tasks) - Returns ALL relevant candidates, NOT just top 1!
  const searchMatch =
    text.match(/(?:tìm|tra\s*cứu|kiếm|search)\s*(?:kiếm\s*)?(?:task|công\s*việc|nhiệm\s*vụ|việc)?\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i) ||
    text.match(/(?:có\s+(?:task|công\s+việc|việc)\s+nào\s+(?:về|liên\s+quan|tên\s+là|chứa)?\s*)["'“]?([^"'\n?]+?)["'”]?\s*\??$/i);

  const isListTasksIntent =
    /(?:danh\s+sách|xem|liệt\s+kê|show|list)\s+(?:các\s+)?(?:task|công\s+việc|việc)\b/i.test(text) ||
    /(?:xem|danh\s+sách|kiểm\s+tra)\s+(?:báo\s+thức|chuông|hẹn\s+giờ)\b/i.test(text);

  if (searchMatch || isListTasksIntent) {
    let rawQuery = searchMatch ? searchMatch[1].trim() : '';
    const isAlarmFilter = /(?:báo\s+thức|chuông|hẹn\s+giờ)/i.test(text);

    let candidateTasks = context.tasks;

    if (isAlarmFilter) {
      candidateTasks = candidateTasks.filter((t) => t.alarm_enabled);
    }

    if (rawQuery) {
      const qLower = rawQuery.toLowerCase();
      const qWords = qLower.split(/\s+/).filter(Boolean);

      const scored = candidateTasks.map((t) => {
        let score = 0;
        const titleLower = t.title.toLowerCase();
        if (titleLower === qLower) score += 100;
        else if (titleLower.includes(qLower)) score += 60;
        else {
          const matchedWords = qWords.filter((w) => titleLower.includes(w)).length;
          if (matchedWords > 0) score += (matchedWords / qWords.length) * 40;
        }

        if (t.cluster_name && t.cluster_name.toLowerCase().includes(qLower)) score += 20;
        if (t.division_name && t.division_name.toLowerCase().includes(qLower)) score += 15;
        if (t.workspace_name && t.workspace_name.toLowerCase().includes(qLower)) score += 10;
        return { task: t, score };
      });

      candidateTasks = scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.task);
    }

    const limitedTasks = candidateTasks.slice(0, 10);

    if (limitedTasks.length > 0) {
      const titlePrefix = rawQuery
        ? `🔍 **TÌM THẤY ${candidateTasks.length} KẾT QUẢ KHẢ QUAN CHO "${rawQuery}":**`
        : isAlarmFilter
        ? `⏰ **DANH SÁCH ${candidateTasks.length} CÔNG VIỆC CÓ HẸN GIỜ BÁO THỨC:**`
        : `📋 **DANH SÁCH ${candidateTasks.length} CÔNG VIỆC GẦN ĐÂY:**`;

      let reply = `${titlePrefix}\n\n`;
      limitedTasks.forEach((t, idx) => {
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
        const loc = [t.division_name, t.cluster_name].filter(Boolean).join(' > ') || 'Cụm mặc định';
        const alarmInfo = t.alarm_enabled
          ? `⏰ Báo thức: ${t.alarm_time || 'Đã hẹn giờ'}`
          : '⏰ Không có chuông';

        reply += `${idx + 1}. **${t.title}** [${statusText} | ${priorityText}]\n`;
        reply += `   📍 Vị trí: ${loc}\n`;
        reply += `   ${alarmInfo}${t.due_date ? ` | 📅 Hạn: ${t.due_date}` : ''}\n\n`;
      });

      if (candidateTasks.length > 10) {
        reply += `*(Đã hiển thị 10 / ${candidateTasks.length} việc phù hợp nhất)*\n\n`;
      }
      reply += `💡 *Bạn có thể ra lệnh:* "Đặt báo thức cho [tên việc] lúc 07:00", "Chuyển [tên việc] sang cụm 2" hoặc "Xóa [tên việc]".`;

      return { reply, proposals: [] };
    } else {
      return {
        reply: rawQuery
          ? `Không tìm thấy công việc nào khớp với từ khóa "${rawQuery}". Bạn có thể thử từ khóa khác hoặc gõ /tasks để duyệt toàn bộ danh sách nhé!`
          : `Hiện tại chưa có công việc nào${isAlarmFilter ? ' có hẹn giờ báo thức' : ''}. Bạn có thể tạo việc mới bằng cách nhắn tôi!`,
        proposals: [],
      };
    }
  }

  // Branch 3: Explicit Task / Workspace Actions
  // Branch 3.0: Cancel / Turn off Alarm (Tắt / Hủy báo thức cho task)
  const cancelAlarmPrefixMatch = text.match(
    /(?:tắt|hủy|bỏ|xóa|dừng|stop|turn\s*off|cancel|disable)\s+(?:chuông\s+)?(?:hẹn\s*giờ|báo\s*thức|chuông|nhắc\s*nhở)(?:\s+(?:cho|của))?(?:\s+(?:task|công\s*việc|nhiệm\s*vụ|việc))?\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  const cancelAlarmSuffixMatch = !cancelAlarmPrefixMatch
    ? text.match(
        /^["'“]?([^"'\n]+?)["'”]?\s+(?:tắt|hủy|bỏ|xóa|dừng|turn\s*off|cancel|disable)\s+(?:chuông\s+)?(?:hẹn\s*giờ|báo\s*thức|chuông|nhắc\s*nhở)/i
      )
    : null;

  const isBareCancelAlarm =
    !cancelAlarmPrefixMatch &&
    !cancelAlarmSuffixMatch &&
    /^(?:tắt|hủy|bỏ|xóa|dừng|stop|turn\s*off|cancel|disable)\s+(?:chuông\s+)?(?:hẹn\s*giờ|báo\s*thức|chuông|nhắc\s*nhở)(?:\s*(?:đi|giúp|với|nhé|nào|hộ|ạ))?[!.?]*$/i.test(
      text.trim()
    );

  if (cancelAlarmPrefixMatch || cancelAlarmSuffixMatch || isBareCancelAlarm) {
    let rawTarget = '';
    if (cancelAlarmPrefixMatch) {
      rawTarget = cancelAlarmPrefixMatch[1].trim();
    } else if (cancelAlarmSuffixMatch) {
      rawTarget = cancelAlarmSuffixMatch[1].trim();
    }

    // Filter out common trail particles like "đi", "nhé", "hộ", "giúp tôi", etc.
    const isNoiseParticle = /^(?:đi|nhé|nào|hộ|giúp|giúp\s*tôi|với|ạ|liền|ngay)$/i.test(rawTarget);
    if (isNoiseParticle) {
      rawTarget = '';
    }

    const cleanTaskName = rawTarget
      .replace(/^["'“”]|["'“”]$/g, '')
      .replace(/^(?:task|công việc|việc)\s*/i, '')
      .trim();

    const tasksWithAlarm = context.tasks.filter((t) => t.alarm_enabled);

    if (cleanTaskName) {
      const qLower = cleanTaskName.toLowerCase();
      // Search matching task - prioritizing those with alarm_enabled
      const matchedTask =
        tasksWithAlarm.find((t) => t.title.toLowerCase() === qLower) ||
        tasksWithAlarm.find((t) => t.title.toLowerCase().includes(qLower) || qLower.includes(t.title.toLowerCase())) ||
        context.tasks.find((t) => t.title.toLowerCase() === qLower) ||
        context.tasks.find((t) => t.title.toLowerCase().includes(qLower) || qLower.includes(t.title.toLowerCase()));

      if (matchedTask) {
        if (!matchedTask.alarm_enabled) {
          return {
            reply: `Công việc **"${matchedTask.title}"** hiện tại không có hẹn giờ báo thức. Bạn có muốn đặt báo thức cho công việc này không?`,
            proposals: [],
          };
        }

        proposals.push({
          id: `proposal-${Date.now()}-1`,
          action: 'cancel_alarm',
          target_name: matchedTask.title,
          summary: `Tắt / Hủy báo thức cho công việc "${matchedTask.title}" (Đang hẹn: ${matchedTask.alarm_time || 'Bật'})`,
          status: 'pending',
          details: {
            task_id: matchedTask.id,
            alarm_enabled: false,
          },
        });

        return {
          reply: `Tôi đã chuẩn bị đề xuất tắt báo thức cho công việc **"${matchedTask.title}"**. Bạn hãy bấm xác nhận bên dưới nhé!`,
          proposals,
        };
      } else {
        // Target name not found
        if (tasksWithAlarm.length === 1) {
          const single = tasksWithAlarm[0];
          proposals.push({
            id: `proposal-${Date.now()}-1`,
            action: 'cancel_alarm',
            target_name: single.title,
            summary: `Tắt / Hủy báo thức cho công việc "${single.title}" (Đang hẹn: ${single.alarm_time || 'Bật'})`,
            status: 'pending',
            details: {
              task_id: single.id,
              alarm_enabled: false,
            },
          });
          return {
            reply: `Không tìm thấy công việc "${rawTarget}", nhưng hiện có công việc **"${single.title}"** đang bật báo thức (${single.alarm_time || 'Đã hẹn giờ'}). Tôi đã lập đề xuất tắt báo thức này, bạn hãy xác nhận bên dưới nhé!`,
            proposals,
          };
        } else if (tasksWithAlarm.length > 1) {
          const listStr = tasksWithAlarm
            .map((t, idx) => `${idx + 1}. **${t.title}** (Chuông: ${t.alarm_time || 'Đã hẹn'})`)
            .join('\n');
          return {
            reply: `Không tìm thấy công việc nào khớp với "${rawTarget}". Hiện tại có ${tasksWithAlarm.length} công việc đang bật báo thức:\n\n${listStr}\n\nBạn muốn tắt báo thức cho việc nào?`,
            proposals: [],
          };
        } else {
          return {
            reply: `Không tìm thấy công việc nào khớp với "${rawTarget}" và hiện tại cũng không có công việc nào đang bật báo thức cả!`,
            proposals: [],
          };
        }
      }
    } else {
      // Bare cancel command: "tắt báo thức", "hủy báo thức", "tắt chuông"
      if (tasksWithAlarm.length === 1) {
        const single = tasksWithAlarm[0];
        proposals.push({
          id: `proposal-${Date.now()}-1`,
          action: 'cancel_alarm',
          target_name: single.title,
          summary: `Tắt / Hủy báo thức cho công việc "${single.title}" (Đang hẹn: ${single.alarm_time || 'Bật'})`,
          status: 'pending',
          details: {
            task_id: single.id,
            alarm_enabled: false,
          },
        });
        return {
          reply: `Tôi thấy công việc **"${single.title}"** đang bật báo thức (${single.alarm_time || 'Đã hẹn giờ'}). Tôi đã lập đề xuất tắt báo thức, bạn bấm duyệt bên dưới nhé!`,
          proposals,
        };
      } else if (tasksWithAlarm.length > 1) {
        const listStr = tasksWithAlarm
          .map((t, idx) => `${idx + 1}. **${t.title}** (Chuông: ${t.alarm_time || 'Đã hẹn'})`)
          .join('\n');
        return {
          reply: `Hiện có ${tasksWithAlarm.length} công việc đang có hẹn giờ báo thức:\n\n${listStr}\n\nBạn muốn tắt báo thức cho công việc nào? Hãy nhắn: "Tắt báo thức [tên việc]" nhé!`,
          proposals: [],
        };
      } else {
        return {
          reply: `Hiện tại không có công việc nào đang được đặt báo thức cả! Bạn có thể yêu cầu tôi: "Đặt báo thức cho [tên việc] lúc 09:00" bất cứ lúc nào nhé.`,
          proposals: [],
        };
      }
    }
  }

  // =========================================================================
  // Branch 3.0b: Move Task between Divisions (Chuyển task sang phân chia / divi khác)
  // Tách riêng nhánh logic độc lập, tránh làm rối các prompt và nhánh cũ
  // =========================================================================
  const moveTaskDivPrefixMatch = text.match(
    /(?:chuyển|di\s*chuyển|dời|đưa|đổi|move)\s+(?:task|công\s*việc|nhiệm\s*vụ|việc)?\s*["'“]?([^"'\n]+?)["'”]?\s+(?:từ\s+(?:divi|division|phân\s*chia)\s*["'“]?[^"'\n,.:]+?["'”]?\s*)?(?:sang|qua|vào|đến)\s+(?:divi|division|phân\s*chia)\s*(?:thứ\s*)?([0-9]+|["'“]?[^"'\n,.:]+?["'”]?)(?:\s+(?:vào|ở|trong|tại|sang)?\s*(?:cụm|cột)\s*(?:thứ\s*)?([0-9]+|["'“]?[^"'\n,.:]+?["'”]?))?$/i
  );

  const moveTaskDivSuffixMatch = !moveTaskDivPrefixMatch
    ? text.match(
        /^["'“]?([^"'\n]+?)["'”]?\s+(?:chuyển|di\s*chuyển|dời|đưa|đổi|move)\s+(?:sang|qua|vào|đến)\s+(?:divi|division|phân\s*chia)\s*(?:thứ\s*)?([0-9]+|["'“]?[^"'\n,.:]+?["'”]?)(?:\s+(?:vào|ở|trong|tại|sang)?\s*(?:cụm|cột)\s*(?:thứ\s*)?([0-9]+|["'“]?[^"'\n,.:]+?["'”]?))?$/i
      )
    : null;

  const moveTaskDivOtherMatch =
    !moveTaskDivPrefixMatch && !moveTaskDivSuffixMatch
      ? text.match(
          /(?:chuyển|di\s*chuyển|dời|đưa|đổi|move)\s+(?:task|công\s*việc|nhiệm\s*vụ|việc)?\s*["'“]?([^"'\n]+?)["'”]?\s*(?:từ\s+(?:divi|division|phân\s*chia)\s*(?:này|hiện\s*tại)?\s*)?(?:sang|qua|vào|đến)\s+(?:divi|division|phân\s*chia)?\s*khác$/i
        )
      : null;

  if (moveTaskDivPrefixMatch || moveTaskDivSuffixMatch || moveTaskDivOtherMatch) {
    let rawTaskName = '';
    let rawDivTarget = '';
    let rawClusterTarget = '';

    if (moveTaskDivPrefixMatch) {
      rawTaskName = moveTaskDivPrefixMatch[1].trim();
      rawDivTarget = moveTaskDivPrefixMatch[2].trim();
      rawClusterTarget = moveTaskDivPrefixMatch[3]?.trim() || '';
    } else if (moveTaskDivSuffixMatch) {
      rawTaskName = moveTaskDivSuffixMatch[1].trim();
      rawDivTarget = moveTaskDivSuffixMatch[2].trim();
      rawClusterTarget = moveTaskDivSuffixMatch[3]?.trim() || '';
    } else if (moveTaskDivOtherMatch) {
      rawTaskName = moveTaskDivOtherMatch[1].trim();
      rawDivTarget = 'khác';
    }

    const cleanTaskName = rawTaskName
      .replace(/^["'“”]|["'“”]$/g, '')
      .replace(/^(?:task|công\s*việc|nhiệm\s*vụ|việc)\s*/i, '')
      .trim();

    const qLower = cleanTaskName.toLowerCase();
    const matchedTask =
      context.tasks.find((t) => t.title.toLowerCase() === qLower) ||
      context.tasks.find(
        (t) => t.title.toLowerCase().includes(qLower) || qLower.includes(t.title.toLowerCase())
      ) ||
      (cleanTaskName.length >= 3
        ? context.tasks.find((t) => {
            const words = qLower.split(/\s+/).filter((w) => w.length > 2);
            return words.length > 0 && words.every((w) => t.title.toLowerCase().includes(w));
          })
        : null);

    if (!matchedTask) {
      return {
        reply: `Không tìm thấy công việc nào khớp với tên "${cleanTaskName || rawTaskName}". Bạn vui lòng kiểm tra lại tên công việc nhé!`,
        proposals: [],
      };
    }

    const currentDiv =
      context.divisions.find((d) => d.id === matchedTask.division_id) || context.active_division;
    const currentDivName = currentDiv?.name || 'Phân chia hiện tại';

    // Resolve target division
    let targetDivision: (typeof context.divisions)[0] | null = null;

    if (rawDivTarget === 'khác') {
      const otherDivs = context.divisions.filter((d) => d.id !== matchedTask.division_id);
      if (otherDivs.length === 0) {
        return {
          reply: `Công việc **"${matchedTask.title}"** đang ở **"${currentDivName}"**. Hiện tại không có phân chia nào khác trong phòng làm việc. Bạn có thể tạo thêm bằng lệnh: "Tạo division [tên]" nhé!`,
          proposals: [],
        };
      }
      targetDivision = otherDivs[0];
    } else {
      const cleanDiv = rawDivTarget.toLowerCase().trim().replace(/^["'“”]|["'“”]$/g, '');
      const strippedDiv = cleanDiv.replace(/^(?:division|phân\s*chia|divi|div)\s*/i, '').trim();

      // 1. Direct ID match
      targetDivision = context.divisions.find((d) => d.id === cleanDiv || d.id.toLowerCase() === cleanDiv) || null;

      // 2. Exact Name match
      if (!targetDivision) {
        targetDivision = context.divisions.find((d) => d.name.toLowerCase() === cleanDiv) || null;
      }

      // 3. Stripped Name match
      if (!targetDivision && strippedDiv) {
        targetDivision =
          context.divisions.find(
            (d) =>
              d.name.toLowerCase() === strippedDiv ||
              d.name.toLowerCase() === `division ${strippedDiv}` ||
              d.name.toLowerCase() === `divi ${strippedDiv}` ||
              d.name.toLowerCase() === `phân chia ${strippedDiv}` ||
              d.name.toLowerCase().endsWith(` ${strippedDiv}`)
          ) || null;

        // 4. Numeric index (e.g. divi 1, divi 2, phân chia 1, 2)
        if (!targetDivision) {
          const num = parseInt(strippedDiv, 10);
          if (!isNaN(num) && num > 0) {
            const activePeriodId = context.active_period?.id;
            const periodDivs = context.divisions.filter((d) => !activePeriodId || d.period_id === activePeriodId);
            if (periodDivs[num - 1]) {
              targetDivision = periodDivs[num - 1];
            } else if (context.divisions[num - 1]) {
              targetDivision = context.divisions[num - 1];
            }
          }
        }
      }

      // 5. Substring / Includes
      if (!targetDivision) {
        targetDivision =
          context.divisions.find(
            (d) =>
              d.name.toLowerCase().includes(cleanDiv) ||
              cleanDiv.includes(d.name.toLowerCase()) ||
              (strippedDiv && (d.name.toLowerCase().includes(strippedDiv) || strippedDiv.includes(d.name.toLowerCase())))
          ) || null;
      }
    }

    if (!targetDivision) {
      const divListStr = context.divisions.map((d, i) => `${i + 1}. **${d.name}**`).join('\n');
      return {
        reply: `Đã tìm thấy công việc **"${matchedTask.title}"**, nhưng không tìm thấy phân chia nào khớp với "${rawDivTarget}".\n\nCác phân chia hiện có:\n${divListStr}\n\nBạn muốn chuyển công việc sang phân chia nào?`,
        proposals: [],
      };
    }

    if (targetDivision.id === matchedTask.division_id) {
      return {
        reply: `Công việc **"${matchedTask.title}"** vốn đã nằm ở phân chia **"${targetDivision.name}"** rồi! Nếu bạn muốn đổi sang cụm khác trong phân chia này, hãy nhắn: "Chuyển task ${matchedTask.title} sang cụm [số cụm]" nhé!`,
        proposals: [],
      };
    }

    // Resolve cluster in target division
    const targetDivClusters = context.clusters
      .filter((c) => c.division_id === targetDivision.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    let finalClusterId = '';
    let finalClusterName = '';
    let finalClusterIndex: number | undefined = undefined;

    if (rawClusterTarget) {
      const cleanClu = rawClusterTarget.replace(/^["'“”]|["'“”]$/g, '').trim();
      const cluNum = parseInt(cleanClu, 10);
      if (!isNaN(cluNum) && cluNum > 0) {
        finalClusterIndex = cluNum;
        if (targetDivClusters[cluNum - 1]) {
          finalClusterId = targetDivClusters[cluNum - 1].id;
          finalClusterName = targetDivClusters[cluNum - 1].name;
        } else {
          finalClusterName = `Cụm ${cluNum}`;
        }
      } else if (cleanClu) {
        const cFound = targetDivClusters.find((c) => c.name.toLowerCase().includes(cleanClu.toLowerCase()));
        if (cFound) {
          finalClusterId = cFound.id;
          finalClusterName = cFound.name;
        } else {
          finalClusterName = cleanClu;
        }
      }
    }

    if (!finalClusterName) {
      if (targetDivClusters.length > 0) {
        finalClusterId = targetDivClusters[0].id;
        finalClusterName = targetDivClusters[0].name;
      } else {
        finalClusterName = 'Cụm 1';
      }
    }

    const clusterSummarySuffix = finalClusterName ? ` (Cụm: ${finalClusterName})` : '';

    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'move_task',
      target_name: matchedTask.title,
      summary: `Di chuyển công việc "${matchedTask.title}" từ phân chia "${currentDivName}" sang "${targetDivision.name}"${clusterSummarySuffix}`,
      status: 'pending',
      details: {
        task_id: matchedTask.id,
        target_division_id: targetDivision.id,
        target_division_name: targetDivision.name,
        target_period_id: targetDivision.period_id,
        target_workspace_id: targetDivision.workspace_id,
        old_division_id: matchedTask.division_id,
        old_division_name: currentDivName,
        ...(finalClusterId ? { target_cluster_id: finalClusterId } : {}),
        ...(finalClusterName ? { target_cluster_name: finalClusterName } : {}),
        ...(finalClusterIndex !== undefined ? { cluster_index: finalClusterIndex } : {}),
      },
    });

    return {
      reply: `Tôi đã chuẩn bị đề xuất chuyển công việc **"${matchedTask.title}"** từ phân chia **"${currentDivName}"** sang **"${targetDivision.name}"**${clusterSummarySuffix ? ` và đặt vào **${finalClusterName}**` : ''}. Bạn hãy bấm xác nhận ở bảng bên dưới nhé!`,
      proposals,
    };
  }

  // Match alarm request: e.g. "đặt báo thức cho task X lúc 09:00", "báo thức task X 15:30", "làm bánh đặt báo thức 8h sáng mai"
  const alarmPrefixMatch = text.match(
    /(?:đặt\s+báo\s+thức|báo\s+thức|nhắc\s+nhở|hẹn\s+giờ)\s+(?:cho\s+)?(?:task|công\s+việc)?\s*["'“]?([^"'\n]+?)["'”]?\s+(?:lúc|vào\s+lúc|lúc\s+nào)?\s*(\d{1,2}[:h]\d{1,2}|\d{1,2}\s*h[^\n]*)/i
  );
  const taskPrefixAlarmMatch = !alarmPrefixMatch
    ? text.match(
        /^["'“]?([^"'\n]+?)["'”]?\s+(?:đặt\s+báo\s+thức|báo\s+thức|nhắc\s+nhở|hẹn\s+giờ)\s*(?:lúc|vào\s+lúc)?\s*(\d{1,2}[:h]\d{1,2}|\d{1,2}\s*h[^\n]*)/i
      )
    : null;

  const alarmMatch = alarmPrefixMatch || taskPrefixAlarmMatch;

  if (alarmMatch) {
    const rawTaskName = alarmMatch[1].replace(/^(?:task|công việc|việc)\s*/i, '').trim();
    const rawTime = alarmMatch[2].trim();
    const alarmNormalized = normalizeAlarmPayload(rawTime);

    // Find best matching task
    const matchedTask = context.tasks.find(
      (t) =>
        t.title.toLowerCase().includes(rawTaskName.toLowerCase()) ||
        rawTaskName.toLowerCase().includes(t.title.toLowerCase())
    );

    if (matchedTask) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'set_alarm',
        target_name: matchedTask.title,
        summary: `Đặt báo thức lúc ${alarmNormalized.alarm_time} cho công việc "${matchedTask.title}"`,
        status: 'pending',
        details: {
          task_id: matchedTask.id,
          alarm_enabled: true,
          alarm_time: alarmNormalized.alarm_time,
          alarm_at: alarmNormalized.alarm_at,
          alarm_repeat: alarmNormalized.alarm_repeat,
        },
      });

      return {
        reply: `Tôi đã lập đề xuất đặt báo thức lúc ${alarmNormalized.alarm_time} cho "${matchedTask.title}". Bạn bấm xác nhận bên dưới nhé!`,
        proposals,
      };
    } else if (rawTaskName.length > 1) {
      // If task does not exist, propose creating it with the alarm attached
      const firstActive = (context.active_clusters || [])[0] || context.clusters[0];
      const targetClusterId = firstActive?.id || 'clu-default';
      const targetClusterName = firstActive?.name || 'Cụm 1';
      const targetWorkspace = context.active_workspace || context.workspaces[0];
      const targetPeriod = context.active_period || context.periods[0];
      const targetDivision = context.active_division || context.divisions[0];

      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'create_task',
        target_name: rawTaskName,
        summary: `Tạo công việc "${rawTaskName}" (Báo thức: ${alarmNormalized.alarm_time}) tại: Cụm: ${targetClusterName}`,
        status: 'pending',
        details: {
          title: rawTaskName,
          priority: 'medium',
          status: 'todo',
          workspace_id: targetWorkspace?.id,
          workspace_name: targetWorkspace?.name,
          period_id: targetPeriod?.id,
          period_name: targetPeriod?.name,
          division_id: targetDivision?.id,
          division_name: targetDivision?.name,
          cluster_id: targetClusterId,
          cluster_name: targetClusterName,
          cluster_index: 1,
          alarm_enabled: true,
          alarm_time: alarmNormalized.alarm_time,
          alarm_at: alarmNormalized.alarm_at,
          alarm_repeat: alarmNormalized.alarm_repeat,
        },
      });

      return {
        reply: `Chưa có công việc "${rawTaskName}", tôi đã lập đề xuất tạo mới công việc này kèm báo thức lúc ${alarmNormalized.alarm_time}. Bạn bấm xác nhận bên dưới nhé!`,
        proposals,
      };
    }
  }

  // Match department/room task initialization flow (e.g. "tạo các nhiệm vụ quan trọng cho phòng ban lập trình máy tính")
  const isDeptPlanIntent =
    /(?:tạo|thiết\s*lập|lên|xây\s*dựng|suy\s*nghĩ|chuẩn\s*bị)\s+(?:các\s+)?(?:nhiệm\s*vụ|công\s*việc|kế\s*hoạch|quy\s*trình).*(?:cho\s+)?(?:phòng|phòng\s*ban|bộ\s*phận)\s*[:\-\s]*["'“]?([^"'\n?]+?)["'”]?$/i.test(text) ||
    /(?:phòng\s*ban|phòng)\s+["'“]?([^"'\n?]+?)["'”]?\s+cần\s+làm\s+gì/i.test(text) ||
    (/lập\s*trình\s*máy\s*tính/i.test(text) && /(?:nhiệm\s*vụ|công\s*việc|task)/i.test(text));

  if (isDeptPlanIntent) {
    let deptName = 'Lập trình máy tính';
    const deptMatch = text.match(/(?:cho\s+)?(?:phòng|phòng\s*ban|bộ\s*phận)\s*[:\-\s]*["'“]?([^"'\n?,.:]+?)["'”]?$/i);
    if (deptMatch && deptMatch[1].trim()) {
      deptName = deptMatch[1].trim();
    } else if (/quản\s*trị\s*máy\s*tính|qtmt/i.test(text)) {
      deptName = 'Quản trị máy tính';
    } else if (/lập\s*trình\s*máy\s*tính|ltmt/i.test(text)) {
      deptName = 'Lập trình máy tính';
    }

    const matchedWs = context.workspaces.find(
      (w) => w.name.toLowerCase().includes(deptName.toLowerCase()) || deptName.toLowerCase().includes(w.name.toLowerCase())
    );

    const wsTargetName = matchedWs ? matchedWs.name : deptName;
    const wsTargetId = matchedWs ? matchedWs.id : undefined;

    let propIdx = 1;
    if (!matchedWs) {
      proposals.push({
        id: `proposal-${Date.now()}-${propIdx++}`,
        action: 'create_workspace',
        target_name: wsTargetName,
        summary: `Tạo phòng làm việc mới: "${wsTargetName}"`,
        status: 'pending',
        details: { name: wsTargetName, color: '#6366f1', icon: 'Terminal' },
      });
    }

    proposals.push({
      id: `proposal-${Date.now()}-${propIdx++}`,
      action: 'create_division',
      target_name: wsTargetName,
      summary: `Tạo phân chia chuyên môn: "${wsTargetName}" tại phòng "${wsTargetName}"`,
      status: 'pending',
      details: {
        name: wsTargetName,
        workspace_name: wsTargetName,
        workspace_id: wsTargetId,
        description: `Theo dõi luồng công việc của bộ phận ${wsTargetName}`,
      },
    });

    const boardModeName = `Kanban ${deptName}`;
    const boardClusters = [
      { name: '1. Cần làm (Backlog)', color: '#6366F1' },
      { name: '2. Đang thực hiện', color: '#F59E0B' },
      { name: '3. Kiểm thử & Đánh giá', color: '#8B5CF6' },
      { name: '4. Đã hoàn thành', color: '#10B981' },
    ];

    proposals.push({
      id: `proposal-${Date.now()}-${propIdx++}`,
      action: 'create_board_mode',
      target_name: boardModeName,
      summary: `Thiết lập Chế độ bảng (Board Mode): "${boardModeName}" gồm 4 cột quy chuẩn`,
      status: 'pending',
      details: {
        name: boardModeName,
        division_name: wsTargetName,
        clusters: boardClusters,
      },
    });

    // 3 Key Tasks
    const isDev = /lập\s*trình/i.test(deptName);
    const keyTasks = isDev
      ? [
          {
            title: 'Thiết lập môi trường phát triển & Kho lưu trữ mã nguồn (Repo & CI/CD)',
            cluster_name: '1. Cần làm (Backlog)',
            cluster_index: 1,
            priority: 'urgent',
            desc: 'Cấu hình Docker, GitHub Repo, biến môi trường và pipeline build tự động.',
          },
          {
            title: 'Phân tích yêu cầu hệ thống & Thiết kế cơ sở dữ liệu',
            cluster_name: '1. Cần làm (Backlog)',
            cluster_index: 1,
            priority: 'high',
            desc: 'Vẽ ERD, định nghĩa bảng CSDL và lược đồ tài liệu Firestore/SQL.',
          },
          {
            title: 'Xây dựng module xác thực & API chức năng cốt lõi',
            cluster_name: '2. Đang thực hiện',
            cluster_index: 2,
            priority: 'high',
            desc: 'Lập trình xác thực người dùng, bảo mật JWT và API nghiệp vụ chính.',
          },
        ]
      : [
          {
            title: 'Kiểm tra hạ tầng mạng, máy chủ và sao lưu dữ liệu định kỳ',
            cluster_name: '1. Cần làm (Backlog)',
            cluster_index: 1,
            priority: 'urgent',
            desc: 'Kiểm tra server health, RAM, CPU và snapshot backup hệ thống.',
          },
          {
            title: 'Rà soát tài khoản truy cập & Cập nhật bản vá bảo mật',
            cluster_name: '1. Cần làm (Backlog)',
            cluster_index: 1,
            priority: 'high',
            desc: 'Quản lý phân quyền user, kiểm tra log an ninh và cài đặt update OS.',
          },
          {
            title: 'Hỗ trợ kỹ thuật người dùng & Bảo trì phần cứng thiết bị',
            cluster_name: '2. Đang thực hiện',
            cluster_index: 2,
            priority: 'medium',
            desc: 'Xử lý ticket sự cố nội bộ và bảo dưỡng máy tính văn phòng.',
          },
        ];

    keyTasks.forEach((t) => {
      proposals.push({
        id: `proposal-${Date.now()}-${propIdx++}`,
        action: 'create_task',
        target_name: t.title,
        summary: `Tạo công việc "${t.title}" tại cột: ${t.cluster_name}`,
        status: 'pending',
        details: {
          title: t.title,
          description: t.desc,
          priority: t.priority,
          status: t.cluster_index === 2 ? 'in_progress' : 'todo',
          workspace_name: wsTargetName,
          division_name: wsTargetName,
          cluster_name: t.cluster_name,
          cluster_index: t.cluster_index,
        },
      });
    });

    return {
      reply: `Chào cậu! Dino đã chuẩn bị kế hoạch đúng và đủ quy trình cho phòng ban "**${deptName}**" rồi đây! 🦖💻\n\nĐể đảm bảo hệ thống hiển thị đúng chuẩn và không bị lỗi thiếu Chế độ bảng (Board Mode), tớ đã lên phương án tuần tự:\n1️⃣ Tạo phân chia & phòng làm việc chuyên môn.\n2️⃣ **Tạo Chế độ bảng (Board Mode):** '**${boardModeName}**' gồm 4 cột quy chuẩn (Cần làm ➔ Đang thực hiện ➔ Kiểm thử ➔ Hoàn thành).\n3️⃣ Tạo 3 nhiệm vụ quan trọng hàng đầu vào đúng các cột tương ứng.\n\nCậu xem qua các đề xuất bên dưới và bấm duyệt nhé! Cậu cũng có thể yêu cầu đặt tên Chế độ bảng khác nếu thích.`,
      proposals,
    };
  }

  // Match task creation: e.g. "tạo task [name]", "thêm task [name] vào cụm 2", "thêm task vào cụm 2", "thêm task mới vào đang nghiên cứu"
  const isCreateTaskIntent =
    /(?:tạo|thêm|lập|add)\s+(?:mới\s+)?(?:task|công\s+việc|nhiệm\s+vụ|việc)\b/i.test(text) ||
    /^(?:tạo|thêm|add)\s+(?:task|việc)\b/i.test(text);

  if (isCreateTaskIntent) {
    let workingText = text.trim();
    let detectedClusterIndex: number | null = null;
    let detectedClusterId: string | null = null;
    let detectedClusterName: string | null = null;
    let detectedBoardModeId: string | null = null;
    let detectedBoardModeName: string | null = null;

    // Helper cleaner
    const cleanNorm = (s: string) =>
      (s || '')
        .toLowerCase()
        .trim()
        .replace(/^["'“”]|["'“”]$/g, '');

    // A. Check for numeric cluster index: e.g. "vào cụm 2", "ở cột 2", "cụm 2", "cột 2", "cụm thứ 2"
    const clusterNumRegex = /(?:vào|ở|trong|tại|sang|cho|trên|-|:)?\s*(?:cụm|cột)\s*(?:thứ\s*)?([0-9]+)/i;
    const clusterNumMatch = workingText.match(clusterNumRegex);

    if (clusterNumMatch) {
      detectedClusterIndex = parseInt(clusterNumMatch[1], 10);
      workingText = workingText.replace(clusterNumMatch[0], ' ');
    } else {
      // B. Scan if workingText matches ANY known column name across all Board Modes
      let matchedColFromBoardMode: { id: string; name: string; modeId: string; modeName: string } | null = null;
      for (const bm of context.board_modes || []) {
        for (const col of bm.clusters || []) {
          const colNameLower = col.name.toLowerCase().trim();
          if (colNameLower.length >= 2) {
            const escaped = colNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:vào|ở|trong|tại|sang|cho|trên|-|:)?\\s*(?:cụm|cột)?\\s*["'“]?${escaped}["'”]?`, 'i');
            const m = workingText.match(regex);
            if (m && m[0].trim().length >= 2) {
              matchedColFromBoardMode = {
                id: col.id,
                name: col.name,
                modeId: bm.id,
                modeName: bm.name,
              };
              workingText = workingText.replace(m[0], ' ');
              break;
            }
          }
        }
        if (matchedColFromBoardMode) break;
      }

      if (matchedColFromBoardMode) {
        detectedClusterId = matchedColFromBoardMode.id;
        detectedClusterName = matchedColFromBoardMode.name;
        detectedBoardModeId = matchedColFromBoardMode.modeId;
        detectedBoardModeName = matchedColFromBoardMode.modeName;
      } else {
        // C. Check for named cluster pattern: e.g. "vào cụm [tên]", "trong cột [tên]"
        const clusterNameRegex = /(?:vào|ở|trong|tại|sang|cho|trên|-|:)\s*(?:cụm|cột)\s*["'“]?([^"'\n,.:]+?)["'”]?$/i;
        const clusterNameMatch = workingText.match(clusterNameRegex);
        if (clusterNameMatch) {
          detectedClusterName = clusterNameMatch[1].trim();
          workingText = workingText.replace(clusterNameMatch[0], ' ');
        }
      }
    }

    // Check if task creation also specifies an alarm (e.g. "báo thức 8h sáng mai")
    let taskAlarmData: ReturnType<typeof normalizeAlarmPayload> | null = null;
    const createAlarmMatch = workingText.match(
      /(?:báo\s+thức|hẹn\s+giờ|nhắc\s+nhở)\s*(?:lúc|vào\s+lúc)?\s*(\d{1,2}[:h]\d{1,2}|\d{1,2}\s*h[^\n]*)/i
    );
    if (createAlarmMatch) {
      taskAlarmData = normalizeAlarmPayload(createAlarmMatch[1]);
      workingText = workingText.replace(createAlarmMatch[0], ' ');
    }

    // Strip task creation command words
    let taskTitle = workingText
      .replace(/^(?:tạo|thêm|lập|add)\s*(?:mới\s+)?(?:task|công\s+việc|nhiệm\s+vụ|việc)\s*[:\-\s]*/i, '')
      .replace(/["'“”]/g, '')
      .trim();

    // If no title was given (e.g. user simply said "thêm task mới vào đang nghiên cứu")
    if (!taskTitle) {
      if (detectedClusterName) {
        taskTitle = `Task mới trong ${detectedClusterName}`;
      } else if (detectedClusterIndex) {
        taskTitle = `Nhiệm vụ mới (Cụm ${detectedClusterIndex})`;
      } else {
        taskTitle = 'Nhiệm vụ mới';
      }
    }

    // Resolve target division
    const matchedDivisionFromMode = detectedBoardModeId
      ? context.divisions.find((d) => {
          const modeObj = (context.board_modes || []).find((m) => m.id === detectedBoardModeId);
          return modeObj && modeObj.division_id === d.id;
        })
      : null;

    const targetDivision = matchedDivisionFromMode || context.active_division || context.divisions[0];
    const targetDivisionPeriodId =
      targetDivision && 'period_id' in targetDivision ? targetDivision.period_id : undefined;
    const targetPeriod =
      (targetDivisionPeriodId && context.periods.find((p) => p.id === targetDivisionPeriodId)) ||
      context.active_period ||
      context.periods[0];
    const targetPeriodWsId =
      targetPeriod && 'workspace_id' in targetPeriod ? targetPeriod.workspace_id : undefined;
    const targetWorkspace =
      context.active_workspace ||
      (targetPeriodWsId && context.workspaces.find((w) => w.id === targetPeriodWsId)) ||
      context.workspaces[0];

    const wsName = targetWorkspace?.name || 'Mặc định';
    const perName = targetPeriod?.name || 'Mặc định';
    const divName = targetDivision?.name || 'Mặc định';

    // Board mode resolution
    let finalBoardModeId = detectedBoardModeId || context.active_board_mode?.id || 'kanban';
    let finalBoardModeName = detectedBoardModeName || context.active_board_mode?.name || 'Kanban';

    // Resolve target cluster
    let targetClusterId = detectedClusterId || '';
    let targetClusterName = detectedClusterName || '';
    let targetClusterIndex: number | undefined = detectedClusterIndex || undefined;

    const activeClusters = context.active_clusters || [];

    if (detectedClusterIndex !== null && detectedClusterIndex > 0) {
      const idx = detectedClusterIndex - 1;
      if (activeClusters[idx]) {
        targetClusterId = activeClusters[idx].id;
        targetClusterName = activeClusters[idx].name;
      } else if (context.clusters[idx]) {
        targetClusterId = context.clusters[idx].id;
        targetClusterName = context.clusters[idx].name;
      } else {
        targetClusterId = `clu-requested-${detectedClusterIndex}`;
        targetClusterName = `Cụm ${detectedClusterIndex}`;
      }
    } else if (detectedClusterName) {
      const cNameLower = detectedClusterName.toLowerCase().trim();
      const matchInActive = activeClusters.find(
        (c) =>
          c.name.toLowerCase().includes(cNameLower) ||
          cNameLower.includes(c.name.toLowerCase()) ||
          c.aliases.some((a) => a.includes(cNameLower) || cNameLower.includes(a))
      );
      if (matchInActive) {
        targetClusterId = matchInActive.id;
        targetClusterName = matchInActive.name;
        targetClusterIndex = matchInActive.index;
      } else {
        // Search in all board modes of this division
        const modeWithCol = (context.board_modes || []).find(
          (m) =>
            (!targetDivision?.id || m.division_id === targetDivision.id) &&
            (m.clusters || []).some(
              (c: any) =>
                c.name.toLowerCase().includes(cNameLower) ||
                cNameLower.includes(c.name.toLowerCase())
            )
        );
        if (modeWithCol) {
          finalBoardModeId = modeWithCol.id;
          finalBoardModeName = modeWithCol.name;
          const col = modeWithCol.clusters.find(
            (c: any) =>
              c.name.toLowerCase().includes(cNameLower) ||
              cNameLower.includes(c.name.toLowerCase())
          );
          if (col) {
            targetClusterId = col.id;
            targetClusterName = col.name;
            targetClusterIndex = modeWithCol.clusters.indexOf(col) + 1;
          }
        } else {
          const matchInAll = context.clusters.find(
            (c) =>
              c.name.toLowerCase().includes(cNameLower) ||
              cNameLower.includes(c.name.toLowerCase())
          );
          if (matchInAll) {
            targetClusterId = matchInAll.id;
            targetClusterName = matchInAll.name;
          } else {
            targetClusterId = `clu-custom-${Date.now()}`;
            targetClusterName = detectedClusterName;
          }
        }
      }
    } else {
      // Default to 1st active cluster
      const firstActive = activeClusters[0] || context.clusters[0];
      targetClusterId = firstActive?.id || 'clu-default';
      targetClusterName = firstActive?.name || 'Cụm 1';
      targetClusterIndex = 1;
    }

    const clsName = targetClusterName || 'Cụm 1';

    const needsBoardMode = !context.active_division_has_board_mode && !detectedBoardModeId;
    if (needsBoardMode) {
      const defaultBmName = 'Kanban Tiến độ';
      proposals.push({
        id: `proposal-${Date.now()}-bm`,
        action: 'create_board_mode',
        target_name: defaultBmName,
        summary: `Thiết lập Chế độ bảng: "${defaultBmName}" (4 cột: Cần làm, Đang thực hiện, Kiểm thử, Hoàn thành) cho phân chia "${divName}"`,
        status: 'pending',
        details: {
          name: defaultBmName,
          division_id: targetDivision?.id,
          division_name: divName,
          clusters: [
            { name: '1. Cần làm', color: '#6366F1' },
            { name: '2. Đang thực hiện', color: '#F59E0B' },
            { name: '3. Kiểm thử', color: '#8B5CF6' },
            { name: '4. Hoàn thành', color: '#10B981' },
          ],
        },
      });
      finalBoardModeName = defaultBmName;
    }

    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'create_task',
      target_name: taskTitle,
      summary: `Tạo công việc "${taskTitle}"${taskAlarmData ? ` (Báo thức: ${taskAlarmData.alarm_time})` : ''} tại: Phòng: ${wsName} | Period: ${perName} | Division: ${divName} | Chế độ: ${finalBoardModeName} | Cụm: ${clsName}`,
      status: 'pending',
      details: {
        title: taskTitle,
        priority: 'medium',
        status: 'todo',
        workspace_id: targetWorkspace?.id,
        workspace_name: wsName,
        period_id: targetPeriod?.id,
        period_name: perName,
        division_id: targetDivision?.id,
        division_name: divName,
        board_mode_id: finalBoardModeId,
        board_mode_name: finalBoardModeName,
        cluster_id: targetClusterId,
        cluster_name: clsName,
        cluster_index: targetClusterIndex,
        ...(taskAlarmData
          ? {
              alarm_enabled: true,
              alarm_time: taskAlarmData.alarm_time,
              alarm_at: taskAlarmData.alarm_at,
              alarm_repeat: taskAlarmData.alarm_repeat,
            }
          : {}),
      },
    });

    if (needsBoardMode) {
      return {
        reply: `Chào bạn! Phân chia "**${divName}**" hiện chưa có Chế độ bảng (Board Mode) nào để chia các cột hiển thị việc. Theo đúng quy trình chuẩn của hệ thống, tôi đã sắp xếp tuần tự:\n1️⃣ **Tạo Chế độ bảng:** '${finalBoardModeName}' (gồm 4 cột: 1. Cần làm ➔ 2. Đang thực hiện ➔ 3. Kiểm thử ➔ 4. Hoàn thành).\n2️⃣ Tạo công việc '**${taskTitle}**' vào đúng cột tương ứng.\n\nBạn có thể yêu cầu đặt tên Chế độ bảng theo ý thích nếu muốn, hoặc bấm duyệt đề xuất bên dưới để tôi thực hiện ngay nhé!`,
        proposals,
      };
    }

    return {
      reply: `Chào cậu! Dino nghe thấy rồi nè! 🦖 Cậu muốn thêm một task mới vào cụm '${clsName}' của chế độ bảng '${finalBoardModeName}' (phân chia '${divName}') đúng không? Dino đã chuẩn bị đề xuất tạo task mới này chuẩn 5 cấp độ đây. Cậu đặt tên cho nhiệm vụ này là gì nhỉ?`,
      proposals,
    };
  }

  // Match moving task to cluster: e.g. "chuyển task [name] sang cụm 2", "đổi task [name] vào cột 2"
  const moveTaskMatch = text.match(
    /(?:chuyển|dời|đưa|đổi)\s+(?:task|công\s+việc|việc)?\s*["'“]?([^"'\n]+?)["'”]?\s*(?:sang|vào|đến|ở)\s+(?:cụm|cột)\s*(?:thứ\s*)?([0-9]+|["'“]?[^"'\n,.:]+?["'”]?)$/i
  );

  if (moveTaskMatch) {
    const rawTaskName = moveTaskMatch[1].trim();
    const rawClusterTarget = moveTaskMatch[2]?.trim();

    const matchedTask = context.tasks.find(
      (t) =>
        t.title.toLowerCase().includes(rawTaskName.toLowerCase()) ||
        rawTaskName.toLowerCase().includes(t.title.toLowerCase())
    );

    if (matchedTask) {
      let targetCluId = '';
      let targetCluName = '';
      let targetCluIndex: number | undefined = undefined;
      let targetBoardModeId = context.active_board_mode?.id || 'kanban';
      let targetBoardModeName = context.active_board_mode?.name || 'Kanban';

      const numVal = parseInt(rawClusterTarget, 10);
      const activeClusters = context.active_clusters || [];

      if (!isNaN(numVal) && numVal > 0) {
        targetCluIndex = numVal;
        const idx = numVal - 1;
        if (activeClusters[idx]) {
          targetCluId = activeClusters[idx].id;
          targetCluName = activeClusters[idx].name;
        } else if (context.clusters[idx]) {
          targetCluId = context.clusters[idx].id;
          targetCluName = context.clusters[idx].name;
        } else {
          targetCluId = `clu-requested-${numVal}`;
          targetCluName = `Cụm ${numVal}`;
        }
      } else {
        const cLower = rawClusterTarget.toLowerCase();
        // Check active clusters first
        const found =
          activeClusters.find((c) => c.name.toLowerCase().includes(cLower)) ||
          context.clusters.find((c) => c.name.toLowerCase().includes(cLower));
        if (found) {
          targetCluId = found.id;
          targetCluName = found.name;
        } else {
          // Check in board modes
          const modeWithCol = (context.board_modes || []).find((m) =>
            (m.clusters || []).some(
              (c: any) => c.name.toLowerCase().includes(cLower) || cLower.includes(c.name.toLowerCase())
            )
          );
          if (modeWithCol) {
            targetBoardModeId = modeWithCol.id;
            targetBoardModeName = modeWithCol.name;
            const cObj = modeWithCol.clusters.find(
              (c: any) => c.name.toLowerCase().includes(cLower) || cLower.includes(c.name.toLowerCase())
            );
            if (cObj) {
              targetCluId = cObj.id;
              targetCluName = cObj.name;
            }
          } else {
            targetCluName = rawClusterTarget;
          }
        }
      }

      const taskDiv = context.divisions.find((d) => d.id === matchedTask.division_id);
      const taskWs = context.workspaces.find((w) => w.id === (matchedTask.workspace_id || taskDiv?.workspace_id));
      const taskPer = taskDiv ? context.periods.find((p) => p.id === taskDiv.period_id) : undefined;

      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'update_task',
        target_name: matchedTask.title,
        summary: `Chuyển công việc "${matchedTask.title}" sang [Chế độ: ${targetBoardModeName}] Cột: ${targetCluName}`,
        status: 'pending',
        details: {
          task_id: matchedTask.id,
          cluster_id: targetCluId,
          cluster_name: targetCluName,
          cluster_index: targetCluIndex,
          board_mode_id: targetBoardModeId,
          board_mode_name: targetBoardModeName,
          division_id: taskDiv?.id,
          division_name: taskDiv?.name,
          workspace_id: taskWs?.id,
          workspace_name: taskWs?.name,
          period_id: taskPer?.id,
          period_name: taskPer?.name,
        },
      });

      return {
        reply: `Đã chuẩn bị đề xuất chuyển "${matchedTask.title}" sang [Chế độ: ${targetBoardModeName}] Cột: ${targetCluName}. Vui lòng duyệt ở bảng bên dưới.`,
        proposals,
      };
    }
  }

  // Match task deletion: "xóa task [name]"
  const deleteTaskMatch = text.match(
    /(?:xóa|hủy|bỏ)\s+(?:task|công\s+việc)\s*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (deleteTaskMatch) {
    const taskName = deleteTaskMatch[1].trim();
    const matchedTask = context.tasks.find(
      (t) =>
        t.title.toLowerCase().includes(taskName.toLowerCase()) ||
        taskName.toLowerCase().includes(t.title.toLowerCase())
    );

    if (matchedTask) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'delete_task',
        target_name: matchedTask.title,
        summary: `Xóa vĩnh viễn công việc: "${matchedTask.title}"`,
        status: 'pending',
        details: { task_id: matchedTask.id },
      });

      return {
        reply: `Cảnh báo: Hành động xóa công việc "${matchedTask.title}" không thể hoàn tác trực tiếp. Vui lòng xác nhận qua menu dưới.`,
        proposals,
      };
    }
  }

  // Helper: Find matching period safely
  const findMatchingPeriod = (target: string) => {
    const clean = target.toLowerCase().trim().replace(/^["'“”]|["'“”]$/g, '');
    if (!clean) return null;
    const stripped = clean.replace(/^(?:period|chu\s*kỳ|giai\s*đoạn)\s*/i, '').trim();

    let found = context.periods.find((p) => p.name.toLowerCase() === clean);
    if (found) return found;

    if (stripped) {
      found = context.periods.find(
        (p) =>
          p.name.toLowerCase() === stripped ||
          p.name.toLowerCase() === `period ${stripped}` ||
          p.name.toLowerCase() === `chu kỳ ${stripped}` ||
          p.name.toLowerCase().endsWith(` ${stripped}`) ||
          (p.index && String(p.index) === stripped)
      );
      if (found) return found;
    }

    found = context.periods.find(
      (p) => p.id.toLowerCase() === clean || (stripped && p.id.toLowerCase() === stripped)
    );
    if (found) return found;

    found = context.periods.find(
      (p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase())
    );
    if (found) return found;

    const num = parseInt(stripped || clean, 10);
    if (!isNaN(num) && num > 0 && num <= context.periods.length) {
      return context.periods[num - 1];
    }
    return null;
  };

  // Helper: Find matching division safely
  const findMatchingDivision = (target: string) => {
    const clean = target.toLowerCase().trim().replace(/^["'“”]|["'“”]$/g, '');
    if (!clean) return null;
    const stripped = clean.replace(/^(?:division|phân\s*chia|nhóm\s*việc)\s*/i, '').trim();

    let found = context.divisions.find((d) => d.name.toLowerCase() === clean);
    if (found) return found;

    if (stripped) {
      found = context.divisions.find(
        (d) =>
          d.name.toLowerCase() === stripped ||
          d.name.toLowerCase() === `division ${stripped}` ||
          d.name.toLowerCase() === `phân chia ${stripped}`
      );
      if (found) return found;
    }

    found = context.divisions.find(
      (d) => d.id.toLowerCase() === clean || (stripped && d.id.toLowerCase() === stripped)
    );
    if (found) return found;

    found = context.divisions.find(
      (d) => d.name.toLowerCase().includes(clean) || clean.includes(d.name.toLowerCase())
    );
    return found || null;
  };

  // Match period deletion: e.g. "xóa hẳn period 1", "xóa period 1", "xóa chu kỳ 1", "delete period 1"
  const deletePeriodMatch = text.match(
    /(?:xóa|hủy|bỏ|delete|remove)\s*(?:hẳn|vĩnh\s*viễn)?\s*(?:chu\s*kỳ|period|giai\s*đoạn)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (deletePeriodMatch) {
    const rawTarget = deletePeriodMatch[1].trim();
    const matchedPeriod = findMatchingPeriod(rawTarget);

    if (matchedPeriod) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'delete_period',
        target_name: matchedPeriod.name,
        summary: `Xóa hẳn Chu kỳ (Period): "${matchedPeriod.name}" cùng toàn bộ phân chia và công việc trực thuộc`,
        status: 'pending',
        details: {
          period_id: matchedPeriod.id,
          name: matchedPeriod.name,
        },
      });

      return {
        reply: `⚠️ **Cảnh báo xóa Chu kỳ:** Thao tác xóa hẳn chu kỳ (Period) **"${matchedPeriod.name}"** sẽ xóa vĩnh viễn chu kỳ này cùng tất cả phân chia và công việc trực thuộc. Bạn vui lòng kiểm tra và bấm duyệt bên dưới.`,
        proposals,
      };
    } else {
      return {
        reply: `Không tìm thấy chu kỳ nào khớp với "${rawTarget}". Danh sách chu kỳ hiện có: ${context.periods.map((p) => p.name).join(', ') || 'Chưa có'}.`,
        proposals: [],
      };
    }
  }

  // Match period creation: e.g. "tạo period mới Tháng 10", "thêm period Sprint 2", "tạo chu kỳ 2"
  const createPeriodMatch = text.match(
    /(?:tạo|thêm|add|lập)\s*(?:mới\s+)?(?:chu\s*kỳ|period|giai\s*đoạn)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (createPeriodMatch) {
    let periodName = createPeriodMatch[1].trim().replace(/^mới\s+/i, '');
    if (!periodName) periodName = `Period ${context.periods.length + 1}`;
    const targetWsId = context.active_workspace?.id || context.workspaces[0]?.id;
    const targetWsName = context.active_workspace?.name || context.workspaces[0]?.name || 'Hiện tại';

    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'create_period',
      target_name: periodName,
      summary: `Tạo chu kỳ (Period) mới: "${periodName}" tại phòng "${targetWsName}"`,
      status: 'pending',
      details: {
        name: periodName,
        workspace_id: targetWsId,
      },
    });

    return {
      reply: `Đã chuẩn bị đề xuất tạo chu kỳ (Period) **"${periodName}"** tại phòng **"${targetWsName}"**. Bạn vui lòng duyệt bên dưới.`,
      proposals,
    };
  }

  // Match period update: e.g. "sửa period 1 thành Sprint 1", "đổi tên period 1 sang Sprint 1"
  const updatePeriodMatch = text.match(
    /(?:sửa|đổi\s*tên|cập\s*nhật|đổi)\s*(?:chu\s*kỳ|period|giai\s*đoạn)\s*["'“]?([^"'\n]+?)["'”]?\s+(?:thành|sang|thành\s*tên)\s*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (updatePeriodMatch) {
    const rawTarget = updatePeriodMatch[1].trim();
    const newName = updatePeriodMatch[2].trim();
    const matchedPeriod = findMatchingPeriod(rawTarget);

    if (matchedPeriod) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'update_period',
        target_name: matchedPeriod.name,
        summary: `Đổi tên chu kỳ "${matchedPeriod.name}" thành "${newName}"`,
        status: 'pending',
        details: {
          period_id: matchedPeriod.id,
          name: newName,
        },
      });

      return {
        reply: `Đã chuẩn bị đề xuất đổi tên chu kỳ **"${matchedPeriod.name}"** thành **"${newName}"**. Bạn hãy xác nhận bên dưới nhé!`,
        proposals,
      };
    }
  }

  // Match division deletion: e.g. "xóa division Marketing", "xóa phân chia 1"
  const deleteDivisionMatch = text.match(
    /(?:xóa|hủy|bỏ|delete|remove)\s*(?:hẳn|vĩnh\s*viễn)?\s*(?:phân\s*chia|division|nhóm\s*việc)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (deleteDivisionMatch) {
    const rawTarget = deleteDivisionMatch[1].trim();
    const matchedDiv = findMatchingDivision(rawTarget);

    if (matchedDiv) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'delete_division',
        target_name: matchedDiv.name,
        summary: `Xóa phân chia (Division): "${matchedDiv.name}" cùng các cụm và công việc trực thuộc`,
        status: 'pending',
        details: {
          division_id: matchedDiv.id,
          name: matchedDiv.name,
        },
      });

      return {
        reply: `⚠️ **Cảnh báo xóa Phân chia:** Thao tác xóa phân chia (Division) **"${matchedDiv.name}"** sẽ xóa các cụm và công việc trong phân chia này. Vui lòng bấm duyệt bên dưới.`,
        proposals,
      };
    } else {
      return {
        reply: `Không tìm thấy phân chia nào khớp với "${rawTarget}". Danh sách hiện có: ${context.divisions.map((d) => d.name).join(', ') || 'Chưa có'}.`,
        proposals: [],
      };
    }
  }

  // Match division creation: e.g. "tạo division mới Kế toán", "thêm phân chia Design"
  const createDivisionMatch = text.match(
    /(?:tạo|thêm|add|lập)\s*(?:mới\s+)?(?:phân\s*chia|division|nhóm\s*việc)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (createDivisionMatch) {
    let divName = createDivisionMatch[1].trim().replace(/^mới\s+/i, '');
    if (!divName) divName = `Phân chia ${context.divisions.length + 1}`;
    const targetWsId = context.active_workspace?.id || context.workspaces[0]?.id;
    const targetPeriodId = context.active_period?.id || context.periods[0]?.id;

    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'create_division',
      target_name: divName,
      summary: `Tạo phân chia (Division) mới: "${divName}"`,
      status: 'pending',
      details: {
        name: divName,
        workspace_id: targetWsId,
        period_id: targetPeriodId,
      },
    });

    return {
      reply: `Đã lập đề xuất tạo phân chia (Division) mới **"${divName}"**. Bạn vui lòng duyệt bên dưới!`,
      proposals,
    };
  }

  // Match division update: e.g. "sửa division Marketing thành Tiếp thị"
  const updateDivisionMatch = text.match(
    /(?:sửa|đổi\s*tên|cập\s*nhật|đổi)\s*(?:phân\s*chia|division|nhóm\s*việc)\s*["'“]?([^"'\n]+?)["'”]?\s+(?:thành|sang|thành\s*tên)\s*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (updateDivisionMatch) {
    const rawTarget = updateDivisionMatch[1].trim();
    const newName = updateDivisionMatch[2].trim();
    const matchedDiv = findMatchingDivision(rawTarget);

    if (matchedDiv) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'update_division',
        target_name: matchedDiv.name,
        summary: `Đổi tên phân chia "${matchedDiv.name}" thành "${newName}"`,
        status: 'pending',
        details: {
          division_id: matchedDiv.id,
          name: newName,
        },
      });

      return {
        reply: `Đã chuẩn bị đề xuất đổi tên phân chia **"${matchedDiv.name}"** thành **"${newName}"**. Bạn hãy xác nhận bên dưới.`,
        proposals,
      };
    }
  }

  // Match cluster creation: e.g. "tạo cụm mới Nghiên cứu", "thêm cụm Kiểm thử"
  const createClusterMatch = text.match(
    /(?:tạo|thêm|add)\s*(?:mới\s+)?(?:cụm|cột|cluster)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (createClusterMatch) {
    const clusterName = createClusterMatch[1].trim().replace(/^mới\s+/i, '') || 'Cụm mới';
    const targetDivId = context.active_division?.id || context.divisions[0]?.id;

    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'create_cluster',
      target_name: clusterName,
      summary: `Tạo cụm việc mới: "${clusterName}"`,
      status: 'pending',
      details: {
        name: clusterName,
        division_id: targetDivId,
      },
    });

    return {
      reply: `Đã chuẩn bị đề xuất tạo cụm việc mới **"${clusterName}"**. Bạn vui lòng duyệt bên dưới!`,
      proposals,
    };
  }

  // Match cluster deletion: e.g. "xóa cụm 2", "xóa cụm Kiểm thử"
  const deleteClusterMatch = text.match(
    /(?:xóa|hủy|bỏ|delete)\s*(?:hẳn|vĩnh\s*viễn)?\s*(?:cụm|cột|cluster)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );

  if (deleteClusterMatch) {
    const rawCluster = deleteClusterMatch[1].trim();
    const num = parseInt(rawCluster, 10);
    const targetCluster =
      (!isNaN(num) && num > 0 && context.active_clusters && context.active_clusters[num - 1]) ||
      context.clusters.find((c) => c.name.toLowerCase().includes(rawCluster.toLowerCase()));

    if (targetCluster) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'delete_cluster',
        target_name: targetCluster.name,
        summary: `Xóa cụm việc: "${targetCluster.name}"`,
        status: 'pending',
        details: { cluster_id: targetCluster.id },
      });

      return {
        reply: `⚠️ Đã lập đề xuất xóa cụm việc **"${targetCluster.name}"**. Bạn vui lòng kiểm tra và duyệt bên dưới.`,
        proposals,
      };
    }
  }

  // Match direct board mode creation: e.g. "tạo chế độ bảng [name]", "tạo chế độ [name]"
  const createBoardModeMatch = text.match(
    /(?:tạo|thêm|add)\s*(?:mới\s+)?(?:chế\s*độ\s*bảng|chế\s*độ|board\s*mode)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );
  if (createBoardModeMatch) {
    const bmName = createBoardModeMatch[1].trim() || 'Kanban Tiến độ';
    const targetDivision = context.active_division || context.divisions[0];
    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'create_board_mode',
      target_name: bmName,
      summary: `Tạo Chế độ bảng mới: "${bmName}" (gồm 4 cột quy chuẩn: Cần làm, Đang thực hiện, Kiểm thử, Hoàn thành)`,
      status: 'pending',
      details: {
        name: bmName,
        division_id: targetDivision?.id,
        division_name: targetDivision?.name,
        clusters: [
          { name: '1. Cần làm', color: '#6366F1' },
          { name: '2. Đang thực hiện', color: '#F59E0B' },
          { name: '3. Kiểm thử', color: '#8B5CF6' },
          { name: '4. Hoàn thành', color: '#10B981' },
        ],
      },
    });
    return {
      reply: `Đã chuẩn bị đề xuất tạo Chế độ bảng (Board Mode) **"${bmName}"** cho phân chia **"${targetDivision?.name || 'hiện tại'}"** với 4 cột quy chuẩn. Bạn hãy duyệt bên dưới nhé!`,
      proposals,
    };
  }

  // Match direct board mode deletion: e.g. "xóa chế độ bảng [name]", "xóa chế độ [name]"
  const deleteBoardModeMatch = text.match(
    /(?:xóa|hủy|bỏ|delete)\s*(?:hẳn|vĩnh\s*viễn)?\s*(?:chế\s*độ\s*bảng|chế\s*độ|board\s*mode)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );
  if (deleteBoardModeMatch) {
    const bmTarget = deleteBoardModeMatch[1].trim().toLowerCase();
    const matchedBm = context.board_modes?.find(
      (b) => b.name.toLowerCase().includes(bmTarget) || b.id.toLowerCase() === bmTarget
    ) || context.active_board_mode;

    if (matchedBm) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'delete_board_mode',
        target_name: matchedBm.name,
        summary: `Xóa Chế độ bảng: "${matchedBm.name}"`,
        status: 'pending',
        details: { board_mode_id: matchedBm.id },
      });
      return {
        reply: `⚠️ Đã lập đề xuất xóa Chế độ bảng **"${matchedBm.name}"**. Bạn vui lòng kiểm tra và duyệt bên dưới nhé!`,
        proposals,
      };
    }
  }

  // Match workspace creation / deletion
  const createWsMatch = text.match(
    /(?:tạo|thêm|add)\s*(?:mới\s+)?(?:phòng|workspace|phòng\s*làm\s*việc)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );
  if (createWsMatch) {
    const wsName = createWsMatch[1].trim().replace(/^mới\s+/i, '') || 'Phòng mới';
    proposals.push({
      id: `proposal-${Date.now()}-1`,
      action: 'create_workspace',
      target_name: wsName,
      summary: `Tạo phòng làm việc mới: "${wsName}"`,
      status: 'pending',
      details: { name: wsName },
    });
    return {
      reply: `Đã chuẩn bị đề xuất tạo phòng làm việc **"${wsName}"**. Bạn hãy duyệt bên dưới nhé!`,
      proposals,
    };
  }

  const deleteWsMatch = text.match(
    /(?:xóa|hủy|bỏ|delete)\s*(?:hẳn|vĩnh\s*viễn)?\s*(?:phòng|workspace|phòng\s*làm\s*việc)\s*[:\-\s]*["'“]?([^"'\n]+?)["'”]?$/i
  );
  if (deleteWsMatch) {
    const wsTarget = deleteWsMatch[1].trim();
    const matchedWs = context.workspaces.find(
      (w) => w.name.toLowerCase().includes(wsTarget.toLowerCase()) || w.id === wsTarget
    );
    if (matchedWs) {
      proposals.push({
        id: `proposal-${Date.now()}-1`,
        action: 'delete_workspace',
        target_name: matchedWs.name,
        summary: `Xóa phòng làm việc: "${matchedWs.name}"`,
        status: 'pending',
        details: { workspace_id: matchedWs.id },
      });
      return {
        reply: `⚠️ Cảnh báo: Thao tác xóa phòng **"${matchedWs.name}"** sẽ xóa toàn bộ chu kỳ, phân chia và công việc trong phòng. Bạn hãy xác nhận bên dưới.`,
        proposals,
      };
    }
  }

  // Default conversational response according to persona
  return {
    reply: `Tôi là ${persona.name}. Tôi luôn sẵn sàng hỗ trợ bạn quản lý phòng, cụm, tạo/sửa/xóa task hoặc hẹn giờ báo thức. Hãy yêu cầu tôi bất kỳ lúc nào!`,
    proposals: [],
  };
}

/**
 * Execute request to backend API
 */
export async function sendMascotChatMessage(params: {
  message: string;
  persona: MascotPersona;
  settings: MascotAISettings;
  context: MascotContextPayload;
  chatHistory: MascotChatMessage[];
  signal?: AbortSignal;
}): Promise<{
  reply: string;
  proposals: ActionProposal[];
  aborted?: boolean;
  systemFallbackNotice?: string;
  modelUsed?: string;
  fellBack?: boolean;
}> {
  const { message, persona, settings, context, chatHistory, signal } = params;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (settings.apiKey && settings.apiKey.trim()) {
      headers['x-gemini-api-key'] = settings.apiKey.trim();
    }

    // Normalize any legacy or discontinued model names from previous localStorage saves
    let cleanModel = settings.model || 'gemini-flash-latest';
    if (cleanModel === 'gemini-2.5-flash' || cleanModel === 'gemini-3.0-flash' || cleanModel === 'gemini-3.6-flash') {
      cleanModel = 'gemini-flash-latest';
    } else if (cleanModel === 'gemini-2.5-flash-lite') {
      cleanModel = 'gemini-3.1-flash-lite';
    } else if (cleanModel === 'gemini-2.5-pro') {
      cleanModel = 'gemini-3.1-pro-preview';
    }

    const effectiveModel =
      settings.model === 'custom' && settings.customModelName?.trim()
        ? settings.customModelName.trim()
        : cleanModel;

    const res = await fetch('/api/mascot/chat', {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        message,
        personaPrompt: persona.prompt,
        contextData: context,
        chatHistory: chatHistory.slice(-8),
        model: effectiveModel,
        provider: settings.provider || 'gemini',
        userApiKey: settings.apiKey?.trim() || undefined,
        customBaseUrl: settings.customBaseUrl?.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}: Không thể gọi AI`);
    }

    const data = await res.json();
    return {
      reply: data.reply || 'Đã tiếp nhận yêu cầu.',
      proposals: Array.isArray(data.proposals) ? data.proposals : [],
      systemFallbackNotice: data.systemFallbackNotice,
      modelUsed: data.modelUsed,
      fellBack: data.fellBack,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      return {
        reply: '⏹ Đã dừng phản hồi theo yêu cầu của bạn.',
        proposals: [],
        aborted: true,
      };
    }

    console.warn('Backend Mascot AI call failed, falling back to local intent parser:', error);
    // Fallback to local rule-based intent parsing
    const fallback = parseLocalIntent(message, context, persona);
    if (fallback.proposals.length > 0) {
      return fallback;
    }
    // If no action matched and network failed, provide helpful message with error
    return {
      reply: `[${persona.name}]: Đã xảy ra lỗi kết nối AI: ${error.message || 'Lỗi mạng'}. Bạn có thể kiểm tra lại API Key trong mục Cài đặt Mascot, hoặc thử lại các câu lệnh trực tiếp như 'tạo task [tên]', 'đặt báo thức task [tên] lúc 09:00', v.v.`,
      proposals: [],
    };
  }
}

export interface TestConnectionResult {
  ok: boolean;
  provider: string;
  modelUsed?: string;
  latencyMs?: number;
  message: string;
  keySource?: 'custom' | 'system';
  code?: string;
  sampleReply?: string;
  errorDetails?: string;
  canFallbackToSystemKey?: boolean;
  timestamp?: string;
}

/**
 * Kiểm tra kết nối API tới AI Provider (Gemini, Claude, OpenAI, DeepSeek, OpenRouter, Custom)
 */
export async function testMascotAPIConnection(params: {
  provider: string;
  model?: string;
  apiKey?: string;
  customBaseUrl?: string;
}): Promise<TestConnectionResult> {
  const { provider, model, apiKey, customBaseUrl } = params;

  try {
    const res = await fetch('/api/mascot/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: provider || 'gemini',
        model: model || 'gemini-3.1-flash-lite',
        apiKey: apiKey?.trim() || undefined,
        customBaseUrl: customBaseUrl?.trim() || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        provider,
        modelUsed: data.modelUsed || model,
        latencyMs: data.latencyMs,
        code: data.code || `HTTP_${res.status}`,
        message: data.message || `Lỗi HTTP ${res.status} từ máy chủ`,
        errorDetails: data.errorDetails,
        canFallbackToSystemKey: data.canFallbackToSystemKey,
      };
    }

    return {
      ok: true,
      provider: data.provider || provider,
      modelUsed: data.modelUsed,
      latencyMs: data.latencyMs,
      keySource: data.keySource,
      message: data.message || 'Kết nối thành công!',
      sampleReply: data.sampleReply,
      timestamp: data.timestamp,
    };
  } catch (err: any) {
    return {
      ok: false,
      provider,
      message: `Không thể gửi yêu cầu kiểm tra tới máy chủ: ${err?.message || 'Lỗi mạng'}`,
      errorDetails: err?.message,
    };
  }
}

