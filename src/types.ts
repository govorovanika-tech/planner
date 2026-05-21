export type Color = 'green' | 'yellow' | 'red';
export type Column = 'today' | 'ever';

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
};

export const POINTS: Record<Color, number> = {
  green: 50,
  yellow: 100,
  red: 200,
};

export const MILESTONES = [5000, 10000, 20000, 50000] as const;
export const BAR_MAX = 50000;
