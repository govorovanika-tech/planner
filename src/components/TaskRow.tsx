import { KeyboardEvent, useState } from 'react';
import { Task } from '../types';

type Props = {
  task: Task;
  onToggle: () => void;
  onChangeColor: () => void;
  onRename: (title: string) => void;
  onSlice?: () => void;
  onNah?: () => void;
  onDo?: () => void;
};

export function TaskRow({ task, onToggle, onChangeColor, onRename, onSlice, onNah, onDo }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

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
      {onSlice && !task.completed && (
        <button type="button" className="slice" onClick={onSlice} title="copy to Today">
          slice
        </button>
      )}
      {onDo && !task.completed && (
        <button type="button" className="do" onClick={onDo} title="move to Today">
          do
        </button>
      )}
      {onNah && !task.completed && (
        <button type="button" className="nah" onClick={onNah} title="move to Ever">
          nah
        </button>
      )}
    </li>
  );
}
