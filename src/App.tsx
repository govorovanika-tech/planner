import { useMemo } from 'react';
import { useStore } from './store';
import { ProgressBar, ProgressEntry } from './components/ProgressBar';
import { TaskColumn } from './components/TaskColumn';

function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function App() {
  const { state, dispatch } = useStore();
  const isToday = state.viewDay === state.currentDay;

  const archivedDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const t of state.tasks) {
      if (t.dayKey) set.add(t.dayKey);
    }
    return Array.from(set).sort();
  }, [state.tasks]);

  const prevDay = useMemo(() => {
    const earlier = archivedDayKeys.filter((k) => k < state.viewDay);
    return earlier.length ? earlier[earlier.length - 1] : null;
  }, [archivedDayKeys, state.viewDay]);

  const nextDay = useMemo(() => {
    if (isToday) return null;
    const later = archivedDayKeys.filter((k) => k > state.viewDay);
    if (later.length) return later[0];
    return state.currentDay;
  }, [archivedDayKeys, state.viewDay, state.currentDay, isToday]);

  const todayTasks = state.tasks.filter(
    (t) => t.column === 'today' && !t.dayKey,
  );
  const tomorrowTasks = state.tasks.filter(
    (t) => t.column === 'tomorrow' && !t.dayKey,
  );
  const everTasks = state.tasks.filter(
    (t) => t.column === 'ever' && !t.dayKey,
  );
  const pastTasks = state.tasks.filter((t) => t.dayKey === state.viewDay);

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

  return (
    <div className="app">
      <header>
        <h1>Planner</h1>
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
            onClick={() => prevDay && dispatch({ type: 'set-view-day', day: prevDay })}
            disabled={!prevDay}
            aria-label="previous day"
          >
            ←
          </button>
          <span className="day-label">
            {isToday ? 'Today' : formatDayLabel(state.viewDay)}
          </span>
          <button
            type="button"
            className="day-arrow"
            onClick={() => nextDay && dispatch({ type: 'set-view-day', day: nextDay })}
            disabled={!nextDay}
            aria-label="next day"
          >
            →
          </button>
        </div>
      </header>
      <main className={`columns ${isToday ? 'columns-three' : 'columns-two'}`}>
        {isToday ? (
          <>
            <TaskColumn
              title="Today"
              tasks={todayTasks}
              onAdd={(title, color) =>
                dispatch({ type: 'add', title, color, column: 'today' })
              }
              onToggle={(id) => dispatch({ type: 'toggle', id })}
              onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
              onRename={(id, title) => dispatch({ type: 'rename', id, title })}
              onNah={(id) => dispatch({ type: 'nah', id })}
              onChangePlannedMinutes={(id, minutes) =>
                dispatch({ type: 'set-planned-minutes', id, minutes })
              }
            />
            <TaskColumn
              title="Tomorrow"
              tasks={tomorrowTasks}
              onAdd={(title, color) =>
                dispatch({ type: 'add', title, color, column: 'tomorrow' })
              }
              onToggle={(id) => dispatch({ type: 'toggle', id })}
              onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
              onRename={(id, title) => dispatch({ type: 'rename', id, title })}
              onNah={(id) => dispatch({ type: 'nah', id })}
              onChangePlannedMinutes={(id, minutes) =>
                dispatch({ type: 'set-planned-minutes', id, minutes })
              }
            />
            <TaskColumn
              title="Ever"
              tasks={everTasks}
              onAdd={(title, color) =>
                dispatch({ type: 'add', title, color, column: 'ever' })
              }
              onToggle={(id) => dispatch({ type: 'toggle', id })}
              onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
              onRename={(id, title) => dispatch({ type: 'rename', id, title })}
              onSlice={(id, target) => dispatch({ type: 'slice', id, target })}
              onDo={(id, target) => dispatch({ type: 'do', id, target })}
            />
          </>
        ) : (
          <>
            <TaskColumn
              title={formatDayLabel(state.viewDay)}
              tasks={pastTasks}
              onToggle={(id) => dispatch({ type: 'toggle', id })}
              onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
              onRename={(id, title) => dispatch({ type: 'rename', id, title })}
              onNah={(id) => dispatch({ type: 'nah', id })}
              onChangePlannedMinutes={(id, minutes) =>
                dispatch({ type: 'set-planned-minutes', id, minutes })
              }
              emptyText="no tasks on this day"
            />
            <TaskColumn
              title="Ever"
              tasks={everTasks}
              onAdd={(title, color) =>
                dispatch({ type: 'add', title, color, column: 'ever' })
              }
              onToggle={(id) => dispatch({ type: 'toggle', id })}
              onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
              onRename={(id, title) => dispatch({ type: 'rename', id, title })}
              onSlice={(id, target) => dispatch({ type: 'slice', id, target })}
              onDo={(id, target) => dispatch({ type: 'do', id, target })}
            />
          </>
        )}
      </main>
    </div>
  );
}
