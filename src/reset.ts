export function mostRecent6am(now: Date): number {
  const six = new Date(now);
  six.setHours(6, 0, 0, 0);
  if (now.getTime() < six.getTime()) {
    six.setDate(six.getDate() - 1);
  }
  return six.getTime();
}
