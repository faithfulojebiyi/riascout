import { DateTime } from 'luxon';

const toDateTime = (value: Date | string | number): DateTime =>
  value instanceof Date
    ? DateTime.fromJSDate(value)
    : typeof value === 'number'
      ? DateTime.fromMillis(value)
      : DateTime.fromISO(value);

/** "just now", "4 min ago", "yesterday", else a short date */
export const relativeTime = (value: Date | string | number): string => {
  const time = toDateTime(value);

  if (!time.isValid) return '';

  const minutes = Math.round(DateTime.now().diff(time, 'minutes').minutes);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  if (minutes < 60 * 48) return 'yesterday';

  return time.toFormat('d LLL');
};

/** "Today 18:24", "Yesterday 09:10", else "15 Jul at 12:47" */
export const exchangeTime = (value: Date | string | number): string => {
  const time = toDateTime(value);

  if (!time.isValid) return '';

  const group = dayGroup(value);
  const clock = time.toFormat('HH:mm');

  if (group === 'Today' || group === 'Yesterday') return `${group} ${clock}`;

  return `${time.toFormat('d LLL')} at ${clock}`;
};

export type DayGroup = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

export const dayGroup = (value: Date | string | number): DayGroup => {
  const time = toDateTime(value).startOf('day');
  const today = DateTime.now().startOf('day');
  const days = Math.round(today.diff(time, 'days').days);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 days';

  return 'Older';
};

export const DAY_GROUPS: DayGroup[] = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Older',
];
