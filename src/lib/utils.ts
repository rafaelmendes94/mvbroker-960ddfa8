import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatUnitParts(property: {
  unitNumber?: string | null;
  boxNumber?: string | null;
  quadra?: string | null;
  lote?: string | null;
}): string[] {
  const clean = (v: string) => v.trim().replace(/^(Qd?|Lt?|L)\s*[-.]?\s*/i, "");
  const parts: string[] = [];
  if (property.quadra?.trim()) parts.push(`Qd ${clean(property.quadra)}`);
  if (property.lote?.trim()) parts.push(`Lt ${clean(property.lote)}`);
  if (property.unitNumber?.trim()) parts.push(property.unitNumber.trim());
  if (property.boxNumber?.trim()) parts.push(property.boxNumber.trim());
  return parts;
}

