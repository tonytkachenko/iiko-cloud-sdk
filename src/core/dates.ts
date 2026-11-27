// iiko's date format is "yyyy-MM-dd HH:mm:ss.fff". Fields documented "in UTC" use these helpers.
// Fields documented as terminal-local time without a time zone (e.g. completeBefore) are NOT UTC:
// format the wall-clock time yourself.
const pad = (value: number, width = 2) => String(value).padStart(width, "0");

export function toIikoDateUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
    pad(date.getUTCMilliseconds(), 3)
  );
}

export function fromIikoDateUtc(value: string): Date {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Not an iiko date: ${value}`);
  return date;
}
