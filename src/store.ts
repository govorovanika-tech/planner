import { useEffect, useReducer } from 'react';
import { ArchivedCompletion, State, Task, Color, Column, Routine, RoutineItem } from './types';
import { POINTS } from './types';
import { mostRecent6am } from './reset';

const STORAGE_KEY = 'planner-state-v1';
const SCHEMA_VERSION = 2;

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentDayNow(): string {
  return dayKeyOf(mostRecent6am(new Date()));
}

const initialState: State = {
  tasks: [],
  points: 0,
  pendingBank: 0,
  lastResetTs: 0,
  archivedCompletions: [],
  currentDay: currentDayNow(),
  viewDay: currentDayNow(),
  routines: [],
  groupNames: {},
  tomorrowVisible: false,
  schemaVersion: SCHEMA_VERSION,
};

type SliceTarget = 'today' | 'tomorrow';

type Action =
  | { type: 'add'; title: string; color: Color; column: Column; plannedMinutes?: number }
  | { type: 'toggle'; id: string }
  | { type: 'cycle-color'; id: string }
  | { type: 'slice'; id: string; target: SliceTarget }
  | { type: 'nah'; id: string }
  | { type: 'do'; id: string; target: SliceTarget }
  | { type: 'rename'; id: string; title: string }
  | { type: 'set-planned-minutes'; id: string; minutes: number | null }
  | { type: 'move-task'; id: string; targetColumn: Column; beforeId: string | null; mode: 'move' | 'slice' | 'copy' }
  | { type: 'move-block'; column: Column; blockKey: string | null; direction: 'up' | 'down' }
  | { type: 'set-view-day'; day: string }
  | { type: 'spend'; amount: number }
  | { type: 'archive-day'; ts: number }
  | { type: 'create-routine'; name: string; items: RoutineItem[] }
  | { type: 'rename-routine'; id: string; name: string }
  | { type: 'update-routine-items'; id: string; items: RoutineItem[] }
  | { type: 'move-routine'; id: string; direction: 'up' | 'down' }
  | { type: 'delete-routine'; id: string }
  | { type: 'add-routine-to-day'; routineId: string; target: SliceTarget }
  | { type: 'delete-group'; groupId: string }
  | { type: 'delete-task-hard'; id: string }
  | { type: 'show-tomorrow' };

const COLOR_CYCLE: Color[] = ['white', 'green', 'yellow', 'red'];

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function applyCompletion(state: State, task: Task): State {
  let points = state.points;
  let bank = state.pendingBank;
  let snapPoints: number;
  let snapBank: number;
  if (task.color === 'white') {
    snapPoints = 0;
    snapBank = 0;
  } else if (task.color === 'green') {
    points += POINTS.green;
    bank += POINTS.green;
    snapPoints = POINTS.green;
    snapBank = POINTS.green;
  } else if (task.color === 'red') {
    snapPoints = POINTS.red + bank;
    snapBank = -bank;
    points += snapPoints;
    bank = 0;
  } else {
    snapPoints = POINTS.yellow;
    snapBank = 0;
    points += snapPoints;
  }
  const completedAt = Date.now();
  const tasks = state.tasks.map((t) => {
    if (t.id === task.id) {
      return {
        ...t,
        completed: true,
        completedAt,
        completedSnapshot: { points: snapPoints, bank: snapBank },
      };
    }
    if (task.column === 'ever' && t.parentId === task.id && !t.completed) {
      return {
        ...t,
        completed: true,
        completedAt,
        completedSnapshot: { points: 0, bank: 0 },
      };
    }
    return t;
  });
  return { ...state, tasks, points, pendingBank: bank };
}

function applyUncompletion(state: State, task: Task): State {
  const snap = task.completedSnapshot ?? { points: 0, bank: 0 };
  const points = Math.max(0, state.points - snap.points);
  const pendingBank = Math.max(0, state.pendingBank - snap.bank);
  const tasks = state.tasks.map((t) =>
    t.id === task.id
      ? { ...t, completed: false, completedAt: null, completedSnapshot: undefined }
      : t,
  );
  return { ...state, tasks, points, pendingBank };
}

