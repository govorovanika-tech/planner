export type Color = 'white' | 'green' | 'yellow' | 'red';
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
  groupId?: string;
};

export type RoutineItem = {
  id: string;
  title: string;
  color: Color;
  plannedMinutes?: number;
};

export type Routine = {
  id: string;
  name: string;
  items: RoutineItem[];
  createdAt: number;
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
  routines: Routine[];
  groupNames: Record<string, string>;
  tomorrowVisible: boolean;
  schemaVersion: number;
};

export const POINTS: Record<Color, number> = {
  white: 0,
  green: 50,
  yellow: 100,
  red: 200,
};

export const MILESTONES = [5000, 10000, 20000, 50000] as const;
export const BAR_MAX = 50000;

export const PLANNED_MINUTES_OPTIONS = [
  5, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180,
  210, 240, 270, 300, 330, 360,
] as const;

export function formatPlannedMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h${min}m`;
}
