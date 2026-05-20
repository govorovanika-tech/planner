type Props = {
  amount: number;
  position: number;
  points: number;
  onClick: () => void;
};

export function MilestoneButton({ amount, position, points, onClick }: Props) {
  const disabled = points < amount;
  const label = amount >= 1000 ? `${amount / 1000}k` : `${amount}`;
  return (
    <button
      type="button"
      className="milestone"
      onClick={onClick}
      disabled={disabled}
      style={{ left: `${position}%` }}
      title={`spend ${amount} points`}
    >
      {label}
    </button>
  );
}