function pruneGroupName(
  groupNames: Record<string, string>,
  tasks: Task[],
  groupId: string,
): Record<string, string> {
  if (!groupNames[groupId]) return groupNames;
  const stillUsed = tasks.some((t) => t.groupId === groupId && !t.dayKey);
  if (stillUsed) return groupNames;
  const { [groupId]: _drop, ...rest } = groupNames;
  return rest;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const allowPlanned = action.column === 'today' || action.column === 'tomorrow';
      const task: Task = {
        id: uid(),
        title: action.title,
        color: action.color,
        column: action.column,
        completed: false,
        completedAt: null,
        ...(allowPlanned && action.plannedMinutes
          ? { plannedMinutes: action.plannedMinutes }
          : {}),
      };
      return { ...state, tasks: [...state.tasks, task] };
    }
    case 'toggle': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      return task.completed
        ? applyUncompletion(state, task)
        : applyCompletion(state, task);
    }
    case 'cycle-color': {
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.id || t.completed) return t;
          const next = COLOR_CYCLE[(COLOR_CYCLE.indexOf(t.color) + 1) % COLOR_CYCLE.length];
          return { ...t, color: next };
        }),
      };
    }
    case 'slice': {
      const master = state.tasks.find((t) => t.id === action.id);
      if (!master || master.column !== 'ever' || master.dayKey) return state;
      const copy: Task = {
        id: uid(),
        title: master.title,
        color: master.color,
        column: action.target,
        completed: false,
        completedAt: null,
        parentId: master.id,
        ...(master.plannedMinutes != null ? { plannedMinutes: master.plannedMinutes } : {}),
      };
      const tomorrowVisible =
        action.target === 'tomorrow' ? true : state.tomorrowVisible;
      return { ...state, tasks: [...state.tasks, copy], tomorrowVisible };
    }
    case 'nah': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      if (task.dayKey) {
        return { ...state, tasks: state.tasks.filter((t) => t.id !== task.id) };
      }
      if (task.completed) return state;
      if (task.column === 'ever') {
        const tasks = state.tasks
          .filter((t) => t.id !== task.id)
          .map((t) => {
            if (t.parentId !== task.id) return t;
            const { parentId: _drop, ...rest } = t;
            return rest;
          });
        return { ...state, tasks };
      }
      if (task.column !== 'today' && task.column !== 'tomorrow') return state;
      if (task.parentId) {
        const tasks = state.tasks.filter((t) => t.id !== task.id);
        const groupNames = task.groupId
          ? pruneGroupName(state.groupNames, tasks, task.groupId)
          : state.groupNames;
        return { ...state, tasks, groupNames };
      }
      const tasks = state.tasks.map((t) => {
        if (t.id !== task.id) return t;
        const { groupId: _drop, ...rest } = t;
        return { ...rest, column: 'ever' as Column };
      });
      const groupNames = task.groupId
        ? pruneGroupName(state.groupNames, tasks, task.groupId)
        : state.groupNames;
      return { ...state, tasks, groupNames };
    }
    case 'do': {
      const master = state.tasks.find((t) => t.id === action.id);
      if (!master || master.column !== 'ever' || master.completed || master.dayKey) return state;
      const tasks = state.tasks
        .filter(
          (t) =>
            !(
              t.parentId === master.id &&
              !t.dayKey &&
              (t.column === 'today' || t.column === 'tomorrow') &&
              !t.completed
            ),
        )
        .map((t) => (t.id === master.id ? { ...t, column: action.target } : t));
      const tomorrowVisible =
        action.target === 'tomorrow' ? true : state.tomorrowVisible;
      return { ...state, tasks, tomorrowVisible };
    }
    case 'rename': {
      const title = action.title.trim();
      if (!title) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id === action.id || t.parentId === action.id) {
            return { ...t, title };
          }
          return t;
        }),
      };
    }
    case 'set-planned-minutes': {
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.id) return t;
          if (action.minutes == null) {
            const { plannedMinutes: _drop, ...rest } = t;
            return rest;
          }
          return { ...t, plannedMinutes: action.minutes };
        }),
      };
    }
    case 'move-task': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task || task.dayKey) return state;
      const targetCol = action.targetColumn;
      const tomorrowVisible =
        targetCol === 'tomorrow' ? true : state.tomorrowVisible;

      if (action.mode === 'slice') {
        if (task.column !== 'ever' || (targetCol !== 'today' && targetCol !== 'tomorrow')) {
          return state;
        }
        const copy: Task = {
          id: uid(),
          title: task.title,
          color: task.color,
          column: targetCol,
          completed: false,
          completedAt: null,
          parentId: task.id,
          ...(task.plannedMinutes != null ? { plannedMinutes: task.plannedMinutes } : {}),
        };
        const at = action.beforeId
          ? state.tasks.findIndex((t) => t.id === action.beforeId)
          : -1;
        const tasks = at >= 0
          ? [...state.tasks.slice(0, at), copy, ...state.tasks.slice(at)]
          : [...state.tasks, copy];
        return { ...state, tasks, tomorrowVisible };
      }

      if (action.mode === 'copy') {
        if (targetCol !== 'today' && targetCol !== 'tomorrow') return state;
        const copy: Task = {
          id: uid(),
          title: task.title,
          color: task.color,
          column: targetCol,
          completed: false,
          completedAt: null,
          ...(task.plannedMinutes != null ? { plannedMinutes: task.plannedMinutes } : {}),
        };
        const at = action.beforeId
          ? state.tasks.findIndex((t) => t.id === action.beforeId)
          : -1;
        const tasks = at >= 0
          ? [...state.tasks.slice(0, at), copy, ...state.tasks.slice(at)]
          : [...state.tasks, copy];
        return { ...state, tasks, tomorrowVisible };
      }

      if (task.completed && task.column !== targetCol) return state;

      const crossColumn = task.column !== targetCol;
      const updated: Task = (() => {
        if (!crossColumn) return task;
        if (task.groupId) {
          const { groupId: _drop, ...rest } = task;
          return { ...rest, column: targetCol };
        }
        return { ...task, column: targetCol };
      })();
      let tasks = state.tasks.filter((t) => t.id !== task.id);
      const at = action.beforeId
        ? tasks.findIndex((t) => t.id === action.beforeId)
        : -1;
      tasks = at >= 0
        ? [...tasks.slice(0, at), updated, ...tasks.slice(at)]
        : [...tasks, updated];

      if (task.column === 'ever' && (targetCol === 'today' || targetCol === 'tomorrow')) {
        tasks = tasks.filter(
          (t) =>
            !(
              t.id !== updated.id &&
              t.parentId === task.id &&
              !t.dayKey &&
              (t.column === 'today' || t.column === 'tomorrow') &&
              !t.completed
            ),
        );
      }

      const groupNames = crossColumn && task.groupId
        ? pruneGroupName(state.groupNames, tasks, task.groupId)
        : state.groupNames;

      return { ...state, tasks, tomorrowVisible, groupNames };
    }
    case 'move-block': {
      const indices: number[] = [];
      const colTasks: Task[] = [];
      state.tasks.forEach((t, i) => {
        if (t.column === action.column && !t.dayKey) {
          indices.push(i);
          colTasks.push(t);
        }
      });
      if (colTasks.length === 0) return state;
      const keyOf = (t: Task): string | null =>
        t.groupId && state.groupNames[t.groupId] ? t.groupId : null;
      const order: (string | null)[] = [];
      const seen = new Set<string | null>();
      for (const t of colTasks) {
        const k = keyOf(t);
        if (!seen.has(k)) {
          seen.add(k);
          order.push(k);
        }
      }
      const idx = order.indexOf(action.blockKey);
      if (idx < 0) return state;
      const swap = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= order.length) return state;
      [order[idx], order[swap]] = [order[swap], order[idx]];
      const byKey = new Map<string | null, Task[]>();
      for (const t of colTasks) {
        const k = keyOf(t);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(t);
      }
      const reordered: Task[] = [];
      for (const k of order) {
        const m = byKey.get(k);
        if (m) reordered.push(...m);
      }
      const tasks = state.tasks.slice();
      indices.forEach((gi, k) => {
        tasks[gi] = reordered[k];
      });
      return { ...state, tasks };
    }
    case 'set-view-day': {
      return { ...state, viewDay: action.day };
    }
    case 'spend': {
      if (state.points < action.amount) return state;
      return { ...state, points: state.points - action.amount };
    }
    case 'archive-day': {
      const oldDay = state.currentDay;
      const newDay = dayKeyOf(action.ts);
      if (oldDay === newDay) return state;
      const newlyArchived: ArchivedCompletion[] = [];
      const tasks: Task[] = [];
      for (const t of state.tasks) {
        if (t.column === 'ever' && t.completed && !t.dayKey) {
          continue;
        }
        if (t.column === 'today' && !t.dayKey) {
          const stamped: Task = { ...t, dayKey: oldDay };
          tasks.push(stamped);
          if (stamped.completed && stamped.completedSnapshot && stamped.completedSnapshot.points > 0) {
            newlyArchived.push({
              id: stamped.id,
              color: stamped.color,
              snapshot: stamped.completedSnapshot,
            });
          }
          continue;
        }
        if (t.column === 'tomorrow' && !t.dayKey) {
          tasks.push({ ...t, column: 'today' });
          continue;
        }
        tasks.push(t);
      }
      const usedGroupIds = new Set<string>();
      for (const t of tasks) {
        if (t.groupId && !t.dayKey) usedGroupIds.add(t.groupId);
      }
      const groupNames: Record<string, string> = {};
      for (const [gid, name] of Object.entries(state.groupNames)) {
        if (usedGroupIds.has(gid)) groupNames[gid] = name;
      }
      return {
        ...state,
        tasks,
        archivedCompletions: [...state.archivedCompletions, ...newlyArchived],
        lastResetTs: action.ts,
        currentDay: newDay,
        viewDay: newDay,
        tomorrowVisible: false,
        groupNames,
      };
    }
    case 'create-routine': {
      const routine: Routine = {
        id: uid(),
        name: action.name.trim() || 'Untitled',
        items: action.items,
        createdAt: Date.now(),
      };
      return { ...state, routines: [...state.routines, routine] };
    }
    case 'rename-routine': {
      const name = action.name.trim();
      if (!name) return state;
      return {
        ...state,
        routines: state.routines.map((r) =>
          r.id === action.id ? { ...r, name } : r,
        ),
      };
    }
    case 'update-routine-items': {
      return {
        ...state,
        routines: state.routines.map((r) =>
          r.id === action.id ? { ...r, items: action.items } : r,
        ),
      };
    }
    case 'move-routine': {
      const idx = state.routines.findIndex((r) => r.id === action.id);
      if (idx < 0) return state;
      const swapWith = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= state.routines.length) return state;
      const routines = state.routines.slice();
      [routines[idx], routines[swapWith]] = [routines[swapWith], routines[idx]];
      return { ...state, routines };
    }
    case 'delete-routine': {
      return {
        ...state,
        routines: state.routines.filter((r) => r.id !== action.id),
      };
    }
    case 'add-routine-to-day': {
      const routine = state.routines.find((r) => r.id === action.routineId);
      if (!routine || routine.items.length === 0) return state;
      const groupId = uid();
      const newTasks: Task[] = routine.items.map((item) => ({
        id: uid(),
        title: item.title,
        color: item.color,
        column: action.target,
        completed: false,
        completedAt: null,
        groupId,
        ...(item.plannedMinutes != null ? { plannedMinutes: item.plannedMinutes } : {}),
      }));
      const tomorrowVisible =
        action.target === 'tomorrow' ? true : state.tomorrowVisible;
      return {
        ...state,
        tasks: [...state.tasks, ...newTasks],
        groupNames: { ...state.groupNames, [groupId]: routine.name },
        tomorrowVisible,
      };
    }
    case 'delete-group': {
      const tasks = state.tasks.filter(
        (t) => !(t.groupId === action.groupId && !t.dayKey),
      );
      const groupNames = pruneGroupName(state.groupNames, tasks, action.groupId);
      return { ...state, tasks, groupNames };
    }
    case 'delete-task-hard': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      let next = state;
      if (task.completed && task.completedSnapshot) {
        next = applyUncompletion(state, task);
      }
      const tasks = next.tasks.filter((t) => t.id !== action.id);
      const groupNames = task.groupId
        ? pruneGroupName(next.groupNames, tasks, task.groupId)
        : next.groupNames;
      return { ...next, tasks, groupNames };
    }
    case 'show-tomorrow': {
      return { ...state, tomorrowVisible: true };
    }
  }
}

