import { MILESTONES } from '../types';
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

type Props = {
  points: number;
  pendingBank: number;
  onSpend: (amount: number) => void;
};

export function ProgressBar({ points, pendingBank, onSpend }: Props) {
  return (
    <div className="progress">
      <div className="progress-stats">
        <span className="total">{points} pts</span>
        <span className="bank">bank: {pendingBank}</span>
      </div>
      <div className="bar-wrapper">
        <div className="bar-track">
          <div
            className="bar-fill"
            style={{ width: `${fillPercent(points)}%` }}
          />
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
