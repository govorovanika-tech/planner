import { useStore } from './store';
import { ProgressBar } from './components/ProgressBar';
import { TaskColumn } from './components/TaskColumn';

export default function App() {
  const { state, dispatch } = useStore();
  const today = state.tasks.filter((t) => t.column === 'today');
  const ever = state.tasks.filter((t) => t.column === 'ever');

  return (
    <div className="app">
      <header>
        <h1>Planner</h1>
        <ProgressBar
          points={state.points}
          pendingBank={state.pendingBank}
          onSpend={(amount) => dispatch({ type: 'spend', amount })}
        />
      </header>
      <main className="columns">
        <TaskColumn
          title="Today"
          tasks={today}
          onAdd={(title, color) =>
            dispatch({ type: 'add', title, color, column: 'today' })
          }
          onToggle={(id) => dispatch({ type: 'toggle', id })}
          onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
          onRename={(id, title) => dispatch({ type: 'rename', id, title })}
          onNah={(id) => dispatch({ type: 'nah', id })}
        />
        <TaskColumn
          title="Ever"
          tasks={ever}
          onAdd={(title, color) =>
            dispatch({ type: 'add', title, color, column: 'ever' })
          }
          onToggle={(id) => dispatch({ type: 'toggle', id })}
          onChangeColor={(id) => dispatch({ type: 'cycle-color', id })}
          onRename={(id, title) => dispatch({ type: 'rename', id, title })}
          onSlice={(id) => dispatch({ type: 'slice', id })}
          onDo={(id) => dispatch({ type: 'do', id })}
        />
      </main>
    </div>
  );
}
