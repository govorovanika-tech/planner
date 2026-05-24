import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { PLANNED_MINUTES_OPTIONS, Task, formatPlannedMinutes } from '../types';

type SliceTarget = 'today' | 'tomorrow';

type Props = {
  task: Task;
  onToggle: () => void;
  onChangeColor: () => void;
  onRename: (title: string) => void;
  onSlice?: (target: SliceTarget) => void;
  onNah?: () => void;
  onDo?: (target: SliceTarget) => void;
  onChangePlannedMinutes?: (minutes: number | null) => void;
};

export function TaskRow({
  task,
  onToggle,
  onChangeColor,
  onRename,
  onSlice,
  onNah,
  onDo,
  onChangePlannedMinutes,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [picker, setPicker] = useState<null | 'slice' | 'do'>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!picker) return;
    function onDocMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPicker(null);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [picker]);

  function startEdit() {
    setDraft(task.title);
    setEditing(true);
  }

  function commitEdit() {
    const next = draft.trim();
    if (next && next !== task.title) {
      onRename(next);
    }
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(task.title);
    setEditing(false);
  }

  function onEditKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') cancelEdit();
  }

  function onPlannedChange(value: string) {
    if (!onChangePlannedMinutes) return;
    if (value === '') {
      onChangePlannedMinutes(null);
    } else {
      onChangePlannedMinutes(Number(value));
    }
  }

  return (
    <li className={`task task-${task.color} ${task.completed ? 'done' : ''} ${task.parentId ? 'sliced' : ''}`}>
      <button
        type="button"
        className="color-strip"
        onClick={onChangeColor}
        disabled={task.completed}
        title="change color"
        aria-label="change color"
      />
      <input
        type="checkbox"
        checked={task.completed}
        onChange={onToggle}
      />
      {editing ? (
        <input
          autoFocus
          type="text"
          className="title-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={onEditKey}
        />
      ) : (
        <span
          className="title"
          role="button"
          tabIndex={0}
          onClick={startEdit}
          title="click to edit"
        >
          {task.title}
        </span>
      )}
      {onChangePlannedMinutes && (
        <select
          className="planned-select"
          value={task.plannedMinutes ?? ''}
          onChange={(e) => onPlannedChange(e.target.value)}
          title="time planned"
          aria-label="time planned"
        >
          <option value="">—</option>
          {PLANNED_MINUTES_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {formatPlannedMinutes(m)}
            </option>
          ))}
        </select>
      )}
      {onSlice && !task.completed && (
        picker === 'slice' ? (
          <div className="target-picker" ref={pickerRef}>
            <button
              type="button"
              className="slice"
              onClick={() => {
                onSlice('today');
                setPicker(null);
              }}
            >
              today
            </button>
            <button
              type="button"
              className="slice"
              onClick={() => {
                onSlice('tomorrow');
                setPicker(null);
              }}
            >
              tomorrow
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="slice"
            onClick={() => setPicker('slice')}
            title="copy to Today or Tomorrow"
          >
            slice
          </button>
        )
      )}
      {onDo && !task.completed && (
        picker === 'do' ? (
          <div className="target-picker" ref={pickerRef}>
            <button
              type="button"
              className="do"
              onClick={() => {
                onDo('today');
                setPicker(null);
              }}
            >
              today
            </button>
            <button
              type="button"
              className="do"
              onClick={() => {
                onDo('tomorrow');
                setPicker(null);
              }}
            >
              tomorrow
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="do"
            onClick={() => setPicker('do')}
            title="move to Today or Tomorrow"
          >
            do
          </button>
        )
      )}
      {onNah && !task.completed && (
        <button type="button" className="nah" onClick={onNah} title="move to Ever or remove">
          nah
        </button>
      )}
    </li>
  );
}
