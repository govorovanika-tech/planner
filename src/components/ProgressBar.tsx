import { Color, CompletionSnapshot, MILESTONES } from '../types';
import { MilestoneButton } from './MilestoneButton';

type Milestone = (typeof MILESTONES)[number];

const POSITIONS: Record<Milestone, number> = {
  5000: 25,
  10000: 50,
  20000: 75,
  50000: 100,
};

function fillPercent(points: number): number {
  if (points <= 0) return 0;
  if (points < 5000) return (points / 5000) * 25;
  if (points < 10000) return 25 + ((points - 5000) / 5000) * 25;
  if (points < 20000) return 50 + ((points - 10000) / 10000) * 25;
  if (points < 50000) return 75 + ((points - 20000) / 30000) * 25;
  return 100;
}

export type ProgressEntry = {
  id: string;
  color: Color;
  snapshot: CompletionSnapshot;
};

type Segment = {
  id: string;
  color: Color;
  total: number;
  absorbedGreen: number;
};

function buildSegments(completions: ProgressEntry[], points: number): Segment[] {
  const raw: Segment[] = [];
  for (const entry of completions) {
    const snap = entry.snapshot;
    if (snap.points <= 0) continue;
    raw.push({
      id: entry.id,
      color: entry.color,
      total: snap.points,
      absorbedGreen: Math.max(0, -snap.bank),
    });
  }

  const earned = raw.reduce((s, seg) => s + seg.total, 0);
  let spent = Math.max(0, earned - points);

  const out: Segment[] = [];
  for (const seg of raw) {
    if (spent <= 0) {
      out.push(seg);
      continue;
    }
    if (spent >= seg.total) {
      spent -= seg.total;
      continue;
    }
    const remaining = seg.total - spent;
    const colorPortion = seg.total - seg.absorbedGreen;
    const newColor = Math.max(0, colorPortion - spent);
    const newAbsorbed = remaining - newColor;
    out.push({
      id: seg.id,
      color: seg.color,
      total: remaining,
      absorbedGreen: newAbsorbed,
    });
    spent = 0;
  }
  return out;
}

type Props = {
  points: number;
  pendingBank: number;
  completions: ProgressEntry[];
  onSpend: (amount: number) => void;
};

export function ProgressBar({ points, pendingBank, completions, onSpend }: Props) {
  const segments = buildSegments(completions, points);

  let cursor = 0;
  return (
    <div className="progress">
      <div className="progress-stats">
        <span className="total">{points} pts</span>
        <span className="bank">bank: {pendingBank}</span>
      </div>
      <div className="bar-wrapper">
        <div className="bar-track">
          {segments.map((seg) => {
            const lo = cursor;
            const hi = cursor + seg.total;
            cursor = hi;
            const left = fillPercent(lo);
            const width = fillPercent(hi) - left;
            const colorPortion = seg.total - seg.absorbedGreen;
            const colorPct = (colorPortion / seg.total) * 100;
            const tailPct = (seg.absorbedGreen / seg.total) * 100;
            return (
              <div
                key={seg.id}
                className="bar-segment"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                {colorPortion > 0 && (
                  <div
                    className={`bar-segment-color bar-segment-color-${seg.color}`}
                    style={{ width: `${colorPct}%` }}
                  />
                )}
                {seg.absorbedGreen > 0 && (
                  <div
                    className="bar-segment-tail"
                    style={{ width: `${tailPct}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="milestones">
          {MILESTONES.map((m) => (
            <MilestoneButton
              key={m}
              amount={m}
              position={POSITIONS[m]}
              points={points}
              onClick={() => onSpend(m)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
