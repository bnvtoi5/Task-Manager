import { Task, TaskPriority, BoardMode } from '../types';

export const getWeekdayClusterId = (dueDateStr?: string | null): string => {
  if (!dueDateStr) return 'wd-mon';
  try {
    const d = new Date(dueDateStr);
    if (isNaN(d.getTime())) return 'wd-mon';
    const day = d.getDay(); // 0: Sunday, 1: Monday, ...
    const map: Record<number, string> = {
      1: 'wd-mon',
      2: 'wd-tue',
      3: 'wd-wed',
      4: 'wd-thu',
      5: 'wd-fri',
      6: 'wd-sat',
      0: 'wd-sun',
    };
    return map[day] || 'wd-mon';
  } catch {
    return 'wd-mon';
  }
};

export const getPriorityClusterId = (priority: TaskPriority): string => {
  if (priority === 'urgent') return 'pr-urgent';
  if (priority === 'high') return 'pr-high';
  if (priority === 'medium') return 'pr-medium';
  if (priority === 'low') return 'pr-low';
  return 'pr-medium';
};

export const getTaskClusterInMode = (
  task: Task,
  modeId: string,
  modeClusters: { id: string }[]
): string => {
  if (task.mode_clusters && task.mode_clusters[modeId]) {
    return task.mode_clusters[modeId];
  }
  if (modeId === 'kanban') {
    return task.cluster_id;
  }
  if (modeId === 'weekday') {
    return getWeekdayClusterId(task.due_date);
  }
  if (modeId === 'priority') {
    return getPriorityClusterId(task.priority);
  }
  return modeClusters[0]?.id || '';
};
