import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

export interface FieldConfig {
  id: string;
  label: string;
  colSpan?: number; // defaults to 1
  render: () => React.ReactNode;
}

interface DraggableFieldGridProps {
  storageKey: string;
  fields: FieldConfig[];
  columns?: number;
  editing?: boolean;
}

export function DraggableFieldGrid({ storageKey, fields, columns = 4, editing = false }: DraggableFieldGridProps) {
  const [fieldOrder, setFieldOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const fieldIds = fields.map(f => f.id);
        const valid = parsed.filter(id => fieldIds.includes(id));
        const missing = fieldIds.filter(id => !valid.includes(id));
        return [...valid, ...missing];
      }
    } catch {}
    return fields.map(f => f.id);
  });

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
    setFieldOrder(prev => {
      const items = [...prev];
      const [moved] = items.splice(dragIdx, 1);
      items.splice(dropIdx, 0, moved);
      localStorage.setItem(storageKey, JSON.stringify(items));
      return items;
    });
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, storageKey]);

  const onDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null); }, []);

  const fieldMap = new Map(fields.map(f => [f.id, f]));
  const orderedFields = fieldOrder
    .map(id => fieldMap.get(id))
    .filter((f): f is FieldConfig => !!f);

  // Add any fields not in the order
  const orderedIds = new Set(fieldOrder);
  fields.forEach(f => {
    if (!orderedIds.has(f.id)) orderedFields.push(f);
  });

  const gridClass = columns === 4 
    ? "grid grid-cols-2 sm:grid-cols-4" 
    : columns === 3 
    ? "grid grid-cols-2 sm:grid-cols-3" 
    : "grid grid-cols-2";

  return (
    <div className={cn(gridClass, "gap-x-6 gap-y-4")}>
      {orderedFields.map((field, idx) => {
        const isDragging = dragIdx === idx;
        const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
        const colSpanClass = field.colSpan === 2 ? "col-span-2" : field.colSpan === 3 ? "col-span-3" : field.colSpan === 4 ? "col-span-4" : "";

        return (
          <div
            key={field.id}
            draggable={editing}
            onDragStart={editing ? e => onDragStart(e, idx) : undefined}
            onDragOver={editing ? e => onDragOver(e, idx) : undefined}
            onDrop={editing ? e => onDrop(e, idx) : undefined}
            onDragEnd={editing ? onDragEnd : undefined}
            className={cn(
              "min-h-[52px] relative transition-all duration-100",
              colSpanClass,
              isDragging && "opacity-30 scale-95",
              isOver && "ring-2 ring-amber-400 rounded-lg",
              editing && "group/field"
            )}
          >
            {editing && (
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover/field:opacity-100 transition-opacity z-10">
                <GripVertical className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
              </div>
            )}
            <div className={cn(editing && "pl-3")}>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block leading-none">
                {field.label}
              </label>
              <div className="min-h-[32px] flex items-center">
                {field.render()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
