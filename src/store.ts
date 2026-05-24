import { useEffect, useReducer } from 'react';
import { ArchivedCompletion, State, Task, Color, Column } from './types';
import { POINTS } from './types';
import { mostRecent6am } from './reset';

const STORAGE_KEY = 'planner-state-v1';

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
  | { type: 'set-view-day'; day: string }
  | { type: 'spend'; amount: number }
  | { type: 'archive-day'; ts: number };

const COLOR_CYCLE: Color[] = ['green', 'yellow', 'red'];

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function applyCompletion(state: State, task: Task): State {
  let points = state.points;
  let bank = state.pendingBank;
  let snapPoints: number;
  let snapBank: number;
  if (task.color === 'green') {
    points += POINTS.green;
    bank += POINTS.green;
    snapPoints = POINTS.green;
    snapBank = POINTS.green;
  } else {
    snapPoints = POINTS[task.color] + bank;
    snapBank = -bank;
    points += snapPoints;
    bank = 0;
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

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const allowPlanned = action.column === 'today';
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
      };
      return { ...state, tasks: [...state.tasks, copy] };
    }
    case 'nah': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      if (task.dayKey) {
        return { ...state, tasks: state.tasks.filter((t) => t.id !== task.id) };
      }
      if (task.column !== 'today' && task.column !== 'tomorrow') return state;
      if (task.completed) return state;
      if (task.parentId) {
        return { ...state, tasks: state.tasks.filter((t) => t.id !== task.id) };
      }
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, column: 'ever' } : t,
        ),
      };
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
      return { ...state, tasks };
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
          if (t.column === 'ever' && !t.dayKey) return t;
          if (action.minutes == null) {
            const { plannedMinutes: _drop, ...rest } = t;
            return rest;
          }
          return { ...t, plannedMinutes: action.minutes };
        }),
      };
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
      return {
        ...state,
        tasks,
        archivedCompletions: [...state.archivedCompletions, ...newlyArchived],
        lastResetTs: action.ts,
        currentDay: newDay,
        viewDay: newDay,
      };
    }
  }
}

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      const merged = { ...initialState, ...parsed };
      if (!merged.currentDay) merged.currentDay = currentDayNow();
      if (!merged.viewDay) merged.viewDay = merged.currentDay;
      return merged;
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
