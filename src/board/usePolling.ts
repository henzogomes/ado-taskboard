import { useEffect, useState } from 'react';

const KEY = 'ado-taskboard-poll-interval';

export interface PollOption {
  value: number;
  label: string;
}

/** Off by default; a user opting in gets a background refetch at the chosen cadence. */
export const POLL_OPTIONS: PollOption[] = [
  { value: 0, label: 'Off' },
  { value: 30_000, label: '30s' },
  { value: 60_000, label: '1m' },
  { value: 300_000, label: '5m' },
];

function readStored(): number {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return 0;
  const n = Number(raw);
  return POLL_OPTIONS.some((o) => o.value === n) ? n : 0;
}

/**
 * The background auto-refresh interval, persisted in localStorage. `intervalMs`
 * is 0 (off) by default, so the board stays `staleTime: Infinity` until the user
 * opts in; choosing a cadence drives a `refresh()` interval in `App`.
 */
export function usePolling() {
  const [intervalMs, setIntervalMs] = useState<number>(readStored);

  useEffect(() => {
    localStorage.setItem(KEY, String(intervalMs));
  }, [intervalMs]);

  return { intervalMs, setIntervalMs, options: POLL_OPTIONS };
}
