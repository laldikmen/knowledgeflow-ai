// Format a date-only value ('YYYY-MM-DD', or an ISO string) for display WITHOUT
// timezone conversion, so a deadline always shows the day it was stored on.
export function formatDateOnly(value?: string | null): string {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  // Build a LOCAL date from the parts (no UTC shift).
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
