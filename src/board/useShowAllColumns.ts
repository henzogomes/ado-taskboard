import { useEffect, useState } from 'react';

const KEY = 'ado-taskboard-show-all-columns';

function readStored(): boolean {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return true;
  return raw === '1';
}

export function useShowAllColumns() {
  const [showAll, setShowAll] = useState<boolean>(readStored);

  useEffect(() => {
    localStorage.setItem(KEY, showAll ? '1' : '0');
  }, [showAll]);

  return { showAll, toggle: () => setShowAll((v) => !v) };
}
