import { useEffect, useReducer } from 'react';
import { State, Task, Color, Column, POINTS } from './types';
import { mostRecent6am } from './reset';

const STORAGE_KEY = 'planner-state-v1';

const initialState: State = {
  tasks: [],
  points: 0,
  pendingBank: 0,
  lastResetTs: 0,
};

type Action =
  | { type: 'add'; title: string; color: Color; column: Column }
  | { type: 'toggle'; id: string }
  | { type: 'cycle-color'; id: string }
  | { type: 'slice'; id: string }
  | { type: 'nah'; id: string }
  | { type: 'do'; id: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'spend'; amount: number }
  | { type: 'reset-completed'; ts: number };

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
      const task: Task = {
        id: uid(),
        title: action.title,
        color: action.color,
        column: action.column,
        completed: false,
        completedAt: null,
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
      if (!master || master.column !== 'ever') return state;
      const copy: Task = {
        id: uid(),
        title: master.title,
        color: master.color,
        column: 'today',
        completed: false,
        completedAt: null,
        parentId: master.id,
      };
      return { ...state, tasks: [...state.tasks, copy] };
    }
    case 'nah': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task || task.column !== 'today' || task.completed) return state;
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
      if (!master || master.column !== 'ever' || master.completed) return state;
      const tasks = state.tasks
        .filter((t) => !(t.parentId === master.id && t.column === 'today' && !t.completed))
        .map((t) => (t.id === master.id ? { ...t, column: 'today' as const } : t));
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
    case 'spend': {
      if (state.points < action.amount) return state;
      return { ...state, points: state.points - action.amount };
    }
    case 'reset-completed': {
      return {
        ...state,
        tasks: state.tasks.filter((t) => !t.completed),
        lastResetTs: action.ts,
      };
    }
  }
}

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      return { ...initialState, ...parsed };
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
      if (state.lastResetTs < recent6) {
        dispatch({ type: 'reset-completed', ts: recent6 });
      }
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [state.lastResetTs]);

  return { state, dispatch };
}
