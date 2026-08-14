import { useEffect, useState } from 'react';

const KEY = 'ado-taskboard-expanded-sections';

// null => nothing stored yet (fall back to the default-single behavior).
function readStored(): string[] | null {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // corrupt value => treat as nothing stored
  }
  return null;
}

export function useExpandedSections(defaultExpandedId: string | null): {
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
} {
  const [expanded, setExpanded] = useState<string[] | null>(readStored);

  useEffect(() => {
    // No write until the user toggles (expanded stays null while unstored).
    if (expanded !== null) {
      localStorage.setItem(KEY, JSON.stringify(expanded));
    }
  }, [expanded]);

  const isExpanded = (id: string): boolean => {
    if (expanded === null) return id === defaultExpandedId;
    return expanded.includes(id);
  };

  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const base =
        prev ?? (defaultExpandedId !== null ? [defaultExpandedId] : []);
      return base.includes(id)
        ? base.filter((x) => x !== id)
        : [...base, id];
    });
  };

  return { isExpanded, toggle };
}
