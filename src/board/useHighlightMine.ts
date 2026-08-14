import { useEffect, useState } from 'react';

const KEY = 'ado-taskboard-highlight-mine';

function readStored(): boolean {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return true;
  return raw === '1';
}

export function useHighlightMine() {
  const [highlightMine, setHighlightMine] = useState<boolean>(readStored);

  useEffect(() => {
    localStorage.setItem(KEY, highlightMine ? '1' : '0');
  }, [highlightMine]);

  return { highlightMine, toggle: () => setHighlightMine((v) => !v) };
}
