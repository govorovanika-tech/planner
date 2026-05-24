import { useState, KeyboardEvent } from 'react';
import { Task, Color } from '../types';
import { TaskRow } from './TaskRow';

type SliceTarget = 'today' | 'tomorrow';

type Props = {
  title: string;
  tasks: Task[];
  onAdd?: (title: string, color: Color) => void;
  onToggle: (id: string) => void;
  onChangeColor: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSlice?: (id: string, target: SliceTarget) => void;
  onNah?: (id: string) => void;
  onDo?: (id: string, target: SliceTarget) => void;
  onChangePlannedMinutes?: (id: string, minutes: number | null) => void;
  emptyText?: string;
};

const COLORS: Color[] = ['green', 'yellow', 'red'];

export function TaskColumn({
  title,
  tasks,
  onAdd,
  onToggle,
  onChangeColor,
  onRename,
  onSlice,
  onNah,
  onDo,
  onChangePlannedMinutes,
  emptyText,
}: Props) {
  const [draftColor, setDraftColor] = useState<Color | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  function startDraft(color: Color) {
    setDraftColor(color);
    setDraftTitle('');
  }

  function commitDraft() {
    if (onAdd && draftColor && draftTitle.trim()) {
      onAdd(draftTitle.trim(), draftColor);
    }
    setDraftColor(null);
    setDraftTitle('');
  }

  function cancelDraft() {
    setDraftColor(null);
    setDraftTitle('');
  }

  function onDraftKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitDraft();
    else if (e.key === 'Escape') cancelDraft();
  }

  return (
    <section className="column">
      <div className="column-header">
        <h2>{title}</h2>
        {onAdd && (
          <div className="column-actions">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`add-dot add-dot-${c}`}
                onClick={() => startDraft(c)}
                title={`add ${c} task`}
                aria-label={`add ${c} task`}
              />
            ))}
          </div>
        )}
      </div>
      <ul>
        {tasks.length === 0 && !draftColor && (
          <li className="empty">{emptyText ?? 'no tasks'}</li>
        )}
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={() => onToggle(task.id)}
            onChangeColor={() => onChangeColor(task.id)}
            onRename={(t) => onRename(task.id, t)}
            onSlice={onSlice ? (target) => onSlice(task.id, target) : undefined}
            onNah={onNah ? () => onNah(task.id) : undefined}
            onDo={onDo ? (target) => onDo(task.id, target) : undefined}
            onChangePlannedMinutes={
              onChangePlannedMinutes
                ? (minutes) => onChangePlannedMinutes(task.id, minutes)
                : undefined
            }
          />
        ))}
        {draftColor && (
          <li className={`task task-${draftColor} draft`}>
            <span className="color-strip" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              className="draft-input"
              value={draftTitle}
              placeholder="task title"
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={onDraftKey}
            />
          </li>
        )}
      </ul>
    </section>
  );
}
