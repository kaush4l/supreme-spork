/** `days_left` as the backend sent it, in a sentence. */
export function daysWords(daysLeft: number): string {
  if (daysLeft === 0) return "runs out today";
  if (daysLeft === 1) return "1 day left";
  if (daysLeft === -1) return "ran out 1 day ago";
  return daysLeft > 0
    ? `${daysLeft} days left`
    : `ran out ${-daysLeft} days ago`;
}
