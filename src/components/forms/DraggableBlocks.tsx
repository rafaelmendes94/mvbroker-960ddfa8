import { Children, useEffect, useState, type ReactElement } from "react";
import { GripVertical } from "lucide-react";

/**
 * Reorderable vertical stack of children blocks. Order persists in localStorage by storageKey.
 * Each child must have a stable `key`.
 */
export function DraggableBlocks({
  children,
  storageKey,
}: {
  children: React.ReactNode;
  storageKey: string;
}) {
  const items = Children.toArray(children).filter(Boolean) as ReactElement[];
  const defaultOrder = items.map((c) => String(c.key));
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [dragKey, setDragKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // merge: keep saved order, append any new keys
        const merged = [
          ...parsed.filter((k) => defaultOrder.includes(k)),
          ...defaultOrder.filter((k) => !parsed.includes(k)),
        ];
        setOrder(merged);
      }
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persist(next: string[]) {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* noop */
    }
  }

  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const next = [...order];
    const from = next.indexOf(dragKey);
    const to = next.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    persist(next);
    setDragKey(null);
  }

  const byKey = new Map(items.map((c) => [String(c.key), c]));
  const ordered = order.map((k) => byKey.get(k)).filter(Boolean) as ReactElement[];

  return (
    <div className="space-y-4">
      {ordered.map((child) => {
        const k = String(child.key);
        return (
          <div
            key={k}
            draggable
            onDragStart={() => setDragKey(k)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(k)}
            onDragEnd={() => setDragKey(null)}
            className={`relative group ${dragKey === k ? "opacity-60" : ""}`}
          >
            <div className="absolute -left-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-move text-muted-foreground">
              <GripVertical className="w-4 h-4" />
            </div>
            {child}
          </div>
        );
      })}
    </div>
  );
}
