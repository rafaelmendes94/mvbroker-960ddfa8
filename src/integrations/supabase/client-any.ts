// Loosely-typed Supabase client. Use in copied components where the column
// names don't match the current generated types (mockData fallback flow).
import { supabase as typed } from "./client";
export const supabase: any = typed;
