import React from 'react';
import { useCountdown } from '../hooks/useCountdown';
import { formatDateTime } from '../utils/helpers';

export const DeadlineBadge = ({ deadline, isSmall = false, format = 'countdown-h' }) => {
  const { isOverdue, d, h, m } = useCountdown(deadline);
  if (!deadline) return null;

  let text = '';
  if (format === 'datetime') {
    text = formatDateTime(deadline);
  } else if (format === 'countdown-hm') {
    if (d > 0) text = `${d}d ${h}h ${m}m`;
    else if (h > 0) text = `${h}h ${m}m`;
    else text = `${m}m`;
  } else {
    if (d > 0) text = `${d}d ${h}h`;
    else if (h > 0) text = `${h}h ${m}m`;
    else text = `${m}m`;
  }

  return (
    <span className={`${isSmall ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'} font-mono rounded whitespace-nowrap ml-2 ${isOverdue ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold blink-overdue' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>
      {format === 'datetime' ? text : (isOverdue ? `Spóźnione: ${text}` : `Pozostało: ${text}`)}
    </span>
  );
};