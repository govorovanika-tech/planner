export type Color = 'green' | 'yellow' | 'red';
export type Column = 'today' | 'tomorrow' | 'ever';

export type CompletionSnapshot = {
  points: number;
  bank: number;
};

export type Task = {
  id: string;
  title: string;
  color: Color;
  column: Column;
  completed: boolean;
  completedAt: number | null;
  completedSnapshot?: CompletionSnapshot;
  parentId?: string;
  plannedMinutes?: number;
  dayKey?: string;
};

export type ArchivedCompletion = {
  id: string;
  color: Color;
  snapshot: CompletionSnapshot;
};

export type State = {
  tasks: Task[];
  points: number;
  pendingBank: number;
  lastResetTs: number;
  archivedCompletions: ArchivedCompletion[];
  currentDay: string;
  viewDay: string;
};

export const POINTS: Record<Color, number> = {
  green: 50,
  yellow: 100,
  red: 200,
};

export const MILESTONES = [5000, 10000, 20000, 50000] as const;
export const BAR_MAX = 50000;

export const PLANNED_MINUTES_OPTIONS = [
  15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
] as const;

export function formatPlannedMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h${min}m`;
}
