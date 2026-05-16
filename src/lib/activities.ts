import type { Activity } from "./types";
import { supabase } from "@/integrations/supabase/client";

let cache: Activity[] | null = null;
let loadingPromise: Promise<Activity[]> | null = null;

export async function loadLibrary(): Promise<Activity[]> {
  if (cache) return cache;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const { data, error } = await supabase
      .from("activities")
      .select("id, name, body_parts, types");
    if (error) {
      loadingPromise = null;
      throw error;
    }
    const mapped: Activity[] = (data ?? []).map(row => ({
      id: row.id as string,
      name: row.name as string,
      body_parts: (row.body_parts ?? []) as string[],
      types: (row.types ?? []) as string[],
      source: "library",
    }));
    cache = mapped;
    return mapped;
  })();
  return loadingPromise;
}