function migrate(parsed: Record<string, unknown>): State {
  const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
  const merged: State = { ...initialState, ...(parsed as Partial<State>) };
  if (!merged.currentDay) merged.currentDay = currentDayNow();
  if (!merged.viewDay) merged.viewDay = merged.currentDay;
  if (!merged.routines) merged.routines = [];
  if (!merged.groupNames) merged.groupNames = {};

  if (version < 2) {
    const liveRoutineTasks: Task[] = [];
    const remaining: Task[] = [];
    for (const t of merged.tasks) {
      if ((t.column as string) === 'routine' && !t.dayKey) {
        liveRoutineTasks.push(t);
      } else {
        remaining.push(t);
      }
    }
    if (liveRoutineTasks.length > 0) {
      const routine: Routine = {
        id: uid(),
        name: 'Default',
        items: liveRoutineTasks.map((t) => ({
          id: uid(),
          title: t.title,
          color: t.color,
          ...(t.plannedMinutes != null ? { plannedMinutes: t.plannedMinutes } : {}),
        })),
        createdAt: Date.now(),
      };
      merged.routines = [routine, ...merged.routines];
    }
    merged.tasks = remaining;
    merged.tomorrowVisible = merged.tasks.some(
      (t) => t.column === 'tomorrow' && !t.dayKey,
    );
    merged.schemaVersion = 2;
  }

  return merged;
}

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return migrate(parsed);
    }
  } catch {
    // fall through to default
  }
  return initialState;
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    function check() {
      const recent6 = mostRecent6am(new Date());
      const today = dayKeyOf(recent6);
      if (state.currentDay !== today) {
        dispatch({ type: 'archive-day', ts: recent6 });
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [state.currentDay]);

  return { state, dispatch };
}
