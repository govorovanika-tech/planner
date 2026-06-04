import { useState, KeyboardEvent, DragEvent, ReactNode } from 'react';
import { Task, Color, formatPlannedMinutes } from '../types';
import { TaskRow } from './TaskRow';
import { GroupHeader } from './GroupHeader';

type SliceTarget = 'today' | 'tomorrow';

export type GroupInfo = {
  groupId: string;
  name: string;
};

type Props = {
  title: string;
  tasks: Task[];
  groups?: GroupInfo[];
  liveChildParentIds?: Set<string>;
  onAdd?: (title: string, color: Color) => void;
  onToggle: (id: string) => void;
  onChangeColor: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSlice?: (id: string, target: SliceTarget) => void;
  onNah?: (id: string) => void;
  onDo?: (id: string, target: SliceTarget) => void;
  onCopyTo?: (id: string, target: SliceTarget) => void;
  onHardDelete?: (id: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onChangePlannedMinutes?: (id: string, minutes: number | null) => void;
  onDropTask?: (id: string, beforeId: string | null, clientX: number, clientY: number) => void;
  showTotalTime?: boolean;
  emptyText?: string;
};

const COLORS: Color[] = ['white', 'green', 'yellow', 'red'];

export function TaskColumn({
  title,
  tasks,
  groups,
  liveChildParentIds,
  onAdd,
  onToggle,
  onChangeColor,
  onRename,
  onSlice,
  onNah,
  onDo,
  onCopyTo,
  onHardDelete,
  onDeleteGroup,
  onChangePlannedMinutes,
  onDropTask,
  showTotalTime,
  emptyText,
}: Props) {
  const totalMinutes = showTotalTime
    ? tasks.reduce((sum, t) => sum + (t.plannedMinutes ?? 0), 0)
    : 0;
  const [draftColor, setDraftColor] = useState<Color | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: 'before' | 'after' } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleCollapsed(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function onTaskDragStart(e: DragEvent<HTMLLIElement>, task: Task) {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(task.id);
  }

  function onTaskDragEnd() {
    setDraggingId(null);
    setDropHint(null);
  }

  function onTaskDragOver(e: DragEvent<HTMLLIElement>, task: Task) {
    if (!onDropTask) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingId === task.id) {
      setDropHint(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const isAbove = e.clientY < rect.top + rect.height / 2;
    setDropHint({ id: task.id, pos: isAbove ? 'before' : 'after' });
  }

  function onTaskDrop(e: DragEvent<HTMLLIElement>, task: Task, nextId: string | null) {
    if (!onDropTask) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain');
    setDropHint(null);
    if (!id || id === task.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isAbove = e.clientY < rect.top + rect.height / 2;
    const beforeId = isAbove ? task.id : nextId;
    onDropTask(id, beforeId, e.clientX, e.clientY);
  }

  function onColDragOver(e: DragEvent<HTMLElement>) {
    if (!onDropTask) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onColDrop(e: DragEvent<HTMLElement>) {
    if (!onDropTask) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDropHint(null);
    if (!id) return;
    onDropTask(id, null, e.clientX, e.clientY);
  }

  function onColDragLeave(e: DragEvent<HTMLElement>) {
    if (!onDropTask) return;
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setDropHint(null);
    }
  }

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

  const groupById = new Map<string, GroupInfo>();
  if (groups) {
    for (const g of groups) groupById.set(g.groupId, g);
  }

  function renderTaskRow(task: Task, nextId: string | null, inGroup: boolean): ReactNode {
    return (
      <TaskRow
        key={task.id}
        task={task}
        hasLiveChild={liveChildParentIds?.has(task.id) ?? false}
        inGroup={inGroup}
        onToggle={() => onToggle(task.id)}
        onChangeColor={() => onChangeColor(task.id)}
        onRename={(t) => onRename(task.id, t)}
        onSlice={onSlice ? (target) => onSlice(task.id, target) : undefined}
        onNah={onNah ? () => onNah(task.id) : undefined}
        onDo={onDo ? (target) => onDo(task.id, target) : undefined}
        onCopyTo={onCopyTo ? (target) => onCopyTo(task.id, target) : undefined}
        onHardDelete={onHardDelete ? () => onHardDelete(task.id) : undefined}
        onChangePlannedMinutes={
          onChangePlannedMinutes
            ? (minutes) => onChangePlannedMinutes(task.id, minutes)
            : undefined
        }
        draggable={!!onDropTask && !task.dayKey}
        isDragging={draggingId === task.id}
        dragHint={dropHint?.id === task.id ? dropHint.pos : null}
        onTaskDragStart={onDropTask ? (e) => onTaskDragStart(e, task) : undefined}
        onTaskDragEnd={onDropTask ? onTaskDragEnd : undefined}
        onTaskDragOver={onDropTask ? (e) => onTaskDragOver(e, task) : undefined}
        onTaskDrop={onDropTask ? (e) => onTaskDrop(e, task, nextId) : undefined}
      />
    );
  }

  const renderedNodes: ReactNode[] = [];
  const renderedGroupIds = new Set<string>();
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.groupId && groupById.has(task.groupId)) {
      if (renderedGroupIds.has(task.groupId)) continue;
      renderedGroupIds.add(task.groupId);
      const groupInfo = groupById.get(task.groupId)!;
      const members = tasks.filter((t) => t.groupId === task.groupId);
      const memberIds = new Set(members.map((m) => m.id));
      const groupTotalMinutes = members.reduce(
        (sum, m) => sum + (m.plannedMinutes ?? 0),
        0,
      );
      const collapsed = collapsedGroups.has(task.groupId);
      renderedNodes.push(
        <GroupHeader
          key={`group-${task.groupId}`}
          name={groupInfo.name}
          count={members.length}
          totalMinutes={groupTotalMinutes}
          collapsed={collapsed}
          onToggleCollapsed={() => toggleCollapsed(task.groupId!)}
          onDelete={() => onDeleteGroup?.(task.groupId!)}
        />,
      );
      if (!collapsed) {
        for (let j = 0; j < members.length; j++) {
          const m = members[j];
          let nextId: string | null = null;
          if (j < members.length - 1) {
            nextId = members[j + 1].id;
          } else {
            for (let k = i + 1; k < tasks.length; k++) {
              if (!memberIds.has(tasks[k].id)) {
                nextId = tasks[k].id;
                break;
              }
            }
          }
          renderedNodes.push(renderTaskRow(m, nextId, true));
        }
      }
      continue;
    }
    const nextId = tasks[i + 1]?.id ?? null;
    renderedNodes.push(renderTaskRow(task, nextId, false));
  }

  return (
    <section
      className="column"
      onDragOver={onColDragOver}
      onDrop={onColDrop}
      onDragLeave={onColDragLeave}
    >
      <div className="column-header">
        <h2>
          {title}
          {totalMinutes > 0 && (
            <span className="column-total"> · {formatPlannedMinutes(totalMinutes)}</span>
          )}
        </h2>
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
        {renderedNodes}
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
