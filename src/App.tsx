import { useMemo, useState } from 'react';
import { useStore } from './store';
import { Column, Task } from './types';
import { ProgressBar, ProgressEntry } from './components/ProgressBar';
import { GroupInfo, TaskColumn } from './components/TaskColumn';
import { RoutineSidebar } from './components/RoutineSidebar';
import { PlanTomorrowButton } from './components/PlanTomorrowButton';

type PendingDrop = {
  id: string;
  targetColumn: 'today' | 'tomorrow';
  beforeId: string | null;
  x: number;
  y: number;
};

function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function deriveGroups(tasks: Task[], groupNames: Record<string, string>): GroupInfo[] {
  const seen = new Set<string>();
  const out: GroupInfo[] = [];
  for (const t of tasks) {
    if (!t.groupId || seen.has(t.groupId)) continue;
    const name = groupNames[t.groupId];
    if (!name) continue;
    seen.add(t.groupId);
    out.push({ groupId: t.groupId, name });
  }
  return out;
}

export default function App() {
  const { state, dispatch } = useStore();
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);

  function handleDrop(
    targetColumn: Column,
    id: string,
    beforeId: string | null,
    x: number,
    y: number,
  ) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    if (
      task.column === 'ever' &&
      !task.dayKey &&
      (targetColumn === 'today' || targetColumn === 'tomorrow')
    ) {
      setPendingDrop({ id, targetColumn, beforeId, x, y });
      return;
    }
    dispatch({ type: 'move-task', id, targetColumn, beforeId, mode: 'move' });
  }

  function resolvePending(mode: 'move' | 'slice') {
    if (!pendingDrop) return;
    dispatch({
      type: 'move-task',
      id: pendingDrop.id,
      targetColumn: pendingDrop.targetColumn,
      beforeId: pendingDrop.beforeId,
      mode,
    });
    setPendingDrop(null);
  }

  const liveChildParentIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.tasks) {
      if (
        t.parentId &&
        !t.dayKey &&
        (t.column === 'today' || t.column === 'tomorrow')
      ) {
        set.add(t.parentId);
      }
    }
    return set;
  }, [state.tasks]);

  const archivedDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.tasks) {
      if (t.dayKey) set.add(t.dayKey);
    }
    return Array.from(set).sort();
  }, [state.tasks]);

  const maxOffset = archivedDayKeys.length;
  const clampedOffset = Math.min(historyOffset, maxOffset);

  function dayKeyForOffset(offset: number): string | null {
    if (offset <= 0) return state.currentDay;
    const idx = archivedDayKeys.length - offset;
    return idx >= 0 ? archivedDayKeys[idx] : null;
  }

  const todayTasks = state.tasks.filter(
    (t) => t.column === 'today' && !t.dayKey,
  );
  const tomorrowTasks = state.tasks.filter(
    (t) => t.column === 'tomorrow' && !t.dayKey,
  );
  const everTasks = state.tasks.filter(
    (t) => t.column === 'ever' && !t.dayKey,
  );

  const todayGroups = useMemo(
    () => deriveGroups(todayTasks, state.groupNames),
    [todayTasks, state.groupNames],
  );
  const tomorrowGroups = useMemo(
    () => deriveGroups(tomorrowTasks, state.groupNames),
    [tomorrowTasks, state.groupNames],
  );

  const liveCompletions: ProgressEntry[] = state.tasks
    .filter(
      (t) =>
        t.completed &&
        t.completedAt != null &&
        t.completedSnapshot &&
        !t.dayKey,
    )
    .sort((a, b) => a.completedAt! - b.completedAt!)
    .map((t) => ({ id: t.id, color: t.color, snapshot: t.completedSnapshot! }));
  const archivedCompletions: ProgressEntry[] = state.archivedCompletions.map(
    (a) => ({ id: a.id, color: a.color, snapshot: a.snapshot }),
  );
  const completions: ProgressEntry[] = [...archivedCompletions, ...liveCompletions];

  const showTomorrowColumn =
    state.tomorrowVisible || tomorrowTasks.length > 0;

  function renderPastColumn(dayKey: string) {
    const past = state.tasks.filter((t) => t.dayKey === dayKey);
    return (
      <TaskColumn
        key={`past-${dayKey}`}
        title={formatDayLabel(dayKey)}
        tasks={past}
        onToggle={(id) => dispatch({ type: 'toggle', id })}
        onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
        onRename={(id, title) => dispatch({ type: 'rename', id, title })}
        onNah={(id) => dispatch({ type: 'nah', id })}
        onChangePlannedMinutes={(id, minutes) =>
          dispatch({ type: 'set-planned-minutes', id, minutes })
        }
        emptyText="no tasks on this day"
      />
    );
  }

  function renderTodayColumn() {
    return (
      <TaskColumn
        key="today"
        title="Today"
        tasks={todayTasks}
        groups={todayGroups}
        liveChildParentIds={liveChildParentIds}
        onAdd={(title, color) =>
          dispatch({ type: 'add', title, color, column: 'today' })
        }
        onToggle={(id) => dispatch({ type: 'toggle', id })}
        onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
        onRename={(id, title) => dispatch({ type: 'rename', id, title })}
        onNah={(id) => dispatch({ type: 'nah', id })}
        onHardDelete={(id) => dispatch({ type: 'delete-task-hard', id })}
        onDeleteGroup={(groupId) => dispatch({ type: 'delete-group', groupId })}
        onMoveBlock={(blockKey, direction) =>
          dispatch({ type: 'move-block', column: 'today', blockKey, direction })
        }
        onChangePlannedMinutes={(id, minutes) =>
          dispatch({ type: 'set-planned-minutes', id, minutes })
        }
        onDropTask={(id, beforeId, x, y) => handleDrop('today', id, beforeId, x, y)}
        showTotalTime
      />
    );
  }

  function renderTomorrowColumn() {
    if (!showTomorrowColumn) {
      return (
        <PlanTomorrowButton
          key="plan-tomorrow"
          onClick={() => dispatch({ type: 'show-tomorrow' })}
        />
      );
    }
    return (
      <TaskColumn
        key="tomorrow"
        title="Tomorrow"
        tasks={tomorrowTasks}
        groups={tomorrowGroups}
        liveChildParentIds={liveChildParentIds}
        onAdd={(title, color) =>
          dispatch({ type: 'add', title, color, column: 'tomorrow' })
        }
        onToggle={(id) => dispatch({ type: 'toggle', id })}
        onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
        onRename={(id, title) => dispatch({ type: 'rename', id, title })}
        onNah={(id) => dispatch({ type: 'nah', id })}
        onHardDelete={(id) => dispatch({ type: 'delete-task-hard', id })}
        onDeleteGroup={(groupId) => dispatch({ type: 'delete-group', groupId })}
        onMoveBlock={(blockKey, direction) =>
          dispatch({ type: 'move-block', column: 'tomorrow', blockKey, direction })
        }
        onChangePlannedMinutes={(id, minutes) =>
          dispatch({ type: 'set-planned-minutes', id, minutes })
        }
        onDropTask={(id, beforeId, x, y) => handleDrop('tomorrow', id, beforeId, x, y)}
        showTotalTime
      />
    );
  }

  function renderEverColumn() {
    return (
      <TaskColumn
        key="ever"
        title="Ever"
        tasks={everTasks}
        liveChildParentIds={liveChildParentIds}
        onAdd={(title, color) =>
          dispatch({ type: 'add', title, color, column: 'ever' })
        }
        onToggle={(id) => dispatch({ type: 'toggle', id })}
        onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
        onRename={(id, title) => dispatch({ type: 'rename', id, title })}
        onSlice={(id, target) => dispatch({ type: 'slice', id, target })}
        onDo={(id, target) => dispatch({ type: 'do', id, target })}
        onHardDelete={(id) => dispatch({ type: 'delete-task-hard', id })}
        onChangePlannedMinutes={(id, minutes) =>
          dispatch({ type: 'set-planned-minutes', id, minutes })
        }
        onDropTask={(id, beforeId, x, y) => handleDrop('ever', id, beforeId, x, y)}
      />
    );
  }

  let mainColumns: React.ReactNode;
  if (clampedOffset === 0) {
    mainColumns = (
      <>
        {renderTodayColumn()}
        {renderTomorrowColumn()}
        {renderEverColumn()}
      </>
    );
  } else if (clampedOffset === 1) {
    const yesterday = dayKeyForOffset(1);
    mainColumns = (
      <>
        {yesterday && renderPastColumn(yesterday)}
        {renderTodayColumn()}
        {renderEverColumn()}
      </>
    );
  } else {
    const leftKey = dayKeyForOffset(clampedOffset);
    const rightKey = dayKeyForOffset(clampedOffset - 1);
    mainColumns = (
      <>
        {leftKey && renderPastColumn(leftKey)}
        {rightKey && renderPastColumn(rightKey)}
        {renderEverColumn()}
      </>
    );
  }

  const headerLabel = (() => {
    if (clampedOffset === 0) return 'Today';
    if (clampedOffset === 1) {
      const k = dayKeyForOffset(1);
      return k ? `${formatDayLabel(k)} · Today` : 'Today';
    }
    const left = dayKeyForOffset(clampedOffset);
    const right = dayKeyForOffset(clampedOffset - 1);
    if (left && right) return `${formatDayLabel(left)} · ${formatDayLabel(right)}`;
    return 'History';
  })();

  return (
    <div className="app">
      <header>
        <div className="header-top">
          <h1>Planner</h1>
          <button
            type="button"
            className="routines-toggle"
            onClick={() => setSidebarOpen(true)}
          >
            Routines
          </button>
        </div>
        <ProgressBar
          points={state.points}
          pendingBank={state.pendingBank}
          completions={completions}
          onSpend={(amount) => dispatch({ type: 'spend', amount })}
        />
        <div className="day-nav">
          <button
            type="button"
            className="day-arrow"
            onClick={() => setHistoryOffset((o) => Math.min(maxOffset, o + 1))}
            disabled={clampedOffset >= maxOffset}
            aria-label="previous day"
          >
            ←
          </button>
          <span className="day-label">{headerLabel}</span>
          <button
            type="button"
            className="day-arrow"
            onClick={() => setHistoryOffset((o) => Math.max(0, o - 1))}
            disabled={clampedOffset === 0}
            aria-label="next day"
          >
            →
          </button>
          {clampedOffset >= 2 && (
            <button
              type="button"
              className="day-arrow day-today-jump"
              onClick={() => setHistoryOffset(0)}
            >
              Today
            </button>
          )}
        </div>
      </header>
      <main className="columns">{mainColumns}</main>

      <RoutineSidebar
        open={sidebarOpen}
        routines={state.routines}
        onClose={() => setSidebarOpen(false)}
        onCreate={(name, items) => dispatch({ type: 'create-routine', name, items })}
        onRename={(id, name) => dispatch({ type: 'rename-routine', id, name })}
        onUpdateItems={(id, items) =>
          dispatch({ type: 'update-routine-items', id, items })
        }
        onMove={(id, direction) =>
          dispatch({ type: 'move-routine', id, direction })
        }
        onDelete={(id) => dispatch({ type: 'delete-routine', id })}
        onAddToDay={(routineId, target) =>
          dispatch({ type: 'add-routine-to-day', routineId, target })
        }
      />

      {pendingDrop && (
        <div className="drop-picker-backdrop" onClick={() => setPendingDrop(null)}>
          <div
            className="drop-picker"
            style={{ left: pendingDrop.x + 8, top: pendingDrop.y + 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => resolvePending('slice')}>
              slice
            </button>
            <button type="button" onClick={() => resolvePending('move')}>
              move
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
